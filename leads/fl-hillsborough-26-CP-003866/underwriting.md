## Underwriting — 114 E Flora St, Tampa FL 33604
Deal Analyst, 2026-11-20. Buyer % 0.70 (pipeline default; no Tampa buyer has confirmed a number yet). Fee $10,000.

ARV low/mid/high: $320,000 / $345,000 / $375,000 — from the retail comps in research.md (renovated older homes, 1,256 sf subject; adjusted for 2-bed/1-bath and dated condition).
Repairs low/mid/high: $35,000 / $50,000 / $75,000 — **guess** (no photos): ~$35-45/sf medium rehab + roof/HVAC allowance for a 1961 home, plus cleanout.

### deal_calc.py (mid case)
```
python3 deal_calc.py --arv 345000 --repairs 50000 --fee 10000 --pct 0.70 --sensitivity
buyer_max_price: 191,500
assignment_fee: 10,000
max_offer_to_seller (MAO): 181,500
flags: []
MAO sensitivity (ARV -10/0/+10%, repairs -20/0/+30%): range $142,350 - $215,650
```

PAO just value $235,858 vs. MAO $181,500: MAO is BELOW the assessed value - expect pushback.

Hidden costs: cleanout ($2-5k), utilities/insurance on a vacant house, Florida doc stamps on the deed (0.70%, seller-paid by custom), any back taxes/tax certificates, code liens, court timing (homestead order or sale authorization 1-3 months).

Verdict: **NEGOTIATE (target price $165,000)** — out-of-state petitioner and ~8 scattered collateral heirs who will want a simple cash sale; strong Seminole Heights resale demand; MAO $181.5k vs. $235.9k assessed value is a hard conversation.

Best exit if wholesale fails: lower the fee to $5k; or refer the heirs to a listing agent (no referral fee unless licensed — see legal/FL.md); or walk away.
