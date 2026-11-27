/* AI spend tab (owner decision 2026-11-27): what the AI engines cost, against the owner's monthly budget, and whether
   each engine can run right now. Data: ai_spend.csv (one row per Claude attempt, its real cost) and ai_credits.csv
   (the last credit check, this month's spend, budget, today's allowance, OpenRouter's daily count). */
(function () {
  const PP = window.PP, C = PP.chart;
  const one = () => { const d = dash.data('ai_credits'); return d.status === 'ok' && d.data[0] ? d.data[0] : {}; };
  const rows = () => { const d = dash.data('ai_spend'); return d.status === 'ok' ? d.data : []; };
  const usd = (v) => (v === '' || v === undefined || v === null) ? '—' : `$${(+v).toFixed(2)}`;
  const txt = (el, v) => { el.textContent = v; };

  dash.draw('aiMonth', (el) => { const c = one(); txt(el, c.budget ? `${usd(c.month_spend)} of ${usd(c.budget)}` : usd(c.month_spend)); });
  dash.draw('aiToday', (el) => { const c = one(); txt(el, c.today_allowance !== '' && c.today_allowance !== undefined ? `${usd(c.today_spend)} of ${usd(c.today_allowance)}` : usd(c.today_spend)); });
  dash.draw('aiProjected', (el) => { const c = one(); txt(el, usd(c.projected_month)); });
  dash.draw('aiAvgRun', (el) => { const c = one(); txt(el, c.runs_month ? `${usd(c.avg_run_cost)} × ${c.runs_month}` : '—'); });
  dash.draw('aiClaude', (el) => { const c = one(); el.replaceChildren();
    const chip = document.createElement('span'); chip.className = 'pp-chip ' + (c.claude_ok === 'yes' ? 'pp-ok' : c.claude_ok === 'no' ? 'pp-bad' : '');
    chip.textContent = c.claude_ok === 'yes' ? 'Claude can run' : c.claude_ok === 'no' ? 'Claude stopped' : 'Not checked yet';
    const why = document.createElement('div'); why.className = 'pp-sub'; why.textContent = `${c.claude_why || ''}${c.checked ? ` (checked ${c.checked} UTC)` : ''}`;
    el.append(chip, why); });
  dash.draw('aiOpenrouter', (el) => { const c = one();
    txt(el, c.openrouter_cap ? `${c.openrouter_today || 0} of ${c.openrouter_cap} requests today${c.openrouter_free_tier === 'yes' ? ' (free tier: $10 of credit raises it to 1,000)' : ''}` : 'Not used yet'); });
  dash.draw('aiBudgetNote', (el) => { const c = one();
    if (!c.budget) { txt(el, 'No monthly budget set: Setup → AI engines → Monthly AI budget. Each run still checks the credit balance before using Claude.'); return; }
    const pct = Math.round(100 * (+c.month_spend) / (+c.budget));
    txt(el, `${pct}% of the month's budget used; ${usd(c.budget_left)} left. At this month's pace the total would be ${usd(c.projected_month)}${+c.projected_month > +c.budget ? ': above the budget, so the runs are already pacing Claude down to its cheapest model and the free engines.' : '.'}`); });

  dash.draw('aiDayChart', (el) => {
    const by = d3.rollups(rows(), (v) => d3.sum(v, (r) => +r.cost_usd), (r) => r.day).map(([day, usdv]) => ({ day, usd: +usdv.toFixed(2) })).sort((a, b) => a.day < b.day ? -1 : 1).slice(-31);
    C.vcols(el, by, { title: 'Claude spend per day', x: (r) => r.day.slice(5), series: [{ key: 'usd', label: 'US$', color: dash.colors[0] }],
      fmt: (v) => `$${(+v).toFixed(2)}`, fmtAxis: (v) => `$${v}`, empty: 'No Claude spend recorded yet. Each run records its real cost here.' }); });
  dash.draw('aiSliceChart', (el) => {
    const by = d3.rollups(rows(), (v) => d3.sum(v, (r) => +r.cost_usd), (r) => r.slice).map(([s, v]) => ({ s: s || '?', usd: +v.toFixed(2) })).sort((a, b) => b.usd - a.usd);
    C.vcols(el, by, { title: 'Spend by run type', x: (r) => r.s, series: [{ key: 'usd', label: 'US$', color: dash.colors[1] }],
      fmt: (v) => `$${(+v).toFixed(2)}`, fmtAxis: (v) => `$${v}`, empty: 'Nothing yet.' }); });
  dash.draw('aiRows', (tb) => PP.rows(tb, 'ai_spend', [{ f: 'day' }, { f: 'time' }, { f: 'slice' }, { f: 'model' }, { f: 'cost_usd', cls: 'pp-n', fmt: (v) => `$${(+v).toFixed(2)}` }],
    'No Claude attempts recorded yet.'));
})();
