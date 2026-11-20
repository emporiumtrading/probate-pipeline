# Underwriting - 1441 Chelmsford Ct, Columbus OH 43229 (oh-franklin-648255)
Deal Analyst, 2026-11-20. Fee $10,000, buyer % 0.70.

ARV low/mid/high: **$245,000 / $265,000 / $290,000** (research.md)
Repairs low/mid/high: **$25,000 / $35,000 / $50,000** - GUESS (no photos). 918 sf x ~$27 / $38 / $54 per sf; 1963 ranch held since 1996 -> kitchen, bath, flooring, paint, mechanicals; ~10% contingency. Guess.

## deal_calc.py output (mid case)
Command: `python3 .claude/skills/probate-wholesale-deal/scripts/deal_calc.py --arv 265000 --repairs 35000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 265000,
  "repairs": 35000,
  "pct_rule": 0.7,
  "buyer_max_price": 150500,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 140500,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($238,500)      128,950     121,950     111,450
+0% ($265,000)       147,500     140,500     130,000
+10% ($291,500)      166,050     159,050     148,550
```

Buyer max (ARV x 0.70 - repairs) = **$150,500**; MAO = **$140,500**.

## Ohio price floor check (R.C. 2127.011)
Auditor value $195,200; application to dispense filed 10/27/2026 (pending) - inventory likely at auditor value. 80% of auditor value = **$156,160** (above MAO $140,500; above buyer max $150,500). The floor applies only to a consent sale (no will power of sale). If the will grants a power of sale (R.C. 2113.39), no statutory floor, but the fiduciary must still get a fair price. A court-ordered private sale needs 100% of appraisal.

## Hidden costs
Cleanout; occupant unknown; taxes/water/code unchecked; wait for letters (est. Dec 2026).

## Verdict
**NEGOTIATE (target $128,000; walk at $140,500) - strong retail comps and investor buys at $146k-$170k, single owner; but no letters yet, and the 80% consent floor (~$156,160) is above buyer max unless the 2026 will gives a power of sale.**

## Best exit if the wholesale fails
Lower fee to Columbus Real Estate Enterprises / ETG Holdings-type buyers ($146k-$170k); or listing referral via licensed partner.
