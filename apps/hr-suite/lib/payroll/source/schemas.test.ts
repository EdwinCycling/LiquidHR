import { describe, expect, it } from 'vitest'
import { payrollPeriodReferenceSchema, payrollSourceProviderInputSchema, payrollSourceSnapshotSchema } from './schemas'

describe('Payroll source runtime schemas', () => {
  it('accepts valid calendar payroll periods and rejects invalid months', () => {
    expect(payrollPeriodReferenceSchema.safeParse({ year: 2026, month: 9 }).success).toBe(true)
    expect(payrollPeriodReferenceSchema.safeParse({ year: 2026, month: 0 }).success).toBe(false)
    expect(payrollPeriodReferenceSchema.safeParse({ year: 2026, month: 13 }).success).toBe(false)
  })

  it('requires UUID source scope and rejects extra caller-provided scope fields', () => {
    const input = {
      tenantId: '10000000-0000-4000-8000-000000000001',
      hrGroupId: '20000000-0000-4000-8000-000000000002',
      administrationId: '30000000-0000-4000-8000-000000000003',
      employeeId: '40000000-0000-4000-8000-000000000004',
      payrollPeriod: { year: 2026, month: 9 },
    }
    expect(payrollSourceProviderInputSchema.safeParse(input).success).toBe(true)
    expect(payrollSourceProviderInputSchema.safeParse({ ...input, userId: 'caller-controlled' }).success).toBe(false)
    expect(payrollSourceProviderInputSchema.safeParse({ ...input, employeeId: 'not-a-uuid' }).success).toBe(false)
  })

  it('rejects malformed snapshot hashes and non-finite canonical values', () => {
    const snapshot = {
      id: '80000000-0000-4000-8000-000000000008',
      sourceTenantId: '10000000-0000-4000-8000-000000000001',
      sourceHrGroupId: '20000000-0000-4000-8000-000000000002',
      sourceAdministrationId: '30000000-0000-4000-8000-000000000003',
      sourceEmployeeId: '40000000-0000-4000-8000-000000000004',
      sourceEmploymentId: '50000000-0000-4000-8000-000000000005',
      sourceIncomeRelationshipId: null,
      periodReference: { year: 2026, month: 9 },
      canonicalSource: { employment: { startsOn: '2026-09-01' } },
      sourceVersionVector: { 'employment:50000000-0000-4000-8000-000000000005': '2026-09-01T10:00:00.000Z' },
      sourceGaps: [{ field: 'incomeRelationship', status: 'UNSUPPORTED', reasonCode: 'INCOME_RELATIONSHIP_SOURCE_UNSUPPORTED' }],
      sourceHash: 'a'.repeat(64),
      createdAt: '2026-09-30T12:00:00.000Z',
    }

    expect(payrollSourceSnapshotSchema.safeParse(snapshot).success).toBe(true)
    expect(payrollSourceSnapshotSchema.safeParse({ ...snapshot, sourceHash: 'invalid' }).success).toBe(false)
    expect(payrollSourceSnapshotSchema.safeParse({ ...snapshot, canonicalSource: { amount: Number.POSITIVE_INFINITY } }).success).toBe(false)
  })
})
