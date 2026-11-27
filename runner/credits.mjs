/* credits.mjs — know what the AI engines can spend before a run starts (owner decision 2026-11-27).

   Claude (Anthropic): Anthropic has no API for the prepaid credit balance, so each run makes one tiny test call
   (1 output token on the cheapest model, a fraction of a cent). "Credit balance is too low" means Claude is skipped
   for this run (no wasted attempts) and the owner is emailed once a day (runner/notify.py). Every Claude attempt's
   real cost (from Claude Code's own report) is added to pipeline/ai-spend.csv; with a monthly budget in config.yaml
   (ai_budget.claude_monthly_usd), Claude is held to its cheapest model past 80% and skipped at 100% until next month.

   OpenRouter: its key API reports the limit left and whether the account is on the free tier (50 free-model requests
   a day, or 1,000 once $10 of credit was ever bought; 20 a minute either way). The runner keeps its own daily count,
   paces requests under the per-minute cap and stops, instead of retrying, when the day's cap is reached.

   State: pipeline/ai-credits.json (no keys). */
import fs from 'node:fs';
import path from 'node:path';

const today = () => new Date().toISOString().slice(0, 10);
const month = () => new Date().toISOString().slice(0, 7);
const statePath = (cwd) => path.join(cwd, 'pipeline', 'ai-credits.json');
export const readState = (cwd) => { try { return JSON.parse(fs.readFileSync(statePath(cwd), 'utf8')); } catch { return {}; } };
export const writeState = (cwd, s) => fs.writeFileSync(statePath(cwd), JSON.stringify(s, null, 1) + '\n');

const budgetUsd = (cwd) => {
  const m = fs.readFileSync(path.join(cwd, 'config.yaml'), 'utf8').match(/^\s+claude_monthly_usd:\s*([\d.]+)/m);
  return m ? +m[1] : 0;
};

export const monthSpend = (cwd) => {
  const p = path.join(cwd, 'pipeline', 'ai-spend.csv');
  if (!fs.existsSync(p)) return 0;
  return fs.readFileSync(p, 'utf8').split('\n').slice(1).filter((l) => l.startsWith(month()))
    .reduce((t, l) => t + (+l.split(',')[4] || 0), 0);
};

// The cost Claude Code reports at the end of a run (stream-json output: "total_cost_usd").
export const recordSpend = (cwd, slice, engine, model, tail) => {
  const all = [...String(tail).matchAll(/"total_cost_usd"\s*:\s*([\d.]+)/g)];
  if (!all.length) return 0;
  const usd = +all[all.length - 1][1];
  const p = path.join(cwd, 'pipeline', 'ai-spend.csv');
  if (!fs.existsSync(p)) fs.writeFileSync(p, 'date,slice,engine,model,cost_usd\n');
  fs.appendFileSync(p, `${new Date().toISOString()},${slice},${engine},${model},${usd.toFixed(4)}\n`);
  return usd;
};

async function claude(cwd, state, models) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: !!process.env.CLAUDE_CODE_OAUTH_TOKEN, why: 'no API key to test' };
  let ok = true;
  let why = 'credit ok';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: AbortSignal.timeout(30000),
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: models[0], max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }),
    });
    if (!r.ok) {
      const t = (await r.text()).slice(0, 300);
      if (/credit balance/i.test(t)) { ok = false; why = 'credit balance too low (add credit at console.anthropic.com, Settings, Billing)'; }
      else if (r.status === 401 || r.status === 403) { ok = false; why = `key refused (${r.status})`; }
      else why = `test call answered ${r.status}; trying anyway`;   // overloaded or rate-limited: not a credit problem
    }
  } catch (e) { why = `test call failed (${e.name}); trying anyway`; }
  const prev = state.claude || {};
  state.claude = { ...prev, checked: new Date().toISOString(), ok, why,
    blocked_since: ok ? '' : (prev.blocked_since || new Date().toISOString()) };
  const budget = budgetUsd(cwd);
  const spent = monthSpend(cwd);
  let cap = null;
  if (ok && budget > 0) {
    if (spent >= budget) { ok = false; why = `monthly budget used ($${spent.toFixed(2)} of $${budget})`; }
    else if (spent >= 0.8 * budget) { cap = models[0]; why += `; past 80% of the $${budget} monthly budget, cheapest model only`; }
  }
  state.claude.month = month();
  state.claude.month_spend_usd = +spent.toFixed(2);
  state.claude.budget_usd = budget;
  return { ok, why, cap };
}

async function openrouter(state) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, why: 'no key' };
  const o = state.openrouter && state.openrouter.day === today() ? state.openrouter : { day: today(), requests: 0 };
  let free = true;
  let left = null;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) });
    if (r.status === 401 || r.status === 403) return { ok: false, why: `key refused (${r.status})` };
    const j = (await r.json().catch(() => ({}))).data || {};
    free = j.is_free_tier !== false;
    left = j.limit_remaining ?? null;
  } catch { /* keep the local count */ }
  const daily = free ? 50 : 1000;
  const remaining = Math.max(0, daily - (o.requests || 0) - 2);   // a small reserve
  state.openrouter = { ...o, free_tier: free, daily_cap: daily, credit_left: left };
  if (o.exhausted === today() || remaining < 5) {
    return { ok: false, why: `daily cap reached (${o.requests || 0}/${daily} today${free ? '; $10 of credit raises it to 1,000' : ''})` };
  }
  if (left !== null && left <= 0 && !free) return { ok: false, why: 'no credit left on the key' };
  return { ok: true, why: `${remaining} requests left today`, minIntervalMs: 3200, maxRequests: remaining };
}

export async function checkCredits(cwd, claudeModels) {
  const state = readState(cwd);
  const out = { claude: await claude(cwd, state, claudeModels), openrouter: await openrouter(state) };
  writeState(cwd, state);
  return out;
}

export function noteOpenrouter(cwd, used, exhausted) {
  const s = readState(cwd);
  const o = s.openrouter && s.openrouter.day === today() ? s.openrouter : { day: today(), requests: 0 };
  o.requests = (o.requests || 0) + used;
  if (exhausted) o.exhausted = today();
  s.openrouter = { ...(s.openrouter || {}), ...o };
  writeState(cwd, s);
}
