import { isLocalPersonaRuntime, resolveSupabaseProjectRef, type TestRoleSwitchEnvironment } from '@/lib/auth/test-role-switch'
import type { PayrollScope } from './scope'

export const PAYROLL_LAB_TEST_PROJECT_REF = 'jhgeriucbkfarxiudzfy'
export const LOCAL_PAYROLL_ACCEPTANCE_PERIOD = { year: 2026, month: 10 } as const
export const LOCAL_PAYROLL_ACCEPTANCE_SCOPE = {
  tenantId: '07249eb9-545c-883b-b26d-d52f83b4f4a1',
  hrGroupId: '6ba6f1df-e376-40f2-abff-ffdf000172e1',
  sourceAdministrationId: '2057f6ec-cd3e-3c28-9126-c41235d4ffae',
  payrollAdministrationId: '932ff7c3-e1ca-44b7-8980-387c9efdd9e3',
} as const

export interface LocalPayrollAcceptanceEnvironment extends TestRoleSwitchEnvironment {
  readonly payrollLabEnabled?: string
  readonly payrollLabUrl?: string
}

export function isLocalPayrollAcceptanceScope(
  scope: PayrollScope,
  payrollAdministrationId: string,
): boolean {
  return scope.tenantId === LOCAL_PAYROLL_ACCEPTANCE_SCOPE.tenantId
    && scope.hrGroupId === LOCAL_PAYROLL_ACCEPTANCE_SCOPE.hrGroupId
    && scope.administrationId === LOCAL_PAYROLL_ACCEPTANCE_SCOPE.sourceAdministrationId
    && payrollAdministrationId === LOCAL_PAYROLL_ACCEPTANCE_SCOPE.payrollAdministrationId
}

export function isLocalPayrollAcceptanceRuntime(
  host: string | null | undefined,
  environment: LocalPayrollAcceptanceEnvironment = {},
): boolean {
  const enabled = environment.payrollLabEnabled ?? process.env.PAYROLL_LAB_ENABLED
  const url = environment.payrollLabUrl ?? process.env.PAYROLL_SUPABASE_URL
  return isLocalPersonaRuntime(host, environment)
    && enabled === 'true'
    && resolveSupabaseProjectRef(url) === PAYROLL_LAB_TEST_PROJECT_REF
}
