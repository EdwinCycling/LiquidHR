import { describe, expect, it } from 'vitest'
import { companyActivitySchema } from './schemas'

describe('companyActivitySchema', () => {
  it('accepts a name and date in the selected year', () => {
    expect(companyActivitySchema.safeParse({ year: 2026, date: '2026-09-18', name: 'Bedrijfsfeest' }).success).toBe(true)
  })

  it('rejects an activity outside the selected year', () => {
    expect(companyActivitySchema.safeParse({ year: 2026, date: '2027-01-01', name: 'Nieuwjaarsbijeenkomst' }).success).toBe(false)
  })
})
