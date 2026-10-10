import { describe, expect, it } from 'vitest'
import { comparePayrollAmount, parseExternalAmountCents } from './payroll-comparison-form'

describe('manual payroll comparison', () => {
  it('classifies exact, one-cent and larger differences without changing the persisted input', () => {
    const canonical = Object.freeze({ gross: 3219.41 })
    expect(comparePayrollAmount(canonical.gross, '3219.41')).toEqual({ externalCents: 321941, differenceCents: 0, status: 'exact' })
    expect(comparePayrollAmount(canonical.gross, '3219,42')).toEqual({ externalCents: 321942, differenceCents: 1, status: 'one-cent' })
    expect(comparePayrollAmount(canonical.gross, '3220.00')).toEqual({ externalCents: 322000, differenceCents: 59, status: 'difference' })
    expect(canonical.gross).toBe(3219.41)
  })

  it('leaves blank, malformed, negative and missing canonical values un-compared', () => {
    expect(parseExternalAmountCents('')).toBeNull()
    expect(parseExternalAmountCents('-10.00')).toBeNull()
    expect(parseExternalAmountCents('1,234.50')).toBeNull()
    expect(comparePayrollAmount(null, '0.00')).toBeNull()
  })
})
