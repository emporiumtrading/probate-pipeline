#!/usr/bin/env python3
"""Owner settings entered on the dashboard's Setup page.

The page saves one document per setup area in the dashboard's own store
(data/users/<owner id>/setup/areas/<area>), so nothing is lost when the repo is pushed.
Each run, the runner reads that collection (db_list) and imports it here; the result,
pipeline/owner-settings.json, overrides the matching defaults in config.yaml. Exception: the outreach
mode follows the owner's newer decision (effective_outreach): the page's saved_at against
config.yaml -> autonomy.outreach_decided_on.

  python3 scripts/owner_settings.py import <db_list output saved as a file>
  python3 scripts/owner_settings.py check

Rules: only the fields below are kept; bank details, card numbers and secrets are
refused outright (the system never stores or uses them); API keys never come through
the page, the runner asks for them in Claude's secure credential form.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "pipeline", "owner-settings.json")

STATES = {"AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"}
TEXT, BOOL, DATE = "text", "bool", "date"
CHANNELS = ("mail_sending", "email_sending", "inbox_connected", "mail_scanning", "voicemail_to_email", "field_inspections")
SCHEMA = {
    "business": {"legal_name": TEXT, "entity_state": "state", "mailing_address": TEXT, "phone": "phone", "email": "email",
                 "website": "url", "signer": TEXT, "title_company": TEXT, "insurance": TEXT},
    "channels": {**{f"{c}_provider": TEXT for c in CHANNELS}, **{f"{c}_address": TEXT for c in CHANNELS},
                 **{f"{c}_ready": BOOL for c in CHANNELS}},
    "autonomy": {"outreach": ("drafts_only", "autonomous"), "confirmed": BOOL, "confirm_text": TEXT},
    "market": {"attorney_name": TEXT, "attorney_firm": TEXT, "approved_on": DATE, "approval_doc": TEXT,
               "licensed_or_partnered": BOOL, "license_ref": TEXT},
}
META = {"saved_at", "saved_by"}

# Never stored: bank / card numbers and anything that looks like a secret.
BANNED = [
    (re.compile(r"(?<![\d-])\d{9,19}(?![\d-])"), "a long number (bank account, routing or card number)"),
    (re.compile(r"\b(routing|aba|iban|swift|bic|account\s*(no|number|#)|acct|sort\s*code)\b", re.I), "bank details"),
    (re.compile(r"\b(password|passwd|api[\s_-]?key|secret|token|bearer)\b", re.I), "a password or key"),
    (re.compile(r"\b(sk|pk|rk|re|key)_[A-Za-z0-9]{12,}"), "an API key"),
]


class Refused(ValueError):
    pass


def area_kind(area_id):
    if area_id in ("business", "channels", "autonomy"):
        return area_id
    if re.fullmatch(r"market-[a-z]{2}-[a-z0-9-]{2,40}", area_id):
        return "market"
    raise Refused(f"unknown setup area '{area_id}'")


def clean(area_id, doc):
    kind = area_kind(area_id)
    out = {}
    for k, v in doc.items():
        if k in META:
            out[k] = str(v)[:40]
            continue
        t = SCHEMA[kind].get(k)
        if t is None or k == "id":
            continue  # unknown fields are dropped, never stored
        if t == BOOL:
            out[k] = v is True or str(v).lower() == "true"
            continue
        s = str(v if v is not None else "").strip()
        if len(s) > 200:
            raise Refused(f"{area_id}.{k}: longer than 200 characters")
        if t != "phone":
            for rx, what in BANNED:
                if rx.search(s):
                    raise Refused(f"{area_id}.{k}: looks like {what}; that is never stored here")
        if s:
            if isinstance(t, tuple) and s not in t:
                raise Refused(f"{area_id}.{k}: must be one of {', '.join(t)}")
            if t == "state" and s.upper() not in STATES:
                raise Refused(f"{area_id}.{k}: not a US state code")
            if t == "phone" and not re.fullmatch(r"\+?[0-9 ().-]{7,20}", s):
                raise Refused(f"{area_id}.{k}: not a phone number")
            if t == "email" and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}", s):
                raise Refused(f"{area_id}.{k}: not an email address")
            if t == "url" and not re.fullmatch(r"https?://\S+", s):
                raise Refused(f"{area_id}.{k}: must start with https://")
            if t == DATE and not re.fullmatch(r"20\d\d-[01]\d-[0-3]\d", s):
                raise Refused(f"{area_id}.{k}: date must be YYYY-MM-DD")
        out[k] = s.upper() if t == "state" else s
    if kind == "autonomy" and out.get("outreach") == "autonomous":
        if not (out.get("confirmed") and out.get("confirm_text", "").strip().upper() == "AUTHORIZE"):
            raise Refused("autonomy: switching outreach to autonomous needs the confirmation box and the word AUTHORIZE")
    return out


def load():
    """Overlay for the builder and QA: {area_id: fields}. Empty if nothing was saved yet."""
    if not os.path.exists(OUT):
        return {}
    data = json.load(open(OUT))
    return {a: clean(a, d) for a, d in data.get("areas", {}).items()}


def effective_outreach(cfg_text=None, overlay=None):
    """The outreach mode in force: the owner's newer decision wins.

    config.yaml -> autonomy.outreach carries the date of the owner's decision in autonomy.outreach_decided_on;
    the Setup page's autonomy area carries saved_at. Whichever is newer applies (same day: the page). With no
    decision date in config.yaml the page wins, as before. Per-market gates (attorney_approved, channels,
    Compliance Officer, 90-day wait) apply on top of this in every case.
    """
    if cfg_text is None:
        cfg_text = open(os.path.join(ROOT, "config.yaml")).read()
    b = re.search(r"\nautonomy:[^\n]*\n((?:  [^\n]*\n)+)", cfg_text)
    blk = b.group(1) if b else ""
    mode = (re.search(r"^  outreach:\s*(\w+)", blk, re.M) or [None, "drafts_only"])[1]
    decided = (re.search(r"^  outreach_decided_on:\s*(\d{4}-\d\d-\d\d)", blk, re.M) or [None, ""])[1]
    page = (overlay if overlay is not None else load()).get("autonomy", {})
    if page.get("outreach"):
        page_date = str(page.get("saved_at") or "")[:10]
        if not decided or (page_date and page_date >= decided):
            return page["outreach"]
    return mode if mode in ("drafts_only", "autonomous") else "drafts_only"


def parse_db_list(text):
    """Accept the db_list tool output (one JSON object per line, with id and data) or a plain {area: fields} JSON."""
    areas = {}
    try:
        j = json.loads(text)
        if isinstance(j, dict) and "areas" in j:
            return j["areas"]
        if isinstance(j, dict) and isinstance(j.get("docs"), list):  # db_list's raw {"docs": [...]} envelope
            return {d["id"]: d["data"] for d in j["docs"] if isinstance(d, dict) and "id" in d and isinstance(d.get("data"), dict)}
        if isinstance(j, dict) and "id" in j and isinstance(j.get("data"), dict):
            return {j["id"]: j["data"]}  # a db_list output with a single document
        if isinstance(j, dict) and all(isinstance(v, dict) for v in j.values()):
            return j
    except ValueError:
        pass
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            o = json.loads(line)
        except ValueError:
            continue
        if "id" in o and isinstance(o.get("data"), dict):
            areas[o["id"]] = o["data"]
    return areas


CONFIG = os.path.join(ROOT, "config.yaml")


def apply_business(areas):
    """Write the Business identity saved on the Setup page into config.yaml → business, so every part
    of the system (attorney packets, letters, notices, the email-channel check, the workers) uses it.
    Only non-empty saved fields are written; nothing else in config.yaml is touched."""
    biz = {k: v for k, v in (areas.get("business") or {}).items() if k in SCHEMA["business"] and str(v or "").strip()}
    if not biz:
        return 0
    txt = open(CONFIG).read()
    m = re.search(r"(?m)^business:.*\n((?:[ \t]+.*\n|\n)*?)(?=^\S)", txt)
    if not m:
        return 0
    block, n = m.group(1), 0
    for k, v in biz.items():
        val = str(v).strip().replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
        line = re.compile(rf'(?m)^(  {re.escape(k)}:[ \t]*)("[^"\n]*"|[^#\n]*?)([ \t]*#.*)?$')
        if line.search(block):
            new = line.sub(lambda mm: f'{mm.group(1)}"{val}"' + (("  " + mm.group(3).strip()) if mm.group(3) else ""), block, count=1)
        else:
            new = block.rstrip("\n") + f'\n  {k}: "{val}"\n'
        if new != block:
            n += 1
            block = new
    if n:
        open(CONFIG, "w").write(txt[:m.start(1)] + block + txt[m.end(1):])
    return n


def apply_owner_switches(areas):
    """Channels with nothing for a run to test (owner decision 2026-11-27): the field-inspection service account is the
    owner's own word, so ticking it on the Setup page sets config.yaml → channels.field_inspections."""
    want = "true" if (areas.get("channels") or {}).get("field_inspections_ready") is True else None
    if not want:
        return 0
    txt = open(CONFIG).read()
    new = re.sub(r"(?m)^(  field_inspections:[ \t]*)false", r"\g<1>true", txt, count=1)
    if new != txt:
        open(CONFIG, "w").write(new)
        return 1
    return 0


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "import":
        raw = parse_db_list(open(sys.argv[2]).read())
        good, bad = {}, []
        for a, d in raw.items():
            try:
                good[a] = clean(a, d)
            except Refused as e:
                bad.append(str(e))
        json.dump({"source": "dashboard Setup page (owner)", "areas": dict(sorted(good.items()))}, open(OUT, "w"), indent=2, sort_keys=True)
        open(OUT, "a").write("\n")
        print(f"owner settings: {len(good)} areas imported to pipeline/owner-settings.json")
        n = apply_business(good)
        if n:
            print(f"owner settings: {n} business details written into config.yaml")
        if apply_owner_switches(good):
            print("owner settings: field-inspection service account marked ready in config.yaml")
        for b in bad:
            print("REFUSED", b)
        sys.exit(1 if bad else 0)
    if len(sys.argv) >= 2 and sys.argv[1] == "check":
        try:
            print(f"owner settings OK: {len(load())} areas")
        except Refused as e:
            print("FAIL", e)
            sys.exit(1)
        return
    print(__doc__)
    sys.exit(2)


if __name__ == "__main__":
    main()
