#!/usr/bin/env python3
"""sign_check.py: may the company sign this contract with its e-signature?
(config.yaml → company_signature, owner decision 2026-11-25)

PASS only if every limit holds; anything else goes to the owner's Sign queue.
The Contract Desk runs this with the terms read from the filled packet and pastes
the output into leads/<id>/contract/summary.md before any company signature.

Usage: python3 scripts/sign_check.py <lead_id> --doc purchase_agreement|assignment
         --price N --earnest N --inspection-days N --assignable yes|no --template <file>
Exit 0 = PASS, 1 = FAIL (reasons printed).
"""
import argparse, csv, os, re, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument("lead_id")
ap.add_argument("--doc", required=True)
ap.add_argument("--price", type=float, required=True)
ap.add_argument("--earnest", type=float, required=True)
ap.add_argument("--inspection-days", type=int, required=True)
ap.add_argument("--assignable", required=True, choices=["yes", "no"])
ap.add_argument("--template", required=True, help="the templates/<STATE>/ file the packet was filled from")
a = ap.parse_args()

cfg = open("config.yaml").read()
fails = []


def block(name):
    m = re.search(rf"\n{name}:[^\n]*\n((?:  [^\n]*\n)+)", cfg)
    return dict(re.findall(r"^\s+(\w+):\s*\"?([^\"#\n]*?)\"?\s*(?:#.*)?$", m.group(1), re.M)) if m else {}


cs, em = block("company_signature"), block("earnest_money")
if cs.get("enabled") != "true":
    fails.append("company signature is switched off")
if not re.match(r"\d{4}-\d\d-\d\d", cs.get("resolution_signed_on", "")):
    fails.append("the owner hasn't signed the company resolution")
if not re.match(r"\d{4}-\d\d-\d\d", cs.get("attorney_confirmed_on", "")):
    fails.append("the attorney hasn't confirmed the resolution")
if a.doc not in [d.strip() for d in cs.get("documents", "").split(",")]:
    fails.append(f"'{a.doc}' isn't a document the company may sign")

t = next((r for r in csv.DictReader(open("pipeline/deal-tracker.csv")) if r.get("lead_id") == a.lead_id), None)
if not t:
    print(f"FAIL: lead {a.lead_id} not in the tracker")
    sys.exit(1)
state = (t.get("state") or "").upper()
if state not in [s.strip().upper() for s in cs.get("attorney_confirmed_states", "").split(",") if s.strip()]:
    fails.append(f"the attorney hasn't confirmed company signing for {state or 'this state'}")
market = next((m for m in re.findall(r"\n  - id: ([\w-]+)", cfg) if a.lead_id.startswith(m + "-")), "")
body = re.search(rf"\n  - id: {re.escape(market)}\n(.*?)(?=\n  - id: |\n\S|\Z)", cfg, re.S) if market else None
if not (body and re.search(r"attorney_approved:\s*\d{4}-\d\d-\d\d", body.group(1))):
    fails.append(f"market {market or '?'} has no attorney-approved templates")
if not (a.template.startswith(f"templates/{state}/") and os.path.exists(a.template)):
    fails.append(f"template {a.template} isn't an approved templates/{state}/ file")

if a.doc == "purchase_agreement":
    mao = float((t.get("mao") or "0").replace(",", "") or 0)
    if not mao or a.price > mao:
        fails.append(f"price ${a.price:,.0f} is above the max offer ${mao:,.0f}" if mao else "no max offer in the tracker")
    if a.assignable != "yes":
        fails.append("the contract isn't assignable")
    # Every company-signed purchase needs a way out: an inspection/due-diligence period, deposit or not.
    if a.inspection_days < int(float(em.get("min_inspection_days", "10") or 10)):
        fails.append(f"fewer than {em.get('min_inspection_days', '10')} inspection days to walk away (with any deposit refunded)")
    if a.earnest > 0:
        r = subprocess.run([sys.executable, "scripts/reserve.py", "--fits", str(a.earnest), "--lead", a.lead_id], capture_output=True, text=True)
        if r.returncode != 0:
            fails.append(r.stdout.strip())

if fails:
    print("FAIL (goes to the owner's Sign queue):")
    for f in fails:
        print(" -", f)
    sys.exit(1)
print(f"PASS: company may sign {a.doc} for {a.lead_id} (price ${a.price:,.0f}, earnest ${a.earnest:,.0f}, {a.inspection_days} inspection days)")
