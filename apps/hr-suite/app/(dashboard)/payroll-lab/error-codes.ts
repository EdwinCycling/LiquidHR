import type { SyntheticPayrollErrorCode } from '@/lib/payroll/synthetic-calculation-service'

export const PAYROLL_LAB_ERROR_CODES = [
  'PAYROLL_SYNTHETIC_MODE_DISABLED',
  'PAYROLL_SCOPE_INVALID',
  'PAYROLL_ADMINISTRATION_UNAVAILABLE',
  'PAYROLL_CAPABILITY_DISABLED',
  'PAYROLL_PERIOD_CLOSED',
  'PAYROLL_INPUT_INVALID',
  'PAYROLL_CALCULATION_BLOCKED',
  'PAYROLL_CALCULATION_FAILED',
  'PAYROLL_PERSISTENCE_FAILED',
] as const satisfies readonly SyntheticPayrollErrorCode[]

const PAYROLL_LAB_ERROR_CODE_SET: ReadonlySet<string> = new Set(PAYROLL_LAB_ERROR_CODES)

export function isPayrollLabErrorCode(value: unknown): value is SyntheticPayrollErrorCode {
  return typeof value === 'string' && PAYROLL_LAB_ERROR_CODE_SET.has(value)
}

export function payrollLabErrorMessageKey(code: SyntheticPayrollErrorCode): 'payrollLabRunUnavailable' | 'payrollLabRunFailed' {
  if (
    code === 'PAYROLL_SYNTHETIC_MODE_DISABLED'
    || code === 'PAYROLL_ADMINISTRATION_UNAVAILABLE'
    || code === 'PAYROLL_CAPABILITY_DISABLED'
    || code === 'PAYROLL_PERSISTENCE_FAILED'
  ) return 'payrollLabRunUnavailable'
  return 'payrollLabRunFailed'
}
