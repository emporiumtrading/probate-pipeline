## Underwriting — 518 Terrace Hill Dr, Temple Terrace FL 33617
Deal Analyst, 2026-11-20. Buyer % 0.70 (pipeline default; no Hillsborough buyer has confirmed a number yet). Fee $10,000.

ARV low/mid/high: $375,000 / $395,000 / $420,000 — Terrace Hill/Rollingview sales $386k-$430k for 1,770-2,000 sf; 3/2s of 1,535-1,633 sf sold $375k-$400k ($244-245/sf). Subject at ~$253/sf renovated = $395k mid.
Repairs low/mid/high: $35,000 / $50,000 / $70,000 — **guess** (no photos): ~$22-45/sf on 1,561 sf; 1974 house last updated ~2000; elderly owner -> assume dated systems, cleanout.

### deal_calc.py (mid case)
```
python3 deal_calc.py --arv 395000 --repairs 50000 --fee 10000 --pct 0.70 --sensitivity
{
  "arv": 395000,
  "repairs": 50000,
  "pct_rule": 0.7,
  "buyer_max_price": 226500,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 216500,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($355,500)      198,850     188,850     173,850
+0% ($395,000)       226,500     216,500     201,500
+10% ($434,500)      254,150     244,150     229,150
```
Buyer max $226,500 | Fee $10,000 | MAO $216,500 | MAO range $173,850 – $254,150

PAO just value $292,529 vs. MAO $216,500: MAO is 74% of assessed value - expect pushback.

Hidden costs: cleanout ($2-5k), utilities/insurance on a vacant house, Florida doc stamps on the deed (0.70%, seller-paid by custom), any back taxes/tax certificates, code liens, occupant move-out time, court timing (summary/homestead order or sale authorization 1-3 months).

Verdict: **NEGOTIATE (target price $187,500)** — two sons (one out of state in SC) inherit a likely-vacant 1974 3/2 on a 0.31-ac lot in Temple Terrace; renovated nearby 3/2s sell $375k-$400k.

Best exit if wholesale fails: lower the fee to $5k; or refer the heirs to a listing agent (no referral fee unless licensed — see legal/FL.md); or walk away.
