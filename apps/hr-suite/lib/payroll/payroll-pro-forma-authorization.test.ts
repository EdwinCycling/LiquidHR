import { describe, expect, it, vi } from 'vitest'
import { AuthorizationError, type AuthContext } from '@/lib/auth/permissions'
import type { EmployeePayrollAccess } from './payroll-professional-service'
import {
  authorizeHrAdminPayrollProFormaTarget,
  type PayrollProFormaTargetAuthorizationDependencies,
} from './payroll-pro-forma-authorization'

const targetEmployeeId = '91000000-0000-4000-8000-000000000001'
const employeeContext: AuthContext = {
  tenantId: '91000000-0000-4000-8000-000000000010',
  hrGroupId: '91000000-0000-4000-8000-000000000020',
  administrationId: '91000000-0000-4000-8000-000000000030',
  userId: '91000000-0000-4000-8000-000000000040',
  employeeId: '91000000-0000-4000-8000-000000000050',
  activeRoles: ['HR_ADMIN'],
  permissions: ['salary:read'],
}
const targetAccess: EmployeePayrollAccess = {
  employeeId: targetEmployeeId,
  actorUserId: employeeContext.userId,
  scope: {
    tenantId: employeeContext.tenantId,
    hrGroupId: employeeContext.hrGroupId ?? '',
    administrationId: employeeContext.administrationId ?? '',
  },
  payrollAdministrationId: '91000000-0000-4000-8000-000000000060',
}

function dependencies(
  overrides: Partial<PayrollProFormaTargetAuthorizationDependencies> = {},
): PayrollProFormaTargetAuthorizationDependencies {
  return {
    requireAuthContext: async () => employeeContext,
    authorizeEmployeeSalary: async () => targetAccess,
    hasActivePlacement: async () => true,
    ...overrides,
  }
}

describe('HR Admin Payroll pro-forma target authorization', () => {
  it('authorizes employees placed within the active HR group and administration', async () => {
    const placedTarget = vi.fn(async () => true)
    const result = await authorizeHrAdminPayrollProFormaTarget(targetEmployeeId, dependencies({
      hasActivePlacement: placedTarget,
    }))

    expect(result).toEqual(targetAccess)
    expect(placedTarget).toHaveBeenCalledWith(targetEmployeeId, targetAccess.scope)
  })

  it('denies employees outside the active HR group or administration', async () => {
    await expect(authorizeHrAdminPayrollProFormaTarget(targetEmployeeId, dependencies({
      hasActivePlacement: async () => false,
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('denies self-targeting and non-HR roles', async () => {
    await expect(authorizeHrAdminPayrollProFormaTarget(employeeContext.employeeId ?? '', dependencies()))
      .rejects.toBeInstanceOf(AuthorizationError)
    await expect(authorizeHrAdminPayrollProFormaTarget(targetEmployeeId, dependencies({
      requireAuthContext: async () => ({ ...employeeContext, activeRoles: ['DIRECT_MANAGER'] }),
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  it('denies mismatched target, actor or scope from payroll authorization', async () => {
    await expect(authorizeHrAdminPayrollProFormaTarget(targetEmployeeId, dependencies({
      authorizeEmployeeSalary: async () => ({ ...targetAccess, employeeId: '91000000-0000-4000-8000-000000000099' }),
    }))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(authorizeHrAdminPayrollProFormaTarget(targetEmployeeId, dependencies({
      authorizeEmployeeSalary: async () => ({ ...targetAccess, actorUserId: '91000000-0000-4000-8000-000000000099' }),
    }))).rejects.toBeInstanceOf(AuthorizationError)
    await expect(authorizeHrAdminPayrollProFormaTarget(targetEmployeeId, dependencies({
      authorizeEmployeeSalary: async () => ({ ...targetAccess, scope: { ...targetAccess.scope, administrationId: '91000000-0000-4000-8000-000000000099' } }),
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })
})
