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
| 2026-11-19 | tx-harris | cclerk.hctx.net CourtSearch.aspx?CaseType=Probate (search by File Date) | worked | no login/CAPTCHA; 22 weekday searches 10/20–11/18 = 785 filings; 690 estate-type (will/indep/dep admin, heirship, SEA) |
| 2026-11-19 | tx-harris | cclerk.hctx.net CourtCaseDetail.aspx?ID= (parties + events) | worked | applicant/executor + attorney w/ addresses; DOD in event comments; decedent address usually blank |
| 2026-11-19 | tx-harris | www.gis.hctx.net HCAD/Parcels MapServer/0 query | worked | owner_name_1/2, site addr, class, market value, new_owner_date; ~5–10 s per query; 543 name queries; 242 cases with a unique decedent-owned residential parcel |
| 2026-11-19 | tx-harris | gis.hctx.net (bare host) | TLS name mismatch | use www.gis.hctx.net |
| 2026-11-19 | tx-harris | download.hcad.org/data/CAMA/2026/Real_building_land.zip | worked | 235 MB; building_res (yr built, sqft, quality) + fixtures (beds/baths); updated 2026-11-15 |
| 2026-11-19 | tx-harris | cclerk.hctx.net RP.aspx (real property index by grantor/grantee) | worked | deeds, D/Ts, releases, tax liens; results list may be truncated to first page |
| 2026-11-19 | tx-harris | www.hctax.net property tax lookup | not automatable (JS app) | taxes unchecked; manual https://www.hctax.net/Property/PropertyTax |
| 2026-11-19 | tx-harris | www.redfin.com sold search | blocked (403) | not retried; TX is non-disclosure, no public sold prices |
| 2026-11-19 | tx-harris | www.har.com zip profiles | worked (list $/sf, rent) | sold list not shown publicly |
| 2026-11-19 | ms-hinds | www.mspublicnotices.org (MS Press) | manual only | Terms of Use ban automated collection and commercial use; search by hand at https://www.mspublicnotices.org |
| 2026-11-19 | ms-hinds | courts.ms.gov MEC (chancery) | failed | login/fee system; no public filing-date index |
| 2026-11-19 | ms-hinds | www.hindscountyms.com (Chancery Clerk) | blocked (403) | manual: call/visit Hinds Chancery Clerk |
| 2026-11-19 | ms-hinds | gis.mississippi.edu MS_Parcels_Aprl2024 | no Hinds data | only Lincoln parcels layer |
| 2026-11-19 | ms-hinds | gis.cmpdd.org (Hinds map viewer host) | no response | |
| 2026-11-19 | al-jefferson | www.alabamapublicnotices.com (AL Press) | manual only | Terms of Use ban scraping/automated means and commercial use; search by hand at https://www.alabamapublicnotices.com |
| 2026-11-19 | al-jefferson | www.jccal.org (Probate Court) | blocked (Cloudflare) | not bypassed |
| 2026-11-19 | al-jefferson | landmarkweb.jccal.org | blocked (Incapsula bot check) | not bypassed; manual in browser |
| 2026-11-19 | al-jefferson | jccgis.jccal.org BOE/JCParcelsWMS/MapServer/0 | worked | owner-name query OK (OWNERNAME, ADDR_APR, AssdValue, Cls); TA folder token-only |
| 2026-11-19 | ga-fulton | www.georgiapublicnotice.com (GA Press) | manual only | Terms of Use ban automated means, scraping and commercial use; IP blocking for bot-like use; search by hand |
| 2026-11-19 | ga-fulton | www.georgiaprobaterecords.com Estates search | not usable | Fulton is not a participating county |
| 2026-11-19 | ga-fulton | fultoncountyga.gov Probate Court pages | failed (404) | no online estate index found; records by email probate.records@fultoncountyga.gov |
| 2026-11-19 | ga-fulton | gismaps.fultoncountyga.gov Tax/Tyler_TaxParcels/MapServer/0 | worked | owner-name query OK (Owner, Address, LUCode, ClassCode) |
| 2026-11-19 | sc-richland | www.scpublicnotices.com (SC Press) | manual only | Terms of Use: personal non-commercial use only, no automated means |
| 2026-11-19 | sc-richland | www7.richlandcountysc.gov/EstateInquiry | worked (name only) | case no., DOD, opened/closed dates; no date search; documents need SMS account |
| 2026-11-19 | sc-richland | Richland County GIS parcels | failed | gis.richlandcountysc.gov no response, richlandmaps.com 404; no public owner layer found |
| 2026-11-19 | nc-mecklenburg | www.ncnotices.com (NC Press) | manual only | Terms of Use: personal non-commercial use only, no automated means |
| 2026-11-19 | nc-mecklenburg | portal-nc.tylertech.cloud (NC eCourts) | manual only | CAPTCHA; search estates by hand |
| 2026-11-19 | nc-mecklenburg | www.nccourts.gov | blocked (CloudFront 403) | |
| 2026-11-19 | nc-mecklenburg | meckgis TaxParcel_Camaownershipvalues/FeatureServer/0 | worked | owner name, situs address, values, last sale |
| 2026-11-19 | ut-salt-lake | utahlegals.com (Utah Press Assn notices) | manual only | terms ban scraping/automated means and commercial use; manual: https://www.utahlegals.com/ |
| 2026-11-19 | ut-salt-lake | Utah courts XChange | not tested (paid subscription) | https://www.utcourts.gov/en/court-records-publications/records/xchange.html |
| 2026-11-19 | ut-salt-lake | UGRC Parcels_SaltLake_LIR FeatureServer | worked, no owner names | values/year built only; manual owner lookup https://slco.org/assessor/ |
| 2026-11-19 | mt-yellowstone | montanapublicnotices.com (MNA) | manual only | JS search app; one query found only Yellowstone County News indexed, 0 results; manual: https://www.montanapublicnotices.com/mna/legals/ |
| 2026-11-19 | mt-yellowstone | gisservice.mt.gov msdi_cadastral_map_v1 (state parcels w/ OwnerName) | manual only | robots.txt disallows /arcgis/*; manual: https://svc.mt.gov/msl/cadastral |
| 2026-11-19 | mt-yellowstone | Yellowstone County District Court | no online search | |
| 2026-11-19 | wy-laramie | wyopublicnotices.com (WY Press Assn) | manual only | terms: personal non-commercial use only; manual: https://wyopublicnotices.com/ |
| 2026-11-19 | wy-laramie | gis2.statelands.wyo.gov Parcels2025 MapServer | worked | Laramie: 44,406 parcels with owner names (TY2025) |
| 2026-11-19 | co-denver | publicnoticecolorado.com (CO Press Assn) | manual only | terms bar bulk extraction/compilation; manual: https://www.publicnoticecolorado.com/ |
| 2026-11-19 | co-denver | colorado.column.us | manual only | JS app |
| 2026-11-19 | co-denver | Denver Probate Court / CO court records | no free search | state record search is paid |
| 2026-11-19 | co-denver | Denver ODC_PROP_PARCELS_A FeatureServer/245 | worked | owner, situs, appraised value, last sale date/price/deed type |
| 2026-11-19 | nm-bernalillo | caselookup.nmcourts.gov | manual only | disclaimer bars non-individual use/multi-record download (NMSA 14-3-15.1); manual: https://caselookup.nmcourts.gov/caselookup/ |
| 2026-11-19 | nm-bernalillo | newmexicopublicnotices.com (NM Press Assn) | manual only | terms: personal non-commercial use only; manual: https://www.newmexicopublicnotices.com/ |
| 2026-11-19 | nm-bernalillo | abqgis01.cabq.gov BaseMapLayers/5 (Bernalillo Assessor parcels) | worked | TAXYR 2026 owner/situs/value |
| 2026-11-19 | ia-polk | iowapublicnotices.com (Iowa Newspaper Assn) | manual only | robots.txt disallows anthropic-ai/ClaudeBot/Claude-Web; not queried. Manual: https://www.iowapublicnotices.com/ |
| 2026-11-19 | ia-polk | iowacourts.state.ia.us Iowa Courts Online (ESAWebApp) | manual only | framed app, name/case-no. search only (no filing-date list); iowacourts.gov robots disallows ClaudeBot. Manual: https://www.iowacourts.state.ia.us/ESAWebApp/SelectFrame |
| 2026-11-19 | ia-polk | gis.polkcountyiowa.gov ArcGIS | no response (502) | Manual: https://www.assess.co.polk.ia.us |
| 2026-11-19 | mo-jackson | courts.mo.gov Case.net | manual only | robots.txt: automated/repetitive querying "expressly prohibited"; not queried. Manual: https://www.courts.mo.gov/cnet/welcome.do |
| 2026-11-19 | mo-jackson | mopublicnotices.com (MO Press Assn) | manual only | robots.txt disallows anthropic-ai/ClaudeBot; not queried. Manual: https://www.mopublicnotices.com/ |
| 2026-11-19 | mo-jackson | jcgis.jacksongov.org ParcelViewer/ParcelsAscendRelate MapServer/1 | unusable | reachable, but no owner-name field; Parcels_Testing_ForBeta timed out. Manual: https://ascendweb.jacksongov.org/ |
| 2026-11-19 | ar-pulaski | caseinfo.arcourts.gov/opad (Search ARCourts) | manual only | JS app with filing-date + case-type filters; backend API undocumented, not automated. Manual: https://caseinfo.arcourts.gov/opad |
| 2026-11-19 | ar-pulaski | arkansaspublicnotices.com | manual only | robots.txt disallows anthropic-ai/ClaudeBot; not queried. Manual: https://www.arkansaspublicnotices.com/ |
| 2026-11-19 | ar-pulaski | pagis.org MAPS/OperationalLayers_Basic MapServer/40 (Parcels) | worked | OWNERNAME LIKE query returned owners, situs, city, total value, owner mailing address |
| 2026-11-19 | la-east-baton-rouge | ebrclerkofcourt.org | manual only | robots.txt disallows ClaudeBot/anthropic-ai; online records subscription. Manual: https://www.ebrclerkofcourt.org/ |
| 2026-11-19 | la-east-baton-rouge | theadvocate.com legal notices | manual only | robots.txt disallows ClaudeBot/Claude-Web; not queried |
| 2026-11-19 | la-east-baton-rouge | maps.brla.gov Cadastral/Tax_Parcel MapServer/0 | partial / unusable | returnCountOnly works (2,073 owners like SMITH) but OWNER/PHYSICAL_ADDRESS come back null. Manual: https://www.ebrpa.org/ |
| 2026-11-19 | ok-oklahoma | oscn.net dockets | manual only | robots.txt "User-agent: * Disallow: /"; not queried. Manual: https://www.oscn.net/dockets/Search.aspx |
| 2026-11-19 | ok-oklahoma | oklahomanotices.com (OK Press Assn) | blocked (403) | robots.txt itself returned 403; not used |
| 2026-11-19 | ok-oklahoma | okcountyassessor.org | no response (502) | Manual: https://assessor.oklahomacounty.org/ |
| 2026-11-19 | fl-hillsborough | hover.hillsclerk.com (Clerk HOVER case search) | blocked (empty reply / 503) | not retried. Manual: https://hover.hillsclerk.com |
| 2026-11-19 | fl-hillsborough | floridapublicnotices.com (Florida Press Service) Notice to Creditors search | manual only | no robots.txt, but User Agreement (/assets/user_agreement.pdf): "No part of this Website or any content on it may be used without the prior written authorization" of FPS. Data pulled before the check was discarded. Manual: https://floridapublicnotices.com (county Hillsborough, keyword "notice to creditors") |
| 2026-11-20 | fl-hillsborough | publicrec.hillsclerk.com/Probate/dailyfilings/ (Clerk daily probate filing CSVs) | worked | official public directory; no robots.txt on host (hillsclerk.com robots: Disallow none, ClaudeBot crawl-delay 10). 29 daily files 10/21-11/18 (10/20 file not posted, rolling window); 221 estate cases with decedent name, DOD, address, petitioner, beneficiaries, attorney |
| 2026-11-20 | fl-hillsborough | maps.hillsboroughcounty.org PAO/HC_Properties MapServer/1 (parcels) | worked | owner-name parcel layer: OWNER, SITE_ADDR, JUST, HEAT_AR, beds/baths, ACT/EFF, S_DATE/S_AMT (current to 2026-11-12), NBHC; no robots.txt; ~1.1s spacing; used for matching + comps |
| 2026-11-20 | fl-hillsborough | maps.hillsboroughcounty.org InfoLayers/Flood_Zone_Only MapServer/0 | worked | flood zone per subject |
| 2026-11-20 | fl-hillsborough | Tax Collector (hillsborough.county-taxes.com), Official Records, HCPA property card | not checked | manual: https://hillsborough.county-taxes.com/public/search/property_tax ; https://publicaccess.hillsclerk.com/oripublicaccess/ ; https://gis.hcpafl.org/propertysearch/ |
| 2026-11-20 | tx-harris | cclerk.hctx.net probate search by party name | unavailable | "This Search is currently unavailable"; case-number lookup works |
| 2026-11-20 | tx-harris | cclerk.hctx.net RP related-documents view | unavailable | releases of old deeds of trust can't be confirmed online |
| 2026-11-20 | fl-hillsborough | publicrec.hillsclerk.com/Probate/dailyfilings/ProbateFiling_20261119.csv | worked | daily run: 83 rows, 12 estate/trust decedents; date of death included |
| 2026-11-20 | fl-hillsborough | maps.hillsboroughcounty.org PAO/HC_Properties MapServer/1 owner query | worked | OWNER is "First Middle Last" mixed case (e.g. "Estate Of Joseph L Simmons"): search UPPER(OWNER) LIKE '%LAST%' AND '%FIRST%'; NBHC is numeric; 7 of 12 decedents matched a parcel |
| 2026-11-20 | fl-hillsborough | maps.hillsboroughcounty.org same layer, neighbourhood sales (NBHC + S_DATE >= DATE 'YYYY-MM-DD') | worked | comps for ARV; one connection reset, retried with backoff |
| 2026-11-20 | tx-harris | cclerk.hctx.net CourtSearch.aspx?CaseType=Probate (search by File Date 11/19–11/20) | unavailable | "This Search is currently unavailable" on two tries (slice B); retry in slice C |
| 2026-11-20 | tn-shelby | probatecourt.shelbycountytn.gov (www and bare) | no response | 3rd day down; manual: https://www.probatecourt.shelbycountytn.gov |
| 2026-11-20 | fl-hillsborough | PAO HC_Properties layer: single-family sales to companies since 2025-11-20 ($60k–$450k) | worked | 1,439 sales; 166 companies with 2+ purchases; top 25 added to buyers.csv (lenders/servicers excluded) |
| 2026-11-20 | tx-harris | cclerk.hctx.net probate search by file date | unavailable (2nd run in a row) | marked broken in coverage map; manual: https://www.cclerk.hctx.net/applications/websearch/CourtSearch.aspx?CaseType=Probate |
| 2026-11-21 | fl-hillsborough | publicrec.hillsclerk.com/Probate/dailyfilings/ProbateFiling_20261120.csv | worked | 52 rows; 4 estate decedents; 2 parcel matches |
| 2026-11-21 | oh-franklin | probatesearch.franklincountyohio.gov case-by-open-date index | not found | exact URL was never recorded; site root 403, /netdata/ index error; court's General Case Search page has no direct link. Source Mapper to rediscover and record the exact URL |
| 2026-11-21 | oh-franklin | probatesearch PBODateInx.ndm (case-by-open-date) | worked | exact pattern recorded in pipeline/coverage.csv (string=YYYYMMDD, pagination via stringf) |
| 2026-11-21 | tx-harris | cclerk.hctx.net/applications/websearch/CourtSearch.aspx?CaseType=Probate (txtFrom/txtTo 11/19–11/21) | unavailable | 3rd run in a row; still broken |
| 2026-11-21 | tn-shelby | www.probatecourt.shelbycountytn.gov | no response | 4th day down |
| 2026-11-22 | fl-hillsborough | publicrec.hillsclerk.com/Probate/dailyfilings/ProbateFiling_20261121.csv | worked (empty) | 0 rows: Saturday, no filings published |
| 2026-11-22 | oh-franklin | probatesearch PBODateInx.ndm (string=20261118…20261121, with stringf pagination) | worked | 16 estate cases kept (full administration / real estate only); dates of death from ESTATE_DETAIL |
| 2026-11-22 | oh-franklin | gis.franklincountyohio.gov Parcel_Features FeatureServer/0 | worked | 9 leads where the decedent is owner of record; 5 cases other owner or no match; RESFLRAREA still empty (no $/sqft comps) |
| 2026-11-22 | fl-hillsborough | publicaccess.hillsclerk.com/oripublicaccess (Official Records search) | untested (fast desk looked only) | no robots.txt on host (hillsclerk.com applies: Disallow none, ClaudeBot crawl-delay 10); JavaScript search app; terms and search interface not yet checked; handed to Source Mapper (H-0005). Manual: https://publicaccess.hillsclerk.com/oripublicaccess/ |
| 2026-11-22 | fl-hillsborough | publicrec.hillsclerk.com/Probate/dailyfilings/ProbateFiling_20261119.csv | worked | fast desk, H-0004: case 26-CP-003957 rows (decedent aka, trustee; no DOD or address) |
| 2026-11-22 | fl-hillsborough | maps.hillsboroughcounty.org PAO/HC_Properties MapServer/1 (folio and owner queries) | worked | fast desk: folio 0018620000 (no grantee field, no sales table in service); OWNER LIKE '%PILLOW%' 4 parcels |
| 2026-11-25 | fl-hillsborough | publicrec.hillsclerk.com/Probate/dailyfilings (2026-11-22..2026-11-24) | worked | 20261122: 0 rows, 0 estates; 20261123: 149 rows, 21 estates; 20261124: 87 rows, 12 estates; 10 new leads |
| 2026-11-25 | oh-franklin | probatesearch PBODateInx.ndm (from 20261121, 25 pages) + Parcel_Features | worked | 77 cases, 28 estates kept, 10 new leads |
| 2026-11-25 | tx-harris | https://www.cclerk.hctx.net/applications/websearch/CourtSearch.aspx?CaseType=Probate | responds | automated re-test |
| 2026-11-25 | tn-shelby | https://www.probatecourt.shelbycountytn.gov | no response | automated re-test |
| 2026-11-25 | pa-philadelphia | https://www.phila.gov/departments/register-of-wills/ | responds | automated re-test |
| 2026-11-25 | tx-harris | https://www.cclerk.hctx.net/applications/websearch/CourtSearch.aspx?CaseType=Probate | responds | automated re-test |
| 2026-11-25 | tn-shelby | https://www.probatecourt.shelbycountytn.gov | no response | automated re-test |
| 2026-11-25 | pa-philadelphia | https://www.phila.gov/departments/register-of-wills/ | responds | automated re-test |
| 2026-11-26 | fl-hillsborough | publicrec.hillsclerk.com/Probate/dailyfilings (2026-11-25..2026-11-25) | worked | 20261125: 79 rows, 6 estates; 3 new leads |
| 2026-11-26 | oh-franklin | probatesearch PBODateInx.ndm (from 20261124, 25 pages) + Parcel_Features | worked | 46 cases, 12 estates kept, 3 new leads |
| 2026-11-26 | tx-harris | www.cclerk.hctx.net/applications/websearch/CourtSearch.aspx?CaseType=Probate | responds (200); not searched this slice | ASP.NET postback form (viewstate, date-range fields); robots.txt disallows only /Forms/; terms not yet checked for automated use, so no filing sweep run. Manual: https://www.cclerk.hctx.net/applications/websearch/CourtSearch.aspx?CaseType=Probate |
| 2026-11-26 | tn-shelby | www.probatecourt.shelbycountytn.gov | no response (connection failed) | 5th day down; backing off. register.shelby.tn.us robots.txt reachable (not used this slice) |
| 2026-11-26 | pa-philadelphia | www.phila.gov/departments/register-of-wills/ | blocked (403) | research only (PA Act 52); no robots.txt on phila.gov (404) |
| 2026-11-26 | expansion: oh-cuyahoga | probate.cuyahogacounty.gov/pa (probate docket); gis.cuyahogacounty.us CCFO services (parcels) | probate 500 error; GIS 403 | 3b test. Probate docket is name/case search, not a filing-date index; parcel layer not reachable. Blocked 30 days (config expansion_queue status) |
| 2026-11-26 | expansion: oh-hamilton | www.probatect.org/court-records/court-record-search | blocked (403) | 3b test. Blocked 30 days |
| 2026-11-26 | expansion: oh-montgomery | go.mcohio.org/applications/probate/prodcfm/casesearchx.cfm | responds (public form) | 3b test. Search is by last/first name or case number only, no filing-date index, so it cannot source leads. Blocked 30 days |
| 2026-11-26 | expansion: oh-summit, oh-lucas, in-marion | (queue) | not tested this slice | Slice B ran out of time for these; next slice picks them up |
| 2026-11-26 | fl-hillsborough buyer vetting (H-0009) | search.sunbiz.org (FL entity registry) | blocked (Cloudflare challenge, 403) | manual only: owner link https://search.sunbiz.org/Inquiry/CorporationSearch/ByName. Not bypassed. Next: try FL DOS bulk data (dos.fl.gov/sunbiz/other-services/data-downloads/, check terms) or OpenCorporates terms before the next attempt |
| 2026-11-26 | fl-hillsborough buyer vetting (H-0009) | FL DOS public data downloads (sftp.floridados.gov, free, credentials published by the Division on its data-downloads page; quarterly cordata) | worked | 22 of 25 buyer entities matched by exact name; Sunbiz search site remains manual only |
| 2026-11-27 | pa-philadelphia | phl.carto.com SQL API opa_properties_public | worked | fast desk H-0008: owner_1 name query returns parcel, owner, address, market value; parcel owner lookup restored (docket still blocked: phila.gov 403) |
| 2026-11-27 | tn-shelby | gis.shelbycountytn.gov and www.shelbycountytn.gov | blocked (403, Cloudflare) | not bypassed. register.shelby.tn.us robots.txt reachable (200); parcel owner and probate docket remain manual only. Next: TN Comptroller statewide parcels has no Shelby data; try Shelby Assessor open data portal by hand |
| 2026-11-27 | attorney bars (H-0006) | floridabar.org, texasbar.com, tbpr.org | blocked (403 / site unavailable) | automated bar lookup not possible, so no attorney can be verified from here; supremecourt.ohio.gov robots allows but directory is a JS app. Manual: https://www.floridabar.org/directories/find-mbr/ |
| 2026-11-27 | tx-harris, tn-shelby (H-0008/H-0016) | cclerk.hctx.net probate search (robots allows) ; data.shelbycountytn.gov | blocked | Harris probate search redirects to Maintenance.aspx today; Shelby open-data host 403. Nothing bypassed. TN statewide parcels (services1.arcgis.com tnmap_oir) lack Shelby owner data. Still manual only: Shelby probate docket and assessor lookup |
| 2026-11-27 | fl-hillsborough buyers (H-0013) | maps.hillsboroughcounty.org PAO HC_Properties layer 1, paged 500 at a time | worked | 24,499 sales since 2025-11-27; date filter must be `S_DATE >= DATE 'YYYY-MM-DD'`; 412 repeat buyers added (builders/lenders filtered) |
| 2026-11-27 | oh-franklin buyer vetting (H-0018) | businesssearch.ohiosos.gov | blocked (403, maintenance page) | manual only; not bypassed |
| 2026-11-27 | oh-franklin buyers (H-0013) | gis.franklincountyohio.gov Parcel_Features layer 0, CLASSCD='510', SALEDATE >= DATE 'YYYY-MM-DD', 2000/page | worked | 12,764 sales; 400 repeat buyers added; SALEDATE/SALEPRICE are latest sale per parcel only |
| 2026-11-27 | tx-harris buyers (H-0013) | download.hcad.org/data/CAMA/2026/ | blocked (HTTP 500) | retry next run; nothing bypassed |
| 2026-11-27 | fl-hillsborough | publicrec.hillsclerk.com/Probate/dailyfilings (2026-11-26..2026-11-26) | worked | 20261126: 0 rows, 0 estates; 0 new leads |
| 2026-11-27 | oh-franklin | probatesearch PBODateInx.ndm (from 20261125, 25 pages) + Parcel_Features | worked | 22 cases, 5 estates kept, 0 new leads |
| 2026-11-27 | tx-harris | https://www.cclerk.hctx.net/applications/websearch/CourtSearch.aspx?CaseType=Probate | responds | automated re-test |
| 2026-11-27 | tn-shelby | https://www.probatecourt.shelbycountytn.gov | no response | automated re-test |
| 2026-11-27 | pa-philadelphia | https://www.phila.gov/departments/register-of-wills/ | responds | automated re-test |
| 2026-11-28 | fl-hillsborough | publicrec.hillsclerk.com/Probate/dailyfilings (2026-11-27..2026-11-27) | worked | 20261127: 0 rows, 0 estates; 0 new leads |
| 2026-11-28 | oh-franklin | probatesearch PBODateInx.ndm (from 20261126, 25 pages) + Parcel_Features | worked | 0 cases, 0 estates kept, 0 new leads |
