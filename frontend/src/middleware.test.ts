import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ---- Mock @supabase/ssr ----
const mockGetUser = vi.fn()
const mockCreateServerClient = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: (url: string, key: string, options: { cookies: unknown }) => {
    mockCreateServerClient(url, key, options)
    return {
      auth: {
        getUser: mockGetUser,
      },
    }
  },
}))

// ---- Helpers ----
function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`)
}

// ---- Import middleware AFTER mocks are set up ----
const { middleware } = await import('../middleware')

describe('Auth Middleware (WEB-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows unauthenticated user to access /dashboard (routes removed)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const req = makeRequest('/dashboard')
    const res = await middleware(req)
    expect(res?.status).toBe(200)
  })

  it('redirects authenticated user from /login to / (home)', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    })
    const req = makeRequest('/login')
    const res = await middleware(req)
    expect(res?.status).toBe(307)
    const location = res?.headers.get('location') ?? ''
    expect(location).toMatch(/\/$/)
    expect(location).not.toContain('/dashboard')
  })

  it('allows unauthenticated user to access /', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const req = makeRequest('/')
    const res = await middleware(req)
    // Should not redirect — NextResponse.next() has status 200
    expect(res?.status).toBe(200)
    const location = res?.headers.get('location')
    expect(location).toBeNull()
  })

  it('allows unauthenticated user to access /login', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const req = makeRequest('/login')
    const res = await middleware(req)
    expect(res?.status).toBe(200)
    const location = res?.headers.get('location')
    expect(location).toBeNull()
  })

  it('uses getUser() not getSession() for auth check', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const req = makeRequest('/')
    await middleware(req)
    // getUser must have been called
    expect(mockGetUser).toHaveBeenCalledTimes(1)
    // createServerClient is called (not a getSession path)
    expect(mockCreateServerClient).toHaveBeenCalledTimes(1)
  })
})
