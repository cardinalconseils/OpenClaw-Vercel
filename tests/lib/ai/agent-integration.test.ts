import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

// Mock the telnyx client before any server imports
vi.mock('../../../src/lib/voice/telnyx-client.js', () => ({
  telnyxClient: {
    webhooks: {
      unwrap: vi.fn(),
    },
  },
}));

// Mock the orchestrator to prevent real LLM calls in tests
vi.mock('../../../src/lib/ai/orchestrator.js', () => ({
  chat: vi.fn().mockResolvedValue('Hello! I am Murphy, an AI assistant from OpenClaw Service Matchmaker.'),
}));

import { telnyxClient } from '../../../src/lib/voice/telnyx-client.js';
import { chat } from '../../../src/lib/ai/orchestrator.js';
import { app } from '../../../src/server.js';

const mockUnwrap = vi.mocked(telnyxClient.webhooks.unwrap);
const mockChat = vi.mocked(chat);

const makePayload = (eventType: string, from = '+15550001234') =>
  JSON.stringify({
    data: {
      event_type: eventType,
      id: 'test-event-id',
      payload: {
        call_control_id: 'cc-123',
        call_leg_id: 'leg-456',
        call_session_id: 'session-789',
        from,
        to: '+15550009999',
        state: 'parked',
        direction: 'inbound',
      },
    },
  });

describe('Webhook-to-orchestrator integration', () => {
  beforeAll(() => {
    process.env.TELNYX_API_KEY = 'test-api-key';
    process.env.TELNYX_PUBLIC_KEY = 'test-public-key';
  });

  beforeEach(() => {
    mockChat.mockClear();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('POST /webhooks/telnyx with call.initiated event returns 200 and invokes orchestrator', async () => {
    const from = '+15550001234';
    mockUnwrap.mockResolvedValueOnce({
      data: {
        event_type: 'call.initiated',
        payload: { from, to: '+15550009999', call_control_id: 'cc-123' },
      },
    } as any);

    const res = await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', 'valid-sig')
      .set('telnyx-timestamp', '1234567890')
      .send(makePayload('call.initiated', from));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    // Wait for setImmediate to fire
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockChat).toHaveBeenCalledOnce();
    expect(mockChat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining(from),
        }),
      ]),
      'greeting'
    );
  });

  it('POST /webhooks/telnyx with call.answered event returns 200 without invoking orchestrator', async () => {
    mockUnwrap.mockResolvedValueOnce({
      data: {
        event_type: 'call.answered',
        payload: { from: '+15550001234', to: '+15550009999', call_control_id: 'cc-123' },
      },
    } as any);

    const res = await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', 'valid-sig')
      .set('telnyx-timestamp', '1234567890')
      .send(makePayload('call.answered'));

    expect(res.status).toBe(200);

    // Wait for setImmediate to fire
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockChat).not.toHaveBeenCalled();
  });

  it('POST /webhooks/telnyx with unknown event type returns 200', async () => {
    mockUnwrap.mockResolvedValueOnce({
      data: {
        event_type: 'call.hangup',
        payload: {},
      },
    } as any);

    const res = await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', 'valid-sig')
      .set('telnyx-timestamp', '1234567890')
      .send(makePayload('call.hangup'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    // Wait for setImmediate to fire
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockChat).not.toHaveBeenCalled();
  });
});
