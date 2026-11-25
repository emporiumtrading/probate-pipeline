#!/usr/bin/env python3
"""Worker lifecycle: trial -> active -> probation -> retired, decided from measured results.

A new worker (agents/<name>.md) starts in `trial`. It runs in shadow mode: its output goes to
pipeline/trials/<name>/ and is never used (no lead moves, nothing reaches an outbound action).
The Quality Auditor scores each run against a checker. The worker is promoted to `active`
automatically once it meets the thresholds over enough runs. An active worker whose measured
performance drops goes to `probation` (shadow mode again) and, if it doesn't recover, `retired`.
Rules: references/worker-lifecycle.md. Thresholds: config.yaml -> worker_lifecycle (defaults below).

  python3 scripts/worker_lifecycle.py register <worker> [--note "..."]      # new role file -> trial
  python3 scripts/worker_lifecycle.py score <worker> --items N --checked N --agreed N \\
        --errors N --violations N --results N --evidence <file> [--mode shadow|live] [--date D]
  python3 scripts/worker_lifecycle.py evaluate [--apply]                   # slice C: score every worker, move statuses
  python3 scripts/worker_lifecycle.py promote <worker>                     # only if the thresholds are met
  python3 scripts/worker_lifecycle.py demote <worker> --reason "..." [--owner-approved]
  python3 scripts/worker_lifecycle.py list
  python3 scripts/worker_lifecycle.py check                                # QA (also run inside qa_checks.py)

Files:
  pipeline/workers.csv               registry: worker,status,since,runs,score,last_review,notes
  pipeline/worker-scores.csv         one row per worker per scored run (written with `score`)
  pipeline/worker-lifecycle-log.csv  every status change, with reason and evidence (never edited)
  pipeline/outbound-log.csv          every outbound action, with the workers whose output it used
  pipeline/trials/<worker>/          shadow output of trial and probation workers
Environment: PP_TODAY=YYYY-MM-DD overrides today's date (tests).
"""
import argparse, csv, datetime, glob, os, re, shutil, sys

ROOT = os.environ.get("PP_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AGENTS = os.path.join(ROOT, ".claude", "skills", "probate-wholesale-deal", "agents")
RETIRED_DIR = os.path.join(AGENTS, "retired")
REG = os.path.join(ROOT, "pipeline", "workers.csv")
SCORES = os.path.join(ROOT, "pipeline", "worker-scores.csv")
SCORES_REL = "pipeline/worker-scores.csv"  # evidence column: repo-relative
EVENTS = os.path.join(ROOT, "pipeline", "worker-lifecycle-log.csv")
OUTBOUND = os.path.join(ROOT, "pipeline", "outbound-log.csv")
SELF_REVIEW = os.path.join(ROOT, "pipeline", "self-review.csv")
TRIALS = os.path.join(ROOT, "pipeline", "trials")

REG_COLS = ["worker", "status", "since", "runs", "score", "last_review", "notes"]
SCORE_COLS = ["date", "worker", "mode", "items", "checked", "agreed", "errors", "violations", "results", "evidence"]
EVENT_COLS = ["date", "worker", "from_status", "to_status", "reason", "evidence"]
OUTBOUND_COLS = ["date", "lead_id", "item", "channel", "recipient_role", "produced_by", "compliance", "status", "evidence"]
STATUSES = ("trial", "active", "probation", "retired")
SHADOW = ("trial", "probation")  # these workers' output never feeds an outbound action

DEFAULTS = {
    "trial_min_runs": 5,          # scored shadow runs before a trial worker can be promoted
    "trial_max_runs": 15,         # a trial that still misses the thresholds after this many runs fails
    "min_accuracy": 0.90,         # agreed / checked against the checker (Quality Auditor or the active worker doing the same job)
    "max_error_rate": 0.05,       # errors / items
    "min_yield": 0.25,            # results / items (useful output, e.g. leads confirmed, sources that work)
    "active_window": 5,           # an active worker is judged on its last N scored live runs
    "active_min_accuracy": 0.85,  # below this over a full window -> probation
    "active_max_error_rate": 0.10,
    "probation_min_runs": 5,      # shadow runs on probation before it can return to active
    "probation_max_runs": 10,     # still failing after this many -> retired (core workers: owner decides)
    "core_workers": "compliance-officer quality-auditor exceptions-desk",  # the checkers: never retired automatically
}


class Bad(ValueError):
    pass


def today():
    return os.environ.get("PP_TODAY") or datetime.date.today().isoformat()


def settings():
    """config.yaml -> worker_lifecycle block (simple key: value lines) over the defaults. Tightening only is the rule
    for learning; the owner may change these."""
    s = dict(DEFAULTS)
    p = os.path.join(ROOT, "config.yaml")
    txt = open(p).read() if os.path.exists(p) else ""
    b = re.search(r"\nworker_lifecycle:[^\n]*\n((?:  [^\n]*\n)+)", txt)
    for k, v in re.findall(r"^  (\w+):\s*([^\n#]*)", b.group(1) if b else "", re.M):
        v = v.strip().strip('"').strip("'")
        if k in DEFAULTS:
            s[k] = type(DEFAULTS[k])(v) if not isinstance(DEFAULTS[k], str) else v
    s["core"] = set(str(s["core_workers"]).split())
    return s


def read(path, cols=None):
    if not os.path.exists(path):
        return []
    return list(csv.DictReader(open(path)))


def write(path, cols, rows):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in cols})


