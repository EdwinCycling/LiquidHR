import { FixedDecimal } from '@liquid-hr/payroll-engine'
import type { PayrollCalculationArtifacts, PayrollRunSummary } from './calculation-repository'
import type { PayrollJson, PayrollPeriodStatus, PayrollCalculationRunStatus } from './database'
import type { PayrollCycleBusinessStatus, PayrollCycleWorkItem } from './payroll-cycle-model'

export const PAYROLL_PROFESSIONAL_EMPLOYEE_STATUSES = [
  'NOT_CALCULATED', 'CONCEPT', 'REVIEWED', 'FINALIZED', 'BLOCKED',
] as const

export type PayrollProfessionalEmployeeStatus = typeof PAYROLL_PROFESSIONAL_EMPLOYEE_STATUSES[number]

export type PayrollProfessionalRosterEmployee = {
  readonly employeeId: string
  readonly employmentId: string
  readonly employeeNumber: string
  readonly employeeName: string
  readonly employmentNumber: string
  readonly startsOn: string
  readonly endsOn: string | null
  readonly isPrimary: boolean
}

export type PayrollProfessionalException = {
  readonly kind: 'SOURCE_GAP' | 'UNSUPPORTED' | 'INCOMPLETE' | 'CONTROL' | 'CALCULATION' | 'STALE'
  readonly field?: string
  readonly component?: string
  readonly controlKey?: string
  readonly reasonCode?: string
}

export type PayrollProfessionalEmployee = PayrollProfessionalRosterEmployee & {
  readonly status: PayrollProfessionalEmployeeStatus
  readonly technicalStatus: PayrollCalculationRunStatus | null
  readonly businessStatus: PayrollCycleBusinessStatus
  readonly runId: string | null
  readonly previousRunId: string | null
  readonly grossAmount: string | null
  readonly netAmount: string | null
  readonly employerCosts: string | null
  readonly lastCalculatedAt: string | null
  readonly exceptions: readonly PayrollProfessionalException[]
  readonly stale: boolean
  readonly correctionSuccessorRequired: boolean
  readonly canCalculate: boolean
  readonly canReview: boolean
  readonly canFinalize: boolean
  readonly canViewPayslip: boolean
}

export type PayrollProfessionalPeriodSummary = {
  readonly totalEmployees: number
  readonly counts: Readonly<Record<PayrollProfessionalEmployeeStatus, number>>
  readonly grossTotal: string | null
  readonly netTotal: string | null
  readonly employerCostsTotal: string | null
  readonly employeesWithExceptions: number
  readonly exceptionCount: number
}

function isRecord(value: PayrollJson | undefined): value is Readonly<Record<string, PayrollJson | undefined>> {
  return value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: PayrollJson | undefined): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function validAmount(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2)
  if (typeof value === 'string' && /^-?\d{1,12}(?:\.\d{1,6})?$/.test(value)) return value
  return null
}

function componentAmount(artifacts: PayrollCalculationArtifacts | undefined, key: string): string | null {
  const row = artifacts?.componentResults.find((candidate) => candidate.component_key === key)
  if (!row) return null
  const payload = isRecord(row.result_payload) ? row.result_payload : null
  return validAmount(payload?.amount) ?? validAmount(row.amount)
}

function traceIncompleteComponents(artifacts: PayrollCalculationArtifacts | undefined): readonly string[] {
  const payload = artifacts?.trace?.trace_payload
  if (!isRecord(payload) || !Array.isArray(payload.incompleteComponents)) return []
  return payload.incompleteComponents.filter((value): value is string => typeof value === 'string')
}

function sourceGapExceptions(payload: PayrollJson | undefined): readonly PayrollProfessionalException[] {
  if (!isRecord(payload) || !Array.isArray(payload.sourceGaps)) return []
  return payload.sourceGaps.flatMap((value) => {
    if (!isRecord(value)) return []
    const field = stringValue(value.field)
    const status = stringValue(value.status)
    const reasonCode = stringValue(value.reasonCode)
    if (!field || !reasonCode || (status !== 'SOURCE_GAP' && status !== 'UNSUPPORTED')) return []
    return [{
      kind: status,
      field,
      reasonCode,
    } satisfies PayrollProfessionalException]
  })
}

function addException(
  exceptions: PayrollProfessionalException[],
  exception: PayrollProfessionalException,
): void {
  const key = [exception.kind, exception.field, exception.component, exception.controlKey, exception.reasonCode].join('|')
  if (!exceptions.some((candidate) => [candidate.kind, candidate.field, candidate.component, candidate.controlKey, candidate.reasonCode].join('|') === key)) {
    exceptions.push(exception)
  }
}

function exceptionsFor(
  workItem: PayrollCycleWorkItem | undefined,
  artifacts: PayrollCalculationArtifacts | undefined,
): readonly PayrollProfessionalException[] {
  const exceptions: PayrollProfessionalException[] = [...sourceGapExceptions(artifacts?.sourceSnapshot.source_payload)]

  for (const gap of workItem?.sourceGaps ?? []) {
    addException(exceptions, {
      kind: gap.status,
      field: gap.field,
      reasonCode: gap.reasonCode,
    })
  }

  for (const component of new Set([
    ...traceIncompleteComponents(artifacts),
    ...(artifacts?.controls ?? []).flatMap((control) => control.control_key.startsWith('PAYCALC-CTRL-INCOMPLETE-')
      ? [control.control_key.replace('PAYCALC-CTRL-INCOMPLETE-', '')]
      : []),
  ])) {
    addException(exceptions, { kind: 'INCOMPLETE', component })
  }

  for (const control of artifacts?.controls ?? []) {
    if (control.status !== 'PASS' && !control.control_key.startsWith('PAYCALC-CTRL-INCOMPLETE-')) {
      addException(exceptions, { kind: 'CONTROL', controlKey: control.control_key, reasonCode: control.status })
    }
  }

  if (artifacts?.run.status === 'FAILED') {
    addException(exceptions, { kind: 'CALCULATION', reasonCode: 'CALCULATION_RUN_FAILED' })
  }
  if (workItem?.stale) {
    addException(exceptions, { kind: 'STALE', reasonCode: 'SOURCE_CHANGED_AFTER_SAVED_RUN' })
  }
  if (workItem?.correctionSuccessorRequired) {
    addException(exceptions, { kind: 'STALE', reasonCode: 'FINALIZED_RUN_REQUIRES_CORRECTION_SUCCESSOR' })
  }
  return exceptions
}

