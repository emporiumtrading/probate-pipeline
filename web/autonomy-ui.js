/* autonomy-ui.js — the "Full autonomy" switch at the top of the dashboard.
   Flipping it on runs the server's pre-flight check (/api/autonomy): if anything
   is missing, a window lists it with how to fix it; if nothing is, a window
   confirms what runs without you and what always stays yours. */
(function () {
  'use strict';
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    for (const c of kids) if (c) e.append(c);
    return e;
  };
  const api = async (url, body) => {
    const r = await fetch(url, body ? { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { credentials: 'same-origin' });
    let j = null; try { j = await r.json(); } catch { /* not json */ }
    return { ok: r.ok, status: r.status, j };
  };

  const dlg = h('dialog', { id: 'fa-dialog', style: 'max-width:640px;border:1px solid #ccc;border-radius:12px;padding:20px' });
  const openDialog = (...kids) => { dlg.replaceChildren(...kids); if (!dlg.open) dlg.showModal(); };
  const close = () => h('button', { type: 'button', class: 'pp-btn', text: 'Close', onclick: () => dlg.close() });
  const list = (items) => h('ul', {}, ...items.map((x) => h('li', { style: 'margin:6px 0' }, h('b', { text: `${x.area}: ${x.item}` }), h('br'), h('span', { class: 'pp-sub', text: x.fix }))));

  const bar = h('div', { id: 'fa-bar', role: 'region', 'aria-label': 'Full autonomy', style: 'display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid #e5e5e5;background:#fafaf7' });

  const showMissing = (c) => openDialog(
    h('h2', { text: 'Not ready for full autonomy yet' }),
    h('p', { text: `${c.blocking.length} thing${c.blocking.length === 1 ? '' : 's'} must be done first. Most run on their own once you've given the keys and details below.` }),
    list(c.blocking),
    c.limited.length ? h('details', {}, h('summary', { text: `${c.limited.length} more that only limit a market or are optional (they don't block the switch)` }), list(c.limited)) : null,
    h('div', { style: 'margin-top:12px' }, close()));

  const showConfirm = (c, refresh) => openDialog(
    h('h2', { text: 'Turn on full autonomy?' }),
    h('p', { text: 'Every check passed. With this on, the system and its workers run the whole pipeline without you: finding leads, research, legal checks, letters and email, replies, negotiation up to each deal\'s maximum offer, contracts, buyers, title and closing. Problems are handled by the workers and the Exceptions Desk, not sent to you.' }),
    h('p', { text: `You'll only hear from us, at ${c.notifyEmail}, when something needs your signature or an escrow to confirm by phone, when a deposit is confirmed, and when a deal closes with its profit.` }),
    h('p', { text: 'Always yours, by law and for your safety:' }), h('ul', {}, ...c.keep.map((k) => h('li', { text: k }))),
    c.limited.length ? h('details', {}, h('summary', { text: `Not yet running: ${c.limited.length} item${c.limited.length === 1 ? '' : 's'} that limit a market` }), list(c.limited)) : null,
    h('div', { style: 'display:flex;gap:8px;margin-top:12px' },
      h('button', { type: 'button', class: 'pp-btn pp-btn-primary', text: 'Turn on full autonomy', onclick: async (e) => {
        e.target.disabled = true;
        const r = await api('/api/autonomy', { on: true });
        if (r.ok) { dlg.close(); refresh(); } else if (r.j && r.j.check) showMissing(r.j.check); else { e.target.disabled = false; alert(`Couldn't turn it on (${r.status}).`); }
      } }), close()));

  const render = async () => {
    const r = await api('/api/autonomy');
    if (!r.ok) { bar.replaceChildren(h('span', { class: 'pp-sub', text: `Full autonomy status unavailable (${r.status}).` })); return; }
    const c = r.j;
    const sw = h('input', { type: 'checkbox', role: 'switch', id: 'fa-switch', 'aria-checked': String(c.on) });
    sw.checked = c.on;
    sw.addEventListener('change', async () => {
      sw.checked = c.on; // the dialogs decide
      if (c.on) {
        openDialog(h('h2', { text: 'Turn off full autonomy?' }),
          h('p', { text: 'The workers go back to asking you about exceptions. Runs, letters within the market approvals, and replies keep going.' }),
          h('div', { style: 'display:flex;gap:8px' }, h('button', { type: 'button', class: 'pp-btn pp-btn-primary', text: 'Turn off', onclick: async () => { await api('/api/autonomy', { on: false }); dlg.close(); render(); } }), close()));
        return;
      }
      const fresh = await api('/api/autonomy');
      if (!fresh.ok) return alert(`Check failed (${fresh.status}).`);
      if (fresh.j.ready) showConfirm(fresh.j, render); else showMissing(fresh.j);
    });
    const mail = h('input', { type: 'email', value: c.notifyEmail, placeholder: 'your email for notices', 'aria-label': 'Email for your notices', style: 'min-width:14rem' });
    const saved = h('span', { class: 'pp-sub', 'aria-live': 'polite' });
    const saveMail = h('button', { type: 'button', class: 'pp-btn', text: 'Save', onclick: async () => {
      const x = await api('/api/autonomy/notify', { email: mail.value });
      saved.textContent = x.ok ? 'Saved.' : ((x.j && x.j.error) || `Not saved (${x.status})`);
    } });
    const ds = await api('/api/data-status');
    const fresh = h('span', { class: 'pp-sub', style: 'flex-basis:100%;margin:0', text: !ds.ok ? '' : ds.j.source === 'database'
      ? `Data: live from the database, as of the last run (${new Date(ds.j.builtAt).toLocaleString()}).`
      : `Data: from the last deploy (${ds.j.reason}).` });
    bar.replaceChildren(
      h('label', { for: 'fa-switch', style: 'display:flex;gap:8px;align-items:center;font-weight:600' }, sw, document.createTextNode('Full autonomy')),
      h('span', { class: 'pp-sub', text: c.on ? `On since ${c.since.slice(0, 10)}: you'll only hear about signatures, deposits and closings.` : (c.ready ? 'Off. Everything is ready: flip it to turn it on.' : `Off. ${c.blocking.length} thing${c.blocking.length === 1 ? '' : 's'} to do first.`) }),
      h('span', { style: 'margin-left:auto;display:flex;gap:6px;align-items:center' }, h('span', { class: 'pp-sub', text: 'Notices go to' }), mail, saveMail, saved),
      !c.on && !c.ready ? h('button', { type: 'button', class: 'pp-btn', text: 'What\'s missing?', onclick: () => showMissing(c) }) : null, fresh);
  };

  const mount = () => {
    if (document.getElementById('fa-bar')) return;
    const top = document.querySelector('.ei-bar');
    if (top && top.parentNode) top.parentNode.insertBefore(bar, top.nextSibling); else document.body.prepend(bar);
    document.body.append(dlg);
    render().catch((e) => { bar.textContent = `Full autonomy status failed to load: ${e.message}`; });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
