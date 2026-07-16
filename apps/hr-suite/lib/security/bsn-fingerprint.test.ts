import { describe, expect, it } from 'vitest'
import { createBsnFingerprint, normalizeBsn } from './bsn-fingerprint'

describe('normalizeBsn', () => {
  it('normaliseert een geldig BSN en controleert de elfproef', () => {
    expect(normalizeBsn(' 1234 567 82 ')).toBe('123456782')
  })

  it('weigert ongeldige waarden', () => {
    expect(() => normalizeBsn('123456789')).toThrow('BSN_INVALID')
    expect(() => normalizeBsn('1234')).toThrow('BSN_INVALID')
    expect(() => normalizeBsn('abcdefghi')).toThrow('BSN_INVALID')
  })
})

describe('createBsnFingerprint', () => {
  it('maakt per tenant een andere niet-omkeerbare vingerafdruk', () => {
    const key = 'test-key-met-voldoende-lengte-voor-hmac'
    const one = createBsnFingerprint('tenant-a', '123456782', key)
    const two = createBsnFingerprint('tenant-b', '123456782', key)

    expect(one).toMatch(/^[0-9a-f]{64}$/)
    expect(two).toMatch(/^[0-9a-f]{64}$/)
    expect(one).not.toBe(two)
    expect(one).not.toContain('123456782')
  })
})
