import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock @supabase/ssr
const mockGetUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}))

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`)
}

const { middleware } = await import('../middleware')

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes through public routes without calling Supabase', async () => {
    const res = await middleware(makeRequest('/'))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('passes through /login without calling Supabase', async () => {
    const res = await middleware(makeRequest('/login'))
    expect(res.status).toBe(200)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('redirects unauthenticated /admin requests to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(makeRequest('/admin'))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })

  it('redirects non-admin /admin requests to /', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: '1', user_metadata: {} } },
    })
    const res = await middleware(makeRequest('/admin'))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/')
  })

  it('allows admin users to access /admin', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: '1', user_metadata: { role: 'admin' } } },
    })
    const res = await middleware(makeRequest('/admin'))
    expect(res.status).toBe(200)
  })
})
