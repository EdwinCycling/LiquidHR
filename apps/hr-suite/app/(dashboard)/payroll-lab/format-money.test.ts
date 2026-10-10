import { describe, expect, it } from 'vitest'
import { formatPayrollMoney, formatPayrollMoneyForDisplay } from './format-money'

describe('formatPayrollMoney', () => {
  it('groups a decimal larger than Number.MAX_SAFE_INTEGER without losing cents', () => {
    expect(formatPayrollMoney('9007199254740993.27', 'en-US')).toBe('€9,007,199,254,740,993.27')
  })

  it('keeps the sign when a negative amount has a zero integer part', () => {
    expect(formatPayrollMoney('-0.50', 'en-US')).toBe('-€0.50')
  })

  it('fails closed for malformed or over-precision amounts', () => {
    expect(formatPayrollMoney('3175.001', 'en-US')).toBe('—')
    expect(formatPayrollMoney('not-an-amount', 'en-US')).toBe('—')
    expect(formatPayrollMoney(null, 'en-US')).toBe('—')
  })
})

describe('formatPayrollMoneyForDisplay', () => {
  it('rounds exact decimals half-up for presentation and retains currency grouping', () => {
    expect(formatPayrollMoneyForDisplay('1911.735632183908045976', 'en-US')).toBe('€1,911.74')
    expect(formatPayrollMoneyForDisplay('1605.792505', 'nl-NL')).toBe('€ 1.605,79')
    expect(formatPayrollMoneyForDisplay('-0.005', 'en-US')).toBe('-€0.01')
    expect(formatPayrollMoneyForDisplay(null, 'en-US')).toBe('—')
  })
})
