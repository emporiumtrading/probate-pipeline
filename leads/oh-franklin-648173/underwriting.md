# Underwriting — 8872 Crestridge Ct, Galloway OH 43119 (Prairie Twp)
Deal Analyst | 2026-11-19
ARV low/mid/high: **$285,000 / $305,000 / $325,000** | Repairs low/mid/high: **$30,000 / $45,000 / $65,000** ($/sf guess, 1,490 sf; no photos)

## deal_calc (mid case)
`python3 scripts/deal_calc.py --arv 305000 --repairs 45000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 305000,
  "repairs": 45000,
  "pct_rule": 0.7,
  "buyer_max_price": 168500,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 158500,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($274,500)      146,150     137,150     123,650
+0% ($305,000)       167,500     158,500     145,000
+10% ($335,500)      188,850     179,850     166,350
```
**MAO (mid) $158,500** | sensitivity **$123,650 – $188,850**.

## Reality checks
- Investors already pay $190k–$200k as-is in this subdivision — above our MAO.
- MAO = 66% of auditor value ($238,800); 2127.011 floor $191,040 (intestate → no will power of sale; consent route or court sale needed if the house is in the estate at all).
- Seller is a surviving spouse/co-owner likely living in the home.

## Verdict
**WALK AWAY** — surviving spouse co-owns and likely lives there (house may not even be an estate asset), no will power of sale (80% floor $191k > MAO), and local investors already pay more than our MAO.
Best exit if circumstances change: none for wholesale; a listing agent referral (licensed) if she ever wants to sell.
