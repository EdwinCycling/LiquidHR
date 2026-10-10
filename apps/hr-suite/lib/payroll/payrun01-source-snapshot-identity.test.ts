import { describe, expect, it } from 'vitest'
import { derivePayrun01SourceSnapshotId } from './payrun01-service'

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

    expect(retryId).toBe(initialId)
    expect(updatedConfigurationId).not.toBe(initialId)
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
