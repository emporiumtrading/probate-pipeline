#!/usr/bin/env python3
"""Regression / QA checks run before anything is published.

Usage: python3 scripts/qa_checks.py DASHBOARD_DATA_DIR
Exits 1 if any check fails. Checks the numbers, the stage model, privacy, and compliance invariants.
"""
import csv, glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dashboard-data")
fails, warns = [], []


def rows(name):
    p = os.path.join(D, name)
    return list(csv.DictReader(open(p))) if os.path.exists(p) else []


def n(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


leads, stages, queues, markets = rows("leads.csv"), rows("stages.csv"), rows("queues.csv"), rows("markets.csv")
stage_names = {s["stage"] for s in stages}
cfg = open(os.path.join(ROOT, "config.yaml")).read()
fee = 10000

for l in leads:
    lid = l["lead_id"]
    if l["stage"] not in stage_names:
        fails.append(f"{lid}: unknown stage '{l['stage']}'")
    arv, rep, mao, bmax, tgt, earn = (n(l[k]) for k in ("arv_mid", "repairs_mid", "mao", "buyer_max", "target_price", "potential_earnings"))
    if l["is_opportunity"] == "yes":
        if l["verdict"] not in ("GO", "NEGOTIATE"):
            fails.append(f"{lid}: opportunity with verdict {l['verdict']}")
        if None in (mao, bmax, tgt, earn):
            fails.append(f"{lid}: opportunity missing mao/buyer_max/target/earnings")
        else:
            if tgt > bmax:
                fails.append(f"{lid}: target {tgt} above cash-buyer max {bmax} (deal loses money)")
            elif tgt > mao + 1:
                warns.append(f"{lid}: target {tgt} above MAO {mao}; fee shrinks to {bmax - tgt:.0f} (often a legal price floor)")
            if abs((bmax - tgt) - earn) > 1:
                fails.append(f"{lid}: earnings {earn} != buyer_max - target {bmax - tgt}")
            if abs((mao + fee) - bmax) > 1:
                warns.append(f"{lid}: buyer_max {bmax} != MAO + fee {mao + fee} (check fee/closing costs)")
            if earn < 0:
                fails.append(f"{lid}: negative earnings")
    if l["verdict"] == "WALK AWAY" and l["stage"] != "Dead":
        fails.append(f"{lid}: WALK AWAY lead not marked Dead")
    if l["state"] == "PA" and l["verdict"] in ("GO", "NEGOTIATE") and "licensed_or_partnered: true" not in cfg:
        fails.append(f"{lid}: PA opportunity while unlicensed (Act 52)")
    if arv and rep and mao and abs((arv * 0.70 - rep - fee) - mao) > 0.02 * arv:
        warns.append(f"{lid}: MAO {mao} differs from ARV*0.7-repairs-fee {arv*0.7-rep-fee:.0f} by >2% of ARV (check plan.md)")

# Privacy: no personal-name/contact columns in any dashboard file
banned = re.compile(r"personal_rep|rep_contact|estate_attorney|phone|email|heir|executor_name", re.I)
for f in glob.glob(os.path.join(D, "*.csv")):
    hdr = open(f).readline()
    if banned.search(hdr):
        fails.append(f"{os.path.basename(f)}: personal-data column in header: {hdr.strip()}")

# Every queue item points at a real lead and real file
ids = {l["lead_id"] for l in leads}
for q in queues:
    if q["lead_id"] not in ids:
        fails.append(f"queue item for unknown lead {q['lead_id']}")
    if q["queue"] == "Approve outreach" and not os.path.exists(os.path.join(ROOT, q["file"])):
        fails.append(f"{q['lead_id']}: approval points at missing file {q['file']}")

# Every expansion file's status is reflected on the dashboard (regression: status parse)
for f in glob.glob(os.path.join(ROOT, "pipeline", "expansion", "*.yaml")):
    m = re.search(r"^\s*status:\s*(\w+)", open(f).read(), re.M)
    if m and m.group(1) in ("blocked", "partial", "research_only", "workable", "live"):
        st_cty = os.path.basename(f)[:-5].split("-", 1)
        hit = [x for x in markets if x["state"].lower() == st_cty[0] and x["status"] == "Queued" and x["county"].lower().replace(" ", "-").replace(".", "") == st_cty[1]]
        if hit:
            fails.append(f"{os.path.basename(f)} says {m.group(1)} but dashboard shows Queued")

# Every state appears in markets
st = {m["state"] for m in markets}
if len(st) < 51:
    fails.append(f"markets.csv covers {len(st)} of 51 states+DC")

# Compliance invariants in config
for need in ("negotiation_limit", "outreach:", "closings_per_month"):
    if need not in cfg:
        fails.append(f"config.yaml missing {need}")
if re.search(r"(routing|account)_number|iban|swift", cfg, re.I):
    fails.append("config.yaml appears to contain bank details: remove them")

for w in warns:
    print("WARN ", w)
for f in fails:
    print("FAIL ", f)
print(f"QA: {len(leads)} leads, {len(fails)} failures, {len(warns)} warnings")
sys.exit(1 if fails else 0)
