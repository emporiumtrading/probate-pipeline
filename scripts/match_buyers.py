#!/usr/bin/env python3
"""Pair buyers with each live lead, before the contract is signed (owner decision 2026-11-27).

For every lead that isn't dead or walked away, rank the market's buyers by how well the house fits what they
already buy (from deed records and anything they've told us): same ZIP or city, our expected price inside
their price range, how many cash purchases they made in the last 12 months, how recently, and how far along
they are with us (vetted, warm, letter of intent, standby, ready to buy). Writes:

  pipeline/buyers/lead-matches.csv    lead_id, rank and why, for the top MATCHES buyers per lead
  pipeline/buyers/research-queue.csv  the order the Buyer-List worker researches and vets buyers: buyers
                                      paired with live leads first (most leads, best rank), then everyone else

No contact details are copied. Run by the runner before the workers start; safe to run any time.
  python3 scripts/match_buyers.py
"""
import csv, os, re
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUY = os.path.join(ROOT, "pipeline", "buyers")
MATCHES = 10
DEAD = re.compile(r"walk away|dead|closed|lost|withdrawn", re.I)
# Not end buyers for a probate house: lenders and servicers (foreclosure takebacks), government, and production builders.
NOT_BUYER = re.compile(r"\b(loan|servicing|mortgage|bank|bancorp|credit union|federal national|fannie|freddie|secretary of|hud|"
                       r"nvr|lennar|d\.?r\.? horton|pulte|taylor morrison|meritage|kb home|m/i homes|toll brothers|ryan homes)\b", re.I)


def num(v):
    try:
        return float(re.sub(r"[^\d.]", "", str(v)) or 0)
    except ValueError:
        return 0.0


def days_since(d):
    try:
        y, m, dd = map(int, str(d)[:10].split("-"))
        return (date.today() - date(y, m, dd)).days
    except Exception:
        return 9999


def market_of(lead):
    return f"{lead.get('state', '').lower()}-{lead.get('county', '').lower().replace(' ', '-')}"


def sale_price(lead):
    """What we'd expect an end buyer to pay: the dashboard's buyer price, else our offer cap plus a typical fee."""
    for k in ("buyer_max", "target_price"):
        if num(lead.get(k)):
            return num(lead[k]) + (0 if k == "buyer_max" else 10000)
    if num(lead.get("mao")):
        return num(lead["mao"]) + 10000
    return 0.7 * num(lead.get("arv_mid")) - num(lead.get("repairs_mid")) if num(lead.get("arv_mid")) else 0


def fit(lead, b):
    addr = lead.get("address", "")
    z = re.findall(r"\b(\d{5})\b", addr)
    zip_ = z[-1] if z else ""
    city = (lead.get("city") or (addr.split(",")[1] if addr.count(",") >= 2 else "")).strip().lower()
    areas = (b.get("areas", "") + " " + b.get("city", "")).lower()
    why, pts = [], 0.0
    if zip_ and zip_ in areas:
        pts += 30; why.append(f"buys in ZIP {zip_}")
    elif city and re.search(r"\b" + re.escape(city) + r"\b", areas):
        pts += 22; why.append(f"buys in {city.title()}")
    else:
        pts += 5; why.append("buys elsewhere in the county")
    price = sale_price(lead)
    lo, hi = num(b.get("price_min")), num(b.get("price_max"))
    if price and hi:
        if lo * 0.8 <= price <= hi * 1.15:
            pts += 25; why.append(f"~${price:,.0f} is inside their ${lo:,.0f}-${hi:,.0f} range")
        elif price < lo * 0.8:
            pts += 5; why.append("below their usual price")
        else:
            return None, ""          # far above what they've ever paid: not a match
    n = num(b.get("purchases_12m"))
    pts += min(n, 30) * 0.7
    if n:
        why.append(f"{int(n)} cash buys in 12 months")
    ds = days_since(b.get("last_purchase_date"))
    pts += 10 if ds <= 30 else 6 if ds <= 90 else 2 if ds <= 180 else 0
    stage = {"standby": 25, "vetted": 15}.get("standby" if b.get("standby") == "yes" else b.get("status", ""), 0)
    if b.get("ready_to_buy") == "yes":
        stage += 10
    if b.get("warmth") in ("warm", "hot"):
        stage += 6
    pts += stage
    if b.get("end_buyer") == "wholesaler":
        pts -= 20; why.append("wholesaler")
    if b.get("red_flags") and b.get("red_flags") not in ("none", "-"):
        pts -= 30; why.append("red flags")
    return pts, "; ".join(why)


def main():
    leads = [l for l in csv.DictReader(open(os.path.join(ROOT, "pipeline", "deal-tracker.csv")))
             if not DEAD.search(l.get("stage", "") + " " + l.get("next_action", "")) and l.get("dnc_or_stop", "").lower() not in ("yes", "stop")]
    buyers = [b for b in csv.DictReader(open(os.path.join(BUY, "buyers.csv"))) if b.get("stop", "").lower() != "yes" and not NOT_BUYER.search(b.get("name", ""))]
    rows, demand = [], {}
    for l in leads:
        mk = market_of(l)
        scored = []
        for b in buyers:
            if b.get("market_id") != mk:
                continue
            pts, why = fit(l, b)
            if pts is not None:
                scored.append((pts, b, why))
        scored.sort(key=lambda x: -x[0])
        for i, (pts, b, why) in enumerate(scored[:MATCHES], 1):
            rows.append({"lead_id": l["lead_id"], "rank": i, "buyer_id": b["buyer_id"], "buyer": b["name"], "fit": round(pts),
                         "why": why, "status": b.get("status", ""), "warmth": b.get("warmth", ""), "standby": b.get("standby", ""),
                         "ready_to_buy": b.get("ready_to_buy", ""), "lead_stage": l.get("stage", "")})
            d = demand.setdefault(b["buyer_id"], [0, 99, []])
            d[0] += 1; d[1] = min(d[1], i); d[2].append(l["lead_id"])
    cols = ["lead_id", "rank", "buyer_id", "buyer", "fit", "why", "status", "warmth", "standby", "ready_to_buy", "lead_stage"]
    with open(os.path.join(BUY, "lead-matches.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
    # Research order: paired buyers not yet vetted first, then the rest by their own score.
    done = lambda b: b.get("status") in ("vetted", "standby") or b.get("osint_status") == "done"
    q = []
    for b in buyers:
        if done(b):
            continue
        d = demand.get(b["buyer_id"])
        pr = (0, -d[0], d[1]) if d else (1, 0, -num(b.get("score")) - num(b.get("purchases_12m")))
        q.append((pr, b, d))
    q.sort(key=lambda x: x[0])
    with open(os.path.join(BUY, "research-queue.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["order", "buyer_id", "buyer", "market_id", "paired_leads", "best_rank", "lead_ids", "next_step"])
        for i, (pr, b, d) in enumerate(q, 1):
            nxt = ("entity check" if not b.get("entity_status") else "cash check" if not b.get("cash_verified") else
                   "public research (osint)" if not b.get("osint_status") else "introduction")
            w.writerow([i, b["buyer_id"], b["name"], b.get("market_id", ""), d[0] if d else 0, d[1] if d else "",
                        " ".join(d[2][:8]) if d else "", nxt])
    paired = len(demand)
    print(f"match_buyers: {len(leads)} live leads, {len(rows)} pairings, {paired} distinct buyers paired; "
          f"research queue {len(q)} (paired first)")


if __name__ == "__main__":
    main()
