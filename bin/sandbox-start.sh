#!/usr/bin/env bash
set -euo pipefail

echo "[startup] Phase 1: Pre-pairing OpenClaw device..."
npx tsx src/startup/pair-device.ts

echo "[startup] Phase 2: Starting OpenClaw gateway..."
nohup openclaw start > /tmp/gateway.log 2>&1 &
GATEWAY_PID=$!

echo "[startup] Phase 3: Waiting for gateway health..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:18789/ > /dev/null 2>&1; then
    echo "[startup] Gateway healthy after ${i}s"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "[startup] ERROR: Gateway failed to become healthy after 30s"
    cat /tmp/gateway.log
    exit 1
  fi
  sleep 1
done

echo "[startup] Phase 4: Starting Express webhook server..."
npx tsx src/server.ts &
EXPRESS_PID=$!
sleep 2  # Let Express bind

echo "[startup] Phase 5: Updating Telnyx webhook URL..."
npx tsx src/startup/webhook-url-updater.ts

echo "[startup] Infrastructure ready (gateway=$GATEWAY_PID, express=$EXPRESS_PID)"
wait $GATEWAY_PID
