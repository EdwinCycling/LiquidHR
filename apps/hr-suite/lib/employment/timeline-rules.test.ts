import { describe, expect, it } from 'vitest'
import { TimelineRuleError, planLatestRollback, planTimelineInsertion } from './timeline-rules'

const periods = [
  { id: 'a', validFrom: '2026-01-01', validUntil: '2026-07-01' },
  { id: 'b', validFrom: '2026-07-01', validUntil: '2027-01-01' },
  { id: 'c', validFrom: '2027-01-01', validUntil: null },
]

describe('planTimelineInsertion', () => {
  it('splitst alleen het geraakte blok en bewaart toekomstige blokken', () => {
    expect(planTimelineInsertion(periods, '2026-03-01')).toEqual({
      closePeriodId: 'a',
      closeAt: '2026-03-01',
      newValidUntil: '2026-07-01',
      preservedPeriodIds: ['b', 'c'],
      isRetroactive: true,
    })
  })

  it('plaatst een eerste blok voor bestaande toekomstige historie', () => {
    expect(planTimelineInsertion(periods, '2025-11-01')).toEqual({
      closePeriodId: null,
      closeAt: null,
      newValidUntil: '2026-01-01',
      preservedPeriodIds: ['a', 'b', 'c'],
      isRetroactive: true,
    })
  })

  it('weigert een tweede blok met dezelfde ingangsdatum', () => {
    expect(() => planTimelineInsertion(periods, '2026-07-01')).toThrowError(
      new TimelineRuleError('TIMELINE_EFFECTIVE_DATE_CONFLICT'),
    )
  })
})

describe('planLatestRollback', () => {
  it('verwijdert alleen het laatste blok en herstelt de voorganger', () => {
    expect(planLatestRollback(periods, 'c')).toEqual({
      deletePeriodIds: ['c'],
      restorePeriodIds: ['b'],
      restoreValidUntil: null,
    })
  })

  it('weigert een ouder of het enige resterende blok', () => {
    expect(() => planLatestRollback(periods, 'b')).toThrowError(
      new TimelineRuleError('TIMELINE_ONLY_LATEST_CAN_ROLLBACK'),
    )
    expect(() => planLatestRollback([periods[0]], 'a')).toThrowError(
      new TimelineRuleError('TIMELINE_LAST_REMAINING_BLOCK'),
    )
  })

  it('verwijdert een kostenverdelingsgroep met dezelfde ingangsdatum', () => {
    expect(
      planLatestRollback(
        [
          { id: 'a', validFrom: '2026-01-01', validUntil: '2027-01-01' },
          { id: 'b', validFrom: '2027-01-01', validUntil: null },
          { id: 'c', validFrom: '2027-01-01', validUntil: null },
        ],
        'b',
      ),
    ).toEqual({
      deletePeriodIds: ['b', 'c'],
      restorePeriodIds: ['a'],
      restoreValidUntil: null,
    })
  })
})