function hasBlockingException(exceptions: readonly PayrollProfessionalException[]): boolean {
  return exceptions.some((exception) => exception.kind !== 'STALE')
}

function hasActionBlockingException(exceptions: readonly PayrollProfessionalException[]): boolean {
  return exceptions.length > 0
}

function statusFor(
  workItem: PayrollCycleWorkItem | undefined,
  exceptions: readonly PayrollProfessionalException[],
): PayrollProfessionalEmployeeStatus {
  if (!workItem?.runId) return hasBlockingException(exceptions) ? 'BLOCKED' : 'NOT_CALCULATED'
  if (workItem.technicalStatus !== 'SUCCEEDED') return 'BLOCKED'
  if (workItem.businessStatus) return workItem.businessStatus
  return 'BLOCKED'
}

function sumMoney(values: readonly (string | null)[]): string | null {
  let total = FixedDecimal.parse('0')
  let hasValue = false
  for (const value of values) {
    if (value === null) continue
    try {
      total = total.add(FixedDecimal.parse(value))
      hasValue = true
    } catch {
      // Invalid persisted amounts are omitted from the overview; the run remains visible for review.
    }
  }
  return hasValue ? total.toString(2) : null
}

function emptyCounts(): Record<PayrollProfessionalEmployeeStatus, number> {
  return {
    NOT_CALCULATED: 0,
    CONCEPT: 0,
    REVIEWED: 0,
    FINALIZED: 0,
    BLOCKED: 0,
  }
}

export function emptyPayrollProfessionalPeriodSummary(): PayrollProfessionalPeriodSummary {
  return {
    totalEmployees: 0,
    counts: emptyCounts(),
    grossTotal: null,
    netTotal: null,
    employerCostsTotal: null,
    employeesWithExceptions: 0,
    exceptionCount: 0,
  }
}

export function projectPayrollProfessionalEmployees(input: {
  readonly roster: readonly PayrollProfessionalRosterEmployee[]
  readonly workItems: readonly PayrollCycleWorkItem[]
  readonly runs: readonly PayrollRunSummary[]
  readonly artifactsByRun: ReadonlyMap<string, PayrollCalculationArtifacts | null>
  readonly periodStatus: PayrollPeriodStatus
  readonly canWrite: boolean
}): {
  readonly employees: readonly PayrollProfessionalEmployee[]
  readonly summary: PayrollProfessionalPeriodSummary
} {
  const workItemByEmployment = new Map(input.workItems.map((item) => [item.employmentId, item]))
  const runById = new Map(input.runs.map((summary) => [summary.run.id, summary]))
  const employees = input.roster.map((employee): PayrollProfessionalEmployee => {
    const workItem = workItemByEmployment.get(employee.employmentId)
    const artifacts = workItem?.runId ? input.artifactsByRun.get(workItem.runId) ?? undefined : undefined
    const exceptions = exceptionsFor(workItem, artifacts)
    const status = statusFor(workItem, exceptions)
    const run = workItem?.runId ? runById.get(workItem.runId)?.run : undefined
    const technicalSuccess = workItem?.technicalStatus === 'SUCCEEDED'
    const actionable = input.periodStatus === 'OPEN' && input.canWrite
    const canReview = actionable && status === 'CONCEPT' && technicalSuccess && !hasActionBlockingException(exceptions)
    const canFinalize = actionable && status === 'REVIEWED' && technicalSuccess && !hasActionBlockingException(exceptions)

    return {
      ...employee,
      status,
      technicalStatus: workItem?.technicalStatus ?? null,
      businessStatus: workItem?.businessStatus ?? null,
      runId: workItem?.runId ?? null,
      previousRunId: workItem?.previousRunId ?? null,
      grossAmount: componentAmount(artifacts, 'gross_salary'),
      netAmount: componentAmount(artifacts, 'net_salary'),
      employerCosts: componentAmount(artifacts, 'total_employer_cost'),
      lastCalculatedAt: run?.finished_at ?? run?.started_at ?? run?.created_at ?? null,
      exceptions,
      stale: workItem?.stale ?? false,
      correctionSuccessorRequired: workItem?.correctionSuccessorRequired ?? false,
      canCalculate: actionable && status !== 'FINALIZED',
      canReview,
      canFinalize,
      canViewPayslip: status === 'FINALIZED' && workItem?.runId !== null && workItem?.runId !== undefined,
    }
  })

  const counts = emptyCounts()
  for (const employee of employees) counts[employee.status] += 1
  return {
    employees,
    summary: {
      totalEmployees: employees.length,
      counts,
      grossTotal: sumMoney(employees.map((employee) => employee.grossAmount)),
      netTotal: sumMoney(employees.map((employee) => employee.netAmount)),
      employerCostsTotal: sumMoney(employees.map((employee) => employee.employerCosts)),
      employeesWithExceptions: employees.filter((employee) => employee.exceptions.length > 0).length,
      exceptionCount: employees.reduce((total, employee) => total + employee.exceptions.length, 0),
    },
  }
}
