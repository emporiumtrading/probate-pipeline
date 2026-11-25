#!/usr/bin/env python3
"""Scripted daily-run slices (no paid AI). Used by the Render cron jobs and for catch-up runs.

Usage: python3 scripts/auto_slice.py a|b|c|fast-desk [--today YYYY-MM-DD] [--max-days N]

What each slice does (the mechanical parts of references/daily-run.md):
  a          Tampa (Hillsborough clerk daily filing files) and Columbus (Franklin probate
             open-date index) since each market's last_checked: new estate filings ->
             owner-of-record parcel match -> automated value (low confidence) -> tracker
             rows, research.md, underwriting.md. 90-day wait after death always applied.
  b          Re-tests the broken/research-only markets' sources (Harris, Shelby,
             Philadelphia) and logs the result.
  c          Handoff sweep, owner decisions/settings import (when the runner prepared
             store/import/*.json), day-report summary, runs row.
  fast-desk  Handoff sweep and owner decisions import only.

Every slice then builds the dashboard data into a scratch dir and runs qa_checks.py; the
result is written to the report. Nothing is ever sent, signed or paid: outreach stays
drafts-only, and letters are not drafted here (the Communications worker does that).
Free AI (scripts/ai_assist.py) only writes the plain-English summary line.
Public records only; polite delays (Hillsborough robots.txt asks 10 s between requests).
"""
import csv, datetime, html, json, os, re, statistics, subprocess, sys, tempfile, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import ai_assist  # noqa: E402

UA = {"User-Agent": "Mozilla/5.0 (compatible; probate-pipeline research; public records)"}
TRACKER = "pipeline/deal-tracker.csv"
args = sys.argv[1:]
SLICE = args[0] if args else "a"
_today = os.environ.get("RUN_DATE")
if "--today" in args:
    _today = args[args.index("--today") + 1]
try:
    from zoneinfo import ZoneInfo
    TODAY = _today or datetime.datetime.now(ZoneInfo("America/Chicago")).date().isoformat()
except Exception:
    TODAY = _today or datetime.date.today().isoformat()
MAX_DAYS = int(args[args.index("--max-days") + 1]) if "--max-days" in args else 7
D = datetime.date.fromisoformat
log_lines, report = [], []


def say(s):
    print(s, flush=True)


def fetch(url, delay=1.6, tries=3, binary=False, timeout=60):
    for a in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                b = r.read()
            time.sleep(delay)
            return b if binary else b.decode("latin-1")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(5 * (a + 1))
        except Exception:
            time.sleep(5 * (a + 1))
    raise RuntimeError("fetch failed: " + url)


def arcgis(base, where, fields, extra=None, delay=1.6):
    p = {"where": where, "outFields": fields, "returnGeometry": "false", "f": "json", "resultRecordCount": "400"}
    p.update(extra or {})
    d = json.loads(fetch(base + "?" + urllib.parse.urlencode(p), delay=delay, timeout=90))
    if "error" in d:
        raise RuntimeError(str(d["error"])[:200])
    return [f["attributes"] for f in d.get("features", [])]


def ms_date(v):
    return datetime.datetime.fromtimestamp(v / 1000, datetime.timezone.utc).date().isoformat() if isinstance(v, (int, float)) and v else ""


def mdY(s):
    try:
        return datetime.datetime.strptime(s.strip(), "%m/%d/%Y").date().isoformat()
    except Exception:
        return ""


def cfg_text():
    return open("config.yaml").read()


def market_last_checked(mid):
    m = re.search(r"\n  - id: " + re.escape(mid) + r"\n(?:.*\n)*?    last_checked: (\S+)", cfg_text())
    return m.group(1) if m else None


def set_last_checked(mid, day):
    s = cfg_text()
    m = re.search(r"(\n  - id: " + re.escape(mid) + r"\n(?:.*\n)*?    last_checked: )\S+", s)
    if m:
        open("config.yaml", "w").write(s[:m.start()] + m.group(1) + day + s[m.end():])


