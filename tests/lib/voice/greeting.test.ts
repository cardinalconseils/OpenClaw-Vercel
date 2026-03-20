import { describe, it, expect } from 'vitest';
import {
  GREETING_TIMEOUT_MS,
  GREETING_STEP_1,
  GREETING_STEP_2,
  GREETING_STEP_2_FALLBACK,
  TCPA_CONSENT_ASK,
  TCPA_CONSENT_DECLINE_ACK,
  SILENCE_NUDGE,
  GRACEFUL_HANGUP,
  OFF_TOPIC_REDIRECT,
  CONFUSED_CALLER_EXPLAINER,
} from '../../../src/lib/voice/greeting.js';

describe('greeting constants', () => {
  it('GREETING_TIMEOUT_MS equals 2000', () => {
    expect(GREETING_TIMEOUT_MS).toBe(2000);
  });

  describe('GREETING_STEP_1', () => {
    it('contains "AI" before first "?"', () => {
      const firstPart = GREETING_STEP_1.substring(0, GREETING_STEP_1.indexOf('?'));
      expect(firstPart).toContain('AI');
    });

    it('contains "Murphy"', () => {
      expect(GREETING_STEP_1).toContain('Murphy');
    });

    it('contains "Who am I speaking with"', () => {
      expect(GREETING_STEP_1).toContain('Who am I speaking with');
    });
  });

  describe('GREETING_STEP_2', () => {
    it('returns a string containing the caller name', () => {
      expect(GREETING_STEP_2('John')).toContain('John');
    });

    it('returns a string containing "service"', () => {
      expect(GREETING_STEP_2('John')).toContain('service');
    });
  });

  describe('GREETING_STEP_2_FALLBACK', () => {
    it('does NOT contain a name placeholder', () => {
      // Should not have {name}, {{name}}, [name], or similar placeholders
      expect(GREETING_STEP_2_FALLBACK).not.toMatch(/\{.*\}|\[.*\]/);
    });
  });

  describe('TCPA_CONSENT_ASK', () => {
    it('contains "text recap"', () => {
      expect(TCPA_CONSENT_ASK).toContain('text recap');
    });
  });

  describe('TCPA_CONSENT_DECLINE_ACK', () => {
    it('contains "No problem"', () => {
      expect(TCPA_CONSENT_DECLINE_ACK).toContain('No problem');
    });
  });

  describe('SILENCE_NUDGE', () => {
    it('equals "Still there?"', () => {
      expect(SILENCE_NUDGE).toBe('Still there?');
    });
  });

  describe('GRACEFUL_HANGUP', () => {
    it('contains "call back"', () => {
      expect(GRACEFUL_HANGUP).toContain('call back');
    });
  });

  describe('OFF_TOPIC_REDIRECT', () => {
    it('contains "I only handle finding service providers"', () => {
      expect(OFF_TOPIC_REDIRECT).toContain('I only handle finding service providers');
    });

    it('contains "plumbers, electricians"', () => {
      expect(OFF_TOPIC_REDIRECT).toContain('plumbers, electricians');
    });
  });

  describe('CONFUSED_CALLER_EXPLAINER', () => {
    it('contains "I\'m an AI that finds local service providers"', () => {
      expect(CONFUSED_CALLER_EXPLAINER).toContain("I'm an AI that finds local service providers");
    });

    it('contains "What do you need help with"', () => {
      expect(CONFUSED_CALLER_EXPLAINER).toContain('What do you need help with');
    });
  });
});
