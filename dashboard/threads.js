/* Conversations (Messages page): every letter, email and reply on a lead, in order, with what each worker did between
   them. Built from leads/<id>/thread.csv (real) and simulations/<id>/thread.csv (labelled SIMULATION). */
(function () {
  const PP = window.PP;
  const all = () => { const d = dash.data('conversations'); return d.status === 'ok' && Array.isArray(d.data) ? d.data : []; };
  const threads = () => { const m = new Map(); all().forEach((r) => { if (!m.has(r.thread)) m.set(r.thread, r); }); return [...m.values()]; };
  const label = (r) => `${r.simulation === 'yes' ? 'SIMULATION · ' : ''}${r.address || r.lead_id}${r.scenario ? ' · ' + r.scenario : ''}`.trim();
  const SIDE = { out: 'We sent', in: 'Received', internal: 'Worker step', owner: 'You' };

  dash.draw('convSel', (sel) => {
    const t = threads(); const cur = dash.params().conv || (t[0] && t[0].thread) || '';
    sel.replaceChildren(...t.map((r) => new Option(label(r), r.thread)));
    sel.value = cur; sel.onchange = () => dash.setParams({ conv: sel.value || null });
  });
  dash.draw('convSum', (el) => {
    const t = threads(); const cur = dash.params().conv || (t[0] && t[0].thread);
    const rows = all().filter((r) => r.thread === cur);
    if (!rows.length) { el.textContent = 'No conversations yet. Each letter, email, reply and worker step on a lead appears here as it happens.'; return; }
    const c = (d) => rows.filter((r) => r.dir === d).length;
    el.textContent = `${rows.length} steps: ${c('out')} sent, ${c('in')} received, ${c('internal')} worker steps, ${c('owner')} for you` +
      (rows[0].simulation === 'yes' ? '. This is a simulation: the replies are made up to show how the workers handle this path. Pick another scenario above to see the other branches.' : '.');
  });
  dash.draw('convThread', (box) => {
    const t = threads(); const cur = dash.params().conv || (t[0] && t[0].thread);
    const rows = all().filter((r) => r.thread === cur);
    box.replaceChildren();
    rows.forEach((r) => {
      const item = document.createElement('div'); item.className = `pp-cv pp-cv-${r.dir || 'internal'}`;
      const head = document.createElement('div'); head.className = 'pp-cv-head';
      const who = document.createElement('b'); who.textContent = `${SIDE[r.dir] || r.dir}${r.who && r.who !== 'You' ? ' · ' + r.who : ''}`;
      const meta = document.createElement('span'); meta.textContent = [r.at, r.channel, r.worker && `by ${r.worker}`, r.stage && `stage: ${r.stage}`].filter(Boolean).join(' · ');
      head.append(who, meta);
      const body = document.createElement('div'); body.className = 'pp-cv-body'; body.textContent = r.text;
      item.append(head, body);
      if (r.note) { const n = document.createElement('div'); n.className = 'pp-cv-note'; n.textContent = r.note; item.appendChild(n); }
      box.appendChild(item);
    });
  });
})();
