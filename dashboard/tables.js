/* Probate Operations dashboard: table tools for every table in a card (.pp-wrap).
   Adds a search box, a "showing N of M" count, sortable column headers (click; again to reverse)
   and paging (25 rows, then "Show 25 more" / "Show all"). Works on the rows the page draws, and
   re-applies itself whenever a table is redrawn (filters change, data refreshes). */
(function () {
  'use strict';
  const PAGE = 25;
  const num = (t) => {
    const s = String(t).replace(/[,$%\s]/g, '').replace(/^−/, '-');
    const m = /^(-?\d+(?:\.\d+)?)([kKmMbB])?$/.exec(s);
    if (!m) return null;
    return +m[1] * ({ k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1);
  };
  const key = (cell) => {
    const t = (cell ? cell.textContent : '').trim();
    if (!t || t === '—') return { empty: true };
    const n = num(t);
    return n === null ? { s: t.toLowerCase() } : { n };
  };
  const cmp = (a, b) => {
    if (a.empty || b.empty) return a.empty && b.empty ? 0 : a.empty ? 1 : -1;   // blanks last either way
    if (a.n !== undefined && b.n !== undefined) return a.n - b.n;
    return String(a.s ?? a.n).localeCompare(String(b.s ?? b.n), undefined, { numeric: true });
  };

  const enhance = (table) => {
    if (table.__ppKit) return;
    const tbody = table.tBodies[0], head = table.tHead && table.tHead.rows[0];
    if (!tbody || !head) return;
    const st = table.__ppKit = { q: '', col: -1, dir: 1, shown: PAGE, busy: false };

    const bar = document.createElement('div'); bar.className = 'pp-tkit';
    const search = document.createElement('input');
    search.type = 'search'; search.placeholder = 'Search this table'; search.setAttribute('aria-label', 'Search this table');
    const count = document.createElement('span'); count.className = 'pp-tkit-n'; count.setAttribute('aria-live', 'polite');
    bar.append(search, count);
    if (table.dataset.kit === 'nosearch') search.hidden = true;   // the page has its own search
    const more = document.createElement('div'); more.className = 'pp-tkit-more';
    const moreBtn = document.createElement('button'); moreBtn.type = 'button'; moreBtn.className = 'pp-btn';
    const allBtn = document.createElement('button'); allBtn.type = 'button'; allBtn.className = 'pp-btn'; allBtn.textContent = 'Show all';
    more.append(moreBtn, allBtn);
    const host = table.closest('.pp-wrap') === table.parentElement ? table : (table.closest('.pp-wrap > div') || table);
    host.before(bar); host.after(more);

    [...head.cells].forEach((th, i) => {
      if (!th.textContent.trim() || th.dataset.nosort !== undefined) return;
      th.classList.add('pp-sortable'); th.tabIndex = 0; th.setAttribute('aria-sort', 'none'); th.title = 'Sort by this column';
      const go = () => { if (st.col === i) st.dir = -st.dir; else { st.col = i; st.dir = th.classList.contains('pp-n') ? -1 : 1; }
        [...head.cells].forEach((c, j) => c.hasAttribute('aria-sort') && c.setAttribute('aria-sort', j === i ? (st.dir > 0 ? 'ascending' : 'descending') : 'none'));
        apply(); };
      th.addEventListener('click', go);
      th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });

    let order = null;   // the rows in the order the page drew them
    const apply = () => {
      st.busy = true;
      const rows = [...tbody.rows];
      const data = rows.filter((r) => r.cells.length > 1);
      if (!order || order.some((r) => !r.isConnected) || data.some((r) => !order.includes(r))) order = data;
      let list = order.slice();
      if (st.col >= 0) list.sort((a, b) => st.dir * cmp(key(a.cells[st.col]), key(b.cells[st.col])));
      const q = st.q.trim().toLowerCase();
      const hits = q ? list.filter((r) => r.textContent.toLowerCase().includes(q)) : list;
      list.forEach((r) => tbody.appendChild(r));
      list.forEach((r) => { r.hidden = true; });
      hits.slice(0, st.shown).forEach((r) => { r.hidden = false; });
      let none = tbody.querySelector('tr.pp-tkit-none');
      if (q && !hits.length && data.length) {
        if (!none) { none = tbody.insertRow(); none.className = 'pp-tkit-none'; const td = none.insertCell(); td.colSpan = head.cells.length; td.className = 'pp-muted'; }
        none.cells[0].textContent = `Nothing matches "${st.q.trim()}".`;
      } else if (none) none.remove();
      const total = data.length, shownN = Math.min(st.shown, hits.length);
      bar.hidden = total < 6;
      count.textContent = !total ? '' : q ? `${hits.length} of ${total} match` + (shownN < hits.length ? ` · showing ${shownN}` : '')
        : (shownN < total ? `Showing ${shownN} of ${total}` : `${total} ${total === 1 ? 'row' : 'rows'}`);
      const left = hits.length - shownN;
      more.hidden = left <= 0;
      moreBtn.textContent = `Show ${Math.min(PAGE, left)} more`;
      obs.takeRecords(); st.busy = false;
    };
    search.addEventListener('input', () => { st.q = search.value; st.shown = PAGE; apply(); });
    moreBtn.addEventListener('click', () => { st.shown += PAGE; apply(); });
    allBtn.addEventListener('click', () => { st.shown = Infinity; apply(); });
    const obs = new MutationObserver(() => { if (!st.busy) { order = null; apply(); } });
    obs.observe(tbody, { childList: true });
    apply();
  };

  const style = document.createElement('style');
  style.textContent = `
    .pp-tkit { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; margin: 4px 0 8px; }
    .pp-tkit input { font: inherit; font-size: var(--cds-font-size-caption); color: var(--color-fg); background: var(--color-bg); border: 1px solid var(--color-border-line);
      border-radius: var(--cds-radius); padding: 6px 10px; width: min(320px, 100%); }
    .pp-tkit-n { font-size: var(--cds-font-size-caption); color: var(--color-fg-muted); }
    .pp-tkit-more { display: flex; gap: 8px; justify-content: center; margin-top: 10px; }
    .pp th.pp-sortable { cursor: pointer; user-select: none; }
    .pp th.pp-sortable:hover, .pp th.pp-sortable:focus-visible { color: var(--color-fg); outline: none; }
    .pp th.pp-sortable::after { content: " ↕"; opacity: .35; font-size: 10px; }
    .pp th[aria-sort="ascending"]::after { content: " ▲"; opacity: .9; }
    .pp th[aria-sort="descending"]::after { content: " ▼"; opacity: .9; }
  `;
  document.head.appendChild(style);
  const run = () => document.querySelectorAll('.pp .pp-wrap table').forEach(enhance);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
