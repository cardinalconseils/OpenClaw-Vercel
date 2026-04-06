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

async function restartGateway(): Promise<{ status: string; message: string }> {
  // Kill existing gateway process by port
  try {
    await execAsync(
      `lsof -ti :${GATEWAY_PORT} | xargs -r kill -TERM 2>/dev/null; sleep 1; lsof -ti :${GATEWAY_PORT} | xargs -r kill -9 2>/dev/null`
    );
  } catch {
    // Process may not exist — that's fine
  }

  // Wait for port to be free
  for (let i = 0; i < 5; i++) {
    try {
      await execAsync(`lsof -ti :${GATEWAY_PORT}`);
      await new Promise((r) => setTimeout(r, 1000));
    } catch {
      break; // Port is free
    }
  }

  // Spawn new gateway
  const proc = spawn('openclaw', ['gateway', '--port', GATEWAY_PORT, '--auth', 'none'], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(`[gateway] ${data}`);
  });
  proc.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(`[gateway:err] ${data}`);
  });

  proc.unref();

  // Wait for healthy
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
