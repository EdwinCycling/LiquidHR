import { describe, expect, it, vi } from 'vitest'
import { AuthorizationError } from '@/lib/auth/permissions'
import type { PayrollCalculationArtifacts, PayrollRunSummary } from './calculation-repository'
import {
  getMySalaryStatements,
  getMySalaryStatement,
  renderMySalaryPayslipPdf,
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
  periodMonths: readonly number[] = [10],
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
  const artifactsByRun = new Map<string, PayrollCalculationArtifacts>()
  for (const month of periodMonths) {
    const id = month === 10 ? runId : `30000000-0000-4000-8000-${String(month).padStart(12, '0')}`
    const payrollPeriod = { id: `60000000-0000-4000-8000-${String(month).padStart(12, '0')}`, period_year: 2026, period_month: month }
    artifactsByRun.set(id, {
      run: { ...run, id },
      sourceSnapshot,
      payrollPeriod,
      inputSet: { input_hash: 'a'.repeat(64) },
      componentResults: [
        { component_key: 'gross_salary', amount: null, result_payload: { amount: `${5500 + (month - 10) * 100}.00` } },
        { component_key: 'net_salary', amount: null, result_payload: { amount: `${4200 + (month - 10) * 80}.00` } },
        ...(pensionSummaryPresent ? [{ component_key: 'employee_pension', amount: null, result_payload: { amount: '195.12' } }] : []),
        { component_key: 'cumulative_gross', amount: null, result_payload: { amount: '55000.00' } },
      ],
      trace: { trace_payload: { privateValue: 'must-not-be-returned' } },
      controls: pensionWarning ? [{ control_key: 'PAYRUN01-CTRL-009-PENSION-RULE-READY', status: 'WARN', detail_payload: {} }] : [],
      goldenCase: null,
    } as unknown as PayrollCalculationArtifacts)
  }
  const summaries = [...artifactsByRun.values()].map((periodArtifacts) => ({
    run: periodArtifacts.run,
    inputSet: periodArtifacts.inputSet,
    sourceSnapshot: periodArtifacts.sourceSnapshot,
    payrollPeriod: periodArtifacts.payrollPeriod,
  } as PayrollRunSummary))
  const listPayrollRunSummaries = vi.fn(async () => summaries)
  const getLatestSyntheticArtifacts = vi.fn(async (_scope: unknown, _adminId: string, _compositionId: string | undefined, requestedRunId: string) => artifactsByRun.get(requestedRunId) ?? null)
  const listLifecycleEvents = vi.fn(async (_scope: unknown, _adminId: string, periodId: string) => {
    const matchingRunId = [...artifactsByRun.entries()].find(([, periodArtifacts]) => periodArtifacts.payrollPeriod.id === periodId)?.[0]
    return finalized && matchingRunId
      ? [
        { calculation_run_id: matchingRunId, event_type: 'CONCEPT', event_sequence: 1 },
        { calculation_run_id: matchingRunId, event_type: 'REVIEWED', event_sequence: 2 },
        { calculation_run_id: matchingRunId, event_type: 'FINALIZED', event_sequence: 3 },
      ]
      : []
  })
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
    renderPayslipPdf: vi.fn(async (input: { employeeId: string; runId: string }) => ({
      artifact_bytes: Buffer.from('pdf'),
      content_type: 'application/pdf' as const,
      file_name: 'payslip.pdf',
      employeeId: input.employeeId,
      runId: input.runId,
    })),
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
      limit: 200,
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
        { key: 'net_salary', amount: 4200 },
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

  it('returns no invented periods when history is empty and one saved period when only one is finalized', async () => {
    const empty = makeDependencies(selfEmployeeId, selfEmployeeId, true, true, false, [])
    await expect(getMySalaryStatements(empty.dependencies)).resolves.toEqual([])

    const one = makeDependencies(selfEmployeeId, selfEmployeeId, true, true, false, [10])
    await expect(getMySalaryStatements(one.dependencies)).resolves.toHaveLength(1)
  })

  it('returns multiple actual finalized months in descending order with their saved amounts', async () => {
    const { dependencies } = makeDependencies(selfEmployeeId, selfEmployeeId, true, true, false, [8, 10, 9])
    const statements = await getMySalaryStatements(dependencies)
    expect(statements.map((statement) => `${statement.periodYear}-${statement.periodMonth}`)).toEqual(['2026-10', '2026-9', '2026-8'])
    expect(statements.map((statement) => statement.components.find((component) => component.key === 'gross_salary')?.amount)).toEqual([5500, 5400, 5300])
  })

  it('renders only a server-selected finalized self payslip for the requested available period', async () => {
    const { dependencies } = makeDependencies(selfEmployeeId, selfEmployeeId, true, true, false, [9, 10])
    const result = await renderMySalaryPayslipPdf(2026, 9, dependencies)
    expect(result).toMatchObject({ employeeId: selfEmployeeId, runId: '30000000-0000-4000-8000-000000000009' })
    expect(dependencies.renderPayslipPdf).toHaveBeenCalledWith(expect.objectContaining({ employeeId: selfEmployeeId, runId: '30000000-0000-4000-8000-000000000009' }))
  })

  it('does not render a requested month when it has no finalized self run', async () => {
    const { dependencies } = makeDependencies(selfEmployeeId, selfEmployeeId, false)
    await expect(renderMySalaryPayslipPdf(2026, 10, dependencies)).resolves.toBeNull()
    expect(dependencies.renderPayslipPdf).not.toHaveBeenCalled()
  })
})
