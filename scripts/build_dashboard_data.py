#!/usr/bin/env python3
"""Build the dashboard's data files from the pipeline repo.

Usage: python3 scripts/build_dashboard_data.py OUT_DIR
Writes leads.csv, queues.csv, markets.csv, sources.csv, runs.csv, pace.csv, stages.csv.
Personal names and contact details are never written (anyone who can open the dashboard can read its files).
"""
import csv, datetime, glob, json, math, os, re, subprocess, sys


def _cut(v, n):
    """Shorten text for the dashboard at a word boundary, with an ellipsis, instead of mid-word."""
    v = " ".join(str(v or "").split())
    if len(v) <= n:
        return v
    return v[:n].rsplit(" ", 1)[0].rstrip(" ,;:-(") + "…"

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
STAGE_MEANING = {
    "Researched": "Court filing found, property confirmed and numbers run. No contact yet.",
    "Outreach drafted": "A letter is written and waiting for your approval (and the 90-day wait after the death).",
    "Outreach sent": "The letter went out. Waiting for a reply.",
    "In conversation": "The executor, an heir or their attorney replied and we are talking.",
    "Offer made": "A written offer is on the table, at or below the max offer.",
    "Verbal agreement": "The seller agreed to price and terms in principle. Nothing is signed yet.",
    "Contract out for signature": "The purchase contract is ready. You and the seller sign it.",
    "Under contract": "Both sides signed. Inspection and court-approval deadlines start.",
    "Earnest money due": "You wire the deposit to the title company's escrow (confirm by phone first).",
    "Title opened": "The title company is checking ownership, liens and estate paperwork.",
    "Buyer found": "A vetted cash buyer has agreed to take over the contract.",
    "Assignment signed": "You and the buyer sign the assignment. The buyer pays their own deposit.",
    "Clear to close": "Title is clear, court steps done, closing date set.",
    "Closed": "The sale recorded. The buyer paid the estate.",
    "Paid": "Your assignment fee arrived from the title company.",
    "Dead": "Walked away: not an estate asset, numbers don't work, or the family said no.",
}
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import owner_settings as _os0
OUTREACH_MODE = _os0.effective_outreach()  # owner's newer decision: config.yaml (outreach_decided_on) vs the Setup page
if OUTREACH_MODE == "autonomous":
    # No per-letter approval: drafts that pass every gate go out on their own; markets without attorney approval or a
    # working channel hold them (owner decision 2026-11-25, config.yaml -> autonomy).
    STAGES[STAGES.index(("Outreach drafted", "Communications", "approve"))] = ("Outreach drafted", "Communications", "")
    STAGE_MEANING["Outreach drafted"] = ("A letter is written and passed the checks. It goes out on its own once the 90-day wait after the death has passed "
                                         "and the market's attorney has approved the templates and a sending channel works. Nothing for you to do.")
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
        "authority": _cut(r["letters_issued"], 200), "court_step": _cut(r["court_confirmation"], 200),
        "occupancy": _cut(r["occupancy"], 160), "next_action": _cut(r["next_action"], 240),
        "next_action_date": r["next_action_date"], "touch_count": r["touch_count"], "last_touch_date": r["last_touch_date"],
        "summary": _cut(r["notes"], 400),
        "earnest_money": r.get("earnest_money", ""), "earnest_status": r.get("earnest_status", ""),
        "contract_status": r.get("contract_status", ""), "title_company": r.get("title_company", ""),
    })
LEAD_COLS = list(leads[0].keys()) if leads else ["lead_id"]
write("leads.csv", LEAD_COLS, sorted(leads, key=lambda x: -(x["potential_earnings"] or 0)))

# ---- owner queues ----
queues = []
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import handoffs as _ho0
_blocked = _ho0.open_blockers(_ho0.load())  # a lead with an open blocker waits off the owner's queue until it's answered
for l in leads:
    if l["owner_action"] == "approve" and l["lead_id"] in approvals and l["lead_id"] not in _blocked:
        queues.append({"queue": "Approve outreach", "lead_id": l["lead_id"], "address": l["address"], "city": l["city"],
                       "county": l["county"], "state": l["state"], "item": (approvals[l["lead_id"]].split(" | ") + [""])[1] or approvals[l["lead_id"]],
                       "due": l["next_action_date"], "file": f"leads/{l['lead_id']}/outreach-drafts.md"})
    elif l["owner_action"] in ("sign", "wire"):
        _tr = next((t for t in tracker if t["lead_id"] == l["lead_id"]), {})
        _it = l["next_action"]
        if l["owner_action"] == "wire":
            _amt = _tr.get("earnest_money") or ""
            _it = f"Deposit {'$' + format(int(float(_amt)), ',') if _amt else 'amount not set'} to {_tr.get('title_company') or 'title company not set'}" + (f", confirm wiring by phone at {_tr['title_phone']} (from its official website)" if _tr.get("title_phone") else ", phone not recorded yet") + (f". {_it}" if _it else "")
        else:
            _it = (f"Signing: {_tr['contract_status']}. " if _tr.get("contract_status") else "") + _it
        queues.append({"queue": "Sign" if l["owner_action"] == "sign" else "Wire", "lead_id": l["lead_id"],
                       "address": l["address"], "city": l["city"], "county": l["county"], "state": l["state"],
                       "item": _it, "due": l["next_action_date"], "file": f"leads/{l['lead_id']}/", "sign_url": _tr.get("sign_url", "") if l["owner_action"] == "sign" else ""})
# Owner decisions from the dashboard (scripts/owner_decisions.py): shown on the queue and message rows.
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import owner_decisions
DEC = owner_decisions.load()
_QK = {"Approve outreach": "outreach", "Sign": "sign", "Wire": "wire"}
for q in queues:
    d = DEC.get((_QK.get(q["queue"], ""), q["lead_id"]))
    q["decision"] = d["decision"] if d else ""
    q["decision_note"] = d["note"] if d else ""
write("queues.csv", ["queue", "lead_id", "address", "city", "county", "state", "item", "due", "file", "decision", "decision_note", "sign_url"], queues)

# ---- exceptions (Exceptions Desk) with the owner's saved choice ----
_addr = {l["lead_id"]: f"{l['address']}, {l['city']} {l['state']}" for l in leads}
_ex = []
_exp = os.path.join(ROOT, "pipeline", "exceptions.csv")
for e in (list(csv.DictReader(open(_exp))) if os.path.exists(_exp) else []):
    d = DEC.get(("exceptions", e["id"].lower()))
    _ex.append({**{k: e.get(k, "") for k in ("id", "date", "lead_id", "type", "raised_by", "status", "playbook", "actions", "resolution", "owner_needed", "recommendation", "options", "due")},
                "property": _addr.get(e.get("lead_id", ""), ""), "decision": d["decision"] if d else "", "decision_note": d["note"] if d else ""})
write("exceptions.csv", ["id", "date", "lead_id", "property", "type", "raised_by", "status", "playbook", "actions", "resolution", "owner_needed", "recommendation", "options", "due", "decision", "decision_note"], _ex)

