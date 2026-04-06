import { NextRequest, NextResponse } from 'next/server';

/** Force Node.js runtime — this route uses child_process */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GATEWAY_PORT = process.env.OPENCLAW_GATEWAY_PORT ?? '18789';
const ADMIN_SECRET = process.env.ADMIN_SECRET;

/**
 * POST /api/admin/restart-bot-session
 *
 * Restarts the OpenClaw gateway and optionally ClawdTalk.
 * Requires ADMIN_SECRET header for authorization.
 *
 * Query params:
 *   ?services=gateway,clawdtalk (default: both)
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    if (!ADMIN_SECRET) {
      return NextResponse.json(
        { error: 'ADMIN_SECRET not configured' },
        { status: 503 }
      );
    }

    const authHeader = request.headers.get('x-admin-secret');
    if (authHeader !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const services = request.nextUrl.searchParams.get('services')?.split(',') ?? [
      'gateway',
      'clawdtalk',
    ];

    const results: Record<string, { status: string; message: string }> = {};

    // Restart gateway
    if (services.includes('gateway')) {
      try {
        results.gateway = await restartGateway();
      } catch (err) {
        results.gateway = {
          status: 'error',
          message: (err as Error).message ?? String(err),
        };
      }
    }

    // Restart ClawdTalk
    if (services.includes('clawdtalk')) {
      try {
        results.clawdtalk = await restartClawdTalk();
      } catch (err) {
        results.clawdtalk = {
          status: 'error',
          message: (err as Error).message ?? String(err),
        };
      }
    }

    const allOk = Object.values(results).every((r) => r.status === 'ok');
    return NextResponse.json(
      { results, timestamp: new Date().toISOString() },
      { status: allOk ? 200 : 207 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Unhandled error', message: (err as Error).message ?? String(err), stack: (err as Error).stack },
      { status: 500 }
    );
  }
}

/* eslint-disable @typescript-eslint/no-require-imports */
function getChildProcess() {
  // Dynamic require to avoid Next.js webpack bundling issues
  return require('child_process') as typeof import('child_process');
}

function getUtil() {
  return require('util') as typeof import('util');
}
/* eslint-enable @typescript-eslint/no-require-imports */

/** Find PIDs of the gateway process */
async function findGatewayPids(): Promise<number[]> {
  const { exec } = getChildProcess();
  const { promisify } = getUtil();
  const execAsync = promisify(exec);

  // Try pgrep first
  try {
    const { stdout } = await execAsync('pgrep -f "openclaw.*gateway" 2>/dev/null || true');
    const pids = stdout.trim().split('\n').filter(Boolean).map(Number).filter(n => !isNaN(n));
    if (pids.length > 0) return pids;
  } catch { /* not available */ }

  // Try fuser
  try {
    const { stdout } = await execAsync(`fuser ${GATEWAY_PORT}/tcp 2>/dev/null || true`);
    const pids = stdout.trim().split(/\s+/).filter(Boolean).map(Number).filter(n => !isNaN(n));
    if (pids.length > 0) return pids;
  } catch { /* not available */ }

  return [];
}

async function killPids(pids: number[]): Promise<void> {
  for (const pid of pids) {
    try { process.kill(pid, 'SIGTERM'); } catch { /* already dead */ }
  }
  await new Promise((r) => setTimeout(r, 2000));
  for (const pid of pids) {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already dead */ }
  }
}

