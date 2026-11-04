import { sha256, stableSerialize } from '@liquid-hr/payroll-engine'

export type Payrun01PeriodReference = {
  readonly year: number
  readonly month: number
}

export type Payrun01PriorRunEvidence = {
  readonly runId: string
  readonly status: string
  readonly resultHash: string | null
  readonly sourceHash: string
  readonly inputHash: string
  readonly period: Payrun01PeriodReference
  readonly lifecycleEvent: string | null
  readonly controls: readonly { readonly status: string }[]
  readonly components: readonly { readonly component_key: string; readonly amount: string | null }[]
}

export type Payrun01OpeningBalance = {
  readonly content: {
    readonly schemaVersion: 'PAYRUN01_CUMULATIVE_OPENING_V2'
    readonly scenario: 'KINDEROPVANG_TEST'
    readonly throughPeriod: Payrun01PeriodReference
    readonly status: 'EMPLOYMENT_START_ZERO_BASELINE' | 'PERSISTED_PRIOR_PERIOD_RESULT'
    readonly grossWage: string
    readonly holidayReserve: string
    readonly yearEndReserve: string
    readonly provenance: Readonly<Record<string, string>>
  }
  readonly hash: string
  readonly asOfDate: string
  readonly snapshotVersion: number
}

const HASH_PATTERN = /^[0-9a-f]{64}$/i
const MONEY_PATTERN = /^(?:0|[1-9]\d*)\.\d{2}$/

function previousPeriod(period: Payrun01PeriodReference): Payrun01PeriodReference {
  return period.month === 1
    ? { year: period.year - 1, month: 12 }
    : { year: period.year, month: period.month - 1 }
}

function periodEnd(period: Payrun01PeriodReference): string {
  const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate()
  return `${period.year}-${String(period.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

function makeOpening(
  period: Payrun01PeriodReference,
  status: Payrun01OpeningBalance['content']['status'],
  values: { readonly grossWage: string; readonly holidayReserve: string; readonly yearEndReserve: string },
  provenance: Readonly<Record<string, string>>,
): Payrun01OpeningBalance {
  const throughPeriod = previousPeriod(period)
  const content = {
    schemaVersion: 'PAYRUN01_CUMULATIVE_OPENING_V2' as const,
    scenario: 'KINDEROPVANG_TEST' as const,
    throughPeriod,
    status,
    ...values,
    provenance,
  }
  return {
    content,
    hash: sha256(stableSerialize(content)),
    asOfDate: periodEnd(throughPeriod),
    snapshotVersion: 300 + period.month,
  }
}

/**
 * September begins on the fixture's employment start date, so it has a zero
 * pre-employment baseline. October is accepted only from the persisted,
 * finalized September result with complete hashes, controls, and cumulatives.
 */
export function deriveKinderopvangOpeningBalance(
  period: Payrun01PeriodReference,
  priorRun?: Payrun01PriorRunEvidence,
): Payrun01OpeningBalance {
  if (period.year === 2026 && period.month === 9) {
    if (priorRun !== undefined) throw new Error('PAYRUN01_SEPTEMBER_MUST_START_AT_EMPLOYMENT_BASELINE')
    return makeOpening(period, 'EMPLOYMENT_START_ZERO_BASELINE', {
      grossWage: '0.00',
      holidayReserve: '0.00',
      yearEndReserve: '0.00',
    }, {
      source: 'SYNTHETIC_TEST_EMPLOYMENT_START',
      employmentStartDate: '2026-09-01',
      historicalPayrollReconstructed: 'false',
    })
  }

  if (period.year !== 2026 || period.month !== 10 || !priorRun) {
    throw new Error('PAYRUN01_PRIOR_PERIOD_RESULT_REQUIRED')
  }
  if (priorRun.period.year !== 2026 || priorRun.period.month !== 9
    || priorRun.status !== 'SUCCEEDED'
    || priorRun.lifecycleEvent !== 'FINALIZED'
    || !priorRun.resultHash || !HASH_PATTERN.test(priorRun.resultHash)
    || !HASH_PATTERN.test(priorRun.sourceHash)
    || !HASH_PATTERN.test(priorRun.inputHash)
    || priorRun.controls.length === 0
    || priorRun.controls.some((control) => control.status === 'FAIL')) {
    throw new Error('PAYRUN01_PRIOR_PERIOD_RESULT_NOT_ACCEPTED')
  }

  const values = new Map(priorRun.components.map(({ component_key, amount }) => [component_key, amount]))
  const grossWage = values.get('cumulative_gross')
  const holidayReserve = values.get('cumulative_holiday_reserve')
  const yearEndReserve = values.get('cumulative_year_end_reserve')
  if (!grossWage || !MONEY_PATTERN.test(grossWage)
    || !holidayReserve || !MONEY_PATTERN.test(holidayReserve)
    || !yearEndReserve || !MONEY_PATTERN.test(yearEndReserve)) {
    throw new Error('PAYRUN01_PRIOR_PERIOD_CUMULATIVES_INCOMPLETE')
  }

  return makeOpening(period, 'PERSISTED_PRIOR_PERIOD_RESULT', {
    grossWage,
    holidayReserve,
    yearEndReserve,
  }, {
    source: 'PERSISTED_PAYRUN01_PRIOR_PERIOD_RESULT',
    priorRunId: priorRun.runId,
    priorRunResultHash: priorRun.resultHash,
    priorRunSourceHash: priorRun.sourceHash,
    priorRunInputHash: priorRun.inputHash,
    priorRunLifecycleEvent: priorRun.lifecycleEvent,
  })
}
