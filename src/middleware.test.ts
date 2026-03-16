import { describe, it } from 'vitest'

describe('Auth Middleware (WEB-02)', () => {
  it.todo('redirects unauthenticated user from /dashboard to /login')
  it.todo('redirects unauthenticated user from /missions to /login')
  it.todo('redirects unauthenticated user from /settings to /login')
  it.todo('redirects authenticated user from /login to /dashboard')
  it.todo('allows unauthenticated user to access /')
  it.todo('allows unauthenticated user to access /login')
  it.todo('uses getUser() not getSession() for auth check')
})
