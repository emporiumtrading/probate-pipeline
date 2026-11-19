# Research File — 2353 Dawnlight Ave, Columbus OH 43211 (oh-franklin-648195)

Researched 2026-11-19 by the daily run (Researcher role). Public records only; nobody contacted.

## Sources (all fetched 2026-11-19)
- [P1] Case detail: http://probatesearch.franklincountyohio.gov/netdata/PBCaseTypeE.ndm/ESTATE_DETAIL?caseno=648195;;
- [P2] Fiduciaries/attorneys: http://probatesearch.franklincountyohio.gov/netdata/PBFidy.ndm/input?caseno=648195;;
- [P3] Docket: http://probatesearch.franklincountyohio.gov/netdata/PBDocket.ndm/input?caseno=648195;;
- [A1] Auditor parcel layer (ArcGIS): https://gis.franklincountyohio.gov/hosting/rest/services/ParcelFeatures/Parcel_Features/FeatureServer/0 (parcel 010-108956; also used for last-transfer data near the subject, which runs through 2026-11-17)
- [A2] Auditor sales layer: https://gis.franklincountyohio.gov/hosting/rest/services/RealEstate/Sales_Information/FeatureServer/0 (has validity flag and grantor/grantee, **but its newest record is 2025-07-16**, so used for flip-pattern evidence, not for last-12-month pricing)
- [A3] Auditor tax-foreclosure layer: RealEstate/Assessment_Information/FeatureServer/0 — no record for this parcel
- property.franklincountyauditor.com (tax & payments page): "System currently unavailable due to maintenance" on 2026-11-19 → taxes not checked

## Verified
| Fact | Value | Source |
|---|---|---|
| Court / case | Franklin County Probate, case 648195, Full Administration **without will** (intestate) | P1 |
| Decedent | Myrtle Pearl Sartin, last address 2353 Dawnlight Ave; DOD 08/10/2025 | P1, P3 |
| Opened | 10/23/2026 | P1 |
| Applicant (not yet appointed) | Jimmie R. Sartin Jr. — title "12 APPLICANT", appt date N/A | P2 |
| Attorney of record | Abbie E. Obenour (Ohio atty reg. 0090679) | P2 |
| Letters of authority | **Not issued.** Entry Setting Hearing 11/04/26 → hearing **12/17/2026 9:00 AM** "Appoint administrator" (Zoom) | P3 |
| Other filings | Application for Authority to Administer; Fiduciary's Acceptance; next-of-kin list (1.0); death certificate; Waivers of Right to Administer by **Tery Sartin** and **Laquita Denton**; copy of bond documents; **Application to Dispense With Appraisal** (no entry granting it yet); Auditor's Real Estate Summary; Notice of Compliance 10/26/26 | P3 |
| Inventory / appraisal | None filed yet | P3 |
| Motion to sell / consents to power of sale | None filed | P3 |
| Parcel | 010-108956, owner of record "SARTIN MYRTLE"; tax mailing name "MYRTLE BUTLER", 2353 Dawnlight Ave | A1 |
| Last transfer | 1976-05-05, $0 (held ~50 years) | A1 |
| Building | 1954, 990 sq ft above grade, 3 bd / 1 ba, single-family on 0.12 ac, City of Columbus, Columbus CSD; no basement field recorded | A1 |
| Auditor value | $117,300 (land $26,500 / bldg $90,800) | A1 |
| Use flags | OWNEROCCUPIED = N, HOMSTD = N, **RENTAL = Y** (registered rental) | A1 |
| Flood | FLOOD field blank (no mapped flood flag) | A1 |
| Tax foreclosure | Not in county tax-foreclosure layer | A3 |

