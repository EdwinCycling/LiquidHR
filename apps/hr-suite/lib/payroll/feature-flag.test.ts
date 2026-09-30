import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPayrollLabEnabled } from './feature-flag'

describe('PAYROLL_LAB_ENABLED', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is enabled only for the exact server value true', () => {
    vi.stubEnv('PAYROLL_LAB_ENABLED', 'true')
    expect(isPayrollLabEnabled()).toBe(true)
  })

  it.each([undefined, '', 'TRUE', '1', 'false'])('fails closed for %s', (value) => {
    if (value === undefined) delete process.env.PAYROLL_LAB_ENABLED
    else vi.stubEnv('PAYROLL_LAB_ENABLED', value)
    expect(isPayrollLabEnabled()).toBe(false)
  })
})
