# Underwriting — 2353 Dawnlight Ave, Columbus OH 43211 (oh-franklin-648195)
Deal Analyst, 2026-11-19. Fee $10,000 and buyer % 0.70 per config.yaml defaults.

ARV low/mid/high: **$180,000 / $190,000 / $205,000** (last-12-month retail sales of 800–1,150 sf 1950s ranches within 0.3 mi: $180k–$201k; see research.md)
Repairs low/mid/high: **$20,000 / $30,000 / $45,000** — GUESS, no photos or walk-through. 990 sf × ~$20 / $30 / $45 per sf (dated 1954 slab ranch, rented; assume kitchen/bath/flooring/paint, possible furnace/roof) incl. ~10% contingency.

## deal_calc.py output (mid case)
Command: `python3 scripts/deal_calc.py --arv 190000 --repairs 30000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 190000,
  "repairs": 30000,
  "pct_rule": 0.7,
  "buyer_max_price": 103000,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 93000,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($171,000)       85,700      79,700      70,700
+0% ($190,000)        99,000      93,000      84,000
+10% ($209,000)      112,300     106,300      97,300
```

## Statutory price floor check (Ohio R.C. 2127.011)
If the administrator sells under a consent power of sale, price must be ≥ 80% of the appraised value in the approved inventory. No inventory yet; an Application to Dispense With Appraisal is on file, so the inventory value will **probably** be the auditor value (assumption).
- 80% × $117,300 = **$93,840** vs MAO (mid) **$93,000** → MAO is $840 under the floor.
- The deal only works if: repairs come in at the low case (MAO $99,000), ARV holds at $190k+, or the fee drops to ~$9,000. At ARV −10% it does not work at any repair level.
- If instead the estate sells through a court land-sale proceeding (R.C. 2127), a new appraisal and court confirmation apply; price expectations would be similar or higher.

## Hidden costs
- Tenant (RENTAL = Y): buyer may need cash-for-keys ($1,500–3,000) or to take the tenant; lease terms unknown.
- Back taxes, water/sewer, code liens: unknown (auditor tax page down) — paid from the estate's proceeds at closing, but they affect the estate's willingness.
- Court timing: letters not issued until ≥12/17/2026; consents from every heir to be filed; inventory must be approved first → realistic closing Feb–Mar 2027. Earliest contract would be after letters.
- Vacant-home insurance/utilities only if the tenant leaves.

## Verdict
**NEGOTIATE (target $93,840–$95,000) — marginal.** Mid-case MAO sits just below the likely 80% statutory floor, so there is no room to negotiate below the floor; a deal exists only at the floor with a slightly smaller fee or lighter repairs. Investors here are paying $90k–$114k for as-is houses (2454 Century $90k, 2282 Dawnlight $107.5k), so expect competition.

## Best exit if the wholesale fails
1. Cut the fee to $5,000–$8,000 and contract at the floor (~$93,840) to a landlord buyer who wants the tenant in place.
2. Refer to a listing agent (needs a licensed partner for any referral fee).
3. Walk away; keep in follow-up for a price reduction if the house sits.
