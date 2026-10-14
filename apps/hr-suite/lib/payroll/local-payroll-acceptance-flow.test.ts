import { describe, expect, it, vi } from 'vitest'
import type {
  EmployeePayrollCalculationView,
  EmployeePayrollPreflightView,
  LocalPayrollAcceptanceReadback,
} from './employee-payroll-calculation-service'
import {
  PAYROLL_ACCEPTANCE_EXCEPTION_CANDIDATE,
  runLocalPayrollAcceptanceFlow,
  type LocalPayrollAcceptanceService,
} from './local-payroll-acceptance-flow'
import { PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES } from './payroll-acceptance-scenario'

const period = { year: 2026, month: 10 } as const

function calculation(
  candidateIndex: number,
  overrides: Partial<EmployeePayrollCalculationView> = {},
): EmployeePayrollCalculationView {
  const candidate = PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES[candidateIndex]!
  const id = String(candidateIndex + 1).padStart(12, '0')
  const grossAmount = candidate.grossAmount
  const wageTaxAmount = candidateIndex === 0 ? '1261.33' : '1268.08'
  return {
    status: 'INCOMPLETE',
    completeness: 'INCOMPLETE',
    employeeId: candidate.employeeId,
    employmentId: candidate.employmentId,
    period,
    runId: `30000000-0000-4000-8000-${id}`,
    sourceSnapshotId: `40000000-0000-4000-8000-${id}`,
    inputSetId: `50000000-0000-4000-8000-${id}`,
    revision: 1,
    businessStatus: 'CONCEPT',
    sourceHash: `${String(candidateIndex + 1).repeat(64)}`,
    inputHash: `${String(candidateIndex + 3).repeat(64)}`,
    resultHash: `${String(candidateIndex + 5).repeat(64)}`,
    grossAmount,
    wageTaxAmount,
    netAfterWageTax: candidateIndex === 0 ? '2255.67' : '2265.92',
    gaps: [],
    incompleteComponents: ['PENSION_EMPLOYEE_ALLOCATION', 'EMPLOYER_SOCIAL_COSTS'],
    recoveryActions: [],
    previousRunId: null,
    changedSourceKeys: [],
    errorCode: null,
    ...overrides,
  }
}

function preflight(
  employeeId: string,
  employmentId: string,
  eligibleForCalculation: boolean,
  gaps: EmployeePayrollPreflightView['gaps'] = [],
): EmployeePayrollPreflightView {
  return { employeeId, employmentId, period, eligibleForCalculation, gaps }
}

function readback(result: EmployeePayrollCalculationView): LocalPayrollAcceptanceReadback {
  return {
    confirmed: true,
    runId: result.runId!,
    sourceSnapshotId: result.sourceSnapshotId,
    inputSetId: result.inputSetId,
    inputReferenceId: '70000000-0000-4000-8000-000000000001',
    payrollPeriodId: '80000000-0000-4000-8000-000000000001',
    componentResultCount: 8,
    controlCount: 4,
    traceId: '90000000-0000-4000-8000-000000000001',
    conceptEventId: 'a0000000-0000-4000-8000-000000000001',
    runStatus: 'SUCCEEDED',
    sourceHash: result.sourceHash,
    coreSourceHash: 'b'.repeat(64),
    assumptionsHash: 'c'.repeat(64),
    inputHash: result.inputHash,
    resultHash: result.resultHash,
    scenarioCode: 'NL-2026-MONTHLY-WHITE-REGULAR-TEST',
    controls: [
      { key: 'CONTROL-A', status: 'PASS' },
      { key: 'CONTROL-B', status: 'WARN' },
    ],
  }
}

