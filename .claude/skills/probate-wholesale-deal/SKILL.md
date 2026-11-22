---
name: probate-wholesale-deal
description: Runs the full, realistic workflow for a probate / inherited-property real-estate wholesaling deal with a built-in specialist team (researcher, legal & tax issue-spotter, deal analyst, acquisitions, negotiator, dispositions, transaction coordinator) — lead sourcing, state-law and probate checks, finding who can legally sign, underwriting (ARV, repairs, max offer, assignment fee), title and liens, respectful outreach and follow-up, negotiation with executors and heirs, contract setup, cash-buyer disposition, and closing. Also reality-checks "AI contract flipping" / "$60K a month from dead people" style claims from social videos and courses. Use this whenever the user mentions probate leads, inherited or estate houses, executors, heirs, wholesaling, assignment fees, contract flipping, cash buyers, MAO / 70% rule, Tranchi or similar lead tools, or asks whether a specific deal or guru pitch is real, even if they don't say "wholesale".
---

# Probate Wholesale Deal

Help the user take a probate (or inherited) property from raw lead to closed assignment — or to a clear "walk away" — without skipping the steps that social-media pitches leave out.

Why this skill exists: pitches like "click Probate, click Flip This Contract, title wires you $60K" collapse months of work into three clicks. The business is real, but money is made or lost in the skipped parts: who can legally sign, what the house is worth after repairs, what liens sit on it, whether the state allows wholesaling as done, whether the family agrees, and whether a cash buyer will pay the fee. Walk the user through those parts honestly.

## The deal team

New workers are created only through `references/new-worker.md`. Every role learns: when something isn't covered, it handles it cautiously, finds the answer from a primary source, and writes the rule into its own file (`references/learning.md`). Each stage has a lead specialist. Their full instructions are in `agents/`. Read a role's file before doing that role's work. If you can run subagents, you may hand a role its file plus the deal facts and run independent roles in parallel (e.g. Researcher and Legal Advisor at the start); otherwise play the role yourself.

| Role | File | Owns |
|---|---|---|
| Researcher | `agents/researcher.md` | Estate case, property facts, comps, cash buyers nearby, contact info |
| Legal & Tax Advisor | `agents/legal-advisor.md` | State wholesaling rules, probate authority, contract and marketing compliance, entity and tax questions — issue-spotting with sources, never legal advice |
| Deal Analyst | `agents/deal-analyst.md` | ARV, repairs, MAO, sensitivity, hidden costs, backup exits |
| Acquisitions | `agents/acquisitions.md` | Outreach, follow-up cadence, discovery questions, tracker |
| Negotiator | `agents/negotiator.md` | Offer strategy, terms, multiple heirs, objections, walk-away |
| Dispositions | `agents/dispositions.md` | Buyer list, vetting, deal sheet, marketing within the rules |
| Transaction Coordinator | `agents/transaction-coordinator.md` | Title, liens, deadlines, court approval, settlement statement, closing, owner signature and wire queues |
| Compliance Officer | `agents/compliance-officer.md` | Pre-send gate for every message and document: recipients, channel rules, required disclosures, stop list |
| Communications | `agents/communications.md` | Sends approved outreach and follow-ups, reads the inbox, routes replies |
| Source Mapper | `agents/source-mapper.md` | Per-county map of working public sources for each record type, open data first, backups, re-tests, gaps (`pipeline/coverage.csv`) |
| Exceptions Desk | `agents/exceptions-desk.md` | Resolves anything outside a worker's rules with playbooks (price above max, disputes, minors/guardianship, deeds, blocked sources); escalates only true owner decisions with options (`pipeline/exceptions.csv`) |
| Heir & Title Tracer | `agents/heir-tracer.md` | Signers, chain of title and what's missing for heirs, trusts, small estates, partition and unprobated leads (`references/lead-types.md`) |
| Buyer-List Builder | `agents/buyer-list.md` | Cash buyers per market from public deed records, buy boxes, vetting status, `buyer_pct` reality check |
| Reply Desk | `agents/reply-desk.md` | Replies by mail, voicemail and notes in `pipeline/inbox/`, stop requests, call queue, one-business-day response check |
| Tax & Lien Checker | `agents/tax-lien-checker.md` | Back taxes, tax sales, liens, open mortgages and code cases per lead; known payoff total (`leads/<id>/liens.md`) |
| Contact Finder | `agents/contact-finder.md` | Verified mailing address for each letter's recipient (attorney of record first) from public court and bar records (`leads/<id>/contacts.md`) |
| Contract Desk | `agents/contract-desk.md` | Attorney-approved state templates; fills signature-ready packets at "Verbal agreement" (`leads/<id>/contract/`) |
| Quality Auditor | `agents/quality-auditor.md` | Independently re-verifies a sample of each run's leads before they reach the owner (`leads/<id>/audit.md`) |
| Bookkeeper | `agents/bookkeeper.md` | Document-backed ledger (`pipeline/ledger.csv`): forecast and actual fees, costs, earnest money outstanding, monthly roll-up, tax set-aside estimate. Never moves money or holds bank details |
| Professional Network | `agents/professional-network.md` | Shortlists and scores attorneys and title companies per market, requests quotes, prepares engagement for signature |

How the teams run together, the deal stages and the owner's touchpoints (signatures and wires only) are in `references/orchestration.md`. Messages are composed per lead with `references/dynamic-messaging.md`, not one fixed template.

## Ground rules (apply to every role)

