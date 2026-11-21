#!/usr/bin/env python3
"""Build the dashboard's data files from the pipeline repo.

Usage: python3 scripts/build_dashboard_data.py OUT_DIR
Writes leads.csv, queues.csv, markets.csv, sources.csv, runs.csv, pace.csv, stages.csv.
Personal names and contact details are never written (anyone who can open the dashboard can read its files).
"""
import csv, datetime, glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dashboard-data")
os.makedirs(OUT, exist_ok=True)
TODAY = datetime.date.today().isoformat()

# Deal state machine (references/orchestration.md). Each stage: order, responsible team, owner action.
STAGES = [
    ("Researched", "Deal team", ""),
    ("Outreach drafted", "Communications", "approve"),
    ("Outreach sent", "Communications", ""),
    ("In conversation", "Communications", ""),
    ("Offer made", "Negotiation desk", ""),
    ("Verbal agreement", "Negotiation desk", ""),
    ("Contract out for signature", "Closing desk", "sign"),
    ("Under contract", "Closing desk", ""),
    ("Earnest money due", "Closing desk", "wire"),
    ("Title opened", "Closing desk", ""),
    ("Buyer found", "Dispositions", ""),
    ("Assignment signed", "Closing desk", "sign"),
    ("Clear to close", "Closing desk", ""),
    ("Closed", "Closing desk", ""),
    ("Paid", "Done", ""),
    ("Dead", "Done", ""),
]
STAGE_ORDER = {s: i + 1 for i, (s, _, _) in enumerate(STAGES)}
STAGE_TEAM = {s: t for s, t, _ in STAGES}
STAGE_OWNER = {s: o for s, _, o in STAGES}
ALIASES = {"New": "Researched", "Contacted": "In conversation", "Negotiating": "Offer made", "Assigned": "Assignment signed"}

STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]


def num(v):
    try:
        return float(str(v).replace("$", "").replace(",", ""))
    except (TypeError, ValueError):
        return None


def verdict_for(r):
    if r.get("verdict"):
        return r["verdict"].upper()
    if r["state"] == "PA":
        return "RESEARCH ONLY"
    m = re.match(r"\s*(GO|NEGOTIATE|WALK AWAY|RESEARCH ONLY)", (r.get("notes") or "").upper())
    if m:
        return m.group(1)
    p = os.path.join(ROOT, "leads", r["lead_id"], "plan.md")
    if os.path.exists(p):
        m = re.search(r"Verdict:?\**\s*\**\s*(GO|NEGOTIATE|WALK AWAY)", open(p).read(), re.I)
        if m:
            return m.group(1).upper()
    return ""


