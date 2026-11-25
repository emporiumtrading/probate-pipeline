# How the team learns

Every worker meets situations its instructions don't cover. When that happens, don't guess, and don't stop the run.

Every run, each worker also checks its own thinking against its measured results: see `self-review.md` (predict, compare, change one thing, log it).

## When you're not sure
1. **Handle it safely today.** Choose the most cautious option: don't send, don't commit to a price, don't change a stage forward. Hand it to the Exceptions Desk (`handoffs.py add --to exceptions-desk`), which decides it within the written limits or, only if it truly needs the owner (signature, money beyond the limits, an attorney-only legal question, anything outside written limits), escalates it with a recommendation.
2. **Find the answer.** Check primary sources: the statute, court rule, county page, or the attorney's written answer. Record the source URL and date. If it's a legal question, it goes on the attorney question list in `legal/<STATE>.md` until the attorney answers. Your own reading of a law is not an answer.
3. **Write it down so it doesn't happen again.** Add a rule to your own role file (`agents/<role>.md`) under `## Learned`, one bullet each:
   `- YYYY-MM-DD: <the rule, in one or two sentences>. Why: <the case that showed it (lead id or market)>. Source: <url or file>.`
   If the rule is about a state, put it in `legal/<STATE>.md` instead. If more than one worker does the same kind of work (for example, any owner-name search), put the rule in the shared method in `references/daily-run.md` as well, so every worker gets it. If it's about a county source, put it in `pipeline/sources-log.md`.
4. **Report it.** List every instruction you added or changed under **What the team learned** in the daily report, with the file and line.

## When a whole new worker is needed
If the gap isn't one rule but a missing kind of work, follow `references/new-worker.md` (justification test, owner approval when needed, role-file shape, wiring checklist). A new worker starts in `trial` and is enabled only by its measured results (`references/worker-lifecycle.md`).

## What you may never change by learning
- The **Hard limits** section of `references/daily-run.md`, `config.yaml` → `autonomy` (including the fee limits the workers decide within), `config.yaml` → `lead_types` (which types are on, and the days-after-death wait), `attorney_approved` (except by the Legal Advisor's approval steps), the Compliance Officer's gate, the stop list, and anything the owner alone does (signatures, wires, calls).
- Any check, cap or threshold, if the change makes it looser, including `config.yaml` → `worker_lifecycle`. Tightening is fine; loosening is a proposal for the owner, through the Exceptions Desk.
- A worker's lifecycle status (`pipeline/workers.csv`): it changes only through `scripts/worker_lifecycle.py` on measured scores (`references/worker-lifecycle.md`), never by editing the registry.
- A rule that contradicts an existing rule. Propose it in the report with both versions instead of editing.

`scripts/qa_checks.py` fails the run if the Hard limits section, the autonomy block or the lead_types block changes without the owner updating `scripts/guardrails.sha256`.
