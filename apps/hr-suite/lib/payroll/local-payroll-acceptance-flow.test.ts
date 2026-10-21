import { describe, expect, it, vi } from 'vitest'
import type {
  EmployeePayrollCalculationView,
  EmployeePayrollPreflightView,
  LocalPayrollAcceptanceReadback,
} from './employee-payroll-calculation-service'
import {
  PAYROLL_ACCEPTANCE_EXCEPTION_CANDIDATE,
  runLocalPayrollAcceptanceFlow,
  runLocalPayrollAcceptanceVariableRevisionFlow,
  type LocalPayrollAcceptanceService,
} from './local-payroll-acceptance-flow'
import {
  PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES,
  PAYROLL_ACCEPTANCE_VARIABLE_SCENARIO_CODE,
} from './payroll-acceptance-scenario'

const period = { year: 2026, month: 10 } as const

function calculation(
  candidateIndex: number,
  overrides: Partial<EmployeePayrollCalculationView> = {},
): EmployeePayrollCalculationView {
  const candidate = PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES[candidateIndex]!
  const id = String(candidateIndex + 1).padStart(12, '0')
  const demo001 = candidate.key === 'DEMO-001'
  const demo003 = candidate.key === 'DEMO-003'
  const grossAmount = candidate.grossAmount
  const wageTaxAmount = demo001 ? '1188.58' : demo003 ? '518.42' : '1173.42'
  return {
    status: 'CALCULATED',
    completeness: 'COMPLETE',
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
    netAfterWageTax: demo001 ? '2181.49' : demo003 ? '2851.65' : '2141.36',
    payfull02: {
      taxableWage: demo001 || demo003 ? '3325.07' : '3282.28',
      employeePension: demo001 || demo003 ? '191.93' : '251.72',
      employerPension: demo001 || demo003 ? '287.90' : '251.72',
      netReimbursement: demo001 || demo003 ? '45.00' : '32.50',
      netDeduction: '0.00', netCorrection: '0.00',
      employerAwf: demo001 || demo003 ? '257.36' : '254.05',
      employerAof: demo001 || demo003 ? '208.48' : '205.80',
      employerWko: demo001 || demo003 ? '16.63' : '16.41',
      employerWhk: demo001 || demo003 ? '60.18' : '59.41',
      employerZvw: demo001 || demo003 ? '202.83' : '200.22',
      employerPremiums: demo001 || demo003 ? '745.48' : '735.89',
      holidayReserve: demo001 || demo003 ? '281.36' : '282.72', yearEndReserve: '0.00',
      totalEmployerCost: demo001 || demo003 ? '4876.74' : '4836.83',
      cumulativeTaxableWage: demo003 ? '33526.10' : demo001 ? '33250.70' : '32822.80',
      cumulativeWageTax: demo003 ? '11322.20' : demo001 ? '11885.80' : '11734.20',
      cumulativeEmployeeInsuranceWage: demo003 ? '33526.10' : demo001 ? '33250.70' : '32822.80',
      cumulativeZvwWage: demo003 ? '33526.10' : demo001 ? '33250.70' : '32822.80',
      cumulativeGross: demo003 ? '35476.00' : demo001 ? '35170.00' : '35340.00',
      cumulativeHolidayReserve: demo003 ? '2838.08' : demo001 ? '2813.60' : '2827.20', cumulativeYearEndReserve: '0.00',
    },
    gaps: [],
    incompleteComponents: [],
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
  const variableRevision = result.grossAmount === '4017.00'
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
    lifecycleStatus: 'CONCEPT',
    sourceHash: result.sourceHash,
    coreSourceHash: 'b'.repeat(64),
    assumptionsHash: 'c'.repeat(64),
    payrollSetupHash: 'd'.repeat(64),
    openingBalanceSourceHash: 'e'.repeat(64),
    inputHash: result.inputHash,
    resultHash: result.resultHash,
    scenarioCode: variableRevision ? PAYROLL_ACCEPTANCE_VARIABLE_SCENARIO_CODE : 'NL-2026-MONTHLY-WHITE-REGULAR-TEST',
    controls: [
      { key: 'CONTROL-A', status: 'PASS' },
      { key: 'CONTROL-B', status: 'PASS' },
    ],
  }
}

