import { generateKeyPairSync, createHash } from 'node:crypto';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DEFAULT_STATE_DIR = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? '/tmp',
  '.openclaw'
);

/**
 * Pre-pairs an OpenClaw device by writing a paired.json entry with operator
 * role and required scopes, and clearing pending.json.
 *
 * This is the workaround for the Vercel Sandbox pairing bug (github.com/openclaw/openclaw issues #20073).
 * Must be called before `openclaw start` on every sandbox boot.
 *
 * @param stateDir - Override the OpenClaw state directory (defaults to
 *   OPENCLAW_STATE_DIR env var, or ~/.openclaw).  Pass a temp dir in tests.
 * @returns { deviceId, publicKey } — SHA-256 hex ID and base64 public key DER.
 */
export function prePairDevice(stateDir?: string): { deviceId: string; publicKey: string } {
  const OPENCLAW_STATE_DIR =
    stateDir ?? process.env.OPENCLAW_STATE_DIR ?? DEFAULT_STATE_DIR;
  const DEVICES_DIR = path.join(OPENCLAW_STATE_DIR, 'devices');

  // 1. Ensure devices directory exists
  mkdirSync(DEVICES_DIR, { recursive: true });

  // 2. Generate Ed25519 keypair
  //    Public key in DER/SPKI format (for deviceId and paired.json)
  //    Private key in PEM/PKCS8 format (for runtime auth)
  const { publicKey: publicKeyDer, privateKey: privateKeyPem } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // 3. Compute deviceId as SHA-256 of the DER-encoded public key
  const deviceId = createHash('sha256').update(publicKeyDer).digest('hex');
  const publicKeyB64 = publicKeyDer.toString('base64');

  // 4. Build paired entry
  //    Scopes include operator.write and operator.read per issue #23006
  const pairedEntry = {
    deviceId,
    publicKey: publicKeyB64,
    displayName: 'openclaw-sandbox-device',
    role: 'operator',
    scopes: [
      'operator.admin',
      'operator.approvals',
      'operator.pairing',
      'operator.write',
      'operator.read',
    ],
    approvedAtMs: Date.now(),
  };

  // 5. Append to existing paired.json (or create new)
  const pairedPath = path.join(DEVICES_DIR, 'paired.json');
  const existing = existsSync(pairedPath)
    ? (JSON.parse(readFileSync(pairedPath, 'utf8')) as unknown[])
    : [];
  const entries = Array.isArray(existing) ? existing : [existing];
  writeFileSync(pairedPath, JSON.stringify([...entries, pairedEntry], null, 2));

  // 6. Clear pending.json to prevent stale-request cache bug
  writeFileSync(path.join(DEVICES_DIR, 'pending.json'), '[]');

  // 7. Write private key PEM for device auth at runtime
  writeFileSync(
    path.join(OPENCLAW_STATE_DIR, 'device-key.pem'),
    typeof privateKeyPem === 'string' ? privateKeyPem : String(privateKeyPem)
  );

  return { deviceId, publicKey: publicKeyB64 };
}

// CLI entrypoint — allows running as: npx tsx src/startup/pair-device.ts
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = prePairDevice();
  console.log(`[pair-device] Paired device ${result.deviceId}`);
  console.log(`[pair-device] Public key: ${result.publicKey}`);
}
