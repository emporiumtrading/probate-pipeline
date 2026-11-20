## Underwriting — 612 Valley Hill Dr, Brandon FL 33510
Deal Analyst, 2026-11-20. Buyer % 0.70 (pipeline default; no Hillsborough buyer has confirmed a number yet). Fee $10,000.

ARV low/mid/high: $425,000 / $450,000 / $470,000 — Same street: 613 Valley Hill (renovated, eff 2018) $460k; 605 Valley Hill (eff 2011) $450k; renovated Hillside 3/2s $425k-$470k ($246-278/sf). Subject 4/2 at ~$245/sf = $450k mid.
Repairs low/mid/high: $45,000 / $60,000 / $85,000 — **guess** (no photos): ~$25-46/sf on 1,836 sf; 1977 house last updated ~2001 and probably vacant ~19 months (Florida humidity: assume mold/AC/roof risk), plus cleanout.

### deal_calc.py (mid case)
```
python3 deal_calc.py --arv 450000 --repairs 60000 --fee 10000 --pct 0.70 --sensitivity
{
  "arv": 450000,
  "repairs": 60000,
  "pct_rule": 0.7,
  "buyer_max_price": 255000,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 245000,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($405,000)      225,500     213,500     195,500
+0% ($450,000)       257,000     245,000     227,000
+10% ($495,000)      288,500     276,500     258,500
```
Buyer max $255,000 | Fee $10,000 | MAO $245,000 | MAO range $195,500 – $288,500

PAO just value $272,436 vs. MAO $245,000: MAO is 90% of assessed value - expect pushback.

Hidden costs: cleanout ($2-5k), utilities/insurance on a vacant house, Florida doc stamps on the deed (0.70%, seller-paid by custom), any back taxes/tax certificates, code liens, occupant move-out time, court timing (summary/homestead order or sale authorization 1-3 months).

Verdict: **NEGOTIATE (target price $210,000)** — out-of-state petitioner (IL) and heirs (ID); house likely vacant since the 2025 death of the beneficiary who lived there; same-street renovated sales $450k-$460k; very active investor area.

Best exit if wholesale fails: lower the fee to $5k; or refer the heirs to a listing agent (no referral fee unless licensed — see legal/FL.md); or walk away.
