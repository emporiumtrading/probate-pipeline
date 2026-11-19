# Daily probate pipeline: routine setup

Create this routine in **claude.ai → Routines → New routine** (the routine must be created there so the repository is attached):

- **Repository:** emporiumtrading/probate-pipeline
- **Schedule:** daily, 5:39 AM, America/Chicago
- **Connectors:** none required (the session's built-in Artifact tool refreshes the dashboard)
- **Notifications:** push on

**Prompt (paste exactly):**

```
Run today's daily probate pipeline in this repository.
Follow .claude/skills/probate-wholesale-deal/references/daily-run.md from start to finish: load state, legal refresh, lead sourcing, market expansion, plan to the monthly closing target, deep-dive new leads with worker subagents per references/orchestration.md, maintain the pipeline, communications/negotiation/professionals/closing per config.yaml autonomy settings, build dashboard data with scripts/build_dashboard_data.py, pass scripts/qa_checks.py and scripts/check_page.py, write the daily report, refresh the dashboard artifact named in config.yaml dashboard_slug, then commit and push to main.
Hard limits always apply: compliance gate before anything outbound; never phone or text automatically; never sign anything for the owner; never ask for, store or use bank details; public records only; no bypassing logins, CAPTCHAs, rate limits, robots.txt or site terms.
End with a short summary: new opportunities (with potential earnings), items in the owner's sign / wire / call / exceptions queues, pace vs the monthly target, and whether the push and dashboard refresh succeeded.
```
