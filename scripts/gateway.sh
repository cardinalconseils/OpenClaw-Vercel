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

# Find openclaw — it's installed globally during build but in nix store PATH
OPENCLAW_BIN=$(find /nix/store -name "openclaw" -path "*/bin/openclaw" -type f 2>/dev/null | head -1)
if [[ -z "$OPENCLAW_BIN" ]]; then
  log "openclaw not in nix store, falling back to npx..."
  OPENCLAW_BIN="npx --yes openclaw@latest"
fi
log "Using: $OPENCLAW_BIN"

# Run gateway in foreground
log "Starting gateway on port ${GATEWAY_PORT}..."
exec $OPENCLAW_BIN gateway run \
  --port "${GATEWAY_PORT}" \
  --bind lan \
  --token "${OPENCLAW_GATEWAY_TOKEN}" \
  --allow-unconfigured
