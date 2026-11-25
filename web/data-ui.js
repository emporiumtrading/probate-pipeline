/* data-ui.js — the read-only "Data" page (Render site only).
   Browses the Postgres copy of the pipeline through /api/dbview/* (web/db.js),
   where every query runs in a read-only transaction. Nothing here can change data. */
(function () {
  'use strict';
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    for (const c of kids) if (c !== null && c !== undefined && c !== false) e.append(c);
    return e;
  };
  const get = async (what, params = {}) => {
    const r = await fetch(`/api/dbview/${what}?${new URLSearchParams(params)}`, { credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `error ${r.status}`);
    return j;
  };
  const when = (v) => (v ? new Date(v).toLocaleString() : '');
  const NAMES = {
    'pipeline/deal-tracker.csv': 'Deals (tracker)', 'pipeline/ledger.csv': 'Ledger', 'pipeline/buyers/buyers.csv': 'Cash buyers',
    'pipeline/handoffs.csv': 'Task board', 'pipeline/exceptions.csv': 'Exceptions', 'pipeline/decisions-log.csv': 'Worker decisions',
    'pipeline/owner-decisions.csv': 'Your decisions', 'pipeline/runner-health.csv': 'Runs', 'pipeline/owner-notices.csv': 'Notices sent to you',
    'pipeline/coverage.csv': 'Sources per county', 'pipeline/outbound-log.csv': 'Letters and emails sent', 'pipeline/inbox-log.csv': 'Replies received',
    'pipeline/stop-list.csv': 'Stop list', 'pipeline/workers.csv': 'Workers',
  };
  const nice = (ds) => NAMES[ds] || ds.replace(/^pipeline\//, '');
  const table = (cols, rows, onRow) => h('div', { class: 'pp-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, ...cols.map((c) => h('th', { scope: 'col', text: c.label })))),
    h('tbody', {}, ...rows.map((r) => {
      const tr = h('tr', onRow ? { tabindex: '0', style: 'cursor:pointer' } : {}, ...cols.map((c) => h('td', { text: String(c.get(r) ?? '').slice(0, 140) })));
      if (onRow) { tr.addEventListener('click', () => onRow(r)); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') onRow(r); }); }
      return tr;
    }))));
  const note = (text) => h('p', { class: 'pp-sub', text });

  const section = h('section', { class: 'pp-page', id: 'data', hidden: '' });
  const body = h('div', {});
  const views = {};
  let current = 'tables';

  views.tables = async (box) => {
    const s = await get('summary');
    const sel = h('select', { 'aria-label': 'Table' }, ...s.datasets.map((d) => h('option', { value: d.dataset, text: `${nice(d.dataset)} (${d.rows})` })));
    const pref = s.datasets.find((d) => d.dataset === 'pipeline/deal-tracker.csv');
    if (pref) sel.value = pref.dataset;
    const q = h('input', { type: 'search', placeholder: 'Search this table', 'aria-label': 'Search this table', style: 'min-width:16rem' });
    const out = h('div', {}), hist = h('div', {});
    let offset = 0;
    const load = async () => {
      out.replaceChildren(note('Loading…')); hist.replaceChildren();
      const r = await get('records', { dataset: sel.value, q: q.value, limit: 100, offset });
      const keys = (r.columns && r.columns.length ? r.columns : [...new Set(r.rows.flatMap((x) => Object.keys(x.data)))]).slice(0, 12);
      const pager = h('div', { style: 'display:flex;gap:8px;align-items:center;margin:8px 0' },
        h('button', { type: 'button', class: 'pp-btn', text: 'Previous', ...(offset ? {} : { disabled: '' }), onclick: () => { offset = Math.max(0, offset - 100); load(); } }),
        h('span', { class: 'pp-sub', text: r.total ? `${offset + 1}–${offset + r.rows.length} of ${r.total}` : 'No rows' }),
        h('button', { type: 'button', class: 'pp-btn', text: 'Next', ...(offset + 100 < r.total ? {} : { disabled: '' }), onclick: () => { offset += 100; load(); } }));
      out.replaceChildren(pager, note('Click a row to see its history.'),
        table(keys.map((k) => ({ label: k, get: (x) => x.data[k] })), r.rows, async (row) => {
          hist.replaceChildren(note('Loading history…'));
          const changes = await get('history', { dataset: sel.value, key: row.row_key });
          hist.replaceChildren(h('h3', { text: `History of ${row.row_key}` }),
            table([{ label: 'When', get: (c) => when(c.at) }, { label: 'Change', get: (c) => c.change }, { label: 'Commit', get: (c) => (c.git_commit || '').slice(0, 7) },
              { label: 'Values', get: (c) => (c.data ? Object.entries(c.data).filter(([, v]) => v !== '').map(([k, v]) => `${k}: ${v}`).join(' · ') : '(removed)') }], changes));
          hist.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }));
    };
    sel.addEventListener('change', () => { offset = 0; load(); });
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { offset = 0; load(); }, 350); });
    box.replaceChildren(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, sel, q), out, hist);
    await load();
  };

  views.files = async (box) => {
    const q = h('input', { type: 'search', placeholder: 'Search file names and contents', 'aria-label': 'Search files', style: 'min-width:18rem' });
    const list = h('div', {}), view = h('div', {});
    const show = async (path) => {
      view.replaceChildren(note('Loading…'));
      const r = await get('file', { path });
      if (!r.file) { view.replaceChildren(note('Not found.')); return; }
      const pre = h('pre', { style: 'white-space:pre-wrap;max-height:60vh;overflow:auto;border:1px solid #e5e5e5;padding:12px;border-radius:8px', text: r.file.content });
      view.replaceChildren(h('h3', { text: r.file.path }), note(`Updated ${when(r.file.updated_at)}. Earlier versions:`),
        h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px' }, ...r.versions.map((v) => h('button', { type: 'button', class: 'pp-btn',
          text: `${when(v.at)} (${v.change})`, onclick: async () => { const x = await get('fileVersion', { id: v.id }); pre.textContent = x && x.content != null ? x.content : '(file removed in this version)'; } }))),
        pre);
      view.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    const load = async () => {
      list.replaceChildren(note('Loading…'));
      const rows = await get('files', { q: q.value });
      list.replaceChildren(note(`${rows.length} file${rows.length === 1 ? '' : 's'}${rows.length === 500 ? ' (first 500; search to narrow)' : ''}. Click one to read it.`),
        table([{ label: 'File', get: (f) => f.path }, { label: 'Updated', get: (f) => when(f.updated_at) }, { label: 'Size', get: (f) => `${Math.ceil(f.size / 1024)} KB` }], rows, (f) => show(f.path)));
    };
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 350); });
    box.replaceChildren(q, list, view);
    await load();
  };

  views.saves = async (box) => {
    const rows = await get('saves');
    box.replaceChildren(note('What you saved on the dashboard (decisions and settings). API keys are never stored here.'),
      rows.length ? table([{ label: 'Saved item', get: (r) => r.path.replace(/^data\/users\/[^/]+\//, '') }, { label: 'Updated', get: (r) => when(r.updated_at) },
        { label: 'Values', get: (r) => Object.entries(r.data || {}).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') }], rows) : note('Nothing saved yet.'));
  };

  views.syncs = async (box) => {
    const rows = await get('syncs');
    box.replaceChildren(note('Each run copies the pipeline into the database. Only what changed is written; every change is kept in the history.'),
      table([{ label: 'When', get: (r) => when(r.at) }, { label: 'Run', get: (r) => r.slice }, { label: 'Commit', get: (r) => (r.git_commit || '').slice(0, 7) },
        { label: 'Rows', get: (r) => r.rows }, { label: 'Rows changed', get: (r) => r.rows_changed }, { label: 'Files changed', get: (r) => r.files_changed },
        { label: 'Your saves changed', get: (r) => r.docs_changed }], rows));
  };

  const tabs = [['tables', 'Tables'], ['files', 'Files'], ['saves', 'Your saves'], ['syncs', 'Syncs']];
  const subnav = h('div', { role: 'tablist', 'aria-label': 'Data views', style: 'display:flex;gap:6px;margin:8px 0' });
  const open = async (id) => {
    current = id;
    subnav.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === id)));
    subnav.querySelectorAll('button').forEach((b) => { b.className = b.dataset.view === id ? 'pp-btn pp-btn-primary' : 'pp-btn'; });
    body.replaceChildren(note('Loading…'));
    try { await views[id](body); } catch (e) { body.replaceChildren(note(`Can't show this yet: ${e.message}.`)); }
  };
  tabs.forEach(([id, label]) => subnav.append(h('button', { type: 'button', role: 'tab', 'data-view': id, class: 'pp-btn', text: label, onclick: () => open(id) })));
  let loaded = false;

  const mount = () => {
    const nav = document.querySelector('.pp-tabs');
    const setup = document.getElementById('setup');
    if (!nav || !setup || document.getElementById('data')) return;
    section.append(h('div', { class: 'pp-card' }, h('h2', { text: 'Data' }),
      note('A read-only view of the database: every table, file and saved setting, with its history. The repo stays the record; the database is refreshed after every run. Nothing on this page can change data.'),
      subnav, body));
    setup.parentNode.insertBefore(section, setup.nextSibling);
    const tab = h('button', { class: 'pp-tab', role: 'tab', 'data-page': 'data', 'aria-selected': 'false', text: 'Data' });
    nav.append(tab);
    const show = () => {
      if (window.PP && window.PP.show) window.PP.show('data');
      else { document.querySelectorAll('.pp-page').forEach((s) => { s.hidden = s.id !== 'data'; }); document.querySelectorAll('.pp-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.page === 'data'))); location.hash = 'data'; }
      if (!loaded) { loaded = true; open(current); }
    };
    tab.addEventListener('click', show);
    if (location.hash === '#data') show();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
