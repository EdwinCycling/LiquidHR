import 'server-only'

import { AuthorizationError, requireAuthContext } from '@/lib/auth/permissions'
import { assertPayrollEmployeeSourceAuthorization, type PayrollEmployeeSourceAuthorization, type PayrollScope } from './scope'

/** Rebinds an employee's narrow Payroll source access to the live authenticated request. */
export async function assertCurrentPayrollSourceAuthorization(
  authorization: PayrollEmployeeSourceAuthorization,
  employeeId: string,
): Promise<PayrollScope> {
  let scope: PayrollScope
  try {
    scope = assertPayrollEmployeeSourceAuthorization(authorization, employeeId)
  } catch {
    throw new AuthorizationError('Payroll-brontoegang ontbreekt.')
  }

  const context = await requireAuthContext()
  if (context.userId !== authorization.actorUserId
    || context.tenantId !== scope.tenantId
    || context.hrGroupId !== scope.hrGroupId
    || context.administrationId !== scope.administrationId
    || context.employeeId !== authorization.employeeId
    || employeeId !== authorization.employeeId
    || !(context.permissions.includes('self:salary:read') || context.permissions.includes('salary:read'))) {
    throw new AuthorizationError('Payroll-brontoegang ontbreekt.')
  }

  return scope
}
