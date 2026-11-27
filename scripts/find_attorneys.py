#!/usr/bin/env python3
"""Find attorney candidates for every live market (owner request 2026-11-27: the system sources attorneys itself).

Searches the Law.AI lawyer directory (https://mcp.law.ai, a free public MCP server with 991K+ US lawyer profiles) for
active probate and real-estate attorneys in each live market's city and state, plus the next two markets in the
expansion queue, and adds new ones to pipeline/attorney-candidates.csv as `candidate`. Needs no AI and no key, so the
runner can do it every day even when the AI engines are out of credit.

It never verifies, contacts or chooses anyone: the Professional Network still checks each candidate on the state
bar's own public lookup (bar number, active, no discipline) before `verified`, and only verified attorneys are asked
for quotes. The directory doesn't return bar numbers, emails or phones, and we don't copy any contact details from it;
those come only from the bar listing or the firm's own website (agents/professional-network.md).

  python3 scripts/find_attorneys.py            # all live markets + next two in the queue
  python3 scripts/find_attorneys.py fl-hillsborough
"""
import csv
import datetime
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV = os.path.join(ROOT, "pipeline", "attorney-candidates.csv")
COLS = ["market", "state", "name", "firm", "bar_number", "bar_verified_on", "focus", "score", "status", "quote", "email",
        "phone_source", "source", "updated", "notes"]
ENDPOINT = "https://mcp.law.ai"
AREAS = ("Probate", "Real Estate", "Estate Planning")
PER_MARKET = 8          # keep the list short: the best few are checked on the bar lookup
TODAY = datetime.date.today().isoformat()


def call(tool, args, rid=[0]):
    rid[0] += 1
    body = json.dumps({"jsonrpc": "2.0", "id": rid[0], "method": "tools/call", "params": {"name": tool, "arguments": args}}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream",
                                                               "User-Agent": "pipeline-attorney-sourcing/1.0"})
    with urllib.request.urlopen(req, timeout=40) as r:
        raw = r.read().decode("utf8", "replace")
    data = next((l[6:] for l in raw.splitlines() if l.startswith("data: ")), raw)
    res = json.loads(data).get("result") or {}
    return "\n".join(c.get("text", "") for c in res.get("content", []))


def parse(text):
    """The directory answers in markdown: '1. **Name**' then 'Practice Areas:', 'Location:', 'Firm:', 'Profile:' lines."""
    out, cur = [], None
    for line in text.splitlines():
        m = re.match(r"\s*\d+\.\s+\*\*(.+?)\*\*", line)
        if m:
            cur = {"name": m.group(1).strip()}
            out.append(cur)
            continue
        if cur is None:
            continue
        for key, field in (("Practice Areas:", "areas"), ("Location:", "location"), ("Firm:", "firm"), ("Profile:", "profile")):
            if line.strip().startswith(key):
                cur[field] = line.strip()[len(key):].strip()
    return out


def markets():
    txt = open(os.path.join(ROOT, "config.yaml")).read()
    live_part, _, queue_part = txt.partition("\nexpansion_queue")
    live = []
    for blk in live_part.split("\n  - id: ")[1:]:
        mid, _, b = blk.partition("\n")
        st = re.search(r"\n?    state: (\w+)", "\n" + b)
        if st:
            live.append({"market": mid.strip(), "state": st.group(1), "city": (re.search(r"    city: ([^\n#]+)", b) or [0, ""])[1].strip()})
    nxt = []
    for q in re.findall(r"\n  - (\{[^}]+\})", queue_part):
        d = dict((k, v.strip()) for k, v in re.findall(r"(\w+): ([^,}]+)", q))
        if d.get("status", "queued") not in ("blocked",) and d.get("state") and d.get("county"):
            nxt.append({"market": f"{d['state'].lower()}-{d['county'].lower().replace(' ', '-')}", "state": d["state"], "city": d.get("city", "")})
        if len(nxt) >= 2:
            break
    return live + nxt


NOT_A_LAW_PRACTICE = re.compile(r"(?i)\b(capital|realty|properties|investments?|holdings|intellectual property|patent|real estate group|solutions)\b")


def score(c):
    """Directory fit only (0-50), not the Professional Network's 100-point score, which needs replies and quotes."""
    a = (c.get("areas") or "").lower()
    if NOT_A_LAW_PRACTICE.search(c.get("firm") or "") or not re.search(r"probate|real estate|estate planning", a):
        return 0
    s = 0
    s += 20 if "probate" in a else 0
    s += 20 if "real estate" in a else 0
    s += 5 if "estate planning" in a else 0
    s += 5 if "litigation" not in a or "probate" in a else 0
    return s


def main(only=None):
    rows = list(csv.DictReader(open(CSV))) if os.path.exists(CSV) else []
    have = {(r["state"], r["name"].lower()) for r in rows}
    added = []
    for m in markets():
        if only and m["market"] != only:
            continue
        if sum(1 for r in rows if r["market"] == m["market"]) >= PER_MARKET:
            continue
        found = {}
        for area in AREAS:
            for city in ([m["city"]] if m["city"] else []) + [""]:
                args = {"practice_area": area, "state": m["state"], "limit": 25}   # its bar_status filter returns nothing; the bar lookup checks status
                if city:
                    args["city"] = city
                try:
                    for c in parse(call("search_lawyers", args)):
                        found.setdefault(c["name"].lower(), c)
                except Exception as e:   # the directory is down or changed: say so, change nothing
                    print(f"find_attorneys: {m['market']} {area}: {type(e).__name__}")
                if len(found) >= 25:
                    break
        ranked = [c for c in sorted(found.values(), key=lambda c: (-score(c), c["name"])) if score(c) >= 20]
        room = PER_MARKET - sum(1 for r in rows if r["market"] == m["market"])
        for c in ranked:
            if room <= 0:
                break
            if (m["state"], c["name"].lower()) in have:
                continue
            row = {k: "" for k in COLS}
            row.update(market=m["market"], state=m["state"], name=c["name"], firm=c.get("firm", ""), focus=c.get("areas", "")[:160],
                       score="", status="candidate", source=c.get("profile", "law.ai directory"), updated=TODAY,
                       notes=f"Found in the Law.AI directory ({c.get('location', '')}; directory fit {score(c)}/50); bar status not yet checked on the {m['state']} bar's lookup")
            rows.append(row)
            have.add((m["state"], c["name"].lower()))
            added.append(row)
            room -= 1
    with open(CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    by = {}
    for r in added:
        by[r["market"]] = by.get(r["market"], 0) + 1
    print("find_attorneys: added " + (", ".join(f"{k} {v}" for k, v in by.items()) or "none (lists already full)"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
