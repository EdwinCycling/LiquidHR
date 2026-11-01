import { describe, expect, it } from 'vitest'
import { presentActualWorkText } from './presentation'

describe('actual work customer-facing text', () => {
  const fallback = '—'
  const internalLabel = 'Historical details are retained in the internal audit.'

  it.each([
    'PAYRUN01 TEST — 1 hour additional hours (synthetic scenario)',
    'PAYRUN01 synthetic TEST fixture correction',
    'Demo entry for acceptance',
  ])('replaces internal provenance markers without changing the stored source text: %s', (value) => {
    expect(presentActualWorkText(value, fallback, internalLabel)).toBe(internalLabel)
  })

  it('preserves ordinary notes and gives a fallback for empty values', () => {
    expect(presentActualWorkText('Approved Sunday work, four hours.', fallback, internalLabel)).toBe('Approved Sunday work, four hours.')
    expect(presentActualWorkText('  ', fallback, internalLabel)).toBe(fallback)
    expect(presentActualWorkText(null, fallback, internalLabel)).toBe(fallback)
  })
})
