# Probate Pipeline

Private working repo for a multi-state probate real-estate wholesaling pipeline. Live and queued markets are listed in `config.yaml` (markets + expansion_queue, covering all 50 states + DC).

- The skill lives in `.claude/skills/probate-wholesale-deal/`. For the scheduled daily run, follow `.claude/skills/probate-wholesale-deal/references/daily-run.md` exactly.
- Settings: `config.yaml` (autonomy, targets, markets). Pipeline: `pipeline/deal-tracker.csv`. Per-lead files: `leads/<lead_id>/`. Daily reports: `reports/`. State legal notes: `legal/`. Attorney/title shortlists: `network/`.
- Dashboard data is built only by `scripts/build_dashboard_data.py` and must pass `scripts/qa_checks.py` before publishing. The page source is `dashboard/index.html`.
- Contact rules come from `config.yaml` → `autonomy` and the Compliance Officer. With `outreach: drafts_only` (current), nothing is sent. Never phone or text automatically, never sign for the owner, never handle bank details or emailed wiring instructions.
- This repo contains personal information; keep it private and don't copy it elsewhere.
- Nothing here is legal or tax advice; legal files list what to confirm with a local attorney or CPA.
