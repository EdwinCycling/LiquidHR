import { describe, expect, it } from 'vitest'
import { isProtectedApplicationPath } from '@/lib/auth/route-access'

describe('isProtectedApplicationPath', () => {
  it.each(['/departments', '/departments/abc', '/employees', '/settings'])('beveiligt %s', (path) => {
    expect(isProtectedApplicationPath(path)).toBe(true)
  })

  it.each(['/login', '/invite/accept', '/auth/callback', '/geen-toegang'])('laat %s publiek bereikbaar', (path) => {
    expect(isProtectedApplicationPath(path)).toBe(false)
  })
})
