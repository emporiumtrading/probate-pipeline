#!/usr/bin/env python3
"""Build one attorney review packet per market: legal/attorney-packets/<market-id>.md.

Each packet collects what a local attorney must review before the market can switch
to autonomous outreach: the blocking issues, required disclosures and open questions
from legal/<STATE>.md, the outreach templates actually used, and a sign-off table.
Usage: python3 scripts/build_attorney_packet.py [market-id ...]   (default: all markets)
"""
import datetime, os, re, sys
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILL = os.path.join(ROOT, ".claude/skills/probate-wholesale-deal/references")
WANT = ("Blocking issues", "Required contract disclosures", "Questions for the attorney")


def sections(text):
    """Return {heading: body} for the '## ' sections whose heading starts with one of WANT."""
    out, cur, buf = {}, None, []
    for line in text.splitlines():
        if line.startswith("## "):
            if cur:
                out[cur] = "\n".join(buf).strip()
            title = line[3:].strip()
            cur = title if title.startswith(WANT) else None
            buf = []
        elif cur:
            buf.append(line)
    if cur:
        out[cur] = "\n".join(buf).strip()
    return out


def template_sections(text, names):
    keep, out = False, []
    for line in text.splitlines():
        if line.startswith("## "):
            keep = line[3:].strip() in names
        if keep:
            out.append(line)
    return "\n".join(out).strip()


def build(m, cfg_text, templates, biz):
    st = m["state"]
    b = lambda k: (biz.get(k) or "").strip() or "**[missing: fill in config.yaml → business]**"
    path = os.path.join(ROOT, "legal", f"{st}.md")
    if not os.path.exists(path):
        return None, f"{m['id']}: no legal/{st}.md yet (skipped)"
    legal = open(path).read()
    verified = (re.search(r"Last verified:\s*([0-9-]+)", legal) or [None, "unknown"])[1]
    secs = sections(legal)
    missing = [w for w in WANT if not any(k.startswith(w) for k in secs)]
    # the comment on this market's outreach_allowed line in config.yaml, if any
    note = ""
    block = re.search(rf"- id: {re.escape(m['id'])}\n(.*?)(?=\n  - id: |\n[a-z_]+:|\Z)", cfg_text, re.S)
    if block:
        c = re.search(r"outreach_allowed:.*?#\s*(.+)", block.group(1))
        note = c.group(1).strip() if c else ""
    today = datetime.date.today().isoformat()
    L = [
        f"# Attorney review packet: {m.get('county')} County, {st}",
        "",
        f"Prepared {today} from `legal/{st}.md` (last verified {verified}). This packet asks a licensed {st} attorney to review and approve how we contact estates and contract for probate property in this county. Nothing here is legal advice; every rule below is our own research and is listed for the attorney to confirm or correct.",
        "",
        "## Who we are",
        f"- Company: {b('legal_name')} (formed in {b('entity_state')})",
        f"- Mailing address: {b('mailing_address')}",
        f"- Phone: {b('phone')} · Email: {b('email')} · Website: {b('website')}",
        f"- Signs contracts: {b('signer')}",
        f"- Title company holding earnest money: " + ((biz.get('title_company') or '').strip() or f"chosen for this market by our Professional Network (shortlist in network/{m['id']}.md); earnest money is only ever held in a title company's escrow account"),
        f"- Licensed in {st}, or licensed partner, if required: {'yes' if m.get('licensed_or_partnered') else 'not yet'}",
        "",
        "## What we do",
        "We find estates in probate that own real property, write to the personal representative (or the estate's attorney, when one is listed), and offer to buy the property as-is for cash with no fees or repairs for the estate. We sign a purchase contract with the estate, then either assign that contract to a vetted cash buyer for a fee or buy and resell at a simultaneous closing. The title company holds all earnest money and handles closing. We disclose our intent to assign in writing, we never call or text without the legal basis to do so, and we honor every stop request the same day.",
        "",
        "## What we are asking you to approve",
        "1. The letters below (one per lead type: estates, heirs, trustees, families where no one is appointed yet, and partition cases), for use in this county without changes (or with your edits).",
        f"2. A purchase contract, assignment agreement and disclosure forms for {st} probate sales: your firm's forms or a state association form you approve.",
        "3. Answers to the blocking issues and questions below.",
        "4. Whether the court must approve sales in this county, and how earnest money and any consent or price floor work for estate sales.",
        "",
    ]
    if note:
        L += [f"**Current status in our system:** {note}", ""]
    for w in WANT:
        for k, v in secs.items():
            if k.startswith(w):
                L += [f"## {k}", "", v or "_(none listed)_", ""]
    if missing:
        L += ["## Not yet researched", "", "Our legal file has no section for: " + ", ".join(missing) + ". Please advise.", ""]
    L += ["## Templates to review", "", templates, ""]
    loi = os.path.join(ROOT, "templates", "buyer-letter-of-intent.md")
    if os.path.exists(loi):   # owner decision 2026-11-26: vetted buyers sign it before we offer them contracts
        L += ["## Buyer letter of intent (non-binding) to review", "", "We ask vetted cash buyers to sign this before we offer them contracts. Please confirm it is non-binding and lawful in this state, and answer the questions at its end.", "",
              open(loi).read().split("# Buyer Letter of Intent", 1)[-1].split("\n", 1)[-1].strip(), ""]
    L += [
        "## Sign-off",
        "",
        "| Item | Approved as is | Approved with edits | Not approved | Attorney initials / date |",
        "|---|---|---|---|---|",
        "| Letter to personal representative | | | | |",
        "| Letter to estate attorney | | | | |",
        "| Letter to heirs (estate closed or title passed to heirs) | | | | |",
        "| Letter to successor trustee | | | | |",
        "| Options letter (no one appointed; 60+ days after death) | | | | |",
        "| Letter to parties' attorneys (partition) | | | | |",
        "| Purchase contract | | | | |",
        "| Assignment + disclosures | | | | |",
        "| Calls/texts allowed (and how) | | | | |",
        "",
        f"Once every row is approved, the owner records it in `legal/{st}.md` and adds `attorney_approved: <date>` to this market in `config.yaml`. With `autonomy.outreach: autonomous`, only markets with that date send without per-message approval.",
    ]
    return "\n".join(L) + "\n", None


def main():
    cfg_path = os.path.join(ROOT, "config.yaml")
    cfg_text = open(cfg_path).read()
    cfg = yaml.safe_load(cfg_text)
    tpl = template_sections(open(os.path.join(SKILL, "outreach-templates.md")).read(),
                            {"Letter to personal representative", "To the estate's attorney", "Letter to heirs", "Letter to successor trustee", "Options letter (no one appointed yet)", "To the parties' attorneys (partition)"})
    want = set(sys.argv[1:])
    outdir = os.path.join(ROOT, "legal", "attorney-packets")
    os.makedirs(outdir, exist_ok=True)
    for m in cfg["markets"]:
        if want and m["id"] not in want:
            continue
        text, err = build(m, cfg_text, tpl, cfg.get("business") or {})
        if err:
            print(err)
            continue
        if "[missing:" in text:
            print(f"{m['id']}: business details missing in config.yaml; packet marked, not ready to send")
        out = os.path.join(outdir, f"{m['id']}.md")
        open(out, "w").write(text)
        print(f"wrote {os.path.relpath(out, ROOT)}")


if __name__ == "__main__":
    main()
