import { FixedDecimal } from '@liquid-hr/payroll-engine'
import type {
  EmployeePayrollCalculationView,
  EmployeePayrollPreflightView,
  LocalPayrollAcceptanceReadback,
  Payfull02CalculationAmounts,
} from './employee-payroll-calculation-service'
import {
  LOCAL_PAYROLL_ACCEPTANCE_PERIOD,
} from './local-payroll-acceptance-runtime'
import {
  derivePayfull02MarsOracle,
  derivePayfull02MarsVariableOracle,
  type Payfull02MarsOracleResult,
} from './payfull02-independent-oracle'
import {
  PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES,
  type PayrollAcceptanceScenarioCandidateKey,
} from './payroll-acceptance-scenario'

export const PAYROLL_ACCEPTANCE_EXCEPTION_CANDIDATE = {
  key: 'DEMO-005',
  employeeId: '6de31a0a-362a-55e4-5168-b2134f68132a',
  employmentId: '8ec508af-8277-7ab7-aa9a-081cc320177f',
} as const

type CandidateInput = {
  readonly employeeId: string
  readonly employmentId: string
  readonly period: typeof LOCAL_PAYROLL_ACCEPTANCE_PERIOD
}

export interface LocalPayrollAcceptanceService {
  readonly prepareScenarioSetup: (input: { readonly employeeId: string; readonly employmentId: string }) => Promise<void>
  readonly inspectScenarioCandidate: (input: CandidateInput) => Promise<EmployeePayrollPreflightView>
  readonly calculateScenarioCandidate: (input: CandidateInput) => Promise<EmployeePayrollCalculationView>
  readonly inspectVariableScenarioCandidate: (input: CandidateInput) => Promise<EmployeePayrollPreflightView>
  readonly calculateVariableScenarioCandidate: (input: CandidateInput) => Promise<EmployeePayrollCalculationView>
  readonly inspectExceptionCandidate: (input: CandidateInput) => Promise<EmployeePayrollPreflightView>
  readonly readBackScenarioCalculation: (input: {
    readonly employeeId: string
    readonly employmentId: string
    readonly runId: string
  }) => Promise<LocalPayrollAcceptanceReadback | null>
}

export type LocalPayrollAcceptancePreflight = {
  readonly key: string
  readonly eligibleForCalculation: boolean
  readonly expectedException: boolean
  readonly gaps: readonly { readonly field: string; readonly status: string; readonly reasonCode: string }[]
}

export type LocalPayrollAcceptanceCalculation = {
  readonly key: string
  readonly status: string
  readonly completeness: string | null
  readonly businessStatus: string | null
  readonly runId: string | null
  readonly sourceSnapshotId: string | null
  readonly inputSetId: string | null
  readonly sourceHash: string | null
  readonly inputHash: string | null
  readonly resultHash: string | null
  readonly idempotencyVerified: boolean
  readonly grossAmount: string | null
  readonly wageTaxAmount: string | null
  readonly remainingAfterWageTax: string | null
  readonly payfull02: Payfull02CalculationAmounts | null
  readonly incompleteComponents: readonly string[]
  readonly oracleMatches: boolean
  readonly readback: LocalPayrollAcceptanceReadback | null
  readonly errorCode?: string | null
}

export type LocalPayrollAcceptanceFlowResult = {
  readonly message: 'preflightBlocked' | 'saved' | 'partial' | 'failed'
  readonly preflight: readonly LocalPayrollAcceptancePreflight[]
  readonly calculations: readonly LocalPayrollAcceptanceCalculation[]
}

function simplifyPreflight(
  key: string,
  result: EmployeePayrollPreflightView,
  expectedException: boolean,
): LocalPayrollAcceptancePreflight {
  return {
    key,
    eligibleForCalculation: result.eligibleForCalculation,
    expectedException,
    gaps: result.gaps.map(({ field, status, reasonCode }) => ({ field, status, reasonCode })),
  }
}

function money(value: string | null): string | null {
  if (value === null) return null
  try {
    const parsed = FixedDecimal.parse(value)
    return parsed.scale <= 2 ? parsed.toString(2) : null
  } catch {
    return null
  }
}