def lead_types_on():
    s = cfg_text()
    block = re.search(r"^lead_types:.*\n((?:  .*\n)+)", s, re.M).group(1)
    on = {k for k, v in re.findall(r"^  (\w+):\s*(true|false)", block, re.M) if v == "true"}
    wait = int((re.search(r"min_days_after_death:\s*(\d+)", block) or [0, 90])[1])
    return on, wait


def tracker():
    rows = list(csv.DictReader(open(TRACKER)))
    return rows, list(rows[0].keys())


def save_tracker(rows, cols):
    with open(TRACKER, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)


def first_contact(dod, wait):
    if not dod:
        return ""
    return max(TODAY, (D(dod) + datetime.timedelta(days=wait)).isoformat())


def repairs_by_age(sqft, year):
    per = 45 if year and year < 1950 else 30 if year and year < 1980 else 18 if year and year < 2000 else 10
    base = (sqft or 1400) * per
    return int(round(max(base, 12000), -3))


def money(v):
    return "${:,.0f}".format(v)


def write_lead(rows, cols, r, research, underwriting):
    os.makedirs("leads/" + r["lead_id"], exist_ok=True)
    open(f"leads/{r['lead_id']}/research.md", "w").write(research)
    open(f"leads/{r['lead_id']}/underwriting.md", "w").write(underwriting)
    full = {c: "" for c in cols}
    full.update(r)
    rows.append(full)


# ---------------------------------------------------------------- Tampa (Hillsborough)
HC_FILE = "https://publicrec.hillsclerk.com/Probate/dailyfilings/ProbateFiling_{}.csv"
HC_PAO = "https://maps.hillsboroughcounty.org/arcgis/rest/services/PAO/HC_Properties/MapServer/1/query"
HC_TYPES = {"Formal Administration": "probate", "Summary Administration Greater Than $1000": "small_estate",
            "Summary Administration Less Than $1000": "small_estate", "Notice of Trust": "trust",
            "Ancillary Administration": "ancillary"}


