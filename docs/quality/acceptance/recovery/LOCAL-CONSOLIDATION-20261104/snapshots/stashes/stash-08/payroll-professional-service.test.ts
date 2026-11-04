import { describe, expect, it, vi } from 'vitest'
import { AuthorizationError } from '@/lib/auth/permissions'
import type { PayrollCalculationArtifacts, PayrollRunSummary } from './calculation-repository'
import {
  getMySalaryStatement,
  type EmployeePayrollDependencies,
} from './payroll-professional-service'

const selfEmployeeId = '10000000-0000-4000-8000-000000000001'
const otherEmployeeId = '10000000-0000-4000-8000-000000000002'
const employmentId = '20000000-0000-4000-8000-000000000001'
const runId = '30000000-0000-4000-8000-000000000001'
const arrangementId = '40000000-0000-4000-8000-000000000001'

function makeDependencies(
  permissionEmployeeId: string,
  sourceEmployeeId: string,
  finalized: boolean,
  pensionSummaryPresent = true,
  pensionWarning = false,
) {
  const authContext = {
    tenantId: '50000000-0000-4000-8000-000000000001',
    hrGroupId: '50000000-0000-4000-8000-000000000002',
    administrationId: '50000000-0000-4000-8000-000000000003',
    employeeId: selfEmployeeId,
  }
  const run = { id: runId, status: 'SUCCEEDED' }
  const sourceSnapshot = {
    source_employee_id: sourceEmployeeId,
    source_employment_id: employmentId,
    source_payload: {
      pension: { assignments: [{ arrangement: { id: arrangementId, name: 'Bedrijfseigen Pensioenregeling' } }] },
      payrollOwned: pensionSummaryPresent ? {
        pensionCalculationSummary: {
          arrangementId,
          pensionableBase: '46828.00',
          rate: '15.0000',
          sourceSnapshotId: 'must-not-be-returned',
        },
      } : {},
    },
  }
  const payrollPeriod = { id: '60000000-0000-4000-8000-000000000001', period_year: 2026, period_month: 10 }
  const artifacts = {
    run,
    sourceSnapshot,
    payrollPeriod,
    inputSet: { input_hash: 'a'.repeat(64) },
    componentResults: [
      { component_key: 'gross_salary', amount: null, result_payload: { amount: '5500.00' } },
      ...(pensionSummaryPresent ? [{ component_key: 'employee_pension', amount: null, result_payload: { amount: '195.12' } }] : []),
      { component_key: 'cumulative_gross', amount: null, result_payload: { amount: '55000.00' } },
    ],
    trace: { trace_payload: { privateValue: 'must-not-be-returned' } },
    controls: pensionWarning ? [{ control_key: 'PAYRUN01-CTRL-009-PENSION-RULE-READY', status: 'WARN', detail_payload: {} }] : [],
    goldenCase: null,
  } as unknown as PayrollCalculationArtifacts
  const summary = {
    run: artifacts.run,
    inputSet: artifacts.inputSet,
    sourceSnapshot: artifacts.sourceSnapshot,
    payrollPeriod: artifacts.payrollPeriod,
  } as PayrollRunSummary
  const listPayrollRunSummaries = vi.fn(async () => [summary])
  const getLatestSyntheticArtifacts = vi.fn(async () => artifacts)
  const listLifecycleEvents = vi.fn(async () => finalized
    ? [{ calculation_run_id: runId, event_type: 'FINALIZED' }]
    : [])
  const createCalculationRepository = vi.fn(() => ({ listPayrollRunSummaries, getLatestSyntheticArtifacts }))
  const createPayrunRepository = vi.fn(() => ({ listLifecycleEvents }))
  const dependencies = {
    requireAuthContext: vi.fn(async () => authContext),
    requirePermission: vi.fn(async () => ({ ...authContext, employeeId: permissionEmployeeId })),
    isEnabled: () => true,
    createPayrollRepository: vi.fn(() => ({
      getPayrollAdministration: vi.fn(async () => ({ id: 'payroll-admin', status: 'ACTIVE', capabilityEnabled: true })),
    })),
    createCalculationRepository,
    createPayrunRepository,
  } as unknown as EmployeePayrollDependencies
  return { dependencies, listPayrollRunSummaries, listLifecycleEvents, createPayrunRepository }
}

describe('employee My Salary read model', () => {
  it('rejects when the self permission resolves to another employee', async () => {
    const { dependencies, listPayrollRunSummaries } = makeDependencies(otherEmployeeId, selfEmployeeId, true)
    await expect(getMySalaryStatement(dependencies)).rejects.toBeInstanceOf(AuthorizationError)
    expect(listPayrollRunSummaries).not.toHaveBeenCalled()
  })

  it('filters persisted runs to the authenticated employee and ignores mismatched source snapshots', async () => {
    const { dependencies, listPayrollRunSummaries, listLifecycleEvents } = makeDependencies(selfEmployeeId, otherEmployeeId, true)
    expect(await getMySalaryStatement(dependencies)).toBeNull()
    expect(listPayrollRunSummaries).toHaveBeenCalledWith(expect.any(Object), 'payroll-admin', {
      employeeId: selfEmployeeId,
      runType: 'INDIVIDUAL_PAYROLL',
      limit: 100,
    })
    expect(listLifecycleEvents).not.toHaveBeenCalled()
  })

  it('returns only the finalized saved components and allow-listed pension explanation', async () => {
    const { dependencies, createPayrunRepository } = makeDependencies(selfEmployeeId, selfEmployeeId, true)
    const statement = await getMySalaryStatement(dependencies)
    expect(statement).toEqual({
      periodYear: 2026,
      periodMonth: 10,
      components: [
        { key: 'gross_salary', amount: 5500 },
        { key: 'employee_pension', amount: 195.12 },
        { key: 'cumulative_gross', amount: 55000 },
      ],
      pension: {
        arrangementName: 'Bedrijfseigen Pensioenregeling',
        pensionableBase: '46828.00',
        rate: '15.0000',
      },
      pensionReadiness: 'CALCULATED',
    })
    expect(JSON.stringify(statement)).not.toMatch(/sourceSnapshotId|inputHash|privateValue|must-not-be-returned/i)
    expect(createPayrunRepository).toHaveBeenCalledOnce()
  })

  it('marks a finalized statement with a missing pension source as unverified without returning a zero pension', async () => {
    const { dependencies } = makeDependencies(selfEmployeeId, selfEmployeeId, true, false)
    const statement = await getMySalaryStatement(dependencies)
    expect(statement?.pension).toBeNull()
    expect(statement?.pensionReadiness).toBe('SOURCE_VERIFICATION_REQUIRED')
    expect(statement?.components.some((component) => component.key.includes('pension'))).toBe(false)
  })

  it('preserves a pension readiness warning for the employee explanation', async () => {
    const { dependencies } = makeDependencies(selfEmployeeId, selfEmployeeId, true, true, true)
    const statement = await getMySalaryStatement(dependencies)
    expect(statement?.pensionReadiness).toBe('REVIEW_REQUIRED')
  })
})