def write(name, cols, rows):
    with open(os.path.join(OUT, name), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def load_config_markets():
    """Tiny reader for config.yaml markets/expansion_queue (no PyYAML dependency)."""
    txt = open(os.path.join(ROOT, "config.yaml")).read()
    live = []
    for blk in re.findall(r"\n  - id: (.+?)\n(.*?)(?=\n  - id: |\n\S|\Z)", txt, re.S):
        mid, body = blk
        g = lambda k: (re.search(rf"\n\s+{k}: ([^\n#]+)", "\n" + body) or [None, ""])[1].strip()
        live.append({"market": mid.strip(), "county": g("county"), "state": g("state"), "city": g("city"),
                     "outreach_allowed": g("outreach_allowed"), "last_checked": g("last_checked")})
    queue = [dict(re.findall(r"(\w+): ([^,}]+)", m)) for m in re.findall(r"\n  - (\{[^}]+\})", txt)]
    return live, [{k: v.strip() for k, v in q.items()} for q in queue]


# ---- leads ----
tracker = list(csv.DictReader(open(os.path.join(ROOT, "pipeline", "deal-tracker.csv"))))
approvals = {}
for f in glob.glob(os.path.join(ROOT, "leads", "*", "approval.txt")):
    t = open(f).read().strip()
    if t:
        approvals[os.path.basename(os.path.dirname(f))] = t.splitlines()[0][:200]

leads = []
for r in tracker:
    stage = ALIASES.get(r["stage"], r["stage"]) or "Researched"
    v = verdict_for(r)
    if v == "WALK AWAY" and stage not in ("Dead", "Paid"):
        stage = "Dead"
    bmax, tgt = num(r.get("buyer_max")), num(r.get("target_price"))
    earn = num(r.get("potential_earnings"))
    if earn is None and bmax is not None and tgt is not None:
        earn = bmax - tgt
    owner = STAGE_OWNER.get(stage, "")
    leads.append({
        "lead_id": r["lead_id"], "address": r["address"].split(",")[0], "city": r.get("city", ""),
        "county": r["county"], "state": r["state"], "lead_type": r.get("lead_type") or "probate", "stage": stage, "stage_order": STAGE_ORDER.get(stage, 99),
        "team": STAGE_TEAM.get(stage, ""), "owner_action": owner, "verdict": v,
        "is_opportunity": "yes" if v in ("GO", "NEGOTIATE") and stage not in ("Dead", "Paid") else "no",
        "arv_mid": r["arv_mid"], "repairs_mid": r["repairs_mid"], "buyer_max": int(bmax) if bmax is not None else "",
        "target_price": int(tgt) if tgt is not None else "", "mao": r["mao"],
        "potential_earnings": int(earn) if earn is not None else "", "asking": r["asking"],
        "authority": (r["letters_issued"] or "")[:90], "court_step": (r["court_confirmation"] or "")[:90],
        "occupancy": (r["occupancy"] or "")[:60], "next_action": (r["next_action"] or "")[:140],
        "next_action_date": r["next_action_date"], "touch_count": r["touch_count"], "last_touch_date": r["last_touch_date"],
        "summary": (r["notes"] or "")[:220],
    })
LEAD_COLS = list(leads[0].keys()) if leads else ["lead_id"]
write("leads.csv", LEAD_COLS, sorted(leads, key=lambda x: -(x["potential_earnings"] or 0)))

# ---- owner queues ----
queues = []
for l in leads:
    if l["owner_action"] == "approve" and l["lead_id"] in approvals:
        queues.append({"queue": "Approve outreach", "lead_id": l["lead_id"], "address": l["address"], "city": l["city"],
                       "county": l["county"], "state": l["state"], "item": approvals[l["lead_id"]],
                       "due": l["next_action_date"], "file": f"leads/{l['lead_id']}/outreach-drafts.md"})
    elif l["owner_action"] in ("sign", "wire"):
        queues.append({"queue": "Sign" if l["owner_action"] == "sign" else "Wire", "lead_id": l["lead_id"],
                       "address": l["address"], "city": l["city"], "county": l["county"], "state": l["state"],
                       "item": l["next_action"], "due": l["next_action_date"], "file": f"leads/{l['lead_id']}/"})
write("queues.csv", ["queue", "lead_id", "address", "city", "county", "state", "item", "due", "file"], queues)

# ---- stages (full list, so empty stages still show) ----
write("stages.csv", ["stage_order", "stage", "team", "owner_action"],
      [{"stage_order": i + 1, "stage": s, "team": t, "owner_action": o} for i, (s, t, o) in enumerate(STAGES)])

# ---- markets: every state ----
live, queue = load_config_markets()
legal = {os.path.basename(f)[:-3]: f for f in glob.glob(os.path.join(ROOT, "legal", "*.md"))}
exp = {}
for f in glob.glob(os.path.join(ROOT, "pipeline", "expansion", "*.yaml")):
    t = open(f).read()
    st = (re.search(r"^\s*status:\s*(\w+)", t, re.M) or [None, ""])[1]
    exp[os.path.basename(f)[:-5]] = st
markets, seen = [], set()
for m in live:
    n = sum(1 for l in leads if l["county"] == m["county"] and l["state"] == m["state"])
    o = sum(1 for l in leads if l["county"] == m["county"] and l["state"] == m["state"] and l["is_opportunity"] == "yes")
    status = "Live" if m["outreach_allowed"] == "true" else "Research only"
    if m["state"] == "TN" and o == 0:
        status = "Live: property records blocked"
    markets.append({"state": m["state"], "county": m["county"], "city": m["city"], "status": status,
                    "legal_file": "yes" if m["state"] in legal else "no", "leads": n, "opportunities": o,
                    "last_checked": m["last_checked"]})
    seen.add((m["state"], m["county"]))
for q in queue:
    key = (q.get("state"), q.get("county"))
    if key in seen:
        continue
    mid = f"{q['state'].lower()}-{q['county'].lower().replace(' ', '-').replace('.', '')}"
    st = exp.get(mid, "")
    status = {"workable": "Live", "live": "Live", "research_only": "Research only", "blocked": "Blocked",
              "partial": "Partial: records limited"}.get(st, "Queued")
    markets.append({"state": q["state"], "county": q["county"], "city": q.get("city", ""), "status": status,
                    "legal_file": "yes" if q["state"] in legal else "no", "leads": 0, "opportunities": 0, "last_checked": ""})
    seen.add(key)
for s in STATES:
    if not any(m["state"] == s for m in markets):
        markets.append({"state": s, "county": "", "city": "", "status": "Not started", "legal_file": "yes" if s in legal else "no",
                        "leads": 0, "opportunities": 0, "last_checked": ""})
markets.sort(key=lambda m: (m["state"], m["county"]))
write("markets.csv", ["state", "county", "city", "status", "legal_file", "leads", "opportunities", "last_checked"], markets)

# ---- sources: working only ----
src = {}
for line in open(os.path.join(ROOT, "pipeline", "sources-log.md")):
    p = [x.strip() for x in line.strip().strip("|").split("|")]
    if len(p) >= 5 and p[0][:4].isdigit():
        src[(p[1], p[2][:80])] = {"date": p[0], "market": p[1], "source": p[2][:80], "status": p[3][:60], "note": p[4][:160]}
ok = [r for r in src.values() if re.match(r"(worked|reachable \(200\))", r["status"].lower()) and not re.search(r"unusable|not used", r["status"])]
write("sources.csv", ["date", "market", "source", "status", "note"], ok)

# ---- runs + pace ----
runs_path = os.path.join(ROOT, "pipeline", "runs.csv")
runs = list(csv.DictReader(open(runs_path))) if os.path.exists(runs_path) else []
write("runs.csv", ["date", "new_leads", "updated_leads", "approvals_waiting", "legal_changes", "pushed"], runs)
month = TODAY[:7]
tgt = (re.search(r"closings_per_month: (\d+)", open(os.path.join(ROOT, "config.yaml")).read()) or [None, "115"])[1]
cnt = lambda st: sum(1 for l in leads if l["stage"] in st)
write("pace.csv", ["month", "target_closings", "closed", "under_contract", "verbal_agreements", "offers_out", "in_conversation",
                   "outreach_sent", "opportunities", "leads_researched", "markets_live"], [{
    "month": month, "target_closings": tgt, "closed": cnt(("Closed", "Paid")),
    "under_contract": cnt(("Contract out for signature", "Under contract", "Earnest money due", "Title opened", "Buyer found", "Assignment signed", "Clear to close")),
    "verbal_agreements": cnt(("Verbal agreement",)), "offers_out": cnt(("Offer made",)), "in_conversation": cnt(("In conversation",)),
    "outreach_sent": cnt(("Outreach sent",)), "opportunities": sum(1 for l in leads if l["is_opportunity"] == "yes"),
    "leads_researched": len(leads), "markets_live": sum(1 for m in markets if m["status"].startswith("Live")),
}])
# ---- readiness: what still stands between the pipeline and running on its own ----
cfg_txt = open(os.path.join(ROOT, "config.yaml")).read()
def cfg_block(name):
    b = re.search(rf"\n{name}:[^\n]*\n((?:  [^\n]*\n)+)", cfg_txt)
    out = {}
    for k, v in re.findall(r"^  (\w+):\s*([^\n#]*)", b.group(1) if b else "", re.M):
        out[k] = v.strip().strip('"').strip("'")
    return out
biz, chan = cfg_block("business"), cfg_block("channels")
autonomy = cfg_block("autonomy")
ready = []
def item(area, name, done, fix, unlocks):
    ready.append({"area": area, "item": name, "status": "done" if done else "missing", "how_to_fix": fix + " (steps: docs/owner-setup.md)", "unlocks": unlocks})
BIZ_LABEL = {"legal_name": "Company legal name", "entity_state": "State of formation", "mailing_address": "Business mailing address",
             "phone": "Business phone answered by a person", "email": "Business email", "website": "Website",
             "signer": "Who signs contracts", "title_company": "Title company for earnest money"}
for k, lbl in BIZ_LABEL.items():
    item("Business identity", lbl, bool(biz.get(k)), f"config.yaml → business.{k}", "Attorney packets, letters, trust with attorneys")
CH = {"mail_sending": ("Letters sent without you", "Connect a print-and-mail service, then set channels.mail_sending: true"),
      "email_sending": ("Email sent without you", "Finish connecting the Resend connector in claude.ai settings, then set channels.email_sending: true"),
      "inbox_connected": ("Replies read automatically", "Connect the business mailbox, then set channels.inbox_connected: true"),
      "mail_scanning": ("Mailed replies arrive by email", "Virtual mailbox that scans mail to the business email, then set channels.mail_scanning: true"),
      "voicemail_to_email": ("Voicemails arrive by email", "Phone service with voicemail-to-email, then set channels.voicemail_to_email: true")}
for k, (lbl, fix) in CH.items():
    item("Channels", lbl, chan.get(k) == "true", fix, "Reply desk and sending with no manual steps")
item("Autonomy", "Outreach set to autonomous", autonomy.get("outreach") == "autonomous", "config.yaml → autonomy.outreach: autonomous (after the items above)", "Letters go out without per-message approval")
for m in live:
    body = (re.search(rf"\n  - id: {re.escape(m['market'])}\n(.*?)(?=\n  - id: |\n\S|\Z)", cfg_txt, re.S) or [None, ""])
    body = body.group(1) if hasattr(body, "group") else ""
    appr = (re.search(r"attorney_approved:\s*([0-9-]+)", body) or [None, ""])[1]
    pk = os.path.exists(os.path.join(ROOT, "legal", "attorney-packets", f"{m['market']}.md"))
    lbl = f"{m['county']} County, {m['state']}"
    if m["outreach_allowed"] != "True" and m["outreach_allowed"] != "true":
        item(lbl, "Outreach allowed by state rules", False, f"legal/{m['state']}.md blocking issues (license or licensed partner)", "Any outreach in this market")
    item(lbl, "Attorney packet built", pk, "python3 scripts/build_attorney_packet.py", "Attorney review")
    item(lbl, "Attorney approved templates", bool(appr), f"Send legal/attorney-packets/{m['market']}.md; then add attorney_approved: <date> to the market", "Autonomous sending here")

write("readiness.csv", ["area", "item", "status", "how_to_fix", "unlocks"], ready)

# ---- buyers per market (counts only, no names) ----
bpath = os.path.join(ROOT, "pipeline", "buyers", "buyers.csv")
brows = list(csv.DictReader(open(bpath))) if os.path.exists(bpath) else []
under = {}
for l in leads:
    if 7 <= l["stage_order"] <= 13:
        under[f"{l['county']}|{l['state']}"] = under.get(f"{l['county']}|{l['state']}", 0) + 1
bstats = []
for m in live:
    rows_m = [b for b in brows if b.get("market_id") == m["market"] and b.get("stop") != "yes"]
    c = lambda st: sum(1 for b in rows_m if b.get("status") in st)
    vetted = c(("vetted",))
    uc = under.get(f"{m['county']}|{m['state']}", 0)
    bstats.append({"market": m["market"], "county": m["county"], "state": m["state"], "found": len(rows_m),
                   "confirmed": c(("confirmed", "vetted")), "vetted": vetted, "deals_under_contract": uc,
                   "warning": "Deal under contract with fewer than 5 vetted buyers" if uc and vetted < 5 else ("No buyers yet" if not rows_m else "")})
write("buyers.csv", ["market", "county", "state", "found", "confirmed", "vetted", "deals_under_contract", "warning"], bstats)

# ---- replies waiting (no names) ----
ipath = os.path.join(ROOT, "pipeline", "inbox-log.csv")
irows = list(csv.DictReader(open(ipath))) if os.path.exists(ipath) else []
pending_files = [f for f in glob.glob(os.path.join(ROOT, "pipeline", "inbox", "*")) if os.path.isfile(f) and not f.endswith("README.md")]
replies = []
for r in irows:
    if not r.get("responded_date") and r.get("label") not in ("stop", "returned mail"):
        try:
            age = (datetime.date.fromisoformat(TODAY) - datetime.date.fromisoformat(r["received_date"])).days
        except Exception:
            age = ""
        replies.append({"received_date": r["received_date"], "channel": r["channel"], "lead_id": r.get("matched_id", ""),
                        "label": r["label"], "routed_to": r.get("routed_to", ""), "age_days": age, "status": "late" if age != "" and age > 1 else "open"})
for f in pending_files:
    replies.append({"received_date": "", "channel": "inbox drop", "lead_id": "", "label": "not yet read", "routed_to": "Reply desk",
                    "age_days": "", "status": "unread"})
write("replies.csv", ["received_date", "channel", "lead_id", "label", "routed_to", "age_days", "status"],
      sorted(replies, key=lambda r: -(r["age_days"] if r["age_days"] != "" else 999)))

# ---- coverage: which public sources work per county and record type ----
cpath = os.path.join(ROOT, "pipeline", "coverage.csv")
crows = list(csv.DictReader(open(cpath))) if os.path.exists(cpath) else []
live_ids = {m["market"] for m in live}
cov = []
for r in crows:
    st_ = r["primary_status"]
    backup = r.get("backup_status") == "works"
    cov.append({"market": r["market_id"], "live": "yes" if r["market_id"] in live_ids else "no", "record_type": r["record_type"],
                "status": st_, "source": r["primary_source"][:80], "backup": "yes" if backup else "no",
                "last_checked": r["last_checked"], "gap": "no" if st_ == "works" else "yes",
                "fragile": "yes" if st_ == "works" and not backup and r["record_type"] in ("probate_docket", "parcel_owner") else "no"})
cov.sort(key=lambda x: (x["live"] != "yes", x["market"], x["record_type"]))
write("coverage.csv", ["market", "live", "record_type", "status", "source", "backup", "last_checked", "gap", "fragile"], cov)

# ---- workers: what each specialist has produced (measured from its own output files) ----
import subprocess
def _last(*paths):
    try:
        out = subprocess.run(["git", "-C", ROOT, "log", "-1", "--format=%cs", "--"] + list(paths), capture_output=True, text=True, timeout=20).stdout.strip()
        return out
    except Exception:
        return ""
def _count(pattern):
    return len(glob.glob(os.path.join(ROOT, pattern)))
def _rows(path):
    p = os.path.join(ROOT, path)
    return list(csv.DictReader(open(p))) if os.path.exists(p) else []
_cov = _rows("pipeline/coverage.csv")
_buy = _rows("pipeline/buyers/buyers.csv")
_inbox = _rows("pipeline/inbox-log.csv")
_comp_pass = _comp_hold = 0
for f in glob.glob(os.path.join(ROOT, "leads", "*", "compliance-log.md")):
    t = open(f).read()
    _comp_pass += len(re.findall(r"\bPASS\b", t)); _comp_hold += len(re.findall(r"\bHOLD\b", t))
_legal = glob.glob(os.path.join(ROOT, "legal", "*.md"))
_fresh_legal = 0
for f in _legal:
    m = re.search(r"Last verified:\s*(\d{4}-\d{2}-\d{2})", open(f).read())
    if m and (datetime.date.fromisoformat(TODAY) - datetime.date.fromisoformat(m.group(1))).days <= 30:
        _fresh_legal += 1
_opps = [l for l in leads if l["is_opportunity"] == "yes"]
_screened = 0
for f in glob.glob(os.path.join(ROOT, "pipeline", "candidates", "*.tsv")):
    _screened += max(0, sum(1 for _ in open(f)) - 1)
_analyzed = _count("leads/*/underwriting.md")
_drafts = _count("leads/*/outreach-drafts.md")
_touches = sum(int(float(r.get("touch_count") or 0)) for r in tracker)
_order = lambda st: STAGE_ORDER.get(st, 0)
_offers = sum(1 for l in leads if 5 <= _order(l["stage"]) <= 15)
_verbal = sum(1 for l in leads if 6 <= _order(l["stage"]) <= 15)
_contract = sum(1 for l in leads if 8 <= _order(l["stage"]) <= 15)
_buyerfound = sum(1 for l in leads if 11 <= _order(l["stage"]) <= 15)
_closed = sum(1 for l in leads if l["stage"] in ("Closed", "Paid"))
_vetted = sum(1 for b in _buy if (b.get("status") or "").lower() in ("vetted", "active", "confirmed"))
_outreach_mode = (re.search(r"outreach:\s*(\w+)", open(os.path.join(ROOT, "config.yaml")).read()) or [None, "drafts_only"])[1]
def W(worker, does, done, done_label, result, result_label, last, status, note=""):
    rate = f"{round(100 * result / done)}%" if done else ""
    return {"worker": worker, "does": does, "done": done, "done_label": done_label, "result": result, "result_label": result_label,
            "rate": rate, "last_active": last, "status": status, "note": note}
workers = [
    W("Source Mapper", "Finds and maintains public record sources per county", sum(1 for c in _cov if (c.get("primary_status") or "untested") != "untested"), "sources checked",
      sum(1 for c in _cov if c.get("primary_status") == "works"), "working", _last("pipeline/coverage.csv"), "Active"),
    W("Researcher", "Pulls new probate filings and confirms who owns the house", _screened, "estates screened",
      len(tracker), "leads confirmed and researched", _last("leads", "pipeline/candidates"), "Active"),
    W("Heir & Title Tracer", "Works out who holds title and who must sign", _count("leads/*/heirs.md"), "heir traces",
      _count("leads/*/heirs.md"), "completed", _last("leads/*/heirs.md"), "Active" if _count("leads/*/heirs.md") else "Not started"),
    W("Legal & Tax Advisor", "Keeps each state's legal file current; flags deal issues", len(_legal), "state legal files",
      _fresh_legal, "verified in last 30 days", _last("legal"), "Active"),
    W("Deal Analyst", "Values, repairs, max offer, price floors, verdict", _analyzed, "deals analyzed",
      len(_opps), "opportunities (GO/NEGOTIATE)", _last("leads/*/underwriting.md"), "Active",
      f"${sum(int(float(l['potential_earnings'] or 0)) for l in _opps):,} potential earnings found"),
    W("Acquisitions", "Writes each lead's letters and follow-up plan", _drafts, "outreach drafts",
      sum(1 for q in queues if q["queue"] == "Approve outreach"), "waiting for your approval", _last("leads/*/outreach-drafts.md"), "Active"),
    W("Compliance Officer", "Checks every message and document before it goes out", _comp_pass + _comp_hold, "items checked",
      _comp_pass, "passed", _last("leads/*/compliance-log.md"), "Waiting: nothing sent yet" if not (_comp_pass + _comp_hold) else "Active",
      f"{_comp_hold} held" if _comp_hold else ""),
    W("Communications", "Sends approved outreach, reads replies, routes them", _touches, "contacts sent",
      len(_inbox), "replies received", _last("pipeline/inbox-log.csv"),
      "Waiting on you: outreach is drafts-only" if _outreach_mode == "drafts_only" and not _touches else "Active"),
    W("Reply Desk", "Classifies and answers incoming replies", len(_inbox), "replies handled",
      sum(1 for r in _inbox if r.get("responded_date")), "answered", _last("pipeline/inbox-log.csv"),
      "Waiting: no replies yet" if not _inbox else "Active"),
    W("Negotiator", "Makes and answers offers up to the max offer", _offers, "offers made",
      _verbal, "verbal agreements", "", "Waiting: no conversations yet" if not _offers else "Active"),
    W("Buyer-List Builder", "Finds cash buyers from public deed records", len(_buy), "buyers found",
      _vetted, "vetted", _last("pipeline/buyers"), "Active" if _buy else "Not started"),
    W("Dispositions", "Matches deals to buyers and assigns contracts", _contract, "deals under contract",
      _buyerfound, "buyers matched", "", "Waiting: no contracts yet" if not _contract else "Active"),
    W("Professional Network", "Shortlists attorneys and title companies", _count("network/*.md"), "market shortlists",
      0, "engaged", _last("network"), "Active" if _count("network/*.md") else "Not started"),
    W("Transaction Coordinator", "Title checks, deadlines, signature and wire queues, closing", _count("leads/*/title.md"), "title checks done",
      _closed, "closed", _last("leads/*/title.md"), "Active", f"{_contract} under contract"),
]
write("workers.csv", ["worker", "does", "done", "done_label", "result", "result_label", "rate", "last_active", "status", "note"], workers)

# ---- health: freshness of the data itself ----
last_run = runs[-1]["date"] if runs else ""
try:
    stale_days = (datetime.date.fromisoformat(TODAY) - datetime.date.fromisoformat(last_run)).days if last_run else ""
except Exception:
    stale_days = ""
write("health.csv", ["built", "built_at", "last_run", "days_since_run", "last_run_saved", "readiness_done", "readiness_total", "replies_waiting", "buyers_vetted", "coverage_works", "coverage_total"], [{
    "built": TODAY, "built_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "last_run": last_run, "days_since_run": stale_days, "last_run_saved": runs[-1].get("pushed", "") if runs else "",
    "readiness_done": sum(1 for r in ready if r["status"] == "done"), "readiness_total": len(ready),
    "replies_waiting": len(replies), "buyers_vetted": sum(b["vetted"] for b in bstats),
    "coverage_works": sum(1 for c in cov if c["live"] == "yes" and c["status"] == "works"), "coverage_total": sum(1 for c in cov if c["live"] == "yes")}])

print(f"wrote {OUT}: {len(leads)} leads, {len(queues)} queue items, {len(markets)} market rows, {len(ok)} sources, {len(ready)} readiness items, {len(replies)} replies waiting")
