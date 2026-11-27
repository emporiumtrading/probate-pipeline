#!/usr/bin/env python3
"""Send the company e-signature resolution to the owner through DocuSeal, and record it once signed
(owner request 2026-11-27: "let's enable it"). Needs no AI; the runner calls it every run.

  python3 scripts/resolution_sign.py          # send once if not sent; otherwise check whether it was signed

- Fills legal/company-signature-resolution.html from config.yaml → business, creates a DocuSeal template from it and
  a submission to the owner's notices email (OWNER_NOTIFY_EMAIL, from the dashboard's Full autonomy box). DocuSeal
  emails the owner a signing link.
- When DocuSeal reports it completed, saves the signed PDF to legal/approvals/company-signature-resolution-<date>.pdf
  and writes company_signature.resolution_signed_on in config.yaml (a date the owner's guardrail hash leaves out).
- Never sets `enabled` or the attorney dates: the company signature turns on only after a licensed attorney confirms
  the resolution for a state (agents/legal-advisor.md → Company signature resolution).
State (no keys, no email address): pipeline/company-resolution.json.
"""
import datetime
import html
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE = os.path.join(ROOT, "pipeline", "company-resolution.json")
API = "https://api.docuseal.com"
STATES = {"IL": "Illinois", "FL": "Florida", "OH": "Ohio", "TX": "Texas", "TN": "Tennessee", "PA": "Pennsylvania", "DE": "Delaware", "WY": "Wyoming"}


def api(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-Auth-Token": os.environ["DOCUSEAL_API_KEY"], "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read() or b"{}")


def cfg():
    return open(os.path.join(ROOT, "config.yaml")).read()


def biz(k):
    m = re.search(rf"\nbusiness:[^\n]*\n(?:  .*\n)*?  {k}:\s*\"?([^\"#\n]*)", cfg())
    return m.group(1).strip() if m else ""


def load():
    try:
        return json.load(open(STATE))
    except (OSError, ValueError):
        return {}


def save(s):
    json.dump(s, open(STATE, "w"), indent=1)
    open(STATE, "a").write("\n")


def record_signed(day):
    s = cfg()
    new = re.sub(r'(\ncompany_signature:[^\n]*\n(?:  .*\n)*?  resolution_signed_on:\s*)""', rf'\g<1>{day}', s, count=1)
    if new != s:
        open(os.path.join(ROOT, "config.yaml"), "w").write(new)


def main():
    if re.search(r"\n  resolution_signed_on:\s*\d{4}-", cfg()):
        print("resolution: already signed")
        return
    if not os.environ.get("DOCUSEAL_API_KEY"):
        print("resolution: no DocuSeal key; nothing sent")
        return
    st = load()
    if st.get("submission_id"):
        sub = api("GET", f"/submissions/{st['submission_id']}")
        status = sub.get("status") or (sub.get("submitters") or [{}])[0].get("status", "")
        if status == "completed":
            day = (sub.get("completed_at") or datetime.date.today().isoformat())[:10]
            os.makedirs(os.path.join(ROOT, "legal", "approvals"), exist_ok=True)
            try:
                docs = api("GET", f"/submissions/{st['submission_id']}/documents").get("documents", [])
                if docs:
                    with urllib.request.urlopen(docs[0]["url"], timeout=60) as r:
                        open(os.path.join(ROOT, "legal", "approvals", f"company-signature-resolution-{day}.pdf"), "wb").write(r.read())
            except Exception as e:
                print(f"resolution: signed, but the PDF could not be saved ({type(e).__name__})")
            record_signed(day)
            st.update(status="signed", signed_on=day)
            save(st)
            print(f"resolution: signed {day}; recorded resolution_signed_on (the attorney still has to confirm it per state)")
        else:
            if st.get("status") != status:
                st["status"] = status
                save(st)
            print(f"resolution: sent {st.get('sent_on')}, waiting for the owner's signature ({status or 'pending'})")
        return
    email = os.environ.get("OWNER_NOTIFY_EMAIL", "").strip()
    if not re.match(r"^[^\s@]+@[^\s@]+\.[a-z]{2,}$", email, re.I):
        print("resolution: no notices email saved on the dashboard (Full autonomy box); not sent")
        return
    src = open(os.path.join(ROOT, "legal", "company-signature-resolution.html")).read()
    src = re.sub(r"<!--.*?-->\s*", "", src, count=1, flags=re.S)
    est = biz("entity_state")
    for k, v in {"legal_name": biz("legal_name"), "entity_state": STATES.get(est, est), "signer": biz("signer"), "address": biz("mailing_address")}.items():
        src = src.replace("{{" + k + "}}", html.escape(v))
    tpl = api("POST", "/templates/html", {"html": src, "name": f"{biz('legal_name')}: company e-signature resolution"})
    sub = api("POST", "/submissions", {"template_id": tpl["id"], "send_email": True, "order": "preserved",
                                         "message": {"subject": f"Please sign: {biz('legal_name')} company e-signature resolution",
                                                     "body": "This one-time resolution lets the company e-sign purchase agreements and assignments inside your written limits, once your attorney confirms it for each state. Sign here: {{submitter.link}}"},
                                         "submitters": [{"role": "Manager", "email": email}]})
    first = sub[0] if isinstance(sub, list) else sub
    sid = first.get("submission_id") or first.get("id")
    save({"template_id": tpl["id"], "submission_id": sid, "sent_on": datetime.date.today().isoformat(), "status": "sent"})
    print(f"resolution: sent to the owner's notices email for signature (DocuSeal submission {sid})")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"resolution: DocuSeal call failed ({type(e).__name__}: {str(e)[:160]}); will retry next run")
        sys.exit(0)
