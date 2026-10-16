import type {
  IndividualPayrollLifecycleEventRow,
  PayrollPeriodRow,
  PayrollSourceSnapshotRow,
} from './database'
import type { PayrollRunSummary } from './calculation-repository'

export type PayrollCycleBusinessStatus = 'CONCEPT' | 'REVIEWED' | 'FINALIZED' | null

export type PayrollCycleCurrentSource = {
  readonly employeeId: string
  readonly sourceHash: string
  readonly sourceVersionVector: Readonly<Record<string, string>>
  readonly gaps: readonly { readonly field: string; readonly status: 'SOURCE_GAP' | 'UNSUPPORTED'; readonly reasonCode: string }[]
}

export type PayrollCycleWorkItem = {
  readonly employeeId: string
  readonly employmentId: string
  readonly runId: string | null
  readonly technicalStatus: PayrollRunSummary['run']['status'] | null
  readonly businessStatus: PayrollCycleBusinessStatus
  readonly revision: number | null
  readonly previousRunId: string | null
  readonly sourceHash: string | null
  readonly inputHash: string | null
  /** Difference between this saved revision and its predecessor. */
  readonly changedSourceKeys: readonly string[]
  /** Difference between the saved head and the latest Core source read. */
  readonly sourceDriftKeys: readonly string[]
  readonly inputChanged: boolean
  readonly stale: boolean
  readonly correctionSuccessorRequired: boolean
  readonly sourceGaps: PayrollCycleCurrentSource['gaps']
}

export type PayrollCycleProjection = {
  readonly cycle: PayrollPeriodRow
  readonly workItems: readonly PayrollCycleWorkItem[]
  readonly calculationCoverage: typeof PAYROLL_CALCULATION_COVERAGE
}

export const PAYROLL_CALCULATION_COVERAGE = [
  {
    category: 'NL_2026_REGULAR_WAGE_TAX',
    status: 'SUPPORTED_BOUNDED',
    reasonCode: 'NL_2026_WHITE_MONTHLY_UNDER_AOW_REGULAR_FULL_PERIOD',
  },
  {
    category: 'CORE_FISCAL_PROFILE',
    status: 'SUPPORTED_BOUNDED',
    reasonCode: 'HR_ADMIN_CONFIRMED_EFFECTIVE_DATED_PROFILE',
  },
  {
    category: 'INCOME_RELATIONSHIP_IKV',
    status: 'SUPPORTED_BOUNDED',
    reasonCode: 'EXACTLY_ONE_ACTIVE_LINKED_IKV_REQUIRED',
  },
  {
    category: 'CUMULATIVE_TAX',
    status: 'UNSUPPORTED',
    reasonCode: 'NO_GENERAL_CUMULATIVE_SOURCE_CONTRACT',
  },
  {
    category: 'PFZW_MONTHLY_ALLOCATION',
    status: 'SOURCE_GAP',
    reasonCode: 'PERIOD_ALLOCATION_AND_ROUNDING_UNPROVEN',
  },
  {
    category: 'EMPLOYER_SOCIAL_COSTS',
    status: 'UNSUPPORTED',
    reasonCode: 'GENERAL_EMPLOYER_COST_RULES_NOT_IMPLEMENTED',
  },
  {
    category: 'VARIABLE_AND_NON_REGULAR_WAGE',
    status: 'UNSUPPORTED',
    reasonCode: 'EFFECTIVE_COMPONENT_MAPPING_INCOMPLETE',
  },
  {
    category: 'ALLOWANCES_AND_RESERVES',
    status: 'UNSUPPORTED',
    reasonCode: 'GENERAL_ACCRUAL_AND_TAX_TREATMENT_UNPROVEN',
  },
] as const

type LifecycleEventsByEmployment = Readonly<Record<string, readonly IndividualPayrollLifecycleEventRow[]>>
type CurrentSourcesByEmployment = Readonly<Record<string, PayrollCycleCurrentSource>>

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function payloadText(event: IndividualPayrollLifecycleEventRow, key: string): string | null {
  if (!isRecord(event.event_payload)) return null
  const value = event.event_payload[key]
  return typeof value === 'string' ? value : null
}

function eventSourceHash(event: IndividualPayrollLifecycleEventRow): string | null {
  return payloadText(event, 'sourceHash') ?? payloadText(event, 'sourceSnapshotHash')
}

function latestEvent(events: readonly IndividualPayrollLifecycleEventRow[]): IndividualPayrollLifecycleEventRow | null {
  return [...events].sort((left, right) =>
    right.revision - left.revision
    || right.event_sequence - left.event_sequence
    || right.created_at.localeCompare(left.created_at)
    || right.id.localeCompare(left.id),
  )[0] ?? null
}

