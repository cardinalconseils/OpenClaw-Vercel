#!/usr/bin/env bash
set -euo pipefail
set -x  # print every command before execution — helps diagnose silent failures

GATEWAY_PORT="${PORT:-18789}"
OPENCLAW_DIR="${OPENCLAW_STATE_DIR:-${HOME}/.openclaw}"
PUBLIC_ORIGIN="https://${RAILWAY_PUBLIC_DOMAIN:-openclaw-production-f318.up.railway.app}"

log() { echo "[gateway] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

mkdir -p "${OPENCLAW_DIR}"

# Find openclaw — prefer the globally-installed binary (put there at build time),
# fall back to npx only if it is genuinely missing from PATH.
if command -v openclaw &>/dev/null; then
  OPENCLAW_BIN="openclaw"
  log "Found openclaw on PATH: $(command -v openclaw) ($(openclaw --version 2>&1 || true))"
else
  log "WARNING: openclaw not found on PATH"
  # Verify npm/npx are available before attempting the fallback
  if ! command -v npm &>/dev/null; then
    log "ERROR: npm is not available — cannot fall back to npx. Aborting."
    exit 1
  fi
  log "npm available: $(npm --version), npx available: $(npx --version)"
  log "Falling back to: npx --yes openclaw@latest"
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
      "allow": ["sessions_send", "operator.approvals"]
    }
  },
  "agents": {
    "defaults": {
      "skipBootstrap": true,
      "model": {
        "primary": "openrouter/deepseek/deepseek-v3.2"
      },
      "models": {
        "openrouter/deepseek/deepseek-v3.2": {}
      }
    },
    "list": [
      {
        "id": "main",
        "default": true,
        "workspace": "${OPENCLAW_DIR}/agents/main/workspace",
        "agentDir": "${OPENCLAW_DIR}/agents/main/agent"
      },
      {
        "id": "travel",
        "workspace": "${OPENCLAW_DIR}/agents/travel/workspace",
        "agentDir": "${OPENCLAW_DIR}/agents/travel/agent"
      },
      {
        "id": "rankrekt",
        "workspace": "${OPENCLAW_DIR}/agents/rankrekt/workspace",
        "agentDir": "${OPENCLAW_DIR}/agents/rankrekt/agent"
      },
      {
        "id": "leads",
        "workspace": "${OPENCLAW_DIR}/agents/leads/workspace",
        "agentDir": "${OPENCLAW_DIR}/agents/leads/agent"
      },
      {
        "id": "trader",
        "workspace": "${OPENCLAW_DIR}/agents/trader/workspace",
        "agentDir": "${OPENCLAW_DIR}/agents/trader/agent"
      },
      {
        "id": "servi",
        "workspace": "${OPENCLAW_DIR}/agents/servi/workspace",
        "agentDir": "${OPENCLAW_DIR}/agents/servi/agent"
      },
      {
        "id": "devcardinal",
        "workspace": "${OPENCLAW_DIR}/agents/devcardinal/workspace",
        "agentDir": "${OPENCLAW_DIR}/agents/devcardinal/agent"
      }
    ]
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "groups": {
        "*": {
          "requireMention": true
        }
      },
      "defaultAccount": "main",
      "accounts": {
        "main": {
          "enabled": true,
          "botToken": "${TELEGRAM_BOT_TOKEN_MAIN:-}",
          "dmPolicy": "open",
          "allowFrom": ["${TELEGRAM_ALLOW_USER_ID:-7346932893}", "*"],
          "direct": {
            "*": {
              "systemPrompt": "You are Pierre-Marc's main business partner and strategic advisor. You help him brainstorm, develop, and execute business ideas across all his ventures. You have full context of his portfolio: rank-and-rent SEO, lead generation, travel deals, penny stock trading, and the ServiConnect AI phone concierge (OpenClaw). Be direct, entrepreneurial, and think in systems. Help him move from idea to action."
            }
          }
        },
        "travel": {
          "enabled": true,
          "botToken": "${TELEGRAM_BOT_TOKEN_TRAVEL:-}",
          "dmPolicy": "open",
          "allowFrom": ["${TELEGRAM_ALLOW_USER_ID:-7346932893}", "*"],
          "direct": {
            "*": {
              "systemPrompt": "You are a travel deal expert. Your job is to find, analyze, and present the best travel deals — flights, hotels, packages, mistake fares, and last-minute offers. You know how to use points and miles, error fares, positioning flights, and travel hacks. When asked for a deal, be specific: give real options with prices, dates, and booking links when possible. Think like a seasoned deal hunter, not a generic travel agent."
            }
          }
        },
        "rankrekt": {
          "enabled": true,
          "botToken": "${TELEGRAM_BOT_TOKEN_RANKREKT:-}",
          "dmPolicy": "open",
          "allowFrom": ["${TELEGRAM_ALLOW_USER_ID:-7346932893}", "*"],
          "direct": {
            "*": {
              "systemPrompt": "You are a rank-and-rent SEO specialist. You help build, rank, and monetize local lead generation websites. You are an expert in niche selection, keyword research, on-page SEO, local citations, link building, Google Business Profile optimization, and renting ranked sites to local businesses. You think in terms of ROI, monthly rental income, and portfolio scale. Be tactical and specific — give actionable steps, not theory."
            }
          }
        },
        "leads": {
          "enabled": true,
          "botToken": "${TELEGRAM_BOT_TOKEN_LEADS:-}",
          "dmPolicy": "open",
          "allowFrom": ["${TELEGRAM_ALLOW_USER_ID:-7346932893}", "*"],
          "direct": {
            "*": {
              "systemPrompt": "You are a lead generation and lead creation expert. You specialize in building systems that consistently generate high-quality leads for local businesses and online offers. You know cold outreach, paid ads, SEO funnels, landing page optimization, CRM workflows, and lead qualification. You help build lead gen assets, write copy, and design campaigns. Be specific and results-driven — every conversation should end with a clear next action."
            }
          }
        },
        "trader": {
          "enabled": true,
          "botToken": "${TELEGRAM_BOT_TOKEN_TRADER:-}",
          "dmPolicy": "open",
          "allowFrom": ["${TELEGRAM_ALLOW_USER_ID:-7346932893}", "*"],
          "direct": {
            "*": {
              "systemPrompt": "You are a penny stock trading expert. You specialize in OTC markets, sub-\$5 stocks, momentum plays, pump detection, technical analysis on low-float stocks, and risk management for volatile positions. You understand catalysts, Level 2 tape reading, short squeezes, and SEC filings. Always include risk warnings. Help identify setups, analyze charts, research tickers, and build trading plans. Never give financial advice — provide analysis and education only."
            }
          }
        },
        "servi": {
          "enabled": true,
          "botToken": "${TELEGRAM_BOT_TOKEN_SERVI:-}",
          "dmPolicy": "open",
          "allowFrom": ["${TELEGRAM_ALLOW_USER_ID:-7346932893}", "*"],
          "direct": {
            "*": {
              "systemPrompt": "You are Murphy, the AI voice concierge for ServiConnect — an AI-powered phone service that finds and connects callers with local service providers. You help manage the ServiConnect platform: configuring call flows, reviewing call logs, managing provider lists, troubleshooting Telnyx webhooks, and improving the agent's performance. You are technical, efficient, and focused on making every caller connection successful."
            }
          }
        },
        "devcardinal": {
          "enabled": true,
          "botToken": "${TELEGRAM_BOT_TOKEN_DEVCARDINAL:-}",
          "dmPolicy": "open",
          "allowFrom": ["${TELEGRAM_ALLOW_USER_ID:-7346932893}", "*"],
          "direct": {
            "*": {
              "systemPrompt": "You are a senior full-stack developer and technical co-founder. You specialize in Node.js, TypeScript, Next.js, and AI-powered applications. You help with architecture decisions, debugging, code reviews, and building features. You have full context of Pierre-Marc's tech stack: OpenClaw (AI agent platform), Telnyx (voice/SMS), Supabase (database), Railway and Vercel (deployment). Be precise, opinionated, and hands-on — give working code and clear technical direction."
            }
          }
        }
      }
    }
  },
  "bindings": [
    { "type": "route", "agentId": "main",       "match": { "channel": "telegram", "accountId": "main" } },
    { "type": "route", "agentId": "travel",      "match": { "channel": "telegram", "accountId": "travel" } },
    { "type": "route", "agentId": "rankrekt",    "match": { "channel": "telegram", "accountId": "rankrekt" } },
    { "type": "route", "agentId": "leads",       "match": { "channel": "telegram", "accountId": "leads" } },
    { "type": "route", "agentId": "trader",      "match": { "channel": "telegram", "accountId": "trader" } },
    { "type": "route", "agentId": "servi",       "match": { "channel": "telegram", "accountId": "servi" } },
    { "type": "route", "agentId": "devcardinal", "match": { "channel": "telegram", "accountId": "devcardinal" } }
  ]
}
CONF
log "Config written (port=${GATEWAY_PORT}, trustedProxies=100.64.0.0/10, allowedOrigins=${PUBLIC_ORIGIN})"
log "Telegram: 7 accounts enabled, each routed to its own isolated agent"


