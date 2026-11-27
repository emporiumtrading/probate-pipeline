/* preflight.js — the "Full autonomy" switch.

   Before the switch turns on, everything the system needs to run a deal from
   lead to closing without the owner is checked. Items that block it are listed
   with how to fix them; items that only limit one market (or a nice-to-have)
   are listed separately and don't block. The switch is saved in the doc store
   (data/users/<user>/settings/autonomy); every run reads it. */
'use strict';
const fs = require('fs');
const path = require('path');
const ai = require('./ai');
const store = require('./store');
const db = require('./db');

const DATA = path.join(__dirname, 'data');
const docPath = (user) => `data/users/${user}/settings/autonomy`;

// Owner-only, always (CLAUDE.md, daily-run.md Hard limits). Shown in the confirmation.
const KEEP = [
  'Signing, once: the company resolution that lets the company e-sign deals inside fixed limits (after the attorney confirms it). Any contract outside those limits comes to you as a one-tap signature.',
  'Earnest money: offers start at $0 and stay inside your $1,000 reserve (refilled at each closing with the deposit plus 25% of profit). When a deposit is due, you confirm the title company\'s escrow by phone and pay it through their link. The system never touches money or bank details.',
  'Phone calls are never made automatically. Callers reach voicemail, which arrives as email and is handled for you.',
];

const parseCsv = (txt) => {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] || ''])));
};

// Which setup-checklist items block full autonomy (the rest only limit a market or are optional).
const BLOCKS = {
  business: (k) => !['website', 'insurance', 'title_company'].includes(k),   // title companies are chosen per market by the Professional Network
  // voicemail_to_email is optional (owner decision 2026-11-27): the phone number isn't published in letters or on the site.
  channels: (k) => ['mail_sending', 'email_sending', 'inbox_connected', 'mail_scanning', 'esignature'].includes(k),
};

const check = async (user) => {
  const blocking = [], limited = [];
  let rd = [];
  // The checklist as of the latest checked run (live from the database), else the copy built at deploy.
  const live = await db.getData('readiness.csv').catch(() => null);
  try { rd = parseCsv(live ? live.content : fs.readFileSync(path.join(DATA, 'readiness.csv'), 'utf8')); } catch { blocking.push({ area: 'Dashboard', item: 'Setup checklist not built yet', fix: 'Wait for the next run (it rebuilds the dashboard), then try again.' }); }
  let st;
  try { st = await ai.status(); } catch (e) { st = null; blocking.push({ area: 'Render', item: 'Render connection', fix: `The dashboard couldn't reach Render (${e.message}). Check RENDER_API_KEY on the probate-dashboard service.` }); }
  const keySet = (k) => !!(st && st.renderReady && st.keys[k] && st.keys[k].set);
  // A channel that a service key switches on is one task, not two: while its key is missing, only the key is listed.
  const CH_KEY = { mail_sending: 'LOB_API_KEY', email_sending: 'RESEND_API_KEY', esignature: 'DOCUSEAL_API_KEY' };
  const savedAreas = {};
  const saved = [];
  const approvedMarkets = [];
  for (const r of rd) {
    if (r.status === 'done') { if (r.item_key === 'approved_on') approvedMarkets.push(r.area); continue; }
    if (r.area_id === 'channels' && CH_KEY[r.item_key] && !keySet(CH_KEY[r.item_key])) continue;
    // Saved on the Setup page since the last run: counted as done now; the next run applies and checks it.
    if (!(r.area_id in savedAreas)) savedAreas[r.area_id] = store.getDoc(`data/users/${user}/setup/areas/${r.area_id}`) || {};
    const v = savedAreas[r.area_id][r.item_key];
    if (v !== undefined && v !== null && v !== '' && v !== false) { saved.push({ area: r.area, item: r.item }); continue; }
    if (r.area_id === 'channels' && CH_KEY[r.item_key] && keySet(CH_KEY[r.item_key])) { saved.push({ area: r.area, item: r.item }); continue; }
    const fix = r.status === 'waiting for check' ? `Waiting for the next run to confirm it. ${r.how_to_fix}` : r.how_to_fix;
    const blk = BLOCKS[r.area_id] && BLOCKS[r.area_id](r.item_key);
    (blk ? blocking : limited).push({ area: r.area, item: r.item, fix });
  }
  if (rd.length && !approvedMarkets.length) {
    blocking.push({ area: 'Attorneys', item: 'At least one market with attorney-approved letters and contracts',
      fix: 'Runs on its own: the Legal Advisor sends each market\'s packet to the attorney service and records the approval. Nothing goes to a seller anywhere until one market is approved.' });
  }

  if (st && !st.renderReady) blocking.push({ area: 'Render', item: 'Render API key on the dashboard', fix: 'Render → Account settings → API Keys → create one; add it as RENDER_API_KEY in the probate-dashboard service\'s Environment.' });
  if (st && st.renderReady) {
    const k = st.keys;
    if (!k.ANTHROPIC_API_KEY.set && !k.NVIDIA_API_KEY.set) blocking.push({ area: 'AI engines', item: 'A Claude or NVIDIA key', fix: 'Setup → AI engines → paste the key → Save key.' });
    else if (!k.ANTHROPIC_API_KEY.set || !k.NVIDIA_API_KEY.set) limited.push({ area: 'AI engines', item: `No ${k.ANTHROPIC_API_KEY.set ? 'NVIDIA' : 'Claude'} key: one fewer backup`, fix: 'Setup → AI engines.' });
    for (const name of ['RESEND_API_KEY', 'LOB_API_KEY', 'DOCUSEAL_API_KEY']) {
      if (!k[name].set) blocking.push({ area: 'Services', item: k[name].label, fix: 'Setup → Sending and signing services → paste the key → Save key.' });
    }
  }
  const doc = store.getDoc(docPath(user)) || {};
  if (!doc.notifyEmail) blocking.push({ area: 'Notices', item: 'Where to send your deposit, signature and closing notices', fix: 'Enter your email in the Full autonomy box.' });
  return { on: !!doc.full, since: doc.confirmedAt || '', notifyEmail: doc.notifyEmail || '', ready: !blocking.length, blocking, limited, saved, keep: KEEP, checkedAt: new Date().toISOString() };
};

const save = async (user, patch) => {
  const doc = { ...(store.getDoc(docPath(user)) || {}), ...patch, updated: new Date().toISOString() };
  await store.setDoc(docPath(user), doc);
  return doc;
};

// Turning on re-checks on the server; the page can't skip the checks.
const setSwitch = async (user, on) => {
  if (!on) { await save(user, { full: false, offAt: new Date().toISOString() }); return { ok: true }; }
  const c = await check(user);
  if (!c.ready) return { ok: false, error: 'not ready', check: c };
  await save(user, { full: true, confirmedAt: new Date().toISOString() });
  return { ok: true };
};

const setNotify = async (user, email) => {
  email = String(email || '').trim();
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(email)) return { ok: false, error: 'that email address doesn\'t look right' };
  await save(user, { notifyEmail: email });
  return { ok: true };
};

module.exports = { check, setSwitch, setNotify };
