#!/usr/bin/env python3
"""State rules table (owner request 2026-11-27: the whole system and every worker must understand each state's rules).

legal/state-rules.csv holds one row per state + DC with the rules that change what a worker does, as fixed values
that scripts and QA can read. legal/<STATE>.md stays the full write-up with sources; this table is its summary.
The Legal Advisor keeps both in step. A value is only filled in from a source the Legal Advisor read (cited in the
state's legal file); anything not yet researched stays "unknown", and "unknown" always means "act as if the
strictest rule applies" (see RULES below).
A value that makes a rule less strict (no licence, no court approval, fee splits allowed, a longer redemption) needs a
VERIFIED primary source in the legal file; a stricter value may rest on an unverified note, since "unknown" already
assumes the strictest case. Where a rule depends on the facts (homestead or not, vacant or occupied), record the
strictest case that can apply to an inherited house and explain it in `notes`.

  python3 scripts/state_rules.py seed            # add missing states (never overwrites a row)
  python3 scripts/state_rules.py show FL         # plain-English rules for one state, for any worker
  python3 scripts/state_rules.py check           # validate values (also run by qa_checks.py)
  python3 scripts/state_rules.py set FL tax_sale_type=lien tax_redemption_months=24 ...   # Legal Advisor only
"""
import csv
import datetime
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "legal", "state-rules.csv")
LOG = os.path.join(ROOT, "legal", "state-rules-log.csv")   # every change: who can see what changed, when, from which source
LOG_COLS = ["date", "state", "field", "old", "new", "sources"]
STATES = ("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK "
          "OR PA RI SC SD TN TX UT VT VA WA WV WI WY").split()
NUM = r"^(\d+(\.\d+)?|unknown|none)$"
# field: (allowed values as a regex, what it means, what a worker does while it's "unknown")
RULES = {
    "rules_status": (r"^(not_started|partial|verified|attorney_approved)$", "How far this state's rules are researched",
                     "not_started: research only; no outreach, offers or contracts in this state"),
    "last_verified": (r"^(\d{4}-\d{2}-\d{2}|)$", "Date the Legal Advisor last checked the sources", ""),
    "wholesale_license": (r"^(no|yes|threshold|unknown)$", "Is a real-estate licence needed to assign contracts (threshold = after a number of deals a year)",
                          "treat as needed: no assignment marketing until confirmed"),
    "wholesale_disclosure": (r"^(yes|no|unknown)$", "Does the state require a written wholesaler disclosure to the seller",
                             "give the strictest disclosure in the contract-desk template"),
    "seller_cancel_days": (NUM, "Statutory seller cancellation period in days (none = no statutory right)",
                           "assume the seller may cancel; no buyer deposit or assignment until it would have passed"),
    "fee_split_allowed": (r"^(no|yes|unknown)$", "May a fee be shared with an unlicensed person (bird dog, other wholesaler)", "treat as no"),
    "probate_court_approval": (r"^(always|intestate_only|depends|no|unknown)$", "Does an estate sale need a court order or confirmation",
                               "add a court-approval contingency to the contract and plan for it in the timeline"),
    "estate_price_floor": (r"^([\w%. ,;()-]{1,80})$", "Minimum price an estate may accept (e.g. '80% of appraised') or none",
                           "the Deal Analyst checks the inventory value before any offer"),
    "small_estate_limit_usd": (NUM, "Value limit for the small-estate / summary process", "treat as full probate"),
    "tax_sale_type": (r"^(lien|deed|hybrid|unknown)$", "What the county sells when taxes go unpaid: the tax lien certificate, the house (deed), or either",
                      "tax-delinquent leads stay research only"),
    "tax_redemption_after_sale": (r"^(yes|no|unknown)$", "Can the family pay the taxes and keep the house after a tax sale", "treat as no: the sale date is final"),
    "tax_redemption_months": (NUM, "How long that redemption lasts, in months", "treat as 0"),
    "contact_rules": (r"^(state_dnc|registration|both|federal_only|unknown)$", "Extra state rules on solicitation: own do-not-call list, telemarketer registration, both, or only the federal rules",
                      "mail only; no calls or texts (they are never automatic anyway)"),
    "notes": (r"^[^\n]{0,400}$", "Anything else a worker must know", ""),
    "sources": (r"^[^\n]{0,400}$", "Where the values come from (sections of legal/<STATE>.md)", ""),
}
COLS = ["state", "legal_file"] + list(RULES)
LABEL = {"wholesale_license": "Licence to wholesale", "wholesale_disclosure": "Wholesaler disclosure", "seller_cancel_days": "Seller cancellation (days)",
         "fee_split_allowed": "Fee splits with unlicensed people", "probate_court_approval": "Court approval of estate sales",
         "estate_price_floor": "Estate price floor", "small_estate_limit_usd": "Small-estate limit ($)", "tax_sale_type": "Tax sale type",
         "tax_redemption_after_sale": "Redemption after tax sale", "tax_redemption_months": "Redemption period (months)", "contact_rules": "Extra contact rules"}


def load():
    return list(csv.DictReader(open(PATH))) if os.path.exists(PATH) else []


