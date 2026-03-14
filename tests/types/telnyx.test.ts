import { describe, it, expect } from 'vitest';
import { TelnyxWebhookEventSchema } from '../../src/types/telnyx.js';

const validCallInitiatedEvent = {
  data: {
    event_type: 'call.initiated',
    id: 'evt_123abc',
    payload: {
      call_control_id: 'ctrl_abc123',
      call_leg_id: 'leg_abc123',
      call_session_id: 'sess_abc123',
      from: '+15551234567',
      to: '+15559876543',
      state: 'parked',
      direction: 'incoming',
    },
  },
};

describe('TelnyxWebhookEventSchema', () => {
  it('validates a well-formed Telnyx call.initiated event', () => {
    const result = TelnyxWebhookEventSchema.safeParse(validCallInitiatedEvent);
    expect(result.success).toBe(true);
  });

  it('rejects a payload missing required fields (no data.event_type)', () => {
    const invalid = {
      data: {
        id: 'evt_123abc',
        payload: {
          call_control_id: 'ctrl_abc123',
          call_leg_id: 'leg_abc123',
          call_session_id: 'sess_abc123',
          from: '+15551234567',
          to: '+15559876543',
          state: 'parked',
          direction: 'incoming',
        },
      },
    };
    const result = TelnyxWebhookEventSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing data.payload.call_control_id', () => {
    const invalid = {
      data: {
        event_type: 'call.initiated',
        id: 'evt_123abc',
        payload: {
          call_leg_id: 'leg_abc123',
          call_session_id: 'sess_abc123',
          from: '+15551234567',
          to: '+15559876543',
          state: 'parked',
          direction: 'incoming',
        },
      },
    };
    const result = TelnyxWebhookEventSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
