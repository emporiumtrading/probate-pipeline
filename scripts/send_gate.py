#!/usr/bin/env python3
"""Last check before anything is mailed or emailed to a family (owner request 2026-11-27).

Letters and emails are sent by the Communications worker calling Lob or Resend directly, so this script is the
mechanical gate it must run immediately before each send. It prints PASS or HOLD with every reason and exits 0 only
on PASS. It never sends anything itself and never loosens a rule; the Compliance Officer's own review still applies.

  python3 scripts/send_gate.py <lead_id> [--first]      # --first: this is the first contact with the family

Checks: the lead exists and isn't stopped or dead; its market is live, outreach_allowed and attorney_approved; the
lead type is switched on; the state's rules are researched (legal/state-rules.csv) and, where a licence is needed or
unknown, the market is licensed or partnered; the 90-day wait (and 12 months for tax-delinquent leads) has passed;
tax-delinquent leads have known tax-sale rules; the recipient's address isn't on the stop list; the Compliance
Officer logged a PASS for this lead.
"""
import csv
import datetime
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import state_rules  # noqa: E402


def months_after(d, m):
    y, mo = divmod(d.month - 1 + m, 12)
    return datetime.date(d.year + y, mo + 1, min(d.day, 28))


def gate(lead_id, first):
    cfg = open(os.path.join(ROOT, "config.yaml")).read()
    trk = {r["lead_id"]: r for r in csv.DictReader(open(os.path.join(ROOT, "pipeline", "deal-tracker.csv")))}
    r = trk.get(lead_id)
    if not r:
        return [f"no lead {lead_id} in the tracker"]
    why = []
    st, county, ltype = r["state"].upper(), r["county"], (r.get("lead_type") or "probate").strip()
    if (r.get("dnc_or_stop") or "").strip().lower() not in ("", "no", "false", "0"):
        why.append("the family asked us to stop (dnc_or_stop)")
    if r.get("stage") in ("Dead", "Paid"):
        why.append(f"lead is {r['stage']}")
    # market
    mk = None
    for blk in cfg.split("\nexpansion_queue")[0].split("\n  - id: ")[1:]:
        mid, _, body = blk.partition("\n")
        mid, body = mid.strip(), "\n" + body
        if re.search(rf"\n?    state: {st}\b", body) and re.search(rf"    county: {re.escape(county)}\b", body):
            mk = (mid, body)
    if not mk:
        why.append(f"{county}, {st} is not a live market")
    else:
        mid, body = mk
        if not re.search(r"    outreach_allowed: true", body):
            why.append(f"{mid}: outreach_allowed is not true")
        if not re.search(r"    attorney_approved: \d{4}-", body):
            why.append(f"{mid}: no attorney_approved date")
    # lead type
    lt = re.search(r"\nlead_types:[^\n]*\n((?:  [^\n]*\n)+)", cfg)
    on = {k for k, v in re.findall(r"^  (\w+):\s*(true|false)", lt.group(1) if lt else "", re.M) if v == "true"}
    if ltype not in on:
        why.append(f"lead type {ltype} is switched off")
    # state rules
    rule = {x["state"]: x for x in state_rules.load()}.get(st, {})
    if rule.get("rules_status", "not_started") == "not_started":
        why.append(f"{st} rules not researched yet (legal/state-rules.csv)")
    if rule.get("wholesale_license", "unknown") in ("yes", "threshold", "unknown") and mk and not re.search(r"licensed_or_partnered: true", mk[1]):
        why.append(f"{st}: a licence may be needed to wholesale ({rule.get('wholesale_license', 'unknown')}) and this market isn't licensed_or_partnered")
    if ltype == "tax_delinquent_inherited" and rule.get("tax_sale_type", "unknown") == "unknown":
        why.append(f"{st}: tax-sale rules unknown, so tax-delinquent letters wait")
    # waits after death (first contact only)
    if first:
        wait = int((re.search(r"min_days_after_death:\s*(\d+)", cfg) or [None, "90"])[1])
        m = re.search(r"\d{4}-\d{2}-\d{2}", r.get("date_of_death") or "")
        f = re.search(r"\d{4}-\d{2}-\d{2}", r.get("filing_date") or "")
        today = datetime.date.today()
        base = m or f
        if not base:
            why.append("no date of death or filing date")
        elif today < datetime.date.fromisoformat(base.group(0)) + datetime.timedelta(days=wait):
            why.append(f"{wait}-day wait after death not over")
        if ltype == "tax_delinquent_inherited":
            months = int((re.search(r"tax_delinquent_min_months_after_death:\s*(\d+)", cfg) or [None, "12"])[1])
            if not m:
                why.append("tax-delinquent lead with no known date of death")
            elif today < months_after(datetime.date.fromisoformat(m.group(0)), months):
                why.append(f"{months}-month wait after death not over")
    # stop list (by address)
    addr = (r.get("address") or "").split(",")[0].strip().lower()
    sp = os.path.join(ROOT, "pipeline", "stop-list.csv")
    for s in (csv.DictReader(open(sp)) if os.path.exists(sp) else []):
        if addr and addr in (s.get("address_or_email") or "").lower():
            why.append("property address is on the stop list")
    # compliance PASS on file
    cl = os.path.join(ROOT, "leads", lead_id, "compliance-log.md")
    if not (os.path.exists(cl) and re.search(r"\bPASS\b", open(cl).read())):
        why.append("no Compliance Officer PASS in leads/<id>/compliance-log.md")
    return why


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    if not a:
        sys.exit(__doc__)
    w = gate(a[0], "--first" in sys.argv)
    print("PASS" if not w else "HOLD\n- " + "\n- ".join(w))
    sys.exit(0 if not w else 1)
