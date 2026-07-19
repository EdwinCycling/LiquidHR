import { describe, expect, it } from 'vitest'
import { evidenceFromMessageMetadata } from './hera-response-model'

describe('evidenceFromMessageMetadata', () => {
  it('leest alleen volledige Liquid HR-bewijsmetadata', () => {
    const evidence = evidenceFromMessageMetadata({
      evidence: {
        source: 'LIQUID_HR',
        data: { matchedCount: 3 },
        scope: { population: 'Zichtbare salarissen', visibleCount: 42 },
        filters: [{ field: 'fulltime_amount', operator: '>', value: '6000' }],
        asOfDate: '2026-07-17',
        uncertainties: [],
      },
    })

    expect(evidence?.scope.visibleCount).toBe(42)
    expect(evidence?.asOfDate).toBe('2026-07-17')
  })

  it('negeert algemene of onvolledige metadata', () => {
    expect(evidenceFromMessageMetadata({ evidence: { source: 'INTERNET' } })).toBeNull()
    expect(evidenceFromMessageMetadata(null)).toBeNull()
  })
})
