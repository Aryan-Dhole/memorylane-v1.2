import { updateSession } from '@/lib/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Allow trial space paths without session guards
  const isTrialRoute = req.nextUrl.pathname.startsWith('/create/trial')

  if (isTrialRoute) {
    return NextResponse.next()
  }

  // Refresh the Supabase session using the modern getClaims() pattern
  const res = await updateSession(req)

  const protectedRoutes = ['/create', '/checkout', '/orders', '/dashboard']
  const isProtected = protectedRoutes.some(r => req.nextUrl.pathname.startsWith(r))

  if (isProtected && !isTrialRoute) {
    // Check if user is authenticated by looking at the response cookies
    // The updateSession helper already handles the redirect for unauthenticated users
    // on fully protected paths, but we add the trial route exception here
    const { createServerClient } = await import('@supabase/ssr')
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('next', req.nextUrl.pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return res
}

export const config = {
  matcher: ['/create/:path*', '/checkout/:path*', '/orders/:path*', '/dashboard/:path*']
}
