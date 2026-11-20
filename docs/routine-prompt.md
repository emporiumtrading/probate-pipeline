# Daily probate pipeline: how it runs

- A dedicated Claude session, **"Probate pipeline daily runner"**, was created with this repository attached, so it can push to GitHub and refresh the dashboard. It was self-tested on 2026-11-20: push OK, dashboard tool OK.
- Three scheduled tasks send that session a message every day (America/Chicago): **"Daily probate pipeline (A: morning)"** at 5:39 AM (Tampa, Columbus, legal refresh, source map), **"(B: midday)"** at 12:23 PM (Houston, Memphis, Philadelphia, expansion) and **"(C: evening)"** at 5:41 PM (pipeline upkeep, communications, buyers, replies, the day's report). Each one follows the "Staggered schedule" section of `.claude/skills/probate-wholesale-deal/references/daily-run.md`, runs QA, refreshes the dashboard and pushes.
- The earlier API-created routine (which couldn't push) was deleted.
- If the runner session is ever archived or deleted, recreate it with this repository as its source and point the scheduled task at the new session.
- The session proxy blocks deleting branches on GitHub (HTTP 403), but pushing to `main` works. So the runner never creates branches: it commits and pushes straight to `main`. Future self-tests use `git push --dry-run origin HEAD:main` instead of a throwaway branch. The 2026-11-20 test branch `runner-push-test` was deleted by hand on GitHub.
