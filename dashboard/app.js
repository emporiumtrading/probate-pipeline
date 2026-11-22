/* Probate Operations dashboard: shared helpers, calculations, controls, tiles and tables. Charts live in charts.js. */
(function () {
  const PP = (window.PP = window.PP || {});
  PP.money = (v) => (v === null || v === undefined || v === '' || isNaN(+v)) ? '—' : d3.format('$,.0f')(+v);
  PP.moneyK = (v) => (v === null || v === undefined || v === '' || isNaN(+v)) ? '—' : (Math.abs(+v) >= 10000 ? '$' + d3.format('.3~s')(+v).replace('G', 'B') : d3.format('$,.0f')(+v));
  PP.int = (v) => (v === null || v === undefined || v === '' || isNaN(+v)) ? '—' : d3.format(',')(+v);
  PP.txt = (v) => (v === null || v === undefined || v === '') ? '—' : String(v);
  PP.owner = { approve: 'Approve outreach', sign: 'Sign', wire: 'Wire earnest money', '': '—' };
  // Fixed state order so a state keeps its color whatever the filters show; states past the palette fold into "Other".
  PP.STATE_ORDER = ['OH', 'TX', 'FL', 'TN', 'PA', 'IN', 'AZ', 'GA'];
  PP.stateColor = (s) => { const i = PP.STATE_ORDER.indexOf(s); return i >= 0 && i < dash.colors.length ? dash.colors[i] : 'var(--cds-chart-muted)'; };
  PP.verdictCls = (v) => v === 'GO' ? 'pp-ok' : v === 'NEGOTIATE' ? 'pp-warn' : v === 'WALK AWAY' ? 'pp-bad' : '';
  PP.marketCls = (v) => /^Live$/.test(v || '') ? 'pp-ok' : /^(Live:|Partial|Research)/.test(v || '') ? 'pp-warn' : v === 'Blocked' ? 'pp-bad' : '';
  PP.workerCls = (v) => /^Active/.test(v || '') ? 'pp-ok' : /you/i.test(v || '') ? 'pp-warn' : '';
  PP.covCls = (v) => v === 'works' ? 'pp-ok' : (v === 'broken' || v === 'blocked') ? 'pp-bad' : v === 'manual' ? 'pp-warn' : '';
  PP.statusVar = (cls) => cls === 'pp-ok' ? 'var(--color-ok)' : cls === 'pp-warn' ? 'var(--color-warn)' : cls === 'pp-bad' ? 'var(--color-bad)' : 'var(--cds-chart-muted)';
  PP.first = (name) => { const d = dash.data(name); return d.status === 'ok' && d.data && d.data[0] ? d.data[0] : null; };
  PP.openDeal = (r) => { dash.setParams({ lead: r.lead_id }); PP.show('deal'); };
  PP.scope = (r) => { const p = dash.params(); return (!p.state || r.state === p.state) && (!p.county || r.county === p.county); };
  document.querySelectorAll('.pp').forEach((el) => el.style.setProperty('--pp-accent', dash.colors[0]));
})();

dash.calc('leadsF', { title: 'Leads in the chosen state and county', description: 'All researched leads matching the State and County filters.', inputs: ['leads'],
  fn: (leads) => { const p = dash.params(); return leads.filter((r) => (!p.state || r.state === p.state) && (!p.county || r.county === p.county)); } });
dash.calc('opps', { title: 'Opportunities', description: 'GO and NEGOTIATE deals in the filters, highest potential earnings first.', inputs: ['leadsF'],
  fn: (leadsF) => leadsF.filter((r) => r.is_opportunity === 'yes').sort((a, b) => (+b.potential_earnings || 0) - (+a.potential_earnings || 0)) });
dash.calc('stageCounts', { title: 'Deals by stage', description: 'Every pipeline stage with its team, your action, deal count and potential earnings, within the filters.', inputs: ['stages', 'leadsF'],
  fn: (stages, leadsF) => stages.map((s) => { const d = leadsF.filter((r) => r.stage === s.stage); return { stage_order: +s.stage_order, stage: s.stage, team: s.team, owner_action: s.owner_action, count: d.length, earnings: d3.sum(d, (r) => +r.potential_earnings || 0) }; }) });
