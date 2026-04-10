import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'

const TEXML_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="+18888306873">
    <Number>+18885440160</Number>
  </Dial>
</Response>`

/**
 * Verify the Telnyx webhook signature.
 * Telnyx signs requests with HMAC-SHA256 using the webhook API key.
 * Header: telnyx-signature-ed25519 contains "t=<timestamp>,v1=<signature>"
 */
function verifyTelnyxSignature(request: NextRequest): boolean {
  const publicKey = process.env.TELNYX_PUBLIC_KEY
  if (!publicKey) return false

  const signatureHeader = request.headers.get('telnyx-signature-ed25519')
  const timestamp = request.headers.get('telnyx-timestamp')
  if (!signatureHeader || !timestamp) return false

  // Reject requests older than 5 minutes to prevent replay attacks
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

  try {
    const [, v1] = signatureHeader.split(',').map(p => p.split('=')[1])
    if (!v1) return false

    const payload = `${timestamp}|`
    const expected = createHmac('sha256', publicKey)
      .update(payload)
      .digest('hex')

    return timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

/**
 * TeXML call forwarding endpoint for +18888306873 (Canadian toll-free).
 *
 * The Telnyx TeXML application calls this URL when a call arrives on
 * +18888306873. Returns TeXML that dials ClawdTalk (+18885440160) so
 * the caller reaches Murphy.
 */
export async function GET(request: NextRequest) {
  if (!verifyTelnyxSignature(request)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return new NextResponse(TEXML_RESPONSE, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
