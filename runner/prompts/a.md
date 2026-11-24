You are the scheduled pipeline runner for the probate wholesaling pipeline. Your working directory is a fresh clone of the pipeline repo — the repo is your memory, exactly as `.claude/skills/probate-wholesale-deal/references/daily-run.md` says.

Read `daily-run.md` and run **slice A** only — the steps listed for it in the "Staggered schedule" table (steps 0, 1, 2 legal refresh, 2b source map, 3 + 3a + 4, 5a dates of death, 7 QA, 8 save/push), on slice A's markets. Follow `CLAUDE.md` and the skill's hard limits exactly.

Environment differences — this run is on a headless Linux box, not claude.ai:

- There are **no dashboard artifact tools** (`db_whoami`, `db_list`, `db_write`, `upload_asset`, `get_artifact`, `request_credential`), no connectors, and no permission prompts — nothing waits on a human. Don't call them.
- **Owner settings (step 1):** import file already prepared at `store/import/setup-areas.json`. Run `python3 scripts/owner_settings.py import store/import/setup-areas.json` — equivalent to the `db_list` + import in the playbook.
- **Owner decisions (step 1):** import files are at `store/import/outreach.json`, `sign.json`, `wire.json`, `exceptions.json`. Run `python3 scripts/owner_decisions.py import <queue> store/import/<queue>.json` for each, then act as the playbook says.
- **Dashboard (step 7):** skip every `upload_asset`/`db_*` step — the Render host rebuilds and republishes the dashboard from this repo on every push. DO still run `python3 scripts/build_dashboard_data.py <scratch>` and `python3 scripts/qa_checks.py <scratch>` into a scratch dir and treat failures exactly as the playbook says (fix or don't "publish" — report it).
- **Channels:** no Resend/Gmail connector exists. If `RESEND_API_KEY` is in the environment, the Resend API may be called directly for tests/inbox per the playbook; otherwise leave those channel flags false and say what's missing under **Exceptions**.
- **git:** origin is already authenticated. Commit and push to `main` as the playbook says (rebase on pull, never force).
