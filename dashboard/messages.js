/* Messages page and the actions on Your queues.
   Messages come from the build (messages.json: every drafted or sent message with its body, attachments and the notes
   behind it). The owner's decisions are saved in this dashboard's own store, private to the owner:
     data/users/<owner>/decisions/outreach/<lead_id>  {decision: approved | changes | rejected, note, at}
     data/users/<owner>/decisions/sign|wire/<lead_id> {decision: done | hold, note, at}
   The daily run imports them (scripts/owner_decisions.py) and acts on them; a decision is an instruction, and the
   compliance check, contact limits and attorney rules still apply before anything is sent. */
(function () {
  const PP = window.PP, C = PP.chart;
  const DEC_LABEL = { approved: 'approved by you', changes: 'changes requested', rejected: 'rejected' };
  const DECIDABLE = new Set(['draft awaiting approval', 'approved by you', 'changes requested', 'rejected']);
  const ST_CLS = (s) => s === 'sent' || s === 'approved by you' ? 'pp-ok' : s === 'draft awaiting approval' || s === 'changes requested' ? 'pp-warn' : s === 'rejected' ? 'pp-bad' : '';
  const rowsOf = (id) => { const d = dash.data(id); return d.status === 'ok' && Array.isArray(d.data) ? d.data : []; };
  const decOf = (queue, leadId) => rowsOf(queue === 'outreach' ? 'decOutreach' : queue === 'sign' ? 'decSign' : queue === 'exceptions' ? 'decExceptions' : 'decWire').find((r) => r.id === leadId) || null;
  const Q = { msg: '', cls: '', bulk: false };
  const M = { list: [], idx: -1, msg: '', cls: '' };

  // ---- data: live decisions over the built status, then the page filters ----
  dash.calc('msgAll', { title: 'Messages', description: 'Every drafted or sent message, with your saved decisions applied, within the state and county filters.', inputs: ['messages', 'decOutreach'],
    fn: (messages, decisions) => { const p = dash.params(); const by = new Map((decisions || []).map((d) => [d.id, d]));
      return (messages || []).filter((r) => (!p.state || r.state === p.state) && (!p.county || r.county === p.county)).map((r) => {
        const d = by.get(r.lead_id);
        return d && r.channel !== 'call script' && DECIDABLE.has(r.status) ? { ...r, status: DEC_LABEL[d.decision] || r.status, decision_note: d.note || '' } : r; }); } });
  dash.calc('messagesF', { title: 'Messages in the filters', description: 'Messages within the state, county, status, kind and search filters.', inputs: ['msgAll'],
    fn: (all) => { const p = dash.params(); const q = String(p.mq || '').toLowerCase();
      return all.filter((r) => (!p.mstatus || r.status === p.mstatus) && (!p.mchan || r.channel === p.mchan)
        && (!q || [r.address, r.city, r.to, r.title, r.body].some((v) => String(v || '').toLowerCase().includes(q)))); } });
  dash.calc('msgCounts', { title: 'Message counts', description: 'Messages by status within the state and county filters.', inputs: ['msgAll'],
    fn: (a) => [{ total: a.length, awaiting: a.filter((r) => r.status === 'draft awaiting approval').length, approved: a.filter((r) => r.status === 'approved by you').length,
      sent: a.filter((r) => r.status === 'sent').length, changes: a.filter((r) => r.status === 'changes requested' || r.status === 'rejected').length,
      attachments: d3.sum(a, (r) => +r.attachment_count || 0) }] });

  // ---- numbers, filters, charts ----
  const num = (src, field) => (el) => { const d = dash.data(src); el.textContent = d.status === 'ok' && d.data[0] ? PP.int(d.data[0][field]) : '—'; };
  dash.draw('mgTotal', num('msgCounts', 'total')); dash.draw('mgAwait', num('msgCounts', 'awaiting')); dash.draw('mgApproved', num('msgCounts', 'approved'));
  dash.draw('mgSent', num('msgCounts', 'sent')); dash.draw('mgChanges', num('msgCounts', 'changes')); dash.draw('mgAtt', num('msgCounts', 'attachments'));
  dash.draw('bMsgs', (el) => { const d = dash.data('msgCounts'); const v = d.status === 'ok' && d.data[0] ? d.data[0].awaiting : 0; el.textContent = v ? String(v) : ''; });
  const sel = (param, label, field) => (el) => { const vals = [...new Set(rowsOf('msgAll').map((r) => r[field]))].sort();
    el.replaceChildren(new Option(label, ''), ...vals.map((v) => new Option(v, v))); el.value = dash.params()[param] || ''; el.onchange = () => dash.setParams({ [param]: el.value || null }); };
  dash.draw('msgStatusSel', sel('mstatus', 'All statuses', 'status'));
  dash.draw('msgChanSel', sel('mchan', 'All kinds', 'channel'));
  let qTimer = null;
  document.querySelectorAll('#pp-msg-q').forEach((inp) => inp.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => dash.setParams({ mq: inp.value.trim() || null }), 250); }));

  dash.draw('msgStatusChart', (el) => { const all = rowsOf('msgAll'); const cur = dash.params().mstatus || '';
    const rows = d3.rollups(all, (v) => v.length, (r) => r.status).map(([status, n]) => ({ status, n })).sort((a, b) => b.n - a.n);
    C.hbars(el, rows, { title: 'Messages by status', label: (r) => r.status, value: (r) => r.n, fmt: (v) => String(v), selected: (r) => r.status === cur,
      color: (r) => r.status === cur ? dash.colors[0] : (cur ? 'var(--cds-chart-muted)' : dash.colors[0]), onClick: (r) => dash.setParams({ mstatus: r.status === cur ? null : r.status }),
      tip: (r) => `${r.status}: ${r.n} (click to ${r.status === cur ? 'show all' : 'show only these'})`, empty: 'No messages yet.' }); });
  dash.draw('msgStateChart', (el) => { const rows = d3.rollups(rowsOf('messagesF').filter((r) => r.channel !== 'call script'), (v) => v.length, (r) => r.state).map(([state, n]) => ({ state, n })).sort((a, b) => b.n - a.n);
    C.hbars(el, rows, { title: 'Messages by state', label: (r) => r.state, value: (r) => r.n, fmt: (v) => String(v), color: (r) => PP.stateColor(r.state), empty: 'No letters or emails in these filters.' }); });
  dash.draw('msgDayChart', (el) => { const rows = d3.rollups(rowsOf('messagesF').filter((r) => r.created), (v) => v.length, (r) => r.created).map(([day, n]) => ({ day, n })).sort((a, b) => a.day < b.day ? -1 : 1);
    C.vcols(el, rows, { title: 'Messages drafted per day', x: (r) => r.day.slice(5), series: [{ key: 'n', label: 'Messages', color: dash.colors[0] }], fmt: (v) => String(v), fmtAxis: (v) => d3.format('d')(v), empty: 'No drafting dates in these filters.' }); });
  dash.draw('msgRows', (tb) => PP.rows(tb, 'messagesF', [{ f: 'created' }, { f: 'address' }, { f: 'city' }, { f: 'state' }, { f: 'channel' }, { f: 'to', cls: 'pp-w' },
    { f: 'status', chip: (v) => ST_CLS(v) }, { f: 'attachment_count', cls: 'pp-n' }, { f: 'words', cls: 'pp-n' }], 'No messages in these filters.', (r) => PP.openMsg(r.msg_id)));

  // ---- the message popup ----
  const cur = () => M.list[M.idx] || null;
  const parse = (s) => { try { return JSON.parse(s || '[]') || []; } catch (e) { return []; } };
  const say = (t, cls) => { M.msg = t; M.cls = cls || ''; dash.draw('msgMsg'); };
  dash.draw('msgTitle', (el) => { const m = cur(); el.textContent = m ? `${m.title} · ${m.address}, ${m.city} ${m.state}` : '—'; });
  dash.draw('msgMeta', (el) => { const m = cur(); el.replaceChildren(); if (!m) return;
    [['To', m.to], ['Kind', m.channel], ['Status', m.status], ['Drafted', m.created || '—'], ['Sent', m.sent_on || '—'], ['Lead', m.lead_id], ['Deal stage', m.stage],
     ['Potential earnings', m.potential_earnings ? PP.money(m.potential_earnings) : '—'], ['Your note', m.decision_note || '—'], ['File in repo', `leads/${m.lead_id}/outreach-drafts.md`]]
      .forEach(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd');
        if (k === 'Status') { const c = document.createElement('span'); c.className = 'pp-chip ' + ST_CLS(v); c.textContent = v; dd.appendChild(c); } else dd.textContent = v; el.append(dt, dd); }); });
  dash.draw('msgLeadNote', (el) => { const m = cur(); const first = m ? rowsOf('messages').find((r) => r.lead_id === m.lead_id && r.lead_note) : null; el.textContent = first ? first.lead_note : ''; });
  dash.draw('msgBody', (el) => { const m = cur(); el.textContent = m ? m.body : '—'; });
  dash.draw('msgAtts', (el) => { const m = cur(); el.replaceChildren(); if (!m) return; const atts = parse(m.attachments);
    if (!atts.length) { const p = document.createElement('p'); p.className = 'pp-sub'; p.textContent = 'No attachments. This message goes on its own.'; el.appendChild(p); return; }
    atts.forEach((a) => { const d = document.createElement('details'); d.className = 'pp-att'; const s = document.createElement('summary'); s.textContent = `📎 ${a.name}  (${a.file})${a.found ? '' : ' · missing from the repo'}`;
      const pre = document.createElement('pre'); pre.textContent = a.text || (a.found ? 'This file type can\'t be shown here; open it in the repo.' : 'The file is listed but missing.'); d.append(s, pre); el.appendChild(d); }); });
  dash.draw('msgRefs', (el) => { const m = cur(); el.replaceChildren(); if (!m) return; const first = rowsOf('messages').find((r) => r.lead_id === m.lead_id && parse(r.references).length);
    const refs = first ? parse(first.references) : [];
    if (!refs.length) { const p = document.createElement('p'); p.className = 'pp-sub'; p.textContent = 'No notes for this lead.'; el.appendChild(p); return; }
    refs.forEach((a) => { const d = document.createElement('details'); d.className = 'pp-att'; const s = document.createElement('summary'); s.textContent = `${a.name} (${a.file})`;
      const pre = document.createElement('pre'); pre.textContent = a.text; d.append(s, pre); el.appendChild(d); }); });
  dash.draw('msgDecideState', (el) => { const m = cur(); el.replaceChildren(); if (!m) return; const d = decOf('outreach', m.lead_id);
    const c = document.createElement('span'); c.className = 'pp-chip ' + (d ? ST_CLS(DEC_LABEL[d.decision]) : 'pp-warn');
    c.textContent = d ? `Your decision for this lead: ${DEC_LABEL[d.decision]}${d.at ? ' on ' + String(d.at).slice(0, 10) : ''}. The next daily run acts on it.` : (DECIDABLE.has(m.status) ? 'Waiting for your decision.' : '');
    if (c.textContent) el.appendChild(c); });
  dash.draw('msgMsg', (el) => { el.textContent = M.msg; el.className = 'pp-dlg-msg ' + M.cls; });

  const refresh = () => { const m = cur(); document.querySelectorAll('#pp-msg-actions').forEach((a) => { a.hidden = !m || !DECIDABLE.has(m.status); });
    document.querySelectorAll('#pp-msg-prev').forEach((b) => { b.disabled = M.idx <= 0; }); document.querySelectorAll('#pp-msg-next').forEach((b) => { b.disabled = M.idx >= M.list.length - 1; });
    document.querySelectorAll('#pp-msg-note').forEach((t) => { const d = m ? decOf('outreach', m.lead_id) : null; t.value = d && d.note ? d.note : ''; });
    ['msgTitle', 'msgMeta', 'msgLeadNote', 'msgBody', 'msgAtts', 'msgRefs', 'msgDecideState', 'msgMsg'].forEach((n) => dash.draw(n)); };
  PP.openMsg = (msgId, leadId) => {
    M.list = rowsOf('messagesF'); M.idx = M.list.findIndex((r) => msgId ? r.msg_id === msgId : r.lead_id === leadId && r.channel !== 'call script');
    if (M.idx < 0) { M.list = rowsOf('msgAll'); M.idx = M.list.findIndex((r) => msgId ? r.msg_id === msgId : r.lead_id === leadId && r.channel !== 'call script'); }
    if (M.idx < 0) return false;
    M.msg = ''; refresh();
    document.querySelectorAll('#pp-msg').forEach((d) => { if (!d.open) { if (d.showModal) d.showModal(); else d.open = true; } });
    return true;
  };
  const step = (k) => { const n = M.idx + k; if (n >= 0 && n < M.list.length) { M.idx = n; M.msg = ''; refresh(); } };
  document.querySelectorAll('#pp-msg-prev').forEach((b) => b.addEventListener('click', () => step(-1)));
  document.querySelectorAll('#pp-msg-next').forEach((b) => b.addEventListener('click', () => step(1)));
  document.querySelectorAll('#pp-msg-close').forEach((b) => b.addEventListener('click', () => document.querySelectorAll('#pp-msg').forEach((d) => d.open && d.close())));

  // ---- saving a decision ----
  const BANNED = /(^|[^\d-])\d{9,19}(?![\d-])|\b(routing|aba|iban|swift|bic|account\s*(no|number|#)|acct|password|api[\s_-]?key|secret|token)\b/i;
  PP.decide = async (queue, leadId, decision, note) => {
    note = String(note || '').trim().slice(0, 500);
    if (BANNED.test(note)) throw new Error('The note looks like bank details or a secret; that is never stored.');
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    if (!db || !user) throw new Error("Saving isn't available here.");
    const uid = await user.id();
    await db.doc(`data/users/${uid}/decisions/${queue}/${leadId}`).set({ decision, note, at: new Date().toISOString() });
  };
  const decideFromPopup = async (decision) => {
    const m = cur(); if (!m) return; const note = (document.querySelector('#pp-msg-note') || {}).value || '';
    if (decision === 'changes' && !note.trim()) return say('Write what should change in the note, then press Request changes.', 'pp-bad');
    say('Saving…');
    try { await PP.decide('outreach', m.lead_id, decision, note);
      say(decision === 'approved' ? 'Approved. The next daily run checks it for compliance and sends it, or queues it for mailing.' : decision === 'changes' ? 'Sent back for changes. The team redrafts it and it comes back to your queue.' : 'Rejected. No outreach to this lead; it leaves your queue at the next run.', 'pp-ok');
    } catch (e) { say(e && e.message && !/denied|permission/i.test(e.message) ? e.message : "That wasn't saved: only the dashboard's owner can decide.", 'pp-bad'); }
  };
  document.querySelectorAll('#pp-msg-approve').forEach((b) => b.addEventListener('click', () => decideFromPopup('approved')));
  document.querySelectorAll('#pp-msg-changes').forEach((b) => b.addEventListener('click', () => decideFromPopup('changes')));
  document.querySelectorAll('#pp-msg-reject').forEach((b) => b.addEventListener('click', () => decideFromPopup('rejected')));

  // ---- Your queues: decisions and actions on each row, and approve-all ----
  const QK = { 'Approve outreach': 'outreach', Sign: 'sign', Wire: 'wire' };
  const qDecision = (r) => { const d = decOf(QK[r.queue], r.lead_id); return d ? d.decision : (r.decision || ''); };
  const qLabel = (r, dec) => !dec ? 'waiting for you' : r.queue === 'Approve outreach' ? DEC_LABEL[dec] : dec === 'done' ? 'done' : 'on hold';
  const qSay = (t, cls) => { Q.msg = t; Q.cls = cls || ''; dash.draw('qMsg'); dash.draw('moMsg'); };
  dash.draw('qMsg', (el) => { el.textContent = Q.msg; el.className = 'pp-dlg-msg ' + Q.cls; });
  dash.draw('moMsg', (el) => { el.textContent = Q.msg; el.className = 'pp-dlg-msg ' + Q.cls; });
  const MONEYQ = (r) => r.queue === 'Sign' || r.queue === 'Wire';
  const act = async (r, decision, btn) => {
    btn.disabled = true;
    try { await PP.decide(QK[r.queue], r.lead_id, decision, ''); qSay(`Saved: ${r.address} ${qLabel(r, decision)}. The next daily run acts on it.`, 'pp-ok'); }
    catch (e) { btn.disabled = false; qSay("That wasn't saved: only the dashboard's owner can decide.", 'pp-bad'); }
  };
  const qTable = (keep, empty) => (tb) => {
    const d = dash.data('queuesF'); tb.replaceChildren();
    const msg = (t) => { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = 8; td.textContent = t; td.className = 'pp-muted'; };
    if (d.status !== 'ok') return msg(d.status === 'error' ? 'Failed to load' : 'Loading…');
    const rows = d.data.filter(keep);
    if (!rows.length) return msg(empty);
    rows.forEach((r) => {
      const tr = tb.insertRow(); const dec = qDecision(r);
      [r.queue, r.address, r.city, r.state, r.item, r.due].forEach((v, i) => { const td = tr.insertCell(); td.textContent = v || ''; if (i === 4) td.className = 'pp-w'; });
      const tdD = tr.insertCell(); const c = document.createElement('span'); c.className = 'pp-chip ' + (!dec ? 'pp-warn' : dec === 'rejected' ? 'pp-bad' : dec === 'hold' || dec === 'changes' ? '' : 'pp-ok'); c.textContent = qLabel(r, dec); tdD.appendChild(c);
      const tdA = tr.insertCell(); const box = document.createElement('div'); box.className = 'pp-act';
      const btn = (t, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pp-btn ' + (cls || ''); b.textContent = t; b.onclick = (e) => { e.stopPropagation(); fn(b); }; box.appendChild(b); return b; };
      if (r.queue === 'Approve outreach') {
        btn('Read', '', () => { if (!PP.openMsg(null, r.lead_id)) qSay('The message for this lead appears after the next data refresh.', ''); });
        if (dec !== 'approved') btn('Approve', 'pp-btn-primary', (b) => act(r, 'approved', b));
        if (dec !== 'rejected') btn('Reject', '', (b) => { if (b.dataset.armed) return act(r, 'rejected', b); b.dataset.armed = '1'; b.textContent = 'Confirm reject'; });
      } else {
        if (r.queue === 'Sign' && /^https:\/\//.test(r.sign_url || '')) btn('Sign now', 'pp-btn-primary', () => window.open(r.sign_url, '_blank', 'noopener'));
        if (dec !== 'done') btn(r.queue === 'Sign' ? 'I signed it' : 'I wired it (confirmed by phone)', r.queue === 'Sign' && /^https:\/\//.test(r.sign_url || '') ? '' : 'pp-btn-primary', (b) => act(r, 'done', b));
        if (dec !== 'hold') btn('Hold', '', (b) => act(r, 'hold', b));
        btn('Open deal', '', () => PP.openDeal(r));
      }
      tdA.appendChild(box);
    });
  };
  dash.draw('queueRows', qTable((r) => !MONEYQ(r), 'Nothing waiting on you here.'));
  dash.draw('moneyQueueRows', qTable(MONEYQ, 'Nothing to sign or wire right now. Contracts and deposits appear here as deals reach them.'));
  // ---- Exceptions: the Exceptions Desk's items; owner picks an option where one is needed ----
  const E = { msg: '', cls: '' };
  dash.draw('exMsg', (el) => { el.textContent = E.msg; el.className = 'pp-dlg-msg ' + E.cls; });
  const eSay = (t, cls) => { E.msg = t; E.cls = cls || ''; dash.draw('exMsg'); };
  dash.draw('exRows', (tb) => {
    const d = dash.data('exceptions'); tb.replaceChildren();
    const msg = (t) => { const tr = tb.insertRow(); const td = tr.insertCell(); td.colSpan = 7; td.textContent = t; td.className = 'pp-muted'; };
    if (d.status !== 'ok') return msg(d.status === 'error' ? 'Failed to load' : 'Loading…');
    const rows = d.data.filter((r) => r.status !== 'resolved');
    if (!rows.length) return msg('No open exceptions.');
    rows.forEach((r) => {
      const tr = tb.insertRow(); const key = String(r.id).toLowerCase(); const dd = decOf('exceptions', key); const dec = dd ? dd.decision : (r.decision || '');
      [r.id, r.type, r.property || r.lead_id || '—'].forEach((v) => { tr.insertCell().textContent = v || ''; });
      const st = tr.insertCell(); const c = document.createElement('span'); const mine = r.owner_needed === 'yes';
      c.className = 'pp-chip ' + (mine && !dec ? 'pp-warn' : ''); c.textContent = mine ? (dec ? 'you chose ' + dec.toUpperCase() : 'needs your decision') : (r.status || 'open'); st.appendChild(c);
      const w = tr.insertCell(); w.className = 'pp-w'; w.textContent = mine && r.recommendation ? 'Recommended: ' + r.recommendation : (r.actions || r.playbook || '');
      tr.insertCell().textContent = r.due || '';
      const a = tr.insertCell();
      if (!mine) { a.textContent = 'Handled by the team'; a.className = 'pp-muted'; return; }
      const box = document.createElement('div'); box.className = 'pp-act';
      String(r.options || '').split('|').map((x) => x.trim()).filter(Boolean).forEach((opt) => {
        const k = opt.slice(0, 1).toLowerCase(); if (!'abc'.includes(k)) return;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'pp-btn' + (dec === k ? ' pp-btn-primary' : ''); b.textContent = opt; b.title = opt;
        b.onclick = async () => { b.disabled = true; try { await PP.decide('exceptions', key, k, ''); eSay(`Saved: ${r.id} option ${k.toUpperCase()}. The next run carries it out.`, 'pp-ok'); } catch (e) { b.disabled = false; eSay("That wasn't saved: only the dashboard's owner can decide.", 'pp-bad'); } };
        box.appendChild(b); });
      const o = document.createElement('button'); o.type = 'button'; o.className = 'pp-btn'; o.textContent = 'Other…';
      o.onclick = async () => { const note = window.prompt(`${r.id}: what should the team do instead?`); if (!note || !note.trim()) return;
        try { await PP.decide('exceptions', key, 'other', note); eSay(`Saved your instruction for ${r.id}. The next run carries it out.`, 'pp-ok'); } catch (e) { eSay(e && e.message && !/denied|permission/i.test(e.message) ? e.message : "That wasn't saved: only the dashboard's owner can decide.", 'pp-bad'); } };
      box.appendChild(o); a.appendChild(box);
    });
  });
  const pendingOutreach = () => rowsOf('queuesF').filter((r) => r.queue === 'Approve outreach' && !qDecision(r));
  dash.draw('qBulkLabel', (el) => { const n = pendingOutreach().length; el.textContent = Q.bulk ? `Approve all ${n} outreach items shown?` : n ? `${n} outreach items shown have no decision yet` : 'No outreach waiting for a decision in these filters'; });
  const bulkUI = (on) => { Q.bulk = on; document.querySelectorAll('#pp-q-all').forEach((b) => { b.hidden = on; }); document.querySelectorAll('#pp-q-all-yes, #pp-q-all-no').forEach((b) => { b.hidden = !on; }); dash.draw('qBulkLabel'); };
  document.querySelectorAll('#pp-q-all').forEach((b) => b.addEventListener('click', () => { if (pendingOutreach().length) bulkUI(true); else qSay('Nothing to approve in these filters.', ''); }));
  document.querySelectorAll('#pp-q-all-no').forEach((b) => b.addEventListener('click', () => bulkUI(false)));
  document.querySelectorAll('#pp-q-all-yes').forEach((b) => b.addEventListener('click', async () => {
    const items = pendingOutreach(); bulkUI(false); let ok = 0;
    qSay(`Approving ${items.length}…`);
    for (const r of items) { try { await PP.decide('outreach', r.lead_id, 'approved', 'Approved with approve-all'); ok++; } catch (e) { break; } }
    qSay(ok === items.length ? `Approved ${ok}. The next daily run checks each for compliance before anything is mailed.` : `Approved ${ok} of ${items.length}; the rest weren't saved (only the dashboard's owner can decide).`, ok === items.length ? 'pp-ok' : 'pp-bad');
  }));
})();