# ---- team handoffs (scripts/handoffs.py): questions, requests and blockers between workers ----
import handoffs as _ho
_hrows = _ho.load()
_lead_addr = {l["lead_id"]: (l["address"], l["city"], l["state"], l["county"]) for l in leads}
hand = []
for r in _hrows:
    a = _lead_addr.get(r["lead_id"], ("", "", "", ""))
    age = (datetime.date.fromisoformat(TODAY) - datetime.date.fromisoformat(r["created"])).days if re.fullmatch(r"\d{4}-\d\d-\d\d", r["created"] or "") else ""
    hand.append({**{c: r.get(c, "") for c in ("id", "created", "from_worker", "to_worker", "lead_id", "kind", "priority", "ask", "needed_by", "status", "answer", "answered_by", "answered_on", "evidence", "hops")},
                 "overdue": "yes" if _ho.overdue(r, TODAY) else "", "age_days": age, "address": a[0], "city": a[1], "state": a[2], "county": a[3]})
write("handoffs.csv", ["id", "created", "from_worker", "to_worker", "lead_id", "address", "city", "state", "county", "kind", "priority", "ask", "needed_by", "status",
                       "overdue", "age_days", "answer", "answered_by", "answered_on", "evidence", "hops"], hand)

# ---- messages: every drafted or sent message, with its body and attachments ----
# Source: leads/<id>/outreach-drafts.md, one "## " section per message. Sections that aren't messages (the follow-up
# plan, the compliance pre-check) go along as reference for the lead. A message lists what goes with it on a line
# "Attachments: <file>, <file>" (files under leads/<id>/); each listed file's text is included.
_SENT = set(s for s, _, _ in STAGES[STAGES.index(("Outreach sent", "Communications", "")):] ) - {"Dead"}
def _kind(h):
    hl = h.lower()
    if "compliance" in hl: return "compliance"
    if "cadence" in hl or "follow-up plan" in hl: return "plan"
    if hl.startswith("call"): return "call script"
    if hl.startswith("email") or "e-mail" in hl: return "email"
    if hl.startswith("text") or "sms" in hl: return "text"
    if hl.startswith("letter") or "postcard" in hl: return "letter"
    return "note"
def _first_commit(path):
    try:
        out = subprocess.run(["git", "-C", ROOT, "log", "--diff-filter=A", "--format=%cs", "--", path], capture_output=True, text=True, timeout=20).stdout.split()
        return out[-1] if out else ""
    except Exception:
        return ""
messages = []
_lead_by_id = {l["lead_id"]: l for l in leads}
for f in sorted(glob.glob(os.path.join(ROOT, "leads", "*", "outreach-drafts.md"))):
    lid = os.path.basename(os.path.dirname(f)); l = _lead_by_id.get(lid)
    if not l: continue
    txt = open(f).read()
    parts = re.split(r"\n(?=## )", txt)
    intro = parts[0]
    recip = (re.search(r"Recipient:\s*(.+?\))", intro) or re.search(r"Recipient:\s*([^.\n]+)", intro) or [None, ""])[1][:200]
    intro_note = re.sub(r"^#[^\n]*\n", "", intro).strip()[:1500]
    refs = [{"name": "Plan for this lead", "file": f"leads/{lid}/plan.md", "text": open(os.path.join(ROOT, "leads", lid, "plan.md")).read()[:6000]}] if os.path.exists(os.path.join(ROOT, "leads", lid, "plan.md")) else []
    for sec in parts[1:]:
        head, _, body = sec[3:].partition("\n")
        k = _kind(head)
        if k in ("compliance", "plan"):
            refs.append({"name": head.strip(), "file": f"leads/{lid}/outreach-drafts.md", "text": body.strip()[:6000]})
    n = 0
    for sec in parts[1:]:
        head, _, body = sec[3:].partition("\n")
        k = _kind(head)
        if k in ("compliance", "plan"): continue
        n += 1
        if k == "call script" and OUTREACH_MODE == "autonomous" and l["stage"] not in _SENT:
            continue  # owner decision 2026-11-25: no routine calls for the owner; a call is offered only when someone asks (Reply Desk)
        atts = []
        for line in re.findall(r"^(?:Attachments?|Enclosures?):\s*(.+)$", body, re.M | re.I):
            for a in [x.strip() for x in re.split(r"[,;]", line) if x.strip() and x.strip().lower() not in ("none", "n/a")]:
                ap = os.path.normpath(os.path.join(ROOT, a if a.startswith("leads/") else os.path.join("leads", lid, a)))
                ok_ = ap.startswith(os.path.join(ROOT, "leads", lid)) and os.path.isfile(ap)
                atts.append({"name": os.path.basename(a), "file": os.path.relpath(ap, ROOT), "found": ok_,
                             "text": open(ap, errors="replace").read()[:20000] if ok_ and ap.endswith((".md", ".txt", ".csv")) else ""})
        d = DEC.get(("outreach", lid))
        if l["stage"] in _SENT and k != "call script": status = "sent"
        elif l["stage"] == "Dead": status = "withdrawn"
        elif d: status = {"approved": "approved by you", "changes": "changes requested", "rejected": "rejected"}[d["decision"]]
        elif k == "call script": status = "script for you"
        elif OUTREACH_MODE == "autonomous": status = "held until the market is cleared"  # sends itself once attorney approval, channel, compliance and the 90-day wait all pass
        else: status = "draft awaiting approval"
        to = recip or (re.search(r"[-—]\s*to\s+(.+)$", head) or [None, ""])[1].strip()
        messages.append({"msg_id": f"{lid}--{n}", "lead_id": lid, "address": l["address"], "city": l["city"], "county": l["county"],
                         "state": l["state"], "stage": l["stage"], "channel": k, "title": head.strip()[:160], "to": to[:160],
                         "status": status, "created": (re.search(r"created (\d{4}-\d\d-\d\d)", approvals.get(lid, "")) or [None, ""])[1] or _first_commit(f),
                         "sent_on": l["last_touch_date"] if status == "sent" else "", "words": len(body.split()),
                         "body": body.strip()[:12000], "attachments": json.dumps(atts), "attachment_count": len(atts),
                         "references": json.dumps(refs if n == 1 else []), "lead_note": intro_note if n == 1 else "", "decision_note": d["note"] if d else "",
                         "potential_earnings": l["potential_earnings"]})
with open(os.path.join(OUT, "messages.json"), "w") as fh:
    json.dump(messages, fh)

# ---- conversations: every message in and out, and what the workers did, per lead (owner decision 2026-11-27) ----
# Real threads: leads/<id>/thread.csv (Communications appends each letter, email, reply and step). Simulations
# (simulations/<id>/thread.csv) are shown with a SIMULATION label and never count as pipeline activity.
_threads = []
for base, sim in ((os.path.join(ROOT, "leads"), False), (os.path.join(ROOT, "simulations"), True)):
    if not os.path.isdir(base):
        continue
    for lid in sorted(os.listdir(base)):
        d_ = os.path.join(base, lid)
        if not os.path.isdir(d_):
            continue
        # A lead has thread.csv; a simulation may also have branch files (b01-*.csv), one scenario each.
        files = ["thread.csv"] if not sim else sorted((f for f in os.listdir(d_) if f.endswith(".csv")), key=lambda f: (f != "thread.csv", f))
        for fn in files:
          tp = os.path.join(d_, fn)
          if not os.path.isfile(tp):
              continue
          lead = next((x for x in leads if x["lead_id"] == lid), {})
          stem = fn[:-4]
          scen = "Main path: first letter to closing" if stem == "thread" else re.sub(r"^b\d+-", "", stem).replace("-", " ").capitalize()
          for i, t in enumerate(csv.DictReader(open(tp))):
            _threads.append({"thread": ("sim:" if sim else "") + lid + ("" if stem == "thread" else ":" + stem), "lead_id": lid, "simulation": "yes" if sim else "no",
                             "scenario": scen if sim else "",
                             "address": lead.get("address", ""), "city": lead.get("city", ""), "state": lead.get("state", ""),
                             "n": i + 1, "at": t.get("at", ""), "dir": t.get("dir", ""), "channel": t.get("channel", ""),
                             "who": t.get("who", "")[:120], "worker": t.get("worker", "")[:60], "stage": t.get("stage", "")[:60],
                             "text": t.get("text", "")[:6000], "note": t.get("note", "")[:1500]})
