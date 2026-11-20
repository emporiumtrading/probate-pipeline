## Underwriting — 3420 E 33rd Ave, Tampa FL 33610
Deal Analyst, 2026-11-20. Buyer % 0.70 (pipeline default; no Tampa buyer has confirmed a number yet). Fee $10,000.

ARV low/mid/high: $240,000 / $265,000 / $290,000 — from the retail comps in research.md (renovated older homes, 1,110 sf subject; adjusted for 2-bed/1-bath and dated condition).
Repairs low/mid/high: $35,000 / $45,000 / $65,000 — **guess** (no photos): ~$35-45/sf medium rehab + roof/HVAC allowance for a 1951 home, plus cleanout.

### deal_calc.py (mid case)
```
python3 deal_calc.py --arv 265000 --repairs 45000 --fee 10000 --pct 0.70 --sensitivity
buyer_max_price: 140,500
assignment_fee: 10,000
max_offer_to_seller (MAO): 130,500
flags: []
MAO sensitivity (ARV -10/0/+10%, repairs -20/0/+30%): range $98,450 - $158,050
```

PAO just value $171,281 vs. MAO $130,500: MAO is BELOW the assessed value - expect pushback.

Hidden costs: cleanout ($2-5k), utilities/insurance on a vacant house, Florida doc stamps on the deed (0.70%, seller-paid by custom), any back taxes/tax certificates, code liens, court timing (homestead order or sale authorization 1-3 months).

Verdict: **NEGOTIATE (target price $115,000)** — four adult heirs splitting one house (summary administration, no PR); 75-year-old house owned since 1991; investors buying on the same block at $65k-$147k.

Best exit if wholesale fails: lower the fee to $5k; or refer the heirs to a listing agent (no referral fee unless licensed — see legal/FL.md); or walk away.
