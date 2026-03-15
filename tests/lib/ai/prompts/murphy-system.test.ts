import { describe, it, expect } from 'vitest';
import { buildMurphySystemPrompt } from '../../../../src/lib/ai/prompts/murphy-system.js';

describe('buildMurphySystemPrompt', () => {
  it('returns a string containing "Murphy"', () => {
    const prompt = buildMurphySystemPrompt();
    expect(prompt).toContain('Murphy');
  });

  it('contains "AI" in the first sentence (FCC/CA SB-1001 compliance)', () => {
    const prompt = buildMurphySystemPrompt();
    const firstSentence = prompt.split(/[.!?]/)[0];
    expect(firstSentence).toContain('AI');
  });

  it('includes voice mode directive when isVoiceCall is true', () => {
    const prompt = buildMurphySystemPrompt({ isVoiceCall: true });
    // Voice modifier should append no-markdown / spoken language rules
    expect(prompt.toLowerCase()).toMatch(/no markdown|spoken|bullet/);
  });

  it('does not include voice mode directive when isVoiceCall is false or omitted', () => {
    const prompt = buildMurphySystemPrompt({ isVoiceCall: false });
    // Should not have voice-specific override block
    expect(prompt).not.toMatch(/VOICE MODE/);
  });

  it('mentions search_providers tool', () => {
    const prompt = buildMurphySystemPrompt();
    expect(prompt).toContain('search_providers');
  });

  it('mentions call_provider tool', () => {
    const prompt = buildMurphySystemPrompt();
    expect(prompt).toContain('call_provider');
  });

  it('mentions transfer_call tool', () => {
    const prompt = buildMurphySystemPrompt();
    expect(prompt).toContain('transfer_call');
  });

  it('mentions send_sms tool', () => {
    const prompt = buildMurphySystemPrompt();
    expect(prompt).toContain('send_sms');
  });

  it('includes INTAKE dispatch pipeline stage', () => {
    const prompt = buildMurphySystemPrompt();
    expect(prompt).toContain('INTAKE');
  });

  it('includes SEARCH dispatch pipeline stage', () => {
    const prompt = buildMurphySystemPrompt();
    expect(prompt).toContain('SEARCH');
  });

  it('includes RANK dispatch pipeline stage', () => {
    const prompt = buildMurphySystemPrompt();
    expect(prompt).toContain('RANK');
  });

  it('includes DIAL dispatch pipeline stage', () => {
    const prompt = buildMurphySystemPrompt();
    expect(prompt).toContain('DIAL');
  });

  it('includes CONNECT dispatch pipeline stage', () => {
    const prompt = buildMurphySystemPrompt();
    expect(prompt).toContain('CONNECT');
  });

  it('includes FOLLOW-UP dispatch pipeline stage', () => {
    const prompt = buildMurphySystemPrompt();
    expect(prompt).toContain('FOLLOW-UP');
  });
});
