# Underwriting — 106 Coolidge Ave, Columbus OH 43228 (Franklin Twp)
Deal Analyst | 2026-11-19

ARV low/mid/high: **$185,000 / $205,000 / $225,000**
Repairs low/mid/high: **$27,000 / $45,000 / $65,000** — $/sf guess (1,337 sf × ~$20 / $34 / $49). **No photos — guess.**

## deal_calc (mid case)
`python3 scripts/deal_calc.py --arv 205000 --repairs 45000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 205000,
  "repairs": 45000,
  "pct_rule": 0.7,
  "buyer_max_price": 98500,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 88500,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($184,500)       83,150      74,150      60,650
+0% ($205,000)        97,500      88,500      75,000
+10% ($225,500)      111,850     102,850      89,350
```
**MAO (mid) $88,500** | sensitivity **$60,650 – $111,850**. Fee 4.9% of ARV.

## Reality checks
- Landlord buyers (Prime Luxury LLC, CPT-ASL) are paying **$108k–$148k** for smaller houses on the same streets, i.e. more than our MAO → the estate can sell direct to them; we can't compete at a 70% flip formula.
- MAO = 57% of auditor value ($155,300); 2127.011 floor would be $124,240.
- Title is not clean: second owner of record, copy-of-will, letters not issued.

## Verdict
**WALK AWAY (for now)** — MAO $88.5k is below what landlord buyers already pay nearby and far below the auditor-based floor; plus co-owner/title and lost-will questions and no letters. Re-check docket monthly; revisit only if letters issue and the property turns out to be in heavy-repair condition.

## Best exit if revisited
Rental buyer at a higher confirmed % (e.g., Prime Luxury) with a small fee ($5k), only with that buyer's written number.
