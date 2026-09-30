import 'server-only'

import type { PayrollSourceSnapshot } from '@liquid-hr/payroll-engine'
import type { PayrollScope } from './scope'
import { createSyntheticPayrollSnapshot, type SyntheticPayrollPeriod, type SyntheticPayrollSnapshotOptions } from './synthetic-source'
import { hashPayrollSourceSnapshot } from './source/snapshot-hash'
import { payrollSourceSnapshotSchema } from './source/schemas'

export const NL_2026_EMPLOYEE_ID = '40000000-0000-4000-8000-000000002026'
export const NL_2026_EMPLOYMENT_ID = '50000000-0000-4000-8000-000000002026'
export const NL_2026_SYNTHETIC_IKV_ID = '90000000-0000-4000-8000-000000002026'

/** Testfixture, geen canonieke Core-IKV of geaccepteerde Core-fiscale bron. */
export function createNl2026PayrollSnapshot(scope: PayrollScope, period: SyntheticPayrollPeriod, options: SyntheticPayrollSnapshotOptions = {}): PayrollSourceSnapshot {
  const base = createSyntheticPayrollSnapshot(scope, period, options)
  const hashInput = {
    sourceTenantId: base.sourceTenantId,
    sourceHrGroupId: base.sourceHrGroupId,
    sourceAdministrationId: base.sourceAdministrationId,
    sourceEmployeeId: NL_2026_EMPLOYEE_ID,
    sourceEmploymentId: NL_2026_EMPLOYMENT_ID,
    sourceIncomeRelationshipId: NL_2026_SYNTHETIC_IKV_ID,
    periodReference: period,
    canonicalSource: {
      schemaVersion: 'payroll-source-v1',
      fixture: 'CC-NL-2026-001',
      incomeRelationship: { status: 'SYNTHETIC_FIXTURE', id: NL_2026_SYNTHETIC_IKV_ID, employmentId: NL_2026_EMPLOYMENT_ID },
      regularWage: {
        grossAmount: '4000.00', fiscalYear: '2026', table: 'WHITE', residence: 'NL',
        ageCategory: 'UNDER_AOW', herleiding: 'STD', timePeriod: 'MONTH',
        payrollTaxCredit: true, regularWage: true, fullPeriod: true,
        incomeRelationshipCount: '1', hasSpecialSituation: false,
      },
    },
    sourceVersionVector: { 'fixture:CC-NL-2026-001': '2026.1' },
    sourceGaps: [],
  }
  return payrollSourceSnapshotSchema.parse({
    id: base.id, ...hashInput, sourceHash: hashPayrollSourceSnapshot(hashInput), createdAt: base.createdAt,
  })
}
