import 'server-only'

import { AuthorizationError, getRequestAuthorizationContext, requireHrGroupId, requirePermissionInContext } from '@/lib/auth/permissions'
import { listDirectTeamEmployeeScope } from '@/lib/organization/team-scope'
import { headcountFtePopulationForRoles } from './headcount-fte-authorization'

/**
 * Operation-level absence RLS can grant group-wide access through
 * can_manage_employee(). Insights therefore revalidates every returned
 * employee against its separate direct-team allowlist before building output.
 */
export function assertAbsenceInsightEmployeeAllowlist(
  observedEmployeeIds: readonly string[],
  allowedEmployeeIds: readonly string[] | null,
): void {
  if (allowedEmployeeIds === null) return

  const allowed = new Set(allowedEmployeeIds)
  if (observedEmployeeIds.some((employeeId) => !allowed.has(employeeId))) {
    throw new AuthorizationError('Een of meer medewerkers vallen buiten je toegestane scope.')
  }
}

export async function getAbsenceInsightScope() {
  const { supabase, context, activeContext } = await getRequestAuthorizationContext()
  const population = headcountFtePopulationForRoles(context.activeRoles)
  if (!population) throw new AuthorizationError('Je hebt geen toegang tot deze Insights-rapportage.')

  await requirePermissionInContext(supabase, context, 'report-absence:read')
  await requirePermissionInContext(supabase, context, 'employee:read')
  if (population === 'HR_ADMIN') await requirePermissionInContext(supabase, context, 'report-employee-department:read')

  const hrGroupId = requireHrGroupId(context)
  const permittedAdministrationIds = [...new Set(activeContext.administrationsInActiveHrGroup.map((item) => item.id))]
  const administrationId = context.administrationId
  if (!administrationId || !permittedAdministrationIds.includes(administrationId)) {
    throw new AuthorizationError('Je actieve administratie valt buiten je toegestane scope.')
  }

  if (population === 'HR_ADMIN') {
    return { supabase, context, hrGroupId, administrationId, employeeIds: null as readonly string[] | null, scopeTruncated: false }
  }

  if (!context.employeeId) throw new AuthorizationError('Je teamcontext ontbreekt.')
  const teamScope = await listDirectTeamEmployeeScope(context, supabase, 5000)
  return {
    supabase,
    context,
    hrGroupId,
    administrationId,
    employeeIds: [...new Set(teamScope.employeeIds)],
    scopeTruncated: teamScope.sourceTruncated,
  }
}
