import { describe, expect, it } from 'vitest'
import { resolvePensionComponentRates } from './pension-rate-mapping'

describe('pension component rate mapping', () => {
  const flatArrangement = {
    arrangementType: 'FLAT_PREMIUM' as const,
    flatTotalRate: '15.0000',
    employeeSharePercent: '33.3333',
    employerSharePercent: '66.6667',
  }

  it('rounds split rates to the source precision for a versioned flat arrangement', () => {
    expect(resolvePensionComponentRates(flatArrangement, { status: 'CALCULATED', rate: '15.0000' })).toEqual({
      totalRate: '15.0000',
      employeeRate: '5.0000',
      employerRate: '10.0000',
    })
  })

  it('uses the pension calculator selected age-tier rate for a progressive arrangement', () => {
    expect(resolvePensionComponentRates({
      ...flatArrangement,
      arrangementType: 'PROGRESSIVE_PREMIUM',
      flatTotalRate: null,
    }, { status: 'CALCULATED', rate: '15.0000' })).toEqual({
      totalRate: '15.0000',
      employeeRate: '5.0000',
      employerRate: '10.0000',
    })
  })

  it('keeps progressive rates unresolved when no tier was calculated', () => {
    expect(resolvePensionComponentRates({
      ...flatArrangement,
      arrangementType: 'PROGRESSIVE_PREMIUM',
      flatTotalRate: null,
    }, { status: 'BLOCKED', rate: null })).toEqual({
      totalRate: null,
      employeeRate: null,
      employerRate: null,
    })
  })

  it('preserves explicitly mapped component rates and fails closed on an invalid share', () => {
    expect(resolvePensionComponentRates(flatArrangement, { status: 'CALCULATED', rate: '15.0000' }, {
      totalRate: '25.9000', employeeRate: '12.9000', employerRate: '13.0000',
    })).toEqual({ totalRate: '25.9000', employeeRate: '12.9000', employerRate: '13.0000' })
    expect(resolvePensionComponentRates({ ...flatArrangement, employerSharePercent: 'invalid' }, {
      status: 'CALCULATED', rate: '15.0000',
    })).toEqual({ totalRate: '15.0000', employeeRate: '5.0000', employerRate: null })
  })
})
