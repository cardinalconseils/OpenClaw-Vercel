import { NextRequest, NextResponse } from 'next/server';
import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

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
        message: (err as Error).message,
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
        message: (err as Error).message,
      };
    }
  }

  const allOk = Object.values(results).every((r) => r.status === 'ok');
  return NextResponse.json(
    { results, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 207 }
  );
}

/** Find PIDs listening on a port using /proc (works without lsof/fuser) */
async function findPidsByPort(port: string): Promise<number[]> {
  try {
    // Try fuser first (available in many minimal containers)
    const { stdout } = await execAsync(`fuser ${port}/tcp 2>/dev/null || true`);
    const pids = stdout.trim().split(/\s+/).filter(Boolean).map(Number).filter(n => !isNaN(n));
    if (pids.length > 0) return pids;
  } catch { /* fuser not available */ }

  try {
    // Fallback: parse /proc/net/tcp (always available on Linux)
    const portHex = parseInt(port).toString(16).toUpperCase().padStart(4, '0');
    const { stdout } = await execAsync(
      `grep -i ":${portHex}" /proc/net/tcp 2>/dev/null | awk '{print $10}' | sort -u`
    );
    const inodes = stdout.trim().split('\n').filter(Boolean);
    if (inodes.length === 0) return [];

    // Find PIDs that hold these inodes
    const { stdout: pidOutput } = await execAsync(
      `for pid in /proc/[0-9]*/fd/*; do readlink "$pid" 2>/dev/null | grep -q "socket:\\[" && echo "$pid $(readlink "$pid")"; done 2>/dev/null | grep -E "socket:\\[(${inodes.join('|')})\\]" | sed 's|/proc/\\([0-9]*\\)/.*|\\1|' | sort -u`
    );
    return pidOutput.trim().split('\n').filter(Boolean).map(Number).filter(n => !isNaN(n));
  } catch { /* /proc parsing failed */ }

  try {
    // Last resort: find by process name
    const { stdout } = await execAsync(`pgrep -f "openclaw.*gateway" 2>/dev/null || true`);
    return stdout.trim().split('\n').filter(Boolean).map(Number).filter(n => !isNaN(n));
  } catch { return []; }
}

async function killPids(pids: number[]): Promise<void> {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch { /* already dead */ }
  }
  // Wait a moment, then force kill survivors
  await new Promise((r) => setTimeout(r, 2000));
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch { /* already dead */ }
  }
}

async function restartGateway(): Promise<{ status: string; message: string }> {
  // Kill existing gateway process
  const pids = await findPidsByPort(GATEWAY_PORT);
  if (pids.length > 0) {
    await killPids(pids);
    // Wait for port to free up
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Find openclaw binary — may be in global npm bin or PATH
  let openclawBin = 'openclaw';
  try {
    const { stdout } = await execAsync('which openclaw 2>/dev/null || npm -g bin 2>/dev/null');
    const lines = stdout.trim().split('\n');
    if (lines[0]?.includes('openclaw')) {
      openclawBin = lines[0];
    } else if (lines.length > 0) {
      openclawBin = `${lines[lines.length - 1]}/openclaw`;
    }
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

  // Log spawn errors
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
  const clawdtalkDir = `${process.env.HOME}/clawd/skills/clawdtalk-client`;

  try {
    // Stop existing
    await execAsync(`cd "${clawdtalkDir}" && bash scripts/connect.sh stop 2>/dev/null`).catch(
      () => {}
    );

    // Start fresh
    const { stdout } = await execAsync(
      `cd "${clawdtalkDir}" && bash scripts/connect.sh start 2>&1`
    );

    return { status: 'ok', message: stdout.trim() || 'ClawdTalk restarted' };
  } catch (err) {
    return { status: 'error', message: (err as Error).message };
  }
}
