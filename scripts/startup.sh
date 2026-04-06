#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# OpenClaw + ClawdTalk + Next.js — Unified Startup Script
#
# Runs on: Railway, VPS, or local machine
# Serves: Next.js frontend + OpenClaw Gateway + ClawdTalk WebSocket client
#
# IMPORTANT: Next.js starts FIRST so Railway's health check passes quickly.
# Gateway + ClawdTalk start in background after.
#
# Required env vars:
#   CLAWDTALK_API_KEY      - ClawdTalk API key (cc_live_...)
#   CLAWDTALK_BOT_ID       - ClawdTalk bot ID (bot_...)
#
# Optional env vars:
#   PORT                   - Public-facing port (Railway sets this; default 3000)
#   OPENCLAW_GATEWAY_PORT  - Internal gateway port (default: 18789)
#   OPENROUTER_API_KEY     - OpenRouter LLM key
#   ANTHROPIC_API_KEY      - Anthropic LLM key
#   OWNER_NAME             - Bot owner name (default: Murphy)
#   AGENT_NAME             - Bot agent name (default: Murphy)
# ============================================================================

PUBLIC_PORT="${PORT:-3000}"
GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
OWNER="${OWNER_NAME:-Murphy}"
AGENT="${AGENT_NAME:-Murphy}"
SKILLS_DIR="${HOME}/clawd/skills"
CLAWDTALK_DIR="${SKILLS_DIR}/clawdtalk-client"
OPENCLAW_DIR="${HOME}/.openclaw"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log() { echo "[startup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }
die() { log "FATAL: $*"; exit 1; }

GATEWAY_PID=""
NEXTJS_PID=""

cleanup() {
  log "Shutting down..."
  [[ -n "$GATEWAY_PID" ]] && kill "$GATEWAY_PID" 2>/dev/null || true
  [[ -n "$NEXTJS_PID" ]] && kill "$NEXTJS_PID" 2>/dev/null || true
  [[ -f "${CLAWDTALK_DIR}/scripts/connect.sh" ]] && \
    (cd "$CLAWDTALK_DIR" && bash scripts/connect.sh stop 2>/dev/null) || true
  wait 2>/dev/null || true
  log "Shutdown complete"
}
trap cleanup EXIT SIGTERM SIGINT

# ---------------------------------------------------------------------------
# 1. Validate
# ---------------------------------------------------------------------------
log "Checking environment..."
[[ -z "${CLAWDTALK_API_KEY:-}" ]] && die "CLAWDTALK_API_KEY is not set"
[[ -z "${CLAWDTALK_BOT_ID:-}" ]] && die "CLAWDTALK_BOT_ID is not set"
log "OK (public=${PUBLIC_PORT}, gateway=${GATEWAY_PORT})"

# ---------------------------------------------------------------------------
# 2. Start Next.js FIRST (health check target)
# ---------------------------------------------------------------------------
cd "$PROJECT_DIR"

# Copy static files into standalone (required for standalone mode)
if [[ -d ".next/standalone" ]]; then
  cp -r .next/static .next/standalone/.next/static 2>/dev/null || true
  cp -r public .next/standalone/public 2>/dev/null || true
fi

log "Starting Next.js (standalone) on port ${PUBLIC_PORT}..."
PORT="${PUBLIC_PORT}" HOSTNAME="0.0.0.0" node .next/standalone/server.js &
NEXTJS_PID=$!

# Wait for Next.js to be healthy (this is what Railway checks)
for i in $(seq 1 30); do
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PUBLIC_PORT}/api/health" 2>/dev/null || echo "000")
  if [[ "$http_code" == "200" ]]; then
    log "Next.js healthy after ${i}s"
    break
  fi
  [[ $i -eq 30 ]] && log "WARN: Next.js not yet healthy after 30s (continuing)"
  sleep 1
done

# ---------------------------------------------------------------------------
# 3. Write OpenClaw config
# ---------------------------------------------------------------------------
log "Writing openclaw.json..."
mkdir -p "${OPENCLAW_DIR}"
cat > "${OPENCLAW_DIR}/openclaw.json" <<CONF
{
  "gateway": {
    "bind": "loopback",
    "port": ${GATEWAY_PORT},
    "mode": "local",
    "tools": {
      "allow": ["sessions_send"]
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "openrouter/google/gemini-2.5-flash-lite",
        "fallbacks": ["anthropic/claude-sonnet-4-5"]
      }
    }
  }
}
CONF

