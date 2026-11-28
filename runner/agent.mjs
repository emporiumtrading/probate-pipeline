/* agent.mjs — a small tool-using agent for OpenAI-compatible APIs (NVIDIA
   build.nvidia.com, OpenRouter). It is the backup engine when Claude is
   unavailable: it runs the same slice prompt against the same repo clone with
   the same kind of tools (shell, read, write, edit), so it can work the whole
   runbook, not just write summaries.

   runAgent({provider, model, prompt, cwd, env, minutes}) -> {ok, reason, steps}
   ok=false means the caller should fall back to the next engine. */
'use strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const PROVIDERS = {
  nvidia: { url: 'https://integrate.api.nvidia.com/v1/chat/completions', keyEnv: 'NVIDIA_API_KEY',
    defaultModel: 'meta/llama-3.3-70b-instruct' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', keyEnv: 'OPENROUTER_API_KEY',
    defaultModel: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
};

const OUT_LIMIT = 12000;          // chars of one tool result kept in the conversation
const HISTORY_LIMIT = 260000;     // total chars before old tool results are shortened
const MAX_STEPS = +(process.env.AGENT_MAX_STEPS || 250);

const TOOLS = [
  { type: 'function', function: { name: 'bash', description: 'Run a bash command in the repo (git, python3, grep, ls, curl...). Returns stdout+stderr and the exit code.',
    parameters: { type: 'object', properties: { command: { type: 'string' }, timeout_seconds: { type: 'integer', description: 'default 300, max 1200' } }, required: ['command'] } } },
  { type: 'function', function: { name: 'read_file', description: 'Read a text file (path relative to the repo). Optional 1-based line offset and line limit.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, offset: { type: 'integer' }, limit: { type: 'integer' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Create or overwrite a text file (path relative to the repo).',
    parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } } },
  { type: 'function', function: { name: 'edit_file', description: 'Replace one exact, unique occurrence of old_text with new_text in a file.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } }, required: ['path', 'old_text', 'new_text'] } } },
];

const SYSTEM = `You are an autonomous worker running a scheduled job for a probate real-estate pipeline. You work in a git clone of the pipeline repo through tools: bash, read_file, write_file, edit_file.
Rules:
- Start by reading CLAUDE.md (project rules), then follow the job instructions exactly, step by step, using the repo's own scripts.
- The "Hard limits" in .claude/skills/probate-wholesale-deal/references/daily-run.md always apply: never phone or text, never sign for the owner, never handle bank details or wiring instructions, public records only, never bypass logins/CAPTCHAs/robots.txt/rate limits, and send nothing that the autonomy rules and the Compliance gate don't allow.
- Never invent facts. Label what is verified (with source and date) and what is assumed.
- Keep personal data inside the repo. Never print or commit API keys or tokens.
- Prefer small, checked steps. After changing data files, run the checks the runbook names.
- Commit with clear messages and push to origin main as the instructions say (git pull --rebase first; never force-push).
- References to claude.ai-only tools (get_session, db_list, artifacts, connectors) don't apply here; the job text says what to use instead.
- When the job is complete, reply with a short plain-text summary and no tool call.`;

const clip = (s, n = OUT_LIMIT) => (s.length > n ? s.slice(0, n / 2) + `\n…[${s.length - n} chars cut]…\n` + s.slice(-n / 2) : s);

const inside = (cwd, p) => {
  const f = path.resolve(cwd, String(p || ''));
  if (f !== cwd && !f.startsWith(cwd + path.sep)) throw new Error('path outside the repo');
  return f;
};

const runBash = (command, cwd, env, timeoutS) => new Promise((resolve) => {
  const t = Math.min(Math.max(+timeoutS || 300, 5), 1200);
  const child = spawn('bash', ['-lc', command], { cwd, env });
  let out = '';
  const add = (d) => { out += d; if (out.length > 400000) out = out.slice(-200000); };
  child.stdout.on('data', add); child.stderr.on('data', add);
  const kill = setTimeout(() => { out += `\n[killed after ${t}s]`; child.kill('SIGKILL'); }, t * 1000);
  child.on('close', (code) => { clearTimeout(kill); resolve(`exit ${code}\n${out}`); });
});

const doTool = async (name, args, cwd, env) => {
  try {
    if (name === 'bash') return await runBash(String(args.command || ''), cwd, env, args.timeout_seconds);
    if (name === 'read_file') {
      const lines = fs.readFileSync(inside(cwd, args.path), 'utf8').split('\n');
      const from = Math.max((+args.offset || 1) - 1, 0);
      const to = args.limit ? from + +args.limit : lines.length;
      return lines.slice(from, to).map((l, i) => `${from + i + 1}\t${l}`).join('\n');
    }
    if (name === 'write_file') {
      const f = inside(cwd, args.path);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, String(args.content ?? ''));
      return `wrote ${args.path}`;
    }
    if (name === 'edit_file') {
      const f = inside(cwd, args.path);
      const s = fs.readFileSync(f, 'utf8');
      const n = s.split(String(args.old_text)).length - 1;
      if (n !== 1) return `edit refused: old_text found ${n} times (must be exactly 1)`;
      fs.writeFileSync(f, s.replace(String(args.old_text), () => String(args.new_text)));
      return `edited ${args.path}`;
    }
    return `unknown tool ${name}`;
  } catch (e) { return `error: ${e.message}`; }
};

