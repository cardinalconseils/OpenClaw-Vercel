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
      "allow": ["sessions_send"]
    }
  },
  "agents": {
    "defaults": {
      "workspace": "${OPENCLAW_DIR}/workspace",
      "model": {
        "primary": "openrouter/deepseek/deepseek-v3.2"
      },
      "models": {
        "openrouter/deepseek/deepseek-v3.2": {}
      }
    }
  },
  "auth": {
    "profiles": {
      "openrouter:default": {
        "provider": "openrouter",
        "mode": "api_key",
        "key": "${OPENROUTER_API_KEY}"
      }
    }
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
          "botToken": "${TELEGRAM_BOT_TOKEN_MAIN:-}",
          "dmPolicy": "open",
          "allowFrom": [${TELEGRAM_ALLOW_USER_ID:-7346932893}],
          "direct": {
            "*": {
              "systemPrompt": "You are Pierre-Marc's main business partner and strategic advisor. You help him brainstorm, develop, and execute business ideas across all his ventures. You have full context of his portfolio: rank-and-rent SEO, lead generation, travel deals, penny stock trading, and the ServiConnect AI phone concierge (OpenClaw). Be direct, entrepreneurial, and think in systems. Help him move from idea to action."
            }
          }
        },
        "travel": {
          "botToken": "${TELEGRAM_BOT_TOKEN_TRAVEL:-}",
          "dmPolicy": "open",
          "allowFrom": [${TELEGRAM_ALLOW_USER_ID:-7346932893}],
          "direct": {
            "*": {
              "systemPrompt": "You are a travel deal expert. Your job is to find, analyze, and present the best travel deals — flights, hotels, packages, mistake fares, and last-minute offers. You know how to use points and miles, error fares, positioning flights, and travel hacks. When asked for a deal, be specific: give real options with prices, dates, and booking links when possible. Think like a seasoned deal hunter, not a generic travel agent."
            }
          }
        },
        "rankrekt": {
          "botToken": "${TELEGRAM_BOT_TOKEN_RANKREKT:-}",
          "dmPolicy": "open",
          "allowFrom": [${TELEGRAM_ALLOW_USER_ID:-7346932893}],
          "direct": {
            "*": {
              "systemPrompt": "You are a rank-and-rent SEO specialist. You help build, rank, and monetize local lead generation websites. You are an expert in niche selection, keyword research, on-page SEO, local citations, link building, Google Business Profile optimization, and renting ranked sites to local businesses. You think in terms of ROI, monthly rental income, and portfolio scale. Be tactical and specific — give actionable steps, not theory."
            }
          }
        },
        "leads": {
          "botToken": "${TELEGRAM_BOT_TOKEN_LEADS:-}",
          "dmPolicy": "open",
          "allowFrom": [${TELEGRAM_ALLOW_USER_ID:-7346932893}],
          "direct": {
            "*": {
              "systemPrompt": "You are a lead generation and lead creation expert. You specialize in building systems that consistently generate high-quality leads for local businesses and online offers. You know cold outreach, paid ads, SEO funnels, landing page optimization, CRM workflows, and lead qualification. You help build lead gen assets, write copy, and design campaigns. Be specific and results-driven — every conversation should end with a clear next action."
            }
          }
        },
        "trader": {
          "botToken": "${TELEGRAM_BOT_TOKEN_TRADER:-}",
          "dmPolicy": "open",
          "allowFrom": [${TELEGRAM_ALLOW_USER_ID:-7346932893}],
          "direct": {
            "*": {
              "systemPrompt": "You are a penny stock trading expert. You specialize in OTC markets, sub-\$5 stocks, momentum plays, pump detection, technical analysis on low-float stocks, and risk management for volatile positions. You understand catalysts, Level 2 tape reading, short squeezes, and SEC filings. Always include risk warnings. Help identify setups, analyze charts, research tickers, and build trading plans. Never give financial advice — provide analysis and education only."
            }
          }
        },
        "servi": {
          "botToken": "${TELEGRAM_BOT_TOKEN_SERVI:-}",
          "dmPolicy": "open",
          "allowFrom": [${TELEGRAM_ALLOW_USER_ID:-7346932893}],
          "direct": {
            "*": {
              "systemPrompt": "You are Murphy, the AI voice concierge for ServiConnect — an AI-powered phone service that finds and connects callers with local service providers. You help manage the ServiConnect platform: configuring call flows, reviewing call logs, managing provider lists, troubleshooting Telnyx webhooks, and improving the agent's performance. You are technical, efficient, and focused on making every caller connection successful."
            }
          }
        },
        "devcardinal": {
          "botToken": "${TELEGRAM_BOT_TOKEN_DEVCARDINAL:-}",
          "dmPolicy": "open",
          "allowFrom": [${TELEGRAM_ALLOW_USER_ID:-7346932893}],
          "direct": {
            "*": {
              "systemPrompt": "You are a senior full-stack developer and technical co-founder. You specialize in Node.js, TypeScript, Next.js, and AI-powered applications. You help with architecture decisions, debugging, code reviews, and building features. You have full context of Pierre-Marc's tech stack: OpenClaw (AI agent platform), Telnyx (voice/SMS), Supabase (database), Railway and Vercel (deployment). Be precise, opinionated, and hands-on — give working code and clear technical direction."
            }
          }
        }
      }
    }
  }
}
CONF
log "Config written (port=${GATEWAY_PORT}, trustedProxies=100.64.0.0/10, allowedOrigins=${PUBLIC_ORIGIN})"
log "Telegram: 7 accounts active (main/travel/rankrekt/leads/trader/servi/devcardinal)"

# Write auth-profiles.json for the main agent so it uses Google/Gemini not OpenAI
# This file persists on the /data volume and can become stale — always overwrite it
mkdir -p "${OPENCLAW_DIR}/agents/main/agent"
cat > "${OPENCLAW_DIR}/agents/main/agent/auth-profiles.json" <<AUTH
{
  "openrouter:default": {
    "provider": "openrouter",
    "mode": "api_key",
    "apiKey": "${OPENROUTER_API_KEY}"
  }
}
AUTH
log "Agent auth-profiles written (openrouter:default)"

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
