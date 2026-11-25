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

const status = async () => {
  if (!RENDER_KEY) return { renderReady: false, services: [], keys: Object.fromEntries(Object.entries(KEYS).map(([k, d]) => [k, { label: d.label, set: false, last4: '' }])) };
  const svcs = await runnerServices();
  const vars = await render('GET', `/services/${svcs[0].id}/env-vars?limit=100`);
  const have = Object.fromEntries((vars || []).map((x) => [x.envVar.key, x.envVar.value || '']));
  return { renderReady: true, services: svcs.map((s) => s.name),
    keys: Object.fromEntries(Object.entries(KEYS).map(([k, d]) => [k, { label: d.label, set: !!have[k], last4: have[k] ? have[k].slice(-4) : '' }])) };
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

module.exports = { status, setKey, KEYS };
