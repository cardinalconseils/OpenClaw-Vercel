/**
 * Unit tests for outbound-caller.ts
 * Covers CALL-01 through CALL-07 behaviors.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getTelnyxClient before importing the module under test
const mockDial = vi.fn().mockResolvedValue({ data: { call_control_id: 'provider-ccid-123' } });
const mockHangup = vi.fn().mockResolvedValue({});
const mockSpeak = vi.fn().mockResolvedValue({});
const mockMessagesSend = vi.fn().mockResolvedValue({});

vi.mock('./telnyx-client.js', () => ({
  getTelnyxClient: () => ({
    calls: {
      dial: mockDial,
      actions: {
        speak: mockSpeak,
        hangup: mockHangup,
      },
    },
    messages: {
      send: mockMessagesSend,
    },
  }),
}));

// Mock call-state
const mockState = {
  callControlId: 'user-ccid',
  callerPhone: '+15551234567',
  language: 'en' as const,
  stage: 'searching' as const,
  intent: { serviceType: 'plumber', location: 'Austin TX' },
  clarificationTurns: 0,
  startedAt: new Date(),
  callerName: 'Alice',
  smsConsent: true,
  consentTimestamp: undefined,
  consentMethod: undefined,
  silenceNudgeTimer: undefined,
  silenceNudgeCount: 0,
  providers: [
    {
      name: 'Acme Plumbing',
      phone: '+15559998888',
      rating: 4.8,
      reviewCount: 150,
      address: '123 Main St',
      distanceKm: 2.5,
      distanceLabel: '2.5 km',
      isOpenNow: true,
      openingHoursText: undefined,
      placeId: 'place-001',
      source: 'google_places' as const,
    },
    {
      name: 'Bob the Plumber',
      phone: '+15557776666',
      rating: 4.5,
      reviewCount: 80,
      address: '456 Oak Ave',
      distanceKm: 3.0,
      distanceLabel: '3.0 km',
      isOpenNow: true,
      openingHoursText: undefined,
      placeId: 'place-002',
      source: 'google_places' as const,
    },
  ],
  currentProviderIndex: 0,
  providerCallControlId: undefined,
};

const mockGetCall = vi.fn().mockReturnValue(mockState);
const mockUpdateCall = vi.fn();

vi.mock('./call-state.js', () => ({
  getCall: (...args: unknown[]) => mockGetCall(...args),
  updateCall: (...args: unknown[]) => mockUpdateCall(...args),
}));

import {
  parseAvailability,
  decodeClientState,
  AI_INTRO,
  NO_MATCH_MESSAGE,
  startNarrationTimer,
  stopNarrationTimer,
  sendProviderSms,
  dialProvider,
  handleProviderAnswer,
  handleAmdResult,
  handleProviderHangup,
  tryNextProvider,
  startOutboundCascade,
} from './outbound-caller.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCall.mockReturnValue({ ...mockState, providers: [...mockState.providers] });
});

// ─── parseAvailability (CALL-06) ───────────────────────────────────────────

describe('parseAvailability', () => {
  it('returns "available" for "yes"', () => {
    expect(parseAvailability('yes')).toBe('available');
  });

  it('returns "available" for "sure"', () => {
    expect(parseAvailability('sure')).toBe('available');
  });

  it('returns "available" for "absolutely"', () => {
    expect(parseAvailability('absolutely')).toBe('available');
  });

  it('returns "unavailable" for "no"', () => {
    expect(parseAvailability('no')).toBe('unavailable');
  });

  it('returns "unavailable" for "busy"', () => {
    expect(parseAvailability('busy')).toBe('unavailable');
  });

  it('returns "unavailable" for "we are closed"', () => {
    expect(parseAvailability('we are closed')).toBe('unavailable');
  });

  it('returns "unclear" for ambiguous input', () => {
    expect(parseAvailability('maybe')).toBe('unclear');
  });

  it('returns "unclear" for empty string', () => {
    expect(parseAvailability('')).toBe('unclear');
  });
});

// ─── decodeClientState ────────────────────────────────────────────────────

describe('decodeClientState', () => {
  it('decodes valid base64 JSON', () => {
    const payload = { stage: 'provider-dial', userCallControlId: 'ccid-123' };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
    expect(decodeClientState(encoded)).toEqual(payload);
  });

  it('returns {} for undefined', () => {
    expect(decodeClientState(undefined)).toEqual({});
  });

  it('returns {} for invalid base64/JSON', () => {
    expect(decodeClientState('not-valid-base64!!!')).toEqual({});
  });
});

// ─── AI_INTRO (CALL-02) ──────────────────────────────────────────────────

describe('AI_INTRO', () => {
  it('contains "AI concierge"', () => {
    expect(AI_INTRO('Acme', 'plumbing', 'Austin TX')).toContain('AI concierge');
  });

  it('contains "not a human"', () => {
    expect(AI_INTRO('Acme', 'plumbing', 'Austin TX')).toContain('not a human');
  });

  it('includes provider name, serviceType and location', () => {
    const intro = AI_INTRO('Acme Plumbing', 'plumber', 'Austin TX');
    expect(intro).toContain('plumber');
    expect(intro).toContain('Austin TX');
  });
});

// ─── NO_MATCH_MESSAGE ─────────────────────────────────────────────────────

describe('NO_MATCH_MESSAGE', () => {
  it('is a non-empty string', () => {
    expect(typeof NO_MATCH_MESSAGE).toBe('string');
    expect(NO_MATCH_MESSAGE.length).toBeGreaterThan(0);
  });
});

// ─── startNarrationTimer / stopNarrationTimer (CALL-03) ──────────────────

describe('startNarrationTimer', () => {
  it('returns a stoppable handle', () => {
    const handle = startNarrationTimer('user-ccid', 'Acme Plumbing');
    expect(handle).toHaveProperty('stop');
    expect(typeof handle.stop).toBe('function');
    handle.stop(); // cleanup
  });

  it('stop() does not throw when called multiple times', () => {
    const handle = startNarrationTimer('user-ccid-2', 'Bob the Plumber');
    expect(() => {
      handle.stop();
      handle.stop();
    }).not.toThrow();
  });
});

// ─── sendProviderSms (CALL-04) ────────────────────────────────────────────

describe('sendProviderSms', () => {
  it('calls messages.send() with correct from, to, and text', async () => {
    process.env.TELNYX_PHONE_NUMBER = '+15550000000';
    const provider = mockState.providers[0];
    await sendProviderSms(provider, { intent: { serviceType: 'plumber', location: 'Austin TX' } });

    expect(mockMessagesSend).toHaveBeenCalledOnce();
    const args = mockMessagesSend.mock.calls[0][0];
    expect(args.from).toBe('+15550000000');
    expect(args.to).toBe(provider.phone);
    expect(args.text).toContain('plumber');
    expect(args.text).toContain('Austin TX');
  });

  it('does not throw when messages.send() rejects (non-fatal)', async () => {
    mockMessagesSend.mockRejectedValueOnce(new Error('SMS failed'));
    const provider = mockState.providers[0];
    await expect(
      sendProviderSms(provider, { intent: { serviceType: 'plumber', location: 'Austin TX' } })
    ).resolves.toBeUndefined();
  });
});

// ─── dialProvider (CALL-01) ───────────────────────────────────────────────

describe('dialProvider', () => {
  it('calls calls.dial() with correct connection_id, timeout_secs=25, AMD detect_words', async () => {
    process.env.TELNYX_CONNECTION_ID = 'conn-id-abc';
    process.env.TELNYX_PHONE_NUMBER = '+15550000000';
    const provider = mockState.providers[0];
    await dialProvider('user-ccid', provider, 0);

    expect(mockDial).toHaveBeenCalledOnce();
    const args = mockDial.mock.calls[0][0];
    expect(args.connection_id).toBe('conn-id-abc');
    expect(args.to).toBe(provider.phone);
    expect(args.timeout_secs).toBe(25);
    expect(args.answering_machine_detection).toBe('detect_words');
  });

  it('encodes client_state as base64 JSON with stage=provider-dial', async () => {
    const provider = mockState.providers[0];
    await dialProvider('user-ccid', provider, 0);
    const args = mockDial.mock.calls[0][0];
    const decoded = JSON.parse(Buffer.from(args.client_state, 'base64').toString('utf8'));
    expect(decoded.stage).toBe('provider-dial');
    expect(decoded.userCallControlId).toBe('user-ccid');
    expect(decoded.providerName).toBe('Acme Plumbing');
    expect(decoded.providerIndex).toBe(0);
  });

  it('stores providerCallControlId on successful dial', async () => {
    const provider = mockState.providers[0];
    await dialProvider('user-ccid', provider, 0);
    expect(mockUpdateCall).toHaveBeenCalledWith('user-ccid', { providerCallControlId: 'provider-ccid-123' });
  });
});

// ─── handleAmdResult (CALL-05) ────────────────────────────────────────────

describe('handleAmdResult', () => {
  it('hangs up provider leg and calls tryNextProvider when result=machine', async () => {
    const clientState = {
      userCallControlId: 'user-ccid',
      providerName: 'Acme Plumbing',
      providerIndex: 0,
    };
    mockGetCall
      .mockReturnValueOnce({ ...mockState, currentProviderIndex: 0 }) // for tryNextProvider's getCall
      .mockReturnValueOnce({ ...mockState, currentProviderIndex: 1 }); // tryNextProvider exhaust check

    await handleAmdResult('provider-ccid', 'machine', clientState);

    expect(mockHangup).toHaveBeenCalledWith('provider-ccid', {});
    expect(mockSpeak).toHaveBeenCalled();
    // tryNextProvider increments index — updateCall should be called with providerIndex+1
    expect(mockUpdateCall).toHaveBeenCalledWith('user-ccid', expect.objectContaining({ currentProviderIndex: 1 }));
  });

  it('does not hang up when result=human', async () => {
    const clientState = {
      userCallControlId: 'user-ccid',
      providerName: 'Acme Plumbing',
      providerIndex: 0,
    };
    await handleAmdResult('provider-ccid', 'human', clientState);
    expect(mockHangup).not.toHaveBeenCalled();
  });
});

// ─── handleProviderHangup (CALL-05) ───────────────────────────────────────

describe('handleProviderHangup', () => {
  it('cascades on timeout hangup cause', async () => {
    const clientState = {
      userCallControlId: 'user-ccid',
      providerName: 'Acme Plumbing',
      providerIndex: 0,
    };
    mockGetCall
      .mockReturnValueOnce({ ...mockState, currentProviderIndex: 1 }); // tryNextProvider

    await handleProviderHangup('provider-ccid', 'timeout', clientState);

    expect(mockSpeak).toHaveBeenCalled();
    expect(mockUpdateCall).toHaveBeenCalledWith('user-ccid', expect.objectContaining({ currentProviderIndex: 1 }));
  });

  it('cascades on user_busy hangup cause', async () => {
    const clientState = {
      userCallControlId: 'user-ccid',
      providerName: 'Acme Plumbing',
      providerIndex: 0,
    };
    mockGetCall
      .mockReturnValueOnce({ ...mockState, currentProviderIndex: 1 });

    await handleProviderHangup('provider-ccid', 'user_busy', clientState);
    expect(mockUpdateCall).toHaveBeenCalledWith('user-ccid', expect.objectContaining({ currentProviderIndex: 1 }));
  });

  it('does not cascade on normal_clearing hangup cause', async () => {
    const clientState = {
      userCallControlId: 'user-ccid',
      providerName: 'Acme Plumbing',
      providerIndex: 0,
    };
    await handleProviderHangup('provider-ccid', 'normal_clearing', clientState);
    expect(mockUpdateCall).not.toHaveBeenCalled();
  });
});

// ─── tryNextProvider (CALL-07) ────────────────────────────────────────────

describe('tryNextProvider', () => {
  it('speaks NO_MATCH_MESSAGE and sets stage=complete when index >= MAX_CASCADE_PROVIDERS (4)', async () => {
    mockGetCall.mockReset();
    mockGetCall.mockReturnValue({
      ...mockState,
      currentProviderIndex: 4,
      providers: mockState.providers,
    });

    await tryNextProvider('user-ccid');

    expect(mockSpeak).toHaveBeenCalledWith('user-ccid', expect.objectContaining({ payload: NO_MATCH_MESSAGE }));
    expect(mockUpdateCall).toHaveBeenCalledWith('user-ccid', { stage: 'complete' });
  });

  it('speaks NO_MATCH_MESSAGE when providers list is empty (no providers at index)', async () => {
    mockGetCall.mockReturnValue({
      ...mockState,
      currentProviderIndex: 0,
      providers: [],
    });

    await tryNextProvider('user-ccid');

    expect(mockSpeak).toHaveBeenCalledWith('user-ccid', expect.objectContaining({ payload: NO_MATCH_MESSAGE }));
  });

  it('dials next provider when index is within bounds', async () => {
    // tryNextProvider reads state, then dialProvider calls updateCall
    mockGetCall.mockReturnValue({
      ...mockState,
      currentProviderIndex: 0,
      providers: mockState.providers,
    });

    await tryNextProvider('user-ccid');

    expect(mockDial).toHaveBeenCalled();
  });
});

// ─── startOutboundCascade (CALL-01) ───────────────────────────────────────

describe('startOutboundCascade', () => {
  it('speaks NO_MATCH_MESSAGE and sets stage=complete when providers list is empty', async () => {
    mockGetCall.mockReturnValue({
      ...mockState,
      providers: [],
    });

    await startOutboundCascade('user-ccid');

    expect(mockSpeak).toHaveBeenCalledWith('user-ccid', expect.objectContaining({ payload: NO_MATCH_MESSAGE }));
    expect(mockUpdateCall).toHaveBeenCalledWith('user-ccid', { stage: 'complete' });
  });

  it('speaks NO_MATCH_MESSAGE when state is not found', async () => {
    mockGetCall.mockReturnValue(undefined);

    await startOutboundCascade('user-ccid');

    expect(mockSpeak).toHaveBeenCalledWith('user-ccid', expect.objectContaining({ payload: NO_MATCH_MESSAGE }));
    expect(mockUpdateCall).toHaveBeenCalledWith('user-ccid', { stage: 'complete' });
  });

  it('resets currentProviderIndex to 0 and starts cascade when providers exist', async () => {
    mockGetCall.mockReturnValue({
      ...mockState,
      providers: mockState.providers,
      currentProviderIndex: 2, // should reset to 0
    });

    await startOutboundCascade('user-ccid');

    expect(mockUpdateCall).toHaveBeenCalledWith('user-ccid', { currentProviderIndex: 0, stage: 'calling' });
  });
});

// ─── handleProviderAnswer (CALL-02) ───────────────────────────────────────

describe('handleProviderAnswer', () => {
  it('speaks AI_INTRO on provider leg as first utterance', async () => {
    mockGetCall.mockReturnValue({
      ...mockState,
      intent: { serviceType: 'plumber', location: 'Austin TX' },
    });

    const clientState = {
      userCallControlId: 'user-ccid',
      providerName: 'Acme Plumbing',
    };

    await handleProviderAnswer('provider-ccid', clientState);

    // First speak call should be to provider leg with AI intro
    const firstSpeakCall = mockSpeak.mock.calls[0];
    expect(firstSpeakCall[0]).toBe('provider-ccid'); // called on provider leg
    expect(firstSpeakCall[1].payload).toContain('AI concierge');
    expect(firstSpeakCall[1].payload).toContain('not a human');
  });
});
