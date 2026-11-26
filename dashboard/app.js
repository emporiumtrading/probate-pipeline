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
dash.calc('oppsView', { title: 'Opportunities on the Opportunities page', description: 'Opportunities within the State/County filters and the page\'s own Stage, Type, City and minimum-earnings filters.', inputs: ['opps'],
  fn: (opps) => { const p = dash.params(); const min = +p.oppMin || 0;
    return opps.filter((r) => (!p.oppStage || r.stage === p.oppStage) && (!p.oppType || (r.lead_type || 'probate') === p.oppType)
      && (!p.oppCity || `${r.city}, ${r.state}` === p.oppCity) && (+r.potential_earnings || 0) >= min); } });
dash.calc('oppsByCity', { title: 'Opportunities by city', description: 'Count and potential earnings of GO/NEGOTIATE deals per city, within the filters.', inputs: ['oppsView'],
  fn: (oppsView) => d3.rollups(oppsView, (v) => ({ deals: v.length, earnings: d3.sum(v, (r) => +r.potential_earnings || 0), state: v[0].state }), (r) => r.city + ', ' + r.state).map(([city, o]) => ({ city, ...o })).sort((a, b) => b.deals - a.deals) });
dash.calc('queuesF', { title: 'Your queues', description: 'Approve, sign and wire items within the filters.', inputs: ['queues'],
  fn: (queues) => { const p = dash.params(); return queues.filter((r) => (!p.state || r.state === p.state) && (!p.county || r.county === p.county)); } });
dash.calc('queueCounts', { title: 'Queue counts', description: 'Items per queue within the filters.', inputs: ['queuesF'],
  fn: (q) => [{ approve: q.filter((r) => r.queue === 'Approve outreach').length, sign: q.filter((r) => r.queue === 'Sign').length, wire: q.filter((r) => r.queue === 'Wire').length, money: q.filter((r) => r.queue === 'Sign' || r.queue === 'Wire').length }] });
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
dash.calc('contractDeals', { title: 'Deals under contract', description: 'Deals from contract out for signature to paid, within the filters, furthest along first.', inputs: ['leadsF'],
  fn: (leadsF) => leadsF.filter((r) => +r.stage_order >= 7 && +r.stage_order <= 15).sort((a, b) => +b.stage_order - +a.stage_order) });
dash.calc('contractCounts', { title: 'Under-contract totals', description: 'Deals under contract (not yet closed) and the sum of their fees, within the filters.', inputs: ['contractDeals'],
  fn: (c) => { const open = c.filter((r) => +r.stage_order <= 13); return [{ deals: open.length, fees: d3.sum(open, (r) => +r.potential_earnings || 0) }]; } });
dash.calc('financeYear', { title: 'Money this year', description: "This calendar year's fees earned, expenses, net profit and tax set-aside, summed from the Bookkeeper's monthly roll-up.", inputs: ['finance'],
  fn: (finance) => { const y = String(new Date().getFullYear()); const r = finance.filter((m) => String(m.month).startsWith(y)); const s = (k) => d3.sum(r, (m) => +m[k] || 0);
    const net = s('net'), tax = s('tax_set_aside'); return [{ fees_earned: s('fees_earned'), expenses: s('expenses'), net, tax_set_aside: tax, tax_pct: net > 0 ? Math.round(100 * tax / net) + '%' : 'a share' }]; } });
dash.calc('feeGoal', { title: 'Fee goal this month', description: "This month's closing goal × the average potential fee on current opportunities, and fees earned so far against it.", inputs: ['pace', 'opps', 'financeNow'],
  fn: (pace, opps, now) => { const n = pace.length ? +pace[0].target_closings || 0 : 0; const avg = opps.length ? d3.mean(opps, (r) => +r.potential_earnings || 0) : 0; const earned = now.length ? +now[0].fees_earned || 0 : 0;
    return [{ closings: n, avg_fee: Math.round(avg), goal: Math.round(n * avg), earned, pct: n * avg ? Math.min(100, 100 * earned / (n * avg)) : 0 }]; } });
