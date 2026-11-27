#!/usr/bin/env python3
"""channels.py: test the sending and signing services from their keys and
switch the matching channel on or off in config.yaml, so nobody has to.

  email_sending     RESEND_API_KEY works and the business email's domain is verified in Resend
  mail_sending      LOB_API_KEY is a live key that works
  esignature        DOCUSEAL_API_KEY works  -> esignature.connected_on: <date>

Inbox, mail scanning and voicemail stay with the workers' own tests (the runbook).
Prints one line per channel. Usage: python3 runner/channels.py
"""
import base64, datetime, json, os, re, urllib.request

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
        # A verified sending subdomain of the business domain (e.g. mail.<domain>) is preferred for bulk mail
        # (agents/communications.md → Email deliverability); the main domain itself also counts.
        subs = sorted(d for d in good if biz_domain and d.endswith("." + biz_domain))
        ok = bool(biz_domain) and (bool(subs) or biz_domain in good)
        send_from = subs[0] if subs else (biz_domain if ok else "")
        why = (f"ok, sending domain {send_from}" + ("" if subs else " (no mail. subdomain yet: bulk mail waits until one is verified)")) if ok \
            else (f"verify a sending subdomain such as mail.{biz_domain} in Resend" if biz_domain else "business email not set")
        if send_from:
            open("pipeline/sending-domain.txt", "w").write(send_from + "\n")   # Communications sends bulk mail from this domain
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

if cfg != orig:
    open("config.yaml", "w").write(cfg)
    print("channels: config.yaml updated")
