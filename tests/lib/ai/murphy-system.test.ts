import { describe, it, expect } from 'vitest';
import { buildMurphySystemPrompt } from '../../../src/lib/ai/prompts/murphy-system.js';

describe('buildMurphySystemPrompt — two-step greeting, TCPA, clarification, edge cases', () => {
  it('contains "Who am I speaking with" (two-step greeting)', () => {
    expect(buildMurphySystemPrompt()).toContain('Who am I speaking with');
  });

  it('contains "TWO clarifying questions maximum" (not ONE)', () => {
    const prompt = buildMurphySystemPrompt();
    const hasTwoClarifying =
      prompt.includes('TWO clarifying questions maximum') ||
      prompt.toLowerCase().includes('2 clarifying');
    expect(hasTwoClarifying).toBe(true);
  });

  it('does NOT contain "ONE clarifying question maximum"', () => {
    expect(buildMurphySystemPrompt()).not.toContain('ONE clarifying question maximum');
  });

  it('contains "consent" or "text recap" (TCPA instruction)', () => {
    const prompt = buildMurphySystemPrompt();
    const hasTcpa = prompt.includes('consent') || prompt.includes('text recap');
    expect(hasTcpa).toBe(true);
  });

  it('contains "caller\'s name" or "name" in greeting section', () => {
    const prompt = buildMurphySystemPrompt();
    expect(prompt.toLowerCase()).toContain('name');
  });

  it('includes voice modifiers when isVoiceCall is true', () => {
    const prompt = buildMurphySystemPrompt({ isVoiceCall: true });
    expect(prompt).toContain('VOICE MODE');
  });

  it('does NOT include voice modifiers when isVoiceCall is false', () => {
    const prompt = buildMurphySystemPrompt({ isVoiceCall: false });
    expect(prompt).not.toContain('VOICE MODE');
  });

  it('contains "8 seconds" or "silence" for nudge instruction', () => {
    const prompt = buildMurphySystemPrompt();
    const hasSilence = prompt.includes('8 seconds') || prompt.toLowerCase().includes('silence');
    expect(hasSilence).toBe(true);
  });

  it('contains "I only handle finding service providers" (off-topic redirect)', () => {
    expect(buildMurphySystemPrompt()).toContain('I only handle finding service providers');
  });

  it('contains "I\'m an AI that finds local service providers" (confused caller explainer)', () => {
    expect(buildMurphySystemPrompt()).toContain(
      "I'm an AI that finds local service providers"
    );
  });

  it('contains "general home repair services" (broad search bypass pattern)', () => {
    expect(buildMurphySystemPrompt()).toContain('general home repair services');
  });

  it('does NOT contain "if that\'s not right" (no hedge on bypass)', () => {
    expect(buildMurphySystemPrompt()).not.toContain("if that's not right");
  });
});
