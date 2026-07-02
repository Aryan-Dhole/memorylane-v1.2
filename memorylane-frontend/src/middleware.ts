import { updateSession } from '@/lib/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Allow trial space paths without session guards
  const isTrialRoute = req.nextUrl.pathname.startsWith('/create/trial')

  if (isTrialRoute) {
    return NextResponse.next()
  }

  // Refresh the Supabase session and redirect unauthenticated users
  return await updateSession(req)
}

export const config = {
  matcher: ['/create/:path*', '/checkout/:path*', '/orders/:path*', '/dashboard/:path*']
}
