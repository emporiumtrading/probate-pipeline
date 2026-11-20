## Underwriting — 3003 N 42nd St, Tampa FL 33605
Deal Analyst, 2026-11-20. Buyer % 0.70 (pipeline default; no Tampa buyer has confirmed a number yet). Fee $10,000.

ARV low/mid/high: $225,000 / $245,000 / $260,000 — from the retail comps in research.md (renovated older homes, 816 sf subject; adjusted for 2-bed/1-bath and dated condition).
Repairs low/mid/high: $30,000 / $40,000 / $60,000 — **guess** (no photos): ~$35-45/sf medium rehab + roof/HVAC allowance for a 1960 home, plus cleanout.

### deal_calc.py (mid case)
```
python3 deal_calc.py --arv 245000 --repairs 40000 --fee 10000 --pct 0.70 --sensitivity
buyer_max_price: 131,500
assignment_fee: 10,000
max_offer_to_seller (MAO): 121,500
flags: []
MAO sensitivity (ARV -10/0/+10%, repairs -20/0/+30%): range $92,350 - $146,650
```

PAO just value $124,171 vs. MAO $121,500: MAO is BELOW the assessed value - expect pushback.

Hidden costs: cleanout ($2-5k), utilities/insurance on a vacant house, Florida doc stamps on the deed (0.70%, seller-paid by custom), any back taxes/tax certificates, code liens, court timing (homestead order or sale authorization 1-3 months).

Verdict: **NEGOTIATE (target price $105,000)** — owner died in 2003 and the estate is only now being opened (summary administration) - typical clean-up-to-sell file; same-model houses resell at $233k-$250k; but one heir is itself an estate.

Best exit if wholesale fails: lower the fee to $5k; or refer the heirs to a listing agent (no referral fee unless licensed — see legal/FL.md); or walk away.
