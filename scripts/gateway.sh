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

# Pre-seed paired device so Control UI doesn't require pairing on first access
mkdir -p "${OPENCLAW_DIR}/devices"
if [[ ! -s "${OPENCLAW_DIR}/devices/paired.json" ]]; then
  cat > "${OPENCLAW_DIR}/devices/paired.json" <<'PAIRED'
{"4da33389d9e2c4948e02b882460c6cbd3a9991fe1bb8439ab5c59d291efc0f6d":{"deviceId":"4da33389d9e2c4948e02b882460c6cbd3a9991fe1bb8439ab5c59d291efc0f6d","publicKey":"vJHf7BxFkARdUcOvKeFEoBsFShARImKDKADdk9Xxa_g","platform":"darwin","clientId":"cli","clientMode":"probe","role":"operator","roles":["operator"],"scopes":["operator.read"],"approvedScopes":["operator.read"],"tokens":{"operator":{"token":"OPENCLAW_OPERATOR_TOKEN_REDACTED","role":"operator","scopes":["operator.read"],"createdAtMs":1775701698442}},"createdAtMs":1775701698442,"approvedAtMs":1775701698442}}
PAIRED
  log "Seeded paired device"
fi

# Run gateway in foreground
log "Starting gateway on port ${GATEWAY_PORT}..."
exec $OPENCLAW_BIN gateway run \
  --port "${GATEWAY_PORT}" \
  --bind lan \
  --token "${OPENCLAW_GATEWAY_TOKEN}" \
  --allow-unconfigured
