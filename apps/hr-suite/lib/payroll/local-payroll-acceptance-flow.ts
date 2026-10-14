import { FixedDecimal } from '@liquid-hr/payroll-engine'
import type {
  EmployeePayrollCalculationView,
  EmployeePayrollPreflightView,
  LocalPayrollAcceptanceReadback,
} from './employee-payroll-calculation-service'
import {
  LOCAL_PAYROLL_ACCEPTANCE_PERIOD,
} from './local-payroll-acceptance-runtime'
import { PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES } from './payroll-acceptance-scenario'

export const PAYROLL_ACCEPTANCE_EXCEPTION_CANDIDATE = {
  key: 'DEMO-005',
  employeeId: '6de31a0a-362a-55e4-5168-b2134f68132a',
  employmentId: '8ec508af-8277-7ab7-aa9a-081cc320177f',
} as const

const EXPECTED_WAGE_TAX_BY_GROSS: Readonly<Record<string, string>> = {
  '3517.00': '1261.33',
  '3534.00': '1268.08',
}

type CandidateInput = {
  readonly employeeId: string
  readonly employmentId: string
  readonly period: typeof LOCAL_PAYROLL_ACCEPTANCE_PERIOD
}

export interface LocalPayrollAcceptanceService {
  readonly inspectScenarioCandidate: (input: CandidateInput) => Promise<EmployeePayrollPreflightView>
  readonly calculateScenarioCandidate: (input: CandidateInput) => Promise<EmployeePayrollCalculationView>
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
  readonly incompleteComponents: readonly string[]
  readonly oracleMatches: boolean
  readonly readback: LocalPayrollAcceptanceReadback | null
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
  return result.status === 'INCOMPLETE'
    && result.completeness === 'INCOMPLETE'
    && result.businessStatus === 'CONCEPT'
    && result.runId !== null
    && result.sourceSnapshotId !== null
    && result.inputSetId !== null
    && result.sourceHash !== null
    && result.inputHash !== null
    && result.resultHash !== null
    && readback?.confirmed === true
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

export async function runLocalPayrollAcceptanceFlow(
  service: LocalPayrollAcceptanceService,
): Promise<LocalPayrollAcceptanceFlowResult> {
  const period = LOCAL_PAYROLL_ACCEPTANCE_PERIOD
  const scenarioPreflights: LocalPayrollAcceptancePreflight[] = []

  for (const candidate of PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES) {
    const result = await service.inspectScenarioCandidate({
      employeeId: candidate.employeeId,
      employmentId: candidate.employmentId,
      period,
    })
    scenarioPreflights.push(simplifyPreflight(candidate.key, result, false))
  }

  const exception = PAYROLL_ACCEPTANCE_EXCEPTION_CANDIDATE
  const exceptionPreflight = await service.inspectExceptionCandidate({
    employeeId: exception.employeeId,
    employmentId: exception.employmentId,
    period,
  })
  const preflight = [
    ...scenarioPreflights,
    simplifyPreflight(exception.key, exceptionPreflight, hasExpectedBlockedException(exceptionPreflight)),
  ]
  const scenariosReady = scenarioPreflights.every((item) => item.eligibleForCalculation)
  const expectedExceptionConfirmed = hasExpectedBlockedException(exceptionPreflight)
  if (!scenariosReady || !expectedExceptionConfirmed) {
    return { message: 'preflightBlocked', preflight, calculations: [] }
  }

  const calculations: LocalPayrollAcceptanceCalculation[] = []
  for (const candidate of PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES) {
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
      const expectedTax = grossAmount ? EXPECTED_WAGE_TAX_BY_GROSS[grossAmount] : undefined
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
        incompleteComponents: result.incompleteComponents,
        oracleMatches: expectedTax !== undefined && wageTaxAmount === expectedTax,
        readback,
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
        incompleteComponents: [],
        oracleMatches: false,
        readback: null,
      })
    }
  }

  const allSavedAndVerified = calculations.length === PAYROLL_ACCEPTANCE_SCENARIO_CANDIDATES.length
    && calculations.every((item) => readbackMatchesCalculation(item, item.readback)
      && item.oracleMatches && item.idempotencyVerified)
  const anySaved = calculations.some((item) => item.readback?.confirmed === true)

  return {
    message: allSavedAndVerified ? 'saved' : anySaved ? 'partial' : 'failed',
    preflight,
    calculations,
  }
}
