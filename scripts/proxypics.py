#!/usr/bin/env python3
"""ProxyPics: nationwide photos and property condition data for the Field Inspections worker (owner decision 2026-11-27).

The key is PROXYPICS_API_KEY (a Render setting saved from the Setup page; never in git or the database).

  python3 scripts/proxypics.py templates                 # the account's order packages (read-only)
  python3 scripts/proxypics.py order --lead <lead_id> --template <id> [--appointment] [--notes "..."] [--report-for "..."]
  python3 scripts/proxypics.py status                    # refresh every open order; save finished reports and photos

Guardrails:
  - An order is placed only for a package whose price is known and at most autonomy.field_inspection_fee_max
    (pipeline/proxypics-prices.csv: learned from each order's reported cost, or entered by the owner).
    A package with no known price goes to the Exceptions Desk first: nothing is ordered.
  - Never the "direct" platform: that texts the property owner automatically, and the system never texts anyone.
  - The address comes from the lead's tracker row; notes must not carry names, phone numbers or emails.
  - Every order is logged in pipeline/field-inspections.csv and the Bookkeeper's ledger picks it up.
"""
import csv, json, os, re, sys, urllib.request, urllib.error
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.proxypics.com/api/v3"
LOG = os.path.join(ROOT, "pipeline", "field-inspections.csv")
PRICES = os.path.join(ROOT, "pipeline", "proxypics-prices.csv")
LOG_COLS = ["date", "lead_id", "order_id", "template_id", "template", "status", "cost_usd", "report", "notes"]


def key():
    k = os.environ.get("PROXYPICS_API_KEY", "")
    if not k:
        sys.exit("proxypics: no PROXYPICS_API_KEY on this run (Setup page → Sending and signing services)")
    return k


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"x-api-key": key(), "Accept": "application/json", "Content-Type": "application/json",
                                          "User-Agent": "probate-pipeline"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"proxypics: {method} {path.split('?')[0]} answered {e.code}: {e.read()[:300].decode(errors='replace')}")


def cfg_num(name):
    m = re.search(rf"(?m)^  {name}:\s*([\d.]+)", open(os.path.join(ROOT, "config.yaml")).read())
    return float(m.group(1)) if m else None


def rows(path, cols):
    return list(csv.DictReader(open(path))) if os.path.exists(path) else []


def write(path, cols, data):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(data)


def prices():
    return {r["template_id"]: r for r in rows(PRICES, None)}


def learn_price(tid, name, usd, source):
    p = prices()
    p[str(tid)] = {"template_id": str(tid), "template": name, "price_usd": f"{usd:.2f}", "source": source, "on": date.today().isoformat()}
    write(PRICES, ["template_id", "template", "price_usd", "source", "on"], sorted(p.values(), key=lambda r: int(r["template_id"])))


def templates():
    t = call("GET", "/photo-request-templates")
    pr = prices()
    for x in t:
        p = pr.get(str(x["id"]), {}).get("price_usd", "price unknown")
        print(f'{x["id"]:>6} | {x["name"][:80]} | {len(x.get("tasks") or [])} tasks | {x.get("photo_request_platform")} | {p}')
    return t


