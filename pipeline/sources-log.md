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
