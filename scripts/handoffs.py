#!/usr/bin/env python3
"""Team handoff board: how workers ask each other questions, request work and flag blockers.

One shared board, pipeline/handoffs.csv. Workers never edit it by hand; they use this script.
Any worker with a role file in agents/ can send and receive, including workers added later
(the list of workers is read from agents/*.md every time), plus "owner" for things only the owner can answer.

  python3 scripts/handoffs.py add --from negotiator --to researcher --lead oh-franklin-648122 \\
      --kind question --ask "Is anyone living in the house? The seller's attorney says vacant." [--priority urgent] [--needed-by 2026-11-23]
  python3 scripts/handoffs.py list --for researcher            # open items for one worker, oldest and urgent first
  python3 scripts/handoffs.py answer --id H-0007 --by researcher --answer "Occupied: utility on, car in drive (2026-11-21 street view)" \\
      --evidence leads/oh-franklin-648122/research.md
  python3 scripts/handoffs.py reassign --id H-0007 --by researcher --to heir-tracer --why "Needs an heir search"
  python3 scripts/handoffs.py close --id H-0007 --by negotiator  # the asker confirms the answer is enough
  python3 scripts/handoffs.py reopen --id H-0007 --by negotiator --why "Answer doesn't cover the tenant"
  python3 scripts/handoffs.py sweep                             # once per run: escalate what waited too long
  python3 scripts/handoffs.py check                             # QA

Kinds: question (needs an answer with evidence), request (do a piece of work), blocker (the lead may not move
forward until it is answered), fyi (no answer needed; closed on add). Rules: no sending to yourself; a handoff
that moves between workers 3 times, or stays open past its deadline, is escalated to the owner's report;
never put bank details, card numbers, passwords or keys in a handoff.
"""
import argparse, csv, datetime, glob, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "pipeline", "handoffs.csv")
AGENTS = os.path.join(ROOT, ".claude", "skills", "probate-wholesale-deal", "agents")
COLS = ["id", "created", "from_worker", "to_worker", "lead_id", "kind", "priority", "ask", "needed_by", "status",
        "answer", "answered_by", "answered_on", "evidence", "hops", "history"]
KINDS = ("question", "request", "blocker", "fyi")
STATUSES = ("open", "answered", "closed", "escalated")
MAX_HOPS = 3
DEFAULT_DAYS = {"urgent": 0, "normal": 1}  # days to answer if no --needed-by (0 = by the end of the same day)
BANNED = [re.compile(r"(?<![\d-])\d{9,19}(?![\d-])"),
          re.compile(r"\b(routing|aba|iban|swift|bic|account\s*(no|number|#)|acct|password|api[\s_-]?key|secret|token)\b", re.I)]


class Bad(ValueError):
    pass


def today():
    return os.environ.get("PP_TODAY") or datetime.date.today().isoformat()


def workers():
    """Every worker with a role file, plus the owner and Hermes (the orchestrator, hermes/SOUL.md:
    it assigns work to the workers and answers what they send it; it has no owner powers here).
    New workers join automatically."""
    return {os.path.basename(f)[:-3] for f in glob.glob(os.path.join(AGENTS, "*.md"))} | {"owner", "hermes"}


def leads():
    p = os.path.join(ROOT, "pipeline", "deal-tracker.csv")
    return {r["lead_id"] for r in csv.DictReader(open(p))} if os.path.exists(p) else set()


def load():
    if not os.path.exists(PATH):
        return []
    return list(csv.DictReader(open(PATH)))


def save(rows):
    with open(PATH, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in COLS})


def clean_text(s, what, required=True, limit=600):
    s = " ".join(str(s or "").split())
    if required and not s:
        raise Bad(f"{what} is required")
    if len(s) > limit:
        raise Bad(f"{what} is longer than {limit} characters; put details in the lead's files and point to them")
    if any(rx.search(s) for rx in BANNED):
        raise Bad(f"{what} looks like bank details or a secret; that never goes on the board")
    return s


def who(name, role):
    if name not in workers():
        raise Bad(f"{role} '{name}' is not a worker (agents/<name>.md) or 'owner'")
    return name


def find(rows, hid):
    for r in rows:
        if r["id"] == hid:
            return r
    raise Bad(f"no handoff {hid}")


def log(r, text):
    r["history"] = (r.get("history", "") + f" | {today()} {text}").strip(" |")


def due(r):
    return r.get("needed_by") or today()


def overdue(r, on=None):
    return r["status"] == "open" and due(r) < (on or today())


