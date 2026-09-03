import { describe, expect, it } from 'vitest'
import { getTrustedClientIdentity } from './trusted-client-identity'

const production = { vercel: '1', vercelEnvironment: 'production' }

function request(headers: Record<string, string>): Request {
  return new Request('https://example.test/api/public/recruitment', { headers })
}

function directHeaders(identity: string): Record<string, string> {
  return {
    'x-forwarded-for': identity,
    'x-vercel-id': 'fra1::deployment::request',
    'x-vercel-deployment-url': 'liquidhr-preview.vercel.app',
  }
}

function withoutHeader(headers: Record<string, string>, name: string): Record<string, string> {
  const copy = { ...headers }
  delete copy[name]
  return copy
}

describe('trusted public client identity', () => {
  it('accepts a single documented x-forwarded-for IPv4 identity with provenance', () => {
    expect(getTrustedClientIdentity(request({
      ...directHeaders('203.0.113.42'),
      forwarded: 'for=198.51.100.7',
      'x-real-ip': '198.51.100.7',
    }), {}, production)).toEqual({
      ok: true,
      kind: 'TRUSTED_VERCEL_CLIENT',
      identity: '203.0.113.42',
    })
  })

  it('normalizes bracketed IPv6 and requires exact cross-checks', () => {
    expect(getTrustedClientIdentity(request({
      ...directHeaders('[2001:DB8::42]'),
      'x-forwarded-for': '2001:db8::42',
      'x-real-ip': '2001:DB8::42',
    }), {}, production)).toMatchObject({ ok: true, identity: '2001:db8::42' })
  })

  it.each([
    ['missing Vercel provenance', { 'x-forwarded-for': '203.0.113.42' }],
    ['missing trusted client identity', withoutHeader(directHeaders('203.0.113.42'), 'x-forwarded-for')],
    ['legacy Vercel identity fallback', { ...withoutHeader(directHeaders('203.0.113.42'), 'x-forwarded-for'), 'x-vercel-forwarded-for': '203.0.113.42' }],
    ['proxy chain', { ...directHeaders('203.0.113.42'), 'x-forwarded-for': '203.0.113.42, 198.51.100.7' }],
    ['whitespace list', { ...directHeaders('203.0.113.42'), 'x-forwarded-for': '203.0.113.42 198.51.100.7' }],
    ['invalid address', { ...directHeaders('not-an-ip') }],
    ['unsupported proxy header', { ...directHeaders('203.0.113.42'), 'cf-connecting-ip': '203.0.113.42' }],
    ['unsupported proxy header', { ...directHeaders('203.0.113.42'), 'true-client-ip': '203.0.113.42' }],
    ['unsupported proxy header', { ...directHeaders('203.0.113.42'), 'x-client-ip': '203.0.113.42' }],
  ])('fails closed for %s', (_label, headers) => {
    expect(getTrustedClientIdentity(request(headers), {}, production)).toMatchObject({ ok: false, kind: 'UNAVAILABLE' })
  })

  it('ignores forwarded and x-real-ip without allowing either to replace x-forwarded-for', () => {
    expect(getTrustedClientIdentity(request({
      ...directHeaders('203.0.113.42'),
      forwarded: 'not-a-trusted-client-identity',
      'x-vercel-forwarded-for': '198.51.100.7',
      'x-real-ip': '198.51.100.7',
    }), {}, production)).toEqual({
      ok: true,
      kind: 'TRUSTED_VERCEL_CLIENT',
      identity: '203.0.113.42',
    })

    expect(getTrustedClientIdentity(request({
      ...withoutHeader(directHeaders('203.0.113.42'), 'x-forwarded-for'),
      forwarded: 'for=203.0.113.42',
      'x-real-ip': '203.0.113.42',
    }), {}, production)).toMatchObject({ ok: false, kind: 'UNAVAILABLE', reason: 'MISSING_CLIENT_IDENTITY' })
  })

  it('fails closed outside the explicitly supported Vercel runtime', () => {
    expect(getTrustedClientIdentity(request(directHeaders('203.0.113.42')), {}, { vercel: '0', vercelEnvironment: 'development' })).toEqual({ ok: false, kind: 'UNAVAILABLE', reason: 'UNSUPPORTED_RUNTIME' })
  })

  it('keeps the test identity seam guarded to test runtime', () => {
    expect(getTrustedClientIdentity(request({}), { testIdentity: '203.0.113.42' }, { vercel: '0', vercelEnvironment: 'development' })).toMatchObject({ ok: true, identity: '203.0.113.42' })
  })
})