def save(rows):
    rows.sort(key=lambda r: r["state"])
    with open(PATH, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def blank(st):
    has = os.path.exists(os.path.join(ROOT, "legal", f"{st}.md"))
    r = {c: "unknown" for c in COLS}
    r.update(state=st, legal_file="yes" if has else "no", rules_status="partial" if has else "not_started", last_verified="",
             notes="", sources=f"legal/{st}.md" if has else "")
    return r


def _logged():
    if not hasattr(_logged, "v"):
        last = {}
        for x in (csv.DictReader(open(LOG)) if os.path.exists(LOG) else []):
            last[(x["state"], x["field"])] = x["new"]
        _logged.v = {(st, f, v) for (st, f), v in last.items()}
    return _logged.v


def stale(r, days):
    try:
        return (datetime.date.today() - datetime.date.fromisoformat(r.get("last_verified") or "")).days > days
    except ValueError:
        return False


def check(rows, full=True):
    errs = []
    seen = {r["state"] for r in rows}
    for st in (STATES if full else ()):
        if st not in seen:
            errs.append(f"state-rules: {st} missing (run scripts/state_rules.py seed)")
    for r in rows:
        if r["state"] not in STATES:
            errs.append(f"state-rules: unknown state {r['state']}")
        for k, (rx, _, _) in RULES.items():
            if not re.match(rx, r.get(k) or ""):
                errs.append(f"state-rules: {r['state']} {k}='{r.get(k)}' not allowed")
        if r.get("rules_status") in ("verified", "attorney_approved"):
            if not re.match(r"\d{4}-", r.get("last_verified") or ""):
                errs.append(f"state-rules: {r['state']} is {r['rules_status']} with no last_verified date")
            if not os.path.exists(os.path.join(ROOT, "legal", f"{r['state']}.md")):
                errs.append(f"state-rules: {r['state']} is {r['rules_status']} with no legal/{r['state']}.md")
            unk = [k for k in LABEL if r.get(k) == "unknown"]
            if unk:
                errs.append(f"state-rules: {r['state']} is {r['rules_status']} but still has unknown rules ({', '.join(unk[:3])})")
        filled = [k for k in LABEL if r.get(k, "unknown") != "unknown"]
        if filled and f"legal/{r['state']}.md" not in (r.get("sources") or ""):
            errs.append(f"state-rules: {r['state']} has rules filled in but its sources don't cite legal/{r['state']}.md")
        if full:
            for k in filled:
                if (r["state"], k, r[k]) not in _logged():
                    errs.append(f"state-rules: {r['state']} {k}='{r[k]}' was not recorded with scripts/state_rules.py set (no log entry)")
    return errs


def show(st):
    r = {x["state"]: x for x in load()}.get(st.upper())
    if not r:
        return f"{st}: no row; run scripts/state_rules.py seed"
    out = [f"{r['state']} rules: {r['rules_status']}" + (f", checked {r['last_verified']}" if r["last_verified"] else "")
           + f" · full write-up: legal/{r['state']}.md" + ("" if r["legal_file"] == "yes" else " (not written yet)")]
    for k, (_, what, unknown) in RULES.items():
        if k in LABEL:
            v = r.get(k, "unknown")
            out.append(f"- {LABEL[k]}: {v}" + (f"  → until known: {unknown}" if v == "unknown" and unknown else ""))
    if r["rules_status"] == "not_started":
        out.append("→ " + RULES["rules_status"][2])
    if r.get("notes"):
        out.append(f"Notes: {r['notes']}")
    return "\n".join(out)


def main(a):
    cmd = a[0] if a else "show"
    if cmd == "seed":
        rows = load()
        have = {r["state"] for r in rows}
        for r in rows:   # legal files written since the last seed
            if r["legal_file"] == "no" and os.path.exists(os.path.join(ROOT, "legal", f"{r['state']}.md")):
                r["legal_file"] = "yes"
                if r["rules_status"] == "not_started":
                    r["rules_status"] = "partial"
        rows += [blank(s) for s in STATES if s not in have]
        save(rows)
        print(f"state-rules: {len(rows)} states")
    elif cmd == "show":
        print(show(a[1] if len(a) > 1 else "FL"))
    elif cmd == "check":
        e = check(load())
        print("\n".join(e) or "state-rules: ok")
        sys.exit(1 if e else 0)
    elif cmd == "set":
        rows = load()
        r = next((x for x in rows if x["state"] == a[1].upper()), None)
        if not r:
            sys.exit(f"no row for {a[1]}")
        old = dict(r)
        for kv in a[2:]:
            k, v = kv.split("=", 1)
            if k not in RULES or k == "last_verified":
                sys.exit(f"unknown or automatic field {k}")
            r[k] = v
        r["last_verified"] = datetime.date.today().isoformat()
        e = check([r], full=False)
        if e:
            sys.exit("\n".join(e))
        save(rows)
        new_log = not os.path.exists(LOG)
        with open(LOG, "a", newline="") as f:
            w = csv.DictWriter(f, fieldnames=LOG_COLS)
            if new_log:
                w.writeheader()
            for k in RULES:
                if k not in ("last_verified", "sources", "notes") and old.get(k) != r.get(k):
                    w.writerow({"date": r["last_verified"], "state": r["state"], "field": k, "old": old.get(k, ""), "new": r[k], "sources": r.get("sources", "")})
        print(show(r["state"]))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