dash.calc('stageDeals', { title: 'Deals in the chosen stage', description: 'Deals in the stage picked on the Pipeline page, within the filters.', inputs: ['leadsF'],
  fn: (leadsF) => { const s = dash.params().stage || 'Outreach drafted'; return leadsF.filter((r) => r.stage === s); } });
dash.calc('deal', { title: 'Chosen deal', description: 'The deal picked on the Deal detail page, or the top opportunity.', inputs: ['leadsF', 'opps'],
  fn: (leadsF, opps) => { const id = dash.params().lead; const r = leadsF.find((x) => x.lead_id === id) || opps[0] || leadsF[0]; return r ? [r] : []; } });
dash.calc('earnByState', { title: 'Potential earnings by state', description: 'Sum of potential earnings and count of GO/NEGOTIATE deals per state, within the filters.', inputs: ['opps'],
  fn: (opps) => d3.rollups(opps, (v) => ({ earnings: d3.sum(v, (r) => +r.potential_earnings || 0), deals: v.length }), (r) => r.state).map(([state, o]) => ({ state, ...o })).sort((a, b) => b.earnings - a.earnings) });
dash.calc('oppsByCity', { title: 'Opportunities by city', description: 'Count and potential earnings of GO/NEGOTIATE deals per city, within the filters.', inputs: ['opps'],
  fn: (opps) => d3.rollups(opps, (v) => ({ deals: v.length, earnings: d3.sum(v, (r) => +r.potential_earnings || 0), state: v[0].state }), (r) => r.city + ', ' + r.state).map(([city, o]) => ({ city, ...o })).sort((a, b) => b.deals - a.deals) });
dash.calc('queuesF', { title: 'Your queues', description: 'Approve, sign and wire items within the filters.', inputs: ['queues'],
  fn: (queues) => { const p = dash.params(); return queues.filter((r) => (!p.state || r.state === p.state) && (!p.county || r.county === p.county)); } });
dash.calc('queueCounts', { title: 'Queue counts', description: 'Items per queue within the filters.', inputs: ['queuesF'],
  fn: (q) => [{ approve: q.filter((r) => r.queue === 'Approve outreach').length, sign: q.filter((r) => r.queue === 'Sign').length, wire: q.filter((r) => r.queue === 'Wire').length }] });
dash.calc('marketsF', { title: 'Markets in the filters', description: 'States and counties with their status, within the filters.', inputs: ['markets'],
  fn: (markets) => { const p = dash.params(); return markets.filter((r) => (!p.state || r.state === p.state) && (!p.county || r.county === p.county)); } });
dash.calc('marketCounts', { title: 'Market status counts', description: 'Counties by status, and states with a legal file, within the filters.', inputs: ['marketsF'],
  fn: (m) => [{ live: m.filter((r) => r.status === 'Live').length, research: m.filter((r) => /^(Live:|Partial|Research)/.test(r.status)).length, blocked: m.filter((r) => r.status === 'Blocked').length,
    queued: m.filter((r) => r.status === 'Queued' || r.status === 'Not started').length, legal: new Set(m.filter((r) => r.legal_file === 'yes').map((r) => r.state)).size }] });
dash.calc('stateStatus', { title: 'Best status per state', description: 'For each state, the best status among its markets (Live > limited or research only > blocked > queued), plus counts.', inputs: ['markets', 'leads'],
  fn: (markets, leads) => { const rank = (s) => s === 'Live' ? 4 : /^(Live:|Partial|Research)/.test(s) ? 3 : s === 'Blocked' ? 2 : 1;
    return d3.rollups(markets, (v) => { const best = v.reduce((a, b) => rank(b.status) > rank(a.status) ? b : a); return { status: best.status, counties: v.filter((x) => x.county).length, legal: v.some((x) => x.legal_file === 'yes') ? 'yes' : 'no' }; }, (r) => r.state)
      .map(([state, o]) => ({ state, ...o, opportunities: leads.filter((l) => l.state === state && l.is_opportunity === 'yes').length })); } });
