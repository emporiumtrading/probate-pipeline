#!/usr/bin/env python3
"""The return address for every mailed letter (owner decision 2026-11-27): addressed to the business, never a person,
so the building's mail service at the principal address routes replies to Emporium Investments and scans them.

  python3 scripts/lob_from.py          # prints the Lob `from` address object as JSON (from config.yaml → business)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from fill_signature import business  # noqa: E402

STATES = {"illinois": "IL", "florida": "FL", "ohio": "OH", "texas": "TX", "pennsylvania": "PA", "tennessee": "TN"}


def lob_from():
    b = business()
    a = b.get("mailing_address", "")
    m = re.match(r"\s*(.+?),?\s+((?:Suite|Ste\.?|Unit|#)\s*[\w-]+),?\s+(.+?),?\s+([A-Za-z ]+?)\s+(\d{5}(?:-\d{4})?)\s*$", a, re.I)
    if not m:
        sys.exit(f"lob_from: can't split the mailing address '{a}'; fix it on the Setup page")
    st = m.group(4).strip()
    return {"name": b.get("legal_name") or "Emporium Investments", "address_line1": m.group(1).strip(), "address_line2": m.group(2).strip(),
            "address_city": m.group(3).strip(), "address_state": STATES.get(st.lower(), st.upper()[:2]), "address_zip": m.group(5),
            "address_country": "US"}


if __name__ == "__main__":
    print(json.dumps(lob_from(), indent=1))