# Pre-seed workspace + identity for each agent — prevents onboarding flow
AGENT_IDS="main travel rankrekt leads trader servi devcardinal"
for agent_id in ${AGENT_IDS}; do
  agent_ws="${OPENCLAW_DIR}/agents/${agent_id}/workspace"
  mkdir -p "${agent_ws}"

  cat > "${agent_ws}/USER.md" <<'USER'
# User: Pierre-Marc Cardinal

- **Preferred name:** Pierre-Marc (or PM)
- **Timezone:** America/Toronto (Eastern)
- **Role:** Entrepreneur, builder, technical founder
- **Ventures:** Rank-and-rent SEO, local lead generation, travel deals, penny stock trading, ServiConnect (AI phone concierge powered by OpenClaw + Telnyx)
- **Tech stack:** Node.js, TypeScript, Next.js, OpenClaw, Telnyx, Supabase, Railway, Vercel
- **Communication style:** Direct and action-oriented — skip preamble, give working answers
USER

  cat > "${agent_ws}/IDENTITY.md" <<IDENTITY
# Agent Identity: ${agent_id}

Your identity, personality, and expertise are defined by the system prompt active for this conversation.
Do NOT run any onboarding or persona-setup flow — you are already fully configured.
Read USER.md to understand who you are talking to, then get straight to work.
IDENTITY

  log "Seeded workspace for agent: ${agent_id}"
