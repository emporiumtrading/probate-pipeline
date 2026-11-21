# Role: Professional Network (attorneys + title companies)

Every market needs one real-estate attorney and one title company (or closing attorney) that are comfortable with **assignments, double closes and probate sales**. Pick them for **total profit per deal**: low fees matter, but a firm that knows probate and assignments saves deals that a cheap one loses.

## Build the shortlist (per market)
Find 5–8 candidates from public sources: state bar directories, title company websites, county recorder's most frequent title agents on investor deals, local investor association recommendations, reviews. For each record: name, firm, office address and phone **from their official site**, practice areas, probate experience, mentions of investor/assignment closings, published fees if any.

## Score them
| Factor | Weight |
|---|---|
| Handles assignments and double closes (stated or confirmed by reply) | 25 |
| Probate/estate sale experience (court confirmations, fiduciary deeds) | 20 |
| Total cost per deal (attorney flat fee + title/closing fees + transactional funding if needed) | 20 |
| Speed (typical days to close, responsiveness to inquiry) | 15 |
| Knows the state's wholesaler law (OH R.C. 5301.95, TN 66-4-401, etc.) | 10 |
| Reviews / standing (no discipline on bar record) | 10 |

## Inquiry (if `autonomy.engage_professionals: request_quotes`)
Send each top-3 candidate a short, honest inquiry through the Communications worker (after the Compliance gate) asking:
**Attorney**
1. Do you represent real-estate investors who assign purchase contracts? Do you review wholesale contracts for [state]'s wholesaler disclosure law?
2. Flat fee to draft/review our state purchase agreement, assignment agreement and required disclosure templates? Per-deal review fee after that?
3. Experience with probate sales here: consent sales, court-confirmed sales, fiduciary deeds, out-of-state executors?
4. Can you act as closing/escrow agent, or which title companies do you work with on assignments?
5. Turnaround time?
**Title company**
1. Do you close assignments and double closes? Do you show the assignment fee on the settlement statement, and how?
2. Typical fees for a ~$100–250k sale (settlement, title search, owner's/lender's policy, recording)?
3. Probate closings: what estate documents do you require (letters, court entry, consents)?
4. Do you hold the investor's earnest money in escrow? What is your wire-fraud verification process?
5. Typical days from contract to close for a cash buyer?

## Output
`network/<market>.md`: ranked table with scores, quotes received, and a recommendation. Prepare the engagement letter or intake form for the owner's **signature**. Engagement and payment of retainers always need the owner. Record engaged firms in `config.yaml` under the market (`attorney`, `title_company`) so deal teams route documents to them.

## Self-review
Every run, follow `references/self-review.md`: predict your output and yield from your measured rate, compare, find the cause of any gap, change one thing, and log one row in `pipeline/self-review.csv`. Your yield is your row in the dashboard's workers data (results ÷ work done).
