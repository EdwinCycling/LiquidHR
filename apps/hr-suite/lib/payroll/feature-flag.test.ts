import { afterEach, describe, expect, it, vi } from 'vitest'
import { isPayrollLabEnabled } from './feature-flag'

describe('Payroll module availability', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each([undefined, '', 'TRUE', '1', 'false', 'true'])('does not require a global environment flag (%s)', (value) => {
    if (value === undefined) delete process.env.PAYROLL_LAB_ENABLED
    else vi.stubEnv('PAYROLL_LAB_ENABLED', value)
    expect(isPayrollLabEnabled()).toBe(true)
  })
})
