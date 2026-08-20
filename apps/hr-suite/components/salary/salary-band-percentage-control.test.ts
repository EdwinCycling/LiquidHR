import { describe, expect, it } from 'vitest'
import { resolveSalaryBandPercentageValue, salaryBandPercentageSourceKey } from './salary-band-percentage-control'

describe('SalaryBandPercentageControl state synchronization', () => {
  const band = { minimum: '4000.00', midpoint: '5000.00', maximum: '6000.00' }

  it('preserves a transient percentage draft while its salary source is unchanged', () => {
    const sourceKey = salaryBandPercentageSourceKey('5000.00', band)

    expect(resolveSalaryBandPercentageValue({ sourceKey, value: '' }, sourceKey, '100.00')).toBe('')
  })

  it('shows the newly derived percentage when the salary source changes', () => {
    const previousSourceKey = salaryBandPercentageSourceKey('5000.00', band)
    const nextSourceKey = salaryBandPercentageSourceKey('5500.00', band)

    expect(resolveSalaryBandPercentageValue({ sourceKey: previousSourceKey, value: '101' }, nextSourceKey, '110.00')).toBe('110.00')
  })
})