with open(os.path.join(OUT, "conversations.json"), "w") as fh:
    json.dump(_threads, fh)


# ---- stages (full list, so empty stages still show) ----
write("stages.csv", ["stage_order", "stage", "team", "owner_action", "meaning"],
      [{"stage_order": i + 1, "stage": s, "team": t, "owner_action": o, "meaning": STAGE_MEANING.get(s, "")} for i, (s, t, o) in enumerate(STAGES)])

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
floor_ = (re.search(r"closings_floor: (\d+)", open(os.path.join(ROOT, "config.yaml")).read()) or [None, ""])[1]
tgt = (re.search(r"closings_per_month: (\d+)", open(os.path.join(ROOT, "config.yaml")).read()) or [None, "115"])[1]
cnt = lambda st: sum(1 for l in leads if l["stage"] in st)
# What it takes to hit the target: work back from closings using each step's MEASURED conversion rate from the tracker.
# n >= targets.min_sample_for_measured_rate outcomes -> measured rate as-is; 1..n-1 -> measured, blended with the starting
# assumption weighted as 10 outcomes; 0 outcomes -> starting assumption (flagged on the dashboard as not measured yet).
_cfg = open(os.path.join(ROOT, "config.yaml")).read()
_rates = dict(re.findall(r"^    (\w+): ([0-9.]+)", (re.search(r"\n  assumed_rates:[^\n]*\n((?:    [^\n]*\n)+)", _cfg) or [None, ""])[1], re.M))
_min_n = int((re.search(r"min_sample_for_measured_rate: (\d+)", _cfg) or [None, "20"])[1])
_contract_st = ("Contract out for signature", "Under contract", "Earnest money due", "Title opened", "Buyer found", "Assignment signed", "Clear to close", "Closed", "Paid")
_conv_st = ("In conversation", "Offer made", "Verbal agreement") + _contract_st
_sent_st = ("Outreach sent",) + _conv_st
_today = datetime.date.fromisoformat(TODAY)
def _aged(l, days):
    try: return (_today - datetime.date.fromisoformat(l["last_touch_date"])).days >= days
    except Exception: return False
_steps = {  # step -> (trials, successes)
    "researched_to_opportunity": (sum(1 for l in leads if l["verdict"]), sum(1 for l in leads if l["verdict"] in ("GO", "NEGOTIATE"))),
    # an outreach counts once the seller replied, or 14 days passed without a reply (so fresh letters don't count as failures)
    "opportunity_to_conversation": (sum(1 for l in leads if l["stage"] in _conv_st or (l["stage"] == "Outreach sent" and _aged(l, 14))), sum(1 for l in leads if l["stage"] in _conv_st)),
    "conversation_to_contract": (sum(1 for l in leads if l["stage"] in _conv_st), sum(1 for l in leads if l["stage"] in _contract_st)),
    "contract_to_close": (sum(1 for l in leads if l["stage"] in _contract_st), sum(1 for l in leads if l["stage"] in ("Closed", "Paid"))),
}
_DEF = {"researched_to_opportunity": 0.40, "opportunity_to_conversation": 0.15, "conversation_to_contract": 0.30, "contract_to_close": 0.75}
_rate_out = {}
def _rate(k):
    prior = float(_rates.get(k, _DEF[k])) or _DEF[k]; n, w = _steps[k]
    if n >= _min_n: r, src = w / n, "measured"
    elif n > 0: r, src = (w + prior * 10) / (n + 10), "blended"
    else: r, src = prior, "assumed"
    r = min(max(r, 0.01), 1.0)
    _rate_out.update({f"rate_{k}": round(r, 4), f"src_{k}": src, f"n_{k}": n, f"won_{k}": w})
    return r
