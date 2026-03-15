import { z } from 'zod';

/**
 * Zod schema for the Telnyx Call Control webhook event payload.
 * Represents the inner payload object within the event envelope.
 */
const TelnyxCallControlPayloadSchema = z.object({
  call_control_id: z.string(),
  call_leg_id: z.string(),
  call_session_id: z.string(),
  from: z.string(),
  to: z.string(),
  state: z.string(),
  direction: z.string(),
});

/**
 * Zod schema for the outer Telnyx webhook event envelope.
 * All Telnyx Call Control v2 events share this shape.
 */
export const TelnyxWebhookEventSchema = z.object({
  data: z.object({
    event_type: z.string(),
    id: z.string(),
    payload: TelnyxCallControlPayloadSchema,
  }),
});

/** Inferred TypeScript type from the webhook event schema. */
export type TelnyxWebhookEvent = z.infer<typeof TelnyxWebhookEventSchema>;

/**
 * Union of event_type strings this project handles.
 * Used for discriminating inbound Call Control v2 events.
 */
export type TelnyxCallControlEvent =
  | 'call.initiated'
  | 'call.answered'
  | 'call.hangup'
  | 'call.speak.ended'
  | 'call.gather.ended';
