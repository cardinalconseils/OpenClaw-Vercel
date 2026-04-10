#!/usr/bin/env bash
set -euo pipefail

GATEWAY_PORT="${PORT:-18789}"
OPENCLAW_DIR="${OPENCLAW_STATE_DIR:-${HOME}/.openclaw}"
PUBLIC_ORIGIN="https://${RAILWAY_PUBLIC_DOMAIN:-openclaw-production-f318.up.railway.app}"

log() { echo "[gateway] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

mkdir -p "${OPENCLAW_DIR}"

# Find openclaw — it's installed globally during build but in nix store PATH
OPENCLAW_BIN=$(find /nix/store -name "openclaw" -path "*/bin/openclaw" -type f 2>/dev/null | head -1)
if [[ -z "$OPENCLAW_BIN" ]]; then
  log "openclaw not in nix store, using npx..."
  OPENCLAW_BIN="npx --yes openclaw@latest"
fi
log "Using: $OPENCLAW_BIN"

# Write openclaw config AFTER install
# trustedProxies: trust Railway's internal proxy range (100.64.0.0/10)
# allowedOrigins: allow the Control UI served from our public domain
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
    "trustedProxies": ["100.64.0.0/10"],
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
log "Config written (port=${GATEWAY_PORT}, trustedProxies=100.64.0.0/10, allowedOrigins=${PUBLIC_ORIGIN})"

# Pre-seed paired device from environment variable (set OPENCLAW_PAIRED_DEVICE in Railway)
# Format: the full paired.json content as a JSON string
mkdir -p "${OPENCLAW_DIR}/devices"
if [[ -n "${OPENCLAW_PAIRED_DEVICE:-}" ]]; then
  echo "${OPENCLAW_PAIRED_DEVICE}" > "${OPENCLAW_DIR}/devices/paired.json"
  log "Seeded paired device from env"
else
  log "WARNING: OPENCLAW_PAIRED_DEVICE not set — pairing will be required on first access"
fi

# Run gateway in foreground
log "Starting gateway on port ${GATEWAY_PORT}..."
exec $OPENCLAW_BIN gateway run \
  --port "${GATEWAY_PORT}" \
  --bind lan \
  --token "${OPENCLAW_GATEWAY_TOKEN}" \
  --allow-unconfigured
