import { describe, it, expect } from 'vitest';
import {
  extractIntent,
  getDisambiguationPrompt,
  isIntentComplete,
  type IntentResult,
} from '../../../src/lib/ai/intent-extractor.js';

describe('extractIntent', () => {
  it('extracts plumber in Austin (EN, complete)', () => {
    const result: IntentResult = extractIntent('I need a plumber in Austin');
    expect(result.serviceType).toBe('plumber');
    expect(result.location).toBe('Austin');
    expect(result.urgency).toBe('normal');
    expect(result.isComplete).toBe(true);
  });

  it('extracts plumber near downtown Montreal (EN, complete)', () => {
    const result = extractIntent('plumber near downtown Montreal');
    expect(result.serviceType).toBe('plumber');
    expect(result.location).toBe('downtown Montreal');
    expect(result.urgency).toBe('normal');
    expect(result.isComplete).toBe(true);
  });

  it('extracts emergency electrician in zip code (urgency: emergency, complete)', () => {
    const result = extractIntent('emergency electrician in 78701');
    expect(result.serviceType).toBe('electrician');
    expect(result.location).toBe('78701');
    expect(result.urgency).toBe('emergency');
    expect(result.isComplete).toBe(true);
  });

  it('returns isComplete: false when service type and location are missing', () => {
    const result = extractIntent('I need help with my house');
    expect(result.serviceType).toBeUndefined();
    expect(result.location).toBeUndefined();
    expect(result.urgency).toBe('normal');
    expect(result.isComplete).toBe(false);
  });

  it('returns isComplete: false when location is missing', () => {
    const result = extractIntent('plumber');
    expect(result.serviceType).toBe('plumber');
    expect(result.location).toBeUndefined();
    expect(result.urgency).toBe('normal');
    expect(result.isComplete).toBe(false);
  });

  it('extracts French service type and location (FR, complete)', () => {
    const result = extractIntent("j'ai besoin d'un plombier a Montreal");
    expect(result.serviceType).toBe('plombier');
    expect(result.location).toBe('Montreal');
    expect(result.urgency).toBe('normal');
    expect(result.isComplete).toBe(true);
  });

  it('detects urgency from "urgent" keyword', () => {
    const result = extractIntent("it's urgent, I need a locksmith");
    expect(result.urgency).toBe('emergency');
  });

  it('detects urgency from "ASAP" keyword', () => {
    const result = extractIntent('ASAP need electrician downtown');
    expect(result.urgency).toBe('emergency');
    expect(result.serviceType).toBe('electrician');
  });
});

describe('getDisambiguationPrompt', () => {
  it('returns English disambiguation prompt containing service categories', () => {
    const prompt = getDisambiguationPrompt('en');
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('plumbing');
    expect(prompt).toContain('electrical');
    expect(prompt).toContain('cleaning');
  });

  it('returns French disambiguation prompt containing plomberie', () => {
    const prompt = getDisambiguationPrompt('fr');
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('plomberie');
  });
});

describe('isIntentComplete', () => {
  it('returns true when both serviceType and location are provided', () => {
    expect(isIntentComplete({ serviceType: 'plumber', location: 'Austin' })).toBe(true);
  });

  it('returns false when location is missing', () => {
    expect(isIntentComplete({ serviceType: 'plumber' })).toBe(false);
  });

  it('returns false when both are missing', () => {
    expect(isIntentComplete({})).toBe(false);
  });
});
