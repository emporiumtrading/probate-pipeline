/* store.js — document store backing the dashboard's db API (owner decisions,
   setup areas). Firestore-shaped: docs addressed by slash paths.

   Primary backend: a `docs.json` file committed to the repo on a dedicated
   `dashboard-store` branch via the GitHub Contents API. Git history = durable
   storage that survives Render's ephemeral filesystem, and a separate branch
   means writes don't trigger redeploy loops.

   Fallback: local JSON file (DB_PATH), used when GITHUB_TOKEN/GITHUB_REPO
   aren't set — e.g. local development. */
'use strict';
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = process.env.GITHUB_REPO || '';
const BRANCH = process.env.GITHUB_BRANCH || 'dashboard-store';
const FILE_PATH = 'docs.json';
const LOCAL_PATH = process.env.DB_PATH || path.join(__dirname, 'store.json');

let docs = {};        // path -> object
let sha = null;       // GitHub blob sha of docs.json
let writeTimer = null;
let writeChain = Promise.resolve();

/* ---------- GitHub Contents API ---------- */

const gh = async (method, p, body) => {
  const res = await fetch(`https://api.github.com${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'probate-dashboard',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404) return null;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GitHub ${method} ${p}: ${res.status} ${j.message || ''}`);
  return j;
};

const ensureBranch = async () => {
  if (await gh('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`)) return;
  const repo = await gh('GET', `/repos/${REPO}`);
  const ref = await gh('GET', `/repos/${REPO}/git/ref/heads/${repo.default_branch}`);
  await gh('POST', `/repos/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: ref.object.sha });
  console.log(`store: created branch ${BRANCH}`);
};

const ghLoad = async () => {
  const f = await gh('GET', `/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`);
  if (!f) { sha = null; return {}; }
  sha = f.sha;
  return JSON.parse(Buffer.from(f.content, 'base64').toString('utf8'));
};

const ghPersist = async () => {
  const body = {
    message: 'Dashboard store update',
    content: Buffer.from(JSON.stringify(docs)).toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await gh('PUT', `/repos/${REPO}/contents/${FILE_PATH}`, body);
  sha = res.content.sha;
};

/* ---------- local file backend ---------- */

const fileLoad = () => {
  try { return JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf8')); } catch { return {}; }
};
const filePersist = async () => {
  fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_PATH, JSON.stringify(docs, null, 2));
};

const useGitHub = !!(TOKEN && REPO);
const persist = useGitHub ? ghPersist : filePersist;

/* ---------- public API ---------- */

const init = async () => {
  if (useGitHub) {
    await ensureBranch();
    docs = await ghLoad();
    console.log(`store: github backend, ${Object.keys(docs).length} docs on ${BRANCH}`);
  } else {
    docs = fileLoad();
    console.log(`store: local file backend (${LOCAL_PATH}), ${Object.keys(docs).length} docs`);
  }
};

// Debounced + serialized writes: rapid clicks coalesce into one commit.
const schedulePersist = () => {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeChain = writeChain
      .then(() => persist())
      .catch((e) => console.error('store persist failed:', e.message));
  }, useGitHub ? 1500 : 0);
};

const setDoc = async (docPath, data) => {
  docs[docPath] = { ...data };
  schedulePersist();
};

const getDoc = (docPath) => (Object.prototype.hasOwnProperty.call(docs, docPath) ? docs[docPath] : null);

// Docs whose path is exactly one level below colPath; returns [{id, ...fields}].
const listCol = (colPath) => {
  const prefix = colPath.replace(/\/+$/, '') + '/';
  return Object.entries(docs)
    .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    .map(([p, d]) => ({ id: p.slice(prefix.length), ...d }));
};

module.exports = { init, setDoc, getDoc, listCol, useGitHub };
