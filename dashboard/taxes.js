/* Tax-delinquent tab (owner decision 2026-11-27): inherited houses with unpaid property taxes. Data: tax_summary.csv
   (one row), tax_leads.csv (one row per lead: what's owed, the tax-sale date, the 12-month wait after death) and
   tax_counties.csv (one row per live county: whether its delinquent-tax list is found). Built by
   scripts/build_dashboard_data.py from pipeline/tax-delinquent.csv (the Tax & Lien Checker) and coverage.csv. */
(function () {
  const PP = window.PP, C = PP.chart, M = PP.money;
  const one = () => { const d = dash.data('tax_summary'); return d.status === 'ok' && d.data[0] ? d.data[0] : {}; };
  const leadsT = () => { const d = dash.data('tax_leads'); return d.status === 'ok' ? d.data : []; };
  const txt = (el, v) => { el.textContent = v; };

  dash.draw('bTax', (el) => { const n = +one().urgent || 0; el.textContent = n ? String(n) : ''; });
  dash.draw('txLeads', (el) => txt(el, one().leads ?? '—'));
  dash.draw('txOwed', (el) => { const s = one(); txt(el, s.owed !== undefined ? M(+s.owed) : '—'); });
  dash.draw('txUrgent', (el) => txt(el, one().urgent ?? '—'));
  dash.draw('txCounties', (el) => { const s = one(); txt(el, s.counties ? `${s.counties_working} of ${s.counties}` : '—'); });
  dash.draw('txRule', (el) => { const s = one();
    txt(el, s.enabled === 'yes'
      ? `On. Only owners who died at least ${s.wait_months} months ago; no letter before then, and none if the date of death is unknown. ${s.waiting || 0} lead(s) are waiting for that date.`
      : 'Off in config.yaml → lead_types. Nothing is sourced or sent for this lead type.'); });

  const chip = (v) => /^Urgent|passed/.test(v) ? 'pp-bad' : /^Waiting|On hold|not checked/.test(v) ? 'pp-warn' : /^Ready|Closed/.test(v) ? 'pp-ok' : '';
  dash.draw('txRows', (tb) => PP.rows(tb, 'tax_leads', [{ f: 'address' }, { f: 'city' }, { f: 'state' }, { f: 'status', chip },
    { f: 'amount_owed', cls: 'pp-n', fmt: (v) => v === '' ? '—' : M(+v) }, { f: 'years_delinquent', cls: 'pp-n' },
    { f: 'tax_sale_date' }, { f: 'days_to_sale', cls: 'pp-n' }, { f: 'redemption_after_sale' }, { f: 'first_letter_ok' },
    { f: 'potential_earnings', cls: 'pp-n', fmt: (v) => v === '' ? '—' : M(+v) }, { f: 'stage' }],
    'No tax-delinquent leads yet. The Source Mapper is finding each county\'s delinquent-tax list; matches to owners who died 12+ months ago show here.', PP.openDeal));

  dash.draw('txSaleChart', (el) => {
    const bands = [['Past', (d) => d < 0], ['0–30 days', (d) => d <= 30], ['31–60', (d) => d <= 60], ['61–120', (d) => d <= 120], ['120+', () => true]];
    const rows = bands.map(([b]) => ({ b, n: 0 }));
    leadsT().filter((r) => r.days_to_sale !== '' && !/Closed|Dropped/.test(r.status)).forEach((r) => { const i = bands.findIndex(([, f]) => f(+r.days_to_sale)); rows[i].n += 1; });
    C.vcols(el, rows.some((r) => r.n) ? rows : [], { title: 'Leads by time left before the tax sale', x: (r) => r.b, series: [{ key: 'n', label: 'Leads', color: dash.colors[0] }],
      fmt: (v) => String(v), fmtAxis: (v) => d3.format('d')(v), empty: 'No tax-sale dates recorded yet.' }); });

  dash.draw('txCountyRows', (tb) => PP.rows(tb, 'tax_counties', [{ f: 'state' }, { f: 'county' },
    { f: 'list_status', chip: (v) => v === 'Working' ? 'pp-ok' : v === 'Not found yet' ? '' : 'pp-warn' }, { f: 'list_source' },
    { f: 'leads', cls: 'pp-n' }, { f: 'owed', cls: 'pp-n', fmt: (v) => M(+v || 0) }, { f: 'next_sale' }], 'No live counties.'));

  // State rules (Markets & legal page): one row per state + DC from legal/state-rules.csv.
  dash.draw('srNote', (el) => { const d = dash.data('state_rules'); const rows = d.status === 'ok' ? d.data : [];
    const done = rows.filter((r) => r.status !== 'Not started').length;
    txt(el, `${done} of ${rows.length || 51} states have their rules at least partly researched. Every worker checks this table before acting on a lead; "unknown" means the strictest rule is assumed, and a state that isn't started is research only. The Legal Advisor fills it from the sources in each state's legal file, live markets first.`); });
  const srChip = (v) => v === 'Attorney approved' || v === 'Verified' ? 'pp-ok' : v === 'Partly researched' ? 'pp-warn' : '';
  dash.draw('srRows', (tb) => PP.rows(tb, 'state_rules', [{ f: 'state' }, { f: 'live' }, { f: 'status', chip: srChip }, { f: 'known' },
    { f: 'wholesale_license' }, { f: 'wholesale_disclosure' }, { f: 'probate_court_approval' }, { f: 'estate_price_floor' }, { f: 'tax_sale_type' },
    { f: 'tax_redemption_after_sale' }, { f: 'contact_rules' }, { f: 'last_verified' }], 'No state rules yet.'));
})();
