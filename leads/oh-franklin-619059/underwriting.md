# Underwriting — 809 Bulen Ave, Columbus OH 43205 (oh-franklin-619059)
Deal Analyst, 2026-11-19. Fee $10,000, buyer % 0.70 (config).

ARV low/mid/high: **$190,000 / $205,000 / $225,000** (see research.md)
Repairs low/mid/high: **$35,000 / $45,000 / $65,000** — GUESS (no photos). 1,000 sf × ~$35 / $45 / $65 per sf; 1941 house, likely vacant since 2022 → assume roof/mechanical risk, kitchen, bath, flooring, paint, plus vacancy damage; ~10–15% contingency.

## deal_calc.py output (mid case)
Command: `python3 scripts/deal_calc.py --arv 205000 --repairs 45000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 205000,
  "repairs": 45000,
  "pct_rule": 0.7,
  "buyer_max_price": 98500,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 88500,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($184,500)       83,150      74,150      60,650
+0% ($205,000)        97,500      88,500      75,000
+10% ($225,500)      111,850     102,850      89,350
```

## Price floor
- **If the house is sold by the estate under R.C. 2127.011 consents:** price ≥ 80% of the inventory appraisal. If that equals auditor value: 80% × $137,600 = **$110,080 — above our mid MAO $88,500** and above the best case in the table except ARV +10% with light repairs ($111,850). That route likely kills the deal.
- **If sold by a successor trustee:** no statutory 80% floor, but the trustee owes beneficiaries a fair price.

## Hidden costs
Vacancy: code orders, boarding, water shut-off/freeze damage, vacant-home insurance; cleanout; back taxes/water (unknown); months of delay while counsel sorts trust vs. estate.

## Verdict
**NEGOTIATE (target ≤ $88,500; open ~$82,000) — authority unresolved, low odds.** Spread exists on paper (ARV $205k), but a near-twin sold to an investor at $106,500 two weeks ago, so competition pays more than our MAO; and an estate consent sale would need ≥ ~$110k. Worth one letter to counsel to learn the path; don't chase.

## Best exit if the wholesale fails
Lower fee to $5k for a trustee sale; refer to listing agent; or walk.
