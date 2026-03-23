import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/headers cookies
const mockCookieStore = {
  getAll: vi.fn(() => []),
  set: vi.fn(),
}
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}))

// Mock @supabase/ssr
const mockExchangeCodeForSession = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}))

describe('Auth callback route — open redirect prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /admin when next=/admin and code exchange succeeds', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    const { GET } = await import('../callback/route')

    const request = new Request('http://localhost/auth/callback?code=valid&next=/admin')
    const res = await GET(request)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/admin')
  })

  it('defaults to / when no next param provided', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    const { GET } = await import('../callback/route')

    const request = new Request('http://localhost/auth/callback?code=valid')
    const res = await GET(request)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })

  it('blocks protocol-relative redirect //evil.com', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    const { GET } = await import('../callback/route')

    const request = new Request('http://localhost/auth/callback?code=valid&next=//evil.com')
    const res = await GET(request)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })

  it('blocks backslash variant \\/evil.com', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    const { GET } = await import('../callback/route')

    const request = new Request('http://localhost/auth/callback?code=valid&next=\\/evil.com')
    const res = await GET(request)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })

  it('blocks absolute URL https://evil.com', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    const { GET } = await import('../callback/route')

    const request = new Request('http://localhost/auth/callback?code=valid&next=https://evil.com')
    const res = await GET(request)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })

  it('redirects to /login?error=auth_callback_failed when no code param', async () => {
    const { GET } = await import('../callback/route')

    const request = new Request('http://localhost/auth/callback')
    const res = await GET(request)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login?error=auth_callback_failed')
  })

  it('redirects to /login?error=auth_callback_failed when code exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: { message: 'Invalid code', status: 400 },
    })
    const { GET } = await import('../callback/route')

    const request = new Request('http://localhost/auth/callback?code=expired')
    const res = await GET(request)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login?error=auth_callback_failed')
  })

  it('handles unexpected errors gracefully', async () => {
    mockExchangeCodeForSession.mockRejectedValue(new Error('Network timeout'))
    const { GET } = await import('../callback/route')

    const request = new Request('http://localhost/auth/callback?code=valid')
    const res = await GET(request)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login?error=auth_callback_failed')
  })
})
