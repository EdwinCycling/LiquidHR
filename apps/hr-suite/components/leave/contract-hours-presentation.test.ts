import { describe, expect, it } from 'vitest'
import { calculateContractHoursPeriodAmount, formatContractHours } from './contract-hours-presentation'

describe('contract-hours presentation', () => {
  it('derives complete-period previews from the annual full-time entitlement', () => {
    expect(formatContractHours(calculateContractHoursPeriodAmount(160, 'YEARLY'), '.', 2)).toBe('160')
    expect(formatContractHours(calculateContractHoursPeriodAmount(160, 'MONTHLY'), ',', 2)).toBe('13,33')
    expect(formatContractHours(calculateContractHoursPeriodAmount(160, 'FOUR_WEEKLY'), ',', 2)).toBe('12,31')
  })

  it('does not present invalid or negative input as a negative entitlement', () => {
    expect(calculateContractHoursPeriodAmount(-10, 'MONTHLY')).toBe(0)
    expect(formatContractHours(Number.NaN, ',')).toBe('—')
  })
})