done


# Auth: openclaw auto-reads OPENROUTER_API_KEY from the environment.
# No auth-profiles.json or auth block in openclaw.json needed.
log "Auth: relying on OPENROUTER_API_KEY env var (auto-detected by openclaw)"

# Pre-seed paired device from environment variable (set OPENCLAW_PAIRED_DEVICE in Railway)
# Format: the full paired.json content as a JSON string
mkdir -p "${OPENCLAW_DIR}/devices"
if [[ -n "${OPENCLAW_PAIRED_DEVICE:-}" ]]; then
  echo "${OPENCLAW_PAIRED_DEVICE}" > "${OPENCLAW_DIR}/devices/paired.json"
  log "Seeded paired device from env"
else
  log "WARNING: OPENCLAW_PAIRED_DEVICE not set — pairing will be required on first access"
fi

# Tell plugins where to find the gateway — must match the actual running port
export OPENCLAW_GATEWAY_URL="ws://127.0.0.1:${GATEWAY_PORT}"
log "Gateway URL: ${OPENCLAW_GATEWAY_URL}"

# Run gateway in foreground
log "Starting gateway on port ${GATEWAY_PORT}..."
exec $OPENCLAW_BIN gateway run \
  --port "${GATEWAY_PORT}" \
  --bind lan \
  --token "${OPENCLAW_GATEWAY_TOKEN}" \
  --allow-unconfigured \
  --force
