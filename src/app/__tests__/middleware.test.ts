import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock @supabase/ssr
const mockGetUser = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}))

function buildRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${pathname}`))
}

const { middleware } = await import('../../../middleware')

describe('Middleware — /admin RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes through non-admin routes without auth check', async () => {
    for (const path of ['/', '/login', '/signup', '/privacy', '/terms']) {
      const res = await middleware(buildRequest(path))
      expect(res.status).toBe(200)
      expect(res.headers.get('location')).toBeNull()
    }
    // Supabase should never be called for non-admin routes
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  it('redirects unauthenticated users from /admin to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(buildRequest('/admin'))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })

  it('redirects non-admin users from /admin to /', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: '1', user_metadata: { role: 'user' } } },
    })
    const res = await middleware(buildRequest('/admin'))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/')
  })

  it('allows admin users through to /admin', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: '1', user_metadata: { role: 'admin' } } },
    })
    const res = await middleware(buildRequest('/admin'))
    expect(res.status).toBe(200)
  })

  it('protects /admin subpaths', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await middleware(buildRequest('/admin/settings'))
    expect(res.status).toBe(307)
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })
})
