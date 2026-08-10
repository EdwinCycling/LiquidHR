import { describe, expect, it } from 'vitest'
import { companyActivitySchema, companyActivityUpdateSchema } from './schemas'

describe('companyActivitySchema', () => {
  it('accepts a name and date in the selected year', () => {
    expect(companyActivitySchema.safeParse({ year: 2026, date: '2026-09-18', name: 'Bedrijfsfeest' }).success).toBe(true)
  })

  it('rejects an activity outside the selected year', () => {
    expect(companyActivitySchema.safeParse({ year: 2026, date: '2027-01-01', name: 'Nieuwjaarsbijeenkomst' }).success).toBe(false)
  })

  it('accepts an update with the selected year, name and date', () => {
    expect(companyActivityUpdateSchema.safeParse({ year: 2026, date: '2026-09-18', name: 'Gewijzigd bedrijfsfeest' }).success).toBe(true)
  })

  it('rejects an update date outside the selected year', () => {
    expect(companyActivityUpdateSchema.safeParse({ year: 2026, date: '2027-01-01', name: 'Nieuwjaarsbijeenkomst' }).success).toBe(false)
  })
})
