# Underwriting — 1272 Moler Rd, Columbus OH 43207
Deal Analyst | 2026-11-19

ARV low/mid/high: **$225,000 / $250,000 / $275,000**
Repairs low/mid/high: **$40,000 / $60,000 / $85,000** — $/sf guess (1,690 sf × ~$24 / $35 / $50 incl. contingency). 1951, 32-yr owner, 1 bath: assume kitchen, bath, floors/paint, some mechanicals; high case adds roof/HVAC + 2nd bath. **No photos — guess.**
Buyer %: 0.70 (config default, unconfirmed). Fee: $10,000.

## deal_calc (mid case)
`python3 scripts/deal_calc.py --arv 250000 --repairs 60000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 250000,
  "repairs": 60000,
  "pct_rule": 0.7,
  "buyer_max_price": 115000,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 105000,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($225,000)       99,500      87,500      69,500
+0% ($250,000)       117,000     105,000      87,000
+10% ($275,000)      134,500     122,500     104,500
```
**MAO (mid) $105,000** | sensitivity **$69,500 – $134,500**. Fee 4% of ARV. No calculator flags.

## Reality checks
- Local investors are paying $90k–$120k for as-is houses within 0.5 mi (next door sold $90k 10/2026) — our MAO is consistent with that market.
- MAO is **61% of auditor value ($173,400)**. If the sale must go under R.C. 2127.011, floor = **$138,720** → deal does not work. Needs will power of sale and a house in genuinely rough condition.
- **Mortgage** (CoreLogic tax mailing): if payoff > ~$100k, no deal at any price we can pay.

## Hidden costs
Cleanout ($2k–$5k), winter utilities/vacant insurance, mortgage interest accruing during probate (estate's cost but raises their floor), possible back taxes, large-lot mowing.

## Verdict
**NEGOTIATE (target $95,000–$105,000)** — low confidence. Works only if: will has power of sale, house needs ≥ ~$60k of work, and mortgage payoff is well under $100k. Otherwise WALK AWAY.

## Best exit if wholesale fails
Landlord buyer (rental) at slightly higher % if confirmed in writing; cut fee to $5k (MAO $110k); otherwise step aside — a retail listing will beat us if the house is in fair shape.
