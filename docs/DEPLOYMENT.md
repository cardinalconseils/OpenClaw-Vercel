# Deployment Guide

Deploying OpenClaw — Service Matchmaker to Vercel Sandbox.

## Prerequisites

1. All environment variables configured
2. Supabase project created
3. Telnyx account with phone number and Call Control v2 app
4. Google Maps/Places API key
5. LLM provider API keys (Gemini, Anthropic)

## Vercel Sandbox Deployment

### 1. Configure Environment

Set environment variables in Vercel Dashboard or via CLI:

```bash
# Telnyx
TELNYX_API_KEY=KEY_...
TELNYX_API_SECRET=...
TELNYX_PUBLIC_KEY=...
TELNYX_APP_ID=...
TELNYX_PHONE_NUMBER=+1...

# Google
GOOGLE_MAPS_API_KEY=...
GOOGLE_PLACES_API_KEY=...

# LLM
GOOGLE_GENERATIVE_AI_API_KEY=...
ANTHROPIC_API_KEY=...

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# BuyMeACoffee
BUYMEACOFFEE_USERNAME=...

# Observability
LANGCHAIN_API_KEY=...
LANGCHAIN_PROJECT=openclaw-prod
LANGCHAIN_TRACING_V2=true

# Server
PORT=18789
NODE_ENV=production
```

### 2. Deploy

```bash
vercel --prod
```

### 3. Configure Telnyx

In the Telnyx Mission Control Portal:

1. Create a Call Control Application
2. Set webhook URL: `https://your-domain.vercel.app/api/voice/inbound`
3. Assign your phone number to the application
4. Enable: Call Control v2, Gather, Speak
5. Set status callback: `https://your-domain.vercel.app/api/voice/status`

### 4. OpenClaw Gateway

The OpenClaw gateway runs inside the Vercel Sandbox MicroVM:

- Listens on: `ws://127.0.0.1:18789`
- Requires device pairing before use
- Provides agent orchestration framework

## Vercel Sandbox Details

| Property | Value |
|----------|-------|
| Runtime | Isolated Linux MicroVM |
| Port | 18789 (HTTPS) |
| Memory | 2GB+ recommended |
| Snapshots | Supported |
| Persistence | Via Supabase (not local filesystem) |

## Post-Deployment Checklist

### Immediate
- [ ] Test inbound call works end-to-end
- [ ] Verify STT transcription accuracy
- [ ] Confirm TTS playback quality
- [ ] Test provider search (Google Maps/Places)
- [ ] Test outbound provider call
- [ ] Test live transfer
- [ ] Validate SMS recap delivery
- [ ] Check BuyMeACoffee link in SMS
- [ ] Review LangSmith traces

### Within 24 Hours
- [ ] Set up monitoring alerts
- [ ] Test error scenarios (no providers, call drops)
- [ ] Verify rate limiting
- [ ] Check database writes (call logs, service requests)

## Monitoring

### Health Endpoint

```
GET /api/health

{
  "status": "healthy",
  "services": {
    "telnyx": { "healthy": true },
    "supabase": { "healthy": true, "latencyMs": 5 },
    "googleMaps": { "healthy": true },
    "llm": { "healthy": true }
  }
}
```

### Key Metrics

| Metric | Warning | Critical |
|--------|---------|----------|
| Voice latency | > 1.5s | > 3s |
| Error rate | > 1% | > 5% |
| Call success rate | < 95% | < 90% |
| Provider match rate | < 80% | < 60% |

## Cost Estimates

| Service | Estimated Cost |
|---------|---------------|
| Telnyx Voice | ~$0.01/min |
| Telnyx SMS | ~$0.004/msg |
| Google Places API | ~$0.017/search |
| Gemini API | ~$0.01/call |
| Supabase | Free tier / ~$25/mo |
| **Total per call** | **~$0.05-0.10** |
