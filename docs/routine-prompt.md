# Daily probate pipeline: how it runs

- A dedicated Claude session, **"Probate pipeline daily runner"**, was created with this repository attached, so it can push to GitHub and refresh the dashboard. It was self-tested on 2026-11-20: push OK, dashboard tool OK.
- A scheduled task, **"Daily probate pipeline"**, sends that session a message every day at **5:39 AM America/Chicago** telling it to run `.claude/skills/probate-wholesale-deal/references/daily-run.md` end to end and push.
- The earlier API-created routine (which couldn't push) was deleted.
- If the runner session is ever archived or deleted, recreate it with this repository as its source and point the scheduled task at the new session.
- The session proxy blocks deleting branches on GitHub (HTTP 403), but pushing to `main` works. So the runner never creates branches: it commits and pushes straight to `main`. Future self-tests use `git push --dry-run origin HEAD:main` instead of a throwaway branch. The 2026-11-20 test branch `runner-push-test` was deleted by hand on GitHub.
