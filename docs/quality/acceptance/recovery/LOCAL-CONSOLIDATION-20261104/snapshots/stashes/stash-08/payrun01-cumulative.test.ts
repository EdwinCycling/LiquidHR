import { describe, expect, it } from 'vitest'
import { deriveKinderopvangOpeningBalance } from './payrun01-cumulative'

const hash = 'a'.repeat(64)

function finalizedSeptember(overrides: Record<string, unknown> = {}) {
  return {
    runId: '20000000-0000-4000-8000-000000000001',
    status: 'SUCCEEDED',
    resultHash: hash,
    sourceHash: hash,
    inputHash: hash,
    period: { year: 2026, month: 9 },
    lifecycleEvent: 'FINALIZED',
    controls: [{ status: 'PASS' }, { status: 'WARN' }],
    components: [
      { component_key: 'cumulative_gross', amount: '3044.44' },
      { component_key: 'cumulative_holiday_reserve', amount: '243.56' },
      { component_key: 'cumulative_year_end_reserve', amount: '243.56' },
    ],
    ...overrides,
  }
}

describe('deriveKinderopvangOpeningBalance', () => {
  it('starts September at zero on the day before employment begins', () => {
    const opening = deriveKinderopvangOpeningBalance({ year: 2026, month: 9 })

    expect(opening.asOfDate).toBe('2026-08-31')
    expect(opening.content).toMatchObject({
      status: 'EMPLOYMENT_START_ZERO_BASELINE',
      throughPeriod: { year: 2026, month: 8 },
      grossWage: '0.00',
      holidayReserve: '0.00',
      yearEndReserve: '0.00',
    })
    expect(opening.content.provenance.historicalPayrollReconstructed).toBe('false')
  })

  it('carries October from the exact finalized September result and hashes its provenance', () => {
    const opening = deriveKinderopvangOpeningBalance({ year: 2026, month: 10 }, finalizedSeptember())

    expect(opening.asOfDate).toBe('2026-09-30')
    expect(opening.content).toMatchObject({
      status: 'PERSISTED_PRIOR_PERIOD_RESULT',
      throughPeriod: { year: 2026, month: 9 },
      grossWage: '3044.44',
      holidayReserve: '243.56',
      yearEndReserve: '243.56',
      provenance: {
        priorRunId: '20000000-0000-4000-8000-000000000001',
        priorRunResultHash: hash,
        priorRunSourceHash: hash,
        priorRunInputHash: hash,
        priorRunLifecycleEvent: 'FINALIZED',
      },
    })
    expect(opening.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it.each([
    ['wrong period', { period: { year: 2026, month: 8 } }],
    ['not succeeded', { status: 'FAILED' }],
    ['not finalized', { lifecycleEvent: 'CONCEPT' }],
    ['missing result hash', { resultHash: null }],
    ['failed control', { controls: [{ status: 'FAIL' }] }],
    ['missing cumulative', { components: [] }],
  ])('rejects a September source that is %s', (_label, overrides) => {
    expect(() => deriveKinderopvangOpeningBalance(
      { year: 2026, month: 10 },
      finalizedSeptember(overrides as Record<string, unknown>),
    )).toThrow()
  })
})
