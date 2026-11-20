# Underwriting - 37 N Burgess Ave, Columbus OH 43204 (oh-franklin-648257)
Deal Analyst, 2026-11-20. Fee $10,000, buyer % 0.70.

ARV low/mid/high: **$210,000 / $230,000 / $250,000** (research.md)
Repairs low/mid/high: **$45,000 / $60,000 / $80,000** - GUESS (no photos). 1,310 sf x ~$34 / $46 / $61 per sf; 1900 house owned since 1977 -> assume heavy: electrical, plumbing, kitchen, bath, windows, possibly roof/foundation; ~15% contingency. Guess.

## deal_calc.py output (mid case)
Command: `python3 .claude/skills/probate-wholesale-deal/scripts/deal_calc.py --arv 230000 --repairs 60000 --fee 10000 --pct 0.70 --sensitivity`
```
{
  "arv": 230000,
  "repairs": 60000,
  "pct_rule": 0.7,
  "buyer_max_price": 101000,
  "assignment_fee": 10000,
  "your_closing_costs": 0,
  "max_offer_to_seller": 91000,
  "flags": []
}

MAO sensitivity (rows: ARV change, cols: repairs change)
ARV \ repairs           -20%         +0%        +30%
-10% ($207,000)       86,900      74,900      56,900
+0% ($230,000)       103,000      91,000      73,000
+10% ($253,000)      119,100     107,100      89,100
```

Buyer max (ARV x 0.70 - repairs) = **$101,000**; MAO = **$91,000**.

## Ohio price floor check (R.C. 2127.011)
Auditor value $117,700; dispensed with (entry 11/17/2026) - inventory will likely carry the auditor value. 80% of auditor value = **$94,160** (above MAO $91,000; below buyer max $101,000). The floor applies only to a consent sale (no will power of sale). If the will grants a power of sale (R.C. 2113.39), no statutory floor, but the fiduciary must still get a fair price. A court-ordered private sale needs 100% of appraisal.

## Hidden costs
Heavy-rehab risk; cleanout; taxes/water/code unchecked; vacant-house insurance.

## Verdict
**NEGOTIATE (low odds; target $84,000; walk at $91,000) - professional fiduciary with letters, clear flip demand on Burgess ($90k-$114k investor buys, $231k resale), but MAO is just under the ~$94,160 consent floor and a Jr/Sr name check is still open.**

## Best exit if the wholesale fails
Investors on this block pay $90k-$114k; a smaller fee to Velectric/TGD/Keno-type buyers is the fallback.
