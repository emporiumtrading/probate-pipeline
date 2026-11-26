/* dash-runtime.js — standalone reimplementation of the claude.ai dashboard
   runtime APIs this page was written against (dash.*, claude.use), so it can
   run as a plain website on Render.

   What it provides:
   - dash.data(name)        -> {status:'loading'|'ok'|'error', data:[rows]}
   - dash.calc(name, def)   -> registers a computed dataset {title, description, inputs:[names], fn}
   - dash.draw(name, fn)    -> registers/re-runs renderers for [data-draw="name"]
   - dash.params()/setParams(obj) -> URL query state; null deletes a key; triggers a re-render
   - dash.setLink(id)       -> location.hash = id (page deep-links)
   - dash.colors            -> 10-color chart palette
   - claude.use('db')       -> {doc(path).set(obj)/get()} backed by /api/doc, /api/col
   - claude.use('user')     -> {id()} -> 'owner'

   Datasets load from /data/*.csv|json (built by scripts/build_dashboard_data.py),
   except the decision/setting datasets which come from the doc store, mirroring
   the artifact's db-backed datasets. */
(function () {
  'use strict';

  const USER = window.__PP_USER || 'owner';
  // Build request URLs without userinfo — fetch() throws when the document
  // URL carries basic-auth credentials (e.g. user:pass@host bookmarks).
  const ORIGIN = location.protocol + '//' + location.host;

  // File-backed datasets: name -> url. messages is JSON; everything else CSV.
  const FILES = {
    buyers: '/data/buyers.csv', coverage: '/data/coverage.csv', exceptions: '/data/exceptions.csv',
    finance: '/data/finance.csv', handoffs: '/data/handoffs.csv', health: '/data/health.csv',
    ledger: '/data/ledger.csv', legal_markets: '/data/legal_markets.csv', legal_matters: '/data/legal_matters.csv', attorney_candidates: '/data/attorney_candidates.csv',
    markets: '/data/markets.csv', messages: '/data/messages.json', pace: '/data/pace.csv',
    queues: '/data/queues.csv', readiness: '/data/readiness.csv', replies: '/data/replies.csv',
    runs: '/data/runs.csv', sources: '/data/sources.csv', stages: '/data/stages.csv',
    workers: '/data/workers.csv', leads: '/data/leads.csv',
  };

  // Doc-store-backed datasets: name -> collection path (docs keyed by doc name -> row.id).
  const DB_SETS = {
    decOutreach: `data/users/${USER}/decisions/outreach`,
    decSign: `data/users/${USER}/decisions/sign`,
    decWire: `data/users/${USER}/decisions/wire`,
    decExceptions: `data/users/${USER}/decisions/exceptions`,
    ownerSettings: `data/users/${USER}/setup/areas`,
  };

  const DATA = {};   // name -> {status, data}
  const CALCS = {};  // name -> {title, description, inputs, fn}
  const DRAWS = {};  // name -> [fn]
  let memo = {};     // calc name -> {status,data} for the current param version
  let booted = false;
  let bootPromise = null;

  const dash = (window.dash = {});

  // Tableau-10 style palette.
  dash.colors = ['#4c78a8', '#f58518', '#54a24b', '#e45756', '#72b7b2', '#eeca3b', '#b279a2', '#ff9da6', '#9d755d', '#bab0ac'];

  /* ---------- params (URL query) ---------- */

  const readParams = () => {
    const out = {};
    new URLSearchParams(location.search).forEach((v, k) => { out[k] = v; });
    return out;
  };
  dash.params = readParams;

  dash.setParams = (obj) => {
    const q = new URLSearchParams(location.search);
    Object.entries(obj || {}).forEach(([k, v]) => { if (v === null || v === undefined || v === '') q.delete(k); else q.set(k, v); });
    const url = location.pathname + (q.toString() ? '?' + q.toString() : '') + location.hash;
    history.replaceState(null, '', url);
    renderAll();
  };

  dash.setLink = (id) => {
    const url = location.pathname + location.search + (id ? '#' + id : '');
    history.replaceState(null, '', url);
  };

  window.addEventListener('popstate', () => renderAll());

  /* ---------- datasets ---------- */

  dash.calc = (name, def) => { CALCS[name] = def; };

  dash.data = (name) => {
    if (Object.prototype.hasOwnProperty.call(DATA, name)) return DATA[name];
    if (Object.prototype.hasOwnProperty.call(CALCS, name)) {
      if (memo[name]) return memo[name];
      const def = CALCS[name];
      const ins = (def.inputs || []).map(dash.data);
      if (ins.some((d) => d.status === 'loading')) return (memo[name] = { status: 'loading' });
      if (ins.some((d) => d.status === 'error')) return (memo[name] = { status: 'error' });
      try { return (memo[name] = { status: 'ok', data: def.fn(...ins.map((d) => d.data)) }); }
      catch (e) { console.error('calc failed:', name, e); return (memo[name] = { status: 'error' }); }
    }
    return { status: 'loading' };
  };

  const loadFile = async (name, url) => {
    try {
      const res = await fetch(ORIGIN + url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      DATA[name] = url.endsWith('.json')
        ? { status: 'ok', data: await res.json() }
        : { status: 'ok', data: d3.csvParse(await res.text()) };
    } catch (e) { console.error('dataset failed:', name, e); DATA[name] = { status: 'error' }; }
  };

  const loadDbSet = async (name, col) => {
    try {
      const res = await fetch(ORIGIN + '/api/col/' + col.split('/').map(encodeURIComponent).join('/'), { credentials: 'same-origin' });
      if (!res.ok) throw new Error(String(res.status));
      DATA[name] = { status: 'ok', data: await res.json() };
    } catch (e) { console.error('db dataset failed:', name, e); DATA[name] = { status: 'error' }; }
  };

  const refreshDbSet = (name) => loadDbSet(name, DB_SETS[name]).then(renderAll);

  /* ---------- draws ---------- */

  const MONEY = /earn|fee|price|amount|net|cost|income|expense|pipe|escrow|earnest|tax|money|arv|value|max|deals_under/i;
  const fmtAuto = (v, field) => {
    if (v === null || v === undefined || v === '') return '—';
    const n = +v;
    if (isNaN(n)) return String(v);
    if (MONEY.test(field || '')) {
      if (Math.abs(n) >= 10000) return '$' + d3.format('.3~s')(n).replace('G', 'B');
      return d3.format('$,.0f')(n);
    }
    return d3.format(',')(n);
  };

  const runDraw = (name, el) => {
    const specs = DRAWS[name];
    if (specs && specs.length) {
      specs.forEach((s) => {
        try {
          // Object form: {mount(el)->handle, update(el), unmount(el, handle)}.
          if (s.mount) {
            el.__ppMounts = el.__ppMounts || new Map();
            if (!el.__ppMounts.has(s)) el.__ppMounts.set(s, s.mount(el));
          }
          if (s.update) s.update(el); else if (typeof s === 'function') s(el);
        } catch (e) { console.error('draw failed:', name, e); }
      });
      return;
    }
    // Host auto-fill: data-source + data-field + data-row -> textContent.
    const src = el.getAttribute('data-source');
    if (!src) return;
    const d = dash.data(src);
    if (d.status !== 'ok' || !d.data) { el.textContent = d.status === 'loading' ? '—' : '—'; return; }
    const row = d.data[+(el.getAttribute('data-row') || 0)] || {};
    const field = el.getAttribute('data-field');
    el.textContent = field ? fmtAuto(row[field], field) : '—';
  };

  function renderAll() {
    if (!booted) return;
    memo = {};
    document.querySelectorAll('[data-draw]').forEach((el) => runDraw(el.getAttribute('data-draw'), el));
  }

  dash.draw = (name, fn) => {
    if (typeof fn === 'function') (DRAWS[name] = DRAWS[name] || []).push({ update: fn });
    else if (fn && typeof fn === 'object') (DRAWS[name] = DRAWS[name] || []).push(fn);
    if (booted) document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => runDraw(name, el));
  };

  /* ---------- claude.use ---------- */

  const dbApi = {
    doc: (p) => ({
      set: async (data) => {
        const res = await fetch(ORIGIN + '/api/doc', {
          method: 'PUT', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: p, data }),
        });
        if (!res.ok) throw new Error('save failed: ' + res.status);
        Object.keys(DB_SETS).forEach((n) => { if (p.startsWith(DB_SETS[n])) refreshDbSet(n); });
      },
      get: async () => {
        const res = await fetch(ORIGIN + '/api/doc?path=' + encodeURIComponent(p), { credentials: 'same-origin' });
        if (res.status === 404) return { exists: false, data: () => undefined };
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        return { exists: true, data: () => j };
      },
    }),
  };
  const userApi = { id: async () => USER };

  window.claude = { use: async (name) => (name === 'db' ? dbApi : name === 'user' ? userApi : null) };

  /* ---------- boot ---------- */

  const boot = async () => {
    await Promise.all([
      ...Object.entries(FILES).map(([n, u]) => loadFile(n, u)),
      ...Object.entries(DB_SETS).map(([n, c]) => loadDbSet(n, c)),
    ]);
    booted = true;
    renderAll();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bootPromise = boot(); });
  } else {
    bootPromise = boot();
  }
  window.__dashReady = bootPromise;
})();
