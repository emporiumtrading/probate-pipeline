# Probate Pipeline

A Claude session runs every morning at about 6am Central time and:

1. Re-checks wholesaling and probate laws for OH, TN and PA (every 30 days, or sooner if something changes)
2. Searches public probate records in Franklin County OH, Shelby County TN and Philadelphia PA for new estates that own real property
3. Researches up to 10 new leads in depth: property, comps, numbers, legal issues, title and liens, negotiation plan, buyer fit
4. Updates every open lead (docket changes, follow-ups due)
5. Drafts outreach for your approval. **Nothing is ever sent automatically.**
6. Writes `reports/YYYY-MM-DD.md` and commits everything here

## How to use it
- Read today's file in `reports/` each morning.
- Approve outreach by sending it yourself from the drafts in `leads/<lead>/outreach-drafts.md`.
- Leave notes for the next run in the `notes` column of `pipeline/deal-tracker.csv` or in `leads/<lead>/owner-notes.md` (for example "executor wants $80k" or "dead – sold to family").
- Change settings (markets, fee, daily cap) in `config.yaml`.
- Philadelphia stays research-only until you set `licensed_or_partnered: true` (PA Act 52 of 2024).

Not legal or tax advice. Confirm legal points with a local attorney and tax points with a CPA.
