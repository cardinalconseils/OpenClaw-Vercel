import { spawn, ChildProcess } from 'child_process';

/** Gateway health check URL — OpenClaw listens on 127.0.0.1:18789 */
const GATEWAY_HEALTH_URL = 'http://127.0.0.1:18789/';
/** Health check request timeout in milliseconds */
const HEALTH_CHECK_TIMEOUT_MS = 5_000;
/** Base backoff delay in milliseconds (1 second) */
const BASE_DELAY_MS = 1_000;
/** Maximum backoff delay in milliseconds (30 seconds) */
const MAX_DELAY_MS = 30_000;
/** SIGKILL timeout after SIGTERM in milliseconds */
const SIGKILL_TIMEOUT_MS = 5_000;

/**
 * Manages the OpenClaw gateway process lifecycle.
 * Spawns the process, health-checks it, and auto-restarts with exponential
 * backoff on unexpected exits.
 */
export class GatewayManager {
  private _process: ChildProcess | null = null;
  /** Number of consecutive failures (for backoff calculation) */
  _failureCount: number = 0;
  /** Total restart count (for logging) */
  private _restartCount: number = 0;
  /** Whether auto-restart is enabled (disabled on intentional stop) */
  private _autoRestart: boolean = false;

  /**
   * Compute exponential backoff delay in milliseconds.
   * Formula: min(BASE_DELAY * 2^attempt, MAX_DELAY)
   */
  private _backoffDelay(attempt: number): number {
    return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  }

  /**
   * Start the OpenClaw gateway process.
   * Attaches stdout/stderr to structured logging and registers exit handler
   * for auto-restart with exponential backoff.
   */
  start(): void {
    this._autoRestart = true;
    this._spawnProcess();
  }

  private _spawnProcess(): void {
    const proc = spawn('openclaw', ['gateway', '--allow-unconfigured', '--port', '18789', '--auth', 'none', '--dev'], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout?.on('data', (data: Buffer) => {
      process.stdout.write(`[gateway] ${data}`);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[gateway:err] ${data}`);
    });

    proc.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      if (!this._autoRestart) {
        return;
      }
      const delay = this._backoffDelay(this._failureCount);
      this._failureCount += 1;
      this._restartCount += 1;
      console.log(
        `[gateway-manager] Process exited (code=${code}, signal=${signal}). ` +
          `Restart #${this._restartCount}, backoff=${delay}ms`
      );
      setTimeout(() => {
        if (this._autoRestart) {
          this._spawnProcess();
        }
      }, delay);
    });

    this._process = proc;
  }

  /**
   * Stop the gateway process gracefully.
   * Sends SIGTERM; falls back to SIGKILL after 5 seconds.
   */
  async stop(): Promise<void> {
    this._autoRestart = false;
    const proc = this._process;
    if (!proc) return;

    // Register exit listener BEFORE sending kill signal
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
        resolve();
      }, SIGKILL_TIMEOUT_MS);

      proc.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      proc.kill('SIGTERM');
    });

    this._process = null;
  }

  /**
   * Restart the gateway process.
   * Kills the current process (if any), then starts a fresh one.
   */
  async restart(): Promise<void> {
    const proc = this._process;
    if (proc) {
      // Temporarily disable auto-restart so the exit handler does not race
      this._autoRestart = false;

      // Register exit listener BEFORE sending kill signal to avoid missing
      // synchronous exit (important for test mocks and fast exits)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (!proc.killed) proc.kill('SIGKILL');
          resolve();
        }, SIGKILL_TIMEOUT_MS);

        proc.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });

        proc.kill('SIGTERM');
      });
    }

    this._autoRestart = true;
    this._spawnProcess();
  }

  /**
   * Check whether the gateway is healthy by hitting the root URL.
   * Any 2xx response = healthy. Resets the failure/backoff counter on success.
   *
   * @throws Error if the request times out or network error occurs.
   */
  async isHealthy(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      HEALTH_CHECK_TIMEOUT_MS
    );

    try {
      const response = await fetch(GATEWAY_HEALTH_URL, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status >= 200 && response.status < 300) {
        this._failureCount = 0;
        return true;
      }
      return false;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Get the current gateway child process (or null if not started).
   */
  getProcess(): ChildProcess | null {
    return this._process;
  }
}
