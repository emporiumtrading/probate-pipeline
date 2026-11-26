#!/usr/bin/env python3
"""notify.py: the only messages the owner gets under full autonomy.

Emails the owner (OWNER_NOTIFY_EMAIL) through Resend, once each, when:
  - a deal needs their signature (Sign queue), or an escrow to confirm by phone (Wire queue),
  - a title company has received the earnest money (deposit confirmed),
  - a deal closes (with its profit from the ledger's actual rows),
  - the system itself has stayed broken for 24 hours (at most once a day; owner decision 2026-11-26).
Sent notices are recorded in pipeline/owner-notices.csv so nothing repeats.
Never includes bank or wiring details. Usage: python3 runner/notify.py <dashboard-data-dir>
"""
import csv, json, os, re, sys, datetime, urllib.request

DATA = sys.argv[1] if len(sys.argv) > 1 else "/tmp/verify-data"
KEY = os.environ.get("RESEND_API_KEY", "")
TO = os.environ.get("OWNER_NOTIFY_EMAIL", "")
LOG = "pipeline/owner-notices.csv"


def rows(p):
    try:
        return list(csv.DictReader(open(p, newline="")))
    except FileNotFoundError:
        return []


def money(v):
    try:
        return float(str(v).replace("$", "").replace(",", ""))
    except ValueError:
        return 0.0


if not (KEY and TO):
    print("notify: skipped (needs RESEND_API_KEY and your notice email)")
    sys.exit(0)
cfg = open("config.yaml").read()
m = re.search(r"(?:^|\n)business:.*?\n\s+email:\s*\"?([^\"\s#]+)", cfg, re.S)
FROM = m.group(1) if m and "@" in m.group(1) else ""
if not FROM:
    print("notify: skipped (business email not set in Setup → Business identity)")
    sys.exit(0)

sent = {r["key"] for r in rows(LOG)}
tracker = {r["lead_id"]: r for r in rows("pipeline/deal-tracker.csv")}
ledger = rows("pipeline/ledger.csv")
events = []
for q in rows(os.path.join(DATA, "queues.csv")):
    if q.get("queue") == "Sign" and not q.get("decision"):
        events.append((f"sign:{q['lead_id']}:{q.get('item', '')}", f"Signature needed: {q.get('address', '')}",
                       f"{q.get('item', 'A document')} for {q.get('address', '')}, {q.get('city', '')} {q.get('state', '')} is ready for your signature."
                       + (f"\nSign here: {q['sign_url']}" if q.get("sign_url") else "\nOpen the dashboard → Sign, wire & money.")
                       + (f"\nDue: {q['due']}" if q.get("due") else "")))
    if q.get("queue") == "Wire" and not q.get("decision"):
        t = tracker.get(q["lead_id"], {})
        events.append((f"wire:{q['lead_id']}", f"Earnest money: confirm the escrow for {q.get('address', '')}",
                       f"Before any earnest money goes to {t.get('title_company') or 'the title company'}, call them at "
                       f"{t.get('title_phone') or 'the number on their official website'} and confirm their escrow account by phone. "
                       "Never use account details sent by email. Then mark it done on the dashboard → Sign, wire & money."))
for lid, t in tracker.items():
    es = t.get("earnest_status") or ""
    if re.search(r"received|confirmed", es, re.I):
        events.append((f"deposit:{lid}", f"Deposit confirmed: {t.get('address', '')}",
                       f"The earnest money ({t.get('earnest_money') or 'amount in the contract'}) for {t.get('address', '')} is confirmed: {es}."
                       f"\nTitle company: {t.get('title_company') or 'see the dashboard'}."))
    if t.get("stage") in ("Closed", "Paid"):
        mine = [r for r in ledger if r.get("lead_id") == lid and (r.get("status") or "").lower() == "actual"]
        income = sum(money(r["amount"]) for r in mine if r.get("category") in ("assignment_fee", "double_close_spread"))
        cost = sum(abs(money(r["amount"])) for r in mine if r.get("category") not in ("assignment_fee", "double_close_spread", "refund"))
        events.append((f"closed:{lid}", f"Closed: {t.get('address', '')} (profit ${income - cost:,.0f})",
                       f"{t.get('address', '')} closed. Fee received ${income:,.0f}, costs ${cost:,.0f}, profit ${income - cost:,.0f} "
                       f"(from the ledger's documented rows)."))

# The system itself (owner decision 2026-11-26): at most one email a day, only when something has stayed
# broken for 24 hours despite the automatic repairs: every run failed, or no AI engine finished a run.
health = rows("pipeline/runner-health.csv")
now = datetime.datetime.now(datetime.timezone.utc)
def _age_h(r):
    try:
        return (now - datetime.datetime.fromisoformat(r["date"].replace("Z", "+00:00"))).total_seconds() / 3600
    except (KeyError, ValueError):
        return 1e9
day = [r for r in health if _age_h(r) <= 24]
if len(day) >= 3 and any(_age_h(r) >= 20 for r in day):   # a full day's worth of runs to judge by
    failed = all(r.get("result") == "fail" or r.get("verify") == "fail" for r in day)
    no_ai = not failed and all(r.get("engine") == "scripted" for r in day if r.get("level") != "idle") \
        and any(r.get("level") != "idle" for r in day)
    if failed or no_ai:
        last = day[-1].get("notes", "")[:600]
        why = ("every run in the last 24 hours failed its checks" if failed else
               "no AI engine finished a run in the last 24 hours; the pipeline ran on its scripted backup only (new leads and checks, but no letters, negotiation or follow-ups)")
        fix = []
        if re.search(r"credit balance|billing|invalid.{0,20}api.?key|authentication", last, re.I): fix.append("Check the Claude key and its credit balance (console.anthropic.com).")
        if "free-models-per-day" in last: fix.append("OpenRouter's free daily limit is used up: add $10 of credit at openrouter.ai to raise it to 1,000 requests a day, or add an NVIDIA key.")
        if "no key" in last and "nvidia" in last: fix.append("An NVIDIA key (free at build.nvidia.com) adds a second backup engine.")
        events.append((f"system:{now.date().isoformat()}", "Your pipeline needs a look: " + ("runs are failing" if failed else "the AI engines aren't finishing"),
                       f"In short: {why}.\nThe automatic repair and the AI assistant's hourly check haven't fixed it.\n"
                       + ("What you can do: " + " ".join(fix) + "\n" if fix else "Open the dashboard → Operations → How each run went, or ask the AI assistant what's wrong.\n")
                       + f"Last run's notes: {last}"))

new = [e for e in events if e[0] not in sent]
if not os.path.exists(LOG):
    open(LOG, "w").write("date,key,subject\n")
for key, subject, body in new:
    req = urllib.request.Request("https://api.resend.com/emails", method="POST",
                                 data=json.dumps({"from": FROM, "to": [TO], "subject": subject,
                                                  "text": body + ("" if key.startswith("system:") else "\n\nThis is an automatic notice from your probate pipeline. Nothing else needs you.")}).encode(),
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "User-Agent": "probate-pipeline-runner"})
    try:
        urllib.request.urlopen(req, timeout=30).read()
        with open(LOG, "a", newline="") as f:   # written at once, so a crash can't resend it
            csv.writer(f).writerow([datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), key, subject])
        print(f"notify: sent '{subject}'")
    except Exception as e:  # not recorded, so the next run tries again
        print(f"notify: failed '{subject}': {str(e)[:120]}")
print(f"notify: {len(new)} new of {len(events)} notices")