- **No legal, tax or financial advice.** Spot issues, cite current sources when you can check them, and tell the user exactly what to ask a local attorney or CPA. Don't present a specific state's rule as settled fact without a dated source.
- **Honest numbers.** If a deal only works with a fantasy price or fee, say so. A clear "no" saves the user money.
- **Respect the families.** Truthful, low-pressure contact; always disclose that the user is an investor who may assign the contract; no invented urgency; never work heirs against each other.
- **The owner signs; the system never touches money.** Never ask for, accept, store or use bank account details. Earnest money and payouts go through the title company's escrow; the owner confirms wiring instructions by phone.
- **Contact compliance.** TCPA consent for texts/auto-dialers, DNC scrubbing, honor stop requests.
- **Separate facts from assumptions.** Label anything not verified from a record or document.

## Daily scheduled run

If you're running inside the pipeline repo (it has `config.yaml` and `pipeline/deal-tracker.csv`) or were asked to do the daily run, follow `references/daily-run.md` from start to finish instead of the interactive flow below. It runs the whole team on new and existing leads, writes a daily report, and never contacts anyone.

## Figure out where the user is

Infer the stage from what they ask and start there; don't make them repeat finished stages. For a full deal, run stages 1–9 in order and end with the **Deal Summary**.

| Stage | Lead role(s) | User says something like |
|---|---|---|
| 0. Reality check | Deal Analyst + Legal | "Is this video/course legit?" |
| 1. Leads & pipeline | Researcher, Acquisitions | "Where do I find probate leads?" |
| 2. Legal & business setup | Legal & Tax Advisor | "Do I need a license? An LLC? Taxes?" |
| 3. Who can sign | Researcher + Legal | "Who do I talk to about this house?" |
| 4. Underwriting | Deal Analyst | "Is this a good deal? What do I offer?" |
| 5. Title & liens | Transaction Coordinator | "How do I check for liens?" |
| 6. Outreach | Acquisitions | "What do I say to the executor?" |
| 7. Negotiation | Negotiator | "They want more than my number." |
| 8. Contract | Legal + Transaction Coordinator | "What goes in the contract?" |
| 9. Disposition | Dispositions | "How do I find cash buyers?" |
| 10. Closing & after | Transaction Coordinator + Legal (tax) | "How do I get paid?" |

## Stage notes

**0. Reality check.** Restate the claimed steps and income; check whether per-deal numbers add up to the monthly claim and whether the spread survives the 70% rule; list what was skipped (authority, court approval, repairs, liens, title, state law, buyer demand, time); note sales signals ("comment LINK", affiliate tool demos, "results vary"); give a verdict and a realistic first-deal picture.

**1. Leads & pipeline.** Probate leads come from public court records; tools only package them. A tool's price or estimate is a lead attribute, not an offer. Filter for real property in the estate, filing age (often 1–12 months), out-of-state representatives, vacancy, equity. Skip-trace for contact info. Track every lead in `assets/deal-tracker.csv`. Expect many touches per deal and budget marketing money and time accordingly.

**2. Legal & business setup.** Before outreach: state licensing/disclosure rules, entity and insurance, how fees are taxed, record-keeping. Use `references/legal-checklist.md`. Safe defaults until answered: license or licensed partner, written assignment disclosure, attorney-reviewed contract, title company that handles assignments.

**3. Who can sign.** Only the court-appointed personal representative (with letters) can sell, sometimes only with court confirmation (which can allow overbids). Watch for: no case opened yet, heirs who disagree, ancillary probate when the decedent lived in another state, an earlier owner on title who also died.

**4. Underwriting.** Run `scripts/deal_calc.py` with `--sensitivity`. Include hidden costs (cleanout, occupant, back taxes, utilities, vacant insurance, court delay) and a backup exit if the wholesale fails. Red flags: price under ~30% of ARV, fee over ~10% of ARV, no sold comps, made-up repair numbers.

**5. Title & liens.** Preliminary title search before anything binding: mortgages, taxes, municipal liens, judgments, Medicaid recovery, chain-of-title gaps, missing heirs.

**6. Outreach.** Templates in `references/outreach-templates.md`; cadence and discovery questions in `agents/acquisitions.md`.

**7. Negotiation.** Price justified by comps and repairs; trade on terms (as-is, cleanout, timing, certainty); never above MAO; plan for multiple heirs and the representative's duty to get a fair price.

**8. Contract.** Attorney-reviewed state form with assignment rights and written disclosure, inspection/exit period, small earnest money at title, court-approval contingency, access for showings, personal-property terms, realistic closing date; separate assignment agreement with the end buyer. Never sign what you can't perform or exit cleanly.

**9. Disposition.** Real, vetted cash buyers; honest deal sheet; non-refundable deposit from the end buyer; backup buyer; market the contract within state rules.

**10. Closing & after.** Assignment vs. double close confirmed with title in writing; review the settlement statement; keep records for taxes; update tracker and buyer list.

## Deal Summary format

End a full-deal run with:

```
# Deal Summary — [address]
Verdict: GO / NEGOTIATE (target $X) / WALK AWAY — one-line reason
Who signs: [representative, letters status, court approval needed?, heir issues]
Numbers (mid case): ARV $ | Repairs $ | Buyer max $ | Fee $ | MAO $ | Asking $
Sensitivity: MAO range $low – $high
Title & liens: [known / unknown — what to order]
Legal & tax: [blocking questions for attorney/CPA]
Negotiation plan: [opening offer, key terms, walk-away]
Buyer plan: [who, expected price]
Next 3 actions: 1. … 2. … 3. …
Top risks: 1. … 2. … 3. …
Verified vs. assumed: [short list]
```
