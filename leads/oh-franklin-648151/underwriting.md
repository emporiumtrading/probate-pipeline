# Underwriting — 324 Sheldon Ave, Columbus OH 43207
Deal Analyst | 2026-11-19

ARV low/mid/high: **$380,000 / $420,000 / $465,000** (comps in research.md; renovated 0.3-mi sales $287–$375/sf; 1-bath discount applied)
Repairs low/mid/high: **$45,000 / $70,000 / $100,000** — $/sf guess (1,344 sf × ~$35 / $50 / $75 incl. ~12% contingency). 1916 house, 20+ yr owner: assume kitchen, bath, paint/floors, likely electrical/plumbing updates; heavy case adds roof/HVAC/foundation/second bath. **No photos or walk-through — this is a guess.**
Buyer %: 0.70 (config default; not yet confirmed by a real buyer). Fee: $10,000.

## deal_calc (mid case)
`python3 scripts/deal_calc.py --arv 420000 --repairs 70000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 420000,
  "repairs": 70000,
  "pct_rule": 0.7,
  "buyer_max_price": 224000,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 214000,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($378,000)      198,600     184,600     163,600
+0% ($420,000)       228,000     214,000     193,000
+10% ($462,000)      257,400     243,400     222,400
```
**MAO (mid) $214,000** | sensitivity range **$163,600 – $257,400**. Fee = 2.4% of ARV (fine). No red flags from the calculator.

## Reality checks
- Investors are actually paying $160k–$255k as-is within 0.4 mi (research.md), so a $195k–$214k contract is in line with the local as-is market.
- **Price floor problem:** auditor value $297,900 (appraisal dispensed with; auditor summary filed). If the sale has to run under R.C. 2127.011 (consents), the floor is 80% = **$238,320**, above our MAO. Our number only works if the will grants a power of sale (R.C. 2113.39) and the executor can justify the price, or if repairs/ARV come in better than assumed.
- MAO = 72% of auditor value. The executor will likely be told by the attorney that listing could net more. Our edge is certainty, as-is, no showings, speed.

## Hidden costs (buyer/our side)
Cleanout of a long-held home ($2k–$5k), utilities/winterization if vacant (Nov), vacant-home insurance, possible back taxes (unknown), estate attorney timing, City of Columbus permits for mechanicals. No HOA.

## Verdict
**NEGOTIATE (target $195,000–$214,000)** — big spread to renovated comps and an active flipper market; letters already issued. Conditional on a will power of sale (or consents + an inventory value low enough) and a condition check.

## Best exit if wholesale fails
Lower fee to $5k (MAO $219k); refer the estate to list as a fixer (as-is retail buyers pay $160k–$255k here) — any referral/JV payment only if the attorney approves (`legal/OH.md` bars unapproved fee splits); or step aside and suggest the estate list.
