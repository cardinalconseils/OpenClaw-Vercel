import { describe, it, expect } from 'vitest';
import { GREETING, GREETING_TIMEOUT_MS } from '../../../src/lib/voice/greeting.js';

describe('GREETING', () => {
  it('GREETING.en starts with "Hi, I\'m Murphy"', () => {
    expect(GREETING.en).toMatch(/^Hi, I'm Murphy/);
  });

  it('GREETING.fr starts with "Bonjour, je suis Murphy"', () => {
    expect(GREETING.fr).toMatch(/^Bonjour, je suis Murphy/);
  });

  it('GREETING.en contains "AI" before the first question mark', () => {
    const firstPart = GREETING.en.substring(0, GREETING.en.indexOf('?'));
    expect(firstPart).toContain('AI');
  });

  it('GREETING.fr contains "IA" before the first question mark', () => {
    const firstPart = GREETING.fr.substring(0, GREETING.fr.indexOf('?'));
    expect(firstPart).toContain('IA');
  });

  it('GREETING_TIMEOUT_MS equals 2000', () => {
    expect(GREETING_TIMEOUT_MS).toBe(2000);
  });
});