def tampa(rows, cols, on, wait):
    last = market_last_checked("fl-hillsborough") or TODAY
    start = max(D(last), D(TODAY) - datetime.timedelta(days=MAX_DAYS))
    have = {r["case_number"].split()[0] for r in rows}
    added, files, decedents, skipped = [], [], 0, []
    day = start
    while day < D(TODAY):
        name = day.strftime("%Y%m%d")
        raw = fetch(HC_FILE.format(name), delay=10)  # robots.txt Crawl-delay 10
        if raw is None:
            files.append(f"{name}: no file")
            day += datetime.timedelta(days=1)
            continue
        data = list(csv.DictReader(raw.lstrip("﻿").splitlines()))
        dec = {r["CaseNumber"]: r for r in data if r.get("PartyType") == "Decedent" and r.get("CaseTypeDescription") in HC_TYPES}
        files.append(f"{name}: {len(data)} rows, {len(dec)} estates")
        decedents += len(dec)
        for case, r in dec.items():
            ltype = HC_TYPES[r["CaseTypeDescription"]]
            if case in have or ltype not in on:
                continue
            last_n = r["LastName/CompanyName"].strip().upper().replace("'", "''")
            first_n = r["FirstName"].strip().upper().replace("'", "''")
            if not last_n or not first_n:
                continue
            try:
                feats = arcgis(HC_PAO, f"UPPER(OWNER) LIKE '%{last_n}%' AND UPPER(OWNER) LIKE '%{first_n}%'",
                               "OWNER,FOLIO,SITE_ADDR,SITE_CITY,SITE_ZIP,ADDR_1,CITY,STATE,JUST,HEAT_AR,DOR_CODE,S_DATE,S_AMT,ACT,NBHC", delay=2)
            except Exception as e:
                skipped.append(f"{case}: parcel lookup failed ({str(e)[:60]})")
                continue
            sfr = [f for f in feats if str(f.get("DOR_CODE")) in ("0100", "0102", "0106", "0400") and f.get("HEAT_AR")]
            if len(sfr) != 1:
                skipped.append(f"{case}: {len(sfr)} home parcels owned under the name" + (" (needs a person to pick)" if len(sfr) > 1 else ""))
                continue
            p = sfr[0]
            try:
                comps = arcgis(HC_PAO, f"NBHC={p['NBHC']} AND DOR_CODE='0100' AND S_AMT>50000 AND S_DATE>=DATE '{(D(TODAY)-datetime.timedelta(days=365)).isoformat()}' AND HEAT_AR>0",
                               "SITE_ADDR,HEAT_AR,S_AMT,S_DATE", {"orderByFields": "S_DATE DESC"}, delay=2)
            except Exception:
                comps = []
            sq = p["HEAT_AR"]
            sim = [c for c in comps if 0.75 * sq <= c["HEAT_AR"] <= 1.3 * sq]
            pp = sorted(c["S_AMT"] / c["HEAT_AR"] for c in (sim or comps))
            if len(pp) >= 4:
                arv, basis = int(round(pp[int(len(pp) * 0.75)] * sq, -3)), f"75th percentile $/sq ft of {len(sim or comps)} neighbourhood sales in the last year"
            else:
                arv, basis = int(round((p.get("JUST") or 0) * 1.1, -3)), "county just value × 1.1 (too few sales nearby)"
            rep = repairs_by_age(sq, int(p.get("ACT") or 0))
            bmax = int(round(arv * 0.7)) - rep
            mao = bmax - 10000
            if mao < 20000:
                skipped.append(f"{case}: numbers don't work (max offer {money(mao)})")
                continue
            dod = mdY(r.get("DateofDeath", ""))
            lid = "fl-hillsborough-" + case
            row = dict(lead_id=lid, address=f"{p['SITE_ADDR'].title()}, {p['SITE_CITY'].title()} FL", county="Hillsborough", state="FL",
                       lead_type=ltype, case_number=case, filing_date=mdY(r.get("FilingDate", "")), date_of_death=dod,
                       personal_rep="Unknown: Heir & Title Tracer to confirm", letters_issued="Unknown (new filing)",
                       court_confirmation="FL: check whether a court order is needed for this case type", occupancy="Unknown",
                       arv_mid=arv, repairs_mid=rep, mao=mao, stage="Researched", touch_count="0",
                       next_action="Confirm personal representative and letters; check mortgage/liens; Deal Analyst to check comps by hand",
                       next_action_date=first_contact(dod, wait) or TODAY,
                       notes=f"NEGOTIATE (automated, low confidence): owner of record '{p['OWNER']}' matches the decedent. ARV from {basis}; repairs assumed by age. Not inspected." + ("" if dod else " Date of death not in the filing: Compliance holds outreach until it's known."),
                       city=p["SITE_CITY"].title(), buyer_max=bmax, target_price=mao, potential_earnings=10000)
            ex = "\n".join(f"| {c['SITE_ADDR']} | {int(c['HEAT_AR'])} | {money(c['S_AMT'])} | {ms_date(c['S_DATE'])} |" for c in (sim or comps)[:4])
            research = (f"# Research: {row['address']}\nLead type: `{ltype}` · Case {case} ({r['CaseTypeDescription']}) filed {row['filing_date']} · Hillsborough Clerk daily filing file {name} (verified, {TODAY}, automated run)\n\n"
                        f"- Decedent: {r['FirstName'].title()} {r['LastName/CompanyName'].title()} · date of death {dod or 'not given'} · earliest first contact: **{row['next_action_date']}**\n"
                        f"- Decedent address in filing: {r.get('PartyAddress','')}\n"
                        f"- Parcel folio {p['FOLIO']}, owner of record \"{p['OWNER']}\" (verified, Hillsborough PAO parcel layer, {TODAY}); {int(sq)} sq ft, built {p.get('ACT')}, just value {money(p.get('JUST') or 0)}\n"
                        f"- Tax mailing address: {p.get('ADDR_1','')}, {p.get('CITY','')} {p.get('STATE','')}\n\n## Not yet checked\nOfficial Records (mortgages, liens, deeds), taxes, occupancy, who has authority to sign.\n")
            uw = (f"# Underwriting: {row['address']} (automated, low confidence)\n- ARV **{money(arv)}** ({basis}).\n- Repairs **{money(rep)}** (assumed by age, built {p.get('ACT')}). Not inspected.\n"
                  f"- Buyer max **{money(bmax)}** · Max offer **{money(mao)}**.\n- Deal Analyst to check these comps by hand before any offer.\n\n| Recent sale | Sq ft | Price | Date |\n|---|---|---|---|\n{ex}\n")
            write_lead(rows, cols, row, research, uw)
            have.add(case)
            added.append(row)
        day += datetime.timedelta(days=1)
    set_last_checked("fl-hillsborough", TODAY)
    log_lines.append(f"| {TODAY} | fl-hillsborough | publicrec.hillsclerk.com/Probate/dailyfilings ({start}..{D(TODAY)-datetime.timedelta(days=1)}) | worked | {'; '.join(files) or 'no days to check'}; {len(added)} new leads |")
    return added, skipped, files, decedents


