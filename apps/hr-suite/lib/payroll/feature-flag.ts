import 'server-only'

export function isPayrollLabEnabled(): boolean {
  // Payroll is a product module. Tenant-module state, administration capability,
  // permissions, and RLS control access; a global environment flag must not hide it.
  return true
}
