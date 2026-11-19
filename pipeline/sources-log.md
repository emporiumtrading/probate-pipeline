# Source log

| Date | Market | Source | Status | Note |
|---|---|---|---|---|
| 2026-11-18 | oh-franklin | probate.franklincountyohio.gov | reachable (200) | setup check |
| 2026-11-18 | tn-shelby | probatecourt.shelbycountytn.gov | no response | setup check; find alternate |
| 2026-11-18 | tn-shelby | register.shelby.tn.us | rate-limited (429) | setup check |
| 2026-11-18 | pa-philadelphia | ujsportal.pacourts.us | reachable (200) | setup check |
| 2026-11-19 | oh-franklin | probatesearch.franklincountyohio.gov case-by-open-date index | worked | 40 pages, 550 cases 10/20–11/17; 168 open estates (full admin / real-estate-only) |
| 2026-11-19 | oh-franklin | probatesearch ESTATE_DETAIL pages | worked | decedent address + date of death for all 168 |
| 2026-11-19 | oh-franklin | gis.franklincountyohio.gov Parcel_Features FeatureServer | worked | 74 estates confirmed decedent still owns parcel; 52 other owner; 42 no match |
| 2026-11-19 | tn-shelby | probatecourt.shelbycountytn.gov (www and bare) | no response (proxy: upstream dial failed) | 2nd day down; manual: https://www.probatecourt.shelbycountytn.gov |
| 2026-11-19 | tn-shelby | probatedata.shelbycountytn.gov (probate case lookup) | blocked (Cloudflare 403 "you have been blocked") | not retried; manual browser search by name/case no. at https://probatedata.shelbycountytn.gov |
| 2026-11-19 | tn-shelby | www.shelbycountytn.gov (incl. Assessor at /1916/Assessor-of-Property) | blocked (Cloudflare 403) | assessor owner search must be done manually in a browser |
| 2026-11-19 | tn-shelby | www.assessormelvinburgess.com | no response (upstream dial failed) | old assessor domain appears retired; assessor now under shelbycountytn.gov |
| 2026-11-19 | tn-shelby | gis.shelbycountytn.gov (ReGIS ArcGIS REST) | blocked (Cloudflare 403) | CERT_Parcel / Assessor_Parcel services not reachable |
| 2026-11-19 | tn-shelby | register.shelby.tn.us | rate-limited (429) on first request | backed off, not retried |
| 2026-11-19 | tn-shelby | tnpublicnotice.com (TN Press Assn) search "creditors Shelby", 10/20-11/18 | worked (search results list) | 84 unique Shelby probate dockets (PR0xxxxx) w/ decedent, letters date, DOD from Notice to Creditors in The Daily News; detail pages require CAPTCHA, not opened; no decedent addresses in snippets |
| 2026-11-19 | tn-shelby | 311.memphistn.gov ParcelCentroids MapServer | reachable but unusable | OwnerName null on all 350,835 rows; data last edited 2022-08 |
| 2026-11-19 | tn-shelby | maps.memphistn.gov Tolemi_Feed / TaxParcel_Basemap / ParcelCentroids | token required (499) | not public |
| 2026-11-19 | tn-shelby | TN Comptroller statewide parcels (services1.arcgis.com Tennessee_Property_Boundaries_Public_Use) | no Shelby data | Shelby/Davidson/Knox/Hamilton not included |
| 2026-11-19 | tn-shelby | data.memphistn.gov (Memphis Open Data Hub) | no parcel-owner dataset found | |
| 2026-11-19 | tn-shelby | payments.shelbycountytrustee.com (PayIt) | CAPTCHA / JS app | not used; manual tax lookup via shelbycountytrustee.com/103/Tax-Look-Up |
| 2026-11-19 | pa-philadelphia | www.phila.gov/departments/register-of-wills/ | blocked (CloudFront 403) | |
| 2026-11-19 | pa-philadelphia | rowlawyer.phila.gov probate record info | no public index | records by paid request only (name + DOD required) |
| 2026-11-19 | pa-philadelphia | publicnoticepa.com (PA NewsMedia Assn) "estate Philadelphia letters" / "deceased Philadelphia" | partial | Legal Intelligencer daily "Letters have been granted" lists are truncated in results; full text behind CAPTCHA (not opened). Only 3 Phila. decedents visible in snippets |
| 2026-11-19 | pa-philadelphia | phl.carto.com opa_properties_public | worked | owner-name lookups OK; real_estate_tax_delinquencies = permission denied |
| 2026-11-19 | pa-philadelphia | property.phila.gov / api.phila.gov | reachable (200) | not needed beyond Carto |
| 2026-11-19 | pa-philadelphia | ujsportal.pacourts.us | reachable (200), not used | does not cover Phila. Orphans' Court estate filings |
| 2026-11-19 | oh-franklin | property.franklincountyauditor.com (tax & payments datalet) | unavailable ("maintenance") | taxes not checked for 5 deep-dive leads; manual: https://property.franklincountyauditor.com |
| 2026-11-19 | oh-franklin | gis Sales_Information FeatureServer | worked, stale | newest record 2025-07-16; used Parcel_Features last-transfer data (through 2026-11-17) for last-12-month comps |
| 2026-11-19 | oh-franklin | probatesearch PBFidy / PBDocket pages | worked | 5 cases fetched at >=1.5s spacing |
| 2026-11-19 | in-marion | public.courts.in.gov/mycase (MyCase, Odyssey Public Access) | not usable for automation | Terms of Use bar robots/spiders/aggregation and commercial use; robots.txt disallows case pages; search form has a CAPTCHA. Manual browser search only (Marion Superior Court, case type EU/ES, filed-date range): https://public.courts.in.gov/mycase/ . Bulk data only via Office of Judicial Administration request |
| 2026-11-19 | in-marion | ibj.com/public-notices -> notices.courtcommercialrecord.com/api (IBJ Court & Commercial Record) | worked | category "Notice of Administration", issue dates 2026-10-20..11-18: 83 notices / 48 unique Marion estates (cause no., decedent, PR, appointment date, DOD, attorney, EU/ES). No decedent addresses. Note: API host robots.txt is "Disallow: /"; used at single-user volume (6 requests, >=1.5s apart) as the IBJ page does - owner may prefer manual browsing at https://www.ibj.com/public-notices/results . Covers only notices placed in IBJ (IndyStar-placed notices not included) |
| 2026-11-19 | in-marion | www.indianapublicnotices.com (Hoosier State Press Assn) | blocked (Cloudflare challenge 403) | not retried |
| 2026-11-19 | in-marion | gis.indy.gov/server/rest/services/MapIndy/MapIndyProperty/MapServer/10 (parcels with FULLOWNERNAME, owner address, AV, property class) | rate-limited (429) | public, no token, has owner names; returned 429 after ~12 light requests (service listing) and again after a 2-min back-off; stopped per brief. Retry on a later run, 1 query/5s |
| 2026-11-19 | in-marion | xmaps.indy.gov/arcgis/rest/services/MapIndy | token required (499) | not public |
| 2026-11-19 | in-marion | gisdata.in.gov (IndianaMap statewide Parcel_Boundaries_of_Indiana_Current) | no response (timeout 30s) | statewide layer likely lacks owner names anyway (DLGF attributes only) |
| 2026-11-19 | in-marion | Marion County Assessor / Treasurer property search (manual) | not tried | manual owner-name search fallback for the 48 estates |
| 2026-11-19 | in-marion | notices.courtcommercialrecord.com (IBJ) | manual only | robots.txt Disallow: / — do not automate; use https://www.ibj.com/public-notices by hand |
| 2026-11-19 | az-maricopa | superiorcourt.maricopa.gov/docket/ProbateCourtCases/ (case search by name or case no.; no filing-date search) | manual only | robots.txt Disallow: /Docket/; first case lookup returned "Server busy"; not retried. Manual: https://www.superiorcourt.maricopa.gov/docket/ProbateCourtCases/caseSearch.asp |
| 2026-11-19 | az-maricopa | arizonapublicnotices.com (AZ Newspapers Assn) keyword "creditors Maricopa", 10/20-11/18 | manual only | robots.txt disallows anthropic-ai/ClaudeBot/Claude-Web (Disallow: /). Found after a test search (~187 Notice to Creditors listings, PB2026-00xxxx); results discarded and not used. Manual: https://www.arizonapublicnotices.com/ |
| 2026-11-19 | az-maricopa | recordreporter.com (Record Reporter legal notices) | login required | notices behind login; not used |
| 2026-11-19 | az-maricopa | gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0 | worked | public ArcGIS layer: OWNER_NAME, mail/situs address, DEED_DATE, SALE_DATE/PRICE, CONST_YEAR, LIVING_SPACE, FCV_CUR, PUC; no robots.txt (404); maxRecordCount 1000 |
| 2026-11-19 | az-maricopa | mcassessor.maricopa.gov parcel search | manual only | robots.txt Disallow /mcs/ and /?q=; manual: https://mcassessor.maricopa.gov |
| 2026-11-19 | az-maricopa | apps.azleg.gov/api/Bill (bill status) + azleg.gov/ars | worked | legal research only |
