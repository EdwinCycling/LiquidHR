import { describe, expect, it } from 'vitest'
import { isProtectedApplicationPath } from '@/lib/auth/route-access'

describe('isProtectedApplicationPath', () => {
  it.each(['/departments', '/departments/abc', '/employees', '/settings'])('beveiligt %s', (path) => {
    expect(isProtectedApplicationPath(path)).toBe(true)
  })

  it.each(['/login', '/invite/accept', '/auth/callback', '/geen-toegang', '/vacancies/11111111-1111-4111-8111-111111111111/test'])('laat %s publiek bereikbaar', (path) => {
    expect(isProtectedApplicationPath(path)).toBe(false)
  })
})
