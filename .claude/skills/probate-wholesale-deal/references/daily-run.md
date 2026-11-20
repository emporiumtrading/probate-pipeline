# Daily Pipeline Run

Use this when the skill runs on a schedule inside the pipeline repo (it has `config.yaml`, `pipeline/deal-tracker.csv`, `leads/`, `reports/`, `legal/`). Each run starts in a fresh session with no memory: **the repo is the memory.** Read state from it at the start, write everything back, commit and push at the end. A run that does great work but doesn't push has done nothing.

Work in depth, not breadth: a few leads researched properly beat fifty half-checked names. Respect `max_new_leads_per_day`.

## Hard limits (every run)
- **Contact only as `config.yaml` → `autonomy` allows**, and only after the Compliance Officer passes the item. With `outreach: drafts_only`, nothing is sent. With `autonomous`, the Communications worker sends mail/email through connected services. Never phone or text automatically. Nothing binding is ever signed for the owner, and no money or bank details are ever handled.
- Public records only. Don't create accounts, bypass logins, CAPTCHAs, paywalls or rate limits, and don't automate any site whose robots.txt disallows the pages you need or whose terms of use ban automated or commercial use. Honor any `Crawl-delay` in robots.txt (including one set for ClaudeBot or other AI crawlers) and apply a parent domain's robots.txt to its subdomains when the subdomain has none. Mark such sources `manual only` in the sources log and give the owner the manual search link. If a site blocks or rate-limits you, back off, log it in `pipeline/sources-log.md`, and move on.
- Personal data (names, addresses, phone numbers of executors/heirs) stays in this private repo. Don't paste it into outside services beyond the searches needed to research it.
- Markets with `outreach_allowed: false` get research and underwriting only; no outreach drafts.
- Autonomous sending needs both `autonomy.outreach: autonomous` and `attorney_approved: <date>` on the market. Any market without that date stays drafts-only, whatever the global setting says.
- Label everything verified (with source + date) or assumed.

## Steps

### 0. Sync with GitHub
Before reading anything:
1. `git fetch origin main`.
2. If `git log origin/main..HEAD` shows commits, an earlier run saved work but its push failed. Rebase them onto the latest `main` (`git pull --rebase origin main`) and push them now. Put "Recovered unpushed work from <date>" at the top of today's report.
3. If there are uncommitted changes (`git status --porcelain`), an earlier run stopped before saving. Commit them as `Recovered partial run <date>` and push them the same way.
4. Otherwise `git pull --rebase origin main`, so today's run starts from what you and the owner's other sessions last pushed.
If a rebase hits a conflict, `git rebase --abort`, leave the work as it is, and report the conflicting files at the top of the report and of your final message. Don't force-push, and don't resolve a conflict by discarding someone else's changes.

### 1. Load state
Read `config.yaml`, `pipeline/deal-tracker.csv`, the latest file in `reports/`, `pipeline/sources-log.md`, and `legal/*.md`. Note today's date in the owner's timezone.

### 2. Legal refresh (Legal Advisor)
For each market's state: if `legal/<STATE>.md` is missing or its "Last verified" date is older than `legal_recheck_days`, follow `agents/legal-advisor.md` to research current wholesaling, probate-sale and contact rules, with priority on laws passed or effective in the last two years. Write `legal/<STATE>.md` with: Last verified date, rules table (rule, source URL, date, verified/unverified), blocking issues, required contract disclosures. If something changed since the last version, put it at the top of today's report.

### 2b. Source map (Source Mapper)
Follow `agents/source-mapper.md`: fill gaps and re-test sources in `pipeline/coverage.csv` for live markets and the next queued counties, preferring open data and bulk downloads, with statewide public-notice sites as backups. The Researcher and Heir & Title Tracer use the sources marked `works` there.

### 3. Lead sourcing (Researcher)
For each market, search the probate source for estate filings since `last_checked` (or `lookback_days_first_run` on the first run). For each filing, check the auditor/assessor/property site for real property in the decedent's name. Keep only filings with real property in the county. Skip any lead already in the tracker (match case number or parcel). Rank new candidates by: equity signals, vacancy/distress, out-of-state representative, filing age 1–12 months. Take the top `max_new_leads_per_day` across all markets. Update each market's `last_checked` in `config.yaml`. Log each source's result (worked / blocked / changed layout / no results) in `pipeline/sources-log.md`.

When matching a decedent to a parcel owner, don't treat Jr./Sr./II/III as interchangeable (a "Sr." decedent and a "Jr." owner are different people), If the deed history shows a sale to an unrelated buyer after the date of death, drop the parcel. If it shows a transfer to heirs (certificate of transfer, affidavit of heirship, deed of distribution), keep it as a `post_probate_heirs` lead when that type is enabled.

If a source can't be searched automatically, say so plainly in the report with the manual search URL. Don't invent leads.

