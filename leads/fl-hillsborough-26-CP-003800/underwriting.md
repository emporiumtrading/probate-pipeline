## Underwriting — 305 S Lenna Ave, Seffner FL 33584
Deal Analyst, 2026-11-20. Buyer % 0.70 (pipeline default; no Hillsborough buyer has confirmed a number yet). Fee $10,000.

ARV low/mid/high: $250,000 / $275,000 / $300,000 — Few small-house sales nearby. Renovated 2/1 and 3/2 sales of 915-1,400 sf ran $225k-$409k ($229-324/sf); 111 Garland (915 sf 2/1) $225k; 503 Moore (1,395 sf 2/1) $320k. Subject 1,008 sf at ~$270/sf incl. the large lot = $275k mid. Comp lot sizes not pulled - lot premium is assumed.
Repairs low/mid/high: $30,000 / $40,000 / $55,000 — **guess** (no photos): ~$30-55/sf on 1,008 sf; 1965 house last updated ~1995; 0.8-ac lot clearing/cleanout.

### deal_calc.py (mid case)
```
python3 deal_calc.py --arv 275000 --repairs 40000 --fee 10000 --pct 0.70 --sensitivity
{
  "arv": 275000,
  "repairs": 40000,
  "pct_rule": 0.7,
  "buyer_max_price": 152500,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 142500,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($247,500)      131,250     123,250     111,250
+0% ($275,000)       150,500     142,500     130,500
+10% ($302,500)      169,750     161,750     149,750
```
Buyer max $152,500 | Fee $10,000 | MAO $142,500 | MAO range $111,250 – $169,750

PAO just value $207,577 vs. MAO $142,500: MAO is 69% of assessed value - expect pushback.

Hidden costs: cleanout ($2-5k), utilities/insurance on a vacant house, Florida doc stamps on the deed (0.70%, seller-paid by custom), any back taxes/tax certificates, code liens, occupant move-out time, court timing (summary/homestead order or sale authorization 1-3 months).

Verdict: **NEGOTIATE (target price $122,500)** — one signer (sole beneficiary is also co-owner of record) living in Pasco County; small 2/1 on 0.8 ac likely vacant; but the case says 'Jr' while the parcel has no suffix - confirm on the deed before mailing.

Best exit if wholesale fails: lower the fee to $5k; or refer the heirs to a listing agent (no referral fee unless licensed — see legal/FL.md); or walk away.
