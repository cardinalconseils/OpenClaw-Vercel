#!/usr/bin/env bash
set -euo pipefail

echo "[startup] Phase 1: Pre-pairing OpenClaw device..."
npx tsx src/startup/pair-device.ts

echo "[startup] Phase 2: Starting server.ts (Express + GatewayManager + keep-alive)..."
npx tsx src/server.ts &
SERVER_PID=$!

echo "[startup] Phase 3: Waiting for Express to become healthy..."
for i in $(seq 1 45); do
  if curl -sf http://127.0.0.1:18790/health > /dev/null 2>&1; then
    echo "[startup] Express healthy after ${i}s"
    break
  fi
  if [ "$i" -eq 45 ]; then
    echo "[startup] ERROR: Express failed to become healthy after 45s"
    exit 1
  fi
  sleep 1
done

echo "[startup] Phase 4: Updating Telnyx webhook URL..."
npx tsx src/startup/webhook-url-updater.ts

echo "[startup] Infrastructure ready (server=$SERVER_PID)"
wait $SERVER_PID
