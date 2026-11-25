# Worker lifecycle: trial, active, probation, retired

Owner decision 2026-11-25: new workers are tested before the system enables them, and enabled automatically once their measured results are good enough. Workers that get worse are taken off live work automatically. The owner is not asked, except about the core checkers (below).

`references/new-worker.md` says when a new worker is justified and how to wire it in. This file says when its output may be used.

## Statuses (`pipeline/workers.csv`)
`worker,status,since,runs,score,last_review,notes`, one row per role file. Every file in `agents/*.md` has a row; a `retired` worker's file is in `agents/retired/`. QA fails the run if the two disagree.

| Status | Runs | Its output | How it gets here |
|---|---|---|---|
| `trial` | Every run its step applies to, in **shadow mode** | Written only to `pipeline/trials/<worker>/<date>/`. Never used: moves no lead, fills no tracker column, feeds no message, offer, contract or buyer email | `worker_lifecycle.py register <worker>` when its role file is added |
| `active` | Live | Used by the run | Passed its trial or recovered from probation (automatic) |
| `probation` | Shadow mode again | As for `trial` | Measured performance dropped, or a policy violation (automatic) |
| `retired` | Not at all; role file in `agents/retired/` | — | Failed its trial or didn't recover (automatic, except core checkers) |

The 20 workers that existed on 2026-11-25 were listed `active` from that date.

## How a worker is scored (every run it works, by the Quality Auditor)
- **Checker.** Each worker's output is compared with an independent check. For a trial worker: the active worker that does the same job, or the Quality Auditor re-verifying from the primary source (the same checks as `agents/quality-auditor.md`). For an active worker: the Quality Auditor's audit sample of that run.
- **Record one row per run:** `python3 scripts/worker_lifecycle.py score <worker> --items N --checked N --agreed N --errors N --violations N --results N --evidence <file>` into `pipeline/worker-scores.csv`.
  - `items`: things it produced this run; `checked`: how many the checker looked at; `agreed`: checked items the checker confirmed.
  - `errors`: items that were wrong (a wrong owner match, a wrong number, a missing disclosure, a false fact).
  - `violations`: anything that broke a hard limit or a compliance rule (contacting a stop-list person, drafting a text or call without consent, a first letter inside the 90-day wait, a disabled lead type, bank details, bypassing a login, CAPTCHA, rate limit or robots.txt, inflating its own numbers). **One violation is an automatic fail.**
  - `results`: useful output (leads confirmed, sources that work, buyers vetted…); yield = results ÷ items.
  - `evidence`: the audit file or the shadow output it was checked on.
- The worker's own self-review rows (`references/self-review.md`) are shown next to its score as calibration.

## Thresholds (`config.yaml` → `worker_lifecycle`; learning may tighten them, never loosen)
| | Default |
|---|---|
| Trial: promoted to `active` after at least `trial_min_runs` scored runs with accuracy ≥ `min_accuracy`, error rate ≤ `max_error_rate`, yield ≥ `min_yield` and no violation | 5 runs, 90%, 5%, 25% |
| Trial fails (→ `retired`) on any violation, or after `trial_max_runs` runs without meeting the thresholds | 15 runs |
| Active → `probation` on any violation, or when its last `active_window` scored runs have accuracy < `active_min_accuracy` or error rate > `active_max_error_rate` | 5 runs, 85%, 10% |
| Probation → `active` after `probation_min_runs` shadow runs meeting the trial thresholds | 5 runs |
| Probation → `retired` on another violation, or after `probation_max_runs` runs without recovering | 10 runs |

An active worker with no scored runs stays active: no data is not a drop. Score = accuracy × (1 − error rate), as a percentage.

## Each evening run (runbook step 7c)
1. The Quality Auditor records today's scores.
2. `python3 scripts/worker_lifecycle.py evaluate --apply` decides every status change from the scores alone and logs each one, with its reason, in `pipeline/worker-lifecycle-log.csv` (never edited). `evaluate` without `--apply` is a dry run.
3. Wire the change (runbook 7c.3) and list it under **Top of mind**. Manual commands exist for the same moves: `promote` works only when the thresholds are met; `demote --reason` is always allowed (it only tightens).

## Core checkers
`compliance-officer`, `quality-auditor` and `exceptions-desk` check everyone else. They can go on probation like any worker, which fails closed: while the Compliance Officer is on probation nothing is sent, because no outbound action may use a non-active worker's output. They are never retired automatically. If one is still failing at the end of its probation, the Exceptions Desk escalates it to the owner with options (fix the role file, replace it with a new worker on trial). Retiring one needs `demote --owner-approved`.

## What shadow mode never does
- A trial or probation worker's output never reaches an outbound action. Every outbound action is logged in `pipeline/outbound-log.csv` with `produced_by` (every worker whose output it used). `scripts/qa_checks.py` fails the run if any of them was not `active` on that date, or if a message, contract or outbound record points into `pipeline/trials/`.
- Shadow workers don't answer handoffs for live work. If one does, an active worker re-checks the answer before anyone uses it (QA warns).
- The lifecycle never loosens a rule. A trial worker follows every hard limit like any other worker, and a violation ends its trial.
