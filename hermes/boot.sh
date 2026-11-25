#!/bin/bash
# boot.sh — configure Hermes for the probate pipeline on every start, then run the gateway.
# Everything here is rebuilt from the repo and the service's env on each boot; Hermes's own
# memories, sessions and cron jobs live in $HERMES_HOME (/opt/data, a persistent disk).
set -u
HH="${HERMES_HOME:-/opt/data}"
REPO="${PIPELINE_REPO:-emporiumtrading/probate-pipeline}"
WS="$HH/workspace/probate-pipeline"
log() { echo "[probate-hermes] $*"; }
mkdir -p "$HH/workspace"

# 1. The pipeline repo is Hermes's workspace (CLAUDE.md there is loaded as project context).
if [ -n "${GITHUB_TOKEN:-}" ]; then
  URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git"
  if [ -d "$WS/.git" ]; then
    git -C "$WS" remote set-url origin "$URL"
    git -C "$WS" fetch -q origin main && git -C "$WS" checkout -q main && git -C "$WS" pull -q --rebase origin main || log "pull failed; working copy kept as is"
  else
    git clone -q "$URL" "$WS" && log "workspace cloned" || log "clone failed"
  fi
  git -C "$WS" config user.name "Hermes" 2>/dev/null
  git -C "$WS" config user.email "hermes@probate-pipeline.local" 2>/dev/null
else
  log "no GITHUB_TOKEN yet: Hermes can chat but can't work on the repo (the dashboard copies it here once RENDER_API_KEY is set)"
  mkdir -p "$WS"
fi

# 2. Model: Claude first, then NVIDIA, then OpenRouter, from whichever keys this service has.
PRIMARY=""; FALLBACKS=""
add_fb() { FALLBACKS="${FALLBACKS}  - provider: $1
    model: \"$2\"
"; }
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then PRIMARY="anthropic|${HERMES_CLAUDE_MODEL:-claude-sonnet-5-5}"; fi
if [ -n "${NVIDIA_API_KEY:-}" ]; then
  export NVIDIA_BASE_URL="${NVIDIA_BASE_URL:-https://integrate.api.nvidia.com/v1}"
  if [ -z "$PRIMARY" ]; then PRIMARY="nvidia|${HERMES_NVIDIA_MODEL:-meta/llama-3.3-70b-instruct}"; else add_fb nvidia "${HERMES_NVIDIA_MODEL:-meta/llama-3.3-70b-instruct}"; fi
fi
if [ -n "${OPENROUTER_API_KEY:-}" ]; then
  if [ -z "$PRIMARY" ]; then PRIMARY="openrouter|${HERMES_OPENROUTER_MODEL:-meta-llama/llama-3.3-70b-instruct:free}"; else add_fb openrouter "${HERMES_OPENROUTER_MODEL:-meta-llama/llama-3.3-70b-instruct:free}"; fi
fi
[ -z "$PRIMARY" ] && log "no AI key yet: add Claude or NVIDIA keys on the dashboard's Setup page"
PROV="${PRIMARY%%|*}"; MODEL="${PRIMARY#*|}"

cat > "$HH/config.yaml" <<YAML
# Written by /opt/probate/boot.sh on every start; edit hermes/boot.sh in the repo instead.
model:
  provider: "${PROV:-anthropic}"
  default: "${MODEL:-claude-sonnet-5-5}"
$( [ -n "$FALLBACKS" ] && printf 'fallback_providers:\n%s' "$FALLBACKS" )
terminal:
  backend: local
  cwd: "$WS"
  timeout: 900
approvals:
  mode: smart
  unattended_mode: approve
  cron_mode: approve
  deny:
    - "git push --force*"
    - "git push -f*"
    - "git push*--force*"
    - "git reset --hard origin*"
    - "*--owner-approve-guardrails*"
    - "*guardrails.sha256*"
    - "rm -rf $HH*"
    - "rm -rf $WS"
    - "rm -rf ."
cron:
  catch_up_missed: false
  allow_agent_scheduling: true
gateway:
  api_server:
    enabled: true
    host: "0.0.0.0"
    port: ${API_SERVER_PORT:-8642}
    model_name: "hermes"
YAML

# 3. Hermes's operating rules (persona), from the repo.
cp /opt/probate/SOUL.md "$HH/SOUL.md"

# 4. Autonomous supervision: once an hour, check the pipeline and fix what needs fixing.
if [ ! -f "$HH/.probate-cron-v1" ] && [ -n "$PRIMARY" ]; then
  hermes cron create "every 1h" "Hourly supervision of the probate pipeline: follow the 'Hourly supervision' section of your SOUL.md. If nothing needs you, stop after the checks without writing anything." \
    --name probate-supervisor --workdir "$WS" >/dev/null 2>&1 && touch "$HH/.probate-cron-v1" && log "hourly supervision scheduled" || log "couldn't schedule supervision yet"
fi

log "starting gateway: model ${PROV:-none} ${MODEL:-}, API on :${API_SERVER_PORT:-8642}"
cd "$WS"
exec hermes gateway run
