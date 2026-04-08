import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  // Only gate /admin routes — everything else passes through
  if (!request.nextUrl.pathname.startsWith('/admin')) {
    return response
  }

  // Create Supabase client that reads/writes cookies on the response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Not authenticated → redirect to login
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated but not admin → redirect to landing
  if (user.user_metadata?.role !== 'admin') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Admin user → pass through to proxy
  return response
}

export const config = {
  matcher: [
    // Run middleware on /admin routes only
    '/admin/:path*',
  ],
}
