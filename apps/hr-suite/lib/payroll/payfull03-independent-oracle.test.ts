import { describe, expect, it } from 'vitest'
import { derivePayfull03EmmaOracle, PAYFULL03_EMMA_ORACLE_SOURCE } from './payfull03-independent-oracle'

describe('independent PAYFULL-03 full-month tax oracle', () => {
  it('pins Emma to the official 2026 white monthly-table cell without tax credit', () => {
    expect(derivePayfull03EmmaOracle()).toEqual({
      source: PAYFULL03_EMMA_ORACLE_SOURCE,
      grossAmount: '2110.20',
      tableWage: '2106.00',
      wageTax: '752.83',
      netBeforePension: '1357.37',
    })
  })
})
