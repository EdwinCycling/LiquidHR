import { describe, expect, it } from 'vitest'
import { parseAccrualRate } from './accrual-rate'

describe('worked-hours accrual rate input', () => {
  it('keeps eight-decimal rates without converting through hours, minutes or seconds', () => {
    expect(parseAccrualRate('0,07692308', ',')).toBe(0.07692308)
    expect(parseAccrualRate('0.07692308', ',')).toBe(0.07692308)
  })

  it('rejects empty, negative and over-precise values', () => {
    expect(parseAccrualRate('', ',')).toBeNull()
    expect(parseAccrualRate('-0,1', ',')).toBeNull()
    expect(parseAccrualRate('0,076923081', ',')).toBeNull()
  })
})