def append(path, cols, row):
    new = not os.path.exists(path)
    with open(path, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        if new:
            w.writeheader()
        w.writerow({c: row.get(c, "") for c in cols})


def role_files():
    return {os.path.basename(f)[:-3] for f in glob.glob(os.path.join(AGENTS, "*.md"))}


def retired_files():
    return {os.path.basename(f)[:-3] for f in glob.glob(os.path.join(RETIRED_DIR, "*.md"))}


def load():
    return read(REG)


def save(rows):
    write(REG, REG_COLS, sorted(rows, key=lambda r: (STATUSES.index(r["status"]) if r["status"] in STATUSES else 9, r["worker"])))


def find(rows, w):
    for r in rows:
        if r["worker"] == w:
            return r
    raise Bad(f"'{w}' is not in pipeline/workers.csv (register it first)")


def event(w, frm, to, reason, evidence=""):
    append(EVENTS, EVENT_COLS, {"date": today(), "worker": w, "from_status": frm, "to_status": to,
                                "reason": " ".join(str(reason).split())[:300], "evidence": evidence})


def status_on(w, date):
    """The worker's status on a given date, from the lifecycle log (for outbound checks of past actions)."""
    ev = sorted((e for e in read(EVENTS) if e["worker"] == w), key=lambda e: e["date"])
    st = None
    for e in ev:
        if e["date"] <= date:
            st = e["to_status"]
    if st is None and ev and ev[0]["from_status"] == "" and ev[0]["to_status"] == "active":
        return "active"  # existing worker, listed as active when the lifecycle started: active before that too
    return st or "unregistered"


# ---- measurements ----
def _int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


def measure(w, mode, since, last_n=None):
    rows = [r for r in read(SCORES) if r["worker"] == w and r["mode"] == mode and r["date"] >= (since or "")]
    rows.sort(key=lambda r: r["date"])
    if last_n:
        dates = sorted({r["date"] for r in rows})[-last_n:]
        rows = [r for r in rows if r["date"] in dates]
    t = {k: sum(_int(r[k]) for r in rows) for k in ("items", "checked", "agreed", "errors", "violations", "results")}
    t["runs"] = len({r["date"] for r in rows})
    t["accuracy"] = t["agreed"] / t["checked"] if t["checked"] else None
    t["error_rate"] = t["errors"] / t["items"] if t["items"] else None
    t["yield"] = t["results"] / t["items"] if t["items"] else None
    t["evidence"] = "; ".join(r["evidence"] for r in rows if _int(r["violations"]))[:200]
    t["score"] = round(100 * t["accuracy"] * (1 - (t["error_rate"] or 0))) if t["accuracy"] is not None else ""
    return t


def _nums(s):
    m = re.findall(r"\d+(?:\.\d+)?", str(s or ""))
    return [float(x) for x in m]


def calibration(w, since=""):
    """Self-review (pipeline/self-review.csv): how often actual was within 20% of the prediction (references/self-review.md)."""
    n = ok = 0
    for r in read(SELF_REVIEW):
        if r.get("worker") != w or (r.get("date") or "") < since:
            continue
        p, a = _nums(r.get("predicted")), _nums(r.get("actual"))
        if not p or not a:
            continue
        lo, hi = (p[0], p[1]) if len(p) > 1 and re.search(r"\d\s*[-–]\s*\d", str(r.get("predicted"))) else (p[0], p[0])
        n += 1
        ok += lo * 0.8 <= a[0] <= hi * 1.2 or (hi < 10 and abs(a[0] - hi) < 2)
    return n, ok


def meets(t, s, runs_needed):
    return (t["runs"] >= runs_needed and t["accuracy"] is not None and t["accuracy"] >= s["min_accuracy"]
            and (t["error_rate"] or 0) <= s["max_error_rate"] and (t["yield"] or 0) >= s["min_yield"] and not t["violations"])


def fmt(t):
    f = lambda v: "n/a" if v is None else f"{v:.0%}"
    return f"{t['runs']} runs, accuracy {f(t['accuracy'])}, errors {f(t['error_rate'])}, yield {f(t['yield'])}, violations {t['violations']}"


def decide(r, s):
    """Return (new_status or None, reason, evidence, metrics) for one registry row."""
    w, st = r["worker"], r["status"]
    if st == "trial":
        t = measure(w, "shadow", r["since"])
        if t["violations"]:
            return "retired", f"failed trial: policy violation ({fmt(t)})", t["evidence"], t
        if meets(t, s, s["trial_min_runs"]):
            return "active", f"passed trial: {fmt(t)}", SCORES_REL, t
        if t["runs"] >= s["trial_max_runs"]:
            return "retired", f"failed trial: thresholds not met after {t['runs']} runs ({fmt(t)})", SCORES_REL, t
        return None, f"in trial: {fmt(t)}", "", t
    if st == "active":
        t = measure(w, "live", r["since"], s["active_window"])
        if t["violations"]:
            return "probation", f"policy violation while active ({fmt(t)})", t["evidence"], t
        if t["runs"] >= s["active_window"] and t["accuracy"] is not None and (
                t["accuracy"] < s["active_min_accuracy"] or (t["error_rate"] or 0) > s["active_max_error_rate"]):
            return "probation", f"performance dropped over the last {t['runs']} runs ({fmt(t)})", SCORES_REL, t
        return None, (f"active: {fmt(t)}" if t["runs"] else "active: no scored runs yet"), "", t
    if st == "probation":
        t = measure(w, "shadow", r["since"])
        core = w in s["core"]
        if t["violations"]:
            if core:
                return None, f"core worker on probation with a policy violation: owner decision needed ({fmt(t)})", t["evidence"], t
            return "retired", f"policy violation on probation ({fmt(t)})", t["evidence"], t
        if meets(t, s, s["probation_min_runs"]):
            return "active", f"recovered on probation: {fmt(t)}", SCORES_REL, t
        if t["runs"] >= s["probation_max_runs"]:
            if core:
                return None, f"core worker still failing after {t['runs']} probation runs: owner decision needed ({fmt(t)})", SCORES_REL, t
            return "retired", f"did not recover after {t['runs']} probation runs ({fmt(t)})", SCORES_REL, t
        return None, f"on probation: {fmt(t)}", "", t
    return None, "retired", "", measure(w, "shadow", r["since"])


def move(r, to, reason, evidence):
    w, frm = r["worker"], r["status"]
    if to == "retired":
        src = os.path.join(AGENTS, f"{w}.md")
        if os.path.exists(src):
            os.makedirs(RETIRED_DIR, exist_ok=True)
            shutil.move(src, os.path.join(RETIRED_DIR, f"{w}.md"))
    if to in SHADOW:
        os.makedirs(os.path.join(TRIALS, w), exist_ok=True)
        keep = os.path.join(TRIALS, w, ".gitkeep")
        if not os.path.exists(keep):
            open(keep, "w").close()
    r["status"], r["since"], r["runs"], r["score"] = to, today(), "0", ""
    r["notes"] = reason[:200]
    event(w, frm, to, reason, evidence)


# ---- commands ----
def cmd_register(a):
    rows = load()
    w = a.worker
    if not re.fullmatch(r"[a-z][a-z0-9-]{1,40}", w):
        raise Bad("worker names are kebab-case, matching agents/<name>.md")
    if not os.path.exists(os.path.join(AGENTS, f"{w}.md")):
        raise Bad(f"agents/{w}.md doesn't exist: write the role file first (references/new-worker.md)")
    if any(r["worker"] == w for r in rows):
        raise Bad(f"{w} is already registered")
    r = {"worker": w, "status": "trial", "since": today(), "runs": "0", "score": "", "last_review": "", "notes": (a.note or "new worker: shadow mode")[:200]}
    rows.append(r)
    os.makedirs(os.path.join(TRIALS, w), exist_ok=True)
    open(os.path.join(TRIALS, w, ".gitkeep"), "a").close()
    save(rows)
    event(w, "", "trial", a.note or "new role file registered", f"agents/{w}.md")
    print(f"registered {w}: trial (shadow output to pipeline/trials/{w}/)")


def cmd_score(a):
    rows = load()
    r = find(rows, a.worker)
    mode = a.mode or ("shadow" if r["status"] in SHADOW else "live")
    if r["status"] == "retired":
        raise Bad(f"{a.worker} is retired")
    if (mode == "live") != (r["status"] == "active"):
        raise Bad(f"{a.worker} is {r['status']}: score it in {'live' if r['status'] == 'active' else 'shadow'} mode")
    v = {k: getattr(a, k) for k in ("items", "checked", "agreed", "errors", "violations", "results")}
    if any(x < 0 for x in v.values()):
        raise Bad("counts can't be negative")
    if v["agreed"] > v["checked"] or v["checked"] > v["items"] or v["results"] > v["items"] or v["errors"] > v["items"]:
        raise Bad("need agreed <= checked <= items, results <= items and errors <= items")
    if not (a.evidence or "").strip():
        raise Bad("--evidence is required (the audit file or trial output that backs the score)")
    if mode == "shadow" and not a.evidence.startswith(f"pipeline/trials/{a.worker}/") and not a.evidence.startswith("leads/"):
        print(f"note: shadow output normally lives in pipeline/trials/{a.worker}/")
    d = a.date or today()
    if any(x["worker"] == a.worker and x["date"] == d and x["mode"] == mode for x in read(SCORES)):
        raise Bad(f"{a.worker} already has a {mode} score for {d} (one row per worker per run; never edit old rows)")
    append(SCORES, SCORE_COLS, {"date": d, "worker": a.worker, "mode": mode, **v, "evidence": a.evidence})
    print(f"scored {a.worker} {d} ({mode}): {v}")


def cmd_evaluate(a):
    s, rows = settings(), load()
    changes = []
    for r in rows:
        if r["status"] == "retired":
            continue
        to, reason, ev, t = decide(r, s)
        was = r["status"]
        n, ok = calibration(r["worker"], r["since"] if r["status"] != "active" else "")
        cal = f"; self-review calibration {ok}/{n}" if n else ""
        if a.apply:
            r["runs"], r["score"], r["last_review"] = str(t["runs"]), str(t["score"]), today()
            r["notes"] = (reason + cal)[:200]
        if to:
            changes.append((r["worker"], r["status"], to, reason))
            if a.apply:
                move(r, to, reason, ev)
        print(f"{r['worker']:<26} {was:<10} -> {to or '(stays)':<10} {reason}{cal}")
    if a.apply:
        save(rows)
    print(f"evaluate: {len(changes)} status change(s){'' if a.apply else ' (dry run; add --apply)'}")
    for w, f, t, why in changes:
        print(f"CHANGE {w}: {f} -> {t}: {why}")


def cmd_promote(a):
    s, rows = settings(), load()
    r = find(rows, a.worker)
    if r["status"] not in SHADOW:
        raise Bad(f"{a.worker} is {r['status']}; only trial or probation workers can be promoted")
    t = measure(a.worker, "shadow", r["since"])
    need = s["trial_min_runs"] if r["status"] == "trial" else s["probation_min_runs"]
    if not meets(t, s, need):
        raise Bad(f"{a.worker} doesn't meet the thresholds yet ({fmt(t)}); promotion follows the measured results only")
    move(r, "active", f"promoted: {fmt(t)}", SCORES_REL)
    save(rows)
    print(f"{a.worker}: active")


def cmd_demote(a):
    s, rows = settings(), load()
    r = find(rows, a.worker)
    to = {"active": "probation", "probation": "retired", "trial": "retired"}.get(r["status"])
    if not to:
        raise Bad(f"{a.worker} is already retired")
    if to == "retired" and a.worker in s["core"] and not a.owner_approved:
        raise Bad(f"{a.worker} is a core checker; retiring it needs the owner (--owner-approved)")
    if not (a.reason or "").strip():
        raise Bad("--reason is required")
    move(r, to, a.reason, a.evidence or "")
    save(rows)
    print(f"{a.worker}: {to}")


def cmd_list(a):
    for r in load():
        print(f"{r['worker']:<26} {r['status']:<10} since {r['since']:<10} runs {r['runs']:<3} score {r['score'] or '-':<4} {r['notes']}")


def problems():
    """(fails, warns) for qa_checks.py: registry vs role files, and no non-active worker's output in an outbound action."""
    fails, warns = [], []
    if not os.path.exists(REG):
        return ["pipeline/workers.csv missing: run scripts/worker_lifecycle.py (references/worker-lifecycle.md)"], warns
    if open(REG).readline().strip() != ",".join(REG_COLS):
        fails.append("pipeline/workers.csv: header must be " + ",".join(REG_COLS))
    rows = load()
    names = [r["worker"] for r in rows]
    for w in {x for x in names if names.count(x) > 1}:
        fails.append(f"pipeline/workers.csv: {w} listed more than once")
    st = {r["worker"]: r["status"] for r in rows}
    files, gone = role_files(), retired_files()
    for r in rows:
        if r["status"] not in STATUSES:
            fails.append(f"pipeline/workers.csv: {r['worker']} has unknown status '{r['status']}'")
    for w in sorted(files - set(st)):
        fails.append(f"agents/{w}.md is not in pipeline/workers.csv: register it (python3 scripts/worker_lifecycle.py register {w}); new workers start in trial")
    for w, s_ in sorted(st.items()):
        if s_ == "retired" and w in files:
            fails.append(f"{w} is retired in pipeline/workers.csv but agents/{w}.md is still live (move it to agents/retired/)")
        if s_ != "retired" and w not in files:
            fails.append(f"{w} is {s_} in pipeline/workers.csv but agents/{w}.md doesn't exist")
        if s_ in SHADOW and not os.path.isdir(os.path.join(TRIALS, w)):
            warns.append(f"{w} is {s_} but pipeline/trials/{w}/ doesn't exist (its shadow output belongs there)")
    # Outbound actions: only active workers' output may feed them
    if os.path.exists(OUTBOUND):
        if open(OUTBOUND).readline().strip() != ",".join(OUTBOUND_COLS):
            fails.append("pipeline/outbound-log.csv: header must be " + ",".join(OUTBOUND_COLS))
        for i, o in enumerate(read(OUTBOUND), 2):
            prod = [x for x in re.split(r"[;\s]+", o.get("produced_by") or "") if x]
            if not prod:
                fails.append(f"outbound-log.csv line {i}: produced_by is empty (name every worker whose output this action used)")
            for w in prod:
                s_ = status_on(w, o.get("date") or today())
                if s_ != "active":
                    fails.append(f"outbound-log.csv line {i} ({o.get('lead_id')}, {o.get('item')}): uses output of {w}, which was {s_} on {o.get('date')}; only active workers feed outbound actions")
            if "pipeline/trials/" in (o.get("evidence") or ""):
                fails.append(f"outbound-log.csv line {i}: evidence points at shadow output in pipeline/trials/")
    for f in glob.glob(os.path.join(ROOT, "leads", "*", "outreach-drafts.md")) + glob.glob(os.path.join(ROOT, "leads", "*", "comms.md")) + \
            glob.glob(os.path.join(ROOT, "leads", "*", "contract", "*")):
        if os.path.isfile(f) and "pipeline/trials/" in open(f, errors="ignore").read():
            fails.append(f"{os.path.relpath(f, ROOT)} uses shadow output from pipeline/trials/ (trial output never reaches an outbound action)")
    # Handoff answers from shadow workers are not evidence for live work
    hp = os.path.join(ROOT, "pipeline", "handoffs.csv")
    for h in read(hp):
        if h.get("answered_by") and st.get(h["answered_by"]) in SHADOW and h.get("status") in ("answered", "closed"):
            warns.append(f"handoff {h['id']} was answered by {h['answered_by']} ({st[h['answered_by']]}); a shadow worker's answer must be re-checked by an active worker before use")
    return fails, warns


def cmd_check(a):
    f, w = problems()
    for x in w:
        print("WARN ", x)
    for x in f:
        print("FAIL ", x)
    print(f"worker lifecycle: {len(load())} workers, {len(f)} failures, {len(w)} warnings")
    sys.exit(1 if f else 0)


def main():
    p = argparse.ArgumentParser(description="Worker lifecycle: trial -> active -> probation -> retired")
    sp = p.add_subparsers(dest="cmd", required=True)
    x = sp.add_parser("register"); x.add_argument("worker"); x.add_argument("--note")
    x = sp.add_parser("score"); x.add_argument("worker")
    for k in ("items", "checked", "agreed", "errors", "violations", "results"):
        x.add_argument(f"--{k}", type=int, required=True)
    x.add_argument("--evidence", required=True); x.add_argument("--mode", choices=("shadow", "live")); x.add_argument("--date")
    x = sp.add_parser("evaluate"); x.add_argument("--apply", action="store_true")
    x = sp.add_parser("promote"); x.add_argument("worker")
    x = sp.add_parser("demote"); x.add_argument("worker"); x.add_argument("--reason", required=True); x.add_argument("--evidence")
    x.add_argument("--owner-approved", action="store_true")
    sp.add_parser("list"); sp.add_parser("check")
    a = p.parse_args()
    try:
        {"register": cmd_register, "score": cmd_score, "evaluate": cmd_evaluate, "promote": cmd_promote,
         "demote": cmd_demote, "list": cmd_list, "check": cmd_check}[a.cmd](a)
    except Bad as e:
        print("ERROR", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