function variableCalculation(): EmployeePayrollCalculationView {
  return calculation(0, {
    runId: '30000000-0000-4000-8000-000000000501',
    sourceSnapshotId: '40000000-0000-4000-8000-000000000501',
    inputSetId: '50000000-0000-4000-8000-000000000501',
    sourceHash: '6'.repeat(64),
    inputHash: '7'.repeat(64),
    resultHash: '8'.repeat(64),
    grossAmount: '4017.00',
    wageTaxAmount: '1357.67',
    netAfterWageTax: '2462.40',
    payfull02: {
      ...calculation(0).payfull02!,
      taxableWage: '3775.07', employeePension: '241.93', employerPension: '362.90',
      employerAwf: '292.19', employerAof: '236.70', employerWko: '18.88',
      employerWhk: '68.33', employerZvw: '230.28', employerPremiums: '846.38',
      holidayReserve: '321.36', totalEmployerCost: '5592.64',
      cumulativeTaxableWage: '33700.70', cumulativeWageTax: '12054.89',
      cumulativeEmployeeInsuranceWage: '33700.70', cumulativeZvwWage: '33700.70',
      cumulativeGross: '35670.00', cumulativeHolidayReserve: '2853.60',
    },
  })
}

function serviceWithReadySources(): LocalPayrollAcceptanceService {
  return {
    prepareScenarioSetup: vi.fn(async () => undefined),
    inspectScenarioCandidate: vi.fn(async (input) => preflight(input.employeeId, input.employmentId, true)),
    calculateScenarioCandidate: vi.fn(async (input) => {
      const index = PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES.findIndex((candidate) => candidate.employeeId === input.employeeId)
      return calculation(index)
    }),
    inspectVariableScenarioCandidate: vi.fn(async (input) => preflight(input.employeeId, input.employmentId, true)),
    calculateVariableScenarioCandidate: vi.fn(async () => variableCalculation()),
    inspectExceptionCandidate: vi.fn(async (input) => preflight(input.employeeId, input.employmentId, false, [
      { field: 'contractualSalary', status: 'UNSUPPORTED', reasonCode: 'SALARY_DOES_NOT_RECONCILE_TO_PART_TIME_FACTOR' },
    ])),
    readBackScenarioCalculation: vi.fn(async (input) => {
      const index = PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES.findIndex((candidate) => candidate.employeeId === input.employeeId)
      return readback(input.runId === '30000000-0000-4000-8000-000000000501'
        ? variableCalculation()
        : calculation(index))
    }),
  }
}