### 3-types. Other lead types
For each type enabled in `config.yaml` → `lead_types`, search its sources (see `references/lead-types.md`) in each live market and add candidates to the same ranking. Every candidate that isn't type `probate` goes to the Heir & Title Tracer (`agents/heir-tracer.md`) before the deep-dive. A type whose state legal file doesn't cover its signing authority is research only until the Legal Advisor adds that section.

### 3a. Manual name feeds
Where probate notices can only be read by hand (robots.txt or terms forbid automation), the owner or an assistant may paste names into `pipeline/manual-feeds/<market-id>.csv` with columns `case_number,decedent,date_of_death,notice_date,personal_rep,attorney,source_url`. Each run, for every market with a feed file: take rows not yet processed, match each decedent against that market's working parcel layer by owner name (same rules as step 3: last name + first name/initial, Jr/Sr distinct, skip common-name collisions and deeds after death), and treat confirmed matches as new leads for step 4. Mark processed rows by appending `processed: <date>` to `pipeline/manual-feeds/<market-id>.log`. A market with a feed file and a working parcel layer counts as Live even if its notice source is manual only.

### 3b. Expand to new markets
The goal is coverage across as many US states as can be worked legally and reached through public records. Each run, take the next `expansion_per_run` counties from `expansion_queue` in `config.yaml`:
1. Legal Advisor first: if `legal/<STATE>.md` is missing, write it (step 2). If the state requires a license to wholesale and `licensed_or_partnered` isn't true for that state, add the market as research-only (`outreach_allowed: false`); its leads can never be GO/NEGOTIATE and won't show on the dashboard.
2. Source Mapper (`agents/source-mapper.md`) fills this county's rows in `pipeline/coverage.csv`, open data first. Researcher: find a public, no-login probate filing index for the county (court case search by filing date, or published Notices to Creditors) and a public parcel source with owner names (county ArcGIS REST parcel layer, assessor open data). Test one small query each, slowly.
3. If both work, add the market to `markets` with its source URLs and `last_checked: null` so step 3 picks it up next run. If not, record why in `pipeline/sources-log.md` and mark it `status: blocked` in the queue so it isn't retried for 30 days.
Remove processed counties from the queue. Never bypass blocks, logins or CAPTCHAs to make a county work.

### 3c. Plan to the monthly target
`config.yaml` → `targets.closings_per_month` sets the goal (currently 3 for the first 90 days). Each run:
1. Measure the funnel from the tracker: leads researched → opportunities → contacted → in conversation → offers → verbal → under contract → closed, per month, and the conversion rate between each step (use the defaults in `targets.assumed_rates` until there are 3 months of real data).
2. Work backwards from the target to what this run must produce: new qualified leads needed per day, counties needed, letters/emails needed, buyers needed.
3. Raise throughput to close the gap, in this order: open more markets (step 3b, up to `targets.max_expansion_per_run`), raise `max_new_leads_per_day` up to `targets.max_leads_per_day`, quick-screen everything and deep-dive only the top-ranked, and add follow-up touches up to the compliance caps. Never loosen the compliance gate, the frequency caps or the owner-signature rule to hit a number.
4. Report the gap honestly in the report's top section: "Pace: X closings vs 115 target; need N more qualified leads/day; bottleneck: <stage>".

### 4. Deep-dive each new lead
Create `leads/<lead_id>/` (lead_id = `<market-id>-<case number or parcel>`), then run the team in order, each writing its own file:
- `research.md` — `agents/researcher.md`
- `underwriting.md` — `agents/deal-analyst.md`, with `scripts/deal_calc.py --sensitivity` output pasted in
- `legal.md` — lead-specific issues from `agents/legal-advisor.md` (authority, court approval, price floors, state disclosures), referencing `legal/<STATE>.md`
- `title.md` — desk title/lien check from public records per `agents/transaction-coordinator.md`; list what still needs a real title search
- `plan.md` — Deal Summary (format in SKILL.md), negotiation plan (`agents/negotiator.md`), and buyer fit (`agents/dispositions.md`)
- `outreach-drafts.md` — only if the market allows outreach and the verdict isn't WALK AWAY: first letter + call script from `agents/acquisitions.md`, with the assignment disclosure and any state-required wording

Add/update the lead's row in `pipeline/deal-tracker.csv` (stage, verdict, MAO, next_action, next_action_date).

### 5. Maintain the existing pipeline
For every open lead in the tracker (not WALK AWAY / CLOSED / DEAD):
- Re-check its probate docket for changes (letters issued, sale motion, inventory/appraisal filed, case closed, new attorney). Note changes in the lead's `research.md` with the date.
- If `next_action_date` is today or past: prepare what the action needs (follow-up letter draft, updated numbers, questions for attorney) and list it under "Needs your approval".
- If the owner left notes in the tracker `notes` column or in `leads/<id>/owner-notes.md`, act on them (e.g. "spoke to executor, wants $80k" → re-run negotiator plan).
- Mark leads stale after 6 months with no movement.

