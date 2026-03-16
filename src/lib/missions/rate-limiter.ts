/**
 * Token bucket rate limiter for Telnyx throughput constraints.
 *
 * Telnyx enforces:
 * - 1 SMS/second account-wide
 * - Outbound call concurrency should be kept to 1–2 simultaneous legs
 *
 * Usage:
 *   await smsLimiter.acquire();  // blocks until within rate limit
 *   await sendSms(...);
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly maxTokens: number,
    private readonly refillRatePerMs: number,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token, waiting if necessary.
   * Resolves immediately if a token is available; otherwise waits for the next
   * refill cycle.
   */
  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Calculate exact wait time for the next token
    const waitMs = (1 - this.tokens) / this.refillRatePerMs;
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  /**
   * Refill tokens based on elapsed time since last refill.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefill = now;
  }
}

/**
 * Pre-configured SMS rate limiter: 1 SMS per second (Telnyx account-wide limit).
 */
export const smsLimiter = new TokenBucketRateLimiter(1, 1 / 1000);

/**
 * Pre-configured call rate limiter: 1 concurrent outbound call per 5 seconds.
 */
export const callLimiter = new TokenBucketRateLimiter(1, 1 / 5000);