def order(args):
    a = dict(zip(args[::2], args[1::2]))
    lead, tid = a.get("--lead"), a.get("--template")
    if not lead or not tid:
        sys.exit("usage: order --lead <lead_id> --template <id> [--notes ...] [--report-for ...] [--appointment yes]")
    cfgtxt = open(os.path.join(ROOT, "config.yaml")).read()
    if not re.search(r"(?m)^  field_inspections:\s*true", cfgtxt):
        sys.exit("proxypics: channels.field_inspections is off; nothing ordered")
    limit = cfg_num("field_inspection_fee_max")
    price = prices().get(str(tid))
    if limit is None:
        sys.exit("proxypics: no autonomy.field_inspection_fee_max; nothing ordered (Exceptions Desk)")
    if not price:
        sys.exit(f"proxypics: package {tid} has no known price yet; hand it to the Exceptions Desk to confirm the price in the ProxyPics account. Nothing ordered.")
    if float(price["price_usd"]) > limit:
        sys.exit(f"proxypics: package {tid} costs ${price['price_usd']}, above the ${limit:.0f} limit; Exceptions Desk. Nothing ordered.")
    tr = next((r for r in csv.DictReader(open(os.path.join(ROOT, "pipeline", "deal-tracker.csv"))) if r["lead_id"] == lead), None)
    if not tr:
        sys.exit(f"proxypics: no lead {lead}")
    notes = a.get("--notes", "")
    if re.search(r"@|\d{3}[^\d]{0,2}\d{3}[^\d]?\d{4}", notes):
        sys.exit("proxypics: notes must not contain emails or phone numbers")
    t = next((x for x in call("GET", "/photo-request-templates") if str(x["id"]) == str(tid)), None)
    if not t:
        sys.exit(f"proxypics: package {tid} not in this account")
    if t.get("photo_request_platform") == "direct":
        sys.exit("proxypics: 'direct' packages text the property owner; the system never texts anyone. Nothing ordered.")
    body = {"address": tr["address"], "template_token": t.get("token") or t.get("template_token") or str(t["id"]),
            "external_id": lead, "additional_notes": notes[:900], "report_for": a.get("--report-for", "Emporium Investments"),
            "appointment": a.get("--appointment", "no") == "yes"}
    r = call("POST", "/photo-requests", body)
    cost = (r.get("cost") or 0) / 100
    log = rows(LOG, LOG_COLS)
    log.append({"date": date.today().isoformat(), "lead_id": lead, "order_id": r.get("id"), "template_id": tid, "template": t["name"][:80],
                "status": r.get("status", ""), "cost_usd": f"{cost:.2f}", "report": "", "notes": notes[:200]})
    write(LOG, LOG_COLS, log)
    if cost:
        learn_price(tid, t["name"][:80], cost, f"order {r.get('id')}")
    print(f"proxypics: ordered {r.get('id')} for {lead} ({t['name'][:50]}), status {r.get('status')}, cost ${cost:.2f}")


def status():
    log = rows(LOG, LOG_COLS)
    open_ = [r for r in log if r["status"] not in ("fulfilled", "completed", "approved", "canceled", "cancelled", "expired")]
    for r in open_:
        x = call("GET", f"/photo-requests/{r['order_id']}")
        r["status"] = x.get("status", r["status"])
        if x.get("cost"):
            r["cost_usd"] = f"{x['cost'] / 100:.2f}"
            learn_price(r["template_id"], r["template"], x["cost"] / 100, f"order {r['order_id']}")
        rep, zipu = x.get("download_report_url"), x.get("download_photos_url") or x.get("download_url")
        if rep or zipu:
            d = os.path.join(ROOT, "workcache", "field-inspections", r["lead_id"]); os.makedirs(d, exist_ok=True)
            for url, fn in ((rep, f"proxypics-{r['order_id']}.pdf"), (zipu, f"proxypics-{r['order_id']}-photos.zip")):
                if url:
                    try:
                        urllib.request.urlretrieve(url, os.path.join(d, fn))
                    except Exception as e:
                        print(f"proxypics: download failed for {fn}: {e}")
            md = os.path.join(ROOT, "leads", r["lead_id"], f"inspection-{(x.get('completed_at') or date.today().isoformat())[:10]}-proxypics.md")
            if not os.path.exists(md):
                tasks = "\n".join(f"- {t.get('title')}: {(t.get('description') or '')[:120]}" for t in (x.get("tasks") or []))
                open(md, "w").write(f"# ProxyPics order {r['order_id']} ({r['template']})\n\nStatus: {x.get('status')} · completed {x.get('completed_at') or '—'} · cost ${r['cost_usd']}\n"
                                    f"Report PDF and photos ZIP: workcache/field-inspections/{r['lead_id']}/ (kept in the database's work cache, not in git).\n\n"
                                    f"## Tasks requested\n{tasks}\n\n## Condition notes (Field Inspections fills these from the report)\n- \n")
                r["report"] = os.path.relpath(md, ROOT)
        print(f"proxypics: {r['order_id']} {r['lead_id']} → {r['status']}")
    write(LOG, LOG_COLS, log)
    print(f"proxypics: {len(open_)} open orders checked")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "templates":
        templates()
    elif cmd == "order":
        order(sys.argv[2:])
    elif cmd == "status":
        status()
    else:
        print(__doc__)
