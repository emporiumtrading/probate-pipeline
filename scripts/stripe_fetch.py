#!/usr/bin/env python3
"""Read-only Stripe import for the unattended runs (owner decision 2026-11-27).

Uses STRIPE_API_KEY, a Stripe *restricted* key (rk_live_...) with read-only permissions, saved on the Setup page
as a Render setting. It reads balance transactions since bookkeeping.stripe.last_imported, saves the pages in
workcache/stripe/ and hands them to scripts/stripe_ledger.py, which imports only transactions tagged for the
pipeline ("probate" or a lead id) and never duplicates. Then it moves last_imported forward.
STRIPE_TEST_API_KEY (rk_test_...) is only checked, never imported: test-mode money isn't real.
Never writes to Stripe, never reads card, bank or customer details.

  python3 scripts/stripe_fetch.py
"""
import datetime, json, os, re, subprocess, sys, urllib.request, urllib.error, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = os.path.join(ROOT, "config.yaml")


def get(key, path, params=None):
    url = "https://api.stripe.com" + path + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}", "User-Agent": "probate-pipeline-runner"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def main():
    test = os.environ.get("STRIPE_TEST_API_KEY")
    if test:
        try:
            b = get(test, "/v1/balance")
            print(f"stripe: test key ok (livemode={b.get('livemode')})")
        except urllib.error.HTTPError as e:
            print(f"stripe: test key refused ({e.code})")
    key = os.environ.get("STRIPE_API_KEY")
    if not key:
        print("stripe: no STRIPE_API_KEY (Setup → Sending and signing services); import skipped"); return
    if not key.startswith("rk_live_"):
        print("stripe: STRIPE_API_KEY must be a restricted live key (rk_live_...) with read-only permissions; import skipped"); return
    cfg = open(CFG).read()
    m = re.search(r"(?m)^    last_imported:\s*\"?([0-9-]*)", cfg)
    since = m.group(1) if m and m.group(1) else datetime.date.today().replace(day=1).isoformat()
    gte = int(datetime.datetime.fromisoformat(since).replace(tzinfo=datetime.timezone.utc).timestamp())
    out = os.path.join(ROOT, "workcache", "stripe"); os.makedirs(out, exist_ok=True)
    files, after, newest, n = [], None, since, 0
    try:
        while True:
            p = {"limit": 100, "created[gte]": gte, **({"starting_after": after} if after else {})}
            page = get(key, "/v1/balance_transactions", p)
            data = page.get("data", [])
            f = os.path.join(out, f"bt-{since}-{len(files)}.json")
            json.dump({"data": data}, open(f, "w")); files.append(f)
            n += len(data)
            for t in data:
                d = datetime.datetime.fromtimestamp(t.get("created", 0), datetime.timezone.utc).date().isoformat()
                newest = max(newest, d)
            if not page.get("has_more") or not data:
                break
            after = data[-1]["id"]
    except urllib.error.HTTPError as e:
        print(f"stripe: read refused ({e.code}): the restricted key needs read access to Balance transactions"); return
    r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "stripe_ledger.py"), "import", *files], capture_output=True, text=True)
    print((r.stdout or r.stderr).strip()[:400])
    cfg = re.sub(r"(?m)^(    last_imported:\s*)\"?[0-9-]*\"?", lambda mm: mm.group(1) + newest, cfg, count=1)
    open(CFG, "w").write(cfg)
    print(f"stripe: {n} transactions read since {since}; last_imported → {newest}")


if __name__ == "__main__":
    main()
