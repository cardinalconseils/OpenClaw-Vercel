import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { normalizeToE164 } from '@/lib/phone-normalize'

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  phone: z.string().min(7).max(20),
})

// ---------------------------------------------------------------------------
// In-memory IP-based rate limiter
// 10 requests per IP per 60 seconds
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    // First request or window expired — start fresh
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false
  }

  entry.count++
  return true
}

// ---------------------------------------------------------------------------
// POST /api/call-history
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Extract IP address
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  // Rate limit check
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  // Normalize phone to E.164
  const e164 = normalizeToE164(parsed.data.phone)

  // Query Supabase
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('call_history')
    .select('*')
    .eq('caller_phone', e164)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[api/call-history] Supabase query error:', error.message)
    return NextResponse.json({ error: 'Could not load history' }, { status: 500 })
  }

  // Strip provider phone numbers before returning to client
  const strippedData = (data ?? []).map((record) => ({
    ...record,
    providers_contacted: (
      record.providers_contacted as Array<{ name: string; phone?: string; status?: string; outcome?: string }>
    ).map((p) => ({
      name: p.name,
      status: p.status ?? p.outcome,
    })),
  }))

  return NextResponse.json({ records: strippedData })
}
