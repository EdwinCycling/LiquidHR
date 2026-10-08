import 'server-only'

import { requireAuthContext, type AuthContext } from '@/lib/auth/permissions'
import { selectActiveContext, type TenantContextOption } from '@/lib/context/administration-context'
import { loadAccessibleContextOptions } from '@/lib/context/server-context'
import type { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type EmployeeSelfContextResolution =
  | { readonly kind: 'resolved'; readonly context: AuthContext }
  | { readonly kind: 'none' }
  | { readonly kind: 'selection-required' }
  | { readonly kind: 'unavailable' }

interface EmployeeGroupAccess {
  readonly tenant_id: string
  readonly hr_group_id: string
  readonly management_role_id: string
}

interface EmployeeRole {
  readonly id: string
  readonly tenant_id: string | null
}

interface EmploymentAssignment {
  readonly administration_id: string
  readonly starts_on: string
  readonly ends_on: string | null
}

const MAX_EMPLOYEE_CONTEXT_GROUPS = 50
const MAX_EMPLOYEE_CONTEXT_ADMINISTRATIONS = 100

function isEmployeeRoleOnly(context: AuthContext, userId: string): boolean {
  return context.userId === userId
    && context.employeeId !== null
    && context.activeRoles.includes('EMPLOYEE')
    && context.focusExperience !== 'NO_EMPLOYMENT'
    && !context.activeRoles.some((role) =>
      role === 'DIRECT_MANAGER'
      || role === 'TEAM_LEAD'
      || role === 'TENANT_ADMIN'
      || role.includes('HR'),
    )
}

function tenantGroup(
  tenants: readonly TenantContextOption[],
  tenantId: string,
  hrGroupId: string,
): TenantContextOption | null {
  const tenant = tenants.find((item) => item.id === tenantId)
  return tenant?.hrGroups.some((group) => group.id === hrGroupId) ? tenant : null
}

function isCurrentOrFutureEmployment(row: EmploymentAssignment, today: string): boolean {
  return row.starts_on.length > 0 && (row.ends_on === null || row.ends_on >= today)
}

/**
 * Resolve APIAI-07 Employee self context from the authenticated subject and
 * canonical access/employment rows. Dashboard context cookies are never read.
 */
export async function resolveEmployeeSelfContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<EmployeeSelfContextResolution> {
  try {
    const accessible = await loadAccessibleContextOptions(userId, supabase, {
      includeFutureEmployment: true,
      requireComplete: true,
    })
    if (accessible.userId !== userId) return { kind: 'unavailable' }

    const { data: groupAccesses, error: groupAccessError } = await supabase
      .from('user_hr_group_access')
      .select('tenant_id, hr_group_id, management_role_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(500)
    if (groupAccessError || groupAccesses.length >= 500) return { kind: 'unavailable' }
    if (groupAccesses.length === 0) return { kind: 'none' }

    const roleIds = [...new Set(groupAccesses.map((row) => row.management_role_id))]
    const { data: roles, error: roleError } = await supabase
      .from('management_roles')
      .select('id, tenant_id')
      .in('id', roleIds)
      .eq('code', 'EMPLOYEE')
      .eq('is_active', true)
      .limit(500)
    if (roleError || roles.length >= 500) return { kind: 'unavailable' }

    const activeEmployeeRoleIds = new Map<string, string | null>(roles.map((role: EmployeeRole) => [role.id, role.tenant_id]))
    const employeeAccesses = groupAccesses.filter((access: EmployeeGroupAccess) => {
      const roleTenantId = activeEmployeeRoleIds.get(access.management_role_id)
      return activeEmployeeRoleIds.has(access.management_role_id)
        && (roleTenantId === null || roleTenantId === access.tenant_id)
    })

    const groupKeys = [...new Set(employeeAccesses.map((access) => `${access.tenant_id}\u0000${access.hr_group_id}`))]
    if (groupKeys.length > MAX_EMPLOYEE_CONTEXT_GROUPS) return { kind: 'selection-required' }
    const candidates: AuthContext[] = []
    let administrationContextsScanned = 0
    const today = new Date().toISOString().slice(0, 10)

    for (const key of groupKeys) {
      const [tenantId, hrGroupId] = key.split('\u0000')
      if (!tenantId || !hrGroupId) return { kind: 'unavailable' }
      const tenant = tenantGroup(accessible.tenants, tenantId, hrGroupId)
      const group = tenant?.hrGroups.find((item) => item.id === hrGroupId)
      if (!tenant || !group || group.administrations.length === 0) continue
      administrationContextsScanned += group.administrations.length
      if (administrationContextsScanned > MAX_EMPLOYEE_CONTEXT_ADMINISTRATIONS) return { kind: 'selection-required' }

      const firstAdministration = group.administrations[0]
      if (!firstAdministration) continue
      const activeContext = selectActiveContext({
        tenants: [tenant],
        requestedTenantId: tenantId,
        requestedHrGroupId: hrGroupId,
        requestedAdministrationId: firstAdministration.id,
      })
      const context = await requireAuthContext(supabase, activeContext)
      if (!isEmployeeRoleOnly(context, userId) || !context.employeeId || context.hrGroupId !== hrGroupId || context.tenantId !== tenantId) continue
      const employeeId = context.employeeId

      const administrationIds = group.administrations.map((item) => item.id)
      const { data: employments, error: employmentError } = await supabase
        .from('employments')
        .select('administration_id, starts_on, ends_on')
        .eq('employee_id', employeeId)
        .eq('tenant_id', tenantId)
        .eq('hr_group_id', hrGroupId)
        .in('administration_id', administrationIds)
        .eq('record_status', 'CONFIRMED')
        .or(`ends_on.is.null,ends_on.gte.${today}`)
        .is('deleted_at', null)
        .limit(1000)
      if (employmentError || employments.length >= 1000) return { kind: 'unavailable' }

      const assignedAdministrationIds = new Set(
        (employments as EmploymentAssignment[])
          .filter((row) => isCurrentOrFutureEmployment(row, today))
          .map((row) => row.administration_id),
      )

      for (const administration of group.administrations) {
        if (!assignedAdministrationIds.has(administration.id)) continue
        const selectedContext = selectActiveContext({
          tenants: [tenant],
          requestedTenantId: tenantId,
          requestedHrGroupId: hrGroupId,
          requestedAdministrationId: administration.id,
        })
        const selectedAuthContext = administration.id === firstAdministration.id
          ? context
          : await requireAuthContext(supabase, selectedContext)
        if (
          isEmployeeRoleOnly(selectedAuthContext, userId)
          && selectedAuthContext.hrGroupId === hrGroupId
          && selectedAuthContext.tenantId === tenantId
          && selectedAuthContext.administrationId === administration.id
        ) candidates.push(selectedAuthContext)
      }
    }

    if (candidates.length === 0) return { kind: 'none' }
    if (candidates.length !== 1) return { kind: 'selection-required' }
    return { kind: 'resolved', context: candidates[0] }
  } catch {
    return { kind: 'unavailable' }
  }
}