function hasExpectedBlockedException(result: EmployeePayrollPreflightView): boolean {
  return !result.eligibleForCalculation
    && result.gaps.some((gap) => (gap.status === 'SOURCE_GAP' || gap.status === 'UNSUPPORTED')
      && gap.reasonCode === 'SALARY_DOES_NOT_RECONCILE_TO_PART_TIME_FACTOR')
}

function readbackMatchesCalculation(
  result: LocalPayrollAcceptanceCalculation,
  readback: LocalPayrollAcceptanceReadback | null,
): boolean {
  return result.status === 'CALCULATED'
    && result.completeness === 'COMPLETE'
    && (result.businessStatus === 'CONCEPT' || result.businessStatus === 'REVIEWED' || result.businessStatus === 'FINALIZED')
    && result.runId !== null
    && result.sourceSnapshotId !== null
    && result.inputSetId !== null
    && result.sourceHash !== null
    && result.inputHash !== null
    && result.resultHash !== null
    && readback?.confirmed === true
    && readback.lifecycleStatus === result.businessStatus
    && readback.runId === result.runId
    && readback.sourceSnapshotId === result.sourceSnapshotId
    && readback.inputSetId === result.inputSetId
    && readback.sourceHash === result.sourceHash
    && readback.inputHash === result.inputHash
    && readback.resultHash === result.resultHash
    && readback.componentResultCount > 0
    && readback.controlCount > 0
    && readback.traceId !== null
    && readback.conceptEventId !== null
    && readback.scenarioCode !== null
    && readback.coreSourceHash !== null
    && readback.assumptionsHash !== null
    && readback.payrollSetupHash !== null
    && readback.openingBalanceSourceHash !== null
    && result.payfull02 !== null
    && result.payfull02.employeePension !== null
    && result.payfull02.employerPension !== null
    && result.payfull02.totalEmployerCost !== null
    && readback.controls.every((control) => control.status === 'PASS')
}

function samePersistedCalculation(
  first: EmployeePayrollCalculationView,
  repeated: EmployeePayrollCalculationView,
): boolean {
  return first.status === repeated.status
    && first.completeness === repeated.completeness
    && first.businessStatus === repeated.businessStatus
    && first.runId !== null
    && first.runId === repeated.runId
    && first.sourceSnapshotId === repeated.sourceSnapshotId
    && first.inputSetId === repeated.inputSetId
    && first.sourceHash === repeated.sourceHash
    && first.inputHash === repeated.inputHash
    && first.resultHash === repeated.resultHash
}

function matchesIndependentOracle(
  expected: Payfull02MarsOracleResult,
  result: EmployeePayrollCalculationView,
  grossAmount: string | null,
  wageTaxAmount: string | null,
): boolean {
  const actual = result.payfull02
  return grossAmount === expected.grossAmount
    && money(result.netAfterWageTax) === expected.netPay
    && wageTaxAmount === expected.wageTax
    && actual?.taxableWage === expected.taxableWage
    && actual.employeePension === expected.employeePension
    && actual.employerPension === expected.employerPension
    && actual.netReimbursement === expected.netReimbursement
    && actual.netDeduction === expected.netDeduction
    && actual.netCorrection === expected.netCorrection
    && actual.employerAwf === expected.employerAwf
    && actual.employerAof === expected.employerAof
    && actual.employerWko === expected.employerWko
    && actual.employerWhk === expected.employerWhk
    && actual.employerZvw === expected.employerZvw
    && actual.employerPremiums === expected.employerPremiums
    && actual.holidayReserve === expected.holidayReserve
    && actual.yearEndReserve === expected.yearEndReserve
    && actual.totalEmployerCost === expected.totalEmployerCost
    && actual.cumulativeGross === expected.cumulativeGross
    && actual.cumulativeTaxableWage === expected.cumulativeTaxableWage
    && actual.cumulativeWageTax === expected.cumulativeWageTax
    && actual.cumulativeEmployeeInsuranceWage === expected.cumulativeEmployeeInsuranceWage
    && actual.cumulativeZvwWage === expected.cumulativeZvwWage
    && actual.cumulativeHolidayReserve === expected.cumulativeHolidayReserve
}