_need_contracts = math.ceil(int(tgt) / _rate("contract_to_close"))
_need_conv = math.ceil(_need_contracts / _rate("conversation_to_contract"))
_need_opps = math.ceil(_need_conv / _rate("opportunity_to_conversation"))
_need_res = math.ceil(_need_opps / _rate("researched_to_opportunity"))
write("pace.csv", ["month", "target_closings", "closed", "under_contract", "verbal_agreements", "offers_out", "in_conversation",
                   "outreach_sent", "opportunities", "leads_researched", "markets_live",
                   "reached_conversation", "reached_contract", "needed_researched", "needed_opportunities", "needed_conversations", "needed_contracts", "floor_closings",
                   "outreach_awaiting_approval", "min_sample"] + list(_rate_out), [{
    "floor_closings": floor_, "outreach_awaiting_approval": cnt(("Outreach drafted",)), "min_sample": _min_n, **_rate_out,
    "reached_conversation": cnt(_conv_st), "reached_contract": cnt(_contract_st),
    "needed_researched": _need_res, "needed_opportunities": _need_opps, "needed_conversations": _need_conv, "needed_contracts": _need_contracts,
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
# Owner settings saved on the dashboard's Setup page override config.yaml (scripts/owner_settings.py).
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import owner_settings
OV = owner_settings.load()
biz.update({k: v for k, v in OV.get("business", {}).items() if v and k in owner_settings.SCHEMA["business"]})
_och = OV.get("channels", {})
autonomy["outreach"] = OUTREACH_MODE  # the newer of the Setup page's choice and config.yaml's dated owner decision
ready = []
def item(area, name, status, fix, unlocks, area_id, key):
    st = status if isinstance(status, str) else ("done" if status else "missing")
    ready.append({"area": area, "item": name, "status": st, "how_to_fix": fix, "unlocks": unlocks, "area_id": area_id, "item_key": key})
BIZ_LABEL = {"legal_name": "Company legal name", "entity_state": "State of formation", "mailing_address": "Business mailing address",
             "phone": "Business phone answered by a person", "email": "Business email", "website": "Website",
             "signer": "Who signs contracts", "title_company": "Title company for earnest money"}
for k, lbl in BIZ_LABEL.items():
    if k == "title_company":   # optional: the Professional Network picks one per market (network/<market>.md)
        item("Business identity", "Default title company (optional; chosen per market by the system)", bool(biz.get(k)),
             "Nothing to do: the Professional Network shortlists and picks an investor-friendly title company in each market. Enter one only if you already have a favourite", "A preferred title company everywhere", "business", k)
        continue
    item("Business identity", lbl, bool(biz.get(k)), "Setup page → Business identity → Configure", "Attorney packets, letters, trust with attorneys", "business", k)
item("Business identity", "Business insurance (optional)", bool(biz.get("insurance")),
     "Ask your CPA or attorney about general liability and errors-and-omissions cover once the company exists; then Setup → Business identity → Configure", "Protection if a deal goes wrong", "business", "insurance")
CH = {"mail_sending": ("Letters sent without you", "Open a Lob account (lob.com), then Setup → Sending and signing services → paste its live_ API key. The next run tests it and switches this on"),
      "email_sending": ("Email sent without you", "Open a Resend account (resend.com), verify your business email's domain there, then Setup → Sending and signing services → paste the API key. The next run tests it and switches this on"),
      "inbox_connected": ("Replies read automatically", "In Resend, turn on receiving for replies.emporium-investments.com (add the MX record it shows in Route 53). With the Resend key saved, the next run tests it and switches this on"),
      "mail_scanning": ("Mailed replies arrive by email", "Mail to the principal address: scan each reply with your phone (Notes, Google Drive or Adobe Scan) and email the PDF to reply@replies.emporium-investments.com; the next run picks it up. Or open a virtual mailbox that scans each letter to PDF (e.g. iPostal1, Anytime Mailbox, Earth Class Mail, PostScan Mail) and set it to email every scan to reply@replies.emporium-investments.com; use its street address as the business mailing address. Then tick it under Setup → Channels. The runs collect the scans automatically"),
      "voicemail_to_email": ("Voicemails arrive by email (optional)", "Optional: the phone number isn't published in letters or on the website. If you ever publish it, use a phone service with voicemail-to-email and enter it under Setup → Channels"),
      "field_inspections": ("Someone can see a house (field inspections)", "Open an account with a field-inspection service that covers your markets (the Professional Network lists options in network/<market>.md), keep a card on file there, then tick it under Setup → Channels. Visits are booked within the $150 limit")}
for k, (lbl, fix) in CH.items():
    st = "done" if chan.get(k) == "true" or (k in ("field_inspections", "mail_scanning") and _och.get(f"{k}_ready")) else ("waiting for check" if _och.get(f"{k}_ready") else "missing")
    item("Channels", lbl, st, fix, "Reply desk and sending with no manual steps", "channels", k)
item("Autonomy", "Outreach set to autonomous", autonomy.get("outreach") == "autonomous", "Setup page → Autonomy → Configure (after the items above)", "Letters go out without per-message approval", "autonomy", "outreach")
ES = cfg_block("esignature")
item("Channels", "E-signature service connected" + (f" ({ES.get('provider','').title()})" if ES.get("provider") else ""), bool(ES.get("connected_on")),
     "Open a DocuSeal account (docuseal.com), then Setup → Sending and signing services → paste its API key. The next run tests it and switches this on", "Contracts go to you and the seller for signature without paperwork", "channels", "esignature")
BK = (re.search(r"^bookkeeping:.*\n\s+stripe:.*\n((?:\s{4}.*\n)+)", open(os.path.join(ROOT, "config.yaml")).read(), re.M) or [None, ""])[1]
item("Channels", "Stripe connected for bookkeeping (read-only)", bool(re.search(r"connected_on:\s*\d{4}-\d\d-\d\d", BK)),
     "Connect the Stripe connector at claude.ai → Settings → Connectors; the Bookkeeper then imports only transactions tagged 'probate' or a lead id", "Fees and expenses paid through Stripe land in the ledger without typing them in", "channels", "bookkeeping_stripe")
CS = cfg_block("closing_service")
item("Channels", "Closing status from the title company (Qualia Connect)", bool(CS.get("connected_on")),
     "Connect the Qualia Connect connector at claude.ai → Settings → Connectors. It shows orders only from title companies that run on Qualia and invite you to the closing", "Earnest money received, title and closing dates tracked without email", "channels", "closing_service")
LS = cfg_block("legal_service")
_prov = {"general_legal": "General Legal", "legalzoom": "LegalZoom", "rocket_lawyer": "Rocket Lawyer"}.get(LS.get("provider", ""), LS.get("provider", ""))
_cov = [x.strip().upper() for x in (LS.get("covered_states") or "").split(",") if x.strip()]
_declined = LS.get("coverage_status") == "declined"
# Attorneys are sourced by the system itself (owner decision 2026-11-26): the Professional Network finds,
# verifies and scores a licensed attorney per market and keeps pipeline/attorney-candidates.csv current.
_acp = os.path.join(ROOT, "pipeline", "attorney-candidates.csv")
_acand = list(csv.DictReader(open(_acp))) if os.path.exists(_acp) else []
_ARANK = {"engaged": 0, "engagement letter to sign": 1, "chosen": 1, "quoted": 2, "contacted": 3, "verified": 4, "candidate": 5, "declined": 9, "rejected": 9}
def _best_att(mk):
    c = [r for r in _acand if r.get("market") == mk and _ARANK.get(r.get("status", ""), 8) < 9]
    return sorted(c, key=lambda r: (_ARANK.get(r.get("status", ""), 8), -float(r.get("score") or 0)))[0] if c else None
write("attorney_candidates.csv", ["market", "state", "name", "firm", "bar_number", "bar_verified_on", "focus", "score", "status", "quote", "source", "updated"],
      sorted(_acand, key=lambda r: (r.get("market", ""), _ARANK.get(r.get("status", ""), 8), -float(r.get("score") or 0))))
if _declined:
    item("Attorneys", f"Attorney review service ({_prov}) declined probate work" + (f" on {LS.get('declined_on')}" if LS.get("declined_on") else ""), True,
         "Nothing to do: the Professional Network sources a licensed attorney for each market itself from the state bar's directory, verifies the licence and fills it in here", "—", "legal", "provider")
    item("Attorneys", "Attorneys sourced by the system for every live market", True if all(_best_att(m["market"]) for m in live) else ("waiting for check" if _acand else False),
         "The Professional Network searches each state bar's directory for probate and real-estate attorneys, checks the licence, scores them and proposes the best one per market (pipeline/attorney-candidates.csv)", "An attorney ready to engage in each market", "legal", "sourcing")
else:
    item("Attorneys", "Attorney review service connected" + (f" ({_prov})" if _prov else ""), bool(LS.get("provider") and LS.get("connected_on")),
         "Connect an attorney-review connector (for example General Legal) at claude.ai → Settings → Connectors", "Sending attorney packets and getting redlines back without email", "legal", "provider")
    item("Attorneys", "Service confirmed its licensed states and fees", True if LS.get("coverage_status") == "answered" else ("waiting for check" if LS.get("coverage_status") == "asked" else False),
         "The Legal Advisor asked in the service's coverage matter and checks for the answer every evening run", "Knowing which markets the service can cover", "legal", "coverage")
for m in live:
    body = (re.search(rf"\n  - id: {re.escape(m['market'])}\n(.*?)(?=\n  - id: |\n\S|\Z)", cfg_txt, re.S) or [None, ""])
    body = body.group(1) if hasattr(body, "group") else ""
    mo = OV.get(f"market-{m['market']}", {})
    appr = (re.search(r"attorney_approved:\s*([0-9-]+)", body) or [None, ""])[1]  # recorded by the Legal Advisor after checking the signed approval
    pk = os.path.exists(os.path.join(ROOT, "legal", "attorney-packets", f"{m['market']}.md"))
    lbl = f"{m['county']} County, {m['state']}"
    aid = f"market-{m['market']}"
    if m["outreach_allowed"] != "True" and m["outreach_allowed"] != "true":
        item(lbl, "Outreach allowed by state rules", "waiting for check" if mo.get("licensed_or_partnered") else False,
             f"Setup page → {lbl} → Configure: licence or licensed partner (Legal Advisor confirms against legal/{m['state']}.md)", "Any outreach in this market", aid, "licensed_or_partnered")
    _mm = dict(x.split(":", 1) for x in (LS.get("market_matters") or "").split() if ":" in x)
    _att = (re.search(r"\n\s+attorney:\s*([^\n#]+)", "\n" + body) or [None, ""])[1].strip()
    _ba = _best_att(m["market"])
    _who = f"{_ba['name']}, {_ba['firm']}".strip(", ") if _ba else ""
    if _att: _ast = True
    elif m["market"] in _mm and not _declined: _ast = "waiting for check"
    elif _ba: _ast = "waiting for check"
    elif LS.get("provider") and not _declined and (not _cov or m["state"] in _cov): _ast = "waiting for check" if LS.get("coverage_status") == "asked" else False
    else: _ast = False
    if _att: _afix = f"Engaged: {_att}"
    elif _ba: _afix = (f"Proposed by the system: {_who}" + (f" (bar #{_ba['bar_number']}, licence checked {_ba['bar_verified_on']})" if _ba.get("bar_number") else "")
                      + f" · {_ba.get('status') or 'candidate'}" + (f" · quote {_ba['quote']}" if _ba.get("quote") else "")
                      + ". You only sign the engagement letter when it reaches your Sign queue.")
    elif m["market"] in _mm and not _declined: _afix = f"{_prov}: packet submitted (matter {_mm[m['market']][:8]}…)"
    else: _afix = f"The Professional Network is sourcing a {m['state']}-licensed probate / real-estate attorney from the state bar's directory and fills it in here; nothing for you to do"
    item(lbl, "Attorney engaged for this state" + (f" · {_ba['name']}" if _ba and not _att else ""), _ast, _afix,
         "Attorney review of this market's letters and contracts", aid, "attorney")
    item(lbl, "Attorney packet built", pk, "Built automatically by the runner (scripts/build_attorney_packet.py)", "Attorney review", aid, "packet")
    item(lbl, "Attorney approved templates", True if appr else ("waiting for check" if mo.get("approved_on") else False), (f"The Legal Advisor sends legal/attorney-packets/{m['market']}.md to the engaged attorney and records the approval itself; you only sign the attorney's engagement letter" if OUTREACH_MODE == "autonomous" else f"Send legal/attorney-packets/{m['market']}.md to a local attorney; record the approval on Setup page → {lbl} → Configure"), "Autonomous sending here", aid, "approved_on")

# ---- attorney review: service matters and each market's legal status (Markets & legal page) ----
_lmp = os.path.join(ROOT, "pipeline", "legal-matters.csv")
_lm = list(csv.DictReader(open(_lmp))) if os.path.exists(_lmp) else []
write("legal_matters.csv", ["matter_id", "provider", "market_id", "purpose", "status", "opened", "last_checked", "last_message_at", "last_message", "covered_states", "fees_quoted"],
      [{**r, "matter_id": r["matter_id"][:8] + "…"} for r in _lm])
_lmk = []
for r in ready:
    if r["area_id"].startswith("market-") and r["item_key"] in ("attorney", "packet", "approved_on"):
        _lmk.append({"market": r["area"], "step": {"attorney": "Attorney engaged", "packet": "Packet built", "approved_on": "Templates approved"}[r["item_key"]], "status": r["status"], "next": r["how_to_fix"]})
write("legal_markets.csv", ["market", "step", "status", "next"], _lmk)
# Signing: the company's own e-signature (config.yaml → company_signature; owner decision 2026-11-25). Optional: without it, contracts come to the owner as one-tap signatures.
_CSG = cfg_block("company_signature")
item("Signing", "Company resolution signed (lets the company e-sign deals inside fixed limits)", bool(re.match(r"\d{4}-", _CSG.get("resolution_signed_on", ""))),
     "The Legal Advisor has the attorney draft it and puts it in your Sign queue; one signature, once", "Contracts inside the limits signed without you", "signing", "resolution_signed_on")
item("Signing", "Attorney confirmed the company e-signature" + (f" ({_CSG.get('attorney_confirmed_states')})" if _CSG.get("attorney_confirmed_states") else ""),
     bool(re.match(r"\d{4}-", _CSG.get("attorney_confirmed_on", ""))), "Runs on its own: the Legal Advisor asks the attorney and records the answer", "Contracts inside the limits signed without you", "signing", "attorney_confirmed_on")
write("readiness.csv", ["area", "item", "status", "how_to_fix", "unlocks", "area_id", "item_key"], ready)

# Earnest-money reserve (scripts/reserve.py) and the runner's record of each run (pipeline/runner-health.csv).
try:
    _rv = json.loads(subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "reserve.py")], cwd=ROOT, capture_output=True, text=True).stdout)
    _em = cfg_block("earnest_money")
    _n, _s = float(_em.get("normal_deal_share") or 0.33), float(_em.get("strong_deal_share") or 0.5)
    write("reserve.csv", ["start", "refill_from_profit", "forfeited", "total", "committed", "available", "normal_cap", "strong_cap", "open_deposits", "company_signature"],
          [{**{k: _rv.get(k) for k in ("start", "refill_from_profit", "forfeited", "total", "committed", "available")},
            "normal_cap": round(_rv["total"] * _n), "strong_cap": round(_rv["total"] * _s), "open_deposits": len(_rv.get("open_deposits", [])),
            "company_signature": "on" if _CSG.get("enabled") == "true" else "off"}])
