import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CallState } from './call-state.js';
import type { Provider } from '../tools/handlers/search.js';

// ─── Module-level mock for telnyx-client ──────────────────────────────────
// Must be at top level so vi.mock hoisting captures it correctly.
// The mock factory returns a fresh spy per test via the module-level variable.

const mockMessagesSend = vi.fn();

vi.mock('./telnyx-client.js', () => ({
  getTelnyxClient: () => ({
    messages: { send: mockMessagesSend },
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    name: 'Acme Plumbing',
    phone: '512-555-1234',
    rating: 4.8,
    reviewCount: 42,
    address: '123 Main St',
    distanceKm: 2.3,
    distanceLabel: '2.3 km',
    isOpenNow: true,
    openingHoursText: undefined,
    placeId: 'abc123',
    source: 'google_places',
    ...overrides,
  };
}

function makeState(overrides: Partial<CallState> = {}): CallState {
  return {
    callControlId: 'cc-001',
    callerPhone: '+15125559999',
    language: 'en',
    stage: 'transferred',
    pendingBridge: false,
    intent: { serviceType: 'plumber', location: 'Austin' },
    clarificationTurns: 0,
    startedAt: new Date(),
    callerName: 'Sarah',
    smsConsent: true,
    consentTimestamp: '2026-01-01T00:00:00Z',
    consentMethod: 'verbal',
    silenceNudgeTimer: undefined,
    silenceNudgeCount: 0,
    providers: [makeProvider()],
    currentProviderIndex: 0,
    providerCallControlId: undefined,
    ...overrides,
  };
}

// ─── buildSuccessSms ──────────────────────────────────────────────────────

describe('buildSuccessSms', () => {
  let buildSuccessSms: (state: CallState, buyMeACoffeeUrl: string) => string;

  beforeEach(async () => {
    const mod = await import('./recap-sms.js');
    buildSuccessSms = mod.buildSuccessSms;
  });

  it('includes caller name in greeting', () => {
    const state = makeState({ callerName: 'Sarah' });
    const result = buildSuccessSms(state, 'https://buymeacoffee.com/murphy');
    expect(result).toContain('Hey Sarah!');
  });

  it('falls back to "Hey there!" when callerName is undefined', () => {
    const state = makeState({ callerName: undefined });
    const result = buildSuccessSms(state, 'https://buymeacoffee.com/murphy');
    expect(result).toContain('Hey there!');
    expect(result).not.toContain('undefined');
  });

  it('includes connected provider name and phone', () => {
    const state = makeState({
      providers: [makeProvider({ name: 'Acme Plumbing', phone: '512-555-1234' })],
      currentProviderIndex: 0,
    });
    const result = buildSuccessSms(state, 'https://buymeacoffee.com/murphy');
    expect(result).toContain('Acme Plumbing');
    expect(result).toContain('512-555-1234');
  });

  it('includes BuyMeACoffee link when URL is non-empty', () => {
    const state = makeState();
    const result = buildSuccessSms(state, 'https://buymeacoffee.com/murphy');
    expect(result).toContain('https://buymeacoffee.com/murphy');
    expect(result.toLowerCase()).toContain('coffee');
  });

  it('omits tip line when buyMeACoffeeUrl is empty string', () => {
    const state = makeState();
    const result = buildSuccessSms(state, '');
    expect(result.toLowerCase()).not.toContain('coffee');
    expect(result).not.toContain('buymeacoffee');
  });

  it('includes tried providers list when currentProviderIndex > 0', () => {
    const state = makeState({
      providers: [
        makeProvider({ name: "Joe's Plumbing", phone: '512-555-5678' }),
        makeProvider({ name: "Bob's Repairs", phone: '512-555-9012' }),
        makeProvider({ name: 'Acme Plumbing', phone: '512-555-1234' }),
      ],
      currentProviderIndex: 2,
    });
    const result = buildSuccessSms(state, '');
    expect(result).toContain("Joe's Plumbing");
    expect(result).toContain("Bob's Repairs");
    expect(result).toContain('unavailable');
  });

  it('caps tried providers at 3', () => {
    const state = makeState({
      providers: [
        makeProvider({ name: 'Provider A', phone: '111' }),
        makeProvider({ name: 'Provider B', phone: '222' }),
        makeProvider({ name: 'Provider C', phone: '333' }),
        makeProvider({ name: 'Provider D', phone: '444' }),
        makeProvider({ name: 'Provider E', phone: '555' }),
        makeProvider({ name: 'Provider F', phone: '666' }),
      ],
      currentProviderIndex: 5,
    });
    const result = buildSuccessSms(state, '');
    expect(result).toContain('Provider A');
    expect(result).toContain('Provider B');
    expect(result).toContain('Provider C');
    expect(result).not.toContain('Provider D');
  });

  it('does not include tried-providers line when currentProviderIndex is 0', () => {
    const state = makeState({
      providers: [makeProvider()],
      currentProviderIndex: 0,
    });
    const result = buildSuccessSms(state, '');
    expect(result).not.toContain('unavailable');
    expect(result).not.toContain('also tried');
  });

  it('full message with name, provider, and tip link matches expected format', () => {
    const state = makeState({
      callerName: 'Sarah',
      providers: [makeProvider({ name: 'Acme Plumbing', phone: '512-555-1234' })],
      currentProviderIndex: 0,
    });
    const result = buildSuccessSms(state, 'https://buymeacoffee.com/murphy');
    expect(result).toContain('Hey Sarah!');
    expect(result).toContain('Acme Plumbing');
    expect(result).toContain('512-555-1234');
    expect(result).toContain('https://buymeacoffee.com/murphy');
  });
});

// ─── buildFailureSms ─────────────────────────────────────────────────────

describe('buildFailureSms', () => {
  let buildFailureSms: (state: CallState) => string;

  beforeEach(async () => {
    const mod = await import('./recap-sms.js');
    buildFailureSms = mod.buildFailureSms;
  });

  it('includes caller name in greeting', () => {
    const state = makeState({ callerName: 'Sarah' });
    const result = buildFailureSms(state);
    expect(result).toContain('Hey Sarah!');
  });

  it('falls back to "Hey there!" when callerName is undefined', () => {
    const state = makeState({ callerName: undefined });
    const result = buildFailureSms(state);
    expect(result).toContain('Hey there!');
    expect(result).not.toContain('undefined');
  });

  it('includes service type when intent.serviceType is set', () => {
    const state = makeState({ intent: { serviceType: 'plumber', location: 'Austin' } });
    const result = buildFailureSms(state);
    expect(result).toContain('plumber');
  });

  it('falls back to "a provider" when intent.serviceType is undefined', () => {
    const state = makeState({ intent: {} });
    const result = buildFailureSms(state);
    expect(result).toContain('a provider');
  });

  it('lists top 3 provider names and phones', () => {
    const state = makeState({
      providers: [
        makeProvider({ name: 'Acme Plumbing', phone: '512-555-1234' }),
        makeProvider({ name: "Joe's", phone: '512-555-5678' }),
        makeProvider({ name: "Bob's", phone: '512-555-9012' }),
        makeProvider({ name: 'Extra', phone: '512-555-0000' }),
      ],
    });
    const result = buildFailureSms(state);
    expect(result).toContain('Acme Plumbing');
    expect(result).toContain('512-555-1234');
    expect(result).toContain("Joe's");
    expect(result).toContain('512-555-5678');
    expect(result).toContain("Bob's");
    expect(result).toContain('512-555-9012');
    expect(result).not.toContain('Extra');
  });

  it('lists both providers when only 2 exist', () => {
    const state = makeState({
      providers: [
        makeProvider({ name: 'Provider A', phone: '111' }),
        makeProvider({ name: 'Provider B', phone: '222' }),
      ],
    });
    const result = buildFailureSms(state);
    expect(result).toContain('Provider A');
    expect(result).toContain('Provider B');
  });

  it('ends with "Good luck!"', () => {
    const state = makeState();
    const result = buildFailureSms(state);
    expect(result).toContain('Good luck!');
  });

  it('does NOT contain coffee or buymeacoffee link', () => {
    const state = makeState();
    const result = buildFailureSms(state);
    expect(result.toLowerCase()).not.toContain('coffee');
    expect(result).not.toContain('buymeacoffee');
  });
});

// ─── sendRecapSms ─────────────────────────────────────────────────────────

describe('sendRecapSms', () => {
  let sendRecapSms: (
    state: CallState,
    callStatus: 'completed' | 'no_match' | 'abandoned'
  ) => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockMessagesSend.mockResolvedValue({});
    const mod = await import('./recap-sms.js');
    sendRecapSms = mod.sendRecapSms;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips send when smsConsent is undefined', async () => {
    const state = makeState({ smsConsent: undefined });
    await sendRecapSms(state, 'completed');
    expect(mockMessagesSend).not.toHaveBeenCalled();
  });

  it('skips send when smsConsent is false', async () => {
    const state = makeState({ smsConsent: false });
    await sendRecapSms(state, 'completed');
    expect(mockMessagesSend).not.toHaveBeenCalled();
  });

  it('skips send when callerPhone is empty string', async () => {
    const state = makeState({ smsConsent: true, callerPhone: '' });
    await sendRecapSms(state, 'completed');
    expect(mockMessagesSend).not.toHaveBeenCalled();
  });

  it('calls messages.send for callStatus=completed', async () => {
    const state = makeState({ smsConsent: true, callerPhone: '+15125559999' });
    await sendRecapSms(state, 'completed');
    expect(mockMessagesSend).toHaveBeenCalledOnce();
  });

  it('calls messages.send for callStatus=no_match', async () => {
    const state = makeState({ smsConsent: true, callerPhone: '+15125559999' });
    await sendRecapSms(state, 'no_match');
    expect(mockMessagesSend).toHaveBeenCalledOnce();
  });

  it('calls messages.send for callStatus=abandoned', async () => {
    const state = makeState({ smsConsent: true, callerPhone: '+15125559999' });
    await sendRecapSms(state, 'abandoned');
    expect(mockMessagesSend).toHaveBeenCalledOnce();
  });

  it('sends to callerPhone and from TELNYX_PHONE_NUMBER', async () => {
    process.env.TELNYX_PHONE_NUMBER = '+18888306873';
    const state = makeState({ smsConsent: true, callerPhone: '+15125559999' });
    await sendRecapSms(state, 'completed');
    const call = mockMessagesSend.mock.calls[0][0];
    expect(call.to).toBe('+15125559999');
    expect(call.from).toBe('+18888306873');
  });

  it('does not throw when messages.send throws (non-fatal)', async () => {
    mockMessagesSend.mockRejectedValueOnce(new Error('SMS API failure'));
    const state = makeState({ smsConsent: true, callerPhone: '+15125559999' });
    await expect(sendRecapSms(state, 'completed')).resolves.toBeUndefined();
  });
});
