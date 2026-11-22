/* Probate Operations dashboard: charts. Mark rules (dataviz skill): bars <=24px with a 4px rounded data end, square at the baseline;
   recessive hairline grid; text in text tokens, never series colors; legend for 2+ series; hover tooltip on every mark; aria-label on every SVG. */
(function () {
  const PP = window.PP;
  const C = (PP.chart = {});
  C.notReady = (el, d) => { el.replaceChildren(); const p = document.createElement('p'); p.className = 'pp-sub'; p.textContent = d.status === 'error' ? 'Failed to load' : (d.status === 'loading' ? 'Loading…' : '—'); el.appendChild(p); };
  C.empty = (el, t) => { el.replaceChildren(); const p = document.createElement('p'); p.className = 'pp-sub'; p.textContent = t; el.appendChild(p); };
  C.tip = (el) => { const t = document.createElement('div'); t.className = 'pp-tip'; t.hidden = true; el.appendChild(t);
    return { show: (ev, text) => { const b = el.getBoundingClientRect(); t.hidden = false; t.textContent = text; const w = t.offsetWidth || 160;
      t.style.left = Math.max(0, Math.min(ev.clientX - b.left + 12, b.width - w - 4)) + 'px'; t.style.top = Math.max(0, ev.clientY - b.top - 34) + 'px'; }, hide: () => { t.hidden = true; } }; };
  C.legend = (el, items) => { const L = document.createElement('div'); L.className = 'pp-legend';
    items.forEach(([label, color]) => { const s = document.createElement('span'); const i = document.createElement('i'); i.style.background = color; s.append(i, document.createTextNode(label)); L.appendChild(s); }); el.appendChild(L); };
  // Horizontal bar path: square at x0 (baseline), 4px rounded data end.
  C.hpath = (x0, y, w, h) => { const r = Math.min(4, h / 2, Math.max(0, w)); const x1 = x0 + Math.max(0, w);
    return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`; };
  C.vpath = (x, y0, w, h) => { const r = Math.min(4, w / 2, Math.max(0, h)); const y1 = y0 - Math.max(0, h);
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`; };

  // Horizontal bars, one series. opts: label, value, color(r), fmt, onClick, tip, title, empty, target, selected(r)
  C.hbars = (el, rows, o) => {
    el.replaceChildren();
    if (!rows.length) return C.empty(el, o.empty || 'Nothing to show for these filters.');
    const W = el.clientWidth || 360, bandH = 30, barH = 18, H = rows.length * bandH + (o.target ? 24 : 4);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', `${o.title}: ` + rows.map((r) => `${o.label(r)} ${o.fmt(o.value(r))}`).join(', '));
    const labs = svg.append('g').selectAll('text').data(rows).join('text').attr('x', 0).attr('y', (r, i) => i * bandH + bandH / 2 + 4).text(o.label)
      .style('font-weight', (r) => o.selected && o.selected(r) ? '600' : null);
    let lw = 0; labs.each(function () { lw = Math.max(lw, this.getComputedTextLength()); }); lw = Math.min((lw || 100) + 12, W * 0.45);
    labs.each(function () { const full = this.textContent; let t = full; while (this.getComputedTextLength() > lw - 12 && t.length > 4) { t = t.slice(0, -2); this.textContent = t + '…'; } });
    const max = Math.max(o.target || 0, d3.max(rows, o.value) || 0) || 1;
    const x = d3.scaleLinear().domain([0, max]).range([0, Math.max(40, W - lw - 64)]);
    svg.append('line').attr('x1', lw).attr('x2', lw).attr('y1', 0).attr('y2', rows.length * bandH).style('stroke', 'var(--cds-chart-axis)');
    const tip = C.tip(el);
    svg.append('g').selectAll('path').data(rows).join('path').attr('d', (r, i) => C.hpath(lw, i * bandH + (bandH - barH) / 2, o.value(r) ? Math.max(3, x(o.value(r))) : 0, barH))
      .style('fill', (r) => o.color(r)).style('cursor', o.onClick ? 'pointer' : 'default')
      .on('pointermove', (ev, r) => tip.show(ev, o.tip ? o.tip(r) : `${o.label(r)}: ${o.fmt(o.value(r))}`)).on('pointerleave', tip.hide)
      .on('click', (ev, r) => o.onClick && o.onClick(r));
    svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', 0).attr('y', (r, i) => i * bandH).attr('width', W).attr('height', bandH).style('fill', 'transparent')
      .style('cursor', o.onClick ? 'pointer' : 'default')
      .on('pointermove', (ev, r) => tip.show(ev, o.tip ? o.tip(r) : `${o.label(r)}: ${o.fmt(o.value(r))}`)).on('pointerleave', tip.hide).on('click', (ev, r) => o.onClick && o.onClick(r));
    svg.append('g').selectAll('text').data(rows).join('text').attr('class', 'pp-val').attr('x', (r) => lw + (o.value(r) ? Math.max(3, x(o.value(r))) : 0) + 6)
      .attr('y', (r, i) => i * bandH + bandH / 2 + 4).text((r) => o.fmt(o.value(r)));
    if (o.target) { const tx = lw + x(o.target);
      svg.append('line').attr('x1', tx).attr('x2', tx).attr('y1', 0).attr('y2', rows.length * bandH).style('stroke', 'var(--cds-chart-reference)').style('stroke-dasharray', '4 3');
      svg.append('text').attr('x', Math.min(tx, W - 110)).attr('y', rows.length * bandH + 16).text(`Target: ${o.target}`); }
    if (o.legend) C.legend(el, o.legend);
  };

  // Vertical columns, one or more series on one y-scale. opts: x(r) label, series [{key,label,color}], fmt, title, empty
  C.vcols = (el, rows, o) => {
    el.replaceChildren();
    if (!rows.length || !rows.some((r) => o.series.some((s) => +r[s.key]))) return C.empty(el, o.empty || 'Nothing to show yet.');
    const W = el.clientWidth || 360, H = 190, m = { t: 14, r: 8, b: 30, l: 40 };
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', `${o.title}: ` + rows.map((r) => `${o.x(r)} ` + o.series.map((s) => `${s.label} ${o.fmt(+r[s.key] || 0)}`).join(', ')).join('; '));
    const x0 = d3.scaleBand().domain(rows.map(o.x)).range([m.l, W - m.r]).paddingInner(0.25).paddingOuter(0.1);
    const x1 = d3.scaleBand().domain(o.series.map((s) => s.key)).range([0, x0.bandwidth()]).padding(0.08);
    const ymax = d3.max(rows, (r) => d3.max(o.series, (s) => +r[s.key] || 0)) || 1;
    const y = d3.scaleLinear().domain([0, ymax]).nice(4).range([H - m.b, m.t]);
    svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y).style('stroke', 'var(--cds-chart-grid)');
    svg.append('g').selectAll('text').data(y.ticks(4)).join('text').attr('x', m.l - 6).attr('y', (v) => y(v) + 4).attr('text-anchor', 'end').text((v) => o.fmtAxis ? o.fmtAxis(v) : d3.format('~s')(v));
    const lab = svg.append('g').selectAll('text').data(rows).join('text').attr('x', (r) => x0(o.x(r)) + x0.bandwidth() / 2).attr('y', H - 10).attr('text-anchor', 'middle').text(o.x);
    if (x0.step() < 46) lab.text((r, i) => i % Math.ceil(46 / x0.step()) ? '' : o.x(r));
    const tip = C.tip(el);
    const bw = Math.min(24, x1.bandwidth());
    o.series.forEach((s) => {
      svg.append('g').selectAll('path').data(rows).join('path')
        .attr('d', (r) => C.vpath(x0(o.x(r)) + x1(s.key) + (x1.bandwidth() - bw) / 2, y(0), bw, (+r[s.key] || 0) ? Math.max(2, y(0) - y(+r[s.key])) : 0))
        .style('fill', s.color).on('pointermove', (ev, r) => tip.show(ev, `${o.x(r)} · ${s.label}: ${o.fmt(+r[s.key] || 0)}`)).on('pointerleave', tip.hide);
    });
    if (o.series.length > 1) C.legend(el, o.series.map((s) => [s.label, s.color]));
  };

  // Scatter. opts: x, y, color(r), label(r), onClick, title, xFmt, yFmt
  C.scatter = (el, rows, o) => {
    el.replaceChildren();
    if (!rows.length) return C.empty(el, o.empty || 'Nothing to plot yet.');
    const W = el.clientWidth || 360, H = 240, m = { t: 12, r: 14, b: 34, l: 52 };
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', `${o.title}: ` + rows.map((r) => `${o.label(r)} ${o.xFmt(o.x(r))}, ${o.yFmt(o.y(r))}`).join('; '));
    const x = d3.scaleLinear().domain([0, d3.max(rows, o.x) || 1]).nice(4).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, d3.max(rows, o.y) || 1]).nice(4).range([H - m.b, m.t]);
    svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y).style('stroke', 'var(--cds-chart-grid)');
    svg.append('g').selectAll('text').data(y.ticks(4)).join('text').attr('x', m.l - 6).attr('y', (v) => y(v) + 4).attr('text-anchor', 'end').text((v) => '$' + d3.format('~s')(v));
    svg.append('g').selectAll('text').data(x.ticks(Math.max(2, Math.floor(W / 90)))).join('text').attr('x', x).attr('y', H - 14).attr('text-anchor', 'middle').text((v) => '$' + d3.format('~s')(v));
    svg.append('text').attr('x', W - m.r).attr('y', H - 1).attr('text-anchor', 'end').text('After-repair value');
    const tip = C.tip(el);
    svg.append('g').selectAll('circle').data(rows).join('circle').attr('cx', (r) => x(o.x(r))).attr('cy', (r) => y(o.y(r))).attr('r', 6)
      .style('fill', o.color).style('stroke', 'var(--color-panel)').style('stroke-width', 2).style('cursor', o.onClick ? 'pointer' : 'default')
      .on('pointermove', (ev, r) => tip.show(ev, `${o.label(r)}: value ${o.xFmt(o.x(r))}, earnings ${o.yFmt(o.y(r))}`)).on('pointerleave', tip.hide).on('click', (ev, r) => o.onClick && o.onClick(r));
    if (o.legend) C.legend(el, o.legend);
  };

  // Two-part stacked horizontal bars (done vs missing etc.), 2px surface gap between segments.
  C.stack2 = (el, rows, o) => {
    el.replaceChildren();
    if (!rows.length) return C.empty(el, 'Nothing to show.');
    const W = el.clientWidth || 360, bandH = 30, barH = 18, H = rows.length * bandH;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', `${o.title}: ` + rows.map((r) => `${o.label(r)} ${o.a.label} ${r[o.a.key]}, ${o.b.label} ${r[o.b.key]}`).join('; '));
    const labs = svg.append('g').selectAll('text').data(rows).join('text').attr('x', 0).attr('y', (r, i) => i * bandH + bandH / 2 + 4).text(o.label);
    let lw = 0; labs.each(function () { lw = Math.max(lw, this.getComputedTextLength()); }); lw = Math.min(lw + 12, W * 0.45);
    const max = d3.max(rows, (r) => (+r[o.a.key] || 0) + (+r[o.b.key] || 0)) || 1;
    const x = d3.scaleLinear().domain([0, max]).range([0, W - lw - 40]);
    const tip = C.tip(el);
    rows.forEach((r, i) => { const a = +r[o.a.key] || 0, b = +r[o.b.key] || 0, yy = i * bandH + (bandH - barH) / 2;
      const g = svg.append('g').on('pointermove', (ev) => tip.show(ev, `${o.label(r)}: ${a} ${o.a.label.toLowerCase()}, ${b} ${o.b.label.toLowerCase()}`)).on('pointerleave', tip.hide);
      if (a) g.append('rect').attr('x', lw).attr('y', yy).attr('width', Math.max(2, x(a) - (b ? 2 : 0))).attr('height', barH).style('fill', o.a.color);
      if (b) g.append('path').attr('d', C.hpath(lw + x(a), yy, Math.max(3, x(b)), barH)).style('fill', o.b.color);
      svg.append('text').attr('class', 'pp-val').attr('x', lw + x(a + b) + 6).attr('y', yy + barH / 2 + 4).text(`${a}/${a + b}`); });
    C.legend(el, [[o.a.label, o.a.color], [o.b.label, o.b.color]]);
  };

  // US tile-grid map (one square per state + DC).
  C.GRID = { AK: [0, 0], ME: [11, 0], VT: [10, 1], NH: [11, 1], WA: [1, 2], ID: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], IL: [6, 2], WI: [7, 2], MI: [8, 2], NY: [9, 2], RI: [10, 2], MA: [11, 2],
    OR: [1, 3], NV: [2, 3], WY: [3, 3], SD: [4, 3], IA: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3],
    CA: [1, 4], UT: [2, 4], CO: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4],
    AZ: [2, 5], NM: [3, 5], KS: [4, 5], AR: [5, 5], TN: [6, 5], NC: [7, 5], SC: [8, 5], DC: [9, 5],
    OK: [4, 6], LA: [5, 6], MS: [6, 6], AL: [7, 6], GA: [8, 6], HI: [0, 7], TX: [4, 7], FL: [9, 7] };
})();

