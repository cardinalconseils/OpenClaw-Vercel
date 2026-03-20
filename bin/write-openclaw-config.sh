#!/usr/bin/env bash
# Writes ~/.openclaw/openclaw.json and workspace persona files (SOUL.md, IDENTITY.md)
# before the OpenClaw gateway starts.
set -euo pipefail

npx tsx -e "
import { writeOpenclawConfig, writeWorkspaceFiles } from './src/startup/openclaw-config.js';
writeOpenclawConfig();
writeWorkspaceFiles();
"