function serviceWithReadySources(): LocalPayrollAcceptanceService {
  return {
    inspectScenarioCandidate: vi.fn(async (input) => preflight(input.employeeId, input.employmentId, true)),
    calculateScenarioCandidate: vi.fn(async (input) => {
      const index = PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES.findIndex((candidate) => candidate.employeeId === input.employeeId)
      return calculation(index)
    }),
    inspectExceptionCandidate: vi.fn(async (input) => preflight(input.employeeId, input.employmentId, false, [
      { field: 'contractualSalary', status: 'SOURCE_GAP', reasonCode: 'SALARY_DOES_NOT_RECONCILE_TO_PART_TIME_FACTOR' },
    ])),
    readBackScenarioCalculation: vi.fn(async (input) => {
      const index = PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES.findIndex((candidate) => candidate.employeeId === input.employeeId)
      return readback(calculation(index))
    }),
  }
}

describe('isolated local payroll acceptance flow', () => {
  it('preflights both selected candidates and the blocked candidate before writing either scenario', async () => {
    const service = serviceWithReadySources()
    vi.mocked(service.inspectScenarioCandidate).mockImplementationOnce(async (input) =>
      preflight(input.employeeId, input.employmentId, false, [
        { field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_CONFIRMED_FISCAL_PROFILE' },
      ]))

    const result = await runLocalPayrollAcceptanceFlow(service)

    expect(result.message).toBe('preflightBlocked')
    expect(result.calculations).toEqual([])
    expect(service.inspectScenarioCandidate).toHaveBeenCalledTimes(2)
    expect(service.inspectExceptionCandidate).toHaveBeenCalledWith({
      employeeId: PAYROLL_ACCEPTANCE_EXCEPTION_CANDIDATE.employeeId,
      employmentId: PAYROLL_ACCEPTANCE_EXCEPTION_CANDIDATE.employmentId,
      period,
    })
    expect(service.calculateScenarioCandidate).not.toHaveBeenCalled()
    expect(service.readBackScenarioCalculation).not.toHaveBeenCalled()
    expect(result.preflight[2]).toMatchObject({ key: 'DEMO-005', expectedException: true, eligibleForCalculation: false })
  })

  it('saves only DEMO-001 and DEMO-002, proves idempotency, and keeps DEMO-005 read-only', async () => {
    const service = serviceWithReadySources()

    const result = await runLocalPayrollAcceptanceFlow(service)

    expect(result.message).toBe('saved')
    expect(result.calculations).toHaveLength(2)
    expect(result.calculations.map((item) => item.key)).toEqual(['DEMO-001', 'DEMO-002'])
    expect(result.calculations.map((item) => item.remainingAfterWageTax)).toEqual(['2255.67', '2265.92'])
    expect(result.calculations.every((item) => item.idempotencyVerified && item.oracleMatches)).toBe(true)
    expect(result.calculations.every((item) => item.businessStatus === 'CONCEPT' && item.completeness === 'INCOMPLETE')).toBe(true)
    expect(service.calculateScenarioCandidate).toHaveBeenCalledTimes(4)
    expect(service.readBackScenarioCalculation).toHaveBeenCalledTimes(2)
    expect(service.inspectExceptionCandidate).toHaveBeenCalledTimes(1)
    expect(result.calculations[0]?.readback).toMatchObject({
      confirmed: true,
      componentResultCount: 8,
      controlCount: 4,
      controls: [{ key: 'CONTROL-A', status: 'PASS' }, { key: 'CONTROL-B', status: 'WARN' }],
    })
  })

  it('does not claim idempotency if a repeat calculation changes persisted identity', async () => {
    const service = serviceWithReadySources()
    const stable = calculation(0)
    const changed = calculation(0, { runId: '30000000-0000-4000-8000-000000000099' })
    vi.mocked(service.calculateScenarioCandidate)
      .mockResolvedValueOnce(stable)
      .mockResolvedValueOnce(changed)
      .mockImplementation(async (input) => calculation(PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES.findIndex((candidate) => candidate.employeeId === input.employeeId)))

    const result = await runLocalPayrollAcceptanceFlow(service)

    expect(result.message).toBe('partial')
    expect(result.calculations[0]?.idempotencyVerified).toBe(false)
  })
})
