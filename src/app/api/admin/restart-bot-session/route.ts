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
  const { exec, spawn } = getChildProcess();
  const { promisify } = getUtil();
  const execAsync = promisify(exec);

  // Kill existing gateway
  const pids = await findGatewayPids();
  if (pids.length > 0) {
    await killPids(pids);
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Find openclaw binary
  let openclawBin = 'openclaw';
  try {
    const { stdout } = await execAsync('which openclaw 2>/dev/null || echo ""');
    const bin = stdout.trim();
    if (bin) openclawBin = bin;
  } catch { /* use default */ }

  // Spawn new gateway
  const proc = spawn(openclawBin, ['gateway', '--port', GATEWAY_PORT, '--auth', 'none'], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/usr/bin` },
  });

  proc.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(`[gateway] ${data}`);
  });
  proc.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(`[gateway:err] ${data}`);
  });
  proc.on('error', (err) => {
    console.error(`[restart-bot] Gateway spawn error: ${err.message}`);
  });

  proc.unref();

  // Wait for healthy (up to 15s)
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${GATEWAY_PORT}/`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        return { status: 'ok', message: `Gateway restarted (PID: ${proc.pid})` };
      }
    } catch {
      // Not yet ready
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  return { status: 'ok', message: `Gateway spawned (PID: ${proc.pid}), health check pending` };
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
