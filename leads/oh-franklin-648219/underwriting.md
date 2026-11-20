# Underwriting - 2652 Diane Pl, Columbus OH 43207 (oh-franklin-648219)
Deal Analyst, 2026-11-20. Fee $10,000, buyer % 0.70.

ARV low/mid/high: **$205,000 / $225,000 / $240,000** (research.md)
Repairs low/mid/high: **$32,000 / $45,000 / $60,000** - GUESS (no photos). 1,468 sf x ~$22 / $31 / $41 per sf; 1973 bi-level/ranch held since 1993 -> two baths, kitchen, flooring, paint, mechanicals likely; ~10% contingency. Guess (no photos).

## deal_calc.py output (mid case)
Command: `python3 .claude/skills/probate-wholesale-deal/scripts/deal_calc.py --arv 225000 --repairs 45000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 225000,
  "repairs": 45000,
  "pct_rule": 0.7,
  "buyer_max_price": 112500,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 102500,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($202,500)       95,750      86,750      73,250
+0% ($225,000)       111,500     102,500      89,000
+10% ($247,500)      127,250     118,250     104,750
```

Buyer max (ARV x 0.70 - repairs) = **$112,500**; MAO = **$102,500**.

## Ohio price floor check (R.C. 2127.011)
Auditor value $137,000; not dispensed - inventory (and any appraisal) still to be filed. 80% of auditor value = **$109,600** (above MAO $102,500; below buyer max $112,500). The floor applies only to a consent sale (no will power of sale). If the will grants a power of sale (R.C. 2113.39), no statutory floor, but the fiduciary must still get a fair price. A court-ordered private sale needs 100% of appraisal.

## Hidden costs
Cleanout; possible occupant; taxes/water/code unchecked; court-consent filing time if no power of sale.

## Verdict
**NEGOTIATE (target $95,000; walk at $102,500) - executor has letters and the creditor period is over, single owner; thin comps and an 80% consent floor (~$109,600 on auditor value) above MAO unless the 1994 will gives a power of sale.**

## Best exit if the wholesale fails
Lower fee to Vitebsk LLC / Here Is Your Home LLC-type buyers paying $120k-$126k for similar houses; or walk.
