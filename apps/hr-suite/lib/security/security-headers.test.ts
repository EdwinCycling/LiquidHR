import { describe, expect, it } from 'vitest'
import { securityHeaders } from './security-headers'

describe('securityHeaders', () => {
  it('contains the baseline browser hardening headers', () => {
    const headers = new Map(securityHeaders.map(({ key, value }) => [key, value]))

    expect(headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()')
  })
})
