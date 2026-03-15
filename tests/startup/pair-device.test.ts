import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { prePairDevice } from '../../src/startup/pair-device.js';

let tmpDir: string;

beforeEach(() => {
  // Create a fresh isolated temp directory for each test
  tmpDir = mkdtempSync(path.join(tmpdir(), 'openclaw-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('prePairDevice()', () => {
  it('creates the devices directory if it does not exist', () => {
    prePairDevice(tmpDir);

    const devicesDir = path.join(tmpDir, 'devices');
    expect(existsSync(devicesDir)).toBe(true);
  });

  it('writes a paired.json file with correct schema (deviceId, publicKey, role, scopes)', () => {
    prePairDevice(tmpDir);

    const pairedPath = path.join(tmpDir, 'devices', 'paired.json');
    expect(existsSync(pairedPath)).toBe(true);

    const entries = JSON.parse(readFileSync(pairedPath, 'utf8'));
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThanOrEqual(1);

    const entry = entries[0];
    expect(entry).toHaveProperty('deviceId');
    expect(entry).toHaveProperty('publicKey');
    expect(entry.role).toBe('operator');
    expect(Array.isArray(entry.scopes)).toBe(true);
    expect(entry.scopes).toContain('operator.admin');
  });

  it('clears pending.json to an empty array', () => {
    prePairDevice(tmpDir);

    const pendingPath = path.join(tmpDir, 'devices', 'pending.json');
    expect(existsSync(pendingPath)).toBe(true);

    const pending = JSON.parse(readFileSync(pendingPath, 'utf8'));
    expect(Array.isArray(pending)).toBe(true);
    expect(pending.length).toBe(0);
  });

  it('writes a device-key.pem file containing a PEM-encoded private key', () => {
    prePairDevice(tmpDir);

    const pemPath = path.join(tmpDir, 'device-key.pem');
    expect(existsSync(pemPath)).toBe(true);

    const pem = readFileSync(pemPath, 'utf8');
    expect(pem).toContain('-----BEGIN PRIVATE KEY-----');
    expect(pem).toContain('-----END PRIVATE KEY-----');
  });

  it('appends a second entry on second call (does not overwrite)', () => {
    prePairDevice(tmpDir);
    prePairDevice(tmpDir);

    const pairedPath = path.join(tmpDir, 'devices', 'paired.json');
    const entries = JSON.parse(readFileSync(pairedPath, 'utf8'));
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });

  it('deviceId is SHA-256 hex digest of the public key DER bytes', () => {
    const result = prePairDevice(tmpDir);

    const { deviceId, publicKey: publicKeyB64 } = result;
    const publicKeyDer = Buffer.from(publicKeyB64, 'base64');
    const expectedId = createHash('sha256').update(publicKeyDer).digest('hex');

    expect(deviceId).toBe(expectedId);
  });
});
