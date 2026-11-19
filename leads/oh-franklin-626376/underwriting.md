# Underwriting — 821 Lizzie Ln, Whitehall OH 43213 (oh-franklin-626376)
Deal Analyst, 2026-11-19. Fee $10,000, buyer % 0.70.

ARV low/mid/high: **$260,000 / $280,000 / $300,000** (see research.md)
Repairs low/mid/high: **$20,000 / $30,000 / $45,000** — GUESS; 1997 house, AVERAGE condition per auditor → light-to-medium.

## deal_calc.py output (mid case)
Command: `python3 scripts/deal_calc.py --arv 280000 --repairs 30000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 280000,
  "repairs": 30000,
  "pct_rule": 0.7,
  "buyer_max_price": 166000,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 156000,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($252,000)      142,400     136,400     127,400
+0% ($280,000)       162,000     156,000     147,000
+10% ($308,000)      181,600     175,600     166,600
```

## Equity / hidden costs
Likely new mortgage (Oct 2025) of unknown size → equity unknown and possibly thin. No probate sale, no court, no 80% floor — it's an ordinary owner sale.

## Verdict
**WALK AWAY — not an estate asset.** Title passed to the heirs by certificate of transfer in 2023 and is now held by one heir who appears to have refinanced in Oct 2025 (a "keep" signal). No probate motivation; numbers are moot.

## Best exit
None needed. Drop from probate pipeline; optionally watch the docket to learn why the case was reopened (re-check 2026-12-19).
