# Orchestration: worker teams from lead to closing

Goal: the owner only **signs** (one click on packets the system prepared: purchase agreements, required disclosures, assignment agreements, engagement letters) and **confirms the earnest-money deposit** to the title company's escrow, then sees the fees arrive. Owner decision 2026-11-25: "fully autonomous; I only want to see money deposited." Everything else is decided by the worker teams, every day, within the written limits below, until each deal closes or is dead.

## The owner's touchpoints (and nothing else)
1. **Signature queue**: e-sign envelopes the system prepared and checked (purchase agreement + state disclosures, assignment agreement, attorney/title engagement letters). Each comes with a one-screen summary: price, fee, deadlines, risks. The owner's own click is the signature; no stored or copied signature is ever used.
2. **Deposit queue**: earnest money the owner pays from their own bank into the title company's escrow, by the title company's digital earnest-money link where offered, otherwise by wire. The system gives the amount, due date and the title company's phone number from its official website; the owner confirms by phone before paying. **The system never receives, stores or uses bank details**, and never relays payment instructions it received by email.
3. **Money in**: fees deposited, expected closings and deposits due lead the daily report and the dashboard (Bookkeeper, from documents only).
4. **True exceptions only**: the Exceptions Desk escalates only what needs a signature, money beyond the written limits, a legal question only an attorney can answer, or anything outside the written limits, with a recommendation and options. Calls: AI or automated calls and texts are never used (TCPA). A seller or attorney who asks for a call first gets a written answer; only if they still want a call does it appear as an optional owner item.

Show these as queues in the daily report and on the dashboard. Nothing else is put in front of the owner.

