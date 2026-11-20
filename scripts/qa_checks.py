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

# ---- readiness / buyers / replies / health datasets ----
for name, need in (("readiness.csv", ["area", "item", "status"]), ("buyers.csv", ["market", "found", "vetted"]),
                   ("replies.csv", ["received_date", "status"]), ("health.csv", ["built", "last_run", "days_since_run"])):
    p = os.path.join(D, name)
    if not os.path.exists(p):
        fails.append(f"{name} missing: rebuild with scripts/build_dashboard_data.py")
        continue
    head = open(p).readline().strip().split(",")
    for c in need:
        if c not in head:
            fails.append(f"{name} missing column {c}")
    # privacy: these datasets carry counts and ids only, never names or contact details
    for bad in ("name", "mailing_address", "public_email", "public_phone", "personal_rep", "rep_contact"):
        if bad in head:
            fails.append(f"{name} exposes {bad}: dashboard datasets must not carry names or contact details")
rd = rows("readiness.csv")
if rd and any(r["status"] not in ("done", "missing") for r in rd):
    fails.append("readiness.csv has a status other than done/missing")
hl = rows("health.csv")
if hl:
    h = hl[0]
    if h.get("days_since_run") not in ("", None) and n(h["days_since_run"]) is not None and n(h["days_since_run"]) > 2:
        warns.append(f"last daily run was {h['days_since_run']} days ago ({h['last_run']})")
    if h.get("last_run_saved", "").lower().startswith("no"):
        warns.append("last daily run did not save to GitHub")
for b in rows("buyers.csv"):
    if b.get("warning", "").startswith("Deal under contract"):
        warns.append(f"{b['market']}: deal under contract with only {b['vetted']} vetted buyers")
for r in rows("replies.csv"):
    if r.get("status") == "late":
        warns.append(f"reply from {r['received_date']} ({r['channel']}) waiting {r['age_days']} days")
if "outreach: autonomous" in cfg and not re.search(r"attorney_approved:\s*\d", cfg):
    warns.append("outreach is autonomous but no market has attorney_approved: nothing will send")

# ---- guardrails: learning may not change the hard limits or the autonomy block ----
import hashlib
def guard_parts():
    dr = open(os.path.join(ROOT, ".claude/skills/probate-wholesale-deal/references/daily-run.md")).read()
    hl = re.search(r"## Hard limits.*?(?=\n## )", dr, re.S)
    au = re.search(r"\nautonomy:\n(?:  [^\n]*\n)+", cfg)
    return {"hard_limits": hl.group(0) if hl else "", "autonomy": au.group(0) if au else ""}
gpath = os.path.join(ROOT, "scripts", "guardrails.sha256")
cur = {k: hashlib.sha256(v.encode()).hexdigest() for k, v in guard_parts().items()}
if len(sys.argv) > 2 and sys.argv[2] == "--owner-approve-guardrails":
    open(gpath, "w").write("".join(f"{k} {v}\n" for k, v in cur.items()))
    print("guardrails.sha256 updated (owner approval)")
if not os.path.exists(gpath):
    fails.append("scripts/guardrails.sha256 missing: the owner runs qa_checks.py <dir> --owner-approve-guardrails")
else:
    saved = dict(l.split() for l in open(gpath).read().splitlines() if l.strip())
    for k, v in cur.items():
        if not cur[k] or saved.get(k) != v:
            fails.append(f"guardrail changed: {k} (Hard limits / autonomy) differs from the owner-approved version")

for w in warns:
    print("WARN ", w)
for f in fails:
    print("FAIL ", f)
print(f"QA: {len(leads)} leads, {len(fails)} failures, {len(warns)} warnings")
sys.exit(1 if fails else 0)