except Exception as _e:
    print("reserve: skipped", _e)
    write("reserve.csv", ["start", "refill_from_profit", "forfeited", "total", "committed", "available", "normal_cap", "strong_cap", "open_deposits", "company_signature"], [])
_rh = []
if os.path.exists(os.path.join(ROOT, "pipeline", "runner-health.csv")):
    _rh = list(csv.DictReader(open(os.path.join(ROOT, "pipeline", "runner-health.csv"), newline="")))[-40:][::-1]
write("runner_health.csv", ["date", "slice", "level", "engine", "result", "verify", "notes"], [{k: r.get(k, "") for k in ("date", "slice", "level", "engine", "result", "verify", "notes")} for r in _rh])

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

# ---- the buyer list itself (Buyers page): public-record and business details only, stop-list buyers excluded ----
_mk = {m["market"]: m for m in live}
_ST = {"found": 0, "contacted": 2, "confirmed": 6, "vetted": 10}
def _bscore(b):
    if (b.get("score") or "").strip():
        return b["score"]
    try:
        n = int(float(b.get("purchases_12m") or 0))
    except ValueError:
        n = 0
    try:
        days = (datetime.date.today() - datetime.date.fromisoformat(b.get("last_purchase_date") or "")).days
    except ValueError:
        days = 999
    sc = min(n, 20) * 2 + (6 if days <= 90 else 3 if days <= 180 else 0) + _ST.get(b.get("status") or "", 0)
    sc += 10 if b.get("loi_status") == "signed" else 0
    sc += 4 if (b.get("warmth") or "") == "hot" else 2 if (b.get("warmth") or "") == "warm" else 0
    sc -= 8 * len([x for x in (b.get("red_flags") or "").split(";") if x.strip()])   # each red flag costs a lot
    sc -= 10 if (b.get("end_buyer") or "").lower() == "wholesaler" else 0          # resells contracts: not an end buyer
    sc += 6 if (b.get("ready_to_buy") or "").lower().startswith("yes") else 0
    sc += {"eager": 4, "interested": 2, "neutral": 0, "hesitant": -2, "not interested": -6}.get((b.get("sentiment") or "").lower(), 0)
    try:
        sc += 5 * min(int(b.get("deals_closed_with_us") or 0), 4)   # closed with us before: the best predictor
    except ValueError:
        pass
    try:
        cd = int(b.get("close_days_confirmed") or b.get("closes_in_days") or 0)
        sc += 4 if 0 < cd <= 10 else 2 if 0 < cd <= 21 else 0   # closes in days, not weeks
    except ValueError:
        pass
    return str(sc)
