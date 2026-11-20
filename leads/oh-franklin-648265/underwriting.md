# Underwriting - 1534 Fall Brook Rd, Columbus OH 43223 (oh-franklin-648265)
Deal Analyst, 2026-11-20. Fee $10,000, buyer % 0.70.

ARV low/mid/high: **$260,000 / $280,000 / $295,000** (research.md)
Repairs low/mid/high: **$32,000 / $45,000 / $62,000** - GUESS (no photos). 1,414 sf x ~$23 / $32 / $44 per sf; 1968, same owner since 1975 -> kitchen, 2.5 baths, flooring, paint, HVAC/windows likely; ~10% contingency. Guess.

## deal_calc.py output (mid case)
Command: `python3 .claude/skills/probate-wholesale-deal/scripts/deal_calc.py --arv 280000 --repairs 45000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 280000,
  "repairs": 45000,
  "pct_rule": 0.7,
  "buyer_max_price": 151000,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 141000,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($252,000)      130,400     121,400     107,900
+0% ($280,000)       150,000     141,000     127,500
+10% ($308,000)      169,600     160,600     147,100
```

Buyer max (ARV x 0.70 - repairs) = **$151,000**; MAO = **$141,000**.

## Ohio price floor check (R.C. 2127.011)
Auditor value $221,100; dispensed with (entry 11/12/2026) - inventory will likely carry the auditor value. 80% of auditor value = **$176,880** (above MAO $141,000; above buyer max $151,000). The floor applies only to a consent sale (no will power of sale). If the will grants a power of sale (R.C. 2113.39), no statutory floor, but the fiduciary must still get a fair price. A court-ordered private sale needs 100% of appraisal.

## Hidden costs
Cleanout (owned since 1975 - likely a full house); occupant unknown; taxes/water/code unchecked.

## Verdict
**NEGOTIATE (target $128,000; walk at $141,000) - executor has letters, single owner, good resale comps; but six beneficiaries and an 80% consent floor (~$176,880) far above buyer max, so it only works if the 2025 will gives a power of sale.**

## Best exit if the wholesale fails
Lower fee to Dreamskey / General Capital B-type buyers paying $130k-$135k; or listing referral via licensed partner.
