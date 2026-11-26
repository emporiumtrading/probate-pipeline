# Daily Pipeline Run

Use this when the skill runs on a schedule inside the pipeline repo (it has `config.yaml`, `pipeline/deal-tracker.csv`, `leads/`, `reports/`, `legal/`). Each run starts in a fresh session with no memory: **the repo is the memory.** Read state from it at the start, write everything back, commit and push at the end. A run that does great work but doesn't push has done nothing.

Work in depth, not breadth: a few leads researched properly beat fifty half-checked names. Respect `max_new_leads_per_day`.

## Staggered schedule (three runs a day)
The full daily run is split into three scheduled slices so each stays within usage limits. Every slice starts with step 0 (sync), runs QA before publishing anything, and ends with step 8 (save and push), so a slice that stops early loses nothing.

| Slice | Time (owner time, America/Chicago) | Steps | Markets |
|---|---|---|---|
| **A: morning** | 5:39 AM | 0, 1, 2 (legal refresh), 2b (source map, all live markets), 3 + 3a + 4 (sourcing and deep-dives), 5a (dates of death), 7 (QA + dashboard), 8 | Hillsborough (Tampa), Franklin (Columbus) |
| **B: midday** | 12:23 PM | 0, 1, 3 + 3a + 4, 3b (expansion), 5a, 7, 8 | Harris (Houston), Shelby (Memphis), Philadelphia, plus any market added since |
| **C: evening** | 5:41 PM | 0, 1, 3-types, 3c (plan to target), 5 (maintain pipeline), 5b (communications, negotiation, professional network, buyer list, reply desk, closing), 6 (the day's report, covering all three slices), 7, 7b (learn), 7c (worker lifecycle: score and evaluate), 8 | All live markets |

- New markets go to slice B unless a slice is over 3 markets; then put them in whichever slice has fewer.
- A slice writes only its own part of `reports/YYYY-MM-DD.md` under a heading "Slice A / B / C"; slice C writes the top summary (Top of mind, queues, pace) for the whole day.
- `pipeline/runs.csv` gets one row per day: slice A creates it, B and C update the counts.
- If a slice finds an earlier slice didn't finish (no push that day), it runs that slice's markets first, then its own.

## Hard limits (every run)
- **Contact only as `config.yaml` → `autonomy` allows**, and only after the Compliance Officer passes the item. With `outreach: drafts_only`, nothing is sent. With `autonomous`, the Communications worker sends mail/email through connected services. Never phone or text automatically. Nothing binding is signed except by the owner or by the company's own e-signature within `config.yaml` → `company_signature`, and no money or bank details are ever handled.
- Public records only. Don't create accounts, bypass logins, CAPTCHAs, paywalls or rate limits, and don't automate any site whose robots.txt disallows the pages you need or whose terms of use ban automated or commercial use. Honor any `Crawl-delay` in robots.txt (including one set for ClaudeBot or other AI crawlers) and apply a parent domain's robots.txt to its subdomains when the subdomain has none. Mark such sources `manual only` in the sources log and give the owner the manual search link. If a site blocks or rate-limits you, back off, log it in `pipeline/sources-log.md`, and move on.
- Personal data (names, addresses, phone numbers of executors/heirs) stays in this private repo. Don't paste it into outside services beyond the searches needed to research it.
- Markets with `outreach_allowed: false` get research and underwriting only; no outreach drafts.
- Autonomous sending needs both `autonomy.outreach: autonomous` and `attorney_approved: <date>` on the market. Any market without that date stays drafts-only, whatever the global setting says.
- Autonomous sending also needs, for every message: a tested sending channel, the Compliance Officer's PASS, and the `lead_types.min_days_after_death` (90-day) wait after the date of death. Lead types the owner switched off stay off.
- Never sign anything for the owner personally and never copy or paste a signature. The only automatic signature is the company's own e-signature (owner decision 2026-11-25), and only when `company_signature.enabled` is true, the owner signed the company resolution, the attorney confirmed it for that state, and `scripts/sign_check.py` passes for that exact contract (purchase agreement or assignment, attorney-approved template, price at or below the max offer, assignable, an inspection period to walk away, earnest money inside the reserve). Everything else (other documents, engagement letters, anything outside those limits) the owner signs with their own click.
- Never ask for, store or use bank or card details, and never act on wiring instructions received by email. Earnest money goes only to a title company's escrow that the owner has confirmed by phone at the number on its official website.
- Only `active` workers' output feeds an outbound action. Workers in `trial` or `probation` run in shadow mode (`references/worker-lifecycle.md`).
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
**Owner settings from the dashboard first.** The owner enters setup details on the dashboard's Setup page (Configure on each area). They are stored in the dashboard, not the repo, so pushes never clear them. Each run: `db_whoami`, then `db_list` the collection `data/users/<your id>/setup/areas` on the dashboard (`dashboard_slug`). Save the tool's output to a scratch file and run `python3 scripts/owner_settings.py import <that file>`. That writes `pipeline/owner-settings.json` (commit it), which overrides `config.yaml`: `business.*` directly, and `autonomy.outreach` when the page's choice is newer than `outreach_decided_on` (see Autonomy below). If it prints REFUSED, the owner saved something that is never kept (bank details, card numbers, keys). Put it under **Exceptions** without repeating the value. Then:
- **Channels the owner marked "I've set this up"** (`<channel>_ready: true`): test each one before relying on it, then set `channels.<channel>: true` in `config.yaml` only if the test passed. Email sending: the Resend connector is connected (or a Resend API key saved through `request_credential` for host `api.resend.com`) and a test email to the business address arrives. Inbox: the default is **Resend receiving** on the reply address the owner entered (a `replies.` subdomain or the `@<id>.resend.app` address, never the main domain's MX). Send a test email to it and read it back through Resend's received-emails API (connector tool, or the API with the saved key). If the owner chose Gmail instead, the Gmail connector must read the test email. Each run, Communications collects new received emails from the inbox channel; Resend keeps them even when nothing is listening, so none are lost between runs. Answers are drafted into `leads/<id>/outreach-drafts.md` as new messages for the Messages page and follow the same sending rule as outreach (autonomous where the market's gates are open). Print-and-mail: ask for the service's API key with the `request_credential` tool (host = the service's API host), never in chat or the page, then send a test to the business address in the provider's test mode. Mail scanning / voicemail: the business inbox has a scan or transcript from that service. If a test fails, leave the flag false; the worker that owns the channel retries and fixes what it can, and only a fix that needs the owner (an account in their name, a payment) goes to the Exceptions Desk.
- **Attorney approvals entered on the page** (`market-<id>.approved_on`): this is the owner's notice, not the approval itself. The Legal Advisor follows "Recording attorney approvals" (`agents/legal-advisor.md`) using the document the owner named in `approval_doc`, and only then writes `attorney_approved` in `config.yaml`. Until then the Setup page shows "waiting for check".
- **Licence entered on the page** (`licensed_or_partnered`, `license_ref`): the Legal Advisor checks it against `legal/<STATE>.md` (and the state's public licence lookup where one exists) before setting `outreach_allowed: true`.
- **Autonomy:** the outreach mode is the owner's newest decision: the Setup page's saved choice (saved only with an explicit AUTHORIZE for `autonomous`) or `config.yaml` → `autonomy.outreach` with its `outreach_decided_on` date, whichever is newer (`scripts/owner_settings.py` → `effective_outreach`; the dashboard builder and QA use it). The owner chose `autonomous` on 2026-11-25. Everything else in Hard limits still applies, and a market still sends on its own only with `attorney_approved`, a tested channel, the Compliance PASS and the 90-day wait.
- **Workers decide routine matters themselves** (`autonomy.worker_decisions: within_written_limits`): letters, counters up to MAO, professional quotes within `attorney_*_fee_max` / `title_fees`, buyer selection, scheduling and exceptions with a playbook answer. Each such decision gets one row in `pipeline/decisions-log.csv` (`date,worker,lead_id,decision,reason,limit,evidence`; `limit` names the written limit it stayed within). Nothing goes to the owner that a worker, the playbooks or the attorney can settle.

**Owner decisions from the dashboard.** The owner marks Sign / Wire items done or on hold and picks an option on the few exceptions that are truly theirs. With outreach `autonomous` the owner is no longer asked to approve letters, but a decision the owner still makes on the Messages page (approve, changes, reject) is honored as below. For each of `outreach`, `sign`, `wire` and `exceptions`: `db_list` the collection `data/users/<your id>/decisions/<queue>`, save the output, and run `python3 scripts/owner_decisions.py import <queue> <file>`. That updates `pipeline/owner-decisions.csv` (commit it). Then act on every row with an empty `applied`, and set `applied` to today's date once done:
- **outreach / approved:** the owner's approval to send this lead's letter (call scripts stay manual, for the owner). The Compliance Officer runs its gate again on today's facts (stop list, caps, state rules, attorney limits). If it passes and a sending channel works (`channels.mail_sending` / `email_sending`), send within the caps and move the lead to "Outreach sent" with the date. If no channel works yet, keep the stage, mark the letter print-ready in `leads/<id>/outreach-drafts.md`, and list it in the report under **Your queues** as "Approved: print and mail". If the gate fails, don't send: report why under **Exceptions**.
- **outreach / changes:** Communications redrafts using the owner's note and re-runs the compliance pre-check. With `drafts_only` the lead goes back in the approval queue (new `approval.txt` line); with `autonomous` the redraft follows the normal sending gates.
- **outreach / rejected:** no outreach to this lead. Move it to "Dead" with the note "Owner rejected outreach: <note>" in the tracker.
- **exceptions, a / b / c / other:** the owner's choice among the Exceptions Desk's options (`pipeline/exceptions.csv`); the Exceptions Desk carries it out and sets the row to resolved.
- **sign / wire, done:** record it in the tracker and the ledger (wire: only after the owner confirmed by phone with the title company; the system never handles money or bank details), and move the deal to its next stage. **hold:** keep it in the queue and note why.

Then read `config.yaml`, `pipeline/deal-tracker.csv`, the latest file in `reports/`, `pipeline/sources-log.md`, and `legal/*.md`. Note today's date in the owner's timezone.

### 1b. Handoff board
Run `python3 scripts/handoffs.py sweep`. From here on, every worker starts its step by listing and clearing its own handoffs, and asks other workers through the board instead of guessing (`references/orchestration.md` → Handoff board). Before step 7, run `python3 scripts/handoffs.py check`. In the report, under **Exceptions**, list every escalated handoff and every one addressed `--to owner`, with its id and the question.

### 2. Legal refresh (Legal Advisor)
For each market's state: if `legal/<STATE>.md` is missing or its "Last verified" date is older than `legal_recheck_days`, follow `agents/legal-advisor.md` to research current wholesaling, probate-sale and contact rules, with priority on laws passed or effective in the last two years. Write `legal/<STATE>.md` with: Last verified date, rules table (rule, source URL, date, verified/unverified), blocking issues, required contract disclosures. If something changed since the last version, put it at the top of today's report.

### 2b. Source map (Source Mapper)
Follow `agents/source-mapper.md`: fill gaps and re-test sources in `pipeline/coverage.csv` for live markets and the next queued counties, preferring open data and bulk downloads, with statewide public-notice sites as backups. The Researcher and Heir & Title Tracer use the sources marked `works` there.

### 3. Lead sourcing (Researcher)
For each market, search the probate source for estate filings since `last_checked` (or `lookback_days_first_run` on the first run). For each filing, check the auditor/assessor/property site for real property in the decedent's name. Keep only filings with real property in the county. Skip any lead already in the tracker (match case number or parcel). Rank new candidates by: equity signals, vacancy/distress, out-of-state representative, filing age 1–12 months. Take the top `max_new_leads_per_day` across all markets. Update each market's `last_checked` in `config.yaml`. Log each source's result (worked / blocked / changed layout / no results) in `pipeline/sources-log.md`.

When matching a decedent to a parcel owner, search the owner field case-insensitively for the last name and the first name in any order (counties store names as "LAST FIRST", "First Last", "Estate Of First Last" or "First Last/Trustee"), then confirm the match by site address or mailing address. Use the owner-name format recorded for that county in `pipeline/coverage.csv` (notes on its `parcel_owner` row). Don't treat Jr./Sr./II/III as interchangeable (a "Sr." decedent and a "Jr." owner are different people), If the deed history shows a sale to an unrelated buyer after the date of death, drop the parcel. If it shows a transfer to heirs (certificate of transfer, affidavit of heirship, deed of distribution), keep it as a `post_probate_heirs` lead when that type is enabled.

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
`config.yaml` → `targets.closings_per_month` sets the stretch goal the funnel is sized for (currently 20) and `targets.closings_floor` the minimum that still counts as a winning month (currently 5). Plan for the goal; judge the month against both. Each run:
1. Measure the funnel from the tracker: leads researched → opportunities → contacted → in conversation → offers → verbal → under contract → closed, per month, and the conversion rate between each step. Use the measured rates `scripts/build_dashboard_data.py` publishes in `pace.csv` (`rate_*`, `src_*`): a step uses its own rate once it has `targets.min_sample_for_measured_rate` outcomes, is blended below that, and falls back to `targets.assumed_rates` only when it has no outcomes at all. Say in the report which steps are still assumed.
2. Work backwards from the target to what this run must produce: new qualified leads needed per day, counties needed, letters/emails needed, buyers needed.
3. Raise throughput to close the gap, in this order: open more markets (step 3b, up to `targets.max_expansion_per_run`), raise `max_new_leads_per_day` up to `targets.max_leads_per_day`, quick-screen everything and deep-dive only the top-ranked, and add follow-up touches up to the compliance caps. Never loosen the compliance gate, the frequency caps or the owner-signature rule to hit a number.
4. Report the gap honestly in the report's top section: "Pace: X closings vs 20 goal (floor 5); need N more qualified leads/day; bottleneck: <stage>". Flag it as a problem only when the month is behind pace for the floor.

### 4. Deep-dive each new lead
Create `leads/<lead_id>/` (lead_id = `<market-id>-<case number or parcel>`), then run the team in order, each writing its own file:
- `research.md` — `agents/researcher.md`
- `underwriting.md` — `agents/deal-analyst.md`, with `scripts/deal_calc.py --sensitivity` output pasted in
- `legal.md` — lead-specific issues from `agents/legal-advisor.md` (authority, court approval, price floors, state disclosures), referencing `legal/<STATE>.md`
- `title.md` — desk title/lien check from public records per `agents/transaction-coordinator.md`; list what still needs a real title search
- `plan.md` — Deal Summary (format in SKILL.md), negotiation plan (`agents/negotiator.md`), and buyer fit (`agents/dispositions.md`)
- `outreach-drafts.md` — only if the market allows outreach and the verdict isn't WALK AWAY: first letter from `agents/acquisitions.md` (a call script only when a seller or attorney has asked for a call), with the assignment disclosure and any state-required wording

Add/update the lead's row in `pipeline/deal-tracker.csv` (stage, verdict, MAO, next_action, next_action_date).

### 4b. Liens, contacts, audit (before anything reaches the owner)
For each lead deep-dived today, in order:
1. **Tax & Lien Checker** (`agents/tax-lien-checker.md`): write `leads/<id>/liens.md`; the Deal Analyst subtracts the known payoff or flags it.
2. **Contact Finder** (`agents/contact-finder.md`), only for leads with `outreach-drafts.md`: write `leads/<id>/contacts.md` and replace address placeholders in the drafts.
3. **Quality Auditor** (`agents/quality-auditor.md`): sample per its rules and write `leads/<id>/audit.md`. A lead with a FAIL goes back to "Researched" and nothing is sent for it (it leaves the approval queue when there is one).
Also run steps 1–2 for existing open leads that still lack `liens.md` or `contacts.md`, oldest first, as usage allows.

### 5. Maintain the existing pipeline
For every open lead in the tracker (not WALK AWAY / CLOSED / DEAD):
- Re-check its probate docket for changes (letters issued, sale motion, inventory/appraisal filed, case closed, new attorney). Note changes in the lead's `research.md` with the date.
- If `next_action_date` is today or past: prepare what the action needs (follow-up letter draft, updated numbers, questions for attorney) and hand it to the worker that acts on it. With outreach `autonomous`, letters go through the Compliance gate and send when the market's gates are open; otherwise they wait as held drafts. List it under "Needs your approval" only when outreach is `drafts_only`.
- If the owner left notes in the tracker `notes` column or in `leads/<id>/owner-notes.md`, act on them (e.g. "spoke to executor, wants $80k" → re-run negotiator plan).
- Mark leads stale after 6 months with no movement.

### 5a. Date of death
Every lead needs `date_of_death` in the tracker, taken from the case file, the death notice in the docket, an obituary or a recorded affidavit (note the source in `leads/<id>/research.md`). Each run, fill it in for any lead that's missing it, starting with leads that have drafted outreach. No first letter goes out until `lead_types.min_days_after_death` (90) days after that date. If the date can't be found, the filing date is used.

### 5b. Communications, negotiation, professionals, closing
Following `references/orchestration.md`, run these workers (in parallel where possible):
- **Communications**: send what's due (compliance-gated, per-market gates), read the inbox, route replies. Log every outbound action in `pipeline/outbound-log.csv` (`date,lead_id,item,channel,recipient_role,produced_by,compliance,status,evidence`; `produced_by` names every worker whose output the item used, all `active`). QA fails the run if a non-active worker's output fed an outbound action, or if a letter to the estate side was sent without a Compliance PASS and either the market's `attorney_approved` or the owner's own approval of that letter.
- **Negotiation desk**: answer counters within authority; re-price with the Deal Analyst when facts change; move agreed deals to "Contract out for signature" with the contract built from the attorney-approved state template.
- **Exceptions Desk** (`agents/exceptions-desk.md`): take every exception raised this run and on the board, run its playbook through the owning workers, log it in `pipeline/exceptions.csv`, and leave under **Your actions → Decisions only you can make** only what is truly the owner's (signature, money beyond the written limits, a legal question only an attorney can answer, anything outside written limits), each with a recommendation and options. Everything else is decided by the owning worker and logged in `pipeline/decisions-log.csv`.
- **Bookkeeper, Stripe import** (slice C): if `bookkeeping.stripe.connected_on` is set, follow `agents/bookkeeper.md` → Stripe: read balance transactions since `last_imported`, run `scripts/stripe_ledger.py import`, report the counts. Read-only.
- **Transaction Coordinator, closing status**: if the Qualia Connect connector is connected (`closing_service.connected_on` set), read every open order per `agents/transaction-coordinator.md` 4b and update earnest money and closing dates. Read-only; it never moves money or acts on payment instructions.
- **Legal Advisor, attorney review**: if an attorney-review connector is connected, follow `agents/legal-advisor.md` → "Attorney review through a connected service" for every open matter (check status, route questions to the handoff board, apply redlines, record approvals only after the bar check).
- **Professional Network**: for every live market with no engaged attorney/title company (the attorney packet needs one before any deal does), build or refresh `network/<market>.md`, source and verify attorneys itself (`agents/professional-network.md` → Sourcing attorneys; `pipeline/attorney-candidates.csv`, which fills the Setup page), and request quotes if allowed.
- **Contract desk** (`agents/contract-desk.md`): for every deal at "Verbal agreement", build the signature packet from attorney-approved templates only; keep `templates/<STATE>/` drafts and attorney review packets current for each live state.
- **Bookkeeper** (`agents/bookkeeper.md`): update `pipeline/ledger.csv` (forecasts for deals at "Verbal agreement" or later, `actual` rows only with a document), and flag any payment-instruction change, overdue earnest money or undocumented actual under Exceptions.
- **Buyer-list builder** (`agents/buyer-list.md`): every live market, every run, keep `pipeline/buyers/buyers.csv` growing from public deed records; warn when a market with a deal under contract has fewer than 5 vetted buyers.
- **Reply desk** (`agents/reply-desk.md`): process `pipeline/inbox/`, log to `pipeline/inbox-log.csv`, and list every reply waiting more than one business day under Top of mind.
- **Dispositions desk**: for deals under contract, match and contact vetted buyers (compliance-gated).
- **Closing desk**: for every contract, track deadlines and update the signature and wire queues.

### 6. Daily report
If `legal/<STATE>.md` changed this run, rebuild that market's attorney packet: `python3 scripts/build_attorney_packet.py <market-id>`.

Write `reports/YYYY-MM-DD.md`:

```
# Probate Pipeline — YYYY-MM-DD
## Money
- Fees deposited: this month $X (N deals), year $Y — from `pipeline/ledger.csv` actual income rows (document-backed only)
- Expected closings: deal, closing date, expected fee (deals at Under contract or later; forecast rows)
- Deposits due: deal, earnest money amount, due date, title company (the owner confirms by phone and pays the title company's escrow)
## Your actions (only if there are any; otherwise write "Nothing needs you today.")
### Sign (one click; packets prepared and checked by the system)
### Confirm earnest-money deposit (phone the title company first)
### Decisions only you can make (Exceptions Desk: signature, money beyond the limits, attorney-only legal question, anything outside written limits)
### Calls (only if a seller or attorney still asks for a call after a written answer; optional)
## Top of mind
- [legal changes, deals that changed status, markets that opened for sending, workers promoted or demoted]
## Decisions the team made (count by worker from pipeline/decisions-log.csv; details there)
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

Keep the report short enough to read on a phone in five minutes; details live in `leads/`. The owner reads the Money section and Your actions; everything below is reference. Never list under Your actions anything a worker decided or can decide within its written limits.

### 7. QA, then refresh the dashboard
1. Build the dashboard data with the repo's builder (never hand-write the CSVs): `python3 scripts/build_dashboard_data.py <scratch>/dd`. It writes leads, queues, markets (all 50 states + DC), stages, sources (working only), runs and pace, with names and contact details left out.
2. Run the regression gates: `python3 scripts/qa_checks.py <scratch>/dd` (data) and `python3 scripts/check_page.py` (page code: syntax, cross-script scope, drawings). Any change to `dashboard/index.html` must pass `check_page.py` before it is published. If it exits non-zero, **don't publish**. Fix the underlying lead files or tracker rows (or, if a check is wrong, fix the check and say why in the report), rebuild and re-run. Report every WARN line in the report's Notes section.
3. Self-review before publishing (meta-check): compare today's numbers to yesterday's report. Any opportunity count, total earnings or stage count that moved by more than 50% without a matching explanation in today's work is investigated before publishing.
4. If `config.yaml` has `dashboard_slug`: `upload_asset` **every** CSV the builder wrote (all of them, every run, so no dataset is left behind on old data; at most 10 files per call), then `db_list` the `datasets` collection once for versions and `db_write` one batched `update` per dataset with `ifVersion`, setting `source.url` and `updated: {at, by: "Daily run"}` (use `set` for a dataset that doesn't exist yet).
4a. **Verify the refresh landed (never report success without this).** `db_list` `datasets` again and confirm every dataset's `source.url` equals the URL you just uploaded for it and `updated.at` is from this run. Then `db_whoami` and read `data/users/<id>/check` and `runs` if present; fix any failure they name. If any dataset didn't update, retry once; if it still fails, write "Dashboard NOT refreshed: <which datasets, why>" at the top of today's report and in the `pushed` column of `pipeline/runs.csv`. Never write "refreshed" on the strength of the attempt alone.
4c. **Messages.** The build writes `messages.json` (every drafted or sent message with its body, attachments and notes; it contains recipients' names). Upload it like the CSVs **only if** `get_artifact` on the dashboard says its read mode is `owner`. If the dashboard has been shared, skip `messages.json` and say so in the report.
4b. **Permissions.** Use only the dashboard tools in `.claude/settings.json` → `permissions.allow` (get_artifact, upload_asset, db_list, db_get, db_whoami, db_write). Never `db_query`, `db_str_replace` or any other tool that isn't on that list: an unlisted tool raises an approval prompt nobody is watching, and the run stalls. Read datasets with `db_list`. Dashboard uploads and writes need the owner's one-time "always allow" in this session. If a tool call is waiting on a permission prompt, nobody is watching, so the run stalls and later runs queue behind it. So run step 8 (commit and push) **before** the dashboard upload in 7.4, then commit again after 7.4a (repo work never depends on the dashboard), so a stalled dashboard step costs only the dashboard. The page itself shows a red "Data is stale" banner when its data is over 26 hours old, so the owner sees the problem. Don't touch `files/index.html`; the page lives in `dashboard/index.html` in the repo and changes only when the owner asks.
5. After writing, read `data/users/<your id>/check` and `runs` (via `db_whoami`) if present and fix any failure they name.

### 7b. Learn
Every worker that did work this run runs the self-review loop in `references/self-review.md` (predict before, compare after, change one thing, one row in `pipeline/self-review.csv`); on Mondays the Quality Auditor runs the weekly calibration in that file. Then follow `references/learning.md`: every worker that met something its instructions didn't cover today writes the rule into its own file under `## Learned`, and the report lists it under **What the team learned**. The Legal Advisor also processes any attorney reply to a packet (its section "Recording attorney approvals").

### 7c. Worker lifecycle (slice C)
Follow `references/worker-lifecycle.md`:
1. **Score.** The Quality Auditor scores every worker that ran today and that it checked: `python3 scripts/worker_lifecycle.py score <worker> --items N --checked N --agreed N --errors N --violations N --results N --evidence <file>`. Trial and probation workers are scored in shadow mode against their checker (their output in `pipeline/trials/<worker>/<date>/`), active workers in live mode from the audit sample.
2. **Evaluate.** `python3 scripts/worker_lifecycle.py evaluate --apply`. It promotes trial workers that met the thresholds, puts active workers whose measured performance dropped on probation, and retires workers that failed (role file moved to `agents/retired/`). Core checkers (`worker_lifecycle.core_workers`) are never retired automatically: if one stays failing, the Exceptions Desk escalates it to the owner.
3. **Wire changes.** For a promotion, the worker's output starts feeding the run at the next slice (remove "shadow" from its step). For a retirement, remove its roster row in `SKILL.md`, its rows in `orchestration.md` and the runbook step, and its `W(...)` row in `scripts/build_dashboard_data.py`, and reassign its open handoffs. List every change under **Top of mind**: "Worker <name> promoted / on probation / retired: <reason>".

### 8. Save
`git add -A && git commit -m "Daily run YYYY-MM-DD: N new leads, M updates"` and push to the default branch, retrying network errors up to 4 times with backoff. If the push fails, say so at the top of your final message. Never create or push other branches: the session proxy blocks branch deletion, so any branch you push stays behind as clutter. If the push to the default branch is rejected because `main` moved (someone else pushed first), `git pull --rebase origin main` and push again, up to 3 times. On a rebase conflict, follow the conflict rule in step 0. If the push is refused for any other reason, or still fails, leave the commit local (step 0 of the next run pushes it) and report the exact error rather than pushing to a fallback branch.

Also save midway: after step 5, commit `Daily run YYYY-MM-DD (checkpoint)` and push the same way, so a run that stops partway doesn't lose its research. Run the dashboard step (7) only on the final save.