BUYER_COLS = ["buyer_id", "market_id", "county", "state", "city", "name", "entity_type", "status", "warmth", "standby", "loi_status", "paired_leads",
              "purchases_12m", "median_price_12m", "last_purchase_date", "areas", "price_min", "price_max", "rehab_level", "strategy",
              "closes_in_days", "proof_of_funds", "cash_verified", "entity_status", "entity_checked_on", "registered_agent",
              "contact_on_file", "website", "mailing_address", "intro_status", "last_contact",
              "next_followup", "loi_sent_on", "loi_signed_on", "buy_box_notes", "home_state", "sentiment", "sentiment_notes",
              "max_pct_arv", "max_assignment_fee", "emd_offered", "close_days_confirmed", "deals_closed_with_us",
              "end_buyer", "osint_status", "osint_checked_on", "red_flags", "ready_to_buy", "response_hours",
              "source_url", "source_date", "notes", "score"]
_blist = []
for b in brows:
    if (b.get("stop") or "").lower() == "yes":
        continue
    m = _mk.get(b.get("market_id"), {})
    r = {c: (b.get(c) or "") for c in BUYER_COLS}
    # Privacy (qa_checks.py): contact details stay in the private repo file; the page shows only whether we have one.
    r["contact_on_file"] = "yes" if (b.get("public_email") or b.get("public_phone")) else "no"
    if (b.get("entity_type") or "").lower() in ("person", "individual"):
        r["mailing_address"] = ""   # an individual's address isn't shown, even from public records
    if not m and b.get("market_id"):   # a market not live yet (expansion queue): show its id
        r["county"] = b["market_id"]
    r.update(county=r["county"] if not m else m.get("county", ""), state=m.get("state", "") or (b.get("market_id") or "")[:2].upper(), status=b.get("status") or "found",
             warmth=b.get("warmth") or "cold", standby=b.get("standby") or "no", loi_status=b.get("loi_status") or "none", score=_bscore(b))
    _blist.append(r)
# Buyers paired with each live lead before signing (scripts/match_buyers.py; owner decision 2026-11-27).
_lm_path = os.path.join(ROOT, "pipeline", "buyers", "lead-matches.csv")
_lm = list(csv.DictReader(open(_lm_path))) if os.path.exists(_lm_path) else []
_paired = {}
for m in _lm:
    _paired[m["buyer_id"]] = _paired.get(m["buyer_id"], 0) + 1
for r in _blist:
    r["paired_leads"] = _paired.get(r["buyer_id"], 0)
_blist.sort(key=lambda r: -float(r["score"] or 0))
write("buyers_list.csv", BUYER_COLS, _blist)

# ---- AI spend and credit (runner/credits.mjs; owner decision 2026-11-27): the AI spend tab ----
_sp_path = os.path.join(ROOT, "pipeline", "ai-spend.csv")
_spend = []
for r in (csv.DictReader(open(_sp_path)) if os.path.exists(_sp_path) else []):
    try:
        _spend.append({"day": r["date"][:10], "time": r["date"][11:16], "slice": r.get("slice", ""), "engine": r.get("engine", ""),
                       "model": r.get("model", ""), "cost_usd": round(float(r.get("cost_usd") or 0), 4)})
    except ValueError:
        pass
write("ai_spend.csv", ["day", "time", "slice", "engine", "model", "cost_usd"], _spend)
try:
    _cr = json.load(open(os.path.join(ROOT, "pipeline", "ai-credits.json")))
except (OSError, ValueError):
    _cr = {}
_c, _o = _cr.get("claude") or {}, _cr.get("openrouter") or {}
_now = datetime.datetime.now(datetime.timezone.utc)
_month = _now.strftime("%Y-%m")
_mspend = sum(r["cost_usd"] for r in _spend if r["day"].startswith(_month))
_tspend = sum(r["cost_usd"] for r in _spend if r["day"] == _now.strftime("%Y-%m-%d"))
_budget = float(_c.get("budget_usd") or 0)
_dim = (datetime.date(_now.year + (_now.month == 12), _now.month % 12 + 1, 1) - datetime.timedelta(days=1)).day
_days_left = _dim - _now.day + 1
_allow = max(0.0, (_budget - (_mspend - _tspend)) / _days_left) if _budget else ""
_runs = [r for r in _spend if r["day"].startswith(_month)]
write("ai_credits.csv", ["claude_ok", "claude_why", "checked", "month", "month_spend", "budget", "budget_left", "today_spend", "today_allowance",
                         "projected_month", "runs_month", "avg_run_cost", "openrouter_today", "openrouter_cap", "openrouter_free_tier"],
      [{"claude_ok": "unknown" if not _c else ("yes" if _c.get("ok") else "no"), "claude_why": _c.get("why", "not checked yet"), "checked": (_c.get("checked") or "")[:16].replace("T", " "),
        "month": _month, "month_spend": round(_mspend, 2), "budget": _budget or "", "budget_left": round(_budget - _mspend, 2) if _budget else "",
        "today_spend": round(_tspend, 2), "today_allowance": round(_allow, 2) if _allow != "" else "",
        "projected_month": round(_mspend / max(1, _now.day) * _dim, 2), "runs_month": len(_runs),
        "avg_run_cost": round(_mspend / len(_runs), 2) if _runs else "",
        "openrouter_today": _o.get("requests", 0) if _o.get("day") == _now.strftime("%Y-%m-%d") else 0, "openrouter_cap": _o.get("daily_cap", ""),
        "openrouter_free_tier": "yes" if _o.get("free_tier") else ("no" if _o else "")}])
# ---- Tax-delinquent inherited leads (owner decision 2026-11-27): the Tax-delinquent tab ----
# Per lead: what's owed, the tax-sale date and the 12-month wait after death (pipeline/tax-delinquent.csv, kept by the
# Tax & Lien Checker). Per county: whether the delinquent list source works (coverage.csv tax_status).
_td_path = os.path.join(ROOT, "pipeline", "tax-delinquent.csv")
_td = {r["lead_id"]: r for r in (csv.DictReader(open(_td_path)) if os.path.exists(_td_path) else [])}
_cfgtxt = open(os.path.join(ROOT, "config.yaml")).read()
_tdm = int((re.search(r"tax_delinquent_min_months_after_death:\s*(\d+)", _cfgtxt) or [None, "12"])[1])
_tdon = bool(re.search(r"^  tax_delinquent_inherited:\s*true", _cfgtxt, re.M))
_today = _now.date()
def _plus_months(d, m):
    y, mo = divmod(d.month - 1 + m, 12)
    return datetime.date(d.year + y, mo + 1, min(d.day, 28))
