# Self-review: how every worker checks its own thinking

`learning.md` covers the moment a worker meets something its instructions don't cover. This file covers every run: each worker predicts what it will produce, checks the result against the prediction, finds out why they differ, and changes how it works. The aim is the highest yield for that worker's own job, measured from real output, never from feelings or guesses.

## Your yield
Your yield is your row in the dashboard's `workers.csv` (built by `scripts/build_dashboard_data.py`): **results ÷ work done**, with both counted from the files you produced. Funnel rates (researched → opportunity → conversation → contract → close) are measured from the tracker and published in `pace.csv` (`rate_*`, with `src_*` = measured / blended / assumed). Work from those numbers. A number marked `assumed` is not a fact: say so wherever you use it.

## The loop (every run, every worker that did work)
1. **Before: predict.** Write one line: what you expect to produce this run and your expected yield, based on your measured rate (for example "screen 20 Harris filings, expect 14 GO/NEGOTIATE at the measured 0.80"). Name the one or two assumptions the prediction rests on.
2. **During: rate your confidence.** Mark each output you hand on as high, medium or low confidence, with the one fact that would change it. Low-confidence items go to the Quality Auditor's sample first.
3. **After: compare.** Put the actual next to the prediction. If they differ by more than 20% (or by 2+ items on small counts), find the cause in your own evidence: a source that changed, a filter too loose or too tight, a wrong comp, a market that behaves differently. Don't stop at "bad luck" unless the evidence shows it.
4. **Change one thing.** Choose the single change most likely to raise your yield next run: a better search order, a tighter screen, a different source, spending deep-dive time on the highest-ranked leads. If it should become a lasting rule, write it under `## Learned` in your role file (format in `learning.md`).
5. **Log it.** Append one row to `pipeline/self-review.csv`:
   `date,worker,metric,predicted,actual,cause,change,evidence`
   (`evidence` = file or lead id). One row per worker per run. Never edit old rows.

## Weekly calibration (Quality Auditor, Mondays)
Read the last 7 days of `pipeline/self-review.csv` together with `workers.csv` and `pace.csv`:
- **Calibration:** for each worker, how often actual was within 20% of predicted. A worker that is regularly over-confident lowers its next predictions to its measured rate.
- **Biggest yield leak:** the funnel step with the largest gap between what the goal needs and what is happening. Name the worker that owns it and the one change it should make.
- **Handoff board:** from `pipeline/handoffs.csv`, each worker's average time to answer, items escalated, and questions asked again and again. A question that keeps coming back means a rule belongs in someone's role file; a kind of question no worker owns means a new worker may be needed (`references/new-worker.md`).
- **Did the changes work:** compare each worker's yield before and after its logged changes. Keep what raised yield and revert what didn't (revert = write the reversal as a new `## Learned` bullet).
Put the findings under **What the team learned** in that day's report.

## Limits
Self-review makes the work better. It never makes the rules looser. Everything in `learning.md` → "What you may never change by learning" applies: no change to hard limits, autonomy, compliance, caps, the stop list or anything only the owner does, and no invented or unchecked numbers to make a yield look better. A change that would need a looser rule goes to the owner under **Exceptions**.
