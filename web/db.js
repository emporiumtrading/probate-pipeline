/* db.js — the dashboard reads its data live from Postgres (probate-db).

   Each run publishes the dashboard datasets it built and checked (qa_checks.py
   passed) into the dashboard_data table (runner/dbsync.mjs). The server serves
   /data/<name> from there, cached for a few seconds, so the page shows the latest
   run without a redeploy. Without DATABASE_URL, or if the database is unreachable
   or the table is still empty, it falls back to the files built at deploy (web/data).

   The client is node-postgres bundled into web/vendor/pg.cjs (no npm install on
   this service). Rebuild it with:
     npm i pg esbuild && echo "module.exports=require('pg')" > e.js &&
     npx esbuild e.js --bundle --platform=node --format=cjs --external:pg-native --external:pg-cloudflare --minify --outfile=web/vendor/pg.cjs */
'use strict';
const URL_ = process.env.DATABASE_URL || '';
const TTL = 15000;

let pool = null;
const getPool = () => {
  if (!URL_) return null;
  if (!pool) {
    const { Pool } = require('./vendor/pg.cjs');
    pool = new Pool({ connectionString: URL_, max: 3, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000,
      ssl: /sslmode=require/.test(URL_) ? { rejectUnauthorized: false } : false });
    pool.on('error', (e) => console.log('db pool error:', e.message));
  }
  return pool;
};

const cache = new Map(); // name -> {at, row}
let lastError = '';

// Returns {content, builtAt, commit} or null (caller falls back to the file).
const getData = async (name) => {
  const p = getPool();
  if (!p) return null;
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < TTL) return hit.row;
  try {
    const r = await p.query('select content, built_at, git_commit from dashboard_data where name = $1', [name]);
    const row = r.rows[0] ? { content: r.rows[0].content, builtAt: r.rows[0].built_at, commit: r.rows[0].git_commit } : null;
    cache.set(name, { at: Date.now(), row });
    lastError = '';
    return row;
  } catch (e) {
    lastError = e.code === '42P01' ? 'no data published yet' : e.message;
    cache.set(name, { at: Date.now(), row: null });
    return null;
  }
};

const status = async () => {
  const p = getPool();
  if (!p) return { source: 'files', reason: 'no DATABASE_URL on the dashboard yet' };
  try {
    const r = await p.query('select max(built_at) as built_at, count(*)::int as n, max(git_commit) as git_commit from dashboard_data');
    const s = await p.query('select max(at) as last_sync from sync_runs').catch(() => ({ rows: [{}] }));
    const row = r.rows[0] || {};
    return row.n ? { source: 'database', builtAt: row.built_at, datasets: row.n, lastSync: s.rows[0].last_sync }
      : { source: 'files', reason: 'the database has no published data yet (it fills at the next run)' };
  } catch (e) {
    return { source: 'files', reason: e.code === '42P01' ? 'the database has no published data yet (it fills at the next run)' : `database unreachable: ${e.message}` };
  }
};

/* ---------- Data page (read-only browse; every query in a READ ONLY transaction) ---------- */
const ro = async (sql, params = []) => {
  const p = getPool();
  if (!p) { const e = new Error('no DATABASE_URL on the dashboard yet'); e.status = 503; throw e; }
  const c = await p.connect();
  try {
    await c.query('begin read only');
    await c.query("set local statement_timeout = '8s'");
    const r = await c.query(sql, params);
    await c.query('commit');
    return r.rows;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    if (e.code === '42P01') { e.status = 503; e.message = 'the database has no data yet (it fills at the next run)'; }
    throw e;
  } finally { c.release(); }
};
const lim = (v, d, max) => Math.min(Math.max(parseInt(v, 10) || d, 1), max);

const browse = {
  summary: async () => ({
    datasets: await ro(`select dataset, count(*) filter (where deleted_at is null)::int as rows, count(*) filter (where deleted_at is not null)::int as removed,
      max(last_seen) as last_seen from records group by dataset order by dataset`),
    files: (await ro('select count(*) filter (where deleted_at is null)::int as n from files'))[0].n,
    saves: (await ro('select count(*) filter (where deleted_at is null)::int as n from store_docs'))[0].n,
    lastSync: (await ro('select at, slice, rows_changed, files_changed, docs_changed from sync_runs order by id desc limit 1'))[0] || null,
  }),
  records: async (q) => {
    const params = [String(q.dataset || '')];
    let where = 'dataset = $1 and deleted_at is null';
    if (q.q) { params.push('%' + String(q.q).slice(0, 100) + '%'); where += ` and data::text ilike $${params.length}`; }
    const limit = lim(q.limit, 100, 500), offset = Math.max(parseInt(q.offset, 10) || 0, 0);
    const total = (await ro(`select count(*)::int as n from records where ${where}`, params))[0].n;
    const rows = await ro(`select row_key, data, last_seen from records where ${where} order by row_key limit ${limit} offset ${offset}`, params);
    const cols = await ro('select columns from datasets where dataset = $1', [params[0]]).catch(() => []);
    return { total, rows, columns: (cols[0] && cols[0].columns) || null };
  },
  history: async (q) => ro('select change, at, git_commit, data from record_history where dataset = $1 and row_key = $2 order by at desc, id desc limit 100',
    [String(q.dataset || ''), String(q.key || '')]),
  files: async (q) => {
    const params = [];
    let where = 'deleted_at is null';
    if (q.q) { params.push('%' + String(q.q).slice(0, 100) + '%'); where += ' and (path ilike $1 or content ilike $1)'; }
    return ro(`select path, updated_at, length(content)::int as size from files where ${where} order by path limit 500`, params);
  },
  file: async (q) => ({
    file: (await ro('select path, content, updated_at from files where path = $1', [String(q.path || '')]))[0] || null,
    versions: await ro('select id, change, at, git_commit from file_history where path = $1 order by at desc, id desc limit 50', [String(q.path || '')]),
  }),
  fileVersion: async (q) => (await ro('select path, content, change, at from file_history where id = $1', [parseInt(q.id, 10) || 0]))[0] || null,
  saves: async () => ro('select path, data, updated_at from store_docs where deleted_at is null order by path'),
  syncs: async () => ro('select at, slice, git_commit, datasets, rows, rows_changed, files_changed, docs_changed from sync_runs order by id desc limit 50'),
};

module.exports = { getData, status, browse, enabled: () => !!URL_, lastError: () => lastError };