## What workers decide on their own (written limits, `config.yaml` → `autonomy`)
Every decision below is logged in `pipeline/decisions-log.csv` (`date,worker,lead_id,decision,reason,limit,evidence`) the moment it is made.
| Decision | Worker | Written limit |
|---|---|---|
| Send a letter, email or follow-up | Acquisitions + Communications, after the Compliance Officer | `autonomy.outreach: autonomous` and, per market, `attorney_approved`, a tested channel, the 90-day wait, the frequency caps and the stop list. Otherwise the letter waits as a held draft (not in the owner's queue). |
| Offer and counter-offer | Negotiator (Deal Analyst re-prices) | Up to the deal's MAO (`negotiation_limit: mao`); always "subject to a mutually signed purchase agreement"; every heir the same terms |
| Unusual terms | Negotiator via Exceptions Desk | Terms that cost nothing and bind nothing (closing date, as-is, cleanout by the buyer, access times) are decided by the Negotiator; any new money obligation goes to the owner |
| Choose an attorney or title company | Professional Network | Quote within `attorney_template_fee_max` / `attorney_per_deal_fee_max`, title fees `paid_at_closing`; the best score wins and its engagement letter goes to the Sign queue |
| Choose the end buyer | Dispositions | Vetted buyers only; highest net fee with a non-refundable deposit and proof of funds; ties go to the faster close; a backup buyer is lined up |
| Scheduling (showings, inspections, closing dates, reminders) | Transaction Coordinator / Dispositions | Within the contract's access and deadline terms |
| Exceptions with a playbook answer | Exceptions Desk | The playbooks in `agents/exceptions-desk.md` |
| Contract packets | Contract Desk | Attorney-approved state templates only, variables only, Compliance PASS; then the Sign queue |

## Worker teams
Run these as parallel subagents where the platform allows (one team per market for sourcing, one deal team per lead, one comms worker, one closing worker). Each worker reads its role file(s) and writes only its own files; the orchestrator (the daily run) merges.

| Team | Roles (files in `agents/`) | Runs |
|---|---|---|
| Legal | legal-advisor | When a state file is stale or a new state is added |
| Legal documents and risk | legal-counsel | Every evening slice: document library, legal watch; a deal's risk file before any contract or assignment; disputes the same run they arrive |
| Sourcing (one per market) | researcher | Daily |
| Deal team (one per new lead) | researcher → deal-analyst → legal-advisor → transaction-coordinator → negotiator → dispositions → acquisitions | Daily for new leads |
| Exceptions | exceptions-desk | Every run (evening slice and fast desk): before the report |
| Deal team add-ons (per new lead) | tax-lien-checker → contact-finder (if outreach drafted) → quality-auditor | Daily, after the deal team, before the approval queue |
| Contract desk | contract-desk | When a deal reaches "Verbal agreement"; templates once per state |
| Books | bookkeeper | Every evening run: forecasts for deals at Verbal agreement or later, actuals from documents, monthly roll-up |
| Compliance gate | compliance-officer | Before **every** outbound message or document |
| Worker lifecycle | quality-auditor (scores) + the runner (`scripts/worker_lifecycle.py evaluate --apply`) | Every evening slice (runbook step 7c) |
| Communications | communications | Daily: send approved-by-config outreach and follow-ups, read the inbox, route replies |
| Negotiation desk | negotiator (+ deal-analyst for re-pricing) | Whenever a reply or counter arrives |
| Professional network | professional-network | When a market has no engaged attorney/title company, or a deal needs one |
| Dispositions desk | dispositions | When a deal reaches "Under contract" |
| Closing desk | transaction-coordinator | Every open contract, daily, until closed |

## Trial and probation workers (shadow mode)
Every worker has a lifecycle status in `pipeline/workers.csv` (`references/worker-lifecycle.md`). Only `active` workers feed the live run.
- A worker in `trial` (new) or `probation` (performance dropped) runs in **shadow mode**: it does its step on the same inputs, writes its output only to `pipeline/trials/<worker>/<date>/`, and nothing else uses it. Its output never moves a lead, never fills a tracker column, never enters a message, offer, contract or buyer email, and is never cited as evidence for one.
- Every outbound action is logged in `pipeline/outbound-log.csv` with `produced_by` (every worker whose output it used). `scripts/qa_checks.py` fails the run if any of them wasn't `active` on that date, or if anything outbound points into `pipeline/trials/`.
- While a worker is in shadow mode, its live duties stay with whoever did them before (for a new worker, nobody: the work simply isn't used yet; for a worker on probation, the step's output waits, and the Exceptions Desk notes what is held). Don't send handoffs to a shadow worker for live work; an answer it gives must be re-checked by an active worker before use.

## Handoff board (how workers talk to each other)
Workers run in turn within each run, so they can't ask each other questions live. They talk through one shared board, `pipeline/handoffs.csv`, which they only change through `scripts/handoffs.py` (add, list, answer, reassign, close, reopen, sweep, check). Every worker with a role file in `agents/` is on it automatically, including workers added later, plus `owner` and `hermes`.
**Hermes** (the orchestrator, `hermes/SOUL.md`) sets the team's priorities and hands out work as `hermes`: treat its requests like any worker's, in priority order, and answer with evidence. A worker may send `--to hermes` a question about priorities or a stuck dependency; owner-only decisions still go through the Exceptions Desk.
**Exceptions go to the Exceptions Desk first.** Anything outside a worker's rules goes `--to exceptions-desk`, not `--to owner`. The Exceptions Desk resolves what it can through the owning workers and is the only worker that escalates to the owner, with a recommendation and options, and only for a signature, money beyond the written limits, an attorney-only legal question, or anything outside written limits. Sign and deposit items still go straight to the owner's queues.

- **Kinds:** `question` (an answer with evidence), `request` (a piece of work), `blocker` (the lead must not move forward until it is answered), `fyi` (no answer needed).
- **Order within a run:** the runner runs `handoffs.py sweep` at the start of the run. Each worker starts its step with `handoffs.py list --for <itself>` and clears its open items (urgent and blockers first) before new work. A question raised in one step can be answered by a later worker in the same run. If the worker that owns it already ran, its next run answers it first.
- **Deadlines:** urgent items are due the same day and normal ones the next day, unless the asker sets `--needed-by`. The sweep escalates anything past its deadline, anything moved between workers 3 times, and anything addressed to a worker that no longer exists. Escalated items appear in the daily report under **Exceptions** and on the dashboard.
- **Blockers:** a lead with an open blocker never moves to a later stage and never enters the owner's approval queue (QA fails the run if it does).
- **Answers** must name their evidence (a file in the repo or a source URL). The asker closes an answer, or reopens it saying what's missing. The Quality Auditor's weekly review also covers the board: slow answers, ping-pong and repeated questions that point to a missing rule or a missing worker (`references/new-worker.md`).
- **Never** put bank details, card numbers, passwords or keys on the board; the script refuses them.
- **Between runs:** the fast desk (`references/fast-desk.md`) clears the board every 2 hours in business hours, acting as whichever worker each item is for. So a question raised in the morning run is usually answered before the midday run.

## Deal state machine
New → Researched → Outreach drafted (held until the market's gates open) → Outreach sent → In conversation → Offer made → Verbal agreement → **Contract out for signature (owner + seller)** → Under contract → **Earnest money wired (owner)** → Title opened → Buyer found → **Assignment signed (owner + buyer)** → Clear to close → Closed → Paid.
Dead/Walk away can happen at any step; record why.

Every transition is logged in `leads/<id>/timeline.md` with date, actor and evidence (email id, document id).

## Authority (from `config.yaml` → `autonomy`)
- `outreach`: `drafts_only` | `autonomous` (send mail/email without per-message approval, after the compliance gate, only in markets with `attorney_approved` and a tested channel, and only after the 90-day wait). Current: `autonomous` (owner decision 2026-11-25).
- `negotiation_limit`: `target` | `mao`: the highest price the Negotiator may offer in writing without asking. Offers are always "subject to a written purchase agreement signed by both parties", so nothing binds the owner until they sign.
- `engage_professionals`: `recommend` | `request_quotes` | `select_within_limits`. The system emails firms for availability and fee quotes and, with `select_within_limits`, picks the best-scoring firm whose quote is within `attorney_template_fee_max`, `attorney_per_deal_fee_max` and `title_fees`; the owner signs the engagement letter.
- `worker_decisions: within_written_limits`: workers decide the routine matters in the table above and log each one.
- Everything binding (contracts, engagement letters, earnest money) always needs the owner. This is not configurable.

## Services the system needs (owner sets these up once)
| Need | Service | Status check |
|---|---|---|
| Send/receive email | Gmail connector (drafts + reading). Fully automatic sending needs a sending service, e.g. Resend, connected with its key saved as a network secret | If only Gmail drafts are available, outbound email lands in the owner's Drafts and the owner clicks Send |
| Physical letters | A print-and-mail API (e.g. Lob or PostGrid) with the key saved as a network secret | Without it, letters are PDFs the owner mails |
| E-signature | DocuSign (connector) or another e-sign API | Without it, the owner gets PDF signature packets |
| Phone numbers | Skip-trace service (optional) | Without it, mail and email only |
| Do-Not-Call scrubbing | National DNC registry access plus each state's list | Without it, **no** calls or texts are drafted |

If a service is missing, the system degrades to the next-best manual step and lists it in the report. It never pretends something was sent.
