import { PAYROLL_PROVIDER_CODE } from '@/lib/payroll/domain/types'
import { nmbrsPayrollProvider } from './nmbrs/provider'
import type { PayrollProvider } from './payroll-provider'

const PROVIDERS: Readonly<Record<string, PayrollProvider>> = {
  [PAYROLL_PROVIDER_CODE]: nmbrsPayrollProvider,
}

export function getPayrollProvider(code: string): PayrollProvider | null {
  return PROVIDERS[code] ?? null
}
