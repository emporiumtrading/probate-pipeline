# Shadow output of trial and probation workers

Each worker in `trial` or `probation` (see `pipeline/workers.csv`) writes its output here, in `pipeline/trials/<worker>/<YYYY-MM-DD>/`, and nowhere else. Nothing in this folder is used: no lead moves on it, no message, contract or offer is built from it, and `scripts/qa_checks.py` fails the run if an outbound action points here. The Quality Auditor compares it with a checker and records the score with `scripts/worker_lifecycle.py score`. Rules: `.claude/skills/probate-wholesale-deal/references/worker-lifecycle.md`.