(function () {
  const PP = window.PP, C = PP.chart;
  const M = PP.money, MK = PP.moneyK;
  const ok = (d) => d.status === 'ok' && d.data;
  const statesLegend = (rows) => [...new Set(rows.map((r) => r.state))].sort((a, b) => (PP.STATE_ORDER.indexOf(a) + 99) % 99 - (PP.STATE_ORDER.indexOf(b) + 99) % 99)
    .map((s) => [PP.STATE_ORDER.includes(s) ? s : `${s} (other)`, PP.stateColor(s)]);

  dash.draw('funnelChart', (el) => { const d = dash.data('stageCounts'); if (!ok(d)) return C.notReady(el, d);
    const rows = d.data.filter((r) => r.stage !== 'Dead' && r.count > 0);
    C.hbars(el, rows, { title: 'Active deals by stage', label: (r) => r.stage, value: (r) => r.count, fmt: (v) => String(v), color: () => dash.colors[0], empty: 'No active deals in this state or county yet.',
      tip: (r) => `${r.stage}: ${r.count} deal${r.count === 1 ? '' : 's'}, ${M(r.earnings)} potential · run by ${r.team}`, onClick: (r) => { dash.setParams({ stage: r.stage }); PP.show('pipeline'); } }); });
  dash.draw('stateEarnChart', (el) => { const d = dash.data('earnByState'); if (!ok(d)) return C.notReady(el, d);
    C.hbars(el, d.data, { title: 'Potential earnings by state', label: (r) => r.state, value: (r) => r.earnings, fmt: MK, color: (r) => PP.stateColor(r.state),
      tip: (r) => `${r.state}: ${M(r.earnings)} across ${r.deals} deals`, onClick: (r) => dash.setParams({ state: r.state, county: null }), empty: 'No opportunities yet.' }); });
  dash.draw('topChart', (el) => { const d = dash.data('opps'); if (!ok(d)) return C.notReady(el, d);
    const rows = d.data.slice(0, 10);
    C.hbars(el, rows, { title: 'Top deals by potential earnings', label: (r) => `${r.address} · ${r.city}`, value: (r) => +r.potential_earnings || 0, fmt: MK, color: (r) => PP.stateColor(r.state),
      tip: (r) => `${r.address}, ${r.city} ${r.state}: earn ${M(r.potential_earnings)} (target ${M(r.target_price)}, buyer max ${M(r.buyer_max)})`, onClick: PP.openDeal,
      legend: rows.length ? statesLegend(rows) : null, empty: 'No opportunities in this state or county yet.' }); });
  // Pace: closings vs target on a month track, then what each earlier step needs (worked back from the target at the assumed rates).
  dash.draw('paceChart', (el) => { const d = dash.data('pace'); if (!ok(d) || !d.data[0]) return C.notReady(el, d);
    el.replaceChildren(); const r = d.data[0], n = (k) => +r[k] || 0, T = n('target_closings'), closed = n('closed'), F = Math.min(n('floor_closings'), T);
    const [yy, mm] = String(r.month || '').split('-').map(Number), now = new Date();
    const dim = yy ? new Date(yy, mm, 0).getDate() : 30, cur = yy === now.getFullYear() && mm === now.getMonth() + 1;
    const day = cur ? now.getDate() : dim, left = Math.max(0, dim - day), expected = T * day / dim, floorExp = F * day / dim;
    const status = closed >= T ? ['Closed this month · goal met', 'pp-t-ok'] : F && closed >= F ? [`Closed this month · floor of ${F} reached, aiming for ${T}`, 'pp-t-ok']
      : closed >= Math.floor(expected) ? ['Closed this month · on pace for the goal', 'pp-t-ok'] : F && closed >= Math.floor(floorExp) ? [`Closed this month · on pace for the floor of ${F}`, 'pp-t-warn']
      : [F ? `Closed this month · behind pace for the floor of ${F}` : 'Closed this month · behind pace', 'pp-t-bad'];
    const perWeek = left ? Math.max(0, T - closed) / (left / 7) : 0, f1 = d3.format('.1f');
    const el_ = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    // 1. Four headline figures.
    const tiles = el_('div', 'pp-tiles pp-pace-tiles');
    [[`${closed} of ${T}`, status[0], status[1]],
     [f1(expected), (cur ? `On pace for the goal by today (day ${day} of ${dim})` : 'Goal for the month') + (F && cur ? ` · ${f1(floorExp)} for the floor` : ''), 'pp-t-muted'],
     [String(left), left === 1 ? 'Day left this month' : 'Days left this month', 'pp-t-muted'],
     [closed >= T ? '0' : f1(perWeek), 'Closings needed per week to reach the goal' + (F && closed < F && left ? ` · ${f1((F - closed) / (left / 7))} for the floor` : ''), closed >= T ? 'pp-t-ok' : 'pp-t-warn']]
      .forEach(([v, l, c]) => { const t = el_('div', `pp-card pp-tile ${c}`); t.append(el_('div', 'pp-num pp-num-s', v), el_('div', 'pp-lbl', l)); tiles.appendChild(t); });
    el.appendChild(tiles);
    // 2. Month track: closed so far, today's expected mark, target at the end.
    const W = el.clientWidth || 520, H = 58, pad = 2, x = d3.scaleLinear().domain([0, Math.max(T, closed, 1)]).range([pad, W - pad]);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').style('margin-top', 'var(--cds-gap-md)')
      .attr('aria-label', `${closed} of ${T} closings this month (floor ${F}); ${f1(expected)} expected by today; ${left} days left`);
    const tip = C.tip(el), y0 = 14, bh = 16;
    svg.append('rect').attr('x', pad).attr('y', y0).attr('width', W - 2 * pad).attr('height', bh).attr('rx', 4).style('fill', 'var(--cds-chart-grid)')
      .on('pointermove', (ev) => tip.show(ev, `Goal: ${T} closings in ${r.month}${F ? ` · floor (still a win): ${F}` : ''}`)).on('pointerleave', tip.hide);
    if (closed) svg.append('path').attr('d', C.hpath(pad, y0, x(closed) - pad, bh)).style('fill', 'var(--color-ok)')
      .on('pointermove', (ev) => tip.show(ev, `Closed: ${closed}`)).on('pointerleave', tip.hide);
    if (cur && T) { const ex = x(expected);
      svg.append('line').attr('x1', ex).attr('x2', ex).attr('y1', y0 - 6).attr('y2', y0 + bh + 6).style('stroke', 'var(--color-fg)').style('stroke-width', 2);
      svg.append('rect').attr('x', ex - 8).attr('y', 0).attr('width', 16).attr('height', H).style('fill', 'transparent')
        .on('pointermove', (ev) => tip.show(ev, `Expected by today: ${f1(expected)}`)).on('pointerleave', tip.hide);
      svg.append('text').attr('x', ex).attr('y', y0 - 8).attr('text-anchor', ex < 60 ? 'start' : ex > W - 60 ? 'end' : 'middle').text('Today'); }
    if (F) { const fx = x(F);
      svg.append('line').attr('x1', fx).attr('x2', fx).attr('y1', y0 - 2).attr('y2', y0 + bh + 10).style('stroke', 'var(--cds-chart-reference)').style('stroke-width', 2).style('stroke-dasharray', '3 2');
      svg.append('rect').attr('x', fx - 8).attr('y', 0).attr('width', 16).attr('height', H).style('fill', 'transparent')
        .on('pointermove', (ev) => tip.show(ev, `Floor: ${F} closings still counts as a winning month`)).on('pointerleave', tip.hide);
      svg.append('text').attr('x', fx).attr('y', H - 4).attr('text-anchor', 'middle').text(`Floor ${F}`); }
    svg.append('text').attr('x', pad).attr('y', H - 4).text('0');
    svg.append('text').attr('x', W - pad).attr('y', H - 4).attr('text-anchor', 'end').attr('class', 'pp-val').text(`Goal ${T}`);
    C.legend(el, [['Closed', 'var(--color-ok)'], ['Still to close', 'var(--cds-chart-grid)'], ['Expected by today', 'var(--color-fg)']].concat(F ? [['Floor (still a win)', 'var(--cds-chart-reference)']] : []));
    // 3. What it takes: each step's actual vs needed, as a meter of % reached (one unit for every row).
    const steps = [['Leads researched', 'leads_researched', 'needed_researched'], ['Opportunities found', 'opportunities', 'needed_opportunities', 'researched_to_opportunity', 'of researched leads become opportunities', 'leads'],
      ['Conversations with sellers', 'reached_conversation', 'needed_conversations', 'opportunity_to_conversation', 'of contacted opportunities reach a conversation', 'contacted opportunities'],
      ['Contracts signed', 'reached_contract', 'needed_contracts', 'conversation_to_contract', 'of conversations become signed contracts', 'conversations'], ['Closed', 'closed', 'target_closings', 'contract_to_close', 'of contracts close', 'contracts']];
    const pct0 = d3.format('.0%'), waiting = n('outreach_awaiting_approval');
    const rateNote = (k, what, unit) => { if (!k || r['rate_' + k] == null || r['rate_' + k] === '') return null; const src = r['src_' + k], N = n('n_' + k), W = n('won_' + k), rt = pct0(+r['rate_' + k]);
      if (src === 'measured') return `${rt} ${what}: measured, ${W} of ${N} ${unit}.`;
      if (src === 'blended') return `${rt} ${what}: ${W} of ${N} ${unit} so far, blended with the starting assumption until ${n('min_sample')} outcomes.`;
      return `${rt} ${what}: starting assumption, no outcomes yet` + (k === 'opportunity_to_conversation' && waiting ? ` (nothing sent; ${waiting} outreach drafts are waiting for your approval).` : '.'); };
    const hasNeed = r.needed_researched != null && r.needed_researched !== '';
    el.appendChild(el_('h3', 'pp-pace-h', `What it takes to close ${T} this month`));
    if (!hasNeed) { el.appendChild(el_('p', 'pp-sub', 'The step-by-step targets appear after the next daily data refresh.')); return; }
    el.appendChild(el_('p', 'pp-sub', 'Worked back from the goal using each step\'s measured conversion rate. A step with no outcomes yet uses a starting assumption and switches to its own rate as soon as results come in. Bar = share of what that step needs' + (F ? `; the tick marks what the floor of ${F} needs.` : '.')));
    const list = el_('div', 'pp-steps');
    steps.forEach(([label, have, need, rk, what, unit]) => { const a = n(have), q = n(need), pct = q ? Math.min(100, 100 * a / q) : 0, done = a >= q;
      const row = el_('div', 'pp-step'); row.title = `${label}: ${a} of ${q} needed (${Math.round(q ? 100 * a / q : 0)}%)`;
      const top = el_('div', 'pp-step-top'); top.append(el_('span', null, label), el_('span', 'pp-step-n', `${d3.format(',')(a)} / ${d3.format(',')(q)}`));
      const chip = el_('span', `pp-chip ${done ? 'pp-ok' : 'pp-warn'}`, done ? 'Enough' : `Short ${d3.format(',')(q - a)}`); top.appendChild(chip);
      const m = el_('div', 'pp-meter'); m.setAttribute('role', 'progressbar'); m.setAttribute('aria-label', `${label}: ${a} of ${q} needed`);
      m.setAttribute('aria-valuenow', String(Math.round(pct))); m.setAttribute('aria-valuemin', '0'); m.setAttribute('aria-valuemax', '100');
      const fill = el_('div'); fill.style.width = pct + '%'; fill.style.background = done ? 'var(--color-ok)' : dash.colors[0]; m.appendChild(fill);
      if (F && T) { const tk = el_('i', 'pp-step-floor'); tk.style.left = Math.min(100, 100 * Math.ceil(q * F / T) / (q || 1)) + '%'; m.appendChild(tk); row.title += ` · floor of ${F} needs about ${Math.ceil(q * F / T)}`; }
      row.append(top, m); const note = rateNote(rk, what, unit); if (note) { const p = el_('p', 'pp-step-note', note); if (r['src_' + rk] === 'assumed') p.classList.add('pp-step-assumed'); row.appendChild(p); } list.appendChild(row); });
    el.appendChild(list); });

  dash.draw('scatterChart', (el) => { const d = dash.data('opps'); if (!ok(d)) return C.notReady(el, d);
    C.scatter(el, d.data, { title: 'After-repair value vs potential earnings', x: (r) => +r.arv_mid || 0, y: (r) => +r.potential_earnings || 0, color: (r) => PP.stateColor(r.state),
      label: (r) => `${r.address}, ${r.city} ${r.state}`, xFmt: MK, yFmt: M, onClick: PP.openDeal, legend: d.data.length ? statesLegend(d.data) : null, empty: 'No opportunities in this state or county yet.' }); });
  dash.draw('cityChart', (el) => { const d = dash.data('oppsByCity'); if (!ok(d)) return C.notReady(el, d);
    C.hbars(el, d.data.slice(0, 12), { title: 'Opportunities by city', label: (r) => r.city, value: (r) => r.deals, fmt: (v) => String(v), color: (r) => PP.stateColor(r.state),
      tip: (r) => `${r.city}: ${r.deals} deals, ${M(r.earnings)} potential`, legend: d.data.length ? statesLegend(d.data) : null, empty: 'No opportunities yet.' }); });

  dash.draw('stageChart', (el) => { const d = dash.data('stageCounts'); if (!ok(d)) return C.notReady(el, d);
    const sel = dash.params().stage || 'Outreach drafted';
    C.hbars(el, d.data, { title: 'Deals at every stage', label: (r) => `${r.stage_order}. ${r.stage}`, value: (r) => r.count, fmt: (v) => String(v),
      color: (r) => r.stage === sel ? dash.colors[0] : (r.owner_action ? 'var(--color-warn)' : 'var(--cds-chart-muted)'), selected: (r) => r.stage === sel,
      tip: (r) => `${r.stage}: ${r.count} deals · ${r.team}${r.owner_action ? ' · needs you: ' + (PP.owner[r.owner_action] || r.owner_action) : ''}`,
      onClick: (r) => dash.setParams({ stage: r.stage }), legend: [['Selected stage', dash.colors[0]], ['Stage that needs you', 'var(--color-warn)'], ['Other stage', 'var(--cds-chart-muted)']] }); });
  dash.draw('teamChart', (el) => { const d = dash.data('teamLoad'); if (!ok(d)) return C.notReady(el, d);
    C.hbars(el, d.data, { title: 'Workload by team', label: (r) => r.team, value: (r) => r.deals, fmt: (v) => String(v), color: () => dash.colors[0], empty: 'No active deals.' }); });

  dash.draw('ladderChart', (el) => { const d = dash.data('deal'); if (!ok(d) || !d.data[0]) return C.notReady(el, d);
    const r = d.data[0]; const n = (k) => +r[k] || 0;
    if (!n('arv_mid')) return C.empty(el, 'No numbers for this lead (walk-away or research only).');
    const rows = [{ label: 'After-repair value', v: n('arv_mid'), c: 'var(--cds-chart-muted)' }, { label: 'Repairs (estimate)', v: n('repairs_mid'), c: 'var(--color-bad)' },
      { label: 'Cash-buyer max', v: n('buyer_max'), c: dash.colors[0] }, { label: 'Max offer to estate', v: n('mao'), c: dash.colors[0] },
      { label: 'Target contract price', v: n('target_price'), c: dash.colors[0] }, { label: 'Potential earnings', v: n('potential_earnings'), c: 'var(--color-ok)' }].filter((x) => x.v);
    C.hbars(el, rows, { title: 'Price ladder', label: (x) => x.label, value: (x) => x.v, fmt: M, color: (x) => x.c, legend: [['Repairs (cost)', 'var(--color-bad)'], ['Prices', dash.colors[0]], ['Your fee', 'var(--color-ok)']] }); });
  dash.draw('dealProgress', (el) => { const d = dash.data('deal'), s = dash.data('stages');
    if (!ok(d) || !ok(s) || !d.data[0]) return C.notReady(el, d.status !== 'ok' ? d : s);
    el.replaceChildren(); const r = d.data[0]; const cur = +r.stage_order; const dead = r.stage === 'Dead'; const steps = s.data.filter((x) => x.stage !== 'Dead');
    const W = el.clientWidth || 400, n = steps.length, step = W / n, H = 86;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', dead ? 'Deal closed out (walk away)' : `Deal is at stage ${cur} of ${n}: ${r.stage}`);
    svg.append('line').attr('x1', step / 2).attr('x2', W - step / 2).attr('y1', 18).attr('y2', 18).style('stroke', 'var(--cds-chart-grid)').style('stroke-width', 2);
    if (!dead) svg.append('line').attr('x1', step / 2).attr('x2', Math.max(step / 2, (cur - 0.5) * step)).attr('y1', 18).attr('y2', 18).style('stroke', dash.colors[0]).style('stroke-width', 2);
    const tip = C.tip(el);
    svg.selectAll('circle').data(steps).join('circle').attr('cx', (x, i) => i * step + step / 2).attr('cy', 18).attr('r', (x) => +x.stage_order === cur ? 8 : 6)
      .style('fill', (x) => dead ? 'var(--cds-chart-grid)' : +x.stage_order < cur ? dash.colors[0] : +x.stage_order === cur ? 'var(--color-panel)' : 'var(--cds-chart-grid)')
      .style('stroke', (x) => +x.stage_order === cur && !dead ? dash.colors[0] : 'var(--color-panel)').style('stroke-width', 2)
      .on('pointermove', (ev, x) => tip.show(ev, `${x.stage_order}. ${x.stage}: ${x.meaning || ''} (${x.team}${x.owner_action ? '; needs you' : ''})`)).on('pointerleave', tip.hide);
    svg.selectAll('text.num').data(steps).join('text').attr('class', 'num').attr('x', (x, i) => i * step + step / 2).attr('y', 36).attr('text-anchor', 'middle').style('font-size', '10px').text((x) => x.stage_order);
    svg.selectAll('text.lbl').data(steps).join('text').attr('class', 'lbl').attr('x', (x, i) => i * step + step / 2).attr('y', 54).text((x, i) => (+x.stage_order === cur && !dead) || (i === n - 1 && Math.abs((cur - 1) - i) * step > 140) ? x.stage : '')
      .attr('text-anchor', (x, i) => { const px = i * step + step / 2; return px < 70 ? 'start' : px > W - 70 ? 'end' : 'middle'; })
      .attr('dx', (x, i) => { const px = i * step + step / 2; return px < 70 ? -Math.min(px, step / 2) + 2 : px > W - 70 ? Math.min(W - px, step / 2) - 2 : 0; });
    svg.append('text').attr('class', 'pp-val').attr('x', 0).attr('y', 78).text(dead ? 'This deal is closed out (walk away).' : `Stage ${cur} of ${n}: ${r.stage}`); });

  dash.draw('stageLegend', (ol) => { const d = dash.data('deal'), s = dash.data('stages'); ol.replaceChildren();
    if (!ok(s)) return; const r = ok(d) && d.data[0] ? d.data[0] : null; const cur = r ? +r.stage_order : 0; const dead = r && r.stage === 'Dead';
    s.data.forEach((x) => { const li = document.createElement('li'); const n = document.createElement('span'); n.className = 'pp-n2'; n.textContent = x.stage_order + '.';
      li.append(n, ' ' + x.stage + (x.owner_action ? ' (you)' : '')); li.title = (x.meaning || '') + ' Handled by: ' + x.team + '.';
      if (!dead && +x.stage_order < cur && x.stage !== 'Dead') li.className = 'pp-done'; if ((!dead && +x.stage_order === cur) || (dead && x.stage === 'Dead')) li.className = 'pp-cur'; ol.appendChild(li); }); });

  dash.draw('dueChart', (el) => { const d = dash.data('queuesF'); if (!ok(d)) return C.notReady(el, d);
    const rows = d3.rollups(d.data.filter((r) => r.due), (v) => v.length, (r) => r.due).map(([due, n]) => ({ due, n })).sort((a, b) => a.due < b.due ? -1 : 1);
    C.vcols(el, rows, { title: 'Items due by date', x: (r) => r.due.slice(5), series: [{ key: 'n', label: 'Items', color: dash.colors[0] }], fmt: (v) => String(v), fmtAxis: (v) => d3.format('d')(v), empty: 'Nothing due.' }); });
  dash.draw('queueStateChart', (el) => { const d = dash.data('queuesF'); if (!ok(d)) return C.notReady(el, d);
    const rows = d3.rollups(d.data, (v) => v.length, (r) => r.state).map(([state, n]) => ({ state, n })).sort((a, b) => b.n - a.n);
    C.hbars(el, rows, { title: 'Queue items by state', label: (r) => r.state, value: (r) => r.n, fmt: (v) => String(v), color: (r) => PP.stateColor(r.state), empty: 'Nothing waiting on you.' }); });

  dash.draw('stateMap', (el) => { const d = dash.data('stateStatus'); if (!ok(d)) return C.notReady(el, d);
    el.replaceChildren(); const by = Object.fromEntries(d.data.map((r) => [r.state, r])); const sel = dash.params().state;
    const W = el.clientWidth || 600, cols = 12, rowsN = 8, gap = 4, s = Math.min(46, (W - gap * (cols - 1)) / cols), H = rowsN * (s + gap);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${cols * (s + gap)} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Market status by state: ' + d.data.map((r) => `${r.state} ${r.status}`).join(', '));
    const fill = (st) => { const r = by[st]; if (!r) return 'var(--cds-chart-grid)'; return PP.statusVar(PP.marketCls(r.status)); };
    const tip = C.tip(el);
    const g = svg.selectAll('g').data(Object.entries(C.GRID)).join('g').attr('transform', ([st, [cx, cy]]) => `translate(${cx * (s + gap)},${cy * (s + gap)})`)
      .style('cursor', 'pointer').on('click', (ev, [st]) => dash.setParams({ state: sel === st ? null : st, county: null, lead: null }))
      .on('pointermove', (ev, [st]) => { const r = by[st]; tip.show(ev, r ? `${st}: ${r.status} · ${r.counties} target count${r.counties === 1 ? 'y' : 'ies'} · ${r.opportunities} opportunities · legal file ${r.legal}` : `${st}: not started`); })
      .on('pointerleave', tip.hide);
    g.append('rect').attr('width', s).attr('height', s).attr('rx', 6).style('fill', ([st]) => fill(st)).style('fill-opacity', ([st]) => by[st] && PP.marketCls(by[st].status) ? 0.85 : 0.55)
      .style('stroke', ([st]) => st === sel ? 'var(--color-fg)' : 'none').style('stroke-width', 2);
    g.append('text').attr('x', s / 2).attr('y', s / 2 + 4).attr('text-anchor', 'middle').style('fill', ([st]) => by[st] && PP.marketCls(by[st].status) ? 'var(--color-bg)' : 'var(--color-fg)')
      .style('font-weight', 600).text(([st]) => st);
    C.legend(el, [['Live', 'var(--color-ok)'], ['Limited or research only', 'var(--color-warn)'], ['Blocked', 'var(--color-bad)'], ['Queued / not started', 'var(--cds-chart-muted)']]); });
  dash.draw('coverageHeat', (el) => { const d = dash.data('coverageLive'); if (!ok(d)) return C.notReady(el, d);
    el.replaceChildren(); if (!d.data.length) return C.empty(el, 'No live counties in this filter.');
    const types = ['probate_docket', 'legal_notices', 'parcel_owner', 'deed_index', 'tax_status', 'death_date', 'civil_docket'];
    const names = { probate_docket: 'Probate filings', legal_notices: 'Legal notices', parcel_owner: 'Property owner', deed_index: 'Deeds', tax_status: 'Taxes', death_date: 'Date of death', civil_docket: 'Civil cases' };
    const markets = [...new Set(d.data.map((r) => r.market))];
    const W = el.clientWidth || 600, lw = 120, cw = Math.max(44, (W - lw) / types.length), ch = 28, H = 34 + markets.length * (ch + 4);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${lw + cw * types.length} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Coverage by county and record type: ' + d.data.map((r) => `${r.market} ${r.record_type} ${r.status}`).join(', '));
    svg.append('g').selectAll('text').data(types).join('text').attr('x', (t, i) => lw + i * cw + cw / 2).attr('y', 14).attr('text-anchor', 'middle').text((t) => cw < 80 ? names[t].split(' ')[0] : names[t]);
    const tip = C.tip(el);
    markets.forEach((mk, j) => { const yy = 26 + j * (ch + 4);
      svg.append('text').attr('x', 0).attr('y', yy + ch / 2 + 4).text(mk);
      types.forEach((t, i) => { const r = d.data.find((x) => x.market === mk && x.record_type === t) || { status: 'untested', source: '' };
        svg.append('rect').attr('x', lw + i * cw + 2).attr('y', yy).attr('width', cw - 4).attr('height', ch).attr('rx', 4).style('fill', PP.statusVar(PP.covCls(r.status))).style('fill-opacity', PP.covCls(r.status) ? 0.85 : 0.35)
          .on('pointermove', (ev) => tip.show(ev, `${mk} · ${names[t]}: ${r.status}${r.source ? ' · ' + r.source : ''}${r.fragile === 'yes' ? ' · no backup' : ''}`)).on('pointerleave', tip.hide); }); });
    C.legend(el, [['Works', 'var(--color-ok)'], ['Broken or blocked', 'var(--color-bad)'], ['Untested', 'var(--cds-chart-muted)']]); });

  dash.draw('moneyChart', (el) => { const d = dash.data('finance'); if (!ok(d)) return C.notReady(el, d);
    C.vcols(el, d.data, { title: 'Money by month', x: (r) => r.month, series: [{ key: 'fees_earned', label: 'Fees earned', color: dash.colors[0] }, { key: 'expenses', label: 'Expenses', color: dash.colors[1] }, { key: 'fees_forecast_contracted', label: 'Fees forecast (contracted)', color: dash.colors[2] }],
      fmt: M, fmtAxis: (v) => '$' + d3.format('~s')(v), empty: 'No money has moved yet: the chart fills in as fees are earned and expenses are recorded.' }); });
  dash.draw('feePipeChart', (el) => { const d = dash.data('feePipeline'); if (!ok(d)) return C.notReady(el, d);
    C.hbars(el, d.data.filter((r) => r.deals), { title: 'Potential fees by deal progress', label: (r) => `${r.group} (${r.deals})`, value: (r) => r.fees, fmt: M, color: () => dash.colors[0], empty: 'No open opportunities in these filters.' }); });
  dash.draw('expenseChart', (el) => { const d = dash.data('expenseByCat'); if (!ok(d)) return C.notReady(el, d);
    C.hbars(el, d.data, { title: 'Expenses by category', label: (r) => r.category, value: (r) => r.amount, fmt: M, color: () => dash.colors[1], empty: 'No expenses recorded this year yet. Each one is added when its receipt or invoice is filed.' }); });
  dash.draw('runsChart', (el) => { const d = dash.data('runs'); if (!ok(d)) return C.notReady(el, d);
    C.vcols(el, d.data.slice(-14), { title: 'Leads per daily run', x: (r) => r.date.slice(5), series: [{ key: 'new_leads', label: 'New leads', color: dash.colors[0] }, { key: 'updated_leads', label: 'Updated', color: dash.colors[1] }],
      fmt: (v) => String(v), empty: 'No daily runs yet.' }); });
  dash.draw('buyersChart', (el) => { const d = dash.data('buyers'); if (!ok(d)) return C.notReady(el, d);
    C.vcols(el, d.data, { title: 'Cash buyers by market', x: (r) => `${r.county} ${r.state}`, series: [{ key: 'found', label: 'Found', color: dash.colors[0] }, { key: 'vetted', label: 'Vetted', color: dash.colors[1] }],
      fmt: (v) => String(v), empty: 'No buyer data yet.' }); });
  // Workers measure different things (estates screened vs deals analyzed), so no shared axis: one card per worker with its own yield meter.
  dash.draw('workersChart', (el) => { const d = dash.data('workers'); if (!ok(d)) return C.notReady(el, d);
    el.replaceChildren(); const grid = document.createElement('div'); grid.className = 'pp-tiles'; grid.setAttribute('role', 'list');
    const order = (r) => /^Active/.test(r.status) ? 0 : /you/i.test(r.status) ? 1 : 2;
    [...d.data].sort((a, b) => order(a) - order(b) || (+b.done || 0) - (+a.done || 0)).forEach((r) => {
      const cls = PP.workerCls(r.status); const card = document.createElement('div'); card.setAttribute('role', 'listitem');
      card.className = 'pp-card pp-tile ' + (cls === 'pp-ok' ? 'pp-t-ok' : cls === 'pp-warn' ? 'pp-t-warn' : 'pp-t-muted');
      const h = document.createElement('h3'); h.textContent = r.worker;
      const chip = document.createElement('span'); chip.className = 'pp-chip ' + cls; chip.textContent = r.status; chip.style.alignSelf = 'flex-start';
      const n = document.createElement('div'); n.className = 'pp-num'; n.style.fontSize = '1.4rem'; n.textContent = d3.format(',')(+r.done || 0);
      const l = document.createElement('div'); l.className = 'pp-lbl'; l.textContent = `${r.done_label} → ${d3.format(',')(+r.result || 0)} ${r.result_label}`;
      card.append(h, chip, n, l);
      if (r.rate) { const m = document.createElement('div'); m.className = 'pp-meter'; m.title = `Yield ${r.rate}`; const f = document.createElement('div'); f.style.width = Math.min(100, parseInt(r.rate, 10) || 0) + '%'; m.appendChild(f);
        const rl = document.createElement('div'); rl.className = 'pp-lbl'; rl.textContent = `Yield ${r.rate}`; card.append(m, rl); }
      if (r.note) { const nt = document.createElement('div'); nt.className = 'pp-lbl'; nt.textContent = r.note; card.appendChild(nt); }
      grid.appendChild(card); });
    el.appendChild(grid); });
})();
