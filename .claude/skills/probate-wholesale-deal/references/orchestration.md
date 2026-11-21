# Orchestration: worker teams from lead to closing

Goal: the owner's only job is to **sign** (purchase agreements, required disclosures, assignment agreements, engagement letters) and to **release money they control** (earnest-money wires confirmed by phone with the title company). Everything else is done by worker teams, every day, until each deal closes or is dead.

## The owner's touchpoints (and nothing else)
1. **Signature queue**: e-sign envelopes the system prepared (purchase agreement + state disclosures, assignment agreement, attorney/title engagement letters). Each comes with a one-screen summary: price, fee, deadlines, risks.
2. **Wire queue**: earnest money the owner sends from their own bank to the title company's escrow. The system gives the amount, due date and the title company's phone number from its official website; the owner confirms instructions by phone before sending. **The system never receives, stores or uses bank details**, and never relays wiring instructions it received by email.
3. **Phone calls** a seller or attorney asks for: the system books them and gives a one-page brief. AI voice calls are not used. Under the TCPA they need the called party's prior express consent, which estates haven't given.
4. **Exceptions**: anything outside the authority in `config.yaml` (price above the limit, unusual terms, legal red flags).

Show all four as queues in the daily report and on the dashboard.

## Worker teams
Run these as parallel subagents where the platform allows (one team per market for sourcing, one deal team per lead, one comms worker, one closing worker). Each worker reads its role file(s) and writes only its own files; the orchestrator (the daily run) merges.

| Team | Roles (files in `agents/`) | Runs |
|---|---|---|
| Legal | legal-advisor | When a state file is stale or a new state is added |
| Sourcing (one per market) | researcher | Daily |
| Deal team (one per new lead) | researcher → deal-analyst → legal-advisor → transaction-coordinator → negotiator → dispositions → acquisitions | Daily for new leads |
| Deal team add-ons (per new lead) | tax-lien-checker → contact-finder (if outreach drafted) → quality-auditor | Daily, after the deal team, before the approval queue |
| Contract desk | contract-desk | When a deal reaches "Verbal agreement"; templates once per state |
| Books | bookkeeper | Every evening run: forecasts for deals at Verbal agreement or later, actuals from documents, monthly roll-up |
| Compliance gate | compliance-officer | Before **every** outbound message or document |
| Communications | communications | Daily: send approved-by-config outreach and follow-ups, read the inbox, route replies |
| Negotiation desk | negotiator (+ deal-analyst for re-pricing) | Whenever a reply or counter arrives |
| Professional network | professional-network | When a market has no engaged attorney/title company, or a deal needs one |
| Dispositions desk | dispositions | When a deal reaches "Under contract" |
| Closing desk | transaction-coordinator | Every open contract, daily, until closed |

## Handoff board (how workers talk to each other)
Workers run in turn within each run, so they can't ask each other questions live. They talk through one shared board, `pipeline/handoffs.csv`, which they only change through `scripts/handoffs.py` (add, list, answer, reassign, close, reopen, sweep, check). Every worker with a role file in `agents/` is on it automatically, including workers added later, plus `owner`.
- **Kinds:** `question` (an answer with evidence), `request` (a piece of work), `blocker` (the lead must not move forward until it is answered), `fyi` (no answer needed).
- **Order within a run:** the runner runs `handoffs.py sweep` at the start of the run. Each worker starts its step with `handoffs.py list --for <itself>` and clears its open items (urgent and blockers first) before new work. A question raised in one step can be answered by a later worker in the same run. If the worker that owns it already ran, its next run answers it first.
- **Deadlines:** urgent items are due the same day and normal ones the next day, unless the asker sets `--needed-by`. The sweep escalates anything past its deadline, anything moved between workers 3 times, and anything addressed to a worker that no longer exists. Escalated items appear in the daily report under **Exceptions** and on the dashboard.
- **Blockers:** a lead with an open blocker never moves to a later stage and never enters the owner's approval queue (QA fails the run if it does).
- **Answers** must name their evidence (a file in the repo or a source URL). The asker closes an answer, or reopens it saying what's missing. The Quality Auditor's weekly review also covers the board: slow answers, ping-pong and repeated questions that point to a missing rule or a missing worker (`references/new-worker.md`).
- **Never** put bank details, card numbers, passwords or keys on the board; the script refuses them.

## Deal state machine
New → Researched → Outreach sent → In conversation → Offer made → Verbal agreement → **Contract out for signature (owner + seller)** → Under contract → **Earnest money wired (owner)** → Title opened → Buyer found → **Assignment signed (owner + buyer)** → Clear to close → Closed → Paid.
Dead/Walk away can happen at any step; record why.

Every transition is logged in `leads/<id>/timeline.md` with date, actor and evidence (email id, document id).

## Authority (from `config.yaml` → `autonomy`)
- `outreach`: `drafts_only` | `autonomous` (send mail/email without per-message approval, after the compliance gate).
- `negotiation_limit`: `target` | `mao`: the highest price the Negotiator may offer in writing without asking. Offers are always "subject to a written purchase agreement signed by both parties", so nothing binds the owner until they sign.
- `engage_professionals`: `recommend` | `request_quotes`. The system may email firms for availability and fee quotes; the owner signs the engagement letter.
- Everything binding (contracts, engagement letters, wires) always needs the owner. This is not configurable.

## Services the system needs (owner sets these up once)
| Need | Service | Status check |
|---|---|---|
| Send/receive email | Gmail connector (drafts + reading). Fully automatic sending needs a sending service, e.g. Resend, connected with its key saved as a network secret | If only Gmail drafts are available, outbound email lands in the owner's Drafts and the owner clicks Send |
| Physical letters | A print-and-mail API (e.g. Lob or PostGrid) with the key saved as a network secret | Without it, letters are PDFs the owner mails |
| E-signature | DocuSign (connector) or another e-sign API | Without it, the owner gets PDF signature packets |
| Phone numbers | Skip-trace service (optional) | Without it, mail and email only |
| Do-Not-Call scrubbing | National DNC registry access plus each state's list | Without it, **no** calls or texts are drafted |

If a service is missing, the system degrades to the next-best manual step and lists it in the report. It never pretends something was sent.
