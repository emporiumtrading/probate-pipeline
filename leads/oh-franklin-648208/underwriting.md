# Underwriting - 735 Maurine Dr, Columbus OH 43228 (oh-franklin-648208)
Deal Analyst, 2026-11-20. Fee $10,000, buyer % 0.70.

ARV low/mid/high: **$225,000 / $240,000 / $255,000** (research.md)
Repairs low/mid/high: **$25,000 / $35,000 / $50,000** - GUESS (no photos). 944 sf x ~$26 / $37 / $53 per sf; 1961 ranch held since 2004 -> kitchen, bath, flooring, paint, likely furnace/water heater; ~10% contingency.

## deal_calc.py output (mid case)
Command: `python3 .claude/skills/probate-wholesale-deal/scripts/deal_calc.py --arv 240000 --repairs 35000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 240000,
  "repairs": 35000,
  "pct_rule": 0.7,
  "buyer_max_price": 133000,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 123000,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($216,000)      113,200     106,200      95,700
+0% ($240,000)       130,000     123,000     112,500
+10% ($264,000)      146,800     139,800     129,300
```

Buyer max (ARV x 0.70 - repairs) = **$133,000**; MAO = **$123,000**.

## Ohio price floor check (R.C. 2127.011)
Auditor value $163,700; dispensed with (entry 11/13/2026) - inventory will likely carry the auditor value. 80% of auditor value = **$130,960** (above MAO $123,000; below buyer max $133,000). The floor applies only to a consent sale (no will power of sale). If the will grants a power of sale (R.C. 2113.39), no statutory floor, but the fiduciary must still get a fair price. A court-ordered private sale needs 100% of appraisal.

## Hidden costs
Cleanout; possible occupant; taxes/water/code unchecked; holding through the creditor period (ends 2026-12-14).

## Verdict
**NEGOTIATE (target $112,000; walk at $123,000) - executor has letters, single owner, deep investor demand at $130k-$137k as-is; only works if the 2023 will gives a power of sale (80% consent floor ~$130,960 is above MAO).**

## Best exit if the wholesale fails
Lower fee ($5k) to one of the 43228 LLC buyers paying $130k-$137k as-is; or listing referral via a licensed partner.
