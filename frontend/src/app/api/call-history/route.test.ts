import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Supabase server client (hoisted-safe pattern)
// ---------------------------------------------------------------------------

const { mockFrom, mockSelect, mockEq, mockOrder } = vi.hoisted(() => {
  const mockOrder = vi.fn()
  const mockEq = vi.fn(() => ({ order: mockOrder }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ select: mockSelect }))
  return { mockFrom, mockSelect, mockEq, mockOrder }
})

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}))

// Import AFTER mocks are established
import { POST } from './route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown, ip = '10.0.0.1') {
  return new Request('http://localhost/api/call-history', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
  })
}

const SAMPLE_RECORD = {
  id: 'abc-123',
  user_id: 'user-1',
  caller_phone: '+15551234567',
  service_type: 'plumber',
  location: 'Toronto',
  urgency: null,
  providers_contacted: [
    { name: 'Ace Plumbing', phone: '+15550001111', status: 'answered' },
    { name: 'Bob Pipes', phone: '+15550002222', status: 'no_answer' },
  ],
  connected_provider: 'Ace Plumbing',
  status: 'completed',
  started_at: '2026-03-22T10:00:00Z',
  ended_at: '2026-03-22T10:15:00Z',
  created_at: '2026-03-22T10:00:00Z',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/call-history', () => {
  beforeEach(() => {
    mockOrder.mockResolvedValue({ data: [SAMPLE_RECORD], error: null })
  })

  it('returns 200 and records array for a valid phone number', async () => {
    const response = await POST(makeRequest({ phone: '5551234567' }))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.records).toHaveLength(1)
    expect(json.records[0].id).toBe('abc-123')
  })

  it('returns 400 for a phone shorter than 7 characters', async () => {
    const response = await POST(makeRequest({ phone: '555' }))
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('Invalid phone number')
  })

  it('returns 400 when no body is provided', async () => {
    const request = new Request('http://localhost/api/call-history', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.2' },
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('strips provider phone numbers from the response', async () => {
    const response = await POST(makeRequest({ phone: '5551234567' }))
    const json = await response.json()
    const firstProvider = json.records[0].providers_contacted[0]
    expect(firstProvider).not.toHaveProperty('phone')
    expect(firstProvider).toHaveProperty('name', 'Ace Plumbing')
    expect(firstProvider).toHaveProperty('status', 'answered')
  })

  it('returns 429 after exceeding 10 requests from the same IP', async () => {
    const ip = '192.168.1.99'
    // First 10 requests succeed
    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest({ phone: '5551234567' }, ip))
      expect(response.status).toBe(200)
    }
    // 11th request should be rate-limited
    const response = await POST(makeRequest({ phone: '5551234567' }, ip))
    expect(response.status).toBe(429)
    const json = await response.json()
    expect(json.error).toBe('Too many requests')
  })
})
