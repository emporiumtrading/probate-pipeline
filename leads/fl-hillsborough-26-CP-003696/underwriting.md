## Underwriting — 7111 Flounder Dr, Tampa FL 33617
Deal Analyst, 2026-11-20. Buyer % 0.70 (pipeline default; no Hillsborough buyer has confirmed a number yet). Fee $10,000.

ARV low/mid/high: $330,000 / $355,000 / $380,000 — Renovated Del Rio Estates sales run $258-$359/sf; most 1,100-1,500 sf 3-4 bed renovations sold $354k-$385k. Subject is a 2/2 (fewer beds than most comps) - $355k mid (~$270/sf).
Repairs low/mid/high: $35,000 / $50,000 / $70,000 — **guess** (no photos): ~$27-53/sf on 1,312 sf; 1959 block house last updated ~1992; four occupants -> assume dated kitchen/baths and cleanout.

### deal_calc.py (mid case)
```
python3 deal_calc.py --arv 355000 --repairs 50000 --fee 10000 --pct 0.70 --sensitivity
{
  "arv": 355000,
  "repairs": 50000,
  "pct_rule": 0.7,
  "buyer_max_price": 198500,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 188500,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($319,500)      173,650     163,650     148,650
+0% ($355,000)       198,500     188,500     173,500
+10% ($390,500)      223,350     213,350     198,350
```
Buyer max $198,500 | Fee $10,000 | MAO $188,500 | MAO range $148,650 – $223,350

PAO just value $184,325 vs. MAO $188,500: MAO is 102% of assessed value.

Hidden costs: cleanout ($2-5k), utilities/insurance on a vacant house, Florida doc stamps on the deed (0.70%, seller-paid by custom), any back taxes/tax certificates, code liens, occupant move-out time, court timing (summary/homestead order or sale authorization 1-3 months).

Verdict: **NEGOTIATE (target price $162,500)** — four heirs all living in the house; Del Rio Estates is a busy flip street ($354k-$385k renovated, investors buying at $220k-$264k); name on the parcel shows middle initial E vs. decedent Yvonne.

Best exit if wholesale fails: lower the fee to $5k; or refer the heirs to a listing agent (no referral fee unless licensed — see legal/FL.md); or walk away.
