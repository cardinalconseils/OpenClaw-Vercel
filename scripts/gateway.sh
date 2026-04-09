#!/usr/bin/env bash
set -euo pipefail

GATEWAY_PORT="${PORT:-18789}"
OPENCLAW_DIR="${HOME}/.openclaw"
PUBLIC_ORIGIN="https://${RAILWAY_PUBLIC_DOMAIN:-openclaw-production-f318.up.railway.app}"

log() { echo "[gateway] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

mkdir -p "${OPENCLAW_DIR}"

# Find openclaw — it's installed globally during build but in nix store PATH
OPENCLAW_BIN=$(find /nix/store -name "openclaw" -path "*/bin/openclaw" -type f 2>/dev/null | head -1)
if [[ -z "$OPENCLAW_BIN" ]]; then
  log "openclaw not in nix store, installing via npx..."
  # Install first so openclaw can initialize its default config before we overwrite it
  npx --yes openclaw@latest --version >/dev/null 2>&1 || true
  OPENCLAW_BIN="npx openclaw@latest"
fi
log "Using: $OPENCLAW_BIN"

# Write openclaw config AFTER install (prevents openclaw init from overwriting it)
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
    "controlUi": {
      "allowedOrigins": ["${PUBLIC_ORIGIN}"]
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
log "Config written (port ${GATEWAY_PORT}, bind=lan, allowedOrigins=${PUBLIC_ORIGIN})"

# Run gateway in foreground
log "Starting gateway on port ${GATEWAY_PORT}..."
exec $OPENCLAW_BIN gateway run \
  --port "${GATEWAY_PORT}" \
  --bind lan \
  --token "${OPENCLAW_GATEWAY_TOKEN}" \
  --allow-unconfigured
