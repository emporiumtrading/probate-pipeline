# Candidate (not a lead yet): 26-CP-003957, Pillows trust (EX-0002 / H-0004)
Checked 2026-11-22 by the fast desk (Researcher role).

## Verified
- Clerk daily probate filings, ProbateFiling_20261119.csv (https://publicrec.hillsclerk.com/Probate/dailyfilings/ProbateFiling_20261119.csv), case 26-CP-003957, "Notice of Trust", filed 2026-11-19, no attorney:
  - Decedent: ELLENDER FAYE PILLOWS, also listed as FAYE E. PILLOW (two decedent rows, same case)
  - Trustee: GINGER RENEE WADE
  - Date of death: blank. Decedent address: blank.
- Hillsborough PAO parcel layer (maps.hillsboroughcounty.org PAO/HC_Properties MapServer/1, query UPPER(OWNER) LIKE '%PILLOW%', 2026-11-22):
  | folio | owner | site | tax mail | just value | bd/ba | sf | built | last sale |
  |---|---|---|---|---|---|---|---|---|
  | 0524280000 | Elber L And Faye E Pillows Trustees | 722 Eagle Ln, Apollo Beach | 722 Eagle Ln, Apollo Beach 33572 | $623,221 | 3/2.5 | 2,502 | 1998 | 2006-05-31 $100 |
  | 0747436506 | Elbert L And Faye E Pillows/trustees | 540 Emberwood Dr, Brandon | 722 Eagle Ln, Apollo Beach 33572 | $266,207 | 3/2 | 1,676 | 1986 | 2006-05-31 $100 |
- The "Pillow" vs "Pillows" difference is explained by the filing itself (aka FAYE E. PILLOW). The surname PILLOWS and the given name Faye E match.

## Not confirmed
- Address match: the filing has no decedent address, so the match can't be confirmed by site or mailing address (daily-run step 3 rule).
- Date of death: not in the filing. No obituary found by web search under "Faye Pillows" (Apollo Beach) or "Ellender Pillows" (2026-11-22).
- Whether Elbert L. Pillows (co-trustee) is also deceased: unknown.
- Successor trustee from a recorded document: not checked (Official Records is untested).

## Next step (manual)
Read the Notice of Trust in HOVER (https://hover.hillsclerk.com, blocked to automation) for the decedent's address and date of death, or find an obituary or death record. If the address is 722 Eagle Ln, add both parcels as `trust` leads and send them to the Heir & Title Tracer.
