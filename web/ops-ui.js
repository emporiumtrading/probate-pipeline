/* ops-ui.js — two Render-only cards built from the dashboard data:
   - "Earnest-money reserve" on the Sign, wire & money page (data/reserve.csv, scripts/reserve.py)
   - "How each run went" on the Operations page (data/runner_health.csv, written by runner/run.mjs) */
(function () {
  'use strict';
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === 'text') e.textContent = v; else e.setAttribute(k, v); }
    for (const c of kids) if (c) e.append(c);
    return e;
  };
  const parseCsv = (txt) => {
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (q) { if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    const [head, ...body] = rows;
    return (body || []).filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((k, i) => [k, r[i] || ''])));
  };
  const load = async (name) => { const r = await fetch(`/data/${name}`, { credentials: 'same-origin' }); return r.ok ? parseCsv(await r.text()) : []; };
  const usd = (v) => '$' + Math.round(+v || 0).toLocaleString('en-US');

  const reserveCard = async () => {
    const page = document.getElementById('money');
    if (!page || document.getElementById('earnest-reserve')) return;
    const r = (await load('reserve.csv'))[0];
    const card = h('div', { class: 'pp-card', id: 'earnest-reserve' }, h('h2', { text: 'Earnest-money reserve' }));
    if (!r) { card.append(h('p', { class: 'pp-sub', text: 'Not built yet; it appears after the next run.' })); page.prepend(card); return; }
    const tile = (label, val) => h('div', { class: 'pp-card pp-tile' }, h('div', { class: 'pp-num', text: val }), h('div', { class: 'pp-lbl', text: label }));
    card.append(
      h('div', { class: 'pp-tiles' }, tile('Free now', usd(r.available)), tile('Held in open deals', usd(r.committed)), tile('Reserve total', usd(r.total)),
        tile('Max per normal deal', usd(r.normal_cap)), tile('Max per deal likely to close', usd(r.strong_cap))),
      h('p', { class: 'pp-sub', style: 'margin-top:12px', text: `Offers start at $0. A deposit is used only when a seller insists, only refundable during an inspection period, and only up to these caps. Started at ${usd(r.start)}; ${usd(r.refill_from_profit)} added from profits so far (25% of each closing)${+r.forfeited ? `, ${usd(r.forfeited)} lost to forfeited deposits` : ''}. The money stays in your accounts; this is the limit the workers stay within.` }),
      h('p', { class: 'pp-sub', text: `Company e-signature: ${r.company_signature === 'on' ? 'on: contracts inside the limits are signed by the company' : 'off: every contract comes to you as a one-tap signature until the company resolution is signed and the attorney confirms it'}.` }));
    page.prepend(card);
  };

  const runsCard = async () => {
    const page = document.getElementById('operations');
    if (!page || document.getElementById('run-record')) return;
    const rows = await load('runner_health.csv');
    const card = h('div', { class: 'pp-card', id: 'run-record' }, h('h2', { text: 'How each run went' }),
      h('p', { class: 'pp-sub', text: 'Which engine did the work (Claude, NVIDIA, OpenRouter, or the no-AI run), whether the result passed the checks, and what was tried first. Failures are repaired by the next run.' }));
    if (!rows.length) { card.append(h('p', { class: 'pp-sub', text: 'No runs recorded yet.' })); page.prepend(card); return; }
    const label = { a: 'Morning (A)', b: 'Midday (B)', c: 'Evening (C)', 'fast-desk': 'Fast desk' };
    const res = { ok: 'OK', fallback: 'OK (backup)', fail: 'Failed' };
    const tbl = h('table', { class: 'pp-table' },
      h('thead', {}, h('tr', {}, ...['When', 'Run', 'Work', 'Engine', 'Result', 'Checks', 'Notes'].map((t) => h('th', { scope: 'col', text: t })))),
      h('tbody', {}, ...rows.slice(0, 15).map((r) => h('tr', {},
        h('td', { text: (r.date || '').replace('T', ' ').slice(0, 16) }), h('td', { text: label[r.slice] || r.slice }),
        h('td', { text: r.level === 'idle' ? 'nothing waiting' : r.level }), h('td', { text: r.engine }),
        h('td', { text: res[r.result] || r.result }), h('td', { text: r.verify === 'pass' ? 'passed' : r.verify === 'fail' ? 'failed' : '—' }),
        h('td', { class: 'pp-sub', text: (r.notes || '').replace(/board:\w+;?\s*/, '').slice(0, 160) })))));
    card.append(h('div', { class: 'pp-wrap' }, tbl));
    page.prepend(card);
  };

  const mount = () => { reserveCard().catch(() => {}); runsCard().catch(() => {}); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
