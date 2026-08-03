import { describe, expect, it } from 'vitest'
import { talentReportQuerySchema } from './report-schemas'

describe('talentReportQuerySchema', () => {
  it('defaults to the manager report without exposing an employee selector', () => {
    expect(talentReportQuerySchema.parse({}).mode).toBe('manager')
  })

  it('rejects an unknown report field', () => {
    expect(() => talentReportQuerySchema.parse({ format: 'csv' })).toThrow()
  })

  it('accepts an inclusive historical period', () => {
    expect(talentReportQuerySchema.parse({ periodFrom: '2026-01-01', periodTo: '2026-12-31' }).periodFrom).toBe('2026-01-01')
    expect(() => talentReportQuerySchema.parse({ periodFrom: '2026-12-31', periodTo: '2026-01-01' })).toThrow()
  })
})