# ---------------------------------------------------------------- Columbus (Franklin)
FC = "https://probatesearch.franklincountyohio.gov/netdata/"
FC_GIS = "https://gis.franklincountyohio.gov/hosting/rest/services/ParcelFeatures/Parcel_Features/FeatureServer/0/query"
cells = lambda r: [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S | re.I)]


def columbus(rows, cols, on, wait):
    if "probate" not in on:
        return [], ["probate lead type is off"], 0
    last = market_last_checked("oh-franklin") or TODAY
    start = max(D(last) - datetime.timedelta(days=1), D(TODAY) - datetime.timedelta(days=MAX_DAYS))
    stop = D(TODAY).strftime("%Y%m%d")
    url, pages, out, seen = FC + "PBODateInx.ndm/input?string=" + start.strftime("%Y%m%d"), 0, [], set()
    while url and pages < 25:
        s = fetch(url)
        pages += 1
        lastd = None
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", s, re.S | re.I):
            c = cells(tr)
            if len(c) >= 6 and re.fullmatch(r"\d{5,7}", c[0]):
                lastd = c[5]
                if c[0] not in seen:
                    seen.add(c[0])
                    out.append(dict(case=c[0], name=c[1], type=c[2], sub=c[3], status=c[4], opened=c[5]))
        nx = re.findall(r'href="(input\?stringf=[^"]+)"', s)
        if not nx or (lastd and datetime.datetime.strptime(lastd, "%m/%d/%Y").strftime("%Y%m%d") > stop):
            break
        url = FC + "PBODateInx.ndm/" + nx[0]
    keep = [r for r in out if r["type"] == "ESTATE" and (r["sub"].startswith("FULL ADMINISTRATION") or r["sub"].startswith("REAL ESTATE ONLY")) and r["status"] != "99"]
    have = {x for r in rows for x in re.findall(r"\d{5,7}", r["case_number"])}
    added, skipped = [], []
    for k in keep:
        if k["case"] in have:
            continue
        s = re.sub(r"(?s)<style.*?</style>", "", fetch(FC + "PBCaseTypeE.ndm/ESTATE_DETAIL?caseno=" + k["case"] + ";;") or "")
        t = re.sub(r"(\|\s*)+", "| ", re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " | ", s))))
        f = lambda lab: (re.search(re.escape(lab) + r" \| ([^|]*)\|", t) or [None, ""])[1].strip()
        street, city, zp, dod = f("Decedent Street"), f("City"), f("Zip"), mdY(f("Date of Death"))
        m = re.match(r"(\d+)\s+(?:[NSEW]\.?\s+)?([A-Z0-9]+)", street.upper())
        if not m:
            skipped.append(f"{k['case']}: no street address in the case")
            continue
        try:
            feats = arcgis(FC_GIS, f"SITEADDRESS LIKE '{m.group(1)} %{m.group(2)}%'",
                           "PARCELID,OWNERNME1,OWNERNME2,SITEADDRESS,ZIPCD,TOTVALUEBASE,SALEDATE,SALEPRICE,RESYRBLT,CLASSDSCRP")
        except Exception as e:
            skipped.append(f"{k['case']}: parcel lookup failed ({str(e)[:60]})")
            continue
        last_n, first_n = (k["name"].split(",") + [""])[:2]
        first_n = first_n.strip().split(" ")[0].upper()
        own = [p for p in feats if last_n.strip().upper() in (str(p.get("OWNERNME1", "")) + " " + str(p.get("OWNERNME2", ""))).upper()]
        own = [p for p in own if not first_n or first_n in (str(p.get("OWNERNME1", "")) + " " + str(p.get("OWNERNME2", ""))).upper()]
        if len(own) != 1:
            skipped.append(f"{k['case']}: {len(own)} parcels owned by the decedent at the case address")
            continue
        p = own[0]
        val, yr = int(p.get("TOTVALUEBASE") or 0), int(p.get("RESYRBLT") or 0)
        if val < 30000:
            skipped.append(f"{k['case']}: auditor value too low to work ({money(val)})")
            continue
        arv = int(round(val * 1.15, -3))
        rep = 45000 if yr and yr < 1950 else 35000 if yr and yr < 1980 else 20000
        bmax = int(round(arv * 0.7)) - rep
        mao, floor = bmax - 10000, int(val * 0.8)
        if mao < 20000:
            skipped.append(f"{k['case']}: numbers don't work (max offer {money(mao)})")
            continue
        lid = "oh-franklin-" + k["case"]
        floor_note = (f" Ohio consent-sale floor (R.C. 2127.011): 80% of appraised ≈ {money(floor)}, above our max offer, so this needs court approval, a lower appraisal or better comps." if floor > mao else "")
        row = dict(lead_id=lid, address=f"{p['SITEADDRESS'].title()}, {city.title()} OH {p.get('ZIPCD','')}", county="Franklin", state="OH",
                   lead_type="probate", case_number=k["case"], filing_date=mdY(k["opened"]), date_of_death=dod,
                   personal_rep="Unknown: see court fiduciary page", letters_issued="Unknown (new filing)",
                   court_confirmation=f"Consent sale needs ≥80% of appraised (~{money(floor)}) or court approval", occupancy="Unknown",
                   arv_mid=arv, repairs_mid=rep, mao=mao, stage="Researched", touch_count="0",
                   next_action="Deal Analyst: real comps; read fiduciary page (PBFidy) for personal representative and attorney",
                   next_action_date=first_contact(dod, wait) or TODAY,
                   notes=f"NEGOTIATE (automated, low confidence): owner of record '{p['OWNERNME1']}' matches the decedent at the case address. ARV = auditor value {money(val)} × 1.15; repairs by age (built {yr}).{floor_note}" + ("" if dod else " Date of death unknown: Compliance holds outreach."),
                   city=city.title(), buyer_max=bmax, target_price=mao, potential_earnings=10000)
        research = (f"# Research: {row['address']}\nLead type: `probate` · Case {k['case']} (Franklin County Probate Court, {k['sub'].title()}) opened {row['filing_date']} (verified, PBODateInx + ESTATE_DETAIL, {TODAY}, automated run)\n\n"
                    f"- Decedent: {k['name'].title()} · date of death {dod or 'not given'} · earliest first contact: **{row['next_action_date']}**\n"
                    f"- Decedent address in case: {street.title()}, {city.title()} OH {zp}\n"
                    f"- Parcel {p['PARCELID']}, owner of record \"{p['OWNERNME1']}\" (verified, Franklin County Parcel_Features, {TODAY}); {p.get('CLASSDSCRP','')}, built {yr}, auditor value {money(val)}\n\n"
                    f"## Not yet checked\nFiduciary and attorney: {FC}PBFidy.ndm/input?caseno={k['case']};; · Docket: {FC}PBDocket.ndm/input?caseno={k['case']};; · Taxes and liens.\n")
        uw = (f"# Underwriting: {row['address']} (automated, low confidence)\n- Auditor value {money(val)} (verified). ARV assumed = × 1.15 = **{money(arv)}** (the county layer has no square footage).\n"
              f"- Repairs **{money(rep)}** (assumed by age, built {yr}). Not inspected.\n- Buyer max **{money(bmax)}** · Max offer **{money(mao)}** · Ohio 80% floor ≈ {money(floor)}.\n")
        write_lead(rows, cols, row, research, uw)
        have.add(k["case"])
        added.append(row)
    set_last_checked("oh-franklin", TODAY)
    log_lines.append(f"| {TODAY} | oh-franklin | probatesearch PBODateInx.ndm (from {start.strftime('%Y%m%d')}, {pages} pages) + Parcel_Features | worked | {len(out)} cases, {len(keep)} estates kept, {len(added)} new leads |")
    return added, skipped, len(keep)