describe('isolated local payroll acceptance flow', () => {
  it('persists only the approved TEST setup, then preflights all candidates before creating a payroll run', async () => {
    const service = serviceWithReadySources()
    vi.mocked(service.inspectScenarioCandidate).mockImplementationOnce(async (input) =>
      preflight(input.employeeId, input.employmentId, false, [
        { field: 'taxProfile', status: 'SOURCE_GAP', reasonCode: 'NO_CONFIRMED_FISCAL_PROFILE' },
      ]))

    const result = await runLocalPayrollAcceptanceFlow(service)

    expect(result.message).toBe('preflightBlocked')
    expect(result.calculations).toEqual([])
    expect(service.prepareScenarioSetup).toHaveBeenCalledTimes(3)
    expect(service.inspectScenarioCandidate).toHaveBeenCalledTimes(3)
    expect(service.inspectExceptionCandidate).toHaveBeenCalledWith({
      employeeId: PAYROLL_ACCEPTANCE_EXCEPTION_CANDIDATE.employeeId,
      employmentId: PAYROLL_ACCEPTANCE_EXCEPTION_CANDIDATE.employmentId,
      period,
    })
    expect(service.calculateScenarioCandidate).not.toHaveBeenCalled()
    expect(service.readBackScenarioCalculation).not.toHaveBeenCalled()
    expect(result.preflight[3]).toMatchObject({ key: 'DEMO-005', expectedException: true, eligibleForCalculation: false })
  })

  it('saves DEMO-001, DEMO-002 and DEMO-003, proves idempotency, and keeps DEMO-005 read-only', async () => {
    const service = serviceWithReadySources()

    const result = await runLocalPayrollAcceptanceFlow(service)

    expect(result.message).toBe('saved')
    expect(service.prepareScenarioSetup).toHaveBeenCalledTimes(3)
    expect(result.calculations).toHaveLength(3)
    expect(result.calculations.map((item) => item.key)).toEqual(['DEMO-001', 'DEMO-002', 'DEMO-003'])
    expect(result.calculations.map((item) => item.remainingAfterWageTax)).toEqual(['2181.49', '2141.36', '2851.65'])
    expect(result.calculations.every((item) => item.idempotencyVerified && item.oracleMatches)).toBe(true)
    expect(result.calculations.every((item) => item.businessStatus === 'CONCEPT' && item.completeness === 'COMPLETE')).toBe(true)
    expect(service.calculateScenarioCandidate).toHaveBeenCalledTimes(6)
    expect(service.readBackScenarioCalculation).toHaveBeenCalledTimes(3)
    expect(service.inspectExceptionCandidate).toHaveBeenCalledTimes(1)
    expect(result.calculations[0]?.readback).toMatchObject({
      confirmed: true,
      componentResultCount: 8,
      controlCount: 4,
      controls: [{ key: 'CONTROL-A', status: 'PASS' }, { key: 'CONTROL-B', status: 'PASS' }],
    })
  })

  it('calculates only DEMO-003 when the third-candidate flow is selected', async () => {
    const service = serviceWithReadySources()

    const result = await runLocalPayrollAcceptanceFlow(service, ['DEMO-003'])

    expect(result.message).toBe('saved')
    expect(result.preflight).toEqual([expect.objectContaining({ key: 'DEMO-003', eligibleForCalculation: true })])
    expect(result.calculations).toHaveLength(1)
    expect(result.calculations[0]).toMatchObject({
      key: 'DEMO-003',
      grossAmount: '3517.00',
      wageTaxAmount: '518.42',
      remainingAfterWageTax: '2851.65',
      idempotencyVerified: true,
      oracleMatches: true,
    })
    expect(service.prepareScenarioSetup).toHaveBeenCalledTimes(1)
    expect(service.prepareScenarioSetup).toHaveBeenCalledWith({
      employeeId: PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES[2]!.employeeId,
      employmentId: PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES[2]!.employmentId,
    })
    expect(service.inspectScenarioCandidate).toHaveBeenCalledTimes(1)
    expect(service.calculateScenarioCandidate).toHaveBeenCalledTimes(2)
    expect(service.readBackScenarioCalculation).toHaveBeenCalledTimes(1)
    expect(service.inspectExceptionCandidate).not.toHaveBeenCalled()
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

  it('checks the separate DEMO-001 variable-wage revision against the independent table oracle', async () => {
    const service = serviceWithReadySources()

    const result = await runLocalPayrollAcceptanceVariableRevisionFlow(service)

    expect(result.message).toBe('saved')
    expect(result.calculations).toHaveLength(1)
    expect(result.calculations[0]).toMatchObject({
      key: 'DEMO-001 · variable €500',
      grossAmount: '4017.00', wageTaxAmount: '1357.67', remainingAfterWageTax: '2462.40',
      idempotencyVerified: true, oracleMatches: true,
    })
    expect(service.inspectVariableScenarioCandidate).toHaveBeenCalledWith({
      employeeId: PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES[0]!.employeeId,
      employmentId: PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES[0]!.employmentId,
      period,
    })
    expect(service.prepareScenarioSetup).toHaveBeenCalledWith({
      employeeId: PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES[0]!.employeeId,
      employmentId: PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES[0]!.employmentId,
    })
    expect(service.calculateScenarioCandidate).not.toHaveBeenCalled()
    expect(service.calculateVariableScenarioCandidate).toHaveBeenCalledTimes(2)
  })
})