def _isodate(v):
    m = re.search(r"\d{4}-\d{2}-\d{2}", v or "")
    try:
        return datetime.date.fromisoformat(m.group(0)) if m else None
    except ValueError:
        return None
_bylead = {l["lead_id"]: l for l in leads}
_tax_rows = []
for r in tracker:
    t = (r.get("lead_type") or "").strip()
    x = _td.get(r["lead_id"])
    if t != "tax_delinquent_inherited" and not x:
        continue
    x = x or {}
    l = _bylead.get(r["lead_id"], {})
    dod, sale = _isodate(r.get("date_of_death")), _isodate(x.get("tax_sale_date"))
    ok_on = _plus_months(dod, _tdm) if dod and t == "tax_delinquent_inherited" else None
    days = (sale - _today).days if sale else ""
    owed = num(x.get("amount_owed"))
    stage = l.get("stage", r.get("stage", ""))
    if stage in ("Dead", "Paid"):
        status = "Closed" if stage == "Paid" else "Dropped"
    elif t == "tax_delinquent_inherited" and not dod:
        status = "On hold: date of death unknown"
    elif ok_on and ok_on > _today:
        status = f"Waiting: no letter before {ok_on.isoformat()}"
    elif sale and days < 0:
        status = "Tax-sale date passed: check redemption"
    elif sale and days <= 60:
        status = "Urgent: sale within 60 days"
    elif not x:
        status = "Taxes not checked yet"
    else:
        status = "Ready to work"
    _tax_rows.append({"lead_id": r["lead_id"], "address": l.get("address", r["address"].split(",")[0]), "city": r.get("city", ""),
                      "county": r["county"], "state": r["state"], "lead_type": t or "probate", "stage": stage,
                      "date_of_death": dod.isoformat() if dod else "", "first_letter_ok": ok_on.isoformat() if ok_on else "",
                      "years_delinquent": x.get("years_delinquent", ""), "amount_owed": int(owed) if owed is not None else "",
                      "tax_sale_date": sale.isoformat() if sale else "", "days_to_sale": days,
                      "redemption_after_sale": x.get("redemption_after_sale", "") or "unknown", "verified": x.get("verified", ""),
                      "potential_earnings": l.get("potential_earnings", ""), "status": status})
_tax_rows.sort(key=lambda r: (r["days_to_sale"] if r["days_to_sale"] != "" else 99999))
write("tax_leads.csv", ["lead_id", "address", "city", "county", "state", "lead_type", "stage", "date_of_death", "first_letter_ok",
                        "years_delinquent", "amount_owed", "tax_sale_date", "days_to_sale", "redemption_after_sale", "verified",
                        "potential_earnings", "status"], _tax_rows)
_cov_tax = {c["market_id"]: c for c in (csv.DictReader(open(os.path.join(ROOT, "pipeline", "coverage.csv")))) if c["record_type"] == "tax_status"}
_live_mk, _ = load_config_markets()
_tc = []
for m in _live_mk:
    c = _cov_tax.get(m["market"], {})
    mine = [r for r in _tax_rows if r["county"].lower() == m["county"].lower() and r["state"] == m["state"]]
    sales = sorted(r["tax_sale_date"] for r in mine if r["tax_sale_date"] and r["days_to_sale"] != "" and r["days_to_sale"] >= 0)
    _st = c.get("primary_status") or "untested"
    _tc.append({"state": m["state"], "county": m["county"], "list_source": c.get("primary_source", ""),
                "list_status": {"works": "Working", "manual_only": "Manual lookup only", "blocked": "Blocked", "broken": "Broken",
                                "none_found": "None found", "untested": "Not found yet"}.get(_st, _st),
                "leads": len(mine), "owed": int(sum(r["amount_owed"] or 0 for r in mine)), "next_sale": sales[0] if sales else ""})
write("tax_counties.csv", ["state", "county", "list_source", "list_status", "leads", "owed", "next_sale"], _tc)
_open = [r for r in _tax_rows if r["status"] not in ("Closed", "Dropped")]
write("tax_summary.csv", ["enabled", "wait_months", "leads", "owed", "urgent", "waiting", "counties_working", "counties"],
      [{"enabled": "yes" if _tdon else "no", "wait_months": _tdm, "leads": len(_open), "owed": int(sum(r["amount_owed"] or 0 for r in _open)),
        "urgent": sum(1 for r in _open if r["status"].startswith("Urgent")), "waiting": sum(1 for r in _open if r["status"].startswith(("Waiting", "On hold"))),
        "counties_working": sum(1 for c in _tc if c["list_status"] == "Working"), "counties": len(_tc)}])
_bnow = {r["buyer_id"]: r for r in _blist}   # progress made since the pairing was computed shows at once
write("lead_buyer_matches.csv", ["lead_id", "rank", "buyer_id", "buyer", "fit", "why", "status", "warmth", "standby", "ready_to_buy"],
      [{**{k: m.get(k, "") for k in ("lead_id", "rank", "buyer_id", "buyer", "fit", "why")},
        **{k: (_bnow.get(m["buyer_id"]) or m).get(k, "") for k in ("status", "warmth", "standby", "ready_to_buy")}} for m in _lm])

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

# ---- finance: monthly roll-up of the Bookkeeper's ledger ----
_ledger = []
_lp = os.path.join(ROOT, "pipeline", "ledger.csv")
if os.path.exists(_lp):
    _ledger = list(csv.DictReader(open(_lp)))
_tax_pct = float((re.search(r"tax_set_aside_pct:\s*([0-9.]+)", open(os.path.join(ROOT, "config.yaml")).read()) or [None, "0.30"])[1])
def _amt(r):
    try:
        return float(r.get("amount") or 0)
    except ValueError:
        return 0.0
_months = sorted({(r.get("date") or "")[:7] for r in _ledger if r.get("date")} | {TODAY[:7]})
_fin_rows = []
_pipeline_fees = sum(int(float(l["potential_earnings"] or 0)) for l in leads if l["is_opportunity"] == "yes")
for m in _months:
    inm = [r for r in _ledger if (r.get("date") or "").startswith(m)]
    earned = sum(_amt(r) for r in inm if r["type"] == "income" and r["status"] == "actual")
    spent = sum(_amt(r) for r in inm if r["type"] == "expense" and r["status"] == "actual")
    fc_fee = sum(_amt(r) for r in inm if r["type"] == "income" and r["status"] == "forecast")
    net = earned - spent
    _fin_rows.append({"month": m, "fees_forecast_contracted": int(fc_fee), "fees_earned": int(earned), "expenses": int(spent), "net": int(net),
                      "tax_set_aside": int(max(net, 0) * _tax_pct), "potential_in_pipeline": _pipeline_fees if m == TODAY[:7] else ""})
_escrow_out = sum(_amt(r) for r in _ledger if r["type"] == "escrow_out" and r["status"] == "actual") - sum(_amt(r) for r in _ledger if r["type"] == "escrow_back" and r["status"] == "actual")
for r in _fin_rows:
    r["earnest_money_outstanding"] = int(_escrow_out) if r["month"] == TODAY[:7] else ""
