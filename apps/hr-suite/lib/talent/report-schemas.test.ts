import { describe, expect, it } from 'vitest'
import { parseTalentReportQuery, talentReportQuerySchema } from './report-schemas'

describe('talentReportQuerySchema', () => {
  it('defaults to the manager report without exposing an employee selector', () => {
    expect(talentReportQuerySchema.parse({})).toMatchObject({ mode: 'manager', reportType: 'all', timeframe: 'all' })
  })

  it('rejects an unknown report field', () => {
    expect(() => talentReportQuerySchema.parse({ format: 'csv' })).toThrow()
  })

  it('accepts an inclusive historical period', () => {
    expect(talentReportQuerySchema.parse({ periodFrom: '2026-01-01', periodTo: '2026-12-31' }).periodFrom).toBe('2026-01-01')
    expect(() => talentReportQuerySchema.parse({ periodFrom: '2026-12-31', periodTo: '2026-01-01' })).toThrow()
  })

  it('accepts only the allowlisted report sections and time views', () => {
    expect(talentReportQuerySchema.parse({ reportType: 'capabilities', timeframe: 'history' })).toMatchObject({ reportType: 'capabilities', timeframe: 'history' })
    expect(() => talentReportQuerySchema.parse({ reportType: 'employees' })).toThrow()
    expect(() => talentReportQuerySchema.parse({ timeframe: 'future' })).toThrow()
  })

  it('forces the page-owned role when restoring URL state', () => {
    expect(parseTalentReportQuery('manager', { mode: 'admin', reportType: 'goals' })).toMatchObject({ mode: 'manager', reportType: 'goals' })
  })
})