dash.calc('coverageLive', { title: 'Coverage in live counties', description: 'Record-type coverage rows for live markets, within the filters.', inputs: ['coverage'],
  fn: (coverage) => { const p = dash.params(); const slug = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return coverage.filter((c) => c.live === 'yes' && (!p.state || c.market.startsWith(slug(p.state) + '-')) && (!p.county || c.market.endsWith('-' + slug(p.county)))); } });
dash.calc('kpis', { title: 'Headline totals', description: 'Opportunities, potential earnings, best deal, items waiting on you, deals under contract and live counties, within the filters.', inputs: ['opps', 'leadsF', 'queuesF', 'marketsF'],
  fn: (opps, leadsF, queuesF, marketsF) => [{ opps: opps.length, earnings: d3.sum(opps, (r) => +r.potential_earnings || 0), best: opps.length ? +opps[0].potential_earnings || 0 : 0,
    queue: queuesF.length, under_contract: leadsF.filter((r) => +r.stage_order >= 7 && +r.stage_order <= 13).length, markets_live: marketsF.filter((r) => r.status === 'Live').length }] });
dash.calc('teamLoad', { title: 'Worker team load', description: 'Deals sitting in the stages each team runs, within the filters.', inputs: ['stageCounts'],
  fn: (sc) => d3.rollups(sc.filter((s) => s.team && s.team !== 'Done'), (v) => d3.sum(v, (s) => s.count), (s) => s.team).map(([team, deals]) => ({ team, deals })) });
dash.calc('financeNow', { title: 'Money this month', description: "The latest month of the Bookkeeper's roll-up.", inputs: ['finance'],
  fn: (finance) => finance.length ? [finance[finance.length - 1]] : [] });
dash.calc('setupByArea', { title: 'Setup progress by area', description: 'Done and missing setup steps in each area.', inputs: ['readiness'],
  fn: (r) => d3.rollups(r, (v) => ({ done: v.filter((x) => x.status === 'done').length, missing: v.filter((x) => x.status !== 'done').length }), (x) => x.area).map(([area, o]) => ({ area, ...o })) });
dash.calc('setupCounts', { title: 'Setup steps missing', description: 'Setup steps not done yet.', inputs: ['readiness'],
  fn: (r) => [{ missing: r.filter((x) => x.status !== 'done').length, done: r.filter((x) => x.status === 'done').length }] });