# ---------------------------------------------------------------- slice B: source re-tests
B_SOURCES = [("tx-harris", "https://www.cclerk.hctx.net/applications/websearch/CourtSearch.aspx?CaseType=Probate"),
             ("tn-shelby", "https://www.probatecourt.shelbycountytn.gov"),
             ("pa-philadelphia", "https://www.phila.gov/departments/register-of-wills/")]


def slice_b():
    out = []
    for mid, url in B_SOURCES:
        try:
            body = fetch(url, delay=2, tries=2, timeout=30) or ""
            st = "unavailable" if re.search(r"currently unavailable|maintenance", body, re.I) else "responds"
        except Exception as e:
            st = "no response"
        out.append((mid, url, st))
        log_lines.append(f"| {TODAY} | {mid} | {url} | {st} | automated re-test |")
    return out


# ---------------------------------------------------------------- shared steps
def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr).strip()


def owner_imports():
    notes = []
    imp = "store/import"
    if os.path.exists(f"{imp}/setup-areas.json"):
        notes.append("settings: " + run([sys.executable, "scripts/owner_settings.py", "import", f"{imp}/setup-areas.json"])[1][-120:])
    for q in ("outreach", "sign", "wire", "exceptions"):
        if os.path.exists(f"{imp}/{q}.json"):
            notes.append(f"{q}: " + run([sys.executable, "scripts/owner_decisions.py", "import", q, f"{imp}/{q}.json"])[1][-120:])
    return notes


