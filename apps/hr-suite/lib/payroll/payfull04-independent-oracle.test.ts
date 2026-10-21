import { describe, expect, it } from 'vitest'
import { derivePayfull04NoahOracle, PAYFULL04_NOAH_ORACLE_SOURCE } from './payfull04-independent-oracle'

describe('independent PAYFULL-04 broken-period tax oracle', () => {
  it('pins Noah to the official 2026 white week/day table cells', () => {
    expect(derivePayfull04NoahOracle()).toEqual({
      source: PAYFULL04_NOAH_ORACLE_SOURCE,
      grossAmount: '1758.50',
      taxableWage: '1758.50',
      fullWeeks: 2,
      remainingDays: 1,
      weeklyTableWage: '798.58',
      weeklyWageTax: '286.38',
      dailyTableWage: '159.72',
      dailyWageTax: '57.28',
      wageTax: '630.04',
      netBeforePension: '1128.46',
    })
  })
})