# ---------------------------------------------------------------------------
# 4. Pre-pair device
# ---------------------------------------------------------------------------
if [[ -f "src/startup/pair-device.ts" ]]; then
  npx tsx src/startup/pair-device.ts 2>&1 || log "WARN: pair-device failed"
fi

# Write workspace files (Murphy persona)
if [[ -f "src/startup/openclaw-config.ts" ]]; then
  npx tsx -e "
    const { writeWorkspaceFiles } = require('./src/startup/openclaw-config.ts');
    writeWorkspaceFiles();
  " 2>&1 || log "WARN: writeWorkspaceFiles failed"
fi

# ---------------------------------------------------------------------------
# 5. Start OpenClaw Gateway
# ---------------------------------------------------------------------------
log "Starting OpenClaw Gateway on port ${GATEWAY_PORT}..."
pkill -f "openclaw-gateway" 2>/dev/null || true
sleep 1

npx openclaw gateway --port "${GATEWAY_PORT}" --auth none &
GATEWAY_PID=$!

for i in $(seq 1 30); do
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${GATEWAY_PORT}/" 2>/dev/null || echo "000")
  if [[ "$http_code" == "200" ]]; then
    log "Gateway healthy after ${i}s"
    break
  fi
  [[ $i -eq 30 ]] && log "WARN: Gateway not healthy after 30s"
  sleep 1
done

# ---------------------------------------------------------------------------
# 6. Install + start ClawdTalk
# ---------------------------------------------------------------------------
log "Setting up ClawdTalk..."
mkdir -p "${SKILLS_DIR}"

if [[ ! -d "${CLAWDTALK_DIR}" ]]; then
  git clone https://github.com/team-telnyx/clawdtalk-client.git "${CLAWDTALK_DIR}" 2>&1 \
    || die "Failed to clone clawdtalk-client"
else
  (cd "${CLAWDTALK_DIR}" && git pull --ff-only 2>&1) || log "WARN: git pull failed"
fi

(cd "${CLAWDTALK_DIR}" && npm install --production 2>&1) || die "ClawdTalk npm install failed"

cat > "${CLAWDTALK_DIR}/skill-config.json" <<CTCONF
{
  "api_key": "${CLAWDTALK_API_KEY}",
  "server": "https://clawdtalk.com",
  "owner_name": "${OWNER}",
  "agent_name": "${AGENT}",
  "greeting": "Hey, this is ${AGENT}! How can I help you find a service provider today?",
  "max_conversation_turns": 20,
  "gateway_url": "http://127.0.0.1:${GATEWAY_PORT}",
  "gateway_token": "",
  "agent_id": "main"
}
CTCONF

log "Starting ClawdTalk WebSocket client..."
(cd "${CLAWDTALK_DIR}" && bash scripts/connect.sh start 2>&1) \
  || log "WARN: ClawdTalk start failed"
sleep 3

# ---------------------------------------------------------------------------
# 7. Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  OpenClaw Deployment Ready"
echo "============================================"
echo "  Frontend:   http://0.0.0.0:${PUBLIC_PORT}"
echo "  Gateway:    http://127.0.0.1:${GATEWAY_PORT}"
echo "  ClawdTalk:  wss://clawdtalk.com"
echo "  Bot ID:     ${CLAWDTALK_BOT_ID}"
echo "============================================"

# ---------------------------------------------------------------------------
# 8. Monitor loop — restart anything that dies
# ---------------------------------------------------------------------------
while true; do
  if ! kill -0 "$NEXTJS_PID" 2>/dev/null; then
    log "WARN: Next.js died, restarting..."
    PORT="${PUBLIC_PORT}" HOSTNAME="0.0.0.0" node .next/standalone/server.js &
    NEXTJS_PID=$!
  fi

  if [[ -n "$GATEWAY_PID" ]] && ! kill -0 "$GATEWAY_PID" 2>/dev/null; then
    log "WARN: Gateway died, restarting..."
    npx openclaw gateway --port "${GATEWAY_PORT}" --auth none &
    GATEWAY_PID=$!
  fi

  if [[ -f "${CLAWDTALK_DIR}/scripts/connect.sh" ]]; then
    CT_STATUS=$(cd "${CLAWDTALK_DIR}" && bash scripts/connect.sh status 2>&1 | grep -o "CONNECTED\|DISCONNECTED" || echo "UNKNOWN")
    if [[ "$CT_STATUS" == "DISCONNECTED" ]]; then
      log "WARN: ClawdTalk disconnected, restarting..."
      (cd "${CLAWDTALK_DIR}" && bash scripts/connect.sh restart 2>&1)
    fi
  fi

  sleep 30
done