def build_and_qa():
    d = tempfile.mkdtemp(prefix="dd_")
    c1, o1 = run([sys.executable, "scripts/build_dashboard_data.py", d])
    c2, o2 = run([sys.executable, "scripts/qa_checks.py", d])
    last = (o2.splitlines() or [""])[-1]
    return c1 == 0 and c2 == 0, last


def write_report(section_title, body_lines, summary_facts):
    path = f"reports/{TODAY}.md"
    text = open(path).read() if os.path.exists(path) else f"# Daily report — {TODAY}\n"
    ai, prov = ai_assist.summarize(summary_facts) if summary_facts else (None, None)
    sec = [f"## {section_title} (automated run)"]
    if ai:
        sec.append(f"_{ai}_ (summary written by free AI ({prov}) from the facts below)")
    sec += body_lines
    block = "\n".join(sec) + "\n"
    if f"## {section_title}" in text:
        text = re.sub(r"## " + re.escape(section_title) + r".*?(?=\n## |\Z)", block.rstrip("\n"), text, flags=re.S)
    else:
        text = text.rstrip("\n") + "\n\n" + block
    open(path, "w").write(text)


def runs_row(new, updated=0):
    rows = list(csv.reader(open("pipeline/runs.csv")))
    hdr, body = rows[0], [r for r in rows[1:] if r and r[0] != TODAY]
    prev = next((r for r in rows[1:] if r and r[0] == TODAY), None)
    n = int(prev[1]) + new if prev else new
    approvals = sum(1 for r in csv.DictReader(open(TRACKER)) if r.get("stage") == "Outreach drafted")
    body.append([TODAY, str(n), str(updated), str(approvals), "none (automated run; legal refresh not part of scripted runs)", "yes"])
    with open("pipeline/runs.csv", "w", newline="") as f:
        csv.writer(f).writerows([hdr] + body)


def handoff_sweep():
    c, o = run([sys.executable, "scripts/handoffs.py", "sweep"])
    return o.splitlines()[-1] if o else "swept"


