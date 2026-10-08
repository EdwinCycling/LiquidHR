import { describe, expect, it } from 'vitest'

import { payrollImportIncomeSourceRef } from './source-reference'

describe('payrollImportIncomeSourceRef', () => {
  it('stays stable when staged income rows are returned in a different order', () => {
    const ikvOne = {
      sourcePersonRef: 'row-7',
      payrollTaxNumber: 'TEST-LHNR',
      ikvNumber: 1,
      startsOn: '2026-01-01',
      endsOn: null,
    }
    const ikvTwo = {
      ...ikvOne,
      ikvNumber: 2,
      startsOn: '2026-01-15',
      endsOn: '2026-12-31',
    }

    const xmlOrder = [ikvOne, ikvTwo].map(payrollImportIncomeSourceRef)
    const databaseOrder = [ikvTwo, ikvOne].map(payrollImportIncomeSourceRef)

    expect(xmlOrder).toEqual([
      'row-7:income:TEST-LHNR:1:2026-01-01:',
      'row-7:income:TEST-LHNR:2:2026-01-15:2026-12-31',
    ])
    expect(databaseOrder).toEqual([...xmlOrder].reverse())
    expect(new Set(xmlOrder).size).toBe(2)
  })

  it('includes the source person and period boundaries in the relationship identity', () => {
    const base = {
      sourcePersonRef: 'row-7',
      payrollTaxNumber: 'TEST-LHNR',
      ikvNumber: 1,
      startsOn: '2026-01-01',
      endsOn: null,
    }

    expect(payrollImportIncomeSourceRef(base)).not.toBe(payrollImportIncomeSourceRef({ ...base, sourcePersonRef: 'row-8' }))
    expect(payrollImportIncomeSourceRef(base)).not.toBe(payrollImportIncomeSourceRef({ ...base, endsOn: '2026-12-31' }))
  })
})