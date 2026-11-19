# Underwriting — 1345 E Whittier St, Columbus OH 43206 (oh-franklin-648122)
Deal Analyst, 2026-11-19. Fee $10,000, buyer % 0.70 (config).

ARV low/mid/high: **$235,000 / $255,000 / $280,000** (see research.md)
Repairs low/mid/high: **$35,000 / $50,000 / $70,000** — GUESS (no photos). 1,240 sf × ~$28 / $40 / $56 per sf; 1949, possibly vacant since 2021 → kitchen, bath (+ half bath for mid ARV), flooring, paint, mechanicals; ~10–15% contingency.

## deal_calc.py output (mid case)
Command: `python3 scripts/deal_calc.py --arv 255000 --repairs 50000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 255000,
  "repairs": 50000,
  "pct_rule": 0.7,
  "buyer_max_price": 128500,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 118500,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($229,500)      110,650     100,650      85,650
+0% ($255,000)       128,500     118,500     103,500
+10% ($280,500)      146,350     136,350     121,350
```

## Price floor
None expected — heir/devisee sale after certificate of transfer; R.C. 2127.011 (executor/administrator sales) doesn't apply (confirm with title).

## Hidden costs
Cleanout; possible vacancy damage / water shut-off; back taxes and water (unknown); code orders (unknown). No court delay expected once the COT is recorded.

## Verdict
**NEGOTIATE (target ~$105,000; walk at $118,500) — best of today's five.** Simple authority (likely one owner, John Jr., already on title), no court, no floor, and a clear flip track record on this block (1191 Lilley $92.5k → $229k). Investors are buying as-is houses within 0.1 mi at $82.5k–$100k, so our MAO is competitive. Risk: ARV mid assumes a quality rehab; at ARV −10% and heavy repairs MAO drops to ~$85,650.

## Best exit if the wholesale fails
Lower fee ($5k) to Fisk Properties / UrbanixMB-type buyers; or refer to listing agent via licensed partner.