export async function runLocalPayrollAcceptanceFlow(
  service: LocalPayrollAcceptanceService,
  candidateKeys?: readonly PayrollAcceptanceScenarioCandidateKey[],
): Promise<LocalPayrollAcceptanceFlowResult> {
  const period = LOCAL_PAYROLL_ACCEPTANCE_PERIOD
  const candidates = candidateKeys === undefined
    ? PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES
    : PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES.filter((candidate) => candidateKeys.includes(candidate.key))
  if (candidates.length === 0 || (candidateKeys !== undefined && candidates.length !== candidateKeys.length)) {
    throw new Error('PAYROLL_ACCEPTANCE_SCENARIO_NOT_AVAILABLE')
  }
  const scenarioPreflights: LocalPayrollAcceptancePreflight[] = []

  for (const candidate of candidates) {
    await service.prepareScenarioSetup({ employeeId: candidate.employeeId, employmentId: candidate.employmentId })
  }

  for (const candidate of candidates) {
    const result = await service.inspectScenarioCandidate({
      employeeId: candidate.employeeId,
      employmentId: candidate.employmentId,
      period,
    })
    scenarioPreflights.push(simplifyPreflight(candidate.key, result, false))
  }

  const exceptionPreflight = candidateKeys === undefined
    ? await service.inspectExceptionCandidate({
      employeeId: PAYROLL_ACCEPTANCE_EXCEPTION_CANDIDATE.employeeId,
      employmentId: PAYROLL_ACCEPTANCE_EXCEPTION_CANDIDATE.employmentId,
      period,
    })
    : null
  const preflight = [
    ...scenarioPreflights,
    ...(exceptionPreflight
      ? [simplifyPreflight(PAYROLL_ACCEPTANCE_EXCEPTION_CANDIDATE.key, exceptionPreflight, hasExpectedBlockedException(exceptionPreflight))]
      : []),
  ]
  const scenariosReady = scenarioPreflights.every((item) => item.eligibleForCalculation)
  const expectedExceptionConfirmed = exceptionPreflight === null || hasExpectedBlockedException(exceptionPreflight)
  if (!scenariosReady || !expectedExceptionConfirmed) {
    return { message: 'preflightBlocked', preflight, calculations: [] }
  }

  const calculations: LocalPayrollAcceptanceCalculation[] = []
  for (const candidate of candidates) {
    try {
      const input = { employeeId: candidate.employeeId, employmentId: candidate.employmentId, period }
      const result = await service.calculateScenarioCandidate(input)
      let idempotencyVerified = false
      try {
        const repeated = await service.calculateScenarioCandidate(input)
        idempotencyVerified = samePersistedCalculation(result, repeated)
      } catch {
        idempotencyVerified = false
      }
      let readback: LocalPayrollAcceptanceReadback | null = null
      if (result.runId) {
        try {
          readback = await service.readBackScenarioCalculation({ ...input, runId: result.runId })
        } catch {
          readback = null
        }
      }
      const grossAmount = money(result.grossAmount)
      const wageTaxAmount = money(result.wageTaxAmount)
      calculations.push({
        key: candidate.key,
        status: result.status,
        completeness: result.completeness,
        businessStatus: result.businessStatus,
        runId: result.runId,
        sourceSnapshotId: result.sourceSnapshotId,
        inputSetId: result.inputSetId,
        sourceHash: result.sourceHash,
        inputHash: result.inputHash,
        resultHash: result.resultHash,
        idempotencyVerified,
        grossAmount,
        wageTaxAmount,
        remainingAfterWageTax: money(result.netAfterWageTax),
        payfull02: result.payfull02,
        incompleteComponents: result.incompleteComponents,
        oracleMatches: matchesIndependentOracle(derivePayfull02MarsOracle(candidate.key), result, grossAmount, wageTaxAmount),
        readback,
        errorCode: result.errorCode,
      })
    } catch {
      calculations.push({
        key: candidate.key,
        status: 'FAILED',
        completeness: null,
        businessStatus: null,
        runId: null,
        sourceSnapshotId: null,
        inputSetId: null,
        sourceHash: null,
        inputHash: null,
        resultHash: null,
        idempotencyVerified: false,
        grossAmount: null,
        wageTaxAmount: null,
        remainingAfterWageTax: null,
        payfull02: null,
        incompleteComponents: [],
        oracleMatches: false,
        readback: null,
        errorCode: 'PAYROLL_ACCEPTANCE_CALCULATION_FAILED',
      })
    }
  }

  const allSavedAndVerified = calculations.length === candidates.length
    && calculations.every((item) => readbackMatchesCalculation(item, item.readback)
      && item.oracleMatches && item.idempotencyVerified)
  const anySaved = calculations.some((item) => item.readback?.confirmed === true)

  return {
    message: allSavedAndVerified ? 'saved' : anySaved ? 'partial' : 'failed',
    preflight,
    calculations,
  }
}

