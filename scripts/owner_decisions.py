#!/usr/bin/env python3
"""Owner decisions made on the dashboard (Messages popup and Your queues).

The page saves one document per lead and queue in the dashboard's own store:
  data/users/<owner id>/decisions/outreach/<lead_id>   {decision: approved | changes | rejected, note, at}
  data/users/<owner id>/decisions/sign/<lead_id>       {decision: done | hold, note, at}
  data/users/<owner id>/decisions/wire/<lead_id>       {decision: done | hold, note, at}
Each run the runner lists those collections (db_list), saves each output to a file, and imports them:

  python3 scripts/owner_decisions.py import <outreach|sign|wire> <db_list output file>
  python3 scripts/owner_decisions.py check

That writes pipeline/owner-decisions.csv (commit it). A decision is the owner's instruction, not an action:
the Compliance Officer's gate, the contact caps and the hard limits still apply before anything is sent.
"""
import csv, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "pipeline", "owner-decisions.csv")
COLS = ["queue", "lead_id", "decision", "note", "at", "applied"]
ALLOWED = {"outreach": ("approved", "changes", "rejected"), "sign": ("done", "hold"), "wire": ("done", "hold"), "exceptions": ("a", "b", "c", "other")}
BANNED = [re.compile(r"(?<![\d-])\d{9,19}(?![\d-])"),
          re.compile(r"\b(routing|aba|iban|swift|bic|account\s*(no|number|#)|acct|password|api[\s_-]?key|secret|token)\b", re.I)]


class Refused(ValueError):
    pass


def clean(queue, lead_id, d):
    if queue not in ALLOWED:
        raise Refused(f"unknown queue {queue}")
    if not re.fullmatch(r"[a-z]{2}-[a-z0-9-]+", lead_id or ""):
        raise Refused(f"{queue}/{lead_id}: not a lead id")
    dec = str(d.get("decision", ""))
    if dec not in ALLOWED[queue]:
        raise Refused(f"{queue}/{lead_id}: decision must be one of {', '.join(ALLOWED[queue])}")
    note = " ".join(str(d.get("note", "") or "").split())[:500]
    if any(rx.search(note) for rx in BANNED):
        raise Refused(f"{queue}/{lead_id}: the note looks like bank details or a secret; it is never stored")
    if queue == "exceptions" and dec == "other" and not note:
        raise Refused(f"{queue}/{lead_id}: 'other' needs a note saying what to do")
    if queue == "outreach" and dec == "changes" and not note:
        raise Refused(f"{queue}/{lead_id}: 'changes' needs a note saying what to change")
    at = str(d.get("at", ""))[:25]
    return {"queue": queue, "lead_id": lead_id, "decision": dec, "note": note, "at": at}


def parse(text):
    docs = {}
    try:  # db_list's raw {"docs": [...]} envelope (one JSON document)
        j = json.loads(text)
        if isinstance(j, dict) and isinstance(j.get("docs"), list):
            return {d["id"]: d["data"] for d in j["docs"] if isinstance(d, dict) and "id" in d and isinstance(d.get("data"), dict)}
    except ValueError:
        pass
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                o = json.loads(line)
            except ValueError:
                continue
            if "id" in o and isinstance(o.get("data"), dict):
                docs[o["id"]] = o["data"]
    return docs


def load():
    """{(queue, lead_id): row} of the latest decision per lead and queue."""
    if not os.path.exists(OUT):
        return {}
    out = {}
    for r in csv.DictReader(open(OUT)):
        out[(r["queue"], r["lead_id"])] = {**clean(r["queue"], r["lead_id"], r), "applied": r.get("applied", "")}
    return out


def main():
    if len(sys.argv) >= 4 and sys.argv[1] == "import":
        queue, path = sys.argv[2], sys.argv[3]
        cur = load()
        bad = 0
        for lead_id, d in parse(open(path).read()).items():
            try:
                row = clean(queue, lead_id, d)
            except Refused as e:
                print("REFUSED", e); bad += 1; continue
            old = cur.get((queue, lead_id))
            # a new or changed decision is not applied yet; the runner sets applied=<date> once it has acted on it
            row["applied"] = old["applied"] if old and old["decision"] == row["decision"] and old["at"] == row["at"] else ""
            cur[(queue, lead_id)] = row
        with open(OUT, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=COLS); w.writeheader()
            for k in sorted(cur):
                w.writerow(cur[k])
        print(f"owner decisions: {sum(1 for k in cur if k[0] == queue)} {queue} decisions in pipeline/owner-decisions.csv; "
              f"{sum(1 for k, v in cur.items() if k[0] == queue and not v['applied'])} not applied yet")
        sys.exit(1 if bad else 0)
    if len(sys.argv) >= 2 and sys.argv[1] == "check":
        try:
            print(f"owner decisions OK: {len(load())}")
        except Refused as e:
            print("FAIL", e); sys.exit(1)
        return
    print(__doc__); sys.exit(2)


if __name__ == "__main__":
    main()
