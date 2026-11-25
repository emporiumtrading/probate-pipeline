/* ai.js — AI engine keys for the scheduled runners, managed from the dashboard.

   Keys are never written to the doc store or to git. The dashboard checks a key
   with its provider, then saves it as an environment variable on each runner
   cron job through Render's API, and starts a deploy so the next run uses it.
   Reading back only ever returns "set" and the last 4 characters.

   Env (dashboard service): RENDER_API_KEY (required for this page),
   RUNNER_SERVICES (optional, comma-separated cron job names). */
'use strict';

const RENDER = 'https://api.render.com/v1';
const RENDER_KEY = process.env.RENDER_API_KEY || '';
const NAMES = (process.env.RUNNER_SERVICES || 'probate-slice-a,probate-slice-b,probate-slice-c,probate-fast-desk')
  .split(',').map((s) => s.trim()).filter(Boolean);

const KEYS = {
  ANTHROPIC_API_KEY: { label: 'Claude (Anthropic)', check: async (v) => {
    const r = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': v, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(20000) });
    return r.ok ? null : `Anthropic answered ${r.status}`; } },
  NVIDIA_API_KEY: { label: 'NVIDIA', check: async (v) => {
    const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', { method: 'POST',
      headers: { Authorization: `Bearer ${v}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'meta/llama-3.3-70b-instruct', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      signal: AbortSignal.timeout(30000) });
    return r.ok ? null : (r.status === 401 || r.status === 403 ? `NVIDIA answered ${r.status} (key not accepted)` : null); } },
  OPENROUTER_API_KEY: { label: 'OpenRouter', check: async (v) => {
    const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${v}` }, signal: AbortSignal.timeout(20000) });
    return r.ok ? null : `OpenRouter answered ${r.status}`; } },
  // Services the workers send and sign through (the runner tests them and switches the channel on).
  RESEND_API_KEY: { label: 'Email (Resend)', service: true, check: async (v) => {
    const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${v}` }, signal: AbortSignal.timeout(20000) });
    return r.ok ? null : `Resend answered ${r.status}`; } },
  LOB_API_KEY: { label: 'Letters by mail (Lob)', service: true, check: async (v) => {
    const r = await fetch('https://api.lob.com/v1/addresses?limit=1', { headers: { Authorization: 'Basic ' + Buffer.from(v + ':').toString('base64') }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) return `Lob answered ${r.status}`;
    return v.startsWith('live_') ? null : 'that is a Lob test key; letters only go out with a live_ key'; } },
  DOCUSEAL_API_KEY: { label: 'E-signature (DocuSeal)', service: true, check: async (v) => {
    const r = await fetch('https://api.docuseal.com/templates?limit=1', { headers: { 'X-Auth-Token': v }, signal: AbortSignal.timeout(20000) });
    return r.ok ? null : `DocuSeal answered ${r.status}`; } },
};

const render = async (method, p, body) => {
  const res = await fetch(RENDER + p, { method, signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${RENDER_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => null);
  if (!res.ok && !(method === 'DELETE' && res.status === 404)) throw new Error(`Render ${method} ${p.split('?')[0]}: ${res.status}`);
  return j;
};

let services = null; // [{id, name}]
const runnerServices = async () => {
  if (services) return services;
  const q = NAMES.map((n) => `name=${encodeURIComponent(n)}`).join('&');
  const list = await render('GET', `/services?${q}&limit=50`);
  services = (list || []).map((x) => x.service).filter((s) => s && NAMES.includes(s.name)).map((s) => ({ id: s.id, name: s.name }));
  if (!services.length) { services = null; throw new Error('runner cron jobs not found on Render'); }
  return services;
};

// The runner jobs need the Render key too: after each run they deploy what changed
// (runner/deploy.mjs), since Render's deploy-on-push isn't firing for this repo.
let keyShared = false;
const shareRenderKey = async (svcs) => {
  if (keyShared) return;
  let changed = false;
  for (const s of svcs) {
    const vars = await render('GET', `/services/${s.id}/env-vars?limit=100`);
    const cur = (vars || []).find((x) => x.envVar.key === 'RENDER_API_KEY');
    if (!cur || cur.envVar.value !== RENDER_KEY) { await render('PUT', `/services/${s.id}/env-vars/RENDER_API_KEY`, { value: RENDER_KEY }); changed = true; }
  }
  // The pipeline database (Render Postgres "probate-db"): give the runner jobs its private
  // address so each run copies the pipeline into it (runner/dbsync.mjs).
  const dbs = await render('GET', `/postgres?name=${encodeURIComponent(process.env.DB_NAME || 'probate-db')}&limit=5`);
  const db = (dbs || []).map((x) => x.postgres || x).find((d) => d && d.name === (process.env.DB_NAME || 'probate-db'));
  if (db) {
    const ci = await render('GET', `/postgres/${db.id}/connection-info`);
    const url = ci && ci.internalConnectionString;
    if (url) for (const s of svcs) {
      const vars = await render('GET', `/services/${s.id}/env-vars?limit=100`);
      const cur = (vars || []).find((x) => x.envVar.key === 'DATABASE_URL');
      if (!cur || cur.envVar.value !== url) { await render('PUT', `/services/${s.id}/env-vars/DATABASE_URL`, { value: url }); changed = true; }
    }
  }
  if (changed) await redeploy(svcs);   // so the jobs pick the new settings up
  keyShared = true;
};

const status = async () => {
  if (!RENDER_KEY) return { renderReady: false, services: [], keys: Object.fromEntries(Object.entries(KEYS).map(([k, d]) => [k, { label: d.label, service: !!d.service, set: false, last4: '' }])) };
  const svcs = await runnerServices();
  await shareRenderKey(svcs).catch((e) => console.log('render key share failed:', e.message));
  const vars = await render('GET', `/services/${svcs[0].id}/env-vars?limit=100`);
  const have = Object.fromEntries((vars || []).map((x) => [x.envVar.key, x.envVar.value || '']));
  return { renderReady: true, services: svcs.map((s) => s.name),
    keys: Object.fromEntries(Object.entries(KEYS).map(([k, d]) => [k, { label: d.label, service: !!d.service, set: !!have[k], last4: have[k] ? have[k].slice(-4) : '' }])) };
};

const redeploy = (svcs) => Promise.allSettled(svcs.map((s) => render('POST', `/services/${s.id}/deploys`, { clearCache: 'do_not_clear' })));

// value null/'' removes the key.
const setKey = async (name, value) => {
  if (!KEYS[name]) return { ok: false, error: 'unknown key' };
  if (!RENDER_KEY) return { ok: false, error: 'RENDER_API_KEY is not set on the dashboard service yet' };
  const svcs = await runnerServices();
  if (value) {
    value = String(value).trim();
    if (!/^[\x21-\x7e]{16,400}$/.test(value)) return { ok: false, error: 'that doesn\'t look like an API key' };
    let bad;
    try { bad = await KEYS[name].check(value); } catch (e) { bad = `couldn't reach the provider to check it (${e.name})`; }
    if (bad) return { ok: false, error: bad };
    for (const s of svcs) await render('PUT', `/services/${s.id}/env-vars/${name}`, { value });
  } else {
    for (const s of svcs) await render('DELETE', `/services/${s.id}/env-vars/${name}`);
  }
  await redeploy(svcs);
  return { ok: true, last4: value ? value.slice(-4) : '' };
};

// On boot, share the key with the runner jobs without waiting for someone to open the page.
if (RENDER_KEY) runnerServices().then(shareRenderKey).then(() => console.log('render key shared with runner jobs'))
  .catch((e) => console.log('render key share failed:', e.message));

module.exports = { status, setKey, KEYS };
