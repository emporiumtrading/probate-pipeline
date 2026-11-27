/* Team handoffs: questions, requests and blockers between workers (pipeline/handoffs.csv, via scripts/handoffs.py).
   Every worker with a role file is on the board, including ones added later, plus the owner. */
(function () {
  const PP = window.PP, C = PP.chart;
  const rowsOf = (id) => { const d = dash.data(id); return d.status === 'ok' && Array.isArray(d.data) ? d.data : []; };
  const ST_CLS = (r) => r.status === 'escalated' || r.overdue === 'yes' ? 'pp-bad' : r.status === 'open' ? 'pp-warn' : r.status === 'answered' ? 'pp-ok' : '';
  const stLabel = (r) => r.status === 'open' && r.overdue === 'yes' ? 'open, overdue' : r.status;
  const isOpen = (r) => r.status === 'open' || r.status === 'escalated';

  dash.calc('handoffsF', { title: 'Team handoffs', description: 'Questions, requests and blockers between workers, within the state, county, status and worker filters.', inputs: ['handoffs'],
    fn: (h) => { const p = dash.params(); const st = p.hstatus || 'open';
      return h.filter((r) => (!p.state || !r.state || r.state === p.state) && (!p.county || !r.county || r.county === p.county)
        && (st === 'all' || (st === 'open' ? isOpen(r) : r.status === st)) && (!p.hworker || r.to_worker === p.hworker || r.from_worker === p.hworker))
        .sort((a, b) => (b.priority === 'urgent') - (a.priority === 'urgent') || (b.kind === 'blocker') - (a.kind === 'blocker') || String(a.needed_by).localeCompare(String(b.needed_by))); } });
  dash.calc('hCounts', { title: 'Handoff counts', description: 'Open, overdue or escalated, open blockers, answered in the last 7 days, and the average days to answer.', inputs: ['handoffs'],
    fn: (h) => { const now = Date.now(); const ans = h.filter((r) => r.answered_on);
      const days = ans.map((r) => (Date.parse(r.answered_on) - Date.parse(r.created)) / 86400000).filter((d) => !isNaN(d));
      return [{ open: h.filter(isOpen).length, late: h.filter((r) => r.status === 'escalated' || r.overdue === 'yes').length,
        blockers: h.filter((r) => isOpen(r) && r.kind === 'blocker').length,
        answered7: ans.filter((r) => now - Date.parse(r.answered_on) <= 7 * 86400000).length,
        avg_days: days.length ? Math.round(10 * d3.mean(days)) / 10 : '' }]; } });
  dash.calc('handoffsDeal', { title: 'Handoffs on this deal', description: 'Every handoff about the deal picked on the Deal detail page.', inputs: ['handoffs', 'deal'],
    fn: (h, deal) => { const id = deal[0] && deal[0].lead_id; return id ? h.filter((r) => r.lead_id === id) : []; } });

  const num = (field, fmt) => (el) => { const d = dash.data('hCounts'); const v = d.status === 'ok' && d.data[0] ? d.data[0][field] : null; el.textContent = v === null || v === '' ? '—' : (fmt ? fmt(v) : PP.int(v)); };
  dash.draw('hoOpen', num('open')); dash.draw('hoLate', num('late')); dash.draw('hoBlock', num('blockers')); dash.draw('hoAns', num('answered7'));
  dash.draw('hoAvg', num('avg_days', (v) => `${v} d`));
  dash.draw('hoStatusSel', (el) => { const opts = [['open', 'Open and escalated'], ['escalated', 'Escalated only'], ['answered', 'Answered, not closed'], ['closed', 'Closed'], ['all', 'Everything']];
    el.replaceChildren(...opts.map(([v, t]) => new Option(t, v))); el.value = dash.params().hstatus || 'open'; el.onchange = () => dash.setParams({ hstatus: el.value === 'open' ? null : el.value }); });
  dash.draw('hoWorkerSel', (el) => { const h = rowsOf('handoffs'); const ws = [...new Set(h.flatMap((r) => [r.from_worker, r.to_worker]).filter(Boolean))].sort();
    el.replaceChildren(new Option('All workers', ''), ...ws.map((w) => new Option(w, w))); el.value = dash.params().hworker || ''; el.onchange = () => dash.setParams({ hworker: el.value || null }); });

  dash.draw('hoByWorker', (el) => { const h = rowsOf('handoffs').filter(isOpen);
    const rows = d3.rollups(h, (v) => ({ n: v.length, late: v.filter((r) => r.status === 'escalated' || r.overdue === 'yes').length }), (r) => r.to_worker).map(([w, o]) => ({ w, ...o })).sort((a, b) => b.n - a.n);
    C.hbars(el, rows, { title: 'Open handoffs by the worker who must answer', label: (r) => r.w, value: (r) => r.n, fmt: (v) => String(v), color: () => dash.colors[0],
      tip: (r) => `${r.w}: ${r.n} open${r.late ? `, ${r.late} overdue or escalated` : ''} (click to filter)`, onClick: (r) => dash.setParams({ hworker: r.w }),
      empty: 'Nothing open. Workers clear their handoffs at the start of each step.' }); });

  // Who asks whom: a from × to matrix of every handoff so far, one hue, darker = more.
  dash.draw('hoMatrix', (el) => { el.replaceChildren(); const h = rowsOf('handoffs');
    if (!h.length) return C.empty(el, 'No handoffs yet. Workers start using the board from the next run.');
    const from = [...new Set(h.map((r) => r.from_worker))].sort(), to = [...new Set(h.map((r) => r.to_worker))].sort();
    const n = d3.rollup(h, (v) => v.length, (r) => r.from_worker, (r) => r.to_worker); const max = d3.max([...n.values()].flatMap((m) => [...m.values()])) || 1;
    const W = el.clientWidth || 520, lw = 130, th = 96, cw = Math.max(18, Math.min(34, (W - lw) / to.length)), ch = 24, H = th + from.length * ch;
    const svg = d3.select(el).append('svg').attr('width', lw + to.length * cw).attr('height', H).style('max-width', '100%').attr('viewBox', `0 0 ${lw + to.length * cw} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Handoffs from each worker (rows) to each worker (columns): ' + h.length + ' in total');
    const tip = C.tip(el);
    svg.append('g').selectAll('text').data(to).join('text').attr('transform', (d, i) => `translate(${lw + i * cw + cw / 2},${th - 6}) rotate(-50)`).text((d) => d);
    svg.append('g').selectAll('text').data(from).join('text').attr('x', lw - 6).attr('y', (d, i) => th + i * ch + ch / 2 + 4).attr('text-anchor', 'end').text((d) => d);
    from.forEach((f, i) => to.forEach((t, j) => { const v = (n.get(f) && n.get(f).get(t)) || 0;
      svg.append('rect').attr('x', lw + j * cw + 1).attr('y', th + i * ch + 1).attr('width', cw - 2).attr('height', ch - 2).attr('rx', 3)
        .style('fill', v ? dash.colors[0] : 'var(--cds-chart-grid)').style('fill-opacity', v ? 0.2 + 0.8 * v / max : 1)
        .on('pointermove', (ev) => tip.show(ev, `${f} → ${t}: ${v} handoff${v === 1 ? '' : 's'}`)).on('pointerleave', tip.hide); }));
    C.legend(el, [['Fewer', 'color-mix(in srgb, ' + dash.colors[0] + ' 25%, transparent)'], ['More', dash.colors[0]], ['None', 'var(--cds-chart-grid)']]); });

  const cols = [{ f: 'id' }, { f: 'address', fmt: (v, r) => v ? `${v}, ${r.city} ${r.state}` : r.lead_id }, { f: 'from_worker' }, { f: 'to_worker' },
    { f: 'kind', chip: (v) => v === 'blocker' ? 'pp-bad' : '' }, { f: 'priority', chip: (v) => v === 'urgent' ? 'pp-warn' : '' }, { f: 'ask', cls: 'pp-w' }, { f: 'needed_by' },
    { f: 'status', fmt: (v, r) => stLabel(r), chip: (v, r) => ST_CLS(r) }, { f: 'answer', cls: 'pp-w pp-muted' }];
  dash.draw('hoRows', (tb) => PP.rows(tb, 'handoffsF', cols, 'Nothing here for these filters.', (r) => r.lead_id && r.lead_id !== 'general' && PP.openDeal(r)));
  // Buyers paired with this deal before it's signed (scripts/match_buyers.py), best fit first.
  dash.calc('dealBuyers', { title: 'Buyers lined up for this deal', description: 'The market buyers whose purchases best fit this house, ranked.', inputs: ['lead_buyer_matches', 'deal'],
    fn: (m, deal) => { const id = deal[0] && deal[0].lead_id; return id ? m.filter((r) => r.lead_id === id).sort((a, b) => a.rank - b.rank) : []; } });
  const bcols = [{ f: 'rank' }, { f: 'buyer' }, { f: 'fit' }, { f: 'why', cls: 'pp-w' },
    { f: 'status', chip: (v) => v === 'standby' || v === 'vetted' ? 'pp-good' : '' }, { f: 'warmth', fmt: (v) => v || 'cold', chip: (v) => v === 'hot' || v === 'warm' ? 'pp-good' : '' },
    { f: 'standby', fmt: (v) => v === 'yes' ? 'Yes' : '—' }, { f: 'ready_to_buy', fmt: (v) => v === 'yes' ? 'Yes' : 'not yet' }];
  dash.draw('dealBuyerRows', (tb) => PP.rows(tb, 'dealBuyers', bcols, 'No buyers paired yet: the market has no buyers whose purchases fit this house.'));
  dash.draw('dealBuyerSum', (el) => { const d = dash.data('dealBuyers'); const r = d.status === 'ok' ? d.data : [];
    const ready = r.filter((x) => x.ready_to_buy === 'yes' || x.standby === 'yes').length, vet = r.filter((x) => x.status === 'vetted' || x.status === 'standby').length;
    el.textContent = r.length ? `${r.length} buyers paired · ${vet} vetted · ${ready} ready or on standby. Goal before signing: at least 3 vetted and 1 ready.` : ''; });
  dash.draw('hoDealRows', (tb) => PP.rows(tb, 'handoffsDeal', cols.filter((c) => c.f !== 'address'), 'No questions between workers on this deal.'));
})();
