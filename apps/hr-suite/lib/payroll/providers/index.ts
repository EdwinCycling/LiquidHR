import type { PayrollProvider } from './payroll-provider'

const PROVIDERS: Readonly<Record<string, PayrollProvider>> = {}

export function getPayrollProvider(code: string): PayrollProvider | null {
  return PROVIDERS[code] ?? null
}
