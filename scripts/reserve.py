#!/usr/bin/env python3
"""reserve.py: the earnest-money reserve (config.yaml → earnest_money).

  total     = reserve_start + reserve_refill_profit_share × profit of each closed deal − earnest money forfeited
  committed = earnest money in deals still open (agreed, wired or received, not yet applied at closing or refunded)
  available = total − committed

The reserve is an accounting limit, not an account: the system never moves money.
The owner pays each deposit through the title company after confirming its escrow by phone.

Usage: python3 scripts/reserve.py            -> JSON summary
       python3 scripts/reserve.py --fits 500 -> exit 0 if $500 fits in what's available, else 1
"""
import csv, json, re, sys

ROOT_CFG = open("config.yaml").read()


def cfg(key, default):
    m = re.search(rf"\nearnest_money:.*?\n\s+{key}:\s*([0-9.]+)", ROOT_CFG, re.S)
    return float(m.group(1)) if m else default


def money(v):
    try:
        return float(str(v).replace("$", "").replace(",", "") or 0)
    except ValueError:
        return 0.0


def rows(p):
    try:
        return list(csv.DictReader(open(p, newline="")))
    except FileNotFoundError:
        return []


start, share = cfg("reserve_start", 1000), cfg("reserve_refill_profit_share", 0.25)
tracker, ledger = rows("pipeline/deal-tracker.csv"), rows("pipeline/ledger.csv")
INCOME = ("assignment_fee", "double_close_spread")

refill = forfeited = committed = 0.0
open_deals = []
for t in tracker:
    lid, st, es = t.get("lead_id"), t.get("stage", ""), (t.get("earnest_status") or "").lower()
    em = money(t.get("earnest_money"))
    if st in ("Closed", "Paid"):
        mine = [r for r in ledger if r.get("lead_id") == lid and (r.get("status") or "").lower() == "actual"]
        profit = sum(money(r["amount"]) for r in mine if r.get("category") in INCOME) - \
            sum(abs(money(r["amount"])) for r in mine if r.get("category") not in INCOME + ("refund",))
        refill += max(profit, 0) * share
    elif "forfeit" in es:
        forfeited += em
    elif em and re.search(r"agreed|wired|received|confirmed|due", es) and st != "Dead":
        committed += em
        open_deals.append({"lead_id": lid, "earnest": em, "status": t.get("earnest_status")})

total = start + refill - forfeited
out = {"start": start, "refill_from_profit": round(refill, 2), "forfeited": forfeited, "total": round(total, 2),
       "committed": committed, "available": round(total - committed, 2), "open_deposits": open_deals}
if len(sys.argv) > 2 and sys.argv[1] == "--fits":
    need = money(sys.argv[2])
    ok = need <= out["available"]
    print(f"reserve: ${need:,.0f} {'fits' if ok else 'does NOT fit'} (available ${out['available']:,.0f} of ${out['total']:,.0f})")
    sys.exit(0 if ok else 1)
print(json.dumps(out, indent=2))
