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

## Stage playbook by type
Every worker reads the row for the lead's `lead_type` before acting. Anything not listed here follows the standard probate process.

| Type | Outreach (Acquisitions + Compliance) | Numbers (Deal Analyst) | Negotiation | Closing (Transaction Coordinator) | Buyers (Dispositions) |
|---|---|---|---|---|---|
| `post_probate_heirs` | "Letter to heirs". Write to the lead heir first, then all heirs within 7 days. Every heir gets the same offer in writing. | Price in each heir's share. Check for a mortgage or liens recorded after the transfer. | All heirs must agree. Never make side deals with one heir. Allow time for out-of-state heirs. | Every heir signs the contract and deed (a power of attorney only if the attorney approves it). Title checks for spouses' rights and heirs' liens and judgments. | Standard. Closing may take longer, so tell buyers. |
| `small_estate` | "Options letter" if no one has filed yet. Otherwise "Letter to personal representative", worded for the affiant. | Standard. Check the small-estate value limit; a sale may need court leave. | The affiant or heirs, as the Heir Tracer sets out. | Record the affidavit or order first. The title company must agree to insure on it. | Standard. |
| `trust` | "Letter to successor trustee" | Standard. No court floor, so lower friction. | The trustee decides; beneficiaries may have to approve. Ask, don't assume. | Certificate of trust and a death certificate recorded. Title insures the trustee's deed. | Standard. Usually the fastest close. |
| `ancillary` | "Letter to personal representative", sent to the ancillary personal representative (often out of state). Copy the estate attorney. | Standard. | Standard. | The ancillary letters must be current. Follow the court-approval rules of this county's state. | Standard. |
| `partition` | "To the parties' attorneys" only. Never contact a party directly. | Expect a court-ordered or auction price, and model the auction minimum. | Through the attorneys, often as an offer to buy out a share, or a bid at the court sale. | The court order controls. A court sale may need a bidder's deposit, which goes in the owner's Wire queue. | Buyers must accept court-sale timing. |
| `tax_delinquent_inherited` | "Letter to heirs" or "Options letter". State the tax-sale date once, as a fact, never as pressure. | Add the delinquent taxes, penalties and interest to costs. The tax-sale date is a hard deadline. | Standard, with the deadline in mind. | Taxes are paid at closing from the proceeds. Confirm the redemption amount with the treasurer. | Standard. |
| `unprobated` | "Options letter" only, at least 60 days after death. One letter and one follow-up, ever. | Research and underwriting only. No offer until someone has authority. | None until there is an appointed personal representative or recorded heirship. The lead then becomes `probate` or `post_probate_heirs`. | n/a until it converts | n/a until it converts |

The Compliance Officer blocks any message that doesn't match its type's row (wrong template, a represented party in a partition case, a third unprobated contact, sending before the 60-day wait, a tax-sale threat).
