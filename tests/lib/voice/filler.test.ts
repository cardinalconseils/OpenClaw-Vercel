import { describe, it, expect } from 'vitest';
import { getFillerPhrase } from '../../../src/lib/voice/filler.js';

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
});