async function restartGateway(): Promise<{ status: string; message: string }> {
  const { exec } = getChildProcess();
  const { promisify } = getUtil();
  const execAsync = promisify(exec);

  const extendedPath = [
    process.env.PATH,
    '/usr/local/bin',
    '/usr/bin',
    '/app/node_modules/.bin',
    '/root/.npm-global/bin',
  ].join(':');

  // Kill existing gateway
  const pids = await findGatewayPids();
  if (pids.length > 0) {
    await killPids(pids);
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Find openclaw binary — check npm global bin, nix store, and PATH
  let openclawBin = '';
  try {
    // npm bin -g gives the global bin directory; also check node_modules/.bin
    const { stdout } = await execAsync(
      [
        `PATH="${extendedPath}" which openclaw 2>/dev/null`,
        'command -v openclaw 2>/dev/null',
        'echo "$(npm bin -g 2>/dev/null)/openclaw"',
        'echo "$(npm root -g 2>/dev/null)/../bin/openclaw"',
        'ls /nix/store/*/bin/openclaw 2>/dev/null | head -1',
      ].join(' || ')
    );
    // Filter to lines that look like real paths
    const candidates = stdout.trim().split('\n').filter(s => s && s.startsWith('/'));
    openclawBin = candidates[0] ?? '';
  } catch { /* not found */ }

  // Verify the binary actually exists and is executable
  if (openclawBin) {
    try {
      await execAsync(`test -f "${openclawBin}" && test -x "${openclawBin}"`);
    } catch {
      // Path exists but file doesn't — try node to run the package directly
      openclawBin = '';
    }
  }

  if (!openclawBin) {
    // Fallback: run via node directly from npm global modules
    try {
      const { stdout } = await execAsync('npm root -g 2>/dev/null');
      const globalRoot = stdout.trim();
      // Check if openclaw has a bin or main entry
      const { stdout: pkgJson } = await execAsync(`cat "${globalRoot}/openclaw/package.json" 2>/dev/null`);
      const pkg = JSON.parse(pkgJson);
      const binEntry = typeof pkg.bin === 'string' ? pkg.bin : (pkg.bin?.openclaw ?? pkg.main ?? 'index.js');
      openclawBin = `node ${globalRoot}/openclaw/${binEntry}`;
    } catch { /* not found */ }
  }

  if (!openclawBin) {
    let debug = '';
    try {
      const { stdout } = await execAsync(`npm bin -g 2>/dev/null; npm root -g 2>/dev/null; ls "$(npm root -g 2>/dev/null)/openclaw/" 2>/dev/null`);
      debug = stdout.trim();
    } catch { /* ignore */ }
    return { status: 'error', message: `openclaw binary not found. Debug: ${debug}` };
  }

  // Start gateway as a background shell process
  const cmd = `${openclawBin} gateway --port ${GATEWAY_PORT} --auth none >> /tmp/gateway.log 2>&1 & echo $!`;
  const { stdout: pidOutput } = await execAsync(cmd, {
    env: { ...process.env, PATH: extendedPath },
  });

  const pid = pidOutput.trim();

  // Wait for healthy (up to 15s)
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        return { status: 'ok', message: `Gateway restarted (PID: ${pid}) using: ${openclawBin}` };
      }
    } catch {
      // Not yet ready
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Read last few lines of log for diagnostics
  let logTail = '';
  try {
    const { stdout } = await execAsync('cat /tmp/gateway.log 2>/dev/null || echo "no log"');
    logTail = stdout.trim();
  } catch { /* ignore */ }

  // Check if process is still running
  let procStatus = '';
  try {
    const { stdout } = await execAsync(`kill -0 ${pid} 2>/dev/null && echo "running" || echo "dead"`);
    procStatus = stdout.trim();
  } catch { procStatus = 'unknown'; }

  return { status: 'error', message: `Gateway spawned (PID: ${pid}, status: ${procStatus}) using "${openclawBin}" but health check failed after 15s. Log: ${logTail}` };
}

async function restartClawdTalk(): Promise<{ status: string; message: string }> {
  const { exec } = getChildProcess();
  const { promisify } = getUtil();
  const execAsync = promisify(exec);

  const clawdtalkDir = `${process.env.HOME}/clawd/skills/clawdtalk-client`;

  try {
    await execAsync(`cd "${clawdtalkDir}" && bash scripts/connect.sh stop 2>/dev/null`).catch(() => {});
    const { stdout } = await execAsync(`cd "${clawdtalkDir}" && bash scripts/connect.sh start 2>&1`);
    return { status: 'ok', message: stdout.trim() || 'ClawdTalk restarted' };
  } catch (err) {
    return { status: 'error', message: (err as Error).message };
  }
}
