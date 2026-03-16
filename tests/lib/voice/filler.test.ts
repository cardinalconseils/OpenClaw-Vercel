import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getFillerPhrase,
  FILLER_ESCALATION_10S,
  FILLER_ESCALATION_20S,
  startFillerLoop,
  stopFillerLoop,
  FILLERS_EN,
} from '../../../src/lib/voice/filler.js';

describe('getFillerPhrase', () => {
  it('returns a non-empty string for "en"', () => {
    const phrase = getFillerPhrase('en');
    expect(typeof phrase).toBe('string');
    expect(phrase.length).toBeGreaterThan(0);
  });

  it('returns a non-empty string for "fr"', () => {
    const phrase = getFillerPhrase('fr');
    expect(typeof phrase).toBe('string');
    expect(phrase.length).toBeGreaterThan(0);
  });

  it('EN filler pool has >= 3 unique variants', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      seen.add(getFillerPhrase('en'));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('FR filler pool has >= 3 unique variants', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      seen.add(getFillerPhrase('fr'));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('never returns undefined or empty string', () => {
    for (let i = 0; i < 20; i++) {
      const enPhrase = getFillerPhrase('en');
      const frPhrase = getFillerPhrase('fr');
      expect(enPhrase).toBeTruthy();
      expect(frPhrase).toBeTruthy();
    }
  });

  it('round-robin returns >= 3 unique values in first 5 calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      seen.add(getFillerPhrase('en'));
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});

describe('FILLERS_EN', () => {
  it('has >= 15 distinct phrases', () => {
    expect(FILLERS_EN.length).toBeGreaterThanOrEqual(15);
    const unique = new Set(FILLERS_EN);
    expect(unique.size).toBe(FILLERS_EN.length);
  });

  it('has exactly 18 phrases', () => {
    expect(FILLERS_EN.length).toBe(18);
  });

  it('getFillerPhrase returns all 18 EN phrases before repeating', () => {
    // Reset is done by cycling through the full set
    // Since counter starts at some offset, collect 36 and verify 18 unique
    const seen = new Set<string>();
    for (let i = 0; i < 18; i++) {
      seen.add(getFillerPhrase('en'));
    }
    expect(seen.size).toBe(18);
  });
});

describe('FILLER_ESCALATION_10S', () => {
  it('contains "longer than usual"', () => {
    expect(FILLER_ESCALATION_10S).toContain('longer than usual');
  });
});

describe('FILLER_ESCALATION_20S', () => {
  it('contains "different approach"', () => {
    expect(FILLER_ESCALATION_20S).toContain('different approach');
  });
});

describe('startFillerLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls speakFn immediately with a filler phrase', () => {
    const speakFn = vi.fn().mockResolvedValue(undefined);
    startFillerLoop(speakFn);
    expect(speakFn).toHaveBeenCalledTimes(1);
    expect(typeof speakFn.mock.calls[0][0]).toBe('string');
    expect((speakFn.mock.calls[0][0] as string).length).toBeGreaterThan(0);
  });

  it('calls speakFn again after ~10s with another filler phrase', async () => {
    const speakFn = vi.fn().mockResolvedValue(undefined);
    startFillerLoop(speakFn);
    expect(speakFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(speakFn).toHaveBeenCalledTimes(2);
  });

  it('uses FILLER_ESCALATION_10S at the 10s mark', async () => {
    const speakFn = vi.fn().mockResolvedValue(undefined);
    startFillerLoop(speakFn);
    await vi.advanceTimersByTimeAsync(10_000);
    // Second call should be escalation 10s
    expect(speakFn.mock.calls[1][0]).toBe(FILLER_ESCALATION_10S);
  });

  it('uses FILLER_ESCALATION_20S at the 20s mark', async () => {
    const speakFn = vi.fn().mockResolvedValue(undefined);
    startFillerLoop(speakFn);
    await vi.advanceTimersByTimeAsync(20_000);
    // Third call should be escalation 20s
    expect(speakFn.mock.calls[2][0]).toBe(FILLER_ESCALATION_20S);
  });
});

describe('stopFillerLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops the interval (no further calls after stop)', async () => {
    const speakFn = vi.fn().mockResolvedValue(undefined);
    const handle = startFillerLoop(speakFn);
    expect(speakFn).toHaveBeenCalledTimes(1);
    stopFillerLoop(handle);
    await vi.advanceTimersByTimeAsync(30_000);
    // Should not have been called again after stop
    expect(speakFn).toHaveBeenCalledTimes(1);
  });
});
