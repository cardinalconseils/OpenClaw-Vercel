import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildMurphySystemPrompt } from '../lib/ai/prompts/murphy-system.js';

/**
 * Writes openclaw.json to the OpenClaw config directory.
 *
 * The config file tells the OpenClaw gateway how to bind, which LLM profiles
 * to use, how to authenticate, and which plugins to enable.
 *
 * @param options.configDir - Override the config directory (default: ~/.openclaw)
 */
export function writeOpenclawConfig(options?: { configDir?: string }): void {
  const configDir = options?.configDir ?? path.join(os.homedir(), '.openclaw');
  fs.mkdirSync(configDir, { recursive: true });

  const config = {
    gateway: {
      bind: 'loopback',
      port: 18789,
      token: process.env.OPENCLAW_DEVICE_TOKEN ?? '',
    },
    agents: {
      defaults: {
        model: {
          primary: 'openrouter/google/gemini-2.5-flash-lite',
          fallbacks: ['anthropic/claude-sonnet-4-5'],
        },
      },
      named: {
        murphy: {
          model: {
            primary: 'openrouter/google/gemini-2.5-flash-lite',
            fallbacks: ['anthropic/claude-sonnet-4-5'],
          },
          systemPromptFile: 'workspace/SOUL.md',
        },
      },
    },
    auth: {
      profiles: {
        openrouter: {
          mode: 'api_key',
          key: process.env.OPENROUTER_API_KEY ?? '',
        },
        anthropic: {
          mode: 'api_key',
          key: process.env.ANTHROPIC_API_KEY ?? '',
        },
      },
    },
    plugins: {
      entries: {
        'voice-call': {
          enabled: true,
          config: {
            provider: 'telnyx',
            fromNumber: process.env.TELNYX_PHONE_NUMBER ?? '',
            inboundPolicy: 'open',
            telnyx: {
              apiKey: process.env.TELNYX_API_KEY ?? '',
              connectionId: process.env.TELNYX_CONNECTION_ID ?? '',
              publicKey: process.env.TELNYX_PUBLIC_KEY ?? '',
            },
            serve: {
              port: 3334,
              path: '/voice/telnyx',
            },
          },
        },
      },
    },
  };

  const configPath = path.join(configDir, 'openclaw.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`[openclaw-config] Wrote openclaw.json to ${configDir}`);
}

/**
 * Writes Murphy's persona files to the OpenClaw workspace directory.
 *
 * - SOUL.md: Full persona used as the agent's system prompt file
 * - IDENTITY.md: Lightweight identity metadata (name, vibe, emoji)
 *
 * @param options.workspaceDir - Override the workspace directory (default: ~/.openclaw/workspace)
 */
export function writeWorkspaceFiles(options?: { workspaceDir?: string }): void {
  const workspaceDir = options?.workspaceDir ?? path.join(os.homedir(), '.openclaw', 'workspace');
  fs.mkdirSync(workspaceDir, { recursive: true });

  // SOUL.md — Murphy's full system prompt, used by OpenClaw gateway as systemPromptFile
  const soulContent = buildMurphySystemPrompt({ isVoiceCall: false });
  fs.writeFileSync(path.join(workspaceDir, 'SOUL.md'), soulContent, 'utf-8');

  // IDENTITY.md — lightweight identity metadata
  const identityContent = `# Murphy — Agent Identity

Name: Murphy
Vibe: Friendly professional
Emoji: :wrench:

Murphy is OpenClaw's AI phone concierge. He finds, vets, and connects
callers to local service providers through a structured 6-stage dispatch pipeline.
`;
  fs.writeFileSync(path.join(workspaceDir, 'IDENTITY.md'), identityContent, 'utf-8');

  console.log(`[openclaw-config] Wrote workspace files to ${workspaceDir}`);
}
