/* ops-api.js — Hermes's narrow door to Render, through the dashboard.

   Hermes doesn't hold the Render API key (that key can read every service's secrets and
   delete services). Instead it calls these few endpoints with its own key (HERMES_API_KEY,
   the same value as API_SERVER_KEY on Hermes), and the dashboard does the Render call:
     GET  /api/ops/services                 status and latest deploy of the pipeline services
     POST /api/ops/run    {"service": ...}  start a cron job run now (the four runner jobs only)
     POST /api/ops/deploy {"service": ...}  redeploy a pipeline service
     GET  /api/ops/logs?service=&limit=     recent log lines of a pipeline service
     GET  /api/ops/db/<view>?...            the Data page's read-only database views
   Runs and deploys are capped at 12 an hour. Every call is logged. */
'use strict';
const crypto = require('crypto');

const RENDER = 'https://api.render.com/v1';
const RENDER_KEY = process.env.RENDER_API_KEY || '';
const HERMES_KEY = process.env.HERMES_API_KEY || '';
const DASH = process.env.DASHBOARD_SERVICE || 'probate-dashboard';
const CRONS = ['probate-slice-a', 'probate-slice-b', 'probate-slice-c', 'probate-fast-desk'];
const ALLOWED = [...CRONS, DASH, process.env.HERMES_SERVICE || 'probate-hermes'];
const MAX_ACTIONS_PER_HOUR = 12;

const digest = (v) => crypto.createHash('sha256').update(String(v)).digest();
const authorized = (req) => {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  return !!(HERMES_KEY && m && crypto.timingSafeEqual(digest(m[1]), digest(HERMES_KEY)));
};

const render = async (method, p, body) => {
  const r = await fetch(RENDER + p, { method, signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${RENDER_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error(`Render answered ${r.status}`); e.status = 502; throw e; }
  return j;
};

let cache = null, cachedAt = 0;
const services = async () => {
  if (cache && Date.now() - cachedAt < 600000) return cache;
  const list = await render('GET', `/services?${ALLOWED.map((n) => 'name=' + encodeURIComponent(n)).join('&')}&limit=50`);
  cache = (list || []).map((x) => x.service).filter((s) => s && ALLOWED.includes(s.name));
  cachedAt = Date.now();
  return cache;
};
const find = async (name) => {
  const s = (await services()).find((x) => x.name === name);
  if (!s) { const e = new Error(`not a pipeline service: ${String(name).slice(0, 40)}`); e.status = 400; throw e; }
  return s;
};

const actions = [];
const spend = () => {
  const now = Date.now();
  while (actions.length && now - actions[0] > 3600000) actions.shift();
  if (actions.length >= MAX_ACTIONS_PER_HOUR) { const e = new Error('limit reached: 12 runs or deploys an hour'); e.status = 429; throw e; }
  actions.push(now);
};

async function handle(req, res, p, u, send, readBody, db) {
  const json = (code, v) => send(res, code, JSON.stringify(v), 'application/json; charset=utf-8');
  if (!authorized(req)) return send(res, 401, 'not authorized');
  if (!RENDER_KEY && !p.startsWith('/api/ops/db/')) return json(503, { error: 'RENDER_API_KEY is not set on the dashboard yet' });
  try {
    if (p === '/api/ops/services' && req.method === 'GET') {
      const out = [];
      for (const s of await services()) {
        const d = (((await render('GET', `/services/${s.id}/deploys?limit=1`)) || [])[0] || {}).deploy || {};
        out.push({ name: s.name, type: s.type, suspended: s.suspended, schedule: s.serviceDetails && s.serviceDetails.schedule,
          lastDeploy: { status: d.status, commit: d.commit && d.commit.id && d.commit.id.slice(0, 7), finishedAt: d.finishedAt } });
      }
      console.log('ops: services');
      return json(200, out);
    }
    if ((p === '/api/ops/run' || p === '/api/ops/deploy') && req.method === 'POST') {
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, 'json only');
      const name = String((await readBody(req)).service || '');
      const s = await find(name);
      if (p === '/api/ops/run' && !CRONS.includes(name)) return json(400, { error: 'only the runner jobs can be started' });
      spend();
      if (p === '/api/ops/run') await render('POST', `/cron-jobs/${s.id}/runs`);
      else await render('POST', `/services/${s.id}/deploys`, { clearCache: 'do_not_clear' });
      console.log(`ops: ${p.slice(9)} ${name} (by Hermes)`);
      return json(200, { ok: true, started: p.slice(9), service: name });
    }
    if (p === '/api/ops/logs' && req.method === 'GET') {
      const s = await find(u.searchParams.get('service') || '');
      const limit = Math.min(Math.max(parseInt(u.searchParams.get('limit'), 10) || 100, 1), 500);
      const r = await render('GET', `/logs?ownerId=${encodeURIComponent(s.ownerId)}&resource=${encodeURIComponent(s.id)}&limit=${limit}&direction=backward`);
      const lines = ((r && r.logs) || []).map((l) => `${l.timestamp} ${l.message}`).reverse();
      return json(200, { service: s.name, lines });
    }
    if (p.startsWith('/api/ops/db/') && req.method === 'GET') {
      const fn = Object.prototype.hasOwnProperty.call(db.browse, p.slice(12)) ? db.browse[p.slice(12)] : null;
      if (!fn) return send(res, 404, 'not found');
      return json(200, await fn(Object.fromEntries(u.searchParams)));
    }
    return send(res, 404, 'not found');
  } catch (e) {
    if (!e.status) console.error('ops failed:', p, e.message);
    return json(e.status || 500, { error: e.status ? e.message : 'failed' });
  }
}

module.exports = { handle };
