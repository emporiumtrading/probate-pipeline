#!/usr/bin/env python3
"""Live end-to-end simulation against the real services (owner request 2026-11-27).

Runs once when pipeline/live-sim-request.json exists (the runner deletes it afterwards). Nobody real is contacted
and nothing is paid for:
  - Resend: real sends only to Resend's test inbox (delivered@resend.dev) and to our own replies address.
  - Lob: a real letter to the business's own address, cancelled at once inside Lob's cancellation window (no charge;
    this Lob edition doesn't allow scheduled letters).
  - DocuSeal: a test template and a signing request with send_email false, both deleted afterwards.
  - ProxyPics: read-only (packages, price guard); no order.
  - Website: one SIMULATION contact-form request through the live page.
Results: reports/live-sim-<date>.md and simulations/live-<date>/thread.csv (the Messages page → Conversations).
"""
import base64, csv, datetime, json, os, re, subprocess, sys, urllib.request, urllib.error, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOW = datetime.datetime.utcnow()
DAY = NOW.date().isoformat()
LOG, THREAD = [], []


def biz():
    t = open(os.path.join(ROOT, "config.yaml")).read()
    m = re.search(r"(?m)^business:.*\n((?:[ \t]+.*\n|\n)*?)(?=^\S)", t)
    out = {}
    for line in (m.group(1) if m else "").splitlines():
        mm = re.match(r'^  (\w+):[ \t]*(?:"((?:[^"\\]|\\.)*)"|([^#\n]*?))[ \t]*(?:#.*)?$', line)
        if mm:
            out[mm.group(1)] = (mm.group(2) if mm.group(2) is not None else mm.group(3) or "").strip()
    return out


def http(method, url, headers=None, body=None, form=None):
    data = json.dumps(body).encode() if body is not None else (urllib.parse.urlencode(form).encode() if form else None)
    h = {"User-Agent": "probate-pipeline-live-sim", **(headers or {})}
    if body is not None:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, method=method, data=data, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            try:
                return r.status, json.loads(raw or b"null")
            except ValueError:
                return r.status, raw[:200000].decode(errors="replace")
    except urllib.error.HTTPError as e:
        raw = e.read()[:600].decode(errors="replace")
        return e.code, raw


def step(service, what, ok, detail, d="internal", who="", text=""):
    LOG.append((service, what, "PASS" if ok else ("SKIP" if ok is None else "FAIL"), detail))
    THREAD.append({"at": DAY, "dir": d, "channel": service, "who": who, "worker": "live simulation",
                   "stage": "SIMULATION", "text": text or f"{what}: {'PASS' if ok else ('SKIP' if ok is None else 'FAIL')}", "note": detail[:1400]})
    print(f"live-sim: {service} | {what} | {'PASS' if ok else ('SKIP' if ok is None else 'FAIL')} | {detail[:200]}")


def resend(b):
    k = os.environ.get("RESEND_API_KEY")
    if not k:
        return step("Resend", "email key", None, "no RESEND_API_KEY on this job")
    H = {"Authorization": f"Bearer {k}"}
    dom = (open(os.path.join(ROOT, "pipeline", "sending-domain.txt")).read().strip()
           if os.path.exists(os.path.join(ROOT, "pipeline", "sending-domain.txt")) else (b.get("email", "@").split("@")[-1]))
    reply = (open(os.path.join(ROOT, "pipeline", "reply-address.txt")).read().strip()
             if os.path.exists(os.path.join(ROOT, "pipeline", "reply-address.txt")) else f"reply@replies.{dom}")
    sender = f"{b.get('legal_name', 'Emporium Investments')} <sim@{dom}>"
    body = ("SIMULATION. This is how an outreach email looks. Dear Counsel, I'm a real-estate investor and saw the estate "
            "filing. If the family decides to sell, I'd be glad to make an as-is offer. I am an investor buying for my own account, "
            "not a licensed agent, and may assign my contract to another buyer. If you'd prefer I not follow up, just reply 'stop'.")
    s, r = http("POST", "https://api.resend.com/emails", H, {"from": sender, "to": ["delivered@resend.dev"], "reply_to": reply,
                "subject": "SIMULATION: outreach email test", "text": body})
    step("Resend", f"send from {dom} (to Resend's test inbox)", s == 200, f"HTTP {s} {str(r)[:200]}", "out", "delivered@resend.dev (Resend test inbox)", body)
    sim_reply = ("SIMULATION reply as if from estate counsel: Thank you for your letter. The family is open to selling the house. "
                 "Letters were issued last week. What would you need from us? Please reply only to this test address.")
    s, r = http("POST", "https://api.resend.com/emails", H, {"from": f"Simulated Counsel <counsel-sim@{dom}>", "to": [reply],
                "reply_to": "delivered@resend.dev", "subject": "SIMULATION: reply from estate counsel", "text": sim_reply})
    step("Resend", f"simulated reply sent to {reply}", s == 200, f"HTTP {s} {str(r)[:200]}. The Reply Desk picks it up from pipeline/inbox/ once replies.{dom.split('.',1)[-1] if dom.startswith('mail.') else dom} receiving is verified.",
         "in", "Simulated estate counsel", sim_reply)
    s, r = http("GET", "https://api.resend.com/emails/receiving?limit=5", H)
    n = len(r.get("data", [])) if isinstance(r, dict) else 0
    step("Resend", "receiving inbox readable", s == 200, f"HTTP {s}; {n} received emails visible so far")


