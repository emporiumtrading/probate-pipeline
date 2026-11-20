# Daily probate pipeline: how it runs

- A dedicated Claude session, **"Probate pipeline daily runner"**, was created with this repository attached, so it can push to GitHub and refresh the dashboard. It was self-tested on 2026-11-20: push OK, dashboard tool OK.
- A scheduled task, **"Daily probate pipeline"**, sends that session a message every day at **5:39 AM America/Chicago** telling it to run `.claude/skills/probate-wholesale-deal/references/daily-run.md` end to end and push.
- The earlier API-created routine (which couldn't push) was deleted.
- If the runner session is ever archived or deleted, recreate it with this repository as its source and point the scheduled task at the new session.
- Known leftover: a `runner-push-test` branch from the self-test; the session proxy blocks branch deletion, so delete it on GitHub by hand if you like (harmless).
