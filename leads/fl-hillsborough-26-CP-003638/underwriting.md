## Underwriting — 2208 Ladywood Ct, Brandon FL 33511
Deal Analyst, 2026-11-20. Buyer % 0.70 (pipeline default; no Hillsborough buyer has confirmed a number yet). Fee $10,000.

ARV low/mid/high: $375,000 / $400,000 / $425,000 — Same-subdivision (Tanglewood) sales on Ladywood/Boxwood/Tanglewood at $300k-$349k ($180-217/sf) look like original-condition houses; renovated nearby sales run $250-270/sf (2210 Tanglewood Way eff. 2017 at $255/sf; 2808 Bellwood $270/sf). Subject at ~$230/sf renovated = $400k mid.
Repairs low/mid/high: $40,000 / $55,000 / $75,000 — **guess** (no photos): ~$25-45/sf on 1,747 sf for a 1974 house last updated ~2000 (roof/HVAC age unknown), plus cleanout.

### deal_calc.py (mid case)
```
python3 deal_calc.py --arv 400000 --repairs 55000 --fee 10000 --pct 0.70 --sensitivity
{
  "arv": 400000,
  "repairs": 55000,
  "pct_rule": 0.7,
  "buyer_max_price": 225000,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 215000,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($360,000)      198,000     187,000     170,500
+0% ($400,000)       226,000     215,000     198,500
+10% ($440,000)      254,000     243,000     226,500
```
Buyer max $225,000 | Fee $10,000 | MAO $215,000 | MAO range $170,500 – $254,000

PAO just value $236,256 vs. MAO $215,000: MAO is 91% of assessed value - expect pushback.

Hidden costs: cleanout ($2-5k), utilities/insurance on a vacant house, Florida doc stamps on the deed (0.70%, seller-paid by custom), any back taxes/tax certificates, code liens, occupant move-out time, court timing (summary/homestead order or sale authorization 1-3 months).

Verdict: **NEGOTIATE (target price $185,000)** — three Simmons heirs, one living in the house; Tanglewood resales $335k-$435k vs. $236k assessed; formal administration just opened (DOD 2026-06-23).

Best exit if wholesale fails: lower the fee to $5k; or refer the heirs to a listing agent (no referral fee unless licensed — see legal/FL.md); or walk away.
