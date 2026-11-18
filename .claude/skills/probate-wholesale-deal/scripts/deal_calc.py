#!/usr/bin/env python3
"""Wholesale deal calculator: buyer max price, MAO, spread, and red flags.

Example:
  python deal_calc.py --arv 183000 --repairs 45000 --fee 10000 --asking 40000
  python deal_calc.py --arv 183000 --sqft 1200 --repair-per-sqft 35 --fee 10000 --pct 0.7
"""
import argparse
import json


def calc(arv, repairs, fee, pct=0.70, asking=None, closing_pct=0.0):
    buyer_max = arv * pct - repairs
    closing = arv * closing_pct
    mao = buyer_max - fee - closing
    out = {
        "arv": round(arv),
        "repairs": round(repairs),
        "pct_rule": pct,
        "buyer_max_price": round(buyer_max),
        "assignment_fee": round(fee),
        "your_closing_costs": round(closing),
        "max_offer_to_seller": round(mao),
        "flags": [],
    }
    flags = out["flags"]
    if mao <= 0:
        flags.append("Deal does not work: MAO is zero or negative.")
    if fee > 0.10 * arv:
        flags.append("Fee is over 10% of ARV; most cash buyers will balk.")
    if asking is not None:
        out["asking"] = round(asking)
        out["room_vs_asking"] = round(mao - asking)
        if asking < 0.30 * arv:
            flags.append("Asking is under 30% of ARV: verify data, condition, title and liens before trusting it.")
        if asking > mao:
            flags.append("Asking is above your MAO: negotiate down, cut the fee, or walk.")
    if repairs == 0:
        flags.append("Repairs are $0: almost never true for probate homes; get an estimate.")
    return out


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--arv", type=float, required=True, help="After-repair value from sold comps")
    p.add_argument("--repairs", type=float, help="Repair estimate in dollars")
    p.add_argument("--sqft", type=float, help="Square feet (with --repair-per-sqft)")
    p.add_argument("--repair-per-sqft", type=float, help="Repair $/sqft guess, e.g. 20 light, 35 medium, 60+ heavy")
    p.add_argument("--fee", type=float, default=10000, help="Your assignment fee (default 10000)")
    p.add_argument("--pct", type=float, default=0.70, help="Buyer's percent-of-ARV rule (default 0.70)")
    p.add_argument("--asking", type=float, help="Seller asking / listed price")
    p.add_argument("--closing-pct", type=float, default=0.0, help="Your own closing costs as share of ARV (double close), e.g. 0.02")
    p.add_argument("--sensitivity", action="store_true", help="Also print MAO across ARV -10/0/+10%% and repairs -20/0/+30%%")
    a = p.parse_args()
    if a.repairs is None:
        if a.sqft and a.repair_per_sqft:
            a.repairs = a.sqft * a.repair_per_sqft
        else:
            p.error("give --repairs, or --sqft and --repair-per-sqft")
    print(json.dumps(calc(a.arv, a.repairs, a.fee, a.pct, a.asking, a.closing_pct), indent=2))
    if a.sensitivity:
        rep_mult = [0.8, 1.0, 1.3]
        print("\nMAO sensitivity (rows: ARV change, cols: repairs change)")
        print("ARV \\ repairs".ljust(16) + "".join(f"{m:>+12.0%}".replace("+-", "-") for m in [x - 1 for x in rep_mult]))
        for am in [0.9, 1.0, 1.1]:
            row = [calc(a.arv * am, a.repairs * rm, a.fee, a.pct, None, a.closing_pct)["max_offer_to_seller"] for rm in rep_mult]
            print(f"{am - 1:+.0%} (${a.arv * am:,.0f})".ljust(16) + "".join(f"{v:>12,}" for v in row))


if __name__ == "__main__":
    main()
