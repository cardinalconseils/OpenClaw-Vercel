import { describe, it, expect, beforeEach } from 'vitest';
import {
  initCall,
  getCall,
  updateCall,
  endCall,
  detectLanguage,
  shouldAdvancePastClarification,
} from '../../../src/lib/voice/call-state.js';

describe('call-state', () => {
  // Use unique IDs per test to avoid cross-test interference in the shared Map
  let testId: string;

  beforeEach(() => {
    testId = `test-${Date.now()}-${Math.random()}`;
  });

  describe('initCall', () => {
    it('returns CallState with language="en", stage="greeting", empty intent, clarificationTurns=0', () => {
      const state = initCall(testId, '+15145550001');
      expect(state.language).toBe('en');
      expect(state.stage).toBe('greeting');
      expect(state.intent).toEqual({});
      expect(state.clarificationTurns).toBe(0);
      expect(state.callControlId).toBe(testId);
      expect(state.callerPhone).toBe('+15145550001');
    });
  });

  describe('getCall', () => {
    it('returns the state after initCall', () => {
      initCall(testId, '+15145550002');
      const state = getCall(testId);
      expect(state).toBeDefined();
      expect(state?.callControlId).toBe(testId);
    });

    it('returns undefined for unknown ID', () => {
      expect(getCall('unknown-id-that-does-not-exist')).toBeUndefined();
    });
  });

  describe('updateCall', () => {
    it('merges partial state — updating language to "fr" preserves other fields', () => {
      initCall(testId, '+15145550003');
      updateCall(testId, { language: 'fr' });
      const state = getCall(testId);
      expect(state?.language).toBe('fr');
      expect(state?.stage).toBe('greeting');
      expect(state?.callerPhone).toBe('+15145550003');
    });

    it('does not throw when called on an unknown ID', () => {
      expect(() => updateCall('totally-unknown-id', { language: 'fr' })).not.toThrow();
    });
  });

  describe('endCall', () => {
    it('removes the state — getCall returns undefined after endCall', () => {
      initCall(testId, '+15145550004');
      expect(getCall(testId)).toBeDefined();
      endCall(testId);
      expect(getCall(testId)).toBeUndefined();
    });
  });

  describe('detectLanguage', () => {
    it('returns "fr" when >30% of words have language="fr"', () => {
      const words = [
        { word: 'bonjour', language: 'fr' },
        { word: 'je', language: 'fr' },
        { word: 'need', language: 'en' },
        { word: 'a', language: 'en' },
        { word: 'plumber', language: 'en' },
      ];
      // 2/5 = 40% French — should return 'fr'
      expect(detectLanguage(words)).toBe('fr');
    });

    it('returns "en" when <=30% of words have language="fr"', () => {
      const words = [
        { word: 'I', language: 'en' },
        { word: 'need', language: 'en' },
        { word: 'a', language: 'en' },
        { word: 'plumber', language: 'en' },
        { word: 'bonjour', language: 'fr' },
      ];
      // 1/5 = 20% French — should return 'en'
      expect(detectLanguage(words)).toBe('en');
    });

    it('returns "en" for empty words array', () => {
      expect(detectLanguage([])).toBe('en');
    });
  });

  describe('shouldAdvancePastClarification', () => {
    it('returns false when clarificationTurns=0', () => {
      const state = initCall(testId, '+15145550005');
      expect(shouldAdvancePastClarification(state)).toBe(false);
    });

    it('returns true when clarificationTurns >= 1', () => {
      const state = initCall(testId, '+15145550006');
      updateCall(testId, { clarificationTurns: 1 });
      const updated = getCall(testId)!;
      expect(shouldAdvancePastClarification(updated)).toBe(true);
    });

    it('returns true when clarificationTurns is 2', () => {
      const state = initCall(testId, '+15145550007');
      updateCall(testId, { clarificationTurns: 2 });
      const updated = getCall(testId)!;
      expect(shouldAdvancePastClarification(updated)).toBe(true);
    });
  });
});