def lob(b):
    k = os.environ.get("LOB_API_KEY")
    if not k:
        return step("Lob", "letters key", None, "no LOB_API_KEY on this job")
    H = {"Authorization": "Basic " + base64.b64encode((k + ":").encode()).decode()}
    m = re.match(r"\s*(.+?),?\s+(?:Suite|Ste\.?|#)\s*([\w-]+)\s+(.+?)\s+(Illinois|IL)\s+(\d{5})", b.get("mailing_address", ""), re.I)
    addr = {"name": b.get("legal_name", "Emporium Investments"), "address_line1": "208 S LaSalle St", "address_line2": "Suite 814",
            "address_city": "Chicago", "address_state": "IL", "address_zip": "60604", "address_country": "US"}
    if m:
        addr.update(address_line1=m.group(1).replace("South", "S").replace("Street", "St"), address_line2=f"Suite {m.group(2)}", address_zip=m.group(5))
    s, r = http("POST", "https://api.lob.com/v1/us_verifications", H, {"primary_line": addr["address_line1"], "secondary_line": addr["address_line2"],
                "city": addr["address_city"], "state": addr["address_state"], "zip_code": addr["address_zip"]})
    step("Lob", "address verification (business address)", s == 200, f"HTTP {s} deliverability={r.get('deliverability') if isinstance(r, dict) else r}")
    html = ("<html><body style='font-family:Georgia;font-size:12pt;padding:1in'><p><b>SIMULATION TEST LETTER (cancelled before mailing)</b></p>"
            "<p>Dear Counsel,</p><p>I'm a real-estate investor. If the family decides to sell, I'd be glad to make an as-is offer. "
            "I am an investor buying for my own account, not a licensed agent, and may assign my contract to another buyer.</p>"
            f"<p>Sincerely,<br>{b.get('signer', '').split(',')[0]}<br>{b.get('legal_name', '')}<br>{b.get('email', '')}</p></body></html>")
    s, r = http("POST", "https://api.lob.com/v1/letters", H, {"description": "SIMULATION test letter (cancelled at once)", "to": addr, "from": addr,
                "file": html, "color": False, "use_type": "operational", "mail_type": "usps_first_class"})
    lid = r.get("id") if isinstance(r, dict) else None
    step("Lob", "letter created (inside Lob's cancellation window)", bool(lid), f"HTTP {s} id={lid} prints after {r.get('send_date') if isinstance(r, dict) else ''} "
         f"expected_delivery={r.get('expected_delivery_date') if isinstance(r, dict) else ''} {'' if lid else str(r)[:300]}", "out", "Emporium Investments (own address)", html)
    if lid:
        s, r = http("DELETE", f"https://api.lob.com/v1/letters/{lid}", H)
        step("Lob", "letter cancelled before mailing (no charge)", s == 200 and isinstance(r, dict) and r.get("deleted"), f"HTTP {s} {str(r)[:160]}")


