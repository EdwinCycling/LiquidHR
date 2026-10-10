import 'server-only'

import { randomUUID } from 'node:crypto'
import type { PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'
import { assertPayrollScope, type PayrollScope } from './scope'
import { hashPayrollSourceSnapshot } from './source/snapshot-hash'
import { payrollSourceSnapshotSchema } from './source/schemas'

export const SYNTHETIC_PAYROLL_EMPLOYEE_ID = '40000000-0000-4000-8000-000000000009'
export const SYNTHETIC_PAYROLL_EMPLOYMENT_ID = '50000000-0000-4000-8000-000000000009'
export const SYNTHETIC_PAYROLL_SALARY_ID = '60000000-0000-4000-8000-000000000009'
export const SYNTHETIC_PAYROLL_SCHEDULE_ID = '70000000-0000-4000-8000-000000000009'

export type SyntheticPayrollPeriod = {
  readonly year: number
  readonly month: number
}

export interface SyntheticPayrollSnapshotOptions {
  readonly now?: Date
  readonly createId?: () => string
}

export function createSyntheticPayrollSnapshot(
  scope: PayrollScope,
  payrollPeriod: SyntheticPayrollPeriod,
  options: SyntheticPayrollSnapshotOptions = {},
): PayrollSourceSnapshot {
  const validatedScope = assertPayrollScope(scope)
  if (
    !Number.isInteger(payrollPeriod.year) || payrollPeriod.year < 2000 || payrollPeriod.year > 2200
    || !Number.isInteger(payrollPeriod.month) || payrollPeriod.month < 1 || payrollPeriod.month > 12
  ) {
    throw new TypeError('Synthetic Payroll period is invalid.')
  }

  const canonicalSource = {
    schemaVersion: 'payroll-source-v1',
    employment: {
      startsOn: '2026-01-01',
      endsOn: null,
      originalHireDate: '2026-01-01',
      seniorityDate: '2026-01-01',
      employmentType: 'REGULAR',
      contractType: 'PERMANENT',
      recordStatus: 'CONFIRMED',
    },
    compensation: {
      entries: [{
        id: SYNTHETIC_PAYROLL_SALARY_ID,
        salaryBasis: 'MONTHLY',
        salaryRoute: 'GROSS',
        paymentType: 'SALARY',
        paymentFrequency: 'MONTHLY',
        currencyCode: 'EUR',
        fulltimeAmount: '5000.00',
        parttimeAmount: '4000.00',
        hourlyRate: null,
        validFrom: '2026-01-01',
        validUntil: null,
      }],
    },
    schedule: {
      entries: [{
        id: SYNTHETIC_PAYROLL_SCHEDULE_ID,
        averageDaysPerWeek: 4,
        averageHoursPerWeek: 32,
        fulltimeHoursPerWeek: 40,
        partTimeFactor: '0.800000',
        scheduleType: 'FIXED',
        isOnCall: false,
        validFrom: '2026-01-01',
        validUntil: null,
      }],
    },
    incomeRelationship: { status: 'UNSUPPORTED', reasonCode: 'INCOME_RELATIONSHIP_SOURCE_UNSUPPORTED' },
    fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' },
  }
  const sourceVersionVector = {
    [`employment:${SYNTHETIC_PAYROLL_EMPLOYMENT_ID}`]: 'PAYLAB-GC-NL-001-v1',
    [`employment_salary:${SYNTHETIC_PAYROLL_SALARY_ID}`]: 'PAYLAB-GC-NL-001-v1',
    [`employment_schedule:${SYNTHETIC_PAYROLL_SCHEDULE_ID}`]: 'PAYLAB-GC-NL-001-v1',
  }
  const sourceGaps = [
    { field: 'incomeRelationship', status: 'UNSUPPORTED' as const, reasonCode: 'INCOME_RELATIONSHIP_SOURCE_UNSUPPORTED' },
    { field: 'taxProfile', status: 'SOURCE_GAP' as const, reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' },
  ]
  const hashInput = {
    sourceTenantId: validatedScope.tenantId,
    sourceHrGroupId: validatedScope.hrGroupId,
    sourceAdministrationId: validatedScope.administrationId,
    sourceEmployeeId: SYNTHETIC_PAYROLL_EMPLOYEE_ID,
    sourceEmploymentId: SYNTHETIC_PAYROLL_EMPLOYMENT_ID,
    sourceIncomeRelationshipId: null,
    periodReference: payrollPeriod,
    canonicalSource,
    sourceVersionVector,
    sourceGaps,
  }
  const snapshot: PayrollSourceSnapshot = {
    id: (options.createId ?? randomUUID)(),
    ...hashInput,
    sourceHash: hashPayrollSourceSnapshot(hashInput),
    createdAt: (options.now ?? new Date()).toISOString(),
  }
  const validatedSnapshot = payrollSourceSnapshotSchema.safeParse(snapshot)
  if (!validatedSnapshot.success) throw new TypeError('Synthetic Payroll source snapshot is invalid.')

  return validatedSnapshot.data
}
