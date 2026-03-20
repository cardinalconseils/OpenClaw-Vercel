import { describe, it, expect } from 'vitest';
import { TokenBucketRateLimiter, smsLimiter, callLimiter } from './rate-limiter.js';

describe('TokenBucketRateLimiter', () => {
  it('first acquire resolves immediately (token available)', async () => {
    const limiter = new TokenBucketRateLimiter(1, 1 / 1000);
    const start = Date.now();
    await limiter.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('second rapid acquire delays ~1000ms', async () => {
    const limiter = new TokenBucketRateLimiter(1, 1 / 1000);
    await limiter.acquire(); // consume the token
    const start = Date.now();
    await limiter.acquire(); // must wait for refill
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(900);
  }, 3000);

  it('smsLimiter is a TokenBucketRateLimiter instance', () => {
    expect(smsLimiter).toBeInstanceOf(TokenBucketRateLimiter);
  });

  it('callLimiter is a TokenBucketRateLimiter instance', () => {
    expect(callLimiter).toBeInstanceOf(TokenBucketRateLimiter);
  });
});
