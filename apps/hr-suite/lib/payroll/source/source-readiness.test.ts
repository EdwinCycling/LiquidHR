import { describe, expect, it } from 'vitest'
import { assessEffectiveSourceCoverage, canReviewPayrollSourceReadiness, caoSalaryScheduleConflict } from './source-readiness'

describe('Payroll source readiness', () => {
  const periodStart = '2026-11-01'
  const periodEndExclusive = '2026-12-01'

  it('requires complete, non-overlapping, versioned source coverage for the full period', () => {
    expect(assessEffectiveSourceCoverage([
      { id: 'row-1', version: 'v1', validFrom: '2026-09-01', validUntilExclusive: null },
    ], periodStart, periodEndExclusive).status).toBe('READY')
    expect(assessEffectiveSourceCoverage([
      { id: 'row-1', version: 'v1', validFrom: '2026-11-15', validUntilExclusive: null },
    ], periodStart, periodEndExclusive).status).toBe('MISSING')
    expect(assessEffectiveSourceCoverage([
      { id: 'row-1', version: 'v1', validFrom: '2026-10-01', validUntilExclusive: '2026-11-20' },
      { id: 'row-2', version: 'v2', validFrom: '2026-11-10', validUntilExclusive: null },
    ], periodStart, periodEndExclusive).status).toBe('CONFLICT')
    expect(assessEffectiveSourceCoverage([
      { id: 'row-1', version: 'v1', validFrom: '2026-10-01', validUntilExclusive: null },
      { id: 'row-2', version: 'v2', validFrom: '2026-11-15', validUntilExclusive: null },
    ], periodStart, periodEndExclusive).status).toBe('CONFLICT')
    expect(assessEffectiveSourceCoverage([
      { id: 'row-1', version: '', validFrom: '2026-09-01', validUntilExclusive: null },
    ], periodStart, periodEndExclusive).status).toBe('UNVERIFIED')
  })

  it('allows only HR Admin roles with salary read permission to review readiness', () => {
    expect(canReviewPayrollSourceReadiness({ activeRoles: ['HR_ADMIN'], permissions: ['salary:read'] })).toBe(true)
    expect(canReviewPayrollSourceReadiness({ activeRoles: ['TENANT_ADMIN'], permissions: ['salary:read'] })).toBe(true)
    expect(canReviewPayrollSourceReadiness({ activeRoles: ['EMPLOYEE'], permissions: ['salary:read'] })).toBe(false)
    expect(canReviewPayrollSourceReadiness({ activeRoles: ['HR_MANAGER'], permissions: ['salary:read'] })).toBe(false)
    expect(canReviewPayrollSourceReadiness({ activeRoles: ['HR_ADMIN'], permissions: [] })).toBe(false)
  })

  it('flags a stored CAO monthly amount inconsistent with its stored roster factor', () => {
    expect(caoSalaryScheduleConflict({
      salaryBasis: 'CAO_SCALE', paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY',
      fulltimeAmount: 2819, parttimeAmount: 1879.33, partTimeFactor: 32 / 36,
      averageHoursPerWeek: 24, fulltimeHoursPerWeek: 36,
    })).toBe(true)
    expect(caoSalaryScheduleConflict({
      salaryBasis: 'CAO_SCALE', paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY',
      fulltimeAmount: 2819, parttimeAmount: 2505.78, partTimeFactor: 32 / 36,
      averageHoursPerWeek: 32, fulltimeHoursPerWeek: 36,
    })).toBe(false)
    expect(caoSalaryScheduleConflict({
      salaryBasis: 'CAO_SCALE', paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY',
      fulltimeAmount: '2542.50', parttimeAmount: '1605.79', partTimeFactor: '0.6316',
      averageHoursPerWeek: '24', fulltimeHoursPerWeek: '38',
    })).toBe(false)
    expect(caoSalaryScheduleConflict({
      salaryBasis: 'CAO_SCALE', paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY',
      fulltimeAmount: '2542.50', parttimeAmount: '1605.93', partTimeFactor: '0.6316',
      averageHoursPerWeek: '24', fulltimeHoursPerWeek: '38',
    })).toBe(true)
    expect(caoSalaryScheduleConflict({
      salaryBasis: 'CAO_SCALE', paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY',
      fulltimeAmount: '2542.50', parttimeAmount: '1605.79', partTimeFactor: '0.6315',
      averageHoursPerWeek: '24', fulltimeHoursPerWeek: '38',
    })).toBe(true)
    expect(caoSalaryScheduleConflict({
      salaryBasis: 'CAO_SCALE', paymentType: 'PERIODIC_FIXED', paymentFrequency: 'MONTHLY',
      fulltimeAmount: '2542.50', parttimeAmount: '1605.79', partTimeFactor: '0',
      averageHoursPerWeek: '0', fulltimeHoursPerWeek: '38',
    })).toBe(true)
  })
})
