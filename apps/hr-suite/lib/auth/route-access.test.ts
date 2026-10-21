import { describe, expect, it } from 'vitest'
import { isProtectedApplicationPath } from '@/lib/auth/route-access'

describe('isProtectedApplicationPath', () => {
  it('opens only the exact locally guarded sign-in page and keeps other local tools protected', () => {
    expect(isProtectedApplicationPath('/local/sign-in')).toBe(false)
    expect(isProtectedApplicationPath('/local/sign-in/other')).toBe(true)
    expect(isProtectedApplicationPath('/local/personas')).toBe(true)
    expect(isProtectedApplicationPath('/local/fiscal-initialization')).toBe(true)
  })
  it.each(['/departments', '/departments/abc', '/employees', '/settings', '/brand/logos/logo.png', '/manifest.webmanifest.backup'])('beveiligt %s', (path) => {
    expect(isProtectedApplicationPath(path)).toBe(true)
  })

  it.each(['/login', '/invite/accept', '/auth/callback', '/geen-toegang', '/vacancies/11111111-1111-4111-8111-111111111111/test', '/privacy', '/terms', '/icon.svg', '/brand/logo/branding/transparent/logo-horizontal-transparent.png', '/manifest.webmanifest'])('laat %s publiek bereikbaar', (path) => {
    expect(isProtectedApplicationPath(path)).toBe(false)
  })
})