dash.calc('feePipeline', { title: 'Potential fees by deal progress', description: 'Sum of potential fees on open opportunities and contracts, grouped by how far each deal has got, within the filters.', inputs: ['leadsF'],
  fn: (leadsF) => { const G = [['Not contacted yet', 1, 3], ['In talks or offer out', 4, 6], ['Signing', 7, 7], ['Under contract', 8, 10], ['Buyer found or assigned', 11, 12], ['Clear to close', 13, 13], ['Closed, fee not paid yet', 14, 14]];
    return G.map(([group, lo, hi]) => { const d = leadsF.filter((r) => +r.stage_order >= lo && +r.stage_order <= hi && (r.is_opportunity === 'yes' || +r.stage_order >= 7)); return { group, deals: d.length, fees: d3.sum(d, (r) => +r.potential_earnings || 0) }; }); } });
dash.calc('expenseByCat', { title: 'Expenses by category this year', description: "Actual (document-backed) expenses this calendar year from the Bookkeeper's ledger, summed by category.", inputs: ['ledger'],
  fn: (ledger) => { const y = String(new Date().getFullYear()); return d3.rollups(ledger.filter((r) => r.type === 'expense' && r.status === 'actual' && String(r.date).startsWith(y)), (v) => d3.sum(v, (r) => +r.amount || 0), (r) => r.category || 'other')
    .map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount); } });
dash.calc('dealProfit', { title: 'Profit per deal', description: "Per deal in the Bookkeeper's ledger: actual fees, forecast fees, actual expenses, profit (fees − expenses) and earnest money still out.", inputs: ['ledger'],
  fn: (ledger) => d3.rollups(ledger.filter((r) => r.lead_id), (v) => { const s = (t, st) => d3.sum(v.filter((r) => r.type === t && (!st || r.status === st)), (r) => +r.amount || 0);
    const fees = s('income', 'actual'), costs = s('expense', 'actual'); return { fees, forecast: s('income', 'forecast'), costs, profit: fees - costs, earnest_out: s('escrow_out', 'actual') - s('escrow_back', 'actual') }; }, (r) => r.lead_id)
    .map(([lead_id, o]) => ({ lead_id, ...o })).sort((a, b) => b.profit - a.profit) });