### 5a. Date of death
Every lead needs `date_of_death` in the tracker, taken from the case file, the death notice in the docket, an obituary or a recorded affidavit (note the source in `leads/<id>/research.md`). Each run, fill it in for any lead that's missing it, starting with leads that have drafted outreach. No first letter goes out until `lead_types.min_days_after_death` (90) days after that date. If the date can't be found, the filing date is used.

### 5b. Communications, negotiation, professionals, closing
Following `references/orchestration.md`, run these workers (in parallel where possible):
- **Communications**: send what's due (compliance-gated), read the inbox, route replies.
- **Negotiation desk**: answer counters within authority; re-price with the Deal Analyst when facts change; move agreed deals to "Contract out for signature" with the contract built from the attorney-approved state template.
- **Professional Network**: for every live market with no engaged attorney/title company (the attorney packet needs one before any deal does), build or refresh `network/<market>.md` and request quotes if allowed.
- **Buyer-list builder** (`agents/buyer-list.md`): every live market, every run, keep `pipeline/buyers/buyers.csv` growing from public deed records; warn when a market with a deal under contract has fewer than 5 vetted buyers.
- **Reply desk** (`agents/reply-desk.md`): process `pipeline/inbox/`, log to `pipeline/inbox-log.csv`, and list every reply waiting more than one business day under Top of mind.
- **Dispositions desk**: for deals under contract, match and contact vetted buyers (compliance-gated).
- **Closing desk**: for every contract, track deadlines and update the signature and wire queues.

### 6. Daily report
If `legal/<STATE>.md` changed this run, rebuild that market's attorney packet: `python3 scripts/build_attorney_packet.py <market-id>`.

Write `reports/YYYY-MM-DD.md`:

```
# Probate Pipeline — YYYY-MM-DD
## Top of mind
- [legal changes, deals that changed status, anything urgent]
## Your queues
### Sign
### Wire (confirm by phone with title first)
### Calls requested
### Exceptions (outside authority or held by compliance)
## Needs your approval (only if outreach is drafts_only)
| Lead | What | File |
## New leads today (N)
| Lead | Market | Verdict | ARV | MAO | Why |
## Best opportunities in pipeline (top 5)
## Follow-ups due
## Pipeline snapshot
counts by stage and market
## Source health
| Market | Source | Status | Manual link if blocked |
## Notes & assumptions
```

Keep the report short enough to read on a phone in five minutes; details live in `leads/`.

### 7. QA, then refresh the dashboard
1. Build the dashboard data with the repo's builder (never hand-write the CSVs): `python3 scripts/build_dashboard_data.py <scratch>/dd`. It writes leads, queues, markets (all 50 states + DC), stages, sources (working only), runs and pace, with names and contact details left out.
2. Run the regression gates: `python3 scripts/qa_checks.py <scratch>/dd` (data) and `python3 scripts/check_page.py` (page code: syntax, cross-script scope, drawings). Any change to `dashboard/index.html` must pass `check_page.py` before it is published. If it exits non-zero, **don't publish**. Fix the underlying lead files or tracker rows (or, if a check is wrong, fix the check and say why in the report), rebuild and re-run. Report every WARN line in the report's Notes section.
3. Self-review before publishing (meta-check): compare today's numbers to yesterday's report. Any opportunity count, total earnings or stage count that moved by more than 50% without a matching explanation in today's work is investigated before publishing.
4. If `config.yaml` has `dashboard_slug`: `upload_asset` the CSVs, then for each `datasets/<name>` (leads, queues, markets, stages, sources, runs, pace) `db_get` its version and `db_write` an `update` with `ifVersion`, setting `source.url` and `updated: {at, by: "Daily run"}` (use `set` for a dataset that doesn't exist yet). Don't touch `files/index.html`; the page lives in `dashboard/index.html` in the repo and changes only when the owner asks.
5. After writing, read `data/users/<your id>/check` and `runs` (via `db_whoami`) if present and fix any failure they name.

### 7b. Learn
Follow `references/learning.md`: every worker that met something its instructions didn't cover today writes the rule into its own file under `## Learned`, and the report lists it under **What the team learned**. The Legal Advisor also processes any attorney reply to a packet (its section "Recording attorney approvals").

### 8. Save
`git add -A && git commit -m "Daily run YYYY-MM-DD: N new leads, M updates"` and push to the default branch, retrying network errors up to 4 times with backoff. If the push fails, say so at the top of your final message. Never create or push other branches: the session proxy blocks branch deletion, so any branch you push stays behind as clutter. If the push to the default branch is rejected because `main` moved (someone else pushed first), `git pull --rebase origin main` and push again, up to 3 times. On a rebase conflict, follow the conflict rule in step 0. If the push is refused for any other reason, or still fails, leave the commit local (step 0 of the next run pushes it) and report the exact error rather than pushing to a fallback branch.

Also save midway: after step 5, commit `Daily run YYYY-MM-DD (checkpoint)` and push the same way, so a run that stops partway doesn't lose its research. Run the dashboard step (7) only on the final save.