def main():
    on, wait = lead_types_on()
    say(f"slice {SLICE} · {TODAY} · lead types on: {sorted(on)} · wait {wait} days")
    body, facts = [], []
    if SLICE == "a":
        rows, cols = tracker()
        try:
            t_added, t_skip, t_files, t_dec = tampa(rows, cols, on, wait)
        except Exception as e:
            t_added, t_skip, t_files, t_dec = [], [f"Tampa run failed: {str(e)[:120]}"], [], 0
        save_tracker(rows, cols)
        try:
            c_added, c_skip, c_keep = columbus(rows, cols, on, wait)
        except Exception as e:
            c_added, c_skip, c_keep = [], [f"Columbus run failed: {str(e)[:120]}"], 0
        save_tracker(rows, cols)
        added = t_added + c_added
        body.append(f"- **Tampa:** {'; '.join(t_files) or 'no new daily files'}. {t_dec} estate filings, **{len(t_added)} new leads**.")
        body.append(f"- **Columbus:** {c_keep} estate cases opened since the last check, **{len(c_added)} new leads**.")
        for r in added:
            body.append(f"  - {r['lead_id']}: {r['address']} · {r['lead_type']} · ARV ~{money(int(r['arv_mid']))} (automated, low confidence) · max offer {money(int(r['mao']))} · first contact from {r['next_action_date']} · potential $10,000")
        if t_skip + c_skip:
            body.append("- **Not added:** " + "; ".join((t_skip + c_skip)[:12]) + (" …" if len(t_skip + c_skip) > 12 else ""))
        body.append("- Values are automated and marked low confidence; the Deal Analyst checks comps by hand before any offer. Nothing was sent.")
        facts.append(f"Morning run {TODAY}: {len(t_added)} new Tampa leads, {len(c_added)} new Columbus leads, total potential earnings ${10000*len(added):,}. Nothing was sent.")
        new = len(added)
    elif SLICE == "b":
        res = slice_b()
        body += [f"- **{mid}:** {st} ({url})" for mid, url, st in res]
        body.append("- These markets have no working probate search, so no leads come from them until a source works.")
        facts.append("Midday run: source checks for Houston, Memphis and Philadelphia: " + ", ".join(f"{m} {s}" for m, _, s in res) + ".")
        new = 0
    else:
        imp = owner_imports()
        sweep = handoff_sweep()
        body.append(f"- **Handoff board:** {sweep}")
        if imp:
            body.append("- **Your saved decisions and settings imported:** " + " · ".join(imp))
        if SLICE == "c":
            tr = list(csv.DictReader(open(TRACKER)))
            opps = [r for r in tr if r.get("stage") not in ("Dead", "Paid")]
            waiting = sum(1 for r in tr if r.get("stage") == "Outreach drafted")
            body.append(f"- **Pipeline:** {len(opps)} active leads; {waiting} letters waiting for your approval. Outreach is drafts only, so nothing was sent.")
            body.append("- **Not automated in scripted runs:** drafting new letters, negotiation replies, attorney matters (General Legal), Stripe import and the claude.ai dashboard. Those need a Claude session.")
            facts.append(f"Evening run {TODAY}: {len(opps)} active leads, {waiting} letters waiting for the owner's approval, nothing sent.")
        new = 0
    ok, qa = build_and_qa()
    body.append(f"- **Dashboard data:** {'built and passed checks' if ok else 'CHECKS FAILED'} ({qa}). The web dashboard rebuilds from this push.")
    title = {"a": "Slice A (morning): Tampa, Columbus", "b": "Slice B (midday): Houston, Memphis, Philadelphia",
             "c": "Slice C (evening): upkeep and day summary", "fast-desk": "Fast desk"}.get(SLICE, SLICE)
    write_report(title, body, "\n".join(facts))
    if log_lines:
        open("pipeline/sources-log.md", "a").write("\n".join(log_lines) + "\n")
    if SLICE in ("a", "b", "c"):
        runs_row(new)
    say("\n".join(body))
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
