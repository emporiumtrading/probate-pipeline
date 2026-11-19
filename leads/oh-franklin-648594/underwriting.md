# Underwriting — 464 Old Village Rd, Columbus OH 43228 (oh-franklin-648594)
Deal Analyst, 2026-11-19. Fee $10,000, buyer % 0.70 (config defaults).

ARV low/mid/high: **$240,000 / $255,000 / $270,000** (last-12-month retail sales within 0.6 mi; see research.md)
Repairs low/mid/high: **$40,000 / $55,000 / $75,000** — GUESS (no photos). 1,341 sf × ~$30 / $41 / $56 per sf; 1952 house in one family 55 years, one bath for five bedrooms → kitchen, bath, likely second bath, flooring, paint, mechanicals; ~10% contingency included.

## deal_calc.py output (mid case)
Command: `python3 scripts/deal_calc.py --arv 255000 --repairs 55000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 255000,
  "repairs": 55000,
  "pct_rule": 0.7,
  "buyer_max_price": 123500,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 113500,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($229,500)      106,650      95,650      79,150
+0% ($255,000)       124,500     113,500      97,000
+10% ($280,500)      142,350     131,350     114,850
```

## Price floor
None from R.C. 2127.011 — that applies to sales by an executor/administrator. Here the heirs take title by certificate of transfer and sell as owners (assumption to confirm with title).

## Hidden costs
- Cleanout of 55 years of belongings (assume $2,000–4,000; offer to handle it).
- Possible occupant (Jane or family) → move-out timing.
- If Jane is deceased: a second estate must open before her share can be sold (months).
- Back taxes / water / township code — unknown.

## Verdict
**NEGOTIATE (target ≤ $113,500; open ~$105,000) — low odds.** Numbers work at our MAO, but heirs will see an auditor value of $189,900 and nearby investor buys at $171k–$205k. Local investors appear to pay well above a strict 70% rule here (or are buying lighter-rehab houses), so we will often be outbid. Worth one respectful letter to counsel; don't chase.

## Best exit if the wholesale fails
Refer the family to a listing agent (licensed partner for any referral fee) — a retail listing likely nets them more; or reduce fee to $5k if a buyer confirms ≥75% of ARV in writing.