## Assumed / unverified
- **Occupancy:** rental flag suggests a tenant is in place (unverified; could be a relative). Lease terms unknown.
- **Heirs:** intestate; next-of-kin list is not viewable online. Tery Sartin and Laquita Denton are likely heirs (they waived the right to administer). Surviving spouse: none indicated (unverified). Any minor heir would block an R.C. 2127.011 consent sale.
- **Name variance:** tax mailing name "Myrtle Butler" vs owner "Sartin Myrtle" — likely a prior/maiden name; title must tie them together.
- **Condition:** unknown; 1954 slab ranch held 50 years and rented → assume dated (medium rehab).
- **Back taxes / code violations / utilities / mortgage:** needs check (auditor tax page down; no public code-enforcement endpoint found). Manual: Columbus BZS code enforcement / 311 portal; Franklin County Treasurer tax lookup.
- A parcel owned by "SARTIN JIM" at 1049 N Marland Dr exists; it **may** be the applicant — unverified, not used for contact.

## Comps — sold, last 12 months (2025-11-19 → 2026-11-17), ≤0.5 mi, 3/1-ish 800–1,150 sf, built 1950s [A1]
Parcel-layer "last transfer" data has no arm's-length flag; buyer type is read from the owner name.

Retail (individual buyers — treated as updated/renovated sales):
| Address | Date | Price | Sq ft | $/sf | Bd/Ba | Built | Dist |
|---|---|---|---|---|---|---|---|
| 2468 Dawnlight Ave | 2026-05-22 | $180,000 | 800 | 225 | 2/1 | 1954 | 0.17 mi |
| 2310 Brentnell Ave | 2026-04-17 | $183,000 | 984 | 186 | 3/1 | 1956 | 0.11 mi |
| 2250 Brentnell Bl | 2026-08-27 | $188,000 | 1,148 | 164 | 3/1 | 1957 | 0.18 mi |
| 2193 Myrtle Ave | 2026-10-01 | $200,000 | 988 | 202 | 3/1 | 1962 | 0.30 mi |
| 2207 Genessee Ave | 2026-09-01 | $201,000 | 1,075 | 187 | 3/1 | 1961 | 0.29 mi |
| 2221 Myrtle Ave (Opendoor bought) | 2026-07-29 | $187,800 | 1,008 | 186 | 3/1.5 | 1957 | 0.24 mi |

As-is / investor purchases (LLC buyers):
| Address | Date | Price | Sq ft | Buyer | Dist |
|---|---|---|---|---|---|
| 2454 Century Dr (same 990 sf / 1954 model) | 2026-03-04 | $90,000 | 990 | Everlasting Realty LLC | 0.14 mi |
| 2282 Dawnlight Ave | 2026-03-26 | $107,500 | 960 | Everlasting Realty LLC | 0.10 mi |
| 2169 Hanna Dr | 2026-02-10 | $114,000 | 1,008 | MJ Ohio Investments LLC | 0.37 mi |
| 2376 Marcia Dr | 2026-07-30 | $143,000 | 1,008 | Urbanrise 88 LLC | 0.18 mi |

Flip pattern evidence (2024–25, sales layer A2, valid sales): 2140 Dawnlight bought $92,000 (2024-08, LLC) → sold $160,000 (2025-03); 2231 Dawnlight sold by Heels Homes Ltd $174,000; 2318 Dawnlight $215,000 (2025-07, 960 sf).

**ARV read:** updated 3/1 ranches of this size close $180k–$201k in the last 12 months. ARV low $180,000 / mid $190,000 / high $205,000. Auditor $117,300 is a floor, not ARV.

## Cash buyers seen nearby (from records)
Everlasting Realty LLC, MJ Ohio Investments LLC, Urbanrise 88 LLC, Scarlet and Gray Holdings LLC (many 2024–25 buys), Rosewood Holdings / Peony Pinnacle LLC, B A Rhoads Investments LLC, Heels Homes Ltd, Dreamhouse LLC, Core Developments LLC, Archway City 001 LLC.

## Open questions for the team
1. Will the court appoint Jimmie R. Sartin Jr. on 12/17/2026, and will appraisal be dispensed with (inventory value = auditor $117,300?)
2. Full heir list; any minors; do all heirs agree to sell?
3. Tenant: who, lease, rent, condition.
4. Back taxes, water/sewer liens, code orders, any mortgage or Medicaid estate-recovery claim.
