import type { NextResponse } from 'next/server'

export const ACTIVE_TENANT_COOKIE = 'liquid-hr-tenant'
export const ACTIVE_HR_GROUP_COOKIE = 'liquid-hr-hr-group'
export const ACTIVE_ADMINISTRATION_COOKIE = 'liquid-hr-administration'

export function clearActiveContextCookies(response: NextResponse): void {
  const cookieOptions = {
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  }

  response.cookies.set(ACTIVE_TENANT_COOKIE, '', cookieOptions)
  response.cookies.set(ACTIVE_HR_GROUP_COOKIE, '', cookieOptions)
  response.cookies.set(ACTIVE_ADMINISTRATION_COOKIE, '', cookieOptions)
}