dash.calc('unitEcon', { title: 'Fees and costs per deal', description: "From the ledger: average fee per deal paid, all actual expenses divided by deals paid, and fees earned per dollar spent.", inputs: ['ledger'],
  fn: (ledger) => { const act = ledger.filter((r) => r.status === 'actual'); const inc = act.filter((r) => r.type === 'income'); const paid = new Set(inc.map((r) => r.lead_id).filter(Boolean)).size;
    const fees = d3.sum(inc, (r) => +r.amount || 0), spent = d3.sum(act.filter((r) => r.type === 'expense'), (r) => +r.amount || 0);
    return [{ deals_paid: paid, avg_fee: paid ? Math.round(fees / paid) : '', cost_per_close: paid ? Math.round(spent / paid) : '', fees_per_dollar: spent ? '$' + (fees / spent).toFixed(2) : '' }]; } });
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
   ['qApprove', 'queueCounts', 'approve', PP.int], ['moDeals', 'contractCounts', 'deals', PP.int], ['moFees', 'contractCounts', 'fees', PP.moneyK], ['yEarned', 'financeYear', 'fees_earned', PP.moneyK], ['yNet', 'financeYear', 'net', PP.moneyK], ['taxPct', 'financeYear', 'tax_pct', PP.txt], ['gFees', 'feeGoal', 'goal', PP.moneyK], ['gClose', 'feeGoal', 'closings', PP.int], ['gAvg', 'feeGoal', 'avg_fee', PP.moneyK], ['uAvg', 'unitEcon', 'avg_fee', PP.money], ['uCost', 'unitEcon', 'cost_per_close', PP.money], ['uRoi', 'unitEcon', 'fees_per_dollar', PP.txt], ['qSign', 'queueCounts', 'sign', PP.int], ['qWire', 'queueCounts', 'wire', PP.int],
   ['mLive', 'marketCounts', 'live', PP.int], ['mResearch', 'marketCounts', 'research', PP.int], ['mBlocked', 'marketCounts', 'blocked', PP.int], ['mQueued', 'marketCounts', 'queued', PP.int], ['mLegal', 'marketCounts', 'legal', PP.int],
   ['hCov', 'health', 'coverage_works', PP.int], ['hCovT', 'health', 'coverage_total', PP.int], ['hBuy', 'health', 'buyers_vetted', PP.int], ['hRep', 'health', 'replies_waiting', PP.int], ['hRun', 'health', 'last_run', PP.txt],
   ['fPipe', 'financeNow', 'potential_in_pipeline', PP.moneyK], ['fEarned', 'financeNow', 'fees_earned', PP.moneyK], ['fExp', 'financeNow', 'expenses', PP.moneyK], ['fTax', 'financeNow', 'tax_set_aside', PP.moneyK], ['fEsc', 'financeNow', 'earnest_money_outstanding', PP.moneyK],
   ['dTitle', 'deal', 'address', PP.txt], ['dTeam', 'deal', 'team', PP.txt], ['dOwner', 'deal', 'owner_action', (v) => PP.owner[v] || v], ['dAuth', 'deal', 'authority', PP.txt], ['dCourt', 'deal', 'court_step', PP.txt],
   ['dOcc', 'deal', 'occupancy', PP.txt], ['dNext', 'deal', 'next_action', PP.txt], ['dDue', 'deal', 'next_action_date', PP.txt], ['dTouch', 'deal', 'touch_count', PP.txt], ['dSum', 'deal', 'summary', PP.txt],
  ].forEach(([name, src, f, fmt]) => dash.draw(name, K(src, f, fmt)));
  dash.draw('bOpps', badge('kpis', 'opps')); dash.draw('bQueue', badge('queueCounts', 'approve')); dash.draw('bMoney', badge('queueCounts', 'money')); dash.draw('bSetup', badge('setupCounts', 'missing'));
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
  dash.draw('legalMatterRows', ppTable('legal_matters', ['provider', 'matter_id', 'purpose', 'status', 'last_checked', 'last_message', 'covered_states', 'fees_quoted'], 'No attorney-review matters yet.'));
  dash.draw('attorneyRows', ppTable('attorney_candidates', ['market', 'name', 'firm', 'bar_number', 'bar_verified_on', 'focus', 'score', 'status', 'quote'], 'No candidates yet: the Professional Network fills this in on its next run.'));
  dash.draw('legalMarketRows', ppTable('legal_markets', ['market', 'step', 'status', 'next'], 'No live markets.'));
  dash.draw('stageName', (el) => { el.textContent = dash.params().stage || 'Outreach drafted'; });

  const meter = (get) => (el) => { const v = get(); el.style.width = (v === null ? 0 : Math.max(0, Math.min(100, v))) + '%'; if (el.parentElement) el.parentElement.setAttribute('aria-valuenow', String(v === null ? 0 : Math.round(v))); };
  dash.draw('gMeter', meter(() => { const r = PP.first('feeGoal'); return r && +r.goal ? +r.pct : null; }));
  dash.draw('paceMeter', meter(() => { const r = PP.first('pace'); return r && +r.target_closings ? 100 * (+r.closed || 0) / +r.target_closings : null; }));
  dash.draw('covMeter', meter(() => { const r = PP.first('health'); return r && +r.coverage_total ? 100 * (+r.coverage_works || 0) / +r.coverage_total : null; }));
  // setupBar / setupBarLabel live in setup.js (they count what you've saved, not just the last run's check).

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
  // Deal detail: find a deal by typing, step through deals in order, and the key numbers at a glance.
  const dealOrder = () => { const l = dash.data('leadsF'); return l.status === 'ok' ? [...l.data].sort((a, b) => (b.is_opportunity === 'yes') - (a.is_opportunity === 'yes') || (+b.potential_earnings || 0) - (+a.potential_earnings || 0)) : []; };
  const dealLabel = (r) => `${r.address}, ${r.city} ${r.state} · ${r.verdict}`;
  dash.draw('dealList', (dl) => { dl.replaceChildren(...dealOrder().map((r) => { const o = document.createElement('option'); o.value = dealLabel(r); return o; })); });
  dash.draw('dealPos', (el) => { const rows = dealOrder(), d = PP.first('deal'); const i = d ? rows.findIndex((r) => r.lead_id === d.lead_id) : -1;
    el.textContent = rows.length ? `Deal ${i + 1} of ${rows.length}, opportunities first, highest potential earnings first` : ''; });
  const step = (k) => { const rows = dealOrder(), d = PP.first('deal'); if (!rows.length) return;
    const i = d ? rows.findIndex((r) => r.lead_id === d.lead_id) : -1; const n = rows[(i + k + rows.length) % rows.length]; dash.setParams({ lead: n.lead_id }); };
  document.querySelectorAll('#pp-deal-prev').forEach((b) => b.addEventListener('click', () => step(-1)));
  document.querySelectorAll('#pp-deal-next').forEach((b) => b.addEventListener('click', () => step(1)));
  document.querySelectorAll('#pp-deal-q').forEach((inp) => inp.addEventListener('change', () => {
    const q = inp.value.trim().toLowerCase(); if (!q) return;
    const r = dealOrder().find((x) => dealLabel(x).toLowerCase() === q) || dealOrder().find((x) => `${dealLabel(x)} ${x.lead_id}`.toLowerCase().includes(q));
    if (r) { dash.setParams({ lead: r.lead_id }); inp.value = ''; } }));
  dash.draw('dKeyNums', (el) => { const r = PP.first('deal'); el.replaceChildren(); if (!r) return;
    [['Potential earnings', PP.money(r.potential_earnings)], ['Target contract price', PP.money(r.target_price)], ['Cash-buyer max', PP.money(r.buyer_max)],
     ['After-repair value', PP.money(r.arv_mid)], ['Next step due', PP.txt(r.next_action_date)]].forEach(([l, v]) => {
      const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = v; const s = document.createElement('span'); s.textContent = l; d.append(b, s); el.appendChild(d); }); });
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
  const signed = (v) => (v === null || v === undefined || v === '' || isNaN(+v)) ? '—' : (+v < 0 ? '−' : '') + M(Math.abs(+v));
  dash.draw('contractRows', (tb) => PP.rows(tb, 'contractDeals', [{ f: 'address' }, { f: 'city' }, { f: 'state' }, { f: 'stage' },
    { f: 'target_price', fmt: M, cls: 'pp-n' }, { f: 'buyer_max', fmt: M, cls: 'pp-n' }, { f: 'potential_earnings', fmt: M, cls: 'pp-n' },
    { f: 'earnest_money', fmt: (v) => +v ? M(v) : 'not set', cls: 'pp-n' }, { f: 'earnest_status', fmt: PP.txt }, { f: 'title_company', fmt: PP.txt }],
    'No deals under contract yet. Deals appear here once a contract goes out for signature.', PP.openDeal));
  dash.draw('dealProfitRows', (tb) => PP.rows(tb, 'dealProfit', [{ f: 'lead_id' }, { f: 'fees', fmt: M, cls: 'pp-n' }, { f: 'forecast', fmt: M, cls: 'pp-n' }, { f: 'costs', fmt: M, cls: 'pp-n' },
    { f: 'profit', fmt: signed, cls: (v) => 'pp-n ' + (+v < 0 ? 'pp-neg' : '') }, { f: 'earnest_out', fmt: M, cls: 'pp-n' }],
    'No money recorded against a deal yet.', (r) => PP.openDeal({ lead_id: r.lead_id })));
  dash.draw('taxDue', (el) => { const n = new Date(); const y = n.getFullYear(); const dates = [[y, 0, 15], [y, 3, 15], [y, 5, 15], [y, 8, 15], [y + 1, 0, 15]].map(([a, m, d]) => new Date(a, m, d));
    const next = dates.find((d) => d >= new Date(n.getFullYear(), n.getMonth(), n.getDate())); el.textContent = next ? next.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'; });
  dash.draw('plRows', (tb) => PP.rows(tb, 'finance', [{ f: 'month' }, { f: 'fees_forecast_contracted', fmt: M, cls: 'pp-n' }, { f: 'fees_earned', fmt: M, cls: 'pp-n' },
    { f: 'expenses', fmt: M, cls: 'pp-n' }, { f: 'net', fmt: signed, cls: 'pp-n' }, { f: 'tax_set_aside', fmt: M, cls: 'pp-n' }, { f: 'earnest_money_outstanding', fmt: M, cls: 'pp-n' }], 'No months recorded yet.'));
  const LTYPE = { income: 'Fee', expense: 'Expense', escrow_out: 'Earnest money out', escrow_back: 'Earnest money back' };
  dash.draw('ledgerRows', (tb) => PP.rows(tb, 'ledger', [{ f: 'date' }, { f: 'lead_id', fmt: PP.txt }, { f: 'type', fmt: (v) => LTYPE[v] || PP.txt(v) }, { f: 'category', fmt: PP.txt },
    { f: 'amount', fmt: M, cls: 'pp-n' }, { f: 'status', chip: (v) => v === 'actual' ? 'pp-ok' : 'pp-warn' }, { f: 'counterparty_role', fmt: PP.txt }, { f: 'doc_ref', fmt: PP.txt }],
    'No entries yet. The Bookkeeper records a fee or expense only when a document backs it (settlement statement, invoice or receipt); fees on signed contracts show as forecast.'));
  // Opportunities page filters (they drive both charts and the table).
  const optSel = (label, values, fmt) => (sel) => {
    const d = dash.data('opps'); const p = dash.params()[label];
    const vals = d.status === 'ok' ? values(d.data) : [];
    sel.replaceChildren(new Option('All', ''), ...vals.map((v) => new Option(fmt ? fmt(v) : v, v)));
    sel.value = p && vals.includes(p) ? p : '';
    sel.onchange = () => dash.setParams({ [label]: sel.value || null });
  };
  const byCount = (key) => (rows) => d3.rollups(rows, (v) => v.length, key).sort((a, b) => b[1] - a[1]).map(([k]) => k).filter(Boolean);
  dash.draw('oppStageSel', optSel('oppStage', byCount((r) => r.stage)));
  dash.draw('oppTypeSel', optSel('oppType', byCount((r) => r.lead_type || 'probate'), (v) => v.replace(/_/g, ' ')));
  dash.draw('oppCitySel', optSel('oppCity', byCount((r) => `${r.city}, ${r.state}`)));
  dash.draw('oppMinSel', (sel) => { const p = +dash.params().oppMin || 0;
    sel.replaceChildren(...[0, 10000, 20000, 30000, 40000].map((v) => new Option(v ? `${PP.money(v)}+` : 'Any', String(v))));
    sel.value = String(p); sel.onchange = () => dash.setParams({ oppMin: +sel.value ? sel.value : null }); });
  dash.draw('oppSummary', (el) => { const v = dash.data('oppsView'), a = dash.data('opps');
    if (v.status !== 'ok' || a.status !== 'ok') { el.textContent = ''; return; }
    const t = d3.sum(v.data, (r) => +r.potential_earnings || 0);
    el.textContent = `${v.data.length} of ${a.data.length} opportunities · ${PP.money(t)} potential earnings`; });
  document.querySelectorAll('#pp-op-reset').forEach((b) => b.addEventListener('click', () => dash.setParams({ oppStage: null, oppType: null, oppCity: null, oppMin: null })));
  dash.draw('oppRows', (tb) => PP.rows(tb, 'oppsView', [{ f: 'address' }, { f: 'city' }, { f: 'state' }, { f: 'verdict', chip: PP.verdictCls }, { f: 'lead_type', fmt: (v) => (v || 'probate').replace(/_/g, ' ') },
    { f: 'potential_earnings', fmt: M, cls: 'pp-n', bar: (r) => PP.stateColor(r.state) }, { f: 'target_price', fmt: M, cls: 'pp-n' }, { f: 'buyer_max', fmt: M, cls: 'pp-n' }, { f: 'arv_mid', fmt: M, cls: 'pp-n' },
    { f: 'stage' }, { f: 'next_action_date' }], 'No opportunities match these filters.', PP.openDeal));
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