export async function runLocalPayrollAcceptanceVariableRevisionFlow(
  service: LocalPayrollAcceptanceService,
): Promise<LocalPayrollAcceptanceFlowResult> {
  const period = LOCAL_PAYROLL_ACCEPTANCE_PERIOD
  const candidate = PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES[0]!
  const input = { employeeId: candidate.employeeId, employmentId: candidate.employmentId, period }
  await service.prepareScenarioSetup({ employeeId: candidate.employeeId, employmentId: candidate.employmentId })
  const preflightResult = await service.inspectVariableScenarioCandidate(input)
  const preflight = [simplifyPreflight(candidate.key, preflightResult, false)]
  if (!preflightResult.eligibleForCalculation) {
    return { message: 'preflightBlocked', preflight, calculations: [] }
  }

  let result: EmployeePayrollCalculationView
  try {
    result = await service.calculateVariableScenarioCandidate(input)
  } catch {
    return {
      message: 'failed',
      preflight,
      calculations: [{
        key: 'DEMO-001 · variable €500',
        status: 'FAILED', completeness: null, businessStatus: null,
        runId: null, sourceSnapshotId: null, inputSetId: null,
        sourceHash: null, inputHash: null, resultHash: null,
        idempotencyVerified: false, grossAmount: null, wageTaxAmount: null,
        remainingAfterWageTax: null, payfull02: null, incompleteComponents: [],
        oracleMatches: false, readback: null,
        errorCode: 'PAYROLL_ACCEPTANCE_CALCULATION_FAILED',
      }],
    }
  }

  let idempotencyVerified = false
  try {
    const repeated = await service.calculateVariableScenarioCandidate(input)
    idempotencyVerified = samePersistedCalculation(result, repeated)
  } catch {
    idempotencyVerified = false
  }
  let readback: LocalPayrollAcceptanceReadback | null = null
  if (result.runId) {
    try {
      readback = await service.readBackScenarioCalculation({ ...input, runId: result.runId })
    } catch {
      readback = null
    }
  }
  const grossAmount = money(result.grossAmount)
  const wageTaxAmount = money(result.wageTaxAmount)
  const calculation: LocalPayrollAcceptanceCalculation = {
    key: 'DEMO-001 · variable €500',
    status: result.status,
    completeness: result.completeness,
    businessStatus: result.businessStatus,
    runId: result.runId,
    sourceSnapshotId: result.sourceSnapshotId,
    inputSetId: result.inputSetId,
    sourceHash: result.sourceHash,
    inputHash: result.inputHash,
    resultHash: result.resultHash,
    idempotencyVerified,
    grossAmount,
    wageTaxAmount,
    remainingAfterWageTax: money(result.netAfterWageTax),
    payfull02: result.payfull02,
    incompleteComponents: result.incompleteComponents,
    oracleMatches: matchesIndependentOracle(derivePayfull02MarsVariableOracle(), result, grossAmount, wageTaxAmount),
    readback,
    errorCode: result.errorCode,
  }
  const accepted = readbackMatchesCalculation(calculation, readback)
    && calculation.oracleMatches && idempotencyVerified
  return {
    message: accepted ? 'saved' : readback?.confirmed ? 'partial' : 'failed',
    preflight,
    calculations: [calculation],
  }
}
