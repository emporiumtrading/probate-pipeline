#!/usr/bin/env python3
"""Fill the sender's details into held letter drafts from config.yaml → business.

Drafts written before the owner entered the Business identity carry placeholders such as
"[Your name / company / mailing address / phone / email]". Each run (after the owner's Setup
saves are applied to config.yaml) this replaces those sender placeholders in
leads/*/outreach-drafts.md with the real details. Only the sender's own lines change; the
recipients' details ("[Office address — look up ...]") are left for the workers. A detail the
owner hasn't entered stays as a placeholder, and a licence placeholder is kept as is.

  python3 scripts/fill_signature.py            # fill every draft
  python3 scripts/fill_signature.py --check    # count drafts still waiting for details
"""
import glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def business():
    """config.yaml → business, read without a YAML library (the Render jobs' Python has none)."""
    txt = open(os.path.join(ROOT, "config.yaml")).read()
    m = re.search(r"(?m)^business:.*\n((?:[ \t]+.*\n|\n)*?)(?=^\S)", txt)
    out = {}
    for line in (m.group(1) if m else "").splitlines():
        mm = re.match(r'^  (\w+):[ \t]*(?:"((?:[^"\\]|\\.)*)"|([^#\n]*?))[ \t]*(?:#.*)?$', line)
        if mm:
            out[mm.group(1)] = (mm.group(2) if mm.group(2) is not None else mm.group(3) or "").replace('\\"', '"').strip()
    return out


def block(b, licence):
    lines = [b.get("signer") or "[Your name]", b.get("legal_name") or "[company]",
             b.get("mailing_address") or "[mailing address]",
             " · ".join(x for x in (b.get("phone"), b.get("email")) if x) or "[phone / email]"]
    if licence:
        lines.append("[" + licence + "]")
    return "\n".join(lines)


SENDER = re.compile(r"\[Your name / company[^\]]*\]")


def fill(text, b):
    def sender(m):
        lic = re.search(r"licen[cs]e #[^/\]]*(?:or licensed partner)?(?:, if any)?", m.group(0))
        return block(b, lic.group(0) if lic else "")
    out = SENDER.sub(sender, text)
    person = person_name(b)
    # One-line sender: "[Name] | [Company] | [Phone] | [Email] | [License # if any]" (no licence: the part is dropped).
    def oneline(m):
        parts = [person or "[Name]", b.get("legal_name") or "[Company]", b.get("phone") or "[Phone]", b.get("email") or "[Email]"]
        return " | ".join(parts)
    out = re.sub(r"\[Name\] \| \[Company\] \| \[Phone\] \| \[Email\](?: \| \[License # if any\])?", oneline, out)
    if person:
        out = re.sub(rf"(?m)^({CLOSINGS}[ \t]*\n)\[Name\][ \t]*$", lambda m: m.group(1) + person, out)
    # Honesty (owner decision 2026-11-27): the company is in Chicago, so a letter never calls us "local".
    out = re.sub(r"\b(I'm|I am|is|as) a local real[- ]estate investor", r"\1 a real-estate investor", out)
    out = re.sub(r"\b(?:a )?local (real[- ]estate )?investor\b", lambda m: ("a " if m.group(0).startswith("a ") else "") + (m.group(1) or "real-estate ") + "investor", out)
    if person:
        out = re.sub(r"this is \[name\]([.,])", lambda m: f"this is {person}{m.group(1)}", out, flags=re.I)
    if person:
        out = out.replace("[Your name]", person).replace("[Owner name]", person)   # the person, without a title
    if person or b.get("legal_name"):
        out = out.replace("[Owner name / company]", ", ".join(x for x in (person, b.get("legal_name")) if x))
    if b.get("mailing_address"):
        out = out.replace("[mailing address]", b["mailing_address"])
    contact = " · ".join(x for x in (b.get("phone"), b.get("email")) if x)
    if contact:
        out = re.sub(r"\[phone ?/ ?email\]", contact, out)
    return out


def person_name(b):
    """The signer's own name ("Jane Doe" from "Jane Doe, Manager - Acme LLC")."""
    sg = (b.get("signer") or "").strip()
    return re.split(r"\s*[,–—-]\s+", sg)[0].strip() if sg else ""


STATE = os.path.join(ROOT, "pipeline", "signature-applied.json")
CLOSINGS = r"(?:Sincerely|Regards|Kind regards|Best regards|Respectfully|Thank you|With sympathy|Warm regards),?"


def update(text, old, b):
    """Replace a sender block (and sign-off names) written earlier with the current details."""
    out = text.replace(block(old, ""), block(b, ""))
    op, np_ = person_name(old), person_name(b)
    if op and np_ and op != np_:
        out = re.sub(rf"(?m)^({CLOSINGS}[ \t]*\n){re.escape(op)}$", lambda m: m.group(1) + np_, out)
        out = out.replace(f"My name is {op}.", f"My name is {np_}.")
        if old.get("legal_name"):
            out = out.replace(f"{op}, {old['legal_name']}", f"{np_}, {b.get('legal_name') or old['legal_name']}")
    return out


def main():
    import json
    b = business()
    files = sorted(glob.glob(os.path.join(ROOT, "leads", "*", "outreach-drafts.md")))
    if "--check" in sys.argv:
        waiting = [f for f in files if SENDER.search(open(f).read()) or re.search(r"\[(Your name|Name|Company|Phone|Email)\]", open(f).read())]
        print(f"fill_signature: {len(waiting)} of {len(files)} drafts still have sender placeholders")
        return
    if not (b.get("legal_name") or b.get("signer")):
        print("fill_signature: no business details yet (Setup → Business identity); drafts left as they are")
        return
    old = json.load(open(STATE)) if os.path.exists(STATE) else None
    changed = 0
    for f in files:
        t = open(f).read()
        n = fill(update(t, old, b) if old and old != b else t, b)
        if n != t:
            open(f, "w").write(n)
            changed += 1
    keep = {k: b.get(k, "") for k in ("signer", "legal_name", "mailing_address", "phone", "email")}
    json.dump(keep, open(STATE, "w"), indent=1, sort_keys=True)
    print(f"fill_signature: sender details filled in {changed} of {len(files)} drafts")


if __name__ == "__main__":
    main()
