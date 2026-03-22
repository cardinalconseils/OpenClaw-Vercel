import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock @supabase/ssr before importing middleware
const mockGetUser = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

// Helper to build NextRequest with a given pathname
function buildRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`http://localhost${pathname}`))
}

describe('Middleware — Admin RBAC and auth redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Test 1: /admin with no session redirects to /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { middleware } = await import('../../../middleware')

    const req = buildRequest('/admin')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('Test 2: /admin with authenticated non-admin user redirects to /', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'user-1', user_metadata: {} },
      },
    })
    const { middleware } = await import('../../../middleware')

    const req = buildRequest('/admin')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toMatch(/\/$/)
    expect(res.headers.get('location')).not.toContain('/login')
  })

  it('Test 3: /admin with admin role passes through (NextResponse.next)', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'user-2', app_metadata: { role: 'admin' } },
      },
    })
    const { middleware } = await import('../../../middleware')

    const req = buildRequest('/admin')
    const res = await middleware(req)

    // NextResponse.next() returns 200, not a redirect
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('Test 4: /admin/some/path with admin user passes through (catch-all)', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'user-3', app_metadata: { role: 'admin' } },
      },
    })
    const { middleware } = await import('../../../middleware')

    const req = buildRequest('/admin/some/path')
    const res = await middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('Test 5: /login with authenticated user redirects to / (not /dashboard)', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: 'user-4', user_metadata: {} },
      },
    })
    const { middleware } = await import('../../../middleware')

    const req = buildRequest('/login')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    const location = res.headers.get('location') ?? ''
    expect(location).toMatch(/\/$/)
    expect(location).not.toContain('/dashboard')
  })

  it('Test 6: Supabase failure on /admin redirects to /login (fail closed)', async () => {
    mockGetUser.mockRejectedValue(new Error('Supabase unavailable'))
    const { middleware } = await import('../../../middleware')

    const req = buildRequest('/admin')
    const res = await middleware(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('Test 7: Supabase failure on public route passes through (fail open)', async () => {
    mockGetUser.mockRejectedValue(new Error('Supabase unavailable'))
    const { middleware } = await import('../../../middleware')

    const req = buildRequest('/')
    const res = await middleware(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })
})
