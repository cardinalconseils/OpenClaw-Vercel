import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeOpenclawConfig, writeWorkspaceFiles } from '../../src/startup/openclaw-config.js';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('writeOpenclawConfig()', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('creates ~/.openclaw/openclaw.json (in temp dir)', () => {
    const configDir = makeTempDir('openclaw-config-test-');
    tempDirs.push(configDir);

    writeOpenclawConfig({ configDir });

    const configPath = path.join(configDir, 'openclaw.json');
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it('generated config contains gateway.port = 18789', () => {
    const configDir = makeTempDir('openclaw-config-test-');
    tempDirs.push(configDir);

    writeOpenclawConfig({ configDir });

    const config = JSON.parse(fs.readFileSync(path.join(configDir, 'openclaw.json'), 'utf-8'));
    expect(config.gateway.port).toBe(18789);
  });

  it('generated config contains agents.named.murphy with model.primary containing "openrouter"', () => {
    const configDir = makeTempDir('openclaw-config-test-');
    tempDirs.push(configDir);

    writeOpenclawConfig({ configDir });

    const config = JSON.parse(fs.readFileSync(path.join(configDir, 'openclaw.json'), 'utf-8'));
    expect(config.agents?.named?.murphy?.model?.primary).toContain('openrouter');
  });

  it('generated config contains auth.profiles.openrouter and auth.profiles.anthropic', () => {
    const configDir = makeTempDir('openclaw-config-test-');
    tempDirs.push(configDir);

    writeOpenclawConfig({ configDir });

    const config = JSON.parse(fs.readFileSync(path.join(configDir, 'openclaw.json'), 'utf-8'));
    expect(config.auth?.profiles?.openrouter).toBeDefined();
    expect(config.auth?.profiles?.anthropic).toBeDefined();
  });

  it('generated config contains plugins.entries.voice-call.enabled = true', () => {
    const configDir = makeTempDir('openclaw-config-test-');
    tempDirs.push(configDir);

    writeOpenclawConfig({ configDir });

    const config = JSON.parse(fs.readFileSync(path.join(configDir, 'openclaw.json'), 'utf-8'));
    expect(config.plugins?.entries?.['voice-call']?.enabled).toBe(true);
  });
});

describe('writeWorkspaceFiles()', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('creates SOUL.md containing "Murphy"', () => {
    const workspaceDir = makeTempDir('openclaw-workspace-test-');
    tempDirs.push(workspaceDir);

    writeWorkspaceFiles({ workspaceDir });

    const soulPath = path.join(workspaceDir, 'SOUL.md');
    expect(fs.existsSync(soulPath)).toBe(true);
    const content = fs.readFileSync(soulPath, 'utf-8');
    expect(content).toContain('Murphy');
  });

  it('creates IDENTITY.md containing "Murphy"', () => {
    const workspaceDir = makeTempDir('openclaw-workspace-test-');
    tempDirs.push(workspaceDir);

    writeWorkspaceFiles({ workspaceDir });

    const identityPath = path.join(workspaceDir, 'IDENTITY.md');
    expect(fs.existsSync(identityPath)).toBe(true);
    const content = fs.readFileSync(identityPath, 'utf-8');
    expect(content).toContain('Murphy');
  });

  it('SOUL.md contains "AI" (disclosure rule)', () => {
    const workspaceDir = makeTempDir('openclaw-workspace-test-');
    tempDirs.push(workspaceDir);

    writeWorkspaceFiles({ workspaceDir });

    const content = fs.readFileSync(path.join(workspaceDir, 'SOUL.md'), 'utf-8');
    expect(content).toContain('AI');
  });
});
