import { describe, expect, it } from 'vitest'
import nextConfig from '../../next.config'
import { frameOptionsForPath, securityHeaders } from './security-headers'

describe('securityHeaders', () => {
  it('contains the baseline browser hardening headers', () => {
    const headers = new Map(securityHeaders.map(({ key, value }) => [key, value]))

    expect(headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('X-Frame-Options')).toBe('DENY')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(headers.get('Permissions-Policy')).toBe('camera=(), microphone=(self), geolocation=()')
  })
})

describe('document preview framing', () => {
  it('keeps DENY on all routes except the same-origin document preview', async () => {
    const rules = await nextConfig.headers?.()
    if (!rules) throw new Error('Expected Next.js security header rules.')

    const globalRule = rules.find((rule) => rule.source === '/(.*)')
    if (!globalRule) throw new Error('Expected global security header rule.')

    expect(globalRule.headers).toEqual(securityHeaders.filter(({ key }) => key !== 'X-Frame-Options'))
    expect(frameOptionsForPath('/employees/11111111-1111-4111-8111-111111111111')).toBe('DENY')
    expect(frameOptionsForPath('/api/employees/11111111-1111-4111-8111-111111111111/documents/22222222-2222-4222-8222-222222222222/preview')).toBe('SAMEORIGIN')
    expect(frameOptionsForPath('/api/employees/11111111-1111-4111-8111-111111111111/documents/22222222-2222-4222-8222-222222222222/download')).toBe('DENY')
  })
})
