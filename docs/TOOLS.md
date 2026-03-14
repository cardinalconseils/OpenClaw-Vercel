# Tool Registry Documentation

Google ADK-style typed tool system for OpenClaw's LLM function calling.

## Available Tools

### Provider Tools

#### `provider.search`

Search for local service providers via Google Maps/Places API.

```typescript
// Input
{
  serviceType: string,       // "plumber", "electrician", "locksmith", etc.
  location: string,          // "downtown Austin, TX"
  latitude?: number,
  longitude?: number,
  radiusMiles?: number,      // default: 25
  minRating?: number,        // 0-5
  limit?: number,            // default: 5
}

// Output
[{
  name: string,
  phone: string,
  rating: number,
  reviewCount: number,
  address: string,
  distanceMiles: number,
  placeId: string,
  openNow?: boolean,
}]
```

#### `provider.call`

Initiate an outbound call to a provider via Telnyx.

```typescript
// Input
{
  phone: string,             // E.164 format
  providerName: string,
  serviceType: string,
  callerCallControlId: string,
}

// Output
{
  answered: boolean,
  callControlId?: string,
  duration?: number,
}
```

### Location Tools

#### `location.geocode`

Convert address to coordinates using Google Geocoding API.

```typescript
// Input
{
  address: string,
}

// Output
{
  latitude: number,
  longitude: number,
  formattedAddress: string,
  confidence: number,
}
```

#### `location.validate`

Validate and normalize an address.

```typescript
// Input
{
  address: string,
}

// Output
{
  valid: boolean,
  normalizedAddress?: string,
  missingComponents?: string[],
}
```

### Call Tools

#### `call.transfer`

Transfer the caller to a provider (live transfer).

```typescript
// Input
{
  callerCallControlId: string,
  providerCallControlId: string,
  method: 'bridge' | 'transfer' | 'conference',
}

// Output
{
  success: boolean,
  conferenceId?: string,
}
```

#### `call.speak`

Speak text to the caller via TTS.

```typescript
// Input
{
  callControlId: string,
  text: string,
  voice?: string,
}

// Output
{
  success: boolean,
}
```

### SMS Tools

#### `sms.send`

Send an SMS message via Telnyx.

```typescript
// Input
{
  to: string,           // E.164 format
  body: string,         // 1-1600 characters
}

// Output
{
  success: boolean,
  messageId?: string,
}
```

#### `sms.recap`

Send a call recap SMS with provider details and tip link.

```typescript
// Input
{
  to: string,
  serviceType: string,
  providersContacted: Array<{ name: string, outcome: string }>,
  connectedProvider?: { name: string, phone: string },
  tipLink: string,
}

// Output
{
  success: boolean,
  messageId?: string,
}
```

## Creating Custom Tools

### 1. Define Schema

```typescript
import { z } from 'zod';

const myToolSchema = z.object({
  requiredField: z.string().min(1),
  optionalField: z.number().optional(),
});
```

### 2. Implement Handler

```typescript
async function myToolHandler(params: z.infer<typeof myToolSchema>) {
  const result = await someOperation(params);
  return { success: true, data: result };
}
```

### 3. Register Tool

```typescript
import { registerTool } from '../registry';

registerTool({
  name: 'my.tool',
  description: 'What this tool does and when to use it.',
  parameters: myToolSchema,
  handler: myToolHandler,
  rateLimit: { maxCalls: 10, windowMs: 60000 },
});
```

## Rate Limits

| Tool | Max Calls | Window |
|------|-----------|--------|
| provider.search | 10 | 1 min |
| provider.call | 5 | 1 min |
| call.transfer | 3 | 1 min |
| sms.send | 20 | 1 min |
| location.geocode | 30 | 1 min |
