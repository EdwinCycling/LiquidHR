import 'server-only'

import { buildCalculationInputs, calculatePayroll } from '@liquid-hr/payroll-engine'
import { NL_2026_RULE_PACKAGE, NL_2026_RULE_REGISTRY, NL_2026_RESULT_COMPONENTS } from '@liquid-hr/payroll-rules-nl-2026'
import { createPayrollCalculationRepository } from './calculation-repository'
import { isPayrollLabEnabled } from './feature-flag'
import { createNl2026PayrollSnapshot } from './nl-2026-source'
import type { PayrollScope } from './scope'
import { createSyntheticPayrollService, SyntheticPayrollServiceError } from './synthetic-calculation-service'

export const NL_2026_TEST_SCENARIO = {
  caseKey: 'CC-NL-2026-001', compositionId: NL_2026_RULE_PACKAGE.compositionId,
  period: { year: 2026, month: 9 }, expectedResults: NL_2026_RESULT_COMPONENTS,
  createSnapshot: createNl2026PayrollSnapshot,
} as const

export const NL_2026_TEST_ENGINE = {
  buildInputs: (snapshot: Parameters<typeof buildCalculationInputs>[0], effectiveDate: string) => buildCalculationInputs(snapshot, NL_2026_RULE_PACKAGE, {
    effectiveDate,
    scopeInstanceIds: { EMPLOYEE: snapshot.sourceEmployeeId, EMPLOYMENT: snapshot.sourceEmploymentId, INCOME_RELATIONSHIP: snapshot.sourceIncomeRelationshipId ?? '' },
  }),
  calculate: (inputs: Parameters<typeof calculatePayroll>[0]) => calculatePayroll(inputs, NL_2026_RULE_REGISTRY),
}

function service() {
  if (!isPayrollLabEnabled()) throw new SyntheticPayrollServiceError('PAYROLL_SYNTHETIC_MODE_DISABLED')
  return createSyntheticPayrollService({ repository: createPayrollCalculationRepository(), isEnabled: isPayrollLabEnabled, engine: NL_2026_TEST_ENGINE, scenario: NL_2026_TEST_SCENARIO })
}

export async function runNl2026Payroll(scope: PayrollScope, administrationId: string, actorUserId: string) {
  return service().runSyntheticPayroll(scope, administrationId, actorUserId)
}
export async function getLatestNl2026Payroll(scope: PayrollScope, administrationId: string, runId?: string) {
  return service().getLatestSyntheticPayroll(scope, administrationId, runId)
}
