# Full autonomy: running without the owner

The owner turns this on with the **Full autonomy** switch on the dashboard, only after every pre-flight check passed (`web/preflight.js`). The runner tells each run when it is on. While it is on, the owner hears about three things only, sent by `runner/notify.py`:
1. **A signature is needed** (the Sign queue: one-tap e-signature on a packet the system prepared).
2. **A deposit is confirmed** (the title company received the earnest money).
3. **A deal closed**, with its profit from the ledger's documented rows.

And, separately, at most one email a day if the system itself has stayed broken for 24 hours despite the automatic repairs (every run failed, or no AI engine finished a run), saying what's wrong and what would fix it (owner decision 2026-11-26).

Everything else is decided by the workers and the Exceptions Desk, within the written limits in `config.yaml` → `autonomy`, and logged in `pipeline/decisions-log.csv` with the reason.

## What changes
- **Nothing new goes `--to owner`.** The only owner actions are the Sign queue and the earnest-money escrow confirmation (Wire queue), which the system prepares and the notices announce. Don't create other owner handoffs, owner questions or owner approvals. Existing owner items stay as they are.
- **The Exceptions Desk decides instead of escalating**, for every kind it would have escalated:
  - **Money beyond the written limits** (a fee, a price, a cost): stay inside the limit. Decline, find another provider or buyer, or counter within the limit. Never exceed it.
  - **A rule or a limit would have to change**: never change it. Work within it, or let that lead wait.
  - **A legal question only an attorney can answer**: ask the attorney through the Legal Advisor's matter. The lead waits for the answer; it doesn't go to the owner.
  - **An ethical risk** (a grieving or confused person, a possible minor or incapacitated heir, a dispute between heirs, anything that could hurt someone): take the most protective option. Stop contact, walk away from the lead, or wait for an attorney or court process. Never press on.
  - **No option fits within the limits**: park it. In `pipeline/exceptions.csv` keep `owner_needed: no`, put `parked (full autonomy): <reason>` in `resolution`, and look at it again in 7 days.
- **Reports keep being written** (`reports/`), for the record and the dashboard, but they ask the owner for nothing.

## What never changes
- The Hard limits in `daily-run.md`. Nothing binding is signed for the owner, no money or bank details are handled, nobody is phoned or texted automatically, public records only.
- Every outbound message still needs the Compliance Officer's PASS, the market's `attorney_approved`, a tested channel and the 90-day wait after death.
- Earnest money goes only to a title company's escrow that the owner confirmed by phone. Wiring instructions that arrive by email are never acted on.
- The self-repair rules (`references/self-repair.md`) and the guardrails.
