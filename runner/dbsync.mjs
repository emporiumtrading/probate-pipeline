/* dbsync.mjs — copy the pipeline into Postgres after every run (owner decision 2026-11-25).

   The git repo stays the source of truth; the database is the permanent, queryable
   copy with a full change history:
     records / record_history   every row of every pipeline/**.csv (leads, tracker, ledger,
                                handoffs, buyers, exceptions, decisions, run record, notices…)
     files / file_history       lead files, reports, legal notes, config.yaml
     store_docs / store_history what the owner saved on the dashboard (decisions, settings)
     sync_runs                  one row per sync
   Needs DATABASE_URL (Render internal URL). Never stores API keys. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const SCHEMA = `
create table if not exists records (dataset text not null, row_key text not null, data jsonb not null, hash text not null,
  first_seen timestamptz not null default now(), last_seen timestamptz not null default now(), deleted_at timestamptz,
  primary key (dataset, row_key));
create table if not exists record_history (id bigserial primary key, dataset text not null, row_key text not null, data jsonb,
  change text not null, at timestamptz not null default now(), git_commit text);
create index if not exists record_history_key on record_history (dataset, row_key, at);
create table if not exists files (path text primary key, content text not null, hash text not null, updated_at timestamptz not null default now(), deleted_at timestamptz);
create table if not exists file_history (id bigserial primary key, path text not null, content text, change text not null, at timestamptz not null default now(), git_commit text);
create table if not exists store_docs (path text primary key, data jsonb not null, hash text not null, updated_at timestamptz not null default now(), deleted_at timestamptz);
create table if not exists store_history (id bigserial primary key, path text not null, data jsonb, change text not null, at timestamptz not null default now());
create table if not exists sync_runs (id bigserial primary key, at timestamptz not null default now(), slice text, git_commit text,
  datasets int, rows int, rows_changed int, files_changed int, docs_changed int);
create or replace view leads as select row_key as lead_id, data, last_seen from records where dataset = 'pipeline/deal-tracker.csv' and deleted_at is null;
create or replace view ledger as select data, last_seen from records where dataset = 'pipeline/ledger.csv' and deleted_at is null;
create or replace view runs as select data, last_seen from records where dataset = 'pipeline/runner-health.csv' and deleted_at is null;
`;

const sha = (s) => crypto.createHash('sha1').update(s).digest('hex');

const parseCsv = (txt) => {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head = [], ...body] = rows;
  return { head: head.map((h) => h.replace(/^﻿/, '').trim()), rows: body.filter((r) => r.some((x) => x !== '')) };
};

const walk = (dir, test, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, test, out); else if (test(p)) out.push(p);
  }
  return out;
};

// Rows keyed by their id column when it is unique, else by content (+ occurrence) for logs.
const keyed = (head, rows) => {
  const objs = rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
  const idCol = ['id', 'lead_id', 'buyer_id', 'key'].find((c) => head.includes(c)) || head[0];
  const ids = objs.map((o) => String(o[idCol] || ''));
  const unique = ids.every(Boolean) && new Set(ids).size === ids.length;
  const seen = new Map();
  return objs.map((o, i) => {
    if (unique) return [ids[i], o];
    const h = sha(JSON.stringify(o)); const n = (seen.get(h) || 0) + 1; seen.set(h, n);
    return [`${h.slice(0, 16)}#${n}`, o];
  });
};

export async function syncDb({ cwd, storeDocs = {}, slice = '' }) {
  if (!process.env.DATABASE_URL) return 'db sync skipped: no DATABASE_URL';
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).stdout.trim();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: /sslmode=require/.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false });
  await client.connect();
  let rowsTotal = 0, rowsChanged = 0, filesChanged = 0, docsChanged = 0, datasets = 0;
  try {
    await client.query(SCHEMA);
    await client.query('begin');

    // 1. CSV datasets
    const csvs = walk(path.join(cwd, 'pipeline'), (p) => p.endsWith('.csv') && !p.endsWith('TEMPLATE.csv')).map((p) => path.relative(cwd, p));
    for (const ds of csvs) {
      datasets++;
      const { head, rows } = parseCsv(fs.readFileSync(path.join(cwd, ds), 'utf8'));
      const cur = new Map((await client.query('select row_key, hash, deleted_at from records where dataset = $1', [ds])).rows.map((r) => [r.row_key, r]));
      const now = new Set();
      for (const [k, o] of keyed(head, rows)) {
        rowsTotal++; now.add(k);
        const json = JSON.stringify(o), h = sha(json), old = cur.get(k);
        if (old && old.hash === h && !old.deleted_at) continue;
        await client.query(`insert into records (dataset, row_key, data, hash) values ($1,$2,$3,$4)
          on conflict (dataset, row_key) do update set data = excluded.data, hash = excluded.hash, last_seen = now(), deleted_at = null`, [ds, k, json, h]);
        await client.query('insert into record_history (dataset, row_key, data, change, git_commit) values ($1,$2,$3,$4,$5)', [ds, k, json, old ? 'change' : 'add', commit]);
        rowsChanged++;
      }
      await client.query('update records set last_seen = now() where dataset = $1 and deleted_at is null', [ds]);
      for (const [k, old] of cur) {
        if (now.has(k) || old.deleted_at) continue;
        await client.query('update records set deleted_at = now() where dataset = $1 and row_key = $2', [ds, k]);
        await client.query('insert into record_history (dataset, row_key, data, change, git_commit) values ($1,$2,null,$3,$4)', [ds, k, 'delete', commit]);
        rowsChanged++;
      }
    }

    // 2. Documents: lead files, reports, legal notes, pipeline notes, config.
    const docs = [...walk(path.join(cwd, 'leads'), (p) => /\.(md|txt|csv|json)$/.test(p)), ...walk(path.join(cwd, 'reports'), (p) => p.endsWith('.md')),
      ...walk(path.join(cwd, 'legal'), (p) => p.endsWith('.md')), ...walk(path.join(cwd, 'pipeline'), (p) => p.endsWith('.md')),
      path.join(cwd, 'config.yaml')].filter((p) => fs.existsSync(p)).map((p) => path.relative(cwd, p));
    const curF = new Map((await client.query('select path, hash, deleted_at from files')).rows.map((r) => [r.path, r]));
    const nowF = new Set(docs);
    for (const f of docs) {
      const content = fs.readFileSync(path.join(cwd, f), 'utf8'), h = sha(content), old = curF.get(f);
      if (old && old.hash === h && !old.deleted_at) continue;
      await client.query(`insert into files (path, content, hash) values ($1,$2,$3)
        on conflict (path) do update set content = excluded.content, hash = excluded.hash, updated_at = now(), deleted_at = null`, [f, content, h]);
      await client.query('insert into file_history (path, content, change, git_commit) values ($1,$2,$3,$4)', [f, content, old ? 'change' : 'add', commit]);
      filesChanged++;
    }
    for (const [f, old] of curF) {
      if (nowF.has(f) || old.deleted_at) continue;
      await client.query('update files set deleted_at = now() where path = $1', [f]);
      await client.query('insert into file_history (path, content, change, git_commit) values ($1,null,$2,$3)', [f, 'delete', commit]);
      filesChanged++;
    }

    // 3. The owner's dashboard saves (decisions, settings). Never contains keys.
    const curD = new Map((await client.query('select path, hash from store_docs')).rows.map((r) => [r.path, r.hash]));
    for (const [p, d] of Object.entries(storeDocs)) {
      const json = JSON.stringify(d), h = sha(json);
      if (curD.get(p) === h) continue;
      await client.query(`insert into store_docs (path, data, hash) values ($1,$2,$3)
        on conflict (path) do update set data = excluded.data, hash = excluded.hash, updated_at = now(), deleted_at = null`, [p, json, h]);
      await client.query('insert into store_history (path, data, change) values ($1,$2,$3)', [p, json, curD.has(p) ? 'change' : 'add']);
      docsChanged++;
    }

    await client.query('insert into sync_runs (slice, git_commit, datasets, rows, rows_changed, files_changed, docs_changed) values ($1,$2,$3,$4,$5,$6,$7)',
      [slice, commit, datasets, rowsTotal, rowsChanged, filesChanged, docsChanged]);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
  return `db sync: ${datasets} datasets, ${rowsTotal} rows (${rowsChanged} changed), ${filesChanged} files changed, ${docsChanged} dashboard saves changed`;
}
