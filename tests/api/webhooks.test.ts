import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the telnyx client before any imports that depend on it
vi.mock('../../src/lib/voice/telnyx-client.js', () => ({
  telnyxClient: {
    webhooks: {
      unwrap: vi.fn(),
    },
  },
}));

import { telnyxClient } from '../../src/lib/voice/telnyx-client.js';
import { app } from '../../src/server.js';

const mockUnwrap = vi.mocked(telnyxClient.webhooks.unwrap);

const VALID_PAYLOAD = JSON.stringify({
  data: {
    event_type: 'call.initiated',
    id: 'test-event-id',
    payload: {
      call_control_id: 'cc-123',
      call_leg_id: 'leg-456',
      call_session_id: 'session-789',
      from: '+15550001111',
      to: '+15550002222',
      state: 'parked',
      direction: 'inbound',
    },
  },
});

describe('POST /webhooks/telnyx', () => {
  beforeAll(() => {
    // Set a dummy public key so the server doesn't crash on startup
    process.env.TELNYX_API_KEY = 'test-api-key';
    process.env.TELNYX_PUBLIC_KEY = 'test-public-key';
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('Test 1: POST /webhooks/telnyx with valid signature returns 200', async () => {
    mockUnwrap.mockResolvedValueOnce({ data: { event_type: 'call.initiated' } } as any);

    const res = await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', 'valid-sig')
      .set('telnyx-timestamp', '1234567890')
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('Test 2: POST /webhooks/telnyx with invalid signature returns 403', async () => {
    mockUnwrap.mockRejectedValueOnce(new Error('Invalid signature'));

    const res = await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', 'bad-sig')
      .set('telnyx-timestamp', '1234567890')
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('Test 3: POST /webhooks/telnyx with missing signature headers returns 403', async () => {
    mockUnwrap.mockRejectedValueOnce(new Error('Missing signature'));

    const res = await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('Test 4: POST /webhooks/telnyx logs the event type from the parsed payload', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockUnwrap.mockResolvedValueOnce({ data: { event_type: 'call.answered' } } as any);

    await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', 'valid-sig')
      .set('telnyx-timestamp', '1234567890')
      .send(VALID_PAYLOAD);

    // Give async processing a tick to run
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('call.answered')
    );

    consoleSpy.mockRestore();
  });

  it('Test 5: GET /health returns 200 with { status: "ok" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('Test 6: Webhook route uses raw body parser (not express.json()) to preserve signature integrity', async () => {
    // Verify that the raw body is passed to unwrap as a string, not a parsed object.
    // The mock unwrap captures what it was called with.
    mockUnwrap.mockResolvedValueOnce({ data: { event_type: 'call.initiated' } } as any);

    await request(app)
      .post('/webhooks/telnyx')
      .set('Content-Type', 'application/json')
      .set('telnyx-signature-ed25519', 'valid-sig')
      .set('telnyx-timestamp', '1234567890')
      .send(VALID_PAYLOAD);

    // unwrap should have been called with the raw body string
    expect(mockUnwrap).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.any(Object) })
    );

    const calledWith = mockUnwrap.mock.calls[0][0] as unknown;
    expect(typeof calledWith).toBe('string');
  });
});
