#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# OpenClaw + ClawdTalk + Next.js — Unified Startup
#
# DESIGN: Next.js starts IMMEDIATELY (health check target).
# Gateway + ClawdTalk start in a background function AFTER.
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

GATEWAY_PID=""
NEXTJS_PID=""

cleanup() {
  log "Shutting down..."
  [[ -n "$GATEWAY_PID" ]] && kill "$GATEWAY_PID" 2>/dev/null || true
  [[ -n "$NEXTJS_PID" ]] && kill "$NEXTJS_PID" 2>/dev/null || true
  [[ -f "${CLAWDTALK_DIR}/scripts/connect.sh" ]] && \
    (cd "$CLAWDTALK_DIR" && bash scripts/connect.sh stop 2>/dev/null) || true
  wait 2>/dev/null || true
}
trap cleanup EXIT SIGTERM SIGINT

# ---------------------------------------------------------------------------
# 1. Start Next.js IMMEDIATELY (health check passes in <1s)
# ---------------------------------------------------------------------------
cd "$PROJECT_DIR"

# Copy static assets for standalone mode
cp -r .next/static .next/standalone/.next/static 2>/dev/null || true
cp -r public .next/standalone/public 2>/dev/null || true

log "Starting Next.js on port ${PUBLIC_PORT}..."
PORT="${PUBLIC_PORT}" HOSTNAME="0.0.0.0" node .next/standalone/server.js &
NEXTJS_PID=$!
log "Next.js started (PID: ${NEXTJS_PID})"

# ---------------------------------------------------------------------------
# 2. Background: start gateway + ClawdTalk (non-blocking)
# ---------------------------------------------------------------------------
start_backend() {
  log "Starting backend services..."

  # Validate
  if [[ -z "${CLAWDTALK_API_KEY:-}" || -z "${CLAWDTALK_BOT_ID:-}" ]]; then
    log "WARN: CLAWDTALK_API_KEY or CLAWDTALK_BOT_ID not set — skipping ClawdTalk"
    return
  fi

  # Link project-local workspace into ~/.openclaw so gateway uses it
  mkdir -p "${OPENCLAW_DIR}"
  if [[ -d "${PROJECT_DIR}/openclaw/workspace" ]]; then
    rm -rf "${OPENCLAW_DIR}/workspace" 2>/dev/null || true
    ln -sf "${PROJECT_DIR}/openclaw/workspace" "${OPENCLAW_DIR}/workspace"
    log "Linked workspace: ${OPENCLAW_DIR}/workspace -> ${PROJECT_DIR}/openclaw/workspace"
  fi

  # Write openclaw config
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

  # Pre-pair device
  cd "$PROJECT_DIR"
  if [[ -f "src/startup/pair-device.ts" ]]; then
    npx tsx src/startup/pair-device.ts 2>&1 || log "WARN: pair-device failed"
  fi

  # Use npx to run openclaw without global install
  OPENCLAW_CMD="npx --yes openclaw@latest"

  # Start gateway
  log "Starting gateway on port ${GATEWAY_PORT}..."
  $OPENCLAW_CMD gateway --port "${GATEWAY_PORT}" --auth none &
  GATEWAY_PID=$!

  # Wait for gateway
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${GATEWAY_PORT}/" 2>/dev/null || echo "000")
    [[ "$code" == "200" ]] && { log "Gateway healthy after ${i}s"; break; }
    sleep 1
  done

  # Install + start ClawdTalk
  mkdir -p "${SKILLS_DIR}"
  if [[ ! -d "${CLAWDTALK_DIR}" ]]; then
    git clone https://github.com/team-telnyx/clawdtalk-client.git "${CLAWDTALK_DIR}" 2>&1
  fi
  (cd "${CLAWDTALK_DIR}" && npm install --production 2>&1)

  cat > "${CLAWDTALK_DIR}/skill-config.json" <<CTCONF
{
  "api_key": "${CLAWDTALK_API_KEY}",
  "server": "https://clawdtalk.com",
  "owner_name": "${OWNER}",
  "agent_name": "${AGENT}",
  "greeting": "Hey, this is ${AGENT}! How can I help you?",
  "max_conversation_turns": 20,
  "gateway_url": "http://127.0.0.1:${GATEWAY_PORT}",
  "gateway_token": "",
  "agent_id": "main"
}
CTCONF

  (cd "${CLAWDTALK_DIR}" && bash scripts/connect.sh start 2>&1) || log "WARN: ClawdTalk start failed"
  log "Backend services ready"
}

# Run backend setup in background — does NOT block health check
start_backend &

# ---------------------------------------------------------------------------
# 3. Monitor loop
# ---------------------------------------------------------------------------
while true; do
  if [[ -n "$NEXTJS_PID" ]] && ! kill -0 "$NEXTJS_PID" 2>/dev/null; then
    log "WARN: Next.js died, restarting..."
    PORT="${PUBLIC_PORT}" HOSTNAME="0.0.0.0" node .next/standalone/server.js &
    NEXTJS_PID=$!
  fi
  sleep 30
done