def docuseal(b):
    k = os.environ.get("DOCUSEAL_API_KEY")
    if not k:
        return step("DocuSeal", "e-signature key", None, "no DOCUSEAL_API_KEY on this job")
    H = {"X-Auth-Token": k}
    html = ("<p><b>SIMULATION: test agreement (not a real contract)</b></p><p>Seller name: <text-field name='Seller name' role='Seller'></text-field></p>"
            "<p>Signature: <signature-field name='Seller signature' role='Seller'></signature-field></p>")
    s, t = http("POST", "https://api.docuseal.com/templates/html", H, {"html": html, "name": f"SIMULATION test agreement {DAY}"})
    tid = t.get("id") if isinstance(t, dict) else None
    step("DocuSeal", "test agreement template created", bool(tid), f"HTTP {s} id={tid} {'' if tid else str(t)[:300]}")
    if not tid:
        return
    s, sub = http("POST", "https://api.docuseal.com/submissions", H, {"template_id": tid, "send_email": False,
                  "submitters": [{"role": "Seller", "email": "delivered@resend.dev", "name": "SIMULATION Seller"}]})
    sid = (sub[0].get("submission_id") if isinstance(sub, list) and sub else None)
    url = (sub[0].get("embed_src") if isinstance(sub, list) and sub else "")
    step("DocuSeal", "signing request created (no email sent)", bool(sid), f"HTTP {s} submission={sid} signing link {'issued' if url else 'missing'}",
         "out", "SIMULATION Seller (no email sent)", "Purchase agreement signing request (simulated).")
    if sid:
        s2, _ = http("DELETE", f"https://api.docuseal.com/submissions/{sid}", H)
        step("DocuSeal", "signing request archived", s2 in (200, 204), f"HTTP {s2}")
    s3, _ = http("DELETE", f"https://api.docuseal.com/templates/{tid}", H)
    step("DocuSeal", "test template archived", s3 in (200, 204), f"HTTP {s3}")


def proxypics():
    if not os.environ.get("PROXYPICS_API_KEY"):
        return step("ProxyPics", "inspections key", None, "no PROXYPICS_API_KEY on this job")
    r = subprocess.run([sys.executable, "scripts/proxypics.py", "templates"], cwd=ROOT, capture_output=True, text=True)
    has = "31215" in r.stdout
    step("ProxyPics", "packages readable; custom 'Probate condition check' present", has, r.stdout.strip().replace("\n", " / ")[:600])
    prices = {row["template_id"]: row["price_usd"] for row in csv.DictReader(open(os.path.join(ROOT, "pipeline", "proxypics-prices.csv")))}
    step("ProxyPics", "price guard", float(prices.get("31215", 999)) <= 150 and float(prices.get("2824", 0)) > 150,
         f"custom package ${prices.get('31215')} orderable; PDC V6 ${prices.get('2824')} refused. No order placed (no card on file; an order costs money).")


def website():
    s, r = http("POST", "https://www.emporium-investments.com/contact", None, None, form={"topic": "selling", "name": "SIMULATION Test Visitor",
                "email": "delivered@resend.dev", "property": "SIMULATION, 1 Test Way", "message": "SIMULATION: I inherited a house and may want to sell. Reply only to this test address."})
    ok = s == 200 and "Thank you" in str(r)
    step("Website", "contact form request (live page)", ok, f"HTTP {s}", "in", "SIMULATION Test Visitor (website form)",
         "I inherited a house and may want to sell. (topic: Inherited a home, may sell)")


def main():
    b = biz()
    for f in (website, lambda: resend(b), lambda: lob(b), lambda: docuseal(b), proxypics):
        try:
            f()
        except Exception as e:
            step("live-sim", "step crashed", False, repr(e)[:300])
    os.makedirs(os.path.join(ROOT, "reports"), exist_ok=True)
    rep = os.path.join(ROOT, "reports", f"live-sim-{DAY}.md")
    with open(rep, "w") as f:
        f.write(f"# Live simulation {NOW.isoformat(timespec='minutes')}Z\n\nNo real seller, attorney or buyer was contacted and nothing was paid for. "
                "Emails went only to Resend's test inbox and our own replies address; the Lob letter was cancelled inside Lob's cancellation window; "
                "DocuSeal items were archived; no ProxyPics order.\n\n| Service | Check | Result | Detail |\n|---|---|---|---|\n")
        for svc, what, res, det in LOG:
            f.write(f"| {svc} | {what} | {res} | {det.replace('|', '/')[:300]} |\n")
        f.write("\nThe simulated email reply and website request go through the Reply Desk in this and the next runs "
                "(pipeline/inbox/). Any answer the workers send goes to delivered@resend.dev only.\n")
    d = os.path.join(ROOT, "simulations", f"live-{DAY}")
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "thread.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["at", "dir", "channel", "who", "worker", "stage", "text", "note"]); w.writeheader(); w.writerows(THREAD)
    print(f"live-sim: {sum(1 for x in LOG if x[2] == 'PASS')} passed, {sum(1 for x in LOG if x[2] == 'FAIL')} failed, report {os.path.relpath(rep, ROOT)}")


if __name__ == "__main__":
    main()
