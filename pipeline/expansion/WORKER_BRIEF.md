# Expansion worker brief (2026-11-19)

You open ONE new county market end to end. Read first:
- /home/user/probate-pipeline/.claude/skills/probate-wholesale-deal/SKILL.md
- .../references/daily-run.md (steps 2, 3, 3b, 4, hard limits) and every file in .../agents/
- /home/user/probate-pipeline/legal/OH.md as an example of the legal file format

Steps:
1. **Legal** (Legal Advisor): write /home/user/probate-pipeline/legal/<ST>.md (skip if it exists). Key question: can an unlicensed person wholesale (assign contracts) in this state, and what disclosures/cancellation rights apply? Check official sources; prefer laws from the last 2 years. If a license is required, set the market research-only: do steps 2-3, but every lead's verdict is RESEARCH ONLY.
2. **Sources** (Researcher): find a public, no-login probate filing index (court case search by filing date, clerk/probate portal, or published Notice to Creditors / Notice to Heirs lists) and a public parcel source with owner names (county ArcGIS REST FeatureServer/MapServer parcel layer, assessor open data, state parcel layer). Proven pattern (Franklin County OH): pull filings opened 2026-10-20..2026-11-18 → get decedent address (or name) → query parcels by SITEADDRESS LIKE '<num> <street>%' or owner name → keep only where owner last name matches the decedent (don't treat Jr/Sr as the same person; skip if deeded to someone else after death). Go slow (>=1s/request), never bypass logins/CAPTCHAs/rate limits/Cloudflare. If no workable source, stop and report why.
3. **Quick screen** all confirmed decedent-owned residential parcels; rank by wholesale fit (value $40k-$350k, long ownership, older home, signs of distress).
4. **Deep-dive the top 4** (full deal team per daily-run step 4): research.md, underwriting.md (deal_calc.py --sensitivity; fee 10000; buyer pct 0.70 unless local evidence differs), legal.md, title.md, plan.md (verdict GO / NEGOTIATE / WALK AWAY with a Negotiator **target price** ≤ MAO), outreach-drafts.md only if NEGOTIATE/GO and outreach allowed (compose per references/dynamic-messaging.md; drafts only, send nothing).
   Lead folder: /home/user/probate-pipeline/leads/<market-id>-<case>/
   tracker-row.csv columns (exactly): lead_id,address,county,state,case_number,filing_date,personal_rep,rep_contact,estate_attorney,letters_issued,court_confirmation,occupancy,arv_mid,repairs_mid,mao,asking,stage,last_touch_date,touch_count,next_action,next_action_date,dnc_or_stop,notes,city,buyer_max,target_price,potential_earnings
   (buyer_max = ARV*pct - repairs; potential_earnings = buyer_max - target_price; city title case; stage "Outreach drafted" for NEGOTIATE/GO else "Researched").
   approval.txt: one line describing the draft awaiting approval, or empty.
5. Save the ranked candidate list to /home/user/probate-pipeline/pipeline/candidates/<market-id>-2026-11-19.tsv and append every source tried to /home/user/probate-pipeline/pipeline/sources-log.md (| Date | Market | Source | Status | Note |).
6. Write /home/user/probate-pipeline/pipeline/expansion/<market-id>.yaml with the market block for config.yaml (id, county, state, city, outreach_allowed, sources with URLs, last_checked: 2026-11-19).

Hard limits: never contact anyone; public records only; label verified vs assumed. Don't edit config.yaml, deal-tracker.csv or other markets' files. Don't spawn subagents.
Reply with: legal status (license required?), sources that worked, # confirmed leads, and one line per deep-dived lead: address | city | verdict | ARV | target | potential earnings | key reason.
