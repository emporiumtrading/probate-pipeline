/* run.mjs — Render cron entrypoint for the pipeline runners.

   Replaces the claude.ai scheduled sessions with a headless Claude Code run
   against a fresh clone of this repo. Steps:

   1. Clone the pipeline repo (GitHub token auth).
   2. Pull the dashboard doc store (docs.json on the store repo's
      dashboard-store branch) and build the import files the owner_*.py
      scripts expect — replacing the artifact's db_list calls.
   3. Run `claude -p` headless on the slice's prompt file. The agent reads the
      repo (its memory), does the work, commits, and pushes — exactly like the
      claude.ai sessions did. Render rebuilds the dashboard on that push.
   4. Backstop `git push` so a slice that forgot still saves.

   Usage: node run.mjs <a|b|c|fast-desk>

   Env: GITHUB_TOKEN (required), PIPELINE_REPO, STORE_REPO, STORE_BRANCH,
        MODEL (sonnet|opus|model id), MAX_MINUTES, plus either
        CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY for the agent itself. */
'use strict';
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SLICE = process.argv[2] || 'a';
const PIPELINE_REPO = process.env.PIPELINE_REPO || 'emporiumtrading/probate-pipeline';
const STORE_REPO = process.env.STORE_REPO || 'emporiumtrading/probate-dashboard-store';
const STORE_BRANCH = process.env.STORE_BRANCH || 'dashboard-store';
const TOKEN = process.env.GITHUB_TOKEN;
const MODEL = process.env.MODEL || 'sonnet';
const MAX_MINUTES = +(process.env.MAX_MINUTES || 110);
const WORK = process.env.WORK_DIR || '/tmp/pipeline-work';

if (!TOKEN) { console.error('GITHUB_TOKEN is required'); process.exit(1); }
// ENGINE: 'scripted' (default; free) runs scripts/auto_slice.py, which uses free NVIDIA / OpenRouter
// models only for written summaries. 'claude' runs headless Claude Code (needs a Claude credential).
const ENGINE = process.env.ENGINE || ((process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY) ? 'claude' : 'scripted');
if (ENGINE === 'claude' && !process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
  console.error('ENGINE=claude needs CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY'); process.exit(1);
}

const git = (args, opts = {}) => spawnSync('git', args, { cwd: WORK, stdio: 'inherit', ...opts });

const ghApi = async (p) => {
  const res = await fetch(`https://api.github.com${p}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'probate-runner' },
  });
  if (res.status === 404) return null;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GitHub ${p}: ${res.status} ${j.message || ''}`);
  return j;
};

/* ---------- 1. clone ---------- */
fs.rmSync(WORK, { recursive: true, force: true });
let r = spawnSync('git', ['clone', '--quiet', `https://x-access-token:${TOKEN}@github.com/${PIPELINE_REPO}.git`, WORK], { stdio: 'inherit' });
if (r.status !== 0) { console.error('clone failed'); process.exit(1); }

// Commits inside the run identify themselves without touching global config.
const agentEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Pipeline runner', GIT_AUTHOR_EMAIL: 'runner@probate-pipeline.local',
  GIT_COMMITTER_NAME: 'Pipeline runner', GIT_COMMITTER_EMAIL: 'runner@probate-pipeline.local',
};

/* ---------- 2. sync the doc store into import files ---------- */
// store docs.json: {"data/users/<uid>/<collection...>/<docId>": {...fields}}
const storeFile = await ghApi(`/repos/${STORE_REPO}/contents/docs.json?ref=${STORE_BRANCH}`);
const storeDocs = storeFile ? JSON.parse(Buffer.from(storeFile.content, 'base64').toString('utf8')) : {};

const IMP = path.join(WORK, 'store', 'import');
fs.mkdirSync(IMP, { recursive: true });
const importFile = (name, colPath) => {
  const docs = Object.entries(storeDocs)
    .filter(([p]) => p.includes(`/${colPath}/`))
    .map(([p, data]) => ({ id: p.split('/').pop(), data }));
  fs.writeFileSync(path.join(IMP, `${name}.json`), JSON.stringify({ docs }));
  return docs.length;
};
const counts = {
  outreach: importFile('outreach', 'decisions/outreach'), sign: importFile('sign', 'decisions/sign'),
  wire: importFile('wire', 'decisions/wire'), exceptions: importFile('exceptions', 'decisions/exceptions'),
  'setup-areas': importFile('setup-areas', 'setup/areas'),
};
console.log('store import docs:', JSON.stringify(counts));

/* ---------- 3. run the slice ---------- */
let code;
if (ENGINE === 'scripted') {
  console.log(`--- slice ${SLICE} | scripted engine | ${new Date().toISOString()} ---`);
  const pyArgs = ['scripts/auto_slice.py', SLICE];
  const child = spawn('python3', pyArgs, { cwd: WORK, env: agentEnv, stdio: 'inherit' });
  const kill = setTimeout(() => { console.error(`timeout after ${MAX_MINUTES}m — killing`); child.kill('SIGTERM'); }, MAX_MINUTES * 60000);
  code = await new Promise((resolve) => child.on('close', resolve));
  clearTimeout(kill);
  git(['add', '-A']);
  const d0 = spawnSync('git', ['status', '--porcelain'], { cwd: WORK, encoding: 'utf8' });
  if (d0.stdout.trim()) git(['commit', '-q', '-m', `Scheduled run ${new Date().toISOString().slice(0, 10)} slice ${SLICE} (scripted)`]);
} else {
const promptPath = path.join(WORK, 'runner', 'prompts', `${SLICE}.md`);
if (!fs.existsSync(promptPath)) { console.error(`no prompt for slice '${SLICE}' (${promptPath})`); process.exit(1); }
const prompt = fs.readFileSync(promptPath, 'utf8');

// The pinned claude-code binary installed by `npm ci` next to this file —
// npx would resolve from the clone dir and miss it.
const CLAUDE_BIN = path.join(path.dirname(new URL(import.meta.url).pathname), 'node_modules', '.bin', 'claude');
console.log(`--- slice ${SLICE} | model ${MODEL} | ${new Date().toISOString()} ---`);
const child = spawn(CLAUDE_BIN, ['-p', prompt, '--model', MODEL, '--dangerously-skip-permissions', '--verbose'], {
  cwd: WORK, env: agentEnv, stdio: 'inherit',
});
const kill = setTimeout(() => { console.error(`timeout after ${MAX_MINUTES}m — killing`); child.kill('SIGTERM'); }, MAX_MINUTES * 60000);
code = await new Promise((resolve) => child.on('close', resolve));
clearTimeout(kill);
console.log(`--- agent exited ${code} ---`);
}

/* ---------- 4. backstop push ---------- */
git(['add', '-A']);
const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: WORK, encoding: 'utf8' });
if (dirty.stdout.trim()) git(['commit', '-m', `Runner slice ${SLICE} (uncommitted leftovers)`]);
git(['pull', '--rebase', 'origin', 'main']);
git(['push', 'origin', 'HEAD:main']);
process.exit(code ?? 0);
