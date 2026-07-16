import { describe, expect, it } from 'vitest'
import { assessEmploymentChain } from './chain-assessment'

describe('assessEmploymentChain', () => {
  it('waarschuwt bij het derde tijdelijke contract en adviseert vast bij het vierde', () => {
    const history = [
      { startsOn: '2024-01-01', endsOn: '2024-12-31' },
      { startsOn: '2025-01-01', endsOn: '2025-12-31' },
    ]
    expect(
      assessEmploymentChain({
        proposed: { startsOn: '2026-01-01', endsOn: '2026-12-31', contractType: 'DEFINITE' },
        history,
        historyComplete: true,
      }).outcome,
    ).toBe('ATTENTION')
    expect(
      assessEmploymentChain({
        proposed: { startsOn: '2027-01-01', endsOn: '2027-06-30', contractType: 'DEFINITE' },
        history: [...history, { startsOn: '2026-01-01', endsOn: '2026-12-31' }],
        historyComplete: true,
      }).outcome,
    ).toBe('LIKELY_INDEFINITE')
  })

  it('begint onder het huidige regime opnieuw na meer dan zes maanden', () => {
    const assessment = assessEmploymentChain({
      proposed: { startsOn: '2026-08-02', endsOn: '2027-08-01', contractType: 'DEFINITE' },
      history: [
        { startsOn: '2023-01-01', endsOn: '2023-12-31' },
        { startsOn: '2024-01-01', endsOn: '2024-12-31' },
        { startsOn: '2025-01-01', endsOn: '2026-01-31' },
      ],
      historyComplete: true,
    })
    expect(assessment.chainContractCount).toBe(1)
    expect(assessment.outcome).toBe('CLEAR')
    expect(assessment.ruleVersion).toBe('NL_CHAIN_2020')
  })

  it('past vanaf 2028 de administratieve vervaltermijn toe', () => {
    const assessment = assessEmploymentChain({
      proposed: { startsOn: '2030-01-01', endsOn: '2030-12-31', contractType: 'DEFINITE' },
      history: [
        { startsOn: '2028-01-01', endsOn: '2028-06-30' },
        { startsOn: '2028-07-01', endsOn: '2028-12-31' },
        { startsOn: '2029-01-01', endsOn: '2029-06-30' },
      ],
      historyComplete: true,
    })
    expect(assessment.ruleVersion).toBe('NL_CHAIN_2028')
    expect(assessment.outcome).toBe('LIKELY_INDEFINITE')
  })

  it('geeft geen schijnzekerheid bij ontbrekende historie of een uitzondering', () => {
    expect(
      assessEmploymentChain({
        proposed: { startsOn: '2026-01-01', endsOn: '2026-12-31', contractType: 'DEFINITE' },
        history: [],
        historyComplete: false,
      }).outcome,
    ).toBe('INSUFFICIENT_DATA')
    expect(
      assessEmploymentChain({
        proposed: { startsOn: '2026-01-01', endsOn: '2026-12-31', contractType: 'DEFINITE' },
        history: [],
        historyComplete: true,
        exceptionCode: 'CAO_EXCEPTION',
      }).outcome,
    ).toBe('ATTENTION')
  })

  it('geeft bij een contract voor onbepaalde tijd geen ketenwaarschuwing', () => {
    expect(
      assessEmploymentChain({
        proposed: { startsOn: '2026-01-01', endsOn: null, contractType: 'INDEFINITE' },
        history: [],
        historyComplete: false,
      }).outcome,
    ).toBe('CLEAR')
  })
})

