# Underwriting — 2335 Gavinley Way Unit 54, Columbus OH 43220 (condo)
Deal Analyst | 2026-11-19
ARV low/mid/high: **$225,000 / $245,000 / $265,000** | Repairs low/mid/high: **$15,000 / $25,000 / $35,000** (cosmetic condo update guess, 1,296 sf; no photos)

## deal_calc (mid case)
`python3 scripts/deal_calc.py --arv 245000 --repairs 25000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 245000,
  "repairs": 25000,
  "pct_rule": 0.7,
  "buyer_max_price": 146500,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 136500,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($220,500)      124,350     119,350     111,850
+0% ($245,000)       141,500     136,500     129,000
+10% ($269,500)      158,650     153,650     146,150
```
**MAO (mid) $136,500** | sensitivity **$111,850 – $158,650**.

## Reality checks
- MAO = 72% of auditor ($190,500); 2127.011 floor $152,400.
- Condo with HOA dues, likely open mortgage; the end-buyer pool for condo flips at 70% is thin; an owner-occupant retail sale is the natural exit and nets the estate far more.
- Hidden costs: HOA dues + any special assessment, condo rental restrictions (kills landlord buyers), mortgage interest.

## Verdict
**WALK AWAY** — thin wholesale buyer pool for condos, MAO below the likely 80% floor, letters not issued, both owners deceased and an open mortgage likely. Retail listing is the better exit for the estate.
