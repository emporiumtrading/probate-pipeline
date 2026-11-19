# State sweep brief (2026-11-19)

You cover several states. For EACH state, in order:

A. **Legal** (read .claude/skills/probate-wholesale-deal/agents/legal-advisor.md): write /home/user/probate-pipeline/legal/<ST>.md in the same format as legal/OH.md, but keep it short (≈40 lines): Last verified date; can an unlicensed person wholesale/assign residential contracts? (check laws passed/effective 2023-2026 first); required disclosures and cancellation rights; who can sell estate real property (executor powers, court approval, price floors); TCPA/state DNC notes; VERIFIED/UNVERIFIED with source URLs. Set `outreach_allowed: false` if a license is required.

B. **Sources** for the state's market county (given below). Test ONE small query each, slowly (>=1s between requests), no logins/CAPTCHAs/Cloudflare bypass:
   - probate filings by date (court/clerk case search, or published Notice to Creditors lists on public-notice sites, which often work when courts don't)
   - parcel owner data (county/state ArcGIS REST parcel layers with owner names, assessor open data)
   Proven pattern: filings opened 2026-10-20..2026-11-18 → decedent address or name → parcel by SITEADDRESS LIKE '<num> <street>%' or owner name → owner last name matches (Jr/Sr are different people; skip if deeded away after death).

C. **If both sources work and outreach is allowed**: find confirmed decedent-owned residential leads, rank them, and deep-dive the TOP 2 per daily-run step 4 (files in /home/user/probate-pipeline/leads/<market-id>-<case>/: research.md, underwriting.md with deal_calc.py --sensitivity [fee 10000, pct 0.70], legal.md, title.md, plan.md with verdict and Negotiator target price ≤ MAO, outreach-drafts.md if NEGOTIATE/GO composed per references/dynamic-messaging.md, approval.txt, tracker-row.csv with exactly these columns: lead_id,address,county,state,case_number,filing_date,personal_rep,rep_contact,estate_attorney,letters_issued,court_confirmation,occupancy,arv_mid,repairs_mid,mao,asking,stage,last_touch_date,touch_count,next_action,next_action_date,dnc_or_stop,notes,city,buyer_max,target_price,potential_earnings).
   If a license is required, do no deep-dives (research-only).

D. Write /home/user/probate-pipeline/pipeline/expansion/<market-id>.yaml: id, county, state, city, status (workable | research_only | blocked), outreach_allowed, license_required (yes/no/unclear), sources (URLs + worked/failed), last_checked: 2026-11-19, notes. Append each source tried to pipeline/sources-log.md (| Date | Market | Source | Status | Note |).

Budget: spend at most ~1/N of your effort per state (N = number of states you have). If a state's sources are blocked after reasonable tries, mark it blocked and move on.
Hard limits: never contact anyone; public records only; don't edit config.yaml or deal-tracker.csv; don't spawn subagents.
Reply with one line per state: ST | license required? | status | # confirmed leads | deep-dived leads as "address (city) verdict, earnings $X".
