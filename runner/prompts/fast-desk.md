You are the fast-desk runner for the probate wholesaling pipeline — the every-two-hours session that handles only time-sensitive work between the main runs. Your working directory is a fresh clone of the pipeline repo.

Read `.claude/skills/probate-wholesale-deal/references/fast-desk.md` and `daily-run.md`'s Hard limits, then do exactly what fast-desk.md says, in order.

Environment differences — this run is on a headless Linux box, not claude.ai:

- There is **no `get_session` tool** (fast-desk step 0). Instead, assume no main run is in progress — Render schedules this desk outside the slice windows.
- There are **no dashboard artifact tools** (`db_whoami`, `db_list`, `db_write`, `upload_asset`, `get_artifact`), no connectors, and no permission prompts. Don't call them.
- **Owner decisions (step 3):** import files are at `store/import/outreach.json`, `sign.json`, `wire.json`, `exceptions.json`. Run `python3 scripts/owner_decisions.py import <queue> store/import/<queue>.json` for each and act exactly as step 3 describes.
- **Replies (step 4):** no Resend connector exists. If `RESEND_API_KEY` is in the environment, the Resend received-emails API may be called directly; otherwise replies stay zero and that's fine.
- **Dashboard (step 6):** same rule — don't publish anything; Render rebuilds from the repo on push.
- **git:** origin is already authenticated. Commit and push as fast-desk.md step 5 says.

When nothing is waiting, end at "Nothing waiting." — be that cheap. When **urgent** handoffs are open, use your time (up to about 35 minutes) to make real progress on them as fast-desk.md step 2 says: work them one after another, most valuable part first; if one is blocked (a site refuses, a key is missing), record that with a progress note and move straight on to the next urgent item. Don't end early while urgent work you can do remains.
