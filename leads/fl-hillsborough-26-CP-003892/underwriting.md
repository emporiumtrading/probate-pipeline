## Underwriting — 1709 E Annie St, Tampa FL 33612
Deal Analyst, 2026-11-20. Buyer % 0.70 (pipeline default; no Hillsborough buyer has confirmed a number yet). Fee $10,000.

ARV low/mid/high: $210,000 / $230,000 / $250,000 — Small 2/1 renovations nearby resell $205k-$305k ($270-330/sf): 1801 E Annie (744 sf, same block) $219.9k; 816-sf 2/1s at $220k-$249.9k. Subject 748 sf at ~$307/sf = $230k mid.
Repairs low/mid/high: $25,000 / $35,000 / $50,000 — **guess** (no photos): ~$33-67/sf on 748 sf (small houses cost more per sf); 1959 house last updated ~1992.

### deal_calc.py (mid case)
```
python3 deal_calc.py --arv 230000 --repairs 35000 --fee 10000 --pct 0.70 --sensitivity
{
  "arv": 230000,
  "repairs": 35000,
  "pct_rule": 0.7,
  "buyer_max_price": 126000,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 116000,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($207,000)      106,900      99,900      89,400
+0% ($230,000)       123,000     116,000     105,500
+10% ($253,000)      139,100     132,100     121,600
```
Buyer max $126,000 | Fee $10,000 | MAO $116,000 | MAO range $89,400 – $139,100

PAO just value $120,453 vs. MAO $116,000: MAO is 96% of assessed value - expect pushback.

Hidden costs: cleanout ($2-5k), utilities/insurance on a vacant house, Florida doc stamps on the deed (0.70%, seller-paid by custom), any back taxes/tax certificates, code liens, occupant move-out time, court timing (summary/homestead order or sale authorization 1-3 months).

Verdict: **NEGOTIATE (target price $100,000)** — low priority: the petitioner lives in the house and may be the surviving spouse (if so, drop); otherwise a 17-year-old estate being cleaned up, small 2/1 on a street with many investor buyers.

Best exit if wholesale fails: lower the fee to $5k; or refer the heirs to a listing agent (no referral fee unless licensed — see legal/FL.md); or walk away.
