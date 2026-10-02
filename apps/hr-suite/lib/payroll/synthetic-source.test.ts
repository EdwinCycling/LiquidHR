import { describe, expect, it } from 'vitest'
import type { PayrollJson } from './database'
import { payrollSourceProviderInputSchema } from './source/schemas'
import {
  createSyntheticPayrollSnapshot,
  SYNTHETIC_PAYROLL_EMPLOYEE_ID,
  SYNTHETIC_PAYROLL_EMPLOYMENT_ID,
} from './synthetic-source'

const scope = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  hrGroupId: '10000000-0000-4000-8000-000000000002',
  administrationId: '10000000-0000-4000-8000-000000000003',
}
const period = { year: 2026, month: 9 }

function isJsonObject(value: PayrollJson | undefined): value is { readonly [key: string]: PayrollJson | undefined } {
  return value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)
}

describe('synthetic Payroll source snapshot', () => {
  it('uses the fixed employee and canonical source contract with a reproducible hash', () => {
    const first = createSyntheticPayrollSnapshot(scope, period, {
      now: new Date('2026-09-30T10:00:00.000Z'),
      createId: () => '80000000-0000-4000-8000-000000000001',
    })
    const second = createSyntheticPayrollSnapshot(scope, period, {
      now: new Date('2026-09-30T12:00:00.000Z'),
      createId: () => '80000000-0000-4000-8000-000000000002',
    })
    const canonical = first.canonicalSource
    if (!isJsonObject(canonical)) throw new Error('Expected canonical source object.')
    const compensation = canonical.compensation
    if (!isJsonObject(compensation)) throw new Error('Expected compensation object.')
    const entries = compensation.entries
    if (!Array.isArray(entries) || entries.length !== 1 || !isJsonObject(entries[0])) {
      throw new Error('Expected exactly one canonical salary entry.')
    }

    expect(first.id).not.toBe(second.id)
    expect(first.sourceHash).toBe(second.sourceHash)
    expect(first.sourceEmployeeId).toBe(SYNTHETIC_PAYROLL_EMPLOYEE_ID)
    expect(first.sourceEmploymentId).toBe(SYNTHETIC_PAYROLL_EMPLOYMENT_ID)
    expect(first.periodReference).toEqual(period)
    expect(entries[0].parttimeAmount).toBe('4000.00')
    expect(first.sourceGaps).toEqual([
      { field: 'incomeRelationship', status: 'UNSUPPORTED', reasonCode: 'CONTROL02_CONTRACT_PENDING' },
      { field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' },
    ])
  })

  it('binds a hash to the trusted source scope and fixed payroll period', () => {
    const first = createSyntheticPayrollSnapshot(scope, period, { createId: () => '80000000-0000-4000-8000-000000000001' })
    const otherAdministration = createSyntheticPayrollSnapshot({
      ...scope,
      administrationId: '20000000-0000-4000-8000-000000000003',
    }, period, { createId: () => '80000000-0000-4000-8000-000000000002' })
    const otherPeriod = createSyntheticPayrollSnapshot(scope, { year: 2026, month: 10 }, {
      createId: () => '80000000-0000-4000-8000-000000000003',
    })

    expect(otherAdministration.sourceHash).not.toBe(first.sourceHash)
    expect(otherPeriod.sourceHash).not.toBe(first.sourceHash)
  })

  it('accepts opaque UUID-shaped Core identifiers regardless of version nibble', () => {
    const legacyAdministrationId = '00000000-0000-0000-8000-000000000003'
    const legacyScope = { ...scope, administrationId: legacyAdministrationId }
    const snapshot = createSyntheticPayrollSnapshot(legacyScope, period, {
      createId: () => '80000000-0000-4000-8000-000000000004',
    })

    expect(snapshot.sourceAdministrationId).toBe(legacyAdministrationId)
    expect(payrollSourceProviderInputSchema.safeParse({
      tenantId: scope.tenantId,
      hrGroupId: scope.hrGroupId,
      administrationId: legacyAdministrationId,
      employeeId: SYNTHETIC_PAYROLL_EMPLOYEE_ID,
      payrollPeriod: period,
    }).success).toBe(true)
    expect(payrollSourceProviderInputSchema.safeParse({
      tenantId: scope.tenantId,
      hrGroupId: scope.hrGroupId,
      administrationId: 'not-a-uuid',
      employeeId: SYNTHETIC_PAYROLL_EMPLOYEE_ID,
      payrollPeriod: period,
    }).success).toBe(false)
  })
})
