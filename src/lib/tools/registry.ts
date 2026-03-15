import { searchProviders } from './handlers/search';
import { callProvider, transferCall } from './handlers/dispatch';
import { sendSms } from './handlers/sms';

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export const TOOLS: ToolDefinition[] = [
  {
    name: 'search_providers',
    description:
      'Search for local service providers matching the caller\'s needs. Returns a ranked list of candidates with contact info and ratings.',
    input_schema: {
      type: 'object',
      properties: {
        service_type: {
          type: 'string',
          description: 'The type of service needed (e.g., "plumber", "electrician", "locksmith")',
        },
        location: {
          type: 'string',
          description: 'The caller\'s location or service area (e.g., "Austin, TX" or "78701")',
        },
        urgency: {
          type: 'string',
          description: 'Urgency level: "emergency", "normal", or "flexible" (default: "normal")',
        },
      },
      required: ['service_type', 'location'],
    },
  },
  {
    name: 'call_provider',
    description:
      'Call a service provider to check their availability and interest in taking the job. Returns whether the provider is available.',
    input_schema: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'The provider\'s phone number in E.164 format (e.g., "+15550001234")',
        },
        provider_name: {
          type: 'string',
          description: 'The provider\'s business name for context during the call',
        },
      },
      required: ['phone_number', 'provider_name'],
    },
  },
  {
    name: 'transfer_call',
    description:
      'Live-transfer the caller to an available provider via Telnyx conference bridge. The agent drops off after both parties are connected.',
    input_schema: {
      type: 'object',
      properties: {
        provider_phone: {
          type: 'string',
          description: 'The provider\'s phone number to transfer to in E.164 format',
        },
        caller_context: {
          type: 'string',
          description: 'Brief context to share with the provider before connecting the caller',
        },
      },
      required: ['provider_phone'],
    },
  },
  {
    name: 'send_sms',
    description:
      'Send an SMS message to the caller after a successful connection. Used for post-call recap with provider info and tip link.',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'The recipient\'s phone number in E.164 format',
        },
        message: {
          type: 'string',
          description: 'The SMS message body to send',
        },
      },
      required: ['to', 'message'],
    },
  },
];

export async function executeTool(
  name: string,
  params: Record<string, unknown>
): Promise<object> {
  console.log(`[tools:registry] Executing tool: ${name}`);

  switch (name) {
    case 'search_providers':
      return searchProviders(
        params as { service_type: string; location: string; urgency?: string }
      );

    case 'call_provider':
      return callProvider(
        params as { phone_number: string; provider_name: string }
      );

    case 'transfer_call':
      return transferCall(
        params as { provider_phone: string; caller_context?: string }
      );

    case 'send_sms':
      return sendSms(params as { to: string; message: string });

    default:
      throw new Error(`Unknown tool: "${name}". Available tools: ${TOOLS.map((t) => t.name).join(', ')}`);
  }
}
