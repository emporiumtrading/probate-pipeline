## Underwriting — 4423 Bass St, Tampa FL 33617
Deal Analyst, 2026-11-20. Buyer % 0.70 (pipeline default; no Tampa buyer has confirmed a number yet). Fee $10,000.

ARV low/mid/high: $285,000 / $305,000 / $330,000 — from the retail comps in research.md (renovated older homes, 1,008 sf subject; adjusted for 2-bed/1-bath and dated condition).
Repairs low/mid/high: $30,000 / $45,000 / $65,000 — **guess** (no photos): ~$35-45/sf medium rehab + roof/HVAC allowance for a 1958 home, plus cleanout.

### deal_calc.py (mid case)
```
python3 deal_calc.py --arv 305000 --repairs 45000 --fee 10000 --pct 0.70 --sensitivity
buyer_max_price: 168,500
assignment_fee: 10,000
max_offer_to_seller (MAO): 158,500
flags: []
MAO sensitivity (ARV -10/0/+10%, repairs -20/0/+30%): range $123,650 - $188,850
```

PAO just value $153,694 vs. MAO $158,500: MAO is above the assessed value.

Hidden costs: cleanout ($2-5k), utilities/insurance on a vacant house, Florida doc stamps on the deed (0.70%, seller-paid by custom), any back taxes/tax certificates, code liens, court timing (homestead order or sale authorization 1-3 months).

Verdict: **NEGOTIATE (target price $145,000)** — single listed heir/petitioner living in another county; dated 1958 block home on a street full of recent flips; MAO $158.5k sits just above the $153.7k assessed value.

Best exit if wholesale fails: lower the fee to $5k; or refer the heirs to a listing agent (no referral fee unless licensed — see legal/FL.md); or walk away.
