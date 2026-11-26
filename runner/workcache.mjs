/* workcache.mjs — workers' working data, kept in the database between runs (owner decision 2026-11-26).

   Every run starts on a fresh machine, so anything a worker downloads or builds (bulk data extracts, research
   caches, where a long job stopped) used to be lost. Workers put such files in `workcache/` (git-ignored); the
   runner restores that folder from Postgres before any engine starts and saves changes back after the run.
   The repo keeps code, instructions and the pipeline records; bulky working data lives here instead.
   The AI engines never get the database address: only the runner reads and writes this table.

   Limits: 50 MB per file, 1 GB in total (the database has 5 GB). Larger files are skipped and logged. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const DIR = 'workcache';
const MAX_FILE = 50 * 1024 * 1024;
const MAX_TOTAL = 1024 * 1024 * 1024;

const connect = async () => {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const c = new pg.Client({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : false });
  await c.connect();
  await c.query(`create table if not exists work_cache (
    path text primary key, content bytea not null, sha text not null, size integer not null, updated_at timestamptz not null default now())`);
  return c;
};

const walk = (root, rel = '') => {
  const out = [];
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) out.push(...walk(root, r)); else if (e.isFile()) out.push(r);
  }
  return out;
};
let restored = false;   // only delete cache rows in a run whose cache was actually restored
const safe = (p) => !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..');

export async function restoreWorkcache(cwd) {
  const c = await connect().catch((e) => { console.log('workcache: database unreachable:', e.message); return null; });
  if (!c) return 'workcache: no database yet (nothing restored)';
  try {
    const r = await c.query('select path, content from work_cache');
    let n = 0, bytes = 0;
    for (const row of r.rows) {
      if (!safe(row.path)) continue;
      const f = path.join(cwd, DIR, row.path);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, row.content);
      n++; bytes += row.content.length;
    }
    restored = true;
    return `workcache: restored ${n} files (${(bytes / 1048576).toFixed(1)} MB)`;
  } finally { await c.end(); }
}

export async function saveWorkcache(cwd) {
  const c = await connect().catch((e) => { console.log('workcache: database unreachable:', e.message); return null; });
  if (!c) return 'workcache: no database yet (nothing saved)';
  try {
    const root = path.join(cwd, DIR);
    const have = Object.fromEntries((await c.query('select path, sha, size from work_cache')).rows.map((r) => [r.path, r]));
    const files = walk(root).filter(safe);
    let total = 0, saved = 0, skipped = [], removed = 0;
    for (const p of files) {
      const buf = fs.readFileSync(path.join(root, p));
      if (buf.length > MAX_FILE) { skipped.push(`${p} (${(buf.length / 1048576).toFixed(0)} MB > 50 MB)`); continue; }
      if (total + buf.length > MAX_TOTAL) { skipped.push(`${p} (1 GB total reached)`); continue; }
      total += buf.length;
      const sha = crypto.createHash('sha256').update(buf).digest('hex');
      if (have[p] && have[p].sha === sha) continue;
      await c.query(`insert into work_cache (path, content, sha, size, updated_at) values ($1, $2, $3, $4, now())
        on conflict (path) do update set content = excluded.content, sha = excluded.sha, size = excluded.size, updated_at = now()`, [p, buf, sha, buf.length]);
      saved++;
    }
    // A file a worker deleted is deleted here too, but only if the folder came back at all (a run that crashed
    // before restoring mustn't wipe the cache).
    if (restored && fs.existsSync(root)) {
      const keep = new Set(files);
      for (const p of Object.keys(have)) if (!keep.has(p)) { await c.query('delete from work_cache where path = $1', [p]); removed++; }
    }
    return `workcache: ${saved} files saved, ${removed} removed, ${(total / 1048576).toFixed(1)} MB kept` + (skipped.length ? `; skipped: ${skipped.join(', ')}` : '');
  } finally { await c.end(); }
}
