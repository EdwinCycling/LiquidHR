import { describe, expect, it } from 'vitest'
import { isPayrollReleaseEligible } from '@/components/actual-work/actual-work-payroll-workspace'

type ReleaseRow = Parameters<typeof isPayrollReleaseEligible>[0]

function releaseRow(overrides: Partial<ReleaseRow> = {}): ReleaseRow {
  return {
    status: 'APPROVED',
    payrollApproval: {} as NonNullable<ReleaseRow['payrollApproval']>,
    needsPayrollApproval: false,
    needsPayrollReview: true,
    payrollPeriodBoundaryValid: true,
    release: null,
    tvtConfigured: false,
    effectiveMappings: [{ processing_target: 'PAYMENT' } as ReleaseRow['effectiveMappings'][number]],
    workType: { family: 'WORK' } as NonNullable<ReleaseRow['workType']>,
    ...overrides,
  }
}

describe('Payroll release eligibility', () => {
  it('allows an approved correction revision to be released after an earlier release', () => {
    expect(isPayrollReleaseEligible(releaseRow({ needsPayrollReview: true }))).toBe(true)
  })

  it('requires the current HR Admin approval and exactly one payment mapping', () => {
    expect(isPayrollReleaseEligible(releaseRow({ payrollApproval: null }))).toBe(false)
    expect(isPayrollReleaseEligible(releaseRow({ effectiveMappings: [] }))).toBe(false)
    expect(isPayrollReleaseEligible(releaseRow({ effectiveMappings: [
      { processing_target: 'PAYMENT' } as ReleaseRow['effectiveMappings'][number],
      { processing_target: 'PAYMENT' } as ReleaseRow['effectiveMappings'][number],
    ] }))).toBe(false)
  })

  it('keeps TVT, overtime and already released entries out of regular payment release', () => {
    expect(isPayrollReleaseEligible(releaseRow({ tvtConfigured: true }))).toBe(false)
    expect(isPayrollReleaseEligible(releaseRow({ workType: { family: 'OVERTIME' } as NonNullable<ReleaseRow['workType']> }))).toBe(false)
    expect(isPayrollReleaseEligible(releaseRow({ release: {} as NonNullable<ReleaseRow['release']> }))).toBe(false)
  })
})
