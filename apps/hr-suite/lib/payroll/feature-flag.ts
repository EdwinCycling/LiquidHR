import 'server-only'

export function isPayrollLabEnabled(): boolean {
  return process.env.PAYROLL_LAB_ENABLED === 'true'
}
