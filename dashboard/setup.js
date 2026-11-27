/* Setup page: one card per area, each with a Configure popup. What the owner saves goes to this dashboard's own store
   (data/users/<owner>/setup/areas/<area>), never the repo, so pushes don't clear it; the daily run imports it
   (scripts/owner_settings.py), which refuses the same things this form refuses. Bank details, card numbers, passwords
   and API keys are never accepted. Services that need a sign-in are connected in Claude's settings, not here. */
(function () {
  const PP = window.PP;
  const S = (PP.setup = { area: null, title: '', kind: '', research: false, msg: '', msgCls: '' });
  const KIND = (id) => id === 'business' || id === 'channels' || id === 'autonomy' ? id : (/^market-/.test(id || '') ? 'market' : '');
  const AREA_ID = { 'Business identity': 'business', Channels: 'channels', Autonomy: 'autonomy' };
  const BANNED = [
    [/(^|[^\d-])\d{9,19}(?![\d-])/, 'a long number (bank account, routing or card number)'],
    [/\b(routing|aba|iban|swift|bic|account\s*(no|number|#)|acct|sort\s*code)\b/i, 'bank details'],
    [/\b(password|passwd|api[\s_-]?key|secret|token|bearer)\b/i, 'a password or key'],
    [/\b(sk|pk|rk|re|key)_[A-Za-z0-9]{12,}/, 'an API key'],
  ];
  const saved = (id) => { const d = dash.data('ownerSettings'); return d.status === 'ok' ? (d.data || []).find((r) => r.id === id) || null : null; };
  // A setting saved on this page shows at once: "saved" until the daily run applies it, then the run's own status.
  const BIZ = ['legal_name', 'entity_state', 'mailing_address', 'phone', 'email', 'website', 'signer', 'title_company', 'insurance'];
  // A service key saved on this page switches its channel on at the next run.
  const CH_KEY = { mail_sending: 'LOB_API_KEY', email_sending: 'RESEND_API_KEY', esignature: 'DOCUSEAL_API_KEY' };
  const live = (r) => {
    if (r.status === 'done') return r;
    const keys = (window.PP && PP.aiKeys) || {};
    if (r.area_id === 'channels' && CH_KEY[r.item_key] && keys[CH_KEY[r.item_key]] && keys[CH_KEY[r.item_key]].set) return { ...r, status: 'key saved, checked at next run' };
    const s = saved(r.area_id); if (!s) return r;
    const k = r.item_key, on = (v) => v === true || v === 'true';
    if (r.area_id === 'business' && BIZ.includes(k) && String(s[k] || '').trim()) return { ...r, status: 'saved, applies at next run' };
    if (r.area_id === 'autonomy' && s.outreach === 'autonomous' && on(s.confirmed)) return { ...r, status: 'saved, applies at next run' };
    if (r.area_id === 'channels' && on(s[`${k}_ready`])) return { ...r, status: k === 'field_inspections' ? 'done' : 'waiting for check' };
    if (/^market-/.test(r.area_id || '') && ((k === 'approved_on' && s.approved_on) || (k === 'licensed_or_partnered' && on(s.licensed_or_partnered)))) return { ...r, status: 'waiting for check' };
    return r;
  };
  const areaRows = () => { const d = dash.data('readiness'); return d.status === 'ok' ? d.data.map(live) : []; };
  // Overall progress: done, plus what you've saved that the next run confirms (it updates as you save).
  dash.draw('setupBar', (el) => { const rows = areaRows(); const done = rows.filter((r) => r.status === 'done').length;
    const pend = rows.filter((r) => r.status !== 'done' && r.status !== 'missing').length;
    const n = rows.length || 1, solid = done + pend ? Math.round(100 * done / (done + pend)) : 100;
    el.style.width = Math.round(100 * (done + pend) / n) + '%';
    el.style.background = `linear-gradient(90deg, var(--pp-tile, var(--pp-accent)) ${solid}%, color-mix(in srgb, var(--pp-tile, var(--pp-accent)) 40%, transparent) ${solid}%)`;
    if (el.parentElement) el.parentElement.setAttribute('aria-valuenow', String(rows.length ? Math.round(100 * done / rows.length) : 0)); });
  dash.draw('setupBarLabel', (el) => { const rows = areaRows(); if (!rows.length) { el.textContent = '—'; return; }
    const done = rows.filter((r) => r.status === 'done').length, miss = rows.filter((r) => r.status === 'missing').length, pend = rows.length - done - miss;
    el.textContent = `${done} of ${rows.length} setup steps done (${Math.round(100 * done / rows.length)}%)` + (pend ? `, ${pend} saved or in progress (lighter bar), confirmed at the next run` : '') + `. ${miss} still to do; each one you finish turns its row green.`; });
  const redrawSetup = () => ['setupBar', 'setupBarLabel', 'setupCards', 'readyRows'].forEach((n) => dash.draw(n));
  window.addEventListener('pp-setup-saved', redrawSetup);
  window.addEventListener('pp-keys', redrawSetup);
  const say = (msg, cls) => { S.msg = msg; S.msgCls = cls || ''; dash.draw('cfgMsg'); };

  // ---- area cards ----
  dash.draw('setupCards', (el) => {
    const d = dash.data('readiness');
    if (d.status !== 'ok') { el.replaceChildren(); const p = document.createElement('p'); p.className = 'pp-sub'; p.textContent = d.status === 'error' ? 'Failed to load' : 'Loading…'; el.appendChild(p); return; }
    const groups = d3.groups(d.data.map(live), (r) => r.area);
    el.replaceChildren(...groups.map(([area, items]) => {
      const id = items[0].area_id || AREA_ID[area] || '';
      const done = items.filter((r) => r.status === 'done').length, total = items.length, pct = total ? 100 * done / total : 0;
      const pend = items.filter((r) => r.status !== 'done' && r.status !== 'missing').length;
      const card = document.createElement('div'); card.className = `pp-card pp-tile pp-area-card ${done === total ? 'pp-t-ok' : 'pp-t-warn'}`; card.id = 'setup-' + (id || area.replace(/\W+/g, '-').toLowerCase());
      const row = document.createElement('div'); row.className = 'pp-row';
      const h = document.createElement('h3'); h.textContent = area;
      const n = document.createElement('span'); n.className = 'pp-sub'; n.style.margin = '0'; n.textContent = `${done} of ${total} done` + (pend ? ` · ${pend} saved or being checked` : '');
      row.append(h, n);
      const m = document.createElement('div'); m.className = 'pp-meter'; m.setAttribute('role', 'progressbar'); m.setAttribute('aria-label', `${area}: ${done} of ${total} done`);
      const f = document.createElement('div'); f.style.width = pct + '%'; m.appendChild(f);
      const ul = document.createElement('ul');
      items.forEach((r) => { const li = document.createElement('li'); const a = document.createElement('span'); a.textContent = r.item;
        const c = document.createElement('span'); c.className = 'pp-chip ' + (r.status === 'done' || /^saved/.test(r.status) ? 'pp-ok' : r.status === 'missing' ? 'pp-warn' : ''); c.textContent = r.status; li.append(a, c); ul.appendChild(li); });
      const s = saved(id);
      const foot = document.createElement('div'); foot.className = 'pp-row';
      const when = document.createElement('span'); when.className = 'pp-sub'; when.style.margin = '0'; when.textContent = s && s.saved_at ? `Saved ${String(s.saved_at).slice(0, 10)}` : 'Nothing saved yet';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pp-btn pp-btn-primary'; b.textContent = 'Configure';
      if (id === 'signing') { b.textContent = 'Runs on its own'; b.className = 'pp-btn'; b.disabled = true; b.title = 'The Legal Advisor handles this; you only sign the resolution when it reaches your Sign queue'; }
      else if (!KIND(id)) { b.disabled = true; b.title = 'Available after the next data refresh'; }
      b.onclick = () => PP.openSetup(id, area, items.some((r) => r.item_key === 'licensed_or_partnered'));
      foot.append(when, b);
      card.append(row, m, ul, foot);
      return card;
    }));
  });

  // ---- popup ----
  dash.draw('cfgTitle', (el) => { el.textContent = S.title ? `Configure: ${S.title}` : '—'; });
  dash.draw('cfgItems', (el) => {
    el.replaceChildren(...areaRows().filter((r) => S.title && r.area === S.title).map((r) => {
      const li = document.createElement('li'); const c = document.createElement('span');
      c.className = 'pp-chip ' + (r.status === 'done' ? 'pp-ok' : r.status === 'missing' ? 'pp-warn' : ''); c.textContent = `${r.item}: ${r.status}`; li.appendChild(c); return li; }));
  });
  dash.draw('chStatus', (el) => {
    const r = areaRows().find((x) => x.area_id === 'channels' && x.item_key === el.dataset.ch);
    el.replaceChildren(); const c = document.createElement('span');
    c.className = 'pp-chip ' + (!r ? '' : r.status === 'done' ? 'pp-ok' : r.status === 'missing' ? 'pp-warn' : '');
    c.textContent = !r ? 'Status after the next data refresh' : r.status === 'done' ? 'Working (tested by the daily run)' : r.status === 'missing' ? 'Not set up' : 'Waiting for the daily run to test it';
    el.appendChild(c);
  });
  dash.draw('cfgMsg', (el) => { el.textContent = S.msg; el.className = 'pp-dlg-msg ' + S.msgCls; });

  const dlg = () => document.querySelector('#pp-cfg');
  const form = () => document.querySelector('#pp-cfg-form');
  const fieldsOf = (kind) => [...document.querySelectorAll(`#pp-cfg .pp-area[data-area="${kind}"] [name]`)];

  PP.openSetup = (id, title, research) => {
    const kind = KIND(id); if (!kind) return;
    Object.assign(S, { area: id, title, kind, research, msg: '', msgCls: '' });
    document.querySelectorAll('#pp-cfg .pp-area').forEach((a) => { a.hidden = a.dataset.area !== kind; });
    document.querySelectorAll('#pp-cfg .pp-licence').forEach((f) => { f.hidden = !(kind === 'market' && research); });
    const s = saved(id) || {};
    fieldsOf(kind).forEach((inp) => {
      const v = s[inp.name];
      if (inp.type === 'checkbox') inp.checked = v === true || v === 'true';
      else if (inp.tagName === 'SELECT') inp.value = v || (inp.name === 'outreach' ? 'drafts_only' : '');
      else inp.value = v == null ? '' : String(v);
    });
    ['cfgTitle', 'cfgItems', 'cfgMsg', 'chStatus'].forEach((n) => dash.draw(n));
    const d = dlg(); if (d && !d.open) { if (d.showModal) d.showModal(); else d.open = true; }
  };
  const close = () => { const d = dlg(); if (d && d.open) d.close(); S.title = ''; };

  const collect = () => {
    const out = {}, errs = [];
    fieldsOf(S.kind).forEach((inp) => {
      if (inp.closest('[hidden]') && inp.closest('.pp-licence')) return;
      if (inp.type === 'checkbox') { out[inp.name] = inp.checked; return; }
      const v = String(inp.value || '').trim(); out[inp.name] = v;
      if (!v) return;
      if (v.length > 200) errs.push(`${inp.name}: too long`);
      if (inp.name !== 'phone') BANNED.forEach(([rx, what]) => { if (rx.test(v)) errs.push(`"${inp.closest('label') ? inp.closest('label').firstChild.textContent.trim() : inp.name}" looks like ${what}. That is never stored here.`); });
      if (inp.name === 'phone' && !/^\+?[0-9 ().-]{7,20}$/.test(v)) errs.push('Business phone: not a phone number.');
      if (inp.name === 'email' && !/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(v)) errs.push('Business email: not an email address.');
      if (inp.name === 'website' && !/^https?:\/\/\S+$/.test(v)) errs.push('Website: must start with https://');
      if (inp.name === 'approved_on' && !/^20\d\d-[01]\d-[0-3]\d$/.test(v)) errs.push('Approval date: use the date picker.');
    });
    if (S.kind === 'autonomy' && out.outreach === 'autonomous' && !(out.confirmed && String(out.confirm_text).toUpperCase() === 'AUTHORIZE'))
      errs.push('To switch to autonomous, tick the authorization box and type AUTHORIZE.');
    if (S.kind === 'market' && out.approved_on && !out.attorney_name) errs.push("Add the attorney's name with the approval date.");
    return { out, errs };
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!S.area) return;
    const { out, errs } = collect();
    if (errs.length) return say(errs.join(' '), 'pp-bad');
    say('Saving…');
    try {
      const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
      if (!db || !user) throw new Error('unavailable');
      const uid = await user.id();
      await db.doc(`data/users/${uid}/setup/areas/${S.area}`).set({ ...out, saved_at: new Date().toISOString() });
      window.dispatchEvent(new Event('pp-setup-saved'));   // the Full autonomy count updates right away
      say('Saved. The next daily run applies it, and this card updates after that run.', 'pp-ok');
    } catch (e) {
      say("That wasn't saved: only the dashboard's owner can save setup settings. Nothing was changed.", 'pp-bad');
    }
  };
  document.querySelectorAll('#pp-cfg-form').forEach((f) => f.addEventListener('submit', onSubmit));
  document.querySelectorAll('#pp-cfg-close, #pp-cfg-cancel').forEach((b) => b.addEventListener('click', close));
  document.querySelectorAll('#pp-cfg').forEach((d) => d.addEventListener('close', () => { S.title = ''; }));
})();