(function () {
  const PP = window.PP;
  const K = (src, field, fmt) => (el) => {
    const k = dash.data(src);
    if (k.status === 'loading') { el.classList.add('dash-skeleton'); return; }
    el.classList.remove('dash-skeleton');
    const v = (k.status === 'ok' && k.data && k.data[0]) ? k.data[0][field] : null;
    el.textContent = (v === null || v === undefined || v === '') ? '—' : fmt(v);
  };
  const badge = (src, field) => (el) => { const r = PP.first(src); const v = r ? +r[field] : 0; el.textContent = v > 0 ? String(v) : ''; };
  [['tOpps', 'kpis', 'opps', PP.int], ['tEarn', 'kpis', 'earnings', PP.money], ['tMk', 'kpis', 'markets_live', PP.int], ['tQ', 'kpis', 'queue', PP.int],
   ['kOpps', 'kpis', 'opps', PP.int], ['kEarn', 'kpis', 'earnings', PP.moneyK], ['kBest', 'kpis', 'best', PP.moneyK], ['kQ', 'kpis', 'queue', PP.int],
   ['kContract', 'kpis', 'under_contract', PP.int], ['kClosed', 'pace', 'closed', PP.int], ['kTarget', 'pace', 'target_closings', PP.int], ['pTarget', 'pace', 'target_closings', PP.int],
   ['qApprove', 'queueCounts', 'approve', PP.int], ['qSign', 'queueCounts', 'sign', PP.int], ['qWire', 'queueCounts', 'wire', PP.int],
   ['mLive', 'marketCounts', 'live', PP.int], ['mResearch', 'marketCounts', 'research', PP.int], ['mBlocked', 'marketCounts', 'blocked', PP.int], ['mQueued', 'marketCounts', 'queued', PP.int], ['mLegal', 'marketCounts', 'legal', PP.int],
   ['hCov', 'health', 'coverage_works', PP.int], ['hCovT', 'health', 'coverage_total', PP.int], ['hBuy', 'health', 'buyers_vetted', PP.int], ['hRep', 'health', 'replies_waiting', PP.int], ['hRun', 'health', 'last_run', PP.txt],
   ['fPipe', 'financeNow', 'potential_in_pipeline', PP.moneyK], ['fEarned', 'financeNow', 'fees_earned', PP.moneyK], ['fExp', 'financeNow', 'expenses', PP.moneyK], ['fTax', 'financeNow', 'tax_set_aside', PP.moneyK], ['fEsc', 'financeNow', 'earnest_money_outstanding', PP.moneyK],
   ['dTitle', 'deal', 'address', PP.txt], ['dTeam', 'deal', 'team', PP.txt], ['dOwner', 'deal', 'owner_action', (v) => PP.owner[v] || v], ['dAuth', 'deal', 'authority', PP.txt], ['dCourt', 'deal', 'court_step', PP.txt],
   ['dOcc', 'deal', 'occupancy', PP.txt], ['dNext', 'deal', 'next_action', PP.txt], ['dDue', 'deal', 'next_action_date', PP.txt], ['dTouch', 'deal', 'touch_count', PP.txt], ['dSum', 'deal', 'summary', PP.txt],
  ].forEach(([name, src, f, fmt]) => dash.draw(name, K(src, f, fmt)));
  dash.draw('bOpps', badge('kpis', 'opps')); dash.draw('bQueue', badge('kpis', 'queue')); dash.draw('bSetup', badge('setupCounts', 'missing'));
  dash.draw('dLoc', (el) => { const r = PP.first('deal'); el.textContent = r ? `${r.city}, ${r.county} County, ${r.state} · ${r.lead_type || 'probate'}` : '—'; });
  dash.draw('dChips', (el) => { const r = PP.first('deal'); el.replaceChildren();
    if (!r) return; [[r.verdict, PP.verdictCls(r.verdict)], [r.stage, ''], [r.team, '']].forEach(([t, c]) => { if (!t) return; const s = document.createElement('span'); s.className = 'pp-chip ' + c; s.style.marginRight = '6px'; s.textContent = t; el.appendChild(s); }); });
  dash.draw('dEarnest', (el) => { const r = PP.first('deal'); if (!r) { el.textContent = '—'; return; }
    const amt = +r.earnest_money || 0, st = r.earnest_status || '';
    el.textContent = amt ? `${PP.money(amt)}${st ? ' · ' + st : ''}` : 'Not set yet: agreed in the purchase contract and held by the title company (wholesale deposits are often $500–$2,500; estates sometimes ask about 1%).'; });
  const ppTable = (src, cols, empty) => (tb) => { const d = dash.data(src); tb.replaceChildren();
    const msg = (t) => { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = cols.length; td.textContent = t; td.className = 'pp-muted'; };
    if (d.status !== 'ok' || !Array.isArray(d.data)) return msg(d.status === 'error' ? 'Failed to load' : 'Loading…');
    if (!d.data.length) return msg(empty);
    d.data.forEach((r) => { const tr = tb.insertRow(); cols.forEach((c) => { const td = tr.insertCell(); const v = r[c] || '';
      if (c === 'status') { const s = document.createElement('span'); s.className = 'pp-chip ' + (v === 'done' || v === 'answered' || v === 'closed' ? 'pp-ok' : v === 'missing' ? 'pp-bad' : 'pp-warn'); s.textContent = v || '—'; td.appendChild(s); }
      else { td.textContent = v || '—'; if (c === 'last_message' || c === 'next' || c === 'purpose') td.className = 'pp-w'; } }); }); };
  dash.draw('legalMatterRows', ppTable('legalMatters', ['provider', 'matter_id', 'purpose', 'status', 'last_checked', 'last_message', 'covered_states', 'fees_quoted'], 'No attorney-review matters yet.'));
  dash.draw('legalMarketRows', ppTable('legalMarkets', ['market', 'step', 'status', 'next'], 'No live markets.'));
  dash.draw('stageName', (el) => { el.textContent = dash.params().stage || 'Outreach drafted'; });

  const meter = (get) => (el) => { const v = get(); el.style.width = (v === null ? 0 : Math.max(0, Math.min(100, v))) + '%'; if (el.parentElement) el.parentElement.setAttribute('aria-valuenow', String(v === null ? 0 : Math.round(v))); };
  dash.draw('paceMeter', meter(() => { const r = PP.first('pace'); return r && +r.target_closings ? 100 * (+r.closed || 0) / +r.target_closings : null; }));
  dash.draw('covMeter', meter(() => { const r = PP.first('health'); return r && +r.coverage_total ? 100 * (+r.coverage_works || 0) / +r.coverage_total : null; }));
  dash.draw('setupBar', meter(() => { const r = PP.first('health'); return r && +r.readiness_total ? 100 * (+r.readiness_done || 0) / +r.readiness_total : null; }));
  dash.draw('setupBarLabel', (el) => { const r = PP.first('health'); if (!r) { el.textContent = '—'; return; }
    const done = +r.readiness_done || 0, total = +r.readiness_total || 0, pct = total ? Math.round(100 * done / total) : 0;
    el.textContent = `${done} of ${total} setup steps done (${pct}%). Each one you finish turns its row green.`; });

  dash.draw('freshness', {
    mount: () => setInterval(() => dash.draw('freshness'), 10 * 60 * 1000),
    update: (el) => {
      const h = dash.data('health');
      if (h.status === 'error') { el.textContent = 'Could not load data health, so freshness is unknown.'; el.className = 'pp-fresh pp-bad'; return; }
      if (h.status !== 'ok' || !h.data || !h.data[0]) { el.textContent = 'Loading…'; el.className = 'pp-fresh'; return; }
      const r = h.data[0]; const t = Date.parse(r.built_at || ''); const hrs = isNaN(t) ? null : (Date.now() - t) / 3600000;
      const saved = String(r.last_run_saved || '').toLowerCase().startsWith('no');
      const age = hrs === null ? `built ${r.built}` : hrs < 1 ? 'updated less than an hour ago' : hrs < 48 ? `updated ${Math.round(hrs)} hours ago` : `updated ${Math.round(hrs / 24)} days ago`;
      let msg = `● Data ${age} · last daily run ${r.last_run || 'none yet'}`, cls = 'pp-fresh pp-ok';
      if (hrs === null || hrs > 26) { msg = `⚠ Data is stale: ${age}. The daily runner refreshes this 3 times a day, so it is probably blocked. Open the "Probate pipeline daily runner" session and approve any waiting permission (choose always allow).`; cls = 'pp-fresh pp-bad'; }
      else if (hrs > 14) { msg = `◐ Data ${age}: older than expected (refreshes about every 6 hours).`; cls = 'pp-fresh pp-neg'; }
      if (saved) { msg += ' · last run was NOT saved to GitHub'; cls = 'pp-fresh pp-bad'; }
      el.textContent = msg; el.className = cls;
    },
    unmount: (el, timer) => clearInterval(timer),
  });

  dash.draw('stateSel', (sel) => {
    const m = dash.data('markets');
    const states = m.status === 'ok' ? [...new Set(m.data.map((r) => r.state).filter(Boolean))].sort() : [];
    sel.replaceChildren(new Option('All states', ''), ...states.map((s) => new Option(s, s)));
    sel.value = dash.params().state ?? '';
    sel.onchange = () => dash.setParams({ state: sel.value || null, county: null, lead: null });
  });
  dash.draw('countySel', (sel) => {
    const m = dash.data('markets'); const st = dash.params().state;
    const c = m.status === 'ok' ? [...new Set(m.data.filter((r) => r.county && (!st || r.state === st)).map((r) => st ? r.county : `${r.county}|${r.state}`))].sort() : [];
    sel.replaceChildren(new Option('All counties', ''), ...c.map((x) => { const [cty, s] = x.split('|'); return new Option(s ? `${cty} (${s})` : cty, x); }));
    const p = dash.params(); sel.value = (p.county && st) ? p.county : '';
    sel.onchange = () => { const [cty, s] = (sel.value || '').split('|'); dash.setParams(sel.value ? (s ? { county: cty, state: s, lead: null } : { county: cty, lead: null }) : { county: null, lead: null }); };
  });
  dash.draw('dealSel', (sel) => {
    const l = dash.data('leadsF');
    const rows = l.status === 'ok' ? [...l.data].sort((a, b) => (b.is_opportunity === 'yes') - (a.is_opportunity === 'yes') || (+b.potential_earnings || 0) - (+a.potential_earnings || 0)) : [];
    sel.replaceChildren(...rows.map((r) => new Option(`${r.address}, ${r.city} ${r.state} · ${r.verdict}`, r.lead_id)));
    const d = PP.first('deal'); sel.value = d ? d.lead_id : '';
    sel.onchange = () => dash.setParams({ lead: sel.value || null });
  });

  PP.show = (id) => {
    document.querySelectorAll('.pp-page').forEach((s) => { s.hidden = s.id !== id; });
    document.querySelectorAll('.pp-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.page === id)));
    dash.setLink(id);
  };
  document.querySelectorAll('.pp-tab').forEach((b) => b.addEventListener('click', () => PP.show(b.dataset.page)));
  document.querySelectorAll('#pp-reset').forEach((b) => b.addEventListener('click', () => dash.setParams({ state: null, county: null, lead: null, stage: null })));
  const start = (location.hash || '').slice(1);
  if (start && document.getElementById(start) && document.getElementById(start).classList.contains('pp-page')) PP.show(start);
  window.addEventListener('beforeprint', () => document.querySelectorAll('.pp-page').forEach((s) => { s.dataset.wasHidden = s.hidden ? '1' : ''; s.hidden = false; }));
  window.addEventListener('afterprint', () => document.querySelectorAll('.pp-page').forEach((s) => { s.hidden = s.dataset.wasHidden === '1'; }));

  // Tables: cols = [{f, fmt, cls, chip, bar}]; chip renders a status pill; bar adds an inline data bar scaled to the column max.
  PP.rows = (tbody, src, cols, emptyText, onRow) => {
    const d = dash.data(src);
    tbody.replaceChildren();
    const msg = (t) => { const tr = tbody.insertRow(); const td = tr.insertCell(); td.colSpan = cols.length; td.textContent = t; td.className = 'pp-muted'; };
    if (d.status !== 'ok' || !d.data) { msg(d.status === 'loading' ? 'Loading…' : (d.status === 'error' ? 'Failed to load' : '—')); return; }
    if (!d.data.length) { msg(emptyText); return; }
    const maxes = {}; cols.filter((c) => c.bar).forEach((c) => { maxes[c.f] = d3.max(d.data, (r) => +r[c.f] || 0) || 1; });
    d.data.forEach((r) => {
      const tr = tbody.insertRow();
      cols.forEach((c) => {
        const td = tr.insertCell(); const v = r[c.f]; const text = c.fmt ? c.fmt(v, r) : (v ?? '');
        if (c.cls) td.className = typeof c.cls === 'function' ? c.cls(v, r) : c.cls;
        if (c.chip) { const s = document.createElement('span'); s.className = 'pp-chip ' + (c.chip(v, r) || ''); s.textContent = text; td.appendChild(s); }
        else if (c.bar) { const b = document.createElement('span'); b.className = 'pp-dbar'; b.style.width = Math.max(2, 60 * ((+v || 0) / maxes[c.f])) + 'px'; b.style.background = c.bar(r); td.append(b, document.createTextNode(text)); }
        else td.textContent = text;
      });
      if (onRow) { tr.className = 'pp-click'; tr.tabIndex = 0; tr.onclick = () => onRow(r); tr.onkeydown = (e) => { if (e.key === 'Enter') onRow(r); }; }
    });
  };
  const M = PP.money;
  dash.draw('oppRows', (tb) => PP.rows(tb, 'opps', [{ f: 'address' }, { f: 'city' }, { f: 'state' }, { f: 'lead_type' },
    { f: 'potential_earnings', fmt: M, cls: 'pp-n', bar: (r) => PP.stateColor(r.state) }, { f: 'target_price', fmt: M, cls: 'pp-n' }, { f: 'buyer_max', fmt: M, cls: 'pp-n' }, { f: 'arv_mid', fmt: M, cls: 'pp-n' },
    { f: 'stage' }, { f: 'next_action_date' }], 'No opportunities in this state or county yet.', PP.openDeal));
  dash.draw('stageRows', (tb) => { const sel = dash.params().stage || 'Outreach drafted';
    PP.rows(tb, 'stageCounts', [{ f: 'stage_order', cls: 'pp-n' }, { f: 'stage' }, { f: 'team' }, { f: 'owner_action', fmt: (v) => PP.owner[v] || v, chip: (v) => v ? 'pp-warn' : '' },
      { f: 'count', cls: 'pp-n' }, { f: 'earnings', fmt: (v) => +v ? M(v) : '—', cls: 'pp-n' }], 'No stages.', (r) => dash.setParams({ stage: r.stage }));
    tb.querySelectorAll('tr').forEach((tr) => { if (tr.cells[1] && tr.cells[1].textContent === sel) tr.classList.add('pp-sel'); }); });
  dash.draw('stageDealRows', (tb) => PP.rows(tb, 'stageDeals', [{ f: 'address' }, { f: 'city' }, { f: 'state' }, { f: 'verdict', chip: PP.verdictCls },
    { f: 'potential_earnings', fmt: M, cls: 'pp-n' }, { f: 'next_action', cls: 'pp-w' }, { f: 'next_action_date' }], 'No deals in this stage right now.', PP.openDeal));
  // queueRows is drawn in messages.js (with approve / reject actions).
  dash.draw('marketRows', (tb) => PP.rows(tb, 'marketsF', [{ f: 'state' }, { f: 'county' }, { f: 'city' }, { f: 'status', chip: PP.marketCls },
    { f: 'legal_file' }, { f: 'leads', cls: 'pp-n' }, { f: 'opportunities', cls: 'pp-n' }, { f: 'last_checked' }], 'No markets match.',
    (r) => r.county && dash.setParams({ state: r.state, county: r.county, lead: null })));
  dash.draw('workerRows', (tb) => PP.rows(tb, 'workers', [{ f: 'worker' }, { f: 'status', chip: PP.workerCls }, { f: 'done', cls: 'pp-n' }, { f: 'done_label', cls: 'pp-muted' },
    { f: 'result', cls: 'pp-n' }, { f: 'result_label', cls: 'pp-muted' }, { f: 'rate', cls: 'pp-n' }, { f: 'last_active' }, { f: 'note', cls: 'pp-w' }, { f: 'does', cls: 'pp-w pp-muted' }], 'No worker data yet.'));
  dash.draw('runRows', (tb) => PP.rows(tb, 'runs', [{ f: 'date' }, { f: 'new_leads', cls: 'pp-n' }, { f: 'updated_leads', cls: 'pp-n' }, { f: 'approvals_waiting', cls: 'pp-n' }, { f: 'legal_changes', cls: 'pp-w' }, { f: 'pushed' }], 'No daily runs yet.'));
  dash.draw('srcRows', (tb) => PP.rows(tb, 'sources', [{ f: 'date' }, { f: 'market' }, { f: 'source', cls: 'pp-w' }, { f: 'status', chip: () => 'pp-ok' }, { f: 'note', cls: 'pp-w pp-muted' }], 'No working sources yet.'));
  dash.draw('readyRows', (tb) => PP.rows(tb, 'readiness', [{ f: 'area' }, { f: 'item', cls: 'pp-w' }, { f: 'status', chip: (v) => v === 'done' ? 'pp-ok' : 'pp-warn' }, { f: 'how_to_fix', cls: 'pp-w' }, { f: 'unlocks', cls: 'pp-w pp-muted' }], 'Nothing to set up.'));
})();