def cmd_add(a, rows):
    frm, to = who(a.frm, "--from"), who(a.to, "--to")
    if frm == to:
        raise Bad("a worker can't hand off to itself")
    if a.kind not in KINDS:
        raise Bad(f"--kind must be one of {', '.join(KINDS)}")
    lead = a.lead or "general"
    if lead != "general" and lead not in leads() and not re.fullmatch(r"[a-z]{2}-[a-z0-9-]+", lead):
        raise Bad(f"--lead '{lead}' is not in the tracker or a market id")
    pr = a.priority or "normal"
    if pr not in DEFAULT_DAYS:
        raise Bad("--priority must be urgent or normal")
    nb = a.needed_by or (datetime.date.fromisoformat(today()) + datetime.timedelta(days=DEFAULT_DAYS[pr])).isoformat()
    if not re.fullmatch(r"\d{4}-\d\d-\d\d", nb):
        raise Bad("--needed-by must be YYYY-MM-DD")
    ask = clean_text(a.ask, "--ask")
    dup = [r for r in rows if r["status"] == "open" and r["to_worker"] == to and r["lead_id"] == lead and r["ask"].lower() == ask.lower()]
    if dup:
        print(f"already open as {dup[0]['id']}; not added again")
        return
    n = max([int(r["id"][2:]) for r in rows if re.fullmatch(r"H-\d+", r["id"])] or [0]) + 1
    r = {"id": f"H-{n:04d}", "created": today(), "from_worker": frm, "to_worker": to, "lead_id": lead, "kind": a.kind,
         "priority": pr, "ask": ask, "needed_by": nb, "status": "closed" if a.kind == "fyi" else "open", "hops": "0", "history": ""}
    log(r, f"{frm} → {to}: {a.kind}")
    rows.append(r)
    print(f"added {r['id']} for {to} (due {nb})")


def cmd_list(a, rows):
    me = who(a.for_, "--for")
    mine = [r for r in rows if r["to_worker"] == me and r["status"] in ("open", "escalated")]
    mine.sort(key=lambda r: (r["priority"] != "urgent", r["kind"] != "blocker", due(r), r["id"]))
    if not mine:
        print(f"no open handoffs for {me}")
    for r in mine:
        flag = " OVERDUE" if overdue(r) else ""
        print(f"{r['id']} [{r['priority']} {r['kind']}{flag}] from {r['from_worker']} on {r['lead_id']} (due {due(r)}): {r['ask']}")
    asked = [r for r in rows if r["from_worker"] == me and r["status"] == "answered"]
    for r in asked:
        print(f"{r['id']} ANSWERED for you by {r['answered_by']}: {r['answer']} (close it, or reopen with --why)")


def cmd_answer(a, rows):
    r = find(rows, a.id)
    by = who(a.by, "--by")
    if r["status"] not in ("open", "escalated"):
        raise Bad(f"{r['id']} is {r['status']}, not open")
    if by not in (r["to_worker"], "owner"):
        raise Bad(f"{r['id']} is for {r['to_worker']}; reassign it instead of answering for someone else")
    r["answer"] = clean_text(a.answer, "--answer")
    r["evidence"] = clean_text(a.evidence, "--evidence", required=r["kind"] in ("question", "blocker"), limit=300)
    r.update(status="answered", answered_by=by, answered_on=today())
    log(r, f"answered by {by}")
    print(f"{r['id']} answered")


def cmd_reassign(a, rows):
    r = find(rows, a.id)
    by, to = who(a.by, "--by"), who(a.to, "--to")
    if r["status"] not in ("open", "escalated"):
        raise Bad(f"{r['id']} is {r['status']}")
    if to in (r["to_worker"], r["from_worker"]) and to != "owner":
        raise Bad("reassign to a different worker than the current one and the asker")
    why = clean_text(a.why, "--why", limit=300)
    r["hops"] = str(int(r.get("hops") or 0) + 1)
    r["to_worker"] = to
    log(r, f"{by} reassigned to {to}: {why}")
    if int(r["hops"]) >= MAX_HOPS and to != "owner":
        r["status"] = "escalated"
        log(r, f"escalated: moved {r['hops']} times")
    print(f"{r['id']} now with {to}" + (" (escalated)" if r["status"] == "escalated" else ""))


def cmd_close(a, rows):
    r = find(rows, a.id)
    by = who(a.by, "--by")
    if by not in (r["from_worker"], "owner", "quality-auditor"):
        raise Bad("only the asker, the Quality Auditor or the owner closes a handoff")
    if r["status"] != "answered" and by != "owner":
        raise Bad(f"{r['id']} is {r['status']}; it can be closed once answered")
    r["status"] = "closed"
    log(r, f"closed by {by}")
    print(f"{r['id']} closed")


