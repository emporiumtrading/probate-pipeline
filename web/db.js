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

module.exports = { getData, status, enabled: () => !!URL_, lastError: () => lastError };
