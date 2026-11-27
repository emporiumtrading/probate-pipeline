# Simulation review — 2208 Ladywood Ct, Brandon FL (2026-11-27)

A desk simulation of this lead from the first letter to closing. The lead's facts are real, taken from `leads/fl-hillsborough-26-CP-003638/`. The replies from counsel, the family, the buyer and the title agent are made up. Each worker step follows that worker's written instructions. Nothing was sent and no pipeline record changed. The thread is in `thread.csv`, and the dashboard shows it on the Messages page → Conversations, labelled SIMULATION.

## Outcome
- First letter on 2026-12-02. Agreement on 2027-01-06 (5 weeks), contract signed 2027-01-12, assigned 2027-01-15, closed 2027-03-03.
- Price $200,000 plus a $3,000 moving credit, inside the $210,000 walk-away. Assignment at $220,000 to a buyer who had been paired and vetted before the contract existed.
- Net to the company $16,850. Reserve refilled.
- The buyer side took **3 days** from contract to signed assignment, because the buyer was lined up in advance. The rest of the time was the court: the homestead order and the heir's move-out date. Weeks instead of months is realistic on the buyer side. The probate timeline sets the floor.

## How the workers performed (against their written rules)
| Worker | Verdict | Note |
|---|---|---|
| Contact Finder | Good | No placeholder left in the letter. Today 19 drafts still lack the attorney's office address (handed off). |
| Compliance Officer | Good | 90-day wait, disclosure, no "local" claim. |
| Communications | Good | Classified and routed every reply, and answered within 1 business day. |
| Legal Advisor / Legal Counsel | Good | Spotted the homestead path, then a medium-risk review with written fixes: possession, all heirs signing, moving money only at closing. |
| Deal Analyst | Good once a person saw the house | Repairs moved from a guess to evidence, and MAO dropped $5,000. |
| Negotiator | Good | No number before the walk-through. Concessions in order. Answered the listing objection honestly. Stayed under MAO; every decision logged. |
| Contract Desk / Transaction Coordinator | Good | $0 deposit asked first. Reserve checked. Title requirements tracked. |
| Buyer-List / Dispositions | Good **only under the assumption** | The sim assumed 3 vetted buyers. Today 0 of 487 are vetted, so the fast assignment would not happen yet. |

## Gaps the simulation found (and what's done)
1. **No one can see a house.** A walk-through needs a person. *Needs your decision:* allow a local field-inspection agent (about $75–$150 a visit) as a routine worker expense, or ask sellers for photos and video. Until then the Exceptions Desk asks you each time.
2. **Replies have no way in yet.** The reply inbox isn't connected. Email replies go to your own mailbox, and letters and calls come to you directly. *Needs:* Resend inbound on a `replies.` subdomain, plus a mail-scanning address and an answering service if you want letters and calls handled too.
3. **Conversation history wasn't visible.** Fixed: Messages page → Conversations. From now on, Communications records every letter, email, reply and step in `leads/<id>/thread.csv`.
4. **Placeholders in drafts.** Fixed for the sender's details, which are now filled before and after every run. Recipient addresses are the Contact Finder's job (rule added; handoff open).
5. **Buyers not vetted.** Fixed in process: buyers are paired with each lead, and the research queue puts paired buyers first, at least 25 a run.
6. **Setup items the sim had to assume:** Florida attorney approval, a tested mail channel, a Florida title company and connected e-signature (DocuSeal). These remain on the Setup page.
7. **Moving help ("cash for keys").** No written limit exists, so the Negotiator could only agree to it because it stayed under MAO. *Suggest:* a written limit (for example up to $5,000, paid only through the title company at closing).

## Who owns each gap now (owner decision 2026-11-27)
| Gap | Responsible | What changed |
|---|---|---|
| No one can see a house | **Field Inspections** (new worker, in trial) | Family photos and video first, then a field agent or inspector up to $150 a visit; condition report before a firm offer; final walk-through before closing. Professional Network shortlists providers per market. Setup → Channels → "Someone can see a house". |
| Repairs were a guess | Deal Analyst | No firm number while repairs are a guess; re-runs MAO when the inspection arrives. |
| Moving help had no limit | Negotiator (+ Contract Desk, Bookkeeper) | Up to $5,000, inside MAO, paid only through the title company at closing after a vacant walk-through. |
| Court orders weren't watched | Legal Advisor (court watch) + Transaction Coordinator | Weekly docket check for every lead with an offer or contract; title requirements tracked in title.md. |
| Replies can't come in | Communications / Reply Desk | Owner sets up Resend receiving on replies.emporium-investments.com (Setup → Channels). |
| No conversation record | Communications | leads/<id>/thread.csv, shown on Messages → Conversations. |
| Recipient placeholders | Contact Finder | No draft is ready with a placeholder (handoff H-0017). |
| Buyers not vetted | Buyer-List | Research queue, paired buyers first, 25 a run (handoff H-0018). |
| Deal costs before closing | Bookkeeper | Field-inspection fees and moving-help credits recorded with their limits. |
| FL attorney approval, mail channel, title company, e-signature | Legal Advisor, Communications, Professional Network, Contract Desk | Already their duties; still waiting on setup items. |

The two dollar limits ($150 and $5,000) are guarded settings. They go into `config.yaml` only after the owner approves the guardrail change. Until then, both kinds of spending go to the Exceptions Desk first.
