# Lead types

Standard probate (an open estate that owns a house) is one of several public-record paths to inherited property. Each type below says where it's found, who can sign, and the rules that are specific to it. `config.yaml` → `lead_types` switches each type on or off. Record the type in the tracker's `lead_type` column.

The usual rules still apply to every type: public records only, robots.txt and terms respected, the Compliance Officer's gate, the stop list, and the frequency caps.

| Type (`lead_type`) | What it is | Where it's found | Who can sign |
|---|---|---|---|
| `probate` | Open estate with a personal representative | Probate court docket or notices to creditors | The personal representative, within their authority and any court-approval step |
| `post_probate_heirs` | Estate closed, or title passed by a certificate of transfer, affidavit of heirship or deed of distribution. Heirs now own the house, often out of state | Recorder or deed history: transfer to heirs after the date of death, with no sale since | Every heir on title. Each one signs. |
| `small_estate` | Estate under the state's small-estate limit, using an affidavit or summary administration with no full probate | Probate docket ("summary administration", "small estate affidavit", "release from administration") | The affiant or heirs, as state law sets out. The Heir Tracer confirms. |
| `trust` | Owner died and the house is held in a revocable trust. No court involved | Deed shows the property titled to "<name>, Trustee" or "<name> Trust", and the death is confirmed by a probate filing, an obituary or a recorded affidavit | The successor trustee named in a recorded certificate of trust or trustee affidavit. If none is recorded, ask the trust's attorney. |
| `ancillary` | Owner lived in another state; a secondary estate is opened in this county for the house | Probate docket ("ancillary") | The ancillary personal representative |
| `partition` | Heirs who co-own the house are in a court action to divide or force a sale | Civil court docket ("partition"), lis pendens at the recorder | Contact goes through the parties' attorneys only. The sale is often court-ordered, and the court sets the terms. |
| `tax_delinquent_inherited` | Deceased owner (or "Estate of") with delinquent property taxes, often not yet in probate | Treasurer's delinquent list or tax-sale list, matched to death or probate records | Whoever the Heir Tracer confirms (a personal representative if appointed, otherwise every heir). Note the tax-sale date as a deadline. |
| `unprobated` | Owner died, nothing filed, house still in the decedent's name | Obituary or recorded death certificate, matched to a parcel with no probate case after 90+ days | No one can sell until someone is appointed or heirship is recorded. Wait at least 60 days after death. The first letter only explains the options and suggests talking to a probate attorney. Never press anyone to file. |
| `guardianship` | Living owner under a guardian or conservator | **Off by default and never turned on by a worker.** These owners are vulnerable adults and every sale is court-supervised. Only the owner can enable it, and only after the attorney approves a separate process. | |

## Per-type rules that matter
- **Heirs:** contact the heir who appears to be the lead contact first (the applicant, a local heir, or the one paying taxes). Never play heirs against each other. Offers go to all of them in writing at the same time.
- **Trusts:** don't assume a trustee from an obituary. A trustee's authority comes from the trust document; ask for a certificate of trust before any contract.
- **Partition:** never contact a represented party directly. Write only to their attorney.
- **Tax-delinquent:** never mention or threaten a tax sale as pressure. Do state the public tax-sale date once, as a fact, if one is scheduled.
- **Unprobated:** use the gentlest tone, wait a longer time, cap contact at one letter and one follow-up, and never imply we can sell before someone has authority.
- Every type needs the state's legal file to cover it before outreach. If `legal/<STATE>.md` has no section for the type's signing authority, the Legal Advisor adds it (sources, verified or unverified), and the attorney packet gets a row for it.
