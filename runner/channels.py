#!/usr/bin/env python3
"""channels.py: test the sending and signing services from their keys and
switch the matching channel on or off in config.yaml, so nobody has to.

  email_sending     RESEND_API_KEY works and the business email's domain is verified in Resend
  mail_sending      LOB_API_KEY is a live key that works
  esignature        DOCUSEAL_API_KEY works  -> esignature.connected_on: <date>

Inbox, mail scanning and voicemail stay with the workers' own tests (the runbook).
Prints one line per channel. Usage: python3 runner/channels.py
"""
import base64, datetime, json, os, re, urllib.error, urllib.request

cfg = open("config.yaml").read()
orig = cfg
today = datetime.date.today().isoformat()


def get(url, headers):
    req = urllib.request.Request(url, headers={**headers, "User-Agent": "probate-pipeline-runner"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def set_flag(name, on):
    global cfg
    cfg = re.sub(rf"(\n  {name}:\s*)(true|false)", lambda m: m.group(1) + ("true" if on else "false"), cfg, count=1)


m = re.search(r"(?:^|\n)business:.*?\n\s+email:\s*\"?([^\"\s#]*)", cfg, re.S)
biz_domain = (m.group(1).split("@")[-1].lower() if m and "@" in m.group(1) else "")

# Email (Resend)
k = os.environ.get("RESEND_API_KEY")
ok, why = False, "no key"
if k:
    try:
        doms = get("https://api.resend.com/domains", {"Authorization": f"Bearer {k}"}).get("data", [])
        good = {d.get("name", "").lower() for d in doms if d.get("status") == "verified"}
        # Owner decision 2026-11-27: replies are received on replies.<domain> only, never on the main domain, whose MX
        # records carry the owner's own mailbox (hostedemail) and Amazon SES. So: receiving off on the main domain,
        # and a receiving-only replies.<domain> created once. Both calls are idempotent.
        def _call(method, url, body=None):
            rq = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                 headers={"Authorization": f"Bearer {k}", "Content-Type": "application/json", "User-Agent": "probate-pipeline-runner"})
            with urllib.request.urlopen(rq, timeout=30) as r_:
                return json.load(r_)
        if biz_domain:
            for d in doms:
                if d.get("name", "").lower() == biz_domain and (d.get("capabilities") or {}).get("receiving") == "enabled":
                    _call("PATCH", f"https://api.resend.com/domains/{d.get('id')}", {"capabilities": {"receiving": "disabled"}})
                    print(f"channels: resend receiving turned off on {biz_domain} (its MX records belong to the business mailbox)")
            if not any(d.get("name", "").lower() == f"replies.{biz_domain}" for d in doms):
                try:
                    _call("POST", "https://api.resend.com/domains", {"name": f"replies.{biz_domain}", "capabilities": {"sending": "disabled", "receiving": "enabled"}})
                    print(f"channels: resend domain replies.{biz_domain} created for receiving replies")
                except urllib.error.HTTPError as e_:
                    print(f"channels: could not create replies.{biz_domain}: {e_.code} {e_.read()[:160].decode(errors='replace')}")
            doms = get("https://api.resend.com/domains", {"Authorization": f"Bearer {k}"}).get("data", [])
        # For the business domain (and its subdomains) not yet verified: print the exact DNS records Resend wants,
        # and keep them in pipeline/email-dns-records.csv so they can be added at the DNS host (public values only).
        rows = []
        for d in doms:
            nm = d.get("name", "").lower()
            if biz_domain and (nm == biz_domain or nm.endswith("." + biz_domain)):
                det = get(f"https://api.resend.com/domains/{d.get('id')}", {"Authorization": f"Bearer {k}"})
                for r in det.get("records") or []:
                    rows.append([nm, d.get("status", ""), r.get("record", ""), r.get("name", ""), r.get("type", ""),
                                 r.get("value", ""), str(r.get("priority", "") or ""), r.get("status", "")])
                    if d.get("status") != "verified":
                        print(f"channels: resend {nm} needs {r.get('type')} {r.get('name')} = {r.get('value')}"
                              f"{(' priority ' + str(r.get('priority'))) if r.get('priority') is not None else ''} [{r.get('status')}]")
        # Ask Resend to re-check DNS for any of our domains not verified yet (its "Verify" button).
        for d in doms:
            nm = d.get("name", "").lower()
            if biz_domain and (nm == biz_domain or nm.endswith("." + biz_domain)) and d.get("status") != "verified":
                try:
                    _call("POST", f"https://api.resend.com/domains/{d.get('id')}/verify")
                except Exception:
                    pass
        # Replies inbox: on once replies.<domain> is verified with receiving (scripts/fetch_replies.py collects them).
        rep = next((d for d in doms if d.get("name", "").lower() == f"replies.{biz_domain}"), None) if biz_domain else None
        rep_ok = bool(rep and rep.get("status") == "verified")
        set_flag("inbox_connected", rep_ok)
        if rep_ok:
            open("pipeline/reply-address.txt", "w").write(f"reply@replies.{biz_domain}\n")
        print(f"channels: inbox_connected={rep_ok} ({'replies.' + biz_domain + ' ' + (rep.get('status') if rep else 'missing')})")
        if rows:
            import csv as _csv
            with open("pipeline/email-dns-records.csv", "w", newline="") as fh:
                w = _csv.writer(fh); w.writerow(["domain", "domain_status", "record", "name", "type", "value", "priority", "status"]); w.writerows(rows)
        # A verified sending subdomain of the business domain (e.g. mail.<domain>) is preferred for bulk mail
        # (agents/communications.md → Email deliverability); the main domain itself also counts.
        subs = sorted(d for d in good if biz_domain and d.endswith("." + biz_domain) and not d.startswith("replies."))
        ok = bool(biz_domain) and (bool(subs) or biz_domain in good)
        send_from = subs[0] if subs else (biz_domain if ok else "")
        why = f"ok, sending domain {send_from}" if ok \
            else ((f"add the DNS records listed above at the DNS host, then Resend verifies {', '.join(sorted(d.get('name','') for d in doms if biz_domain in d.get('name','')))}"
                   if any(biz_domain in d.get("name", "") for d in doms) else f"add {biz_domain} (or mail.{biz_domain}) in Resend") if biz_domain else "business email not set")
        if send_from:
            open("pipeline/sending-domain.txt", "w").write(send_from + "\n")   # Communications sends bulk mail from this domain
    except urllib.error.HTTPError as e:
        # A sending-only key can't list domains. Test it with one send to Resend's own test inbox
        # (delivered@resend.dev: accepted, never delivered to a person, no effect on reputation),
        # from the mail. subdomain first, then the main domain: Resend refuses an unverified domain.
        body = e.read()[:300].decode(errors="replace")
        if "restricted" in body.lower() and biz_domain:
            why = f"sending-only key: verify mail.{biz_domain} in Resend"
            for dom in (f"mail.{biz_domain}", biz_domain):
                req = urllib.request.Request("https://api.resend.com/emails", method="POST",
                      data=json.dumps({"from": f"Emporium Investments <test@{dom}>", "to": ["delivered@resend.dev"],
                                       "subject": "Sending check", "text": "Automated sending check."}).encode(),
                      headers={"Authorization": f"Bearer {k}", "Content-Type": "application/json", "User-Agent": "probate-pipeline-runner"})
                try:
                    with urllib.request.urlopen(req, timeout=30):
                        ok, why = True, f"ok, sending domain {dom} (sending-only key)"
                        open("pipeline/sending-domain.txt", "w").write(dom + "\n")
                        break
                except urllib.error.HTTPError:
                    continue
        else:
            why = f"Resend error {e.code}: {body[:80]}"
    except Exception as e:
        why = f"Resend error {str(e)[:80]}"
set_flag("email_sending", ok)
print(f"channels: email_sending={ok} ({why})")

# Letters (Lob)
k = os.environ.get("LOB_API_KEY")
ok, why = False, "no key"
if k:
    try:
        get("https://api.lob.com/v1/addresses?limit=1", {"Authorization": "Basic " + base64.b64encode((k + ":").encode()).decode()})
        ok = k.startswith("live_")
        why = "ok" if ok else "test key: nothing is mailed"
    except urllib.error.HTTPError as e:
        # A live key without a payment method on file works only for address verification (Lob's rule).
        why = f"Lob error {e.code}"
        if e.code in (401, 403) and k.startswith("live_"):
            try:
                req = urllib.request.Request("https://api.lob.com/v1/us_verifications", method="POST",
                      data=json.dumps({"primary_line": "208 S LaSalle St", "city": "Chicago", "state": "IL", "zip_code": "60604"}).encode(),
                      headers={"Authorization": "Basic " + base64.b64encode((k + ":").encode()).decode(), "Content-Type": "application/json", "User-Agent": "probate-pipeline-runner"})
                urllib.request.urlopen(req, timeout=30).close()
                why = "key works, but Lob mails only once the account has a billing address and payment method"
            except urllib.error.HTTPError as e2:
                why = ("key works, but Lob mails only once the account has a billing address and payment method"
                       if e2.code == 403 else "Lob refused the key: use the Live Secret key (live_..., not live_pub_...)")
            except Exception:
                why = "Lob refused the key: use the Live Secret key (live_..., not live_pub_...)"
    except Exception as e:
        why = f"Lob error {str(e)[:80]}"
set_flag("mail_sending", ok)
print(f"channels: mail_sending={ok} ({why})")

# E-signature (DocuSeal)
k = os.environ.get("DOCUSEAL_API_KEY")
ok, why = False, "no key"
if k:
    try:
        get("https://api.docuseal.com/templates?limit=1", {"X-Auth-Token": k})
        ok, why = True, "ok"
    except Exception as e:
        why = f"DocuSeal error {str(e)[:80]}"
cur = re.search(r"\nesignature:.*?\n\s+connected_on:\s*\"?([^\"\n#]*)", cfg, re.S)
cur = (cur.group(1).strip() if cur else "")
if ok and not cur:
    cfg = re.sub(r"(\nesignature:.*?\n\s+connected_on:\s*)\"?[^\"\s#]*\"?", lambda m: m.group(1) + today, cfg, count=1, flags=re.S)
if not ok and cur:
    cfg = re.sub(r"(\nesignature:.*?\n\s+connected_on:\s*)\"?[^\"\s#]*\"?", lambda m: m.group(1) + '""', cfg, count=1, flags=re.S)
print(f"channels: esignature={ok} ({why})")

# Field inspections (ProxyPics; owner decision 2026-11-27): a read-only call to the account's order templates.
k = os.environ.get("PROXYPICS_API_KEY")
ok, why = False, "no key"
if k:
    try:
        t = get("https://api.proxypics.com/api/v3/photo-request-templates", {"x-api-key": k, "Accept": "application/json"})
        ok, why = True, f"ok, {len(t) if isinstance(t, list) else '?'} order templates"
    except Exception as e:
        why = f"ProxyPics error {str(e)[:80]}"
if k:   # with no key, an account the owner ticked on the Setup page stays as it is
    set_flag("field_inspections", ok)
print(f"channels: field_inspections={ok} ({why})")

if cfg != orig:
    open("config.yaml", "w").write(cfg)
    print("channels: config.yaml updated")