function previousRevisionEvent(
  events: readonly IndividualPayrollLifecycleEventRow[],
  revision: number,
): IndividualPayrollLifecycleEventRow | null {
  const previous = events.filter((event) => event.revision < revision)
  return latestEvent(previous)
}

function versionVector(snapshot: PayrollSourceSnapshotRow | undefined): Readonly<Record<string, string>> | undefined {
  if (!snapshot || !isRecord(snapshot.source_version_vector)) return undefined
  return Object.fromEntries(Object.entries(snapshot.source_version_vector)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

function changedKeys(
  previous: Readonly<Record<string, string>> | undefined,
  current: Readonly<Record<string, string>> | undefined,
): string[] {
  if (!previous || !current) return []
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)])
  return [...keys].filter((key) => previous[key] !== current[key]).sort()
}

function latestSourceSnapshot(
  events: readonly IndividualPayrollLifecycleEventRow[],
  summaries: readonly PayrollRunSummary[],
): PayrollSourceSnapshotRow | undefined {
  const event = latestEvent(events)
  if (!event) return undefined
  return summaries.find((summary) => summary.run.id === event.calculation_run_id)?.sourceSnapshot
}

function businessStatus(event: IndividualPayrollLifecycleEventRow | null): PayrollCycleBusinessStatus {
  if (!event || event.event_type === 'BLOCKED') return null
  return event.event_type
}

/** Projects existing Payroll Lab period, run and lifecycle contracts into the cycle worklist. */
export function projectPayrollCycle(input: {
  readonly cycle: PayrollPeriodRow
  readonly runs: readonly PayrollRunSummary[]
  readonly lifecycleEventsByEmployment: LifecycleEventsByEmployment
  readonly currentSourcesByEmployment?: CurrentSourcesByEmployment
}): PayrollCycleProjection {
  const periodRuns = input.runs.filter((summary) => summary.payrollPeriod.id === input.cycle.id)
  const employmentIds = new Set([
    ...periodRuns.map((summary) => summary.sourceSnapshot.source_employment_id),
    ...Object.keys(input.lifecycleEventsByEmployment),
  ])

  const workItems = [...employmentIds].map((employmentId): PayrollCycleWorkItem => {
    const runs = periodRuns.filter((summary) => summary.sourceSnapshot.source_employment_id === employmentId)
    const events = input.lifecycleEventsByEmployment[employmentId] ?? []
    const latest = latestEvent(events)
    const previous = latest ? previousRevisionEvent(events, latest.revision) : null
    const currentRun = latest
      ? runs.find((summary) => summary.run.id === latest.calculation_run_id)
      : [...runs].sort((left, right) => right.run.created_at.localeCompare(left.run.created_at))[0]
    const previousRun = previous
      ? runs.find((summary) => summary.run.id === previous.calculation_run_id)
      : undefined
    const storedSnapshot = latestSourceSnapshot(events, runs)
    const currentSource = input.currentSourcesByEmployment?.[employmentId]
    const latestSourceHash = storedSnapshot?.source_hash ?? (latest ? eventSourceHash(latest) : null)
    const currentHashDiffers = currentSource !== undefined
      && latestSourceHash !== null
      && currentSource.sourceHash !== latestSourceHash

    return {
      employeeId: storedSnapshot?.source_employee_id ?? currentSource?.employeeId ?? currentRun?.sourceSnapshot.source_employee_id ?? '',
      employmentId,
      runId: currentRun?.run.id ?? latest?.calculation_run_id ?? null,
      technicalStatus: currentRun?.run.status ?? null,
      businessStatus: businessStatus(latest),
      revision: latest?.revision ?? null,
      previousRunId: previous?.calculation_run_id ?? null,
      sourceHash: latestSourceHash,
      inputHash: latest ? payloadText(latest, 'inputHash') : currentRun?.inputSet.input_hash ?? null,
      changedSourceKeys: changedKeys(
        versionVector(previousRun?.sourceSnapshot),
        versionVector(currentRun?.sourceSnapshot),
      ),
      sourceDriftKeys: changedKeys(versionVector(storedSnapshot), currentSource?.sourceVersionVector),
      inputChanged: previousRun !== undefined
        && currentRun !== undefined
        && previousRun.inputSet.input_hash !== currentRun.inputSet.input_hash,
      stale: currentHashDiffers,
      correctionSuccessorRequired: currentHashDiffers && latest?.event_type === 'FINALIZED',
      sourceGaps: currentSource?.gaps ?? [],
    }
  }).sort((left, right) => left.employeeId.localeCompare(right.employeeId) || left.employmentId.localeCompare(right.employmentId))

  return { cycle: input.cycle, workItems, calculationCoverage: PAYROLL_CALCULATION_COVERAGE }
}
