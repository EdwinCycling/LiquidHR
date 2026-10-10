import { describe, expect, it } from 'vitest'
import {
  derivePayrun01SourceSnapshotId,
  payrun01CalculationConfigEffectiveRange,
  payrun01CalculationConfigVersionNumber,
} from './payrun01-service'

const input = {
  scope: {
    tenantId: '10000000-0000-4000-8000-000000000001',
    hrGroupId: '20000000-0000-4000-8000-000000000001',
    administrationId: '30000000-0000-4000-8000-000000000001',
  },
  employeeId: '40000000-0000-4000-8000-000000000001',
  sourceEmploymentId: '50000000-0000-4000-8000-000000000001',
  period: { year: 2026, month: 10 },
  sourceHash: 'a'.repeat(64),
  scenarioKind: 'DEMO_COMPANY_TEST' as const,
  scenarioConfiguration: {
    version: 2,
    expectedSchedule: { contractHoursPerWeek: 40, scheduleType: 'HOURS_PER_DAY' },
  },
  rulePackageIdentity: { compositionId: 'NL-2026+PAYRUN01-DEMO_COMPANY_TEST' },
  taxProfile: { fiscalYear: '2026', timePeriod: 'MONTH' },
}

describe('PAYRUN01 source snapshot identity', () => {
  it('scopes Frits October config version to October while preserving the September baseline', () => {
    expect(payrun01CalculationConfigEffectiveRange('KINDEROPVANG_TEST', { year: 2026, month: 9 }, '2026-09-01'))
      .toEqual({ effectiveFrom: '2026-09-01', effectiveTo: null })
    expect(payrun01CalculationConfigEffectiveRange('KINDEROPVANG_TEST', { year: 2026, month: 10 }, '2026-09-01'))
      .toEqual({ effectiveFrom: '2026-10-01', effectiveTo: '2026-10-31' })
    expect(payrun01CalculationConfigEffectiveRange('DEMO_COMPANY_TEST', { year: 2026, month: 10 }, '2026-10-01'))
      .toEqual({ effectiveFrom: '2026-10-01', effectiveTo: null })
  })

  it('assigns Frits October the next config version after preserving historical v41', () => {
    expect(payrun01CalculationConfigVersionNumber('KINDEROPVANG_TEST', { year: 2026, month: 9 })).toBe(40)
    expect(payrun01CalculationConfigVersionNumber('KINDEROPVANG_TEST', { year: 2026, month: 10 })).toBe(42)
    expect(payrun01CalculationConfigVersionNumber('DEMO_COMPANY_TEST', { year: 2026, month: 10 })).toBe(5)
  })

  it('assigns Jaap a correction successor after preserving the existing version 1', () => {
    expect(payrun01CalculationConfigVersionNumber('LEGACY_COMPANY_TEST', { year: 2026, month: 10 })).toBe(2)
  })

  it('reuses identical source and projection content but separates a changed projection version', () => {
    const initialId = derivePayrun01SourceSnapshotId(input)
    const retryId = derivePayrun01SourceSnapshotId(input)
    const updatedConfigurationId = derivePayrun01SourceSnapshotId({
      ...input,
      scenarioConfiguration: {
        ...input.scenarioConfiguration,
        version: 3,
      },
    })
    const updatedTaxProfileId = derivePayrun01SourceSnapshotId({
      ...input,
      taxProfile: {
        ...input.taxProfile,
        profileId: 'PAYRUN01_KINDEROPVANG_TEST_TAX_PROFILE',
        profileVersion: '2',
        provenance: 'PAYROLL_OWNED_BOUNDED_TEST_INPUT',
        effectiveFrom: '2026-09-01',
      },
    })

    expect(retryId).toBe(initialId)
    expect(updatedConfigurationId).not.toBe(initialId)
    expect(updatedTaxProfileId).not.toBe(initialId)
  })

  it('keeps source snapshots isolated by payroll scope and source version', () => {
    const initialId = derivePayrun01SourceSnapshotId(input)
    const otherGroupId = derivePayrun01SourceSnapshotId({
      ...input,
      scope: { ...input.scope, hrGroupId: '20000000-0000-4000-8000-000000000002' },
    })
    const updatedSourceId = derivePayrun01SourceSnapshotId({ ...input, sourceHash: 'b'.repeat(64) })

    expect(otherGroupId).not.toBe(initialId)
    expect(updatedSourceId).not.toBe(initialId)
  })
})
