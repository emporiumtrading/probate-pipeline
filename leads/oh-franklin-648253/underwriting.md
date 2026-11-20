# Underwriting - 3687 Mexico Ave, Westerville OH 43081 (oh-franklin-648253)
Deal Analyst, 2026-11-20. Fee $10,000, buyer % 0.70.

ARV low/mid/high: **$300,000 / $335,000 / $355,000** (research.md)
Repairs low/mid/high: **$45,000 / $60,000 / $80,000** - GUESS (no photos). 2,052 sf x ~$22 / $29 / $39 per sf; 1963, held since 1996 -> kitchen, 2.5 baths, flooring, paint, HVAC likely; ~10% contingency. Guess.

## deal_calc.py output (mid case)
Command: `python3 .claude/skills/probate-wholesale-deal/scripts/deal_calc.py --arv 335000 --repairs 60000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 335000,
  "repairs": 60000,
  "pct_rule": 0.7,
  "buyer_max_price": 174500,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 164500,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($301,500)      153,050     141,050     123,050
+0% ($335,000)       176,500     164,500     146,500
+10% ($368,500)      199,950     187,950     169,950
```

Buyer max (ARV x 0.70 - repairs) = **$174,500**; MAO = **$164,500**.

## Ohio price floor check (R.C. 2127.011)
Auditor value $256,800; not dispensed - inventory/appraisal still to be filed. 80% of auditor value = **$205,440** (above MAO $164,500; above buyer max $174,500). The floor applies only to a consent sale (no will power of sale). If the will grants a power of sale (R.C. 2113.39), no statutory floor, but the fiduciary must still get a fair price. A court-ordered private sale needs 100% of appraisal.

## Hidden costs
Mortgage payments during probate; cleanout; taxes paid through escrow (unverified).

## Verdict
**WALK AWAY - MAO $164,500 sits far below what investors already pay for this model as-is ($200k-$227.5k) and below the 80% consent floor (~$205,440); likely mortgage (tax bill to CoreLogic) and no letters yet.**

## Best exit if the wholesale fails
None at our numbers; local investors already pay above MAO.
