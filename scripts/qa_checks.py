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

# Freshness stamp: the page computes data age from health.built_at (regression: stale data looked fresh)
h = rows("health.csv")
if not h or not re.match(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$", h[0].get("built_at", "")):
    fails.append("health.csv missing a UTC built_at timestamp (page can't detect stale data)")

# Worker performance sanity (regression: rates above 100% from mismatched counts)
for w in rows("workers.csv"):
    if w.get("rate") and int(w["rate"].rstrip("%")) > 100:
        fails.append(f"workers.csv: {w['worker']} rate {w['rate']} > 100% (counts don't measure the same thing)")
# Every role file is wired in: on the SKILL.md roster and measured in workers.csv (references/new-worker.md)
_sk = os.path.join(ROOT, ".claude", "skills", "probate-wholesale-deal")
_roster = open(os.path.join(_sk, "SKILL.md")).read() if os.path.exists(os.path.join(_sk, "SKILL.md")) else ""
_wfiles = {w.get("role_file", "") for w in rows("workers.csv")}
for f in glob.glob(os.path.join(_sk, "agents", "*.md")):
    slug = os.path.basename(f)
    if f"agents/{slug}" not in _roster:
        fails.append(f"agents/{slug} is not on the SKILL.md roster")
    if rows("workers.csv") and slug not in _wfiles:
        fails.append(f"agents/{slug} is not measured in workers.csv (add a W(...) row and its role_file)")

# Ledger integrity (Bookkeeper): numeric amounts, known types, actuals need a document, no bank details anywhere
_lp = os.path.join(ROOT, "pipeline", "ledger.csv")
if os.path.exists(_lp):
    _lt = open(_lp).read()
    if re.search(r"(?i)routing|account\s*(no|number|#)|\biban\b|\bswift\b|\b\d{9,17}\b", _lt):
        fails.append("pipeline/ledger.csv appears to contain bank or account details: remove them (the ledger records amounts and documents only)")
    for i, r in enumerate(csv.DictReader(open(_lp)), 2):
        if r.get("type") not in ("income", "expense", "escrow_out", "escrow_back"):
            fails.append(f"ledger.csv line {i}: unknown type '{r.get('type')}'")
        if r.get("status") not in ("forecast", "actual"):
            fails.append(f"ledger.csv line {i}: status must be forecast or actual")
        if n(r.get("amount")) is None or (n(r.get("amount")) or 0) < 0:
            fails.append(f"ledger.csv line {i}: amount must be a positive number")
        if r.get("status") == "actual" and not (r.get("doc_ref") or "").strip():
            fails.append(f"ledger.csv line {i}: actual entry without a doc_ref")

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
if rd and any(r["status"] not in ("done", "missing", "waiting for check") for r in rd):
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

# ---- lead types ----
TYPES = ("probate", "post_probate_heirs", "small_estate", "trust", "ancillary", "partition", "tax_delinquent_inherited", "unprobated", "guardianship")
lt_block = re.search(r"\nlead_types:[^\n]*\n((?:  [^\n]*\n)+)", cfg)
enabled = {k for k, v in re.findall(r"^  (\w+):\s*(true|false)", lt_block.group(1) if lt_block else "", re.M) if v == "true"}
if not lt_block:
    fails.append("config.yaml missing lead_types")
if "guardianship" in enabled:
    warns.append("guardianship leads are enabled: confirm the attorney approved a separate process")
trk = list(csv.DictReader(open(os.path.join(ROOT, "pipeline", "deal-tracker.csv"))))
for r in trk:
    t = (r.get("lead_type") or "probate").strip()
    if t not in TYPES:
        fails.append(f"{r['lead_id']}: unknown lead_type '{t}'")
        continue
    moved = r.get("stage") not in ("Researched", "Dead", "")
    if moved and t not in enabled:
        fails.append(f"{r['lead_id']}: lead_type {t} is disabled but the lead is at stage '{r['stage']}'")
    if moved and t != "probate" and not os.path.exists(os.path.join(ROOT, "leads", r["lead_id"], "heirs.md")):
        fails.append(f"{r['lead_id']}: {t} lead past Researched without leads/<id>/heirs.md from the Heir & Title Tracer")
    if t == "unprobated" and r.get("stage") not in ("Researched", "Outreach drafted", "Outreach sent", "Dead", "") :
        fails.append(f"{r['lead_id']}: unprobated lead at '{r['stage']}': no offer until someone has authority (convert its lead_type first)")
    if t == "unprobated" and (n(r.get("touch_count")) or 0) > 2:
        fails.append(f"{r['lead_id']}: unprobated lead contacted {r['touch_count']} times (cap is 2)")

# ---- grief wait: first contact only after min_days_after_death ----
import datetime as _dt
wait = int((re.search(r"min_days_after_death:\s*(\d+)", cfg) or [None, "90"])[1])
today = _dt.date.today()
for r in trk:
    if r.get("stage") in ("Researched", "Dead", ""):
        continue
    m = re.search(r"\d{4}-\d{2}-\d{2}", r.get("date_of_death") or "") or re.search(r"\d{4}-\d{2}-\d{2}", r.get("filing_date") or "")
    sent = (n(r.get("touch_count")) or 0) > 0
    if not m:
        (fails if sent else warns).append(f"{r['lead_id']}: no date of death or filing date; no letter may go out")
        continue
    ok_on = _dt.date.fromisoformat(m.group(0)) + _dt.timedelta(days=wait)
    if sent and (r.get("last_touch_date") or "") and r["last_touch_date"][:10] < ok_on.isoformat() and (n(r.get("touch_count")) or 0) == 1:
        fails.append(f"{r['lead_id']}: first contact {r['last_touch_date']} came before the {wait}-day wait ended ({ok_on})")
missing_dod = sum(1 for r in trk if r.get("stage") not in ("Researched", "Dead", "") and not (r.get("date_of_death") or "").strip())
if missing_dod:
    warns.append(f"{missing_dod} active leads have no date_of_death yet (the wait is counted from the filing date until it's found)")

# ---- coverage map ----
RT = ("probate_docket", "legal_notices", "parcel_owner", "deed_index", "civil_docket", "tax_status", "death_date")
CS = ("works", "manual_only", "blocked", "broken", "none_found", "untested", "")
cp = os.path.join(ROOT, "pipeline", "coverage.csv")
if not os.path.exists(cp):
    fails.append("pipeline/coverage.csv missing")
else:
    for r in csv.DictReader(open(cp)):
        if r["record_type"] not in RT:
            fails.append(f"coverage: {r['market_id']} unknown record_type {r['record_type']}")
        if r["primary_status"] not in CS or r.get("backup_status", "") not in CS:
            fails.append(f"coverage: {r['market_id']}/{r['record_type']} bad status")
        if r["primary_status"] == "works" and not r["primary_source"].strip():
            fails.append(f"coverage: {r['market_id']}/{r['record_type']} marked works with no source")
for c in rows("coverage.csv"):
    if c.get("live") == "yes" and c.get("record_type") in ("probate_docket", "parcel_owner") and c.get("status") != "works":
        warns.append(f"coverage: live market {c['market']} has no working {c['record_type']} source")

# ---- guardrails: learning may not change the hard limits or the autonomy block ----
import hashlib
# self-review log: fixed columns so the Quality Auditor's weekly calibration can read it
_srp = os.path.join(ROOT, "pipeline", "self-review.csv")
if os.path.exists(_srp):
    _sr = open(_srp).read().splitlines()
    if not _sr or _sr[0] != "date,worker,metric,predicted,actual,cause,change,evidence":
        fails.append("pipeline/self-review.csv: header must be date,worker,metric,predicted,actual,cause,change,evidence")
for _f in glob.glob(os.path.join(ROOT, ".claude/skills/probate-wholesale-deal/agents/*.md")):
    if "## Self-review" not in open(_f).read():
        fails.append(f"{os.path.relpath(_f, ROOT)}: missing the '## Self-review' section (references/self-review.md)")
# owner settings from the dashboard's Setup page: only known fields, never bank details or secrets
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import owner_settings as _os_
try:
    _os_.load()
except _os_.Refused as e:
    fails.append(f"pipeline/owner-settings.json: {e}")
# messages (Messages page): every listed attachment must exist; statuses from the known set
_mp = os.path.join(D, "messages.json")
if not os.path.exists(_mp):
    fails.append("messages.json missing: rebuild with scripts/build_dashboard_data.py")
else:
    import json as _json
    _ST = {"draft awaiting approval", "approved by you", "changes requested", "rejected", "sent", "withdrawn", "script for you", "held until the market is cleared"}
    for _m in _json.load(open(_mp)):
        if _m.get("status") not in _ST:
            fails.append(f"messages.json {_m.get('msg_id')}: unknown status {_m.get('status')}")
        for _a in _json.loads(_m.get("attachments") or "[]"):
            if not _a.get("found"):
                fails.append(f"{_m.get('msg_id')}: attachment {_a.get('file')} is listed but missing")
import owner_decisions as _od
try:
    _od.load()
except _od.Refused as e:
    fails.append(f"pipeline/owner-decisions.csv: {e}")
# team handoff board: valid workers, answers with evidence, no secrets; no lead reaches the owner with an open blocker
import handoffs as _ho
for _b in _ho.problems(_ho.load()):
    fails.append(f"pipeline/handoffs.csv {_b}")
_blk = _ho.open_blockers(_ho.load())
for _q in rows("queues.csv"):
    if _q.get("queue") == "Approve outreach" and _q.get("lead_id") in _blk:
        fails.append(f"{_q['lead_id']}: in your approval queue with an open blocker on the handoff board")
for _f in glob.glob(os.path.join(ROOT, ".claude/skills/probate-wholesale-deal/agents/*.md")):
    if "## Handoffs" not in open(_f).read():
        fails.append(f"{os.path.relpath(_f, ROOT)}: missing the '## Handoffs' section (references/orchestration.md → Handoff board)")
# ---- worker lifecycle (references/worker-lifecycle.md): registry matches agents/, shadow output never feeds outbound ----
import worker_lifecycle as _wl
_wf, _ww = _wl.problems()
fails += _wf
warns += _ww
# ---- autonomous sending still respects every per-market gate ----
import owner_settings as _os2
if _os2.effective_outreach(cfg) == "autonomous" and any(q.get("queue") == "Approve outreach" for q in queues):
    fails.append("outreach is autonomous but queues.csv still asks the owner to approve letters (rebuild the data)")
_appr_mk = {m.group(1) for m in re.finditer(r"\n  - id: ([\w-]+)\n(?:(?!\n  - id: )[\s\S])*?\n\s+attorney_approved:\s*\d{4}-\d\d-\d\d", cfg)}
_owner_ok = {k[1] for k, v in _od.load().items() if k[0] == "outreach" and v.get("decision") == "approved"}
for _i, _o in enumerate(_wl.read(_wl.OUTBOUND), 2):
    if (_o.get("status") or "").lower() != "sent":
        continue
    if (_o.get("compliance") or "").upper() != "PASS":
        fails.append(f"outbound-log.csv line {_i} ({_o.get('lead_id')}): sent without a Compliance Officer PASS")
    _mk = next((m for m in re.findall(r"\n  - id: ([\w-]+)", cfg) if (_o.get("lead_id") or "").startswith(m + "-")), "")
    _seller = (_o.get("recipient_role") or "").lower() not in ("buyer", "title_company", "professional")  # estate side: personal_representative, heir, trustee, estate_attorney
    if _seller and _mk not in _appr_mk and _o.get("lead_id") not in _owner_ok:
        fails.append(f"outbound-log.csv line {_i} ({_o.get('lead_id')}): sent to a seller in {_mk or 'an unknown market'} without attorney_approved on the market or the owner's approval of that letter")


def guard_parts():
    dr = open(os.path.join(ROOT, ".claude/skills/probate-wholesale-deal/references/daily-run.md")).read()
    hl = re.search(r"## Hard limits.*?(?=\n## )", dr, re.S)
    au = re.search(r"\nautonomy:\n(?:  [^\n]*\n)+", cfg)
    lt = re.search(r"\nlead_types:[^\n]*\n(?:  [^\n]*\n)+", cfg)
    return {"hard_limits": hl.group(0) if hl else "", "autonomy": au.group(0) if au else "", "lead_types": lt.group(0) if lt else ""}
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
            fails.append(f"guardrail changed: {k} differs from the owner-approved version (Hard limits, autonomy and lead_types change only with the owner)")

for w in warns:
    print("WARN ", w)
for f in fails:
    print("FAIL ", f)
print(f"QA: {len(leads)} leads, {len(fails)} failures, {len(warns)} warnings")
sys.exit(1 if fails else 0)