write("finance.csv", ["month", "potential_in_pipeline", "fees_forecast_contracted", "fees_earned", "expenses", "net", "tax_set_aside", "earnest_money_outstanding"], _fin_rows)
# Ledger entries for the Money page: every line the Bookkeeper recorded, newest first. Notes are left out
# (they can hold names); counterparty is a role only, and doc_ref says which document backs the entry.
_LEDGER_COLS = ["date", "lead_id", "type", "category", "amount", "status", "counterparty_role", "doc_ref"]
write("ledger.csv", _LEDGER_COLS, [{k: r.get(k, "") for k in _LEDGER_COLS} for r in sorted(_ledger, key=lambda r: r.get("date") or "", reverse=True)])

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
_outreach_mode = autonomy.get("outreach", "drafts_only")  # effective: Setup page overrides config.yaml
def W(worker, does, done, done_label, result, result_label, last, status, note=""):
    rate = f"{round(100 * result / done)}%" if done else ""
    return {"worker": worker, "does": does, "done": done, "done_label": done_label, "result": result, "result_label": result_label,
            "rate": rate, "last_active": last, "status": status, "note": note}
workers = [
    W("Source Mapper", "Finds and maintains public record sources per county", sum(1 for c in _cov if (c.get("primary_status") or "untested") != "untested"), "sources checked",
      sum(1 for c in _cov if c.get("primary_status") == "works"), "working", _last("pipeline/coverage.csv"), "Active"),
    W("Researcher", "Pulls new probate filings and confirms who owns the house", _screened, "estates screened",
      len(tracker), "leads confirmed and researched", _last("leads", "pipeline/candidates"), "Active"),
    W("Exceptions Desk", "Resolves exceptions with playbooks; escalates only owner decisions", len(_rows("pipeline/exceptions.csv")), "exceptions handled",
      sum(1 for e in _rows("pipeline/exceptions.csv") if e.get("status") == "resolved"), "resolved without the owner", _last("pipeline/exceptions.csv"),
      "Active" if _rows("pipeline/exceptions.csv") else "Not started"),
    W("Heir & Title Tracer", "Works out who holds title and who must sign", _count("leads/*/heirs.md"), "heir traces",
      _count("leads/*/heirs.md"), "completed", _last("leads/*/heirs.md"), "Active" if _count("leads/*/heirs.md") else "Not started"),
    W("Legal Counsel", "Drafts legal documents per state; litigation-risk file per deal; dispute briefs", _count("leads/*/legal-risk.md") + _count("legal/disputes/*/brief.md"), "risk files and dispute briefs",
      _count("templates/*/*") + _count("templates/*.md"), "document drafts", _last("leads/*/legal-risk.md"), "Active" if _count("leads/*/legal-risk.md") else "Not started"),
    W("Field Inspections", "Photos, condition reports and final walk-throughs", _count("leads/*/inspection-*.md"), "inspections",
      _count("leads/*/inspection-*.md"), "reports", _last("leads/*/inspection-*.md"), "Active" if _count("leads/*/inspection-*.md") else "Not started"),
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
    W("Tax & Lien Checker", "Back taxes, tax sales, liens, mortgages, code cases per lead", _count("leads/*/liens.md"), "leads checked",
      sum(1 for f in glob.glob(os.path.join(ROOT, "leads", "*", "liens.md")) if re.search(r"(?i)total known payoff", open(f).read())), "with a payoff total",
      _last("leads/*/liens.md"), "Active" if _count("leads/*/liens.md") else "Not started"),
    W("Contact Finder", "Verified mailing address for each letter's recipient", _count("leads/*/contacts.md"), "leads with contacts",
      _drafts, "letters needing an address", _last("leads/*/contacts.md"), "Active" if _count("leads/*/contacts.md") else "Not started"),
    W("Contract Desk", "Attorney-approved templates; signature-ready packets", _count("templates/*/*"), "template files",
      _count("leads/*/contract/summary.md"), "deal packets built", _last("templates", "leads/*/contract"), "Active" if _count("templates/*/*") else "Not started"),
    W("Quality Auditor", "Re-verifies a sample of each run's leads before the owner sees them", _count("leads/*/audit.md"), "leads audited",
      sum(1 for f in glob.glob(os.path.join(ROOT, "leads", "*", "audit.md")) if "FAIL" not in open(f).read()), "passed",
      _last("leads/*/audit.md"), "Active" if _count("leads/*/audit.md") else "Not started"),
    W("Bookkeeper", "Document-backed ledger, monthly roll-up, tax set-aside estimate", len(_ledger), "ledger entries",
      sum(1 for r in _ledger if r.get("status") == "actual"), "backed by a document", _last("pipeline/ledger.csv"),
      "Active" if _ledger else "Waiting: no money has moved yet"),
    W("Transaction Coordinator", "Title checks, deadlines, signature and wire queues, closing", _count("leads/*/title.md"), "title checks done",
      _closed, "closed", _last("leads/*/title.md"), "Active", f"{_contract} under contract"),
]
_ROLE_FILE = {"Source Mapper": "source-mapper.md", "Researcher": "researcher.md", "Heir & Title Tracer": "heir-tracer.md", "Exceptions Desk": "exceptions-desk.md",
    "Legal & Tax Advisor": "legal-advisor.md", "Legal Counsel": "legal-counsel.md", "Field Inspections": "field-inspections.md", "Deal Analyst": "deal-analyst.md", "Acquisitions": "acquisitions.md",
    "Compliance Officer": "compliance-officer.md", "Communications": "communications.md", "Reply Desk": "reply-desk.md",
    "Negotiator": "negotiator.md", "Buyer-List Builder": "buyer-list.md", "Dispositions": "dispositions.md",
    "Professional Network": "professional-network.md", "Tax & Lien Checker": "tax-lien-checker.md", "Contact Finder": "contact-finder.md",
    "Contract Desk": "contract-desk.md", "Quality Auditor": "quality-auditor.md", "Bookkeeper": "bookkeeper.md", "Transaction Coordinator": "transaction-coordinator.md"}
for w in workers:
    w["role_file"] = _ROLE_FILE.get(w["worker"], "")
# Lifecycle (pipeline/workers.csv, scripts/worker_lifecycle.py): trial and probation workers run in shadow mode, so the
# card shows that instead of the activity status; retired workers' role files leave agents/ and their cards say so.
_LC = {r["worker"]: r for r in _rows("pipeline/workers.csv")}
_LC_LABEL = {"trial": "Trial: shadow mode, not used yet", "probation": "Probation: shadow mode until it recovers", "retired": "Retired"}
for w in workers:
    lc = _LC.get(w["role_file"][:-3], {})
    w["lifecycle"], w["lifecycle_score"], w["lifecycle_since"] = lc.get("status", ""), lc.get("score", ""), lc.get("since", "")
    if lc.get("status") in _LC_LABEL:
        w["status"] = _LC_LABEL[lc["status"]]
        w["note"] = "; ".join(x for x in (lc.get("notes", ""), w["note"]) if x)[:220]
write("workers.csv", ["worker", "role_file", "does", "done", "done_label", "result", "result_label", "rate", "last_active", "status", "note",
                      "lifecycle", "lifecycle_score", "lifecycle_since"], workers)

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
