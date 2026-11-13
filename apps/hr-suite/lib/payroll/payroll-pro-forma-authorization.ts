import 'server-only'

import { AuthorizationError, requireAuthContext, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { payrollScopeFromAuthContext, type PayrollScope } from './scope'
import {
  authorizeEmployeeSalaryPayrollAccess,
  type EmployeePayrollAccess,
} from './payroll-professional-service'

export type PayrollProFormaTargetAuthorizationDependencies = {
  readonly requireAuthContext: () => Promise<AuthContext>
  readonly authorizeEmployeeSalary: (employeeId: string) => Promise<EmployeePayrollAccess | null>
  readonly hasActivePlacement: (employeeId: string, scope: PayrollScope) => Promise<boolean>
}

const defaultDependencies: PayrollProFormaTargetAuthorizationDependencies = {
  requireAuthContext,
  authorizeEmployeeSalary: authorizeEmployeeSalaryPayrollAccess,
  hasActivePlacement: async (employeeId, scope) => {
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase.from('employee_organizations')
      .select('employee_id')
      .eq('tenant_id', scope.tenantId)
      .eq('hr_group_id', scope.hrGroupId)
      .eq('administration_id', scope.administrationId)
      .eq('employee_id', employeeId)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .limit(1)
    if (error) throw error
    return (data?.length ?? 0) > 0
  },
}

function requireTargetScope(context: AuthContext): PayrollScope {
  const scope = payrollScopeFromAuthContext(context)
  if (!scope) throw new AuthorizationError('De actieve administratiecontext is niet beschikbaar.')
  return scope
}

function sameScope(left: PayrollScope, right: PayrollScope): boolean {
  return left.tenantId === right.tenantId
    && left.hrGroupId === right.hrGroupId
    && left.administrationId === right.administrationId
}

async function authorizeTarget(
  employeeId: string,
  context: AuthContext,
  scope: PayrollScope,
  dependencies: PayrollProFormaTargetAuthorizationDependencies,
): Promise<EmployeePayrollAccess> {
  const targetEmployeeId = employeeId.toLowerCase()
  const access = await dependencies.authorizeEmployeeSalary(targetEmployeeId)
  if (!access || access.employeeId.toLowerCase() !== targetEmployeeId
    || access.actorUserId !== context.userId || !sameScope(access.scope, scope)) {
    throw new AuthorizationError('Salarisgegevens zijn niet beschikbaar binnen de actieve context.')
  }
  return access
}

export async function authorizeHrAdminPayrollProFormaTarget(
  employeeId: string,
  dependencies: PayrollProFormaTargetAuthorizationDependencies = defaultDependencies,
): Promise<EmployeePayrollAccess> {
  const context = await dependencies.requireAuthContext()
  if ((!context.activeRoles.includes('HR_ADMIN') && !context.activeRoles.includes('TENANT_ADMIN'))
    || context.employeeId?.toLowerCase() === employeeId.toLowerCase()) {
    throw new AuthorizationError('Deze HR Admin-pro-forma is niet beschikbaar voor deze gebruiker.')
  }

  const scope = requireTargetScope(context)
  if (!await dependencies.hasActivePlacement(employeeId.toLowerCase(), scope)) {
    throw new AuthorizationError('De medewerker valt niet binnen de actieve HR-groep en administratie.')
  }
  return await authorizeTarget(employeeId, context, scope, dependencies)
}
