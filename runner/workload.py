#!/usr/bin/env python3
"""workload.py: measure what is waiting before a run, so the runner can pick
the engine and model (see run.mjs). Prints one JSON object. Reads only.

Usage: python3 runner/workload.py <slice>
"""
import csv, glob, hashlib, json, os, re, sys, datetime

SLICE = sys.argv[1] if len(sys.argv) > 1 else "a"
today = datetime.date.today().isoformat()


def rows(p):
    try:
        return list(csv.DictReader(open(p, newline="")))
    except FileNotFoundError:
        return []


hand = [r for r in rows("pipeline/handoffs.csv") if (r.get("status") or "") in ("open", "escalated")]
# Items for the owner are the owner's; they don't make a run heavier.
work = [r for r in hand if r.get("to_worker") != "owner"]

applied = {(r.get("queue"), r.get("lead_id")) for r in rows("pipeline/owner-decisions.csv") if (r.get("applied") or "").strip()}
pending = 0
for q in ("outreach", "sign", "wire", "exceptions"):
    try:
        docs = json.load(open(f"store/import/{q}.json")).get("docs", [])
    except (FileNotFoundError, ValueError):
        docs = []
    pending += sum(1 for d in docs if (q, d.get("id")) not in applied)

inbox = [p for p in glob.glob("pipeline/inbox/*") if os.path.isfile(p) and not p.endswith("README.md")]

health = rows("pipeline/runner-health.csv")
recent = health[-4:]
# "fallback" (AI provider down, the no-AI run finished the job) isn't a code problem to repair.
failed_recent = [r for r in recent if r.get("result") == "fail" or r.get("verify") == "fail"]

broken_sources = 0
try:
    for line in open("pipeline/sources-log.md"):
        if line.startswith(f"| {today}") and re.search(r"\|\s*(blocked|changed layout|error|failed)", line, re.I):
            broken_sources += 1
except FileNotFoundError:
    pass

# State rules still unknown (legal/state-rules.csv; owner request 2026-11-27): shown in the run's notes so the
# report and Hermes can see the Legal Advisor's backlog. It doesn't change the level: slices A and B are already heavy.
rules_gaps = sum(1 for r in rows("legal/state-rules.csv") if "unknown" in r.values() or r.get("rules_status") == "not_started")

out = {
    "slice": SLICE,
    "handoffs": len(work),
    "urgent": sum(1 for r in work if r.get("priority") == "urgent"),
    "blockers": sum(1 for r in work if r.get("kind") == "blocker"),
    "escalated": sum(1 for r in work if r.get("status") == "escalated"),
    "negotiation": sum(1 for r in work if r.get("to_worker") in ("negotiator", "contract-desk", "closing-desk")),
    "decisions": pending,
    "inbox": len(inbox),
    "failedRecent": len(failed_recent),
    "brokenSources": broken_sources,
    "stateRulesGaps": rules_gaps,
}
# light: routine; heavy: deep-dives, negotiation, repairs, or a big queue.
heavy = (SLICE in ("a", "b") or out["negotiation"] or out["urgent"] or out["escalated"] or out["inbox"]
         or out["failedRecent"] or out["brokenSources"] or out["handoffs"] + out["decisions"] > 6)
# The fast desk also stays idle when the board is exactly as its last run left it.
out["board"] = hashlib.sha1("|".join(sorted(f"{r.get('id')}:{r.get('status')}:{r.get('hops')}" for r in work)).encode()).hexdigest()[:10]
last_fd = next((r for r in reversed(health) if r.get("slice") == "fast-desk"), {})
# Only if that run's AI actually worked the board: a run that fell back to the scripted engine left the
# work undone, so the same board still needs an AI engine.
unchanged = f"board:{out['board']}" in (last_fd.get("notes") or "") and last_fd.get("result") == "ok" \
    and last_fd.get("engine") != "scripted"
idle = SLICE == "fast-desk" and not (out["decisions"] or out["inbox"] or out["failedRecent"]) and (not out["handoffs"] or unchanged)
out["level"] = "idle" if idle else ("heavy" if heavy else "light")
out["repair"] = bool(out["failedRecent"] or out["brokenSources"])
print(json.dumps(out))
