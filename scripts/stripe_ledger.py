#!/usr/bin/env python3
"""Import Stripe balance transactions into pipeline/ledger.csv, read-only and pipeline-only.

Usage: python3 scripts/stripe_ledger.py import <page.json> [<page.json> ...]

Each file is a GetBalanceTransactions response ({"data": [...]}) the Bookkeeper read with the
Stripe connector (stripe_api_read only). The Stripe account is the owner's whole business, so a
transaction is imported ONLY when its description names a lead id from the tracker or contains
the tag in config.yaml -> bookkeeping.stripe.tag (default "probate"). Everything else is counted
and skipped. Payouts and payout holds are transfers to the owner's bank, never income, and are
always skipped. Each imported row's doc_ref is "stripe:<txn id>", so re-importing never duplicates.
No card, bank or customer details are read or written: only date, amount, type and description.
"""
import csv, datetime, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEDGER = os.path.join(ROOT, "pipeline", "ledger.csv")
COLS = ["date", "lead_id", "type", "category", "amount", "status", "counterparty_role", "doc_ref", "notes"]
SKIP_TYPES = {"payout", "payout_minimum_balance_hold", "payout_minimum_balance_release", "transfer", "payout_cancel", "payout_failure"}


def tag():
    cfg = open(os.path.join(ROOT, "config.yaml")).read()
    m = re.search(r"^bookkeeping:\s*\n(?:\s+.*\n)*?\s+tag:\s*\"?([A-Za-z0-9_-]+)", cfg, re.M)
    return (m.group(1) if m else "probate").lower()


def lead_ids():
    with open(os.path.join(ROOT, "pipeline", "deal-tracker.csv")) as f:
        return [r["lead_id"] for r in csv.DictReader(f) if r.get("lead_id")]


def rows_for(t, leads, tg):
    """Ledger rows for one balance transaction, or [] if it isn't the pipeline's."""
    if t.get("type") in SKIP_TYPES or t.get("reporting_category") in ("payout",):
        return []
    desc = (t.get("description") or "").strip()
    low = desc.lower()
    lead = next((l for l in leads if l.lower() in low), "")
    if not lead and tg not in low:
        return []
    if (t.get("currency") or "usd").lower() != "usd":
        raise SystemExit(f"{t['id']}: non-USD transaction; record it by hand with the converted amount")
    date = datetime.datetime.fromtimestamp(int(t["created"]), datetime.timezone.utc).date().isoformat()
    amt = int(t.get("amount") or 0) / 100.0
    fee = int(t.get("fee") or 0) / 100.0
    note = ("Stripe: " + desc)[:120]
    ref = "stripe:" + t["id"]
    out = []
    kind = t.get("type")
    if kind in ("charge", "payment") and amt > 0:
        out.append({"type": "income", "category": "other", "amount": f"{amt:.2f}", "counterparty_role": "Stripe customer"})
    elif kind in ("refund", "payment_refund") or (kind in ("charge", "payment") and amt < 0):
        out.append({"type": "expense", "category": "refund", "amount": f"{abs(amt):.2f}", "counterparty_role": "Stripe customer"})
    elif kind in ("stripe_fee", "application_fee", "adjustment") or amt < 0:
        out.append({"type": "expense", "category": "payment_fees" if kind == "stripe_fee" else "other", "amount": f"{abs(amt):.2f}", "counterparty_role": "Stripe"})
    elif amt > 0:
        out.append({"type": "income", "category": "other", "amount": f"{amt:.2f}", "counterparty_role": "Stripe"})
    if fee > 0:
        out.append({"type": "expense", "category": "payment_fees", "amount": f"{fee:.2f}", "counterparty_role": "Stripe", "fee": True})
    rows = []
    for o in out:
        rows.append({"date": date, "lead_id": lead, "type": o["type"], "category": o["category"], "amount": o["amount"],
                     "status": "actual", "counterparty_role": o["counterparty_role"],
                     "doc_ref": ref + (":fee" if o.get("fee") else ""), "notes": note + (" (Stripe fee)" if o.get("fee") else "")})
    return rows


def main():
    if len(sys.argv) < 3 or sys.argv[1] != "import":
        raise SystemExit(__doc__)
    existing = list(csv.DictReader(open(LEDGER))) if os.path.exists(LEDGER) else []
    have = {r.get("doc_ref") for r in existing}
    leads, tg = lead_ids(), tag()
    added, skipped, seen = [], 0, 0
    for path in sys.argv[2:]:
        doc = json.load(open(path))
        for t in doc.get("data", []):
            seen += 1
            new = rows_for(t, leads, tg)
            if not new:
                skipped += 1
                continue
            for r in new:
                if r["doc_ref"] not in have:
                    added.append(r); have.add(r["doc_ref"])
    if added:
        with open(LEDGER, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=COLS); w.writeheader(); w.writerows(existing + added)
    print(f"stripe: {seen} transactions read, {len(added)} ledger rows added, {skipped} not the pipeline's (skipped)")


if __name__ == "__main__":
    main()