def cmd_reopen(a, rows):
    r = find(rows, a.id)
    by = who(a.by, "--by")
    if by not in (r["from_worker"], "owner", "quality-auditor") or r["status"] != "answered":
        raise Bad("only the asker (or the Quality Auditor / owner) reopens an answered handoff")
    r["status"] = "open"
    r["needed_by"] = today()
    log(r, f"reopened by {by}: {clean_text(a.why, '--why', limit=300)}")
    print(f"{r['id']} reopened")


def cmd_sweep(a, rows):
    n = 0
    for r in rows:
        if r["status"] == "open" and r["to_worker"] not in workers():
            r["status"] = "escalated"; log(r, f"escalated: {r['to_worker']} no longer exists"); n += 1
        elif r["status"] == "open" and overdue(r):
            r["status"] = "escalated"; log(r, "escalated: past its deadline"); n += 1
    print(f"sweep: {n} escalated to the owner's report; "
          f"{sum(1 for r in rows if r['status'] == 'open')} open, {sum(1 for r in rows if r['status'] == 'escalated')} escalated")


def problems(rows):
    out, ids, W = [], set(), workers()
    # Retired workers (agents/retired/, scripts/worker_lifecycle.py) keep their past items; they can't receive new ones.
    W_PAST = W | {os.path.basename(f)[:-3] for f in glob.glob(os.path.join(AGENTS, "retired", "*.md"))}
    for r in rows:
        if r["id"] in ids:
            out.append(f"{r['id']}: duplicate id")
        ids.add(r["id"])
        if r["status"] not in STATUSES or r["kind"] not in KINDS:
            out.append(f"{r['id']}: bad status or kind")
        if r["from_worker"] not in W_PAST:
            out.append(f"{r['id']}: from '{r['from_worker']}' is not a worker")
        if r["status"] == "open" and r["to_worker"] not in W:
            out.append(f"{r['id']}: open for '{r['to_worker']}', which has no role file; reassign it")
        if r["from_worker"] == r["to_worker"]:
            out.append(f"{r['id']}: sent to itself")
        if r["status"] == "answered" and (not r["answer"] or not r["answered_by"] or (r["kind"] in ("question", "blocker") and not r["evidence"])):
            out.append(f"{r['id']}: answered without an answer, who answered, or evidence")
        for f in ("ask", "answer", "evidence", "history"):
            if any(rx.search(r.get(f, "") or "") for rx in BANNED):
                out.append(f"{r['id']}: {f} looks like bank details or a secret")
    return out


def open_blockers(rows):
    return {r["lead_id"] for r in rows if r["kind"] == "blocker" and r["status"] in ("open", "escalated")}


def main():
    p = argparse.ArgumentParser(description="Team handoff board")
    sp = p.add_subparsers(dest="cmd", required=True)
    x = sp.add_parser("add"); x.add_argument("--from", dest="frm", required=True); x.add_argument("--to", required=True)
    x.add_argument("--lead"); x.add_argument("--kind", required=True); x.add_argument("--ask", required=True)
    x.add_argument("--priority"); x.add_argument("--needed-by")
    x = sp.add_parser("list"); x.add_argument("--for", dest="for_", required=True)
    x = sp.add_parser("answer"); x.add_argument("--id", required=True); x.add_argument("--by", required=True)
    x.add_argument("--answer", required=True); x.add_argument("--evidence", default="")
    x = sp.add_parser("reassign"); x.add_argument("--id", required=True); x.add_argument("--by", required=True)
    x.add_argument("--to", required=True); x.add_argument("--why", required=True)
    x = sp.add_parser("close"); x.add_argument("--id", required=True); x.add_argument("--by", required=True)
    x = sp.add_parser("reopen"); x.add_argument("--id", required=True); x.add_argument("--by", required=True); x.add_argument("--why", required=True)
    sp.add_parser("sweep"); sp.add_parser("check")
    a = p.parse_args()
    rows = load()
    try:
        if a.cmd == "check":
            bad = problems(rows)
            for b in bad:
                print("FAIL", b)
            print(f"handoffs: {len(rows)} on the board, {len(bad)} problems")
            sys.exit(1 if bad else 0)
        {"add": cmd_add, "list": cmd_list, "answer": cmd_answer, "reassign": cmd_reassign, "close": cmd_close,
         "reopen": cmd_reopen, "sweep": cmd_sweep}[a.cmd](a, rows)
    except Bad as e:
        print("REFUSED", e)
        sys.exit(1)
    if a.cmd not in ("list",):
        save(rows)


if __name__ == "__main__":
    main()
