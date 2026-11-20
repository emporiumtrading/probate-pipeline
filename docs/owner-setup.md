# Owner setup: what only you can do

Work through these in order. Each step says where to go, what to do, and what to record in `config.yaml` afterwards (or ask any Claude session to record it). The dashboard's **Setup & health** tab turns each row green as it's done. Costs and steps change; check each site. None of this is legal or tax advice. Ask your attorney or CPA which entity and state suit you.

## 1. Company (about 1–2 weeks)
1. **Form an LLC** in your home state through its Secretary of State. Find your state's office: https://www.sba.gov/business-guide/launch-your-business/register-your-business
2. **Get an EIN** (free, online, a few minutes): https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number-ein-online
3. **Open a business bank account** at any bank, using the LLC documents and EIN. Assignment fees are paid into this account by the title company at closing. Never put bank details in this repo.
4. Record in `config.yaml` → `business`: `legal_name`, `entity_state`, `signer`.

## 2. Address, phone, email, website (about 1 week)
1. **Virtual mailbox with mail scanning**, which gives you the address printed on letters: for example Anytime Mailbox (https://www.anytimemailbox.com) or iPostal1 (https://ipostal1.com). USPS requires Form 1583, notarized; most of these services offer online notarization. Turn on "scan and email" to your business email. Record `business.mailing_address`, then set `channels.mail_scanning: true`.
2. **Domain and business email**, for example Google Workspace: https://workspace.google.com. Record `business.email`.
3. **Business phone with voicemail-to-email**, for example Google Voice for Workspace: https://workspace.google.com/products/voice/. Send voicemail transcripts to the business email. Someone (you, an assistant or an answering service) must answer calls. Record `business.phone`, then set `channels.voicemail_to_email: true`.
4. **One-page website**: who you are, how earnest money is handled (by the title company), a contact form, your company name and address. Google Sites (https://sites.google.com) or Carrd (https://carrd.co) is enough. Record `business.website`.

## 3. Sending and reading
1. **Email sending (Resend):** it is installed but its connection was never finished. Open https://claude.ai/settings/connectors, finish connecting Resend, then verify your domain in Resend (https://resend.com/domains). Set `channels.email_sending: true`.
2. **Letters:** open an account with a print-and-mail service with an API, for example Lob (https://www.lob.com) or PostGrid (https://www.postgrid.com). Then tell a Claude session "connect the mail API". It will ask you for the key through a secure form; never paste keys in chat. Set `channels.mail_sending: true`.
3. **Inbox:** connect the business mailbox (Gmail connector, at https://claude.ai/settings/connectors) so the daily run can read replies. Set `channels.inbox_connected: true`.

## 4. Attorneys and title companies (per market)
1. Each daily run now shortlists attorneys and title companies for every live market in `network/<market-id>.md`. To find more yourself, use your state bar's lawyer referral service, listed at https://www.americanbar.org/groups/legal_services/flh-home/flh-lawyer-referral-directory/. Look for real estate and probate attorneys in the county.
2. Engage one attorney per market. Mark them engaged in `network/<market-id>.md`, with the email address they will reply from.
3. Send them `legal/attorney-packets/<market-id>.md`, once the "Who we are" section has no **[missing]** lines. When their signed answer comes back, the Legal Advisor records the approval.
4. Choose a title company per market (from the shortlist). Record `business.title_company`. Always confirm wire instructions by phone, at the number on the title company's official website.

## 5. Licensing and calling rules
- **Pennsylvania** (Philadelphia): wholesaling needs a real estate license or a licensed partner (Act 52 of 2024). PA licensing system: https://www.pals.pa.gov. Until then, Philadelphia stays research only. When it's done, set `licensed_or_partnered: true` on that market.
- **Illinois and Oklahoma** also regulate wholesaling. The Legal Advisor checks these before either opens.
- **Before anyone makes sales calls:** register for and check the National Do Not Call Registry: https://telemarketing.donotcall.gov. Follow your attorney's answer on calls and texts for each state. Nothing here ever calls or texts automatically.

## 6. Turn on autonomy (last)
Once a market's attorney has approved, its sending channels work, and the checklist is green for it, ask a Claude session to set `autonomy.outreach: autonomous` and approve the guardrails. Only markets with `attorney_approved` will send without you. Signing, wire confirmations and calls stay with you.
