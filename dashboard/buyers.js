/* Probate Operations dashboard: the Buyers page. Cash buyers from public deed records, their vetting, warm-up and
   letter-of-intent status (pipeline/buyers/buyers.csv, published as buyers_list.csv without contact details). */
dash.calc('buyersF', { title: 'Buyers in the filters', description: 'Cash buyers within the State/County filters and the Buyers page filters, best fit first.', inputs: ['buyers_list'],
  fn: (rows) => { const p = dash.params(); const min = +p.byMin || 0;
    return rows.filter((r) => PP.scope(r) && (!p.byStatus || r.status === p.byStatus) && (!p.byWarm || r.warmth === p.byWarm)
      && (!p.byCity || r.city === p.byCity) && (!p.byLoi || r.loi_status === p.byLoi) && (!p.bySent || r.sentiment === p.bySent) && (+r.purchases_12m || 0) >= min)
      .sort((a, b) => (+b.score || 0) - (+a.score || 0)); } });

(function () {
  const M = PP.money;
  const STAGES = [['found', 'Found in records'], ['contacted', 'Introduced'], ['confirmed', 'Buy box confirmed'], ['vetted', 'Vetted']];
  const count = (f) => { const d = dash.data('buyersF'); return d.status === 'ok' ? d.data.filter(f).length : null; };
  const tile = (f) => (el) => { const n = count(f); el.textContent = n === null ? '—' : PP.int(n); };
  dash.draw('byTotal', tile(() => true));
  dash.draw('byVetted', tile((r) => r.status === 'vetted'));
  dash.draw('byPaired', tile((r) => +r.paired_leads > 0));
  dash.draw('byChecked', tile((r) => !!(r.entity_status || r.cash_verified)));
  dash.draw('byWarm', tile((r) => r.warmth === 'warm' || r.warmth === 'hot'));
  dash.draw('byLoi', tile((r) => r.loi_status === 'signed'));
  dash.draw('byStandby', tile((r) => r.standby === 'yes'));
  dash.draw('byReady', tile((r) => /^yes/.test(r.ready_to_buy || '')));
  dash.draw('byBuys', (el) => { const d = dash.data('buyersF'); el.textContent = d.status === 'ok' ? PP.int(d3.sum(d.data, (r) => +r.purchases_12m || 0)) : '—'; });
  dash.draw('bBuyers', (el) => { const d = dash.data('buyersF'); el.textContent = d.status === 'ok' && d.data.length ? String(d.data.length) : ''; });

  const sel = (key, values, label) => (s) => {
    const d = dash.data('buyers_list'); const cur = dash.params()[key] || '';
    const vals = d.status === 'ok' ? values(d.data) : [];
    s.replaceChildren(new Option('All', ''), ...vals.map((v) => new Option(label ? label(v) : v, v)));
    s.value = vals.includes(cur) ? cur : ''; s.onchange = () => dash.setParams({ [key]: s.value || null });
  };
  const uniq = (f) => (rows) => [...new Set(rows.map(f).filter(Boolean))].sort();
  const ORDER = (list) => (rows) => list.filter((v) => rows.some((r) => r.status === v || r.warmth === v || r.loi_status === v || r.sentiment === v));
  dash.draw('byStatusSel', sel('byStatus', ORDER(['found', 'contacted', 'confirmed', 'vetted'])));
  dash.draw('byWarmSel', sel('byWarm', ORDER(['cold', 'warm', 'hot'])));
  dash.draw('byCitySel', sel('byCity', (rows) => uniq((r) => r.city)(rows.filter(PP.scope))));
  dash.draw('bySentSel', sel('bySent', ORDER(['eager', 'interested', 'neutral', 'hesitant', 'not interested'])));
  dash.draw('byLoiSel', sel('byLoi', ORDER(['none', 'sent', 'signed']), (v) => ({ none: 'Not sent', sent: 'Sent, not signed', signed: 'Signed' }[v] || v)));
  dash.draw('byMinSel', (s) => { const cur = +dash.params().byMin || 0;
    s.replaceChildren(...[0, 2, 5, 10, 20].map((v) => new Option(v ? `${v}+` : 'Any', String(v)))); s.value = String(cur);
    s.onchange = () => dash.setParams({ byMin: +s.value ? s.value : null }); });
  dash.draw('bySummary', (el) => { const v = dash.data('buyersF'), a = dash.data('buyers_list');
    el.textContent = v.status === 'ok' && a.status === 'ok' ? `${v.data.length} of ${a.data.length} buyers` : ''; });
  document.querySelectorAll('#pp-by-reset').forEach((b) => b.addEventListener('click', () => dash.setParams({ byStatus: null, byWarm: null, byCity: null, byLoi: null, bySent: null, byMin: null })));

  // Charts.
  const C = PP.chart, ok = (d) => d.status === 'ok' && Array.isArray(d.data);
  dash.draw('byFunnelChart', (el) => { const d = dash.data('buyersF'); if (!ok(d)) return C.notReady(el, d);
    const at = (i) => d.data.filter((r) => STAGES.findIndex(([k]) => k === r.status) >= i).length;
    const rows = [...STAGES.map(([, l], i) => ({ l, v: at(i) })), { l: 'Letter of intent signed', v: d.data.filter((r) => r.loi_status === 'signed').length },
      { l: 'On standby', v: d.data.filter((r) => r.standby === 'yes').length }];
    C.hbars(el, rows, { title: 'Buyers by stage', label: (r) => r.l, value: (r) => r.v, fmt: (v) => String(v), color: () => dash.colors[0], empty: 'No buyers in these filters.' }); });
  dash.draw('byMarketChart', (el) => { const d = dash.data('buyersF'); if (!ok(d)) return C.notReady(el, d);
    const rows = d3.rollups(d.data, (v) => ({ n: v.length, vetted: v.filter((r) => r.status === 'vetted').length, state: v[0].state }), (r) => `${r.county} County, ${r.state}`)
      .map(([k, o]) => ({ k, ...o })).sort((a, b) => b.n - a.n);
    C.hbars(el, rows, { title: 'Buyers by market', label: (r) => r.k, value: (r) => r.n, fmt: (v) => String(v), color: (r) => PP.stateColor(r.state),
      tip: (r) => `${r.k}: ${r.n} buyers, ${r.vetted} vetted`, empty: 'No buyers in these filters.' }); });

  // Table.
  const statusCls = (v) => v === 'vetted' ? 'pp-ok' : v === 'confirmed' || v === 'contacted' ? 'pp-warn' : '';
  const warmCls = (v) => v === 'hot' ? 'pp-ok' : v === 'warm' ? 'pp-warn' : '';
  const loiTxt = { none: 'Not sent', sent: 'Sent', signed: 'Signed' };
  dash.draw('buyerRows', (tb) => PP.rows(tb, 'buyersF', [{ f: 'score', cls: 'pp-n' }, { f: 'name' }, { f: 'city', fmt: PP.txt }, { f: 'county' }, { f: 'state' },
    { f: 'status', chip: statusCls }, { f: 'warmth', chip: warmCls }, { f: 'sentiment', chip: (v) => v === 'eager' || v === 'interested' ? 'pp-ok' : v === 'hesitant' || v === 'not interested' ? 'pp-bad' : '', fmt: (v) => v || 'unknown' },
    { f: 'max_pct_arv', fmt: (v, r) => [v ? `${v}% of ARV` : '', +r.max_assignment_fee ? `fee ≤ ${M(r.max_assignment_fee)}` : ''].filter(Boolean).join(', ') || '—' },
    { f: 'close_days_confirmed', cls: 'pp-n', fmt: (v, r) => (v || r.closes_in_days) ? `${v || r.closes_in_days} d` : '—' }, { f: 'purchases_12m', cls: 'pp-n', fmt: PP.int }, { f: 'median_price_12m', cls: 'pp-n', fmt: M },
    { f: 'price_min', fmt: (v, r) => (+v || +r.price_max) ? `${M(v)} – ${M(r.price_max)}` : '—' }, { f: 'last_purchase_date', fmt: PP.txt },
    { f: 'loi_status', chip: (v) => v === 'signed' ? 'pp-ok' : v === 'sent' ? 'pp-warn' : '', fmt: (v) => loiTxt[v] || v }, { f: 'standby', fmt: (v) => v === 'yes' ? 'Yes' : '—' },
    { f: 'ready_to_buy', chip: (v) => /^yes/.test(v || '') ? 'pp-ok' : '', fmt: (v) => /^yes/.test(v || '') ? 'Ready' : 'Not yet' },
    { f: 'red_flags', cls: (v) => v ? 'pp-bad pp-w' : 'pp-muted', fmt: (v, r) => v || (r.osint_status === 'done' ? 'none' : 'not researched') }],
  'No buyers match these filters. The Buyer-List worker adds buyers from public deed records every run.', (r) => openBuyer(r)));

  // Detail dialog.
  const dlg = document.getElementById('pp-buyer-dlg');
  const closeBtn = document.getElementById('pp-buyer-close');
  if (closeBtn) closeBtn.addEventListener('click', () => dlg.close());
  const openBuyer = (r) => {
    if (!dlg) return;
    document.getElementById('pp-buyer-title').textContent = r.name;
    const body = document.getElementById('pp-buyer-body'); body.replaceChildren();
    const section = (title, rows) => {
      const h = document.createElement('h3'); h.textContent = title; h.style.margin = '12px 0 6px';
      const dl = document.createElement('dl');
      rows.forEach(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = (v === undefined || v === null || v === '') ? '—' : v; dl.append(dt, dd); });
      body.append(h, dl);
    };
    section('Who they are', [['Type', r.entity_type], ['Market', `${r.county} County, ${r.state}`], ['Areas they buy in', r.areas], ['Business address (public record)', r.mailing_address],
      ['Based in', r.home_state || ''], ['Entity status', r.entity_status ? `${r.entity_status}${r.entity_checked_on ? ' (checked ' + r.entity_checked_on + ')' : ''}` : 'not checked yet'], ['Registered agent', r.registered_agent], ['Website', r.website],
      ['Contact details on file', r.contact_on_file === 'yes' ? 'Yes (kept in the private repo)' : 'Not yet']]);
    section('What they buy (from deed records)', [['Cash purchases, last 12 months', r.purchases_12m], ['Median price paid', +r.median_price_12m ? M(r.median_price_12m) : ''],
      ['Price range', (+r.price_min || +r.price_max) ? `${M(r.price_min)} – ${M(r.price_max)}` : ''], ['Last purchase', r.last_purchase_date],
      ['Cash confirmed (no mortgage recorded)', r.cash_verified || 'not checked yet'], ['Rehab level', r.rehab_level], ['Strategy', r.strategy], ['Closes in (days)', r.closes_in_days],
      ['Buy box notes', r.buy_box_notes]]);
    section('What they will pay and how fast they close', [['Pays up to', r.max_pct_arv ? `${r.max_pct_arv}% of after-repair value` : 'not confirmed yet'],
      ['Assignment fee they accept', +r.max_assignment_fee ? `up to ${M(r.max_assignment_fee)}` : 'not confirmed yet'], ['Earnest money they put up', +r.emd_offered ? M(r.emd_offered) : r.emd_offered],
      ['Closes in (they confirmed)', r.close_days_confirmed ? `${r.close_days_confirmed} days` : (r.closes_in_days ? `${r.closes_in_days} days (from records, not confirmed)` : '')],
      ['Deals closed with us', r.deals_closed_with_us || '0']]);
    section('Sentiment', [['How they feel about working with us', r.sentiment || 'unknown until they reply'], ['What moves them', r.sentiment_notes]]);
    section('Research (public sources)', [['End buyer or wholesaler', r.end_buyer === 'wholesaler' ? 'Another wholesaler (resells contracts): not counted as an end buyer' : r.end_buyer === 'yes' ? 'End buyer' : 'not checked yet'],
      ['Research file', r.osint_status === 'done' ? `done${r.osint_checked_on ? ' ' + r.osint_checked_on : ''}` : 'not done yet'], ['Red flags', r.red_flags || (r.osint_status === 'done' ? 'none found' : '—')],
      ['Ready to buy', r.ready_to_buy || 'not checked yet'], ['Answers emails within', r.response_hours ? `${r.response_hours} hours` : '']]);
    section('Vetting and warm-up', [['Status', r.status], ['Warmth', r.warmth], ['Proof of funds', r.proof_of_funds || 'not on file'], ['Introduction', r.intro_status || 'not sent yet'],
      ['Last contact', r.last_contact], ['Next follow-up', r.next_followup], ['Letter of intent', `${loiTxt[r.loi_status] || r.loi_status}${r.loi_signed_on ? ' on ' + r.loi_signed_on : r.loi_sent_on ? ' (sent ' + r.loi_sent_on + ')' : ''}`],
      ['On standby for our next contract', r.standby === 'yes' ? 'Yes' : 'No'], ['Fit score', r.score]]);
    section('Source', [['Found in', r.source_url], ['Checked on', r.source_date], ['Notes', r.notes]]);
    dlg.showModal();
  };
})();
