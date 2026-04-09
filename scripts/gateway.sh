#!/usr/bin/env bash
set -euo pipefail

GATEWAY_PORT="${PORT:-18789}"
OPENCLAW_DIR="${HOME}/.openclaw"

log() { echo "[gateway] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

mkdir -p "${OPENCLAW_DIR}"

# Write openclaw config
cat > "${OPENCLAW_DIR}/openclaw.json" <<CONF
{
  "gateway": {
    "bind": "lan",
    "port": ${GATEWAY_PORT},
    "mode": "local",
    "auth": {
      "mode": "token",
      "token": "${OPENCLAW_GATEWAY_TOKEN}"
    },
    "tools": {
      "allow": ["sessions_send"]
    }
  },
  "agents": {
    "defaults": {
      "workspace": "${OPENCLAW_DIR}/workspace"
    }
  }
}
CONF
log "Config written (port ${GATEWAY_PORT}, bind=lan, auth=none)"

# Run gateway in foreground
log "Starting gateway on port ${GATEWAY_PORT}..."
exec npx --yes openclaw@latest gateway run \
  --port "${GATEWAY_PORT}" \
  --bind lan \
  --token "${OPENCLAW_GATEWAY_TOKEN}" \
  --allow-unconfigured
