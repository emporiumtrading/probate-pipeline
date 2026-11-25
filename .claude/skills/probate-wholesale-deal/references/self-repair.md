# Self-repair: fix what broke, before the run's normal work

The runner adds this step to a run when a recent run failed, a check failed, or a source broke today (`runner/workload.py` → `repair`). Spend at most 25 minutes on it, then do the run's normal job.

## What to read
1. `pipeline/runner-health.csv`: the last runs (slice, engine, model, result, verify, notes).
2. The newest files in `pipeline/runner-failures/`: the tail of each failed attempt's output.
3. Today's rows in `pipeline/sources-log.md` marked blocked, changed layout, error or failed.

## What to do
1. **Find the cause.** Reproduce it with the smallest command that fails (run the script, the query or the check again). Write down the cause in one sentence before changing anything.
2. **Fix the smallest thing that removes the cause.**
   - A script bug: fix the code under `scripts/` and keep its behaviour the same everywhere else.
   - A source that changed layout or moved: update the query or parser, or switch to another source marked `works` in `pipeline/coverage.csv`, following `agents/source-mapper.md`. A source that now blocks automated use, or whose robots.txt or terms forbid it, is marked `manual only`. Never work around a block.
   - Bad data written by an earlier run: correct it from the source records, never by guessing.
3. **Test it.** Run the failing command again, then the full checks:
   `python3 scripts/build_dashboard_data.py /tmp/repair-data && python3 scripts/qa_checks.py /tmp/repair-data`
   Both must pass. If you changed anything the dashboard page uses, also run `python3 scripts/check_page.py`.
4. **Record it.** Append a row to `pipeline/repairs-log.csv` (`date,slice,cause,fix,files,tested`) and commit it with the fix (`Self-repair: <cause>`).
5. **If you can't fix it in the time**, leave the code as it was, and add a handoff to `exceptions-desk` with the cause and what you tried (`python3 scripts/handoffs.py add --from quality-auditor --to exceptions-desk --kind blocker ...`).

## Never
- Never change the guardrails: the Hard limits in `daily-run.md`, `autonomy` and `lead_types` in `config.yaml`, `scripts/guardrails.sha256`, `scripts/qa_checks.py` or `scripts/check_page.py`. Never run `qa_checks.py` with `--owner-approve-guardrails`. Only the owner changes those.
- Never edit `runner/`, `web/`, `render.yaml`, `CLAUDE.md`, the role files, `full-autonomy.md` or this file to get a run through. A runner problem goes to `exceptions-desk` as above.
- Never skip, delete or loosen a check to get green. Never force-push or rewrite history.
- The runner restores any of the protected files above if a run changes them, and records that as a failure.
