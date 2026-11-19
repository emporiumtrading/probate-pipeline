# Daily Pipeline Run

Use this when the skill runs on a schedule inside the pipeline repo (it has `config.yaml`, `pipeline/deal-tracker.csv`, `leads/`, `reports/`, `legal/`). Each run starts in a fresh session with no memory: **the repo is the memory.** Read state from it at the start, write everything back, commit and push at the end. A run that does great work but doesn't push has done nothing.

Work in depth, not breadth: a few leads researched properly beat fifty half-checked names. Respect `max_new_leads_per_day`.

## Hard limits (every run)
- **Contact only as `config.yaml` → `autonomy` allows**, and only after the Compliance Officer passes the item. With `outreach: drafts_only`, nothing is sent. With `autonomous`, the Communications worker sends mail/email through connected services. Never phone or text automatically. Nothing binding is ever signed for the owner, and no money or bank details are ever handled.
- Public records only. Don't create accounts, bypass logins, CAPTCHAs, paywalls or rate limits. If a site blocks or rate-limits you, back off, log it in `pipeline/sources-log.md`, and move on.
- Personal data (names, addresses, phone numbers of executors/heirs) stays in this private repo. Don't paste it into outside services beyond the searches needed to research it.
- Markets with `outreach_allowed: false` get research and underwriting only; no outreach drafts.
- Label everything verified (with source + date) or assumed.

## Steps

### 1. Load state
Read `config.yaml`, `pipeline/deal-tracker.csv`, the latest file in `reports/`, `pipeline/sources-log.md`, and `legal/*.md`. Note today's date in the owner's timezone.

### 2. Legal refresh (Legal Advisor)
For each market's state: if `legal/<STATE>.md` is missing or its "Last verified" date is older than `legal_recheck_days`, follow `agents/legal-advisor.md` to research current wholesaling, probate-sale and contact rules, with priority on laws passed or effective in the last two years. Write `legal/<STATE>.md` with: Last verified date, rules table (rule, source URL, date, verified/unverified), blocking issues, required contract disclosures. If something changed since the last version, put it at the top of today's report.

### 3. Lead sourcing (Researcher)
For each market, search the probate source for estate filings since `last_checked` (or `lookback_days_first_run` on the first run). For each filing, check the auditor/assessor/property site for real property in the decedent's name. Keep only filings with real property in the county. Skip any lead already in the tracker (match case number or parcel). Rank new candidates by: equity signals, vacancy/distress, out-of-state representative, filing age 1–12 months. Take the top `max_new_leads_per_day` across all markets. Update each market's `last_checked` in `config.yaml`. Log each source's result (worked / blocked / changed layout / no results) in `pipeline/sources-log.md`.

When matching a decedent to a parcel owner, don't treat Jr./Sr./II/III as interchangeable (a "Sr." decedent and a "Jr." owner are different people), and drop any parcel whose deed history shows a certificate of transfer or sale to someone else after the date of death.

If a source can't be searched automatically, say so plainly in the report with the manual search URL. Don't invent leads.

### 3b. Expand to new markets
The goal is coverage across as many US states as can be worked legally and reached through public records. Each run, take the next `expansion_per_run` counties from `expansion_queue` in `config.yaml`:
1. Legal Advisor first: if `legal/<STATE>.md` is missing, write it (step 2). If the state requires a license to wholesale and `licensed_or_partnered` isn't true for that state, add the market as research-only (`outreach_allowed: false`); its leads can never be GO/NEGOTIATE and won't show on the dashboard.
2. Researcher: find a public, no-login probate filing index for the county (court case search by filing date, or published Notices to Creditors) and a public parcel source with owner names (county ArcGIS REST parcel layer, assessor open data). Test one small query each, slowly.
3. If both work, add the market to `markets` with its source URLs and `last_checked: null` so step 3 picks it up next run. If not, record why in `pipeline/sources-log.md` and mark it `status: blocked` in the queue so it isn't retried for 30 days.
Remove processed counties from the queue. Never bypass blocks, logins or CAPTCHAs to make a county work.

### 3c. Plan to the monthly target
`config.yaml` → `targets.closings_per_month` sets the goal (currently 115). Each run:
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

### 5b. Communications, negotiation, professionals, closing
Following `references/orchestration.md`, run these workers (in parallel where possible):
- **Communications**: send what's due (compliance-gated), read the inbox, route replies.
- **Negotiation desk**: answer counters within authority; re-price with the Deal Analyst when facts change; move agreed deals to "Contract out for signature" with the contract built from the attorney-approved state template.
- **Professional Network**: for any market with an active deal and no engaged attorney/title company, build or refresh `network/<market>.md` and request quotes if allowed.
- **Dispositions desk**: for deals under contract, match and contact vetted buyers (compliance-gated).
- **Closing desk**: for every contract, track deadlines and update the signature and wire queues.

### 6. Daily report
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

### 7. Refresh the dashboard
If `config.yaml` has `dashboard_slug`, update the dashboard artifact (use the claude-artifacts tools):
1. Write four CSVs to a scratch folder, keeping these exact columns:
   - `leads.csv`: **only leads whose verdict is GO or NEGOTIATE** (walk-aways and research-only leads stay in the repo), sorted by potential_earnings descending, with columns lead_id,address,city,market,state,stage,verdict,arv_mid,repairs_mid,buyer_max,target_price,mao,potential_earnings,asking,letters_issued,court_confirmation,next_action,next_action_date,touch_count,last_touch_date. `buyer_max` = ARV × buyer_pct − repairs; `target_price` = the Negotiator's target contract price (never above MAO; use MAO if no lower target); `potential_earnings` = buyer_max − target_price. City is the property's city, title case. Leave out executor/heir names and contact details, because anyone who can open the dashboard can read its files. Stage is one of: New, Researched, Outreach drafted, Contacted, Negotiating, Under contract, Assigned, Closed, Dead.
   - `approvals.csv`: lead_id,item,file,created (everything listed under "Needs your approval")
   - `sources.csv`: date,market,source,status,note: **only sources that worked** on their latest check (leave out blocked, rate-limited, no-response and unusable ones; those stay in `pipeline/sources-log.md` and the report).
   - `pace.csv`: month,target_closings,closed,under_contract,verbal_agreements,offers_out,in_conversation,outreach_sent,opportunities,leads_researched,markets_live, with counts for the current month from the tracker. Upload it and update `datasets/pace` like the others.
   - `runs.csv`: date,new_leads,updated_leads,approvals_waiting,legal_changes,pushed (append today's row to the previous history kept in `pipeline/runs.csv`)
2. `upload_asset` the four files to the dashboard slug.
3. For each of `datasets/leads`, `datasets/approvals`, `datasets/sources`, `datasets/runs`: `db_get` it for its version, then `db_write` an `update` with `ifVersion`, setting `source.url` to the new upload URL and `updated` to `{at: <now ISO>, by: "Daily run"}`. On the first real run also set the titles "Pipeline leads" and "Approvals queue" and drop the word "sample" from their descriptions.
Don't touch `files/index.html`. If the dashboard update fails, note it in the report and carry on.

### 8. Save
`git add -A && git commit -m "Daily run YYYY-MM-DD: N new leads, M updates"` and push to the default branch, retrying network errors up to 4 times with backoff. If the push fails, say so at the top of your final message.