// Keep the conversation under HISTORY_LIMIT by shortening the oldest tool results.
const trim = (messages) => {
  let total = messages.reduce((n, m) => n + (m.content ? m.content.length : 0) + JSON.stringify(m.tool_calls || '').length, 0);
  for (let i = 2; i < messages.length - 6 && total > HISTORY_LIMIT; i++) {
    const m = messages[i];
    if (m.role === 'tool' && m.content.length > 300) { total -= m.content.length - 120; m.content = m.content.slice(0, 120) + ' …[older output removed]'; }
  }
};

export async function runAgent({ provider, model, prompt, cwd, env, minutes, minIntervalMs = 0, maxRequests = Infinity }) {
  const P = PROVIDERS[provider];
  const key = P && process.env[P.keyEnv];
  if (!key) return { ok: false, reason: `no ${P ? P.keyEnv : provider}`, steps: 0 };
  const deadline = Date.now() + minutes * 60000;
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }];
  let failures = 0, requests = 0, last = 0;
  // Throttling (runner/credits.mjs): pace calls under the provider's per-minute cap, never pass the day's allowance,
  // wait out a per-minute 429 instead of counting it as a failure, and stop at once on a daily cap.
  const done = (r) => ({ ...r, requests });
  for (let step = 1; step <= MAX_STEPS; step++) {
    if (Date.now() > deadline) return done({ ok: false, reason: `time budget of ${minutes}m used`, steps: step });
    if (requests >= maxRequests) return done({ ok: false, reason: `daily request allowance used (${requests})`, steps: step, exhausted: true });
    const wait = last + minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now(); requests++;
    trim(messages);
    let reply;
    try {
      const res = await fetch(P.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'probate-pipeline-runner' },
        body: JSON.stringify({ model, messages, tools: TOOLS, tool_choice: 'auto', temperature: 0.1, max_tokens: 4096 }),
        signal: AbortSignal.timeout(180000),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`${res.status} ${(j.error && (j.error.message || j.error)) || j.detail || ''}`.slice(0, 300));
      reply = j.choices && j.choices[0] && j.choices[0].message;
      if (!reply) throw new Error('empty reply');
      failures = 0;
    } catch (e) {
      if (/per-day|per day|daily/i.test(e.message) && /429|rate limit/i.test(e.message)) {
        console.log(`[${provider}] daily cap reached: ${e.message.slice(0, 160)}`);
        return done({ ok: false, reason: `api errors: ${e.message}`, steps: step, exhausted: true });
      }
      if (/^429/.test(e.message) && /per-min|per minute|rate limit/i.test(e.message)) {
        console.log(`[${provider}] per-minute limit: waiting 60s`);
        await new Promise((r) => setTimeout(r, 60000));
        step--; continue;
      }
      failures++;
      console.log(`[${provider}] api error (${failures}/3): ${e.message}`);
      if (failures >= 3) return done({ ok: false, reason: `api errors: ${e.message}`, steps: step });
      await new Promise((r) => setTimeout(r, 5000 * failures));
      step--; continue;
    }
    const calls = reply.tool_calls || [];
    messages.push({ role: 'assistant', content: reply.content || '', ...(calls.length ? { tool_calls: calls } : {}) });
    if (!calls.length) {
      if (step === 1) return done({ ok: false, reason: 'model answered without doing any work (no tool use)', steps: step });
      console.log(`[${provider}] done after ${step} steps: ${clip(reply.content || '', 1500)}`);
      return done({ ok: true, reason: 'completed', steps: step });
    }
    for (const c of calls) {
      let args = {};
      try { args = JSON.parse(c.function.arguments || '{}'); } catch { args = {}; }
      const label = c.function.name === 'bash' ? String(args.command || '').slice(0, 160) : String(args.path || '');
      console.log(`[${provider}] ${step}: ${c.function.name} ${label.replace(/\s+/g, ' ')}`);
      const out = await doTool(c.function.name, args, cwd, env);
      messages.push({ role: 'tool', tool_call_id: c.id, content: clip(out) });
    }
  }
  return done({ ok: false, reason: `step limit ${MAX_STEPS} reached`, steps: MAX_STEPS });
}
