# Research File — 821 Lizzie Ln, Whitehall (Columbus) OH 43213 (oh-franklin-626376)

Researched 2026-11-19 (Researcher role). Public records only; nobody contacted.

## Sources (fetched 2026-11-19)
- [P1] http://probatesearch.franklincountyohio.gov/netdata/PBCaseTypeE.ndm/ESTATE_DETAIL?caseno=626376;;
- [P2] http://probatesearch.franklincountyohio.gov/netdata/PBFidy.ndm/input?caseno=626376;;
- [P3] http://probatesearch.franklincountyohio.gov/netdata/PBDocket.ndm/input?caseno=626376;;
- [A1] Auditor parcel layer, parcel 090-008308 + nearby last transfers (through 2026-11-17)
- [A2] Auditor sales layer (transfer history for the parcel; newest record in layer 2025-07-16)
- [A3] Tax-foreclosure layer — no record

## Verified
| Fact | Value | Source |
|---|---|---|
| Case | 626376, **Real Estate Only without will**; first filed 09/12/2023; **re-opened 11/03/2026** ("Reactivation only") — that reopening is why it showed up as "opened 11/03/2026" | P1, P3 |
| Decedent | Eric Brian Smith Sr.; DOD 03/01/2023 | P1, P3 |
| Applicant | Billi Smith (not a fiduciary); attorney Philip W. Gerth (reg. 0069475) | P2 |
| 2023 docket | Application for Certificate of Transfer, Real Property Questionnaire, **Certificate of Transfer issued 09/12/2023** | P3 |
| Transfer recorded | Sales layer: 2023-10-04, instrument **CT** (certificate of transfer), conveyance 90009147, grantor "SMITH ERIC B" → grantee "SMITH ERIC B JR" "@(3)" (three grantees), $0, not a valid sale | A2 |
| Current owner | **"SMITH ERIC B JR"** alone; last transfer **2025-10-27**, $0 | A1 |
| Tax mailing | **CoreLogic**, PO Box 9202, Coppell TX — a mortgage tax-service address (escrowed loan likely) | A1 |
| Building | 1997 bi-level, 1,862 sf, 3 bd / 2.5 ba, full basement, AVERAGE condition, grade C, 0.15 ac, City of Whitehall, Whitehall CSD | A1, A2 |
| Auditor value | $210,300 | A1 |
| Flags | OWNEROCCUPIED = N, HOMSTD = N, RENTAL = N; not in tax-foreclosure layer | A1, A3 |

## Key finding
**The estate no longer owns this house.** It passed to three heirs by certificate of transfer in 2023, and after a 10/27/2025 transfer one heir, Eric B. Smith Jr., holds it alone, with tax bills going to a mortgage servicer's tax service — consistent with a buy-out of siblings financed by a new mortgage (assumption). The candidate match ("decedent still owns parcel") was a false positive: owner "SMITH ERIC B **JR**" vs. decedent "Eric Brian Smith **Sr.**". The 2026 reopening reason is not on the docket.

## Assumed / unverified
- New mortgage in Oct 2025 (inferred from CoreLogic mailing and $0 transfer).
- Occupancy unknown (non-owner-occupied flag, no rental registration).

## Comps — for the record (last 12 months, ≤1 mi) [A1]
| Address | Date | Price | Sq ft | Built | Bd/Ba | Dist |
|---|---|---|---|---|---|---|
| 846 Lizzie Ln | 2026-08-26 | $317,900 | 2,161 | 1999 | 4/2.5 | 0.06 mi |
| 541 Westphal Ave | 2025-12-16 | $226,000 | 1,560 | 1997 | 3/2 | 0.64 mi |
| 469 Cumberland Dr | 2026-01-14 | $333,500 | 1,854 | 1967 | 3/2.5 | 0.48 mi |
| 458 Cumberland Dr (LLC buyer) | 2026-09-18 | $199,000 | 1,630 | 1968 | 4/1.5 | 0.53 mi |
| 4714 E Harbinger Cr (2024, FAIR) | 2024-10-25 | $202,000 | 1,578 | 1997 | 3/2.5 | 0.08 mi |
ARV low $260,000 / mid $280,000 / high $300,000.

## Recommendation to pipeline
Fix the parcel-match step so a JR/SR suffix mismatch is not treated as "decedent still owns," and check the sales layer for a recorded CT before ranking.
