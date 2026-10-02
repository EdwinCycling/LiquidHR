import 'server-only'

import { AuthorizationError, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { resolvePayrollLabAdministration } from './access'
import { isPayrollLabEnabled } from './feature-flag'
import { payrollScopeFromAuthContext } from './scope'

interface ComponentLibraryAccessDependencies {
  requirePermission: typeof requirePermission
  resolveAdministration: typeof resolvePayrollLabAdministration
  enabled: () => boolean
}

/** Scope comes exclusively from the current authenticated request, never form fields. */
export async function requireComponentLibraryAccess(
  write = false,
  dependencies: ComponentLibraryAccessDependencies = {
    requirePermission,
    resolveAdministration: resolvePayrollLabAdministration,
    enabled: isPayrollLabEnabled,
  },
) {
  if (!dependencies.enabled()) throw new AuthorizationError('Payroll library unavailable.')
  const permission = write ? 'salary:write' : 'salary:read'
  const context: AuthContext = await dependencies.requirePermission(permission)
  if (!context.permissions.includes('salary:read')
    || !context.permissions.includes(permission)
    || !context.activeRoles.some(role => role === 'HR_ADMIN' || role === 'TENANT_ADMIN')) {
    throw new AuthorizationError('Payroll library unavailable.')
  }
  const scope = payrollScopeFromAuthContext(context)
  if (!scope) throw new AuthorizationError('Payroll library unavailable.')
  const administration = await dependencies.resolveAdministration(context)
  if (!administration || administration.status !== 'ACTIVE' || !administration.capabilityEnabled) {
    throw new AuthorizationError('Payroll library unavailable.')
  }
  return { scope, administration, actorUserId: context.userId, canCopy: context.permissions.includes('salary:write') }
}
