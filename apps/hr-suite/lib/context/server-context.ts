import { cookies } from 'next/headers'
import {
  buildTenantContextOptions,
  selectActiveContext,
  type ActiveContext,
} from '@/lib/context/administration-context'
import { createClient } from '@/lib/supabase/server'

export const ACTIVE_TENANT_COOKIE = 'liquid-hr-tenant'
export const ACTIVE_HR_GROUP_COOKIE = 'liquid-hr-hr-group'
export const ACTIVE_ADMINISTRATION_COOKIE = 'liquid-hr-administration'

export class ContextAuthenticationError extends Error {
  readonly status = 401
}

const EMPLOYEE_MANAGER_ROLE_CODES = new Set(['EMPLOYEE', 'DIRECT_MANAGER'])

export async function loadActiveContext(userId?: string, existingClient?: Awaited<ReturnType<typeof createClient>>): Promise<ActiveContext> {
  const supabase = existingClient ?? await createClient()
  let resolvedUserId = userId

  if (!resolvedUserId) {
    const { data, error } = await supabase.auth.getClaims()
    const claimUserId = data?.claims?.sub
    if (error || typeof claimUserId !== 'string') {
      throw new ContextAuthenticationError('Je bent niet ingelogd.')
    }
    resolvedUserId = claimUserId
  }

  const [
    { data: groupAccesses, error: groupAccessError },
    { data: administrationAccesses, error: administrationAccessError },
  ] = await Promise.all([
    supabase
      .from('user_hr_group_access')
      .select('tenant_id, hr_group_id, management_role_id')
      .eq('user_id', resolvedUserId)
      .eq('is_active', true)
      .limit(500),
    supabase
      .from('user_access')
      .select('tenant_id, scope_type, administration_id, hr_group_id')
      .eq('user_id', resolvedUserId)
      .eq('is_active', true)
      .limit(500),
  ])

  if (groupAccessError) throw groupAccessError
  if (administrationAccessError) throw administrationAccessError

  const tenantIds = [...new Set(groupAccesses.map((access) => access.tenant_id))]
  if (tenantIds.length === 0) return selectActiveContext({ tenants: [] })

  const roleIds = [...new Set(groupAccesses.map((access) => access.management_role_id))]
  const { data: roles, error: roleError } = await supabase
    .from('management_roles')
    .select('id, code')
    .in('id', roleIds)
    .limit(500)

  if (roleError) throw roleError

  const roleCodesById = new Map(roles.map((role) => [role.id, role.code]))
  const contextGroupAccesses = groupAccesses.map((access) => ({
    tenant_id: access.tenant_id,
    hr_group_id: access.hr_group_id,
    management_role_code: roleCodesById.get(access.management_role_id) ?? 'UNKNOWN',
  }))
  const actorScopedGroupIds = contextGroupAccesses
    .filter((access) => EMPLOYEE_MANAGER_ROLE_CODES.has(access.management_role_code))
    .map((access) => access.hr_group_id)
    .filter((groupId, index, allGroupIds) => allGroupIds.indexOf(groupId) === index)

  const actorAdministrationIdsByHrGroup = new Map<string, Set<string>>()
  if (actorScopedGroupIds.length > 0) {
    const { data: actors, error: actorError } = await supabase
      .from('employees')
      .select('id, hr_group_id')
      .eq('auth_user_id', resolvedUserId)
      .in('hr_group_id', actorScopedGroupIds)
      .is('deleted_at', null)
      .limit(500)

    if (actorError) throw actorError

    const actorIds = actors.map((actor) => actor.id)
    if (actorIds.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const { data: employments, error: employmentError } = await supabase
        .from('employments')
        .select('hr_group_id, administration_id')
        .in('employee_id', actorIds)
        .in('hr_group_id', actorScopedGroupIds)
        .eq('record_status', 'CONFIRMED')
        .lte('starts_on', today)
        .or(`ends_on.is.null,ends_on.gte.${today}`)
        .is('deleted_at', null)
        .limit(1000)

      if (employmentError) throw employmentError

      for (const row of employments) {
        const administrationIds = actorAdministrationIdsByHrGroup.get(row.hr_group_id) ?? new Set<string>()
        administrationIds.add(row.administration_id)
        actorAdministrationIdsByHrGroup.set(row.hr_group_id, administrationIds)
      }
    }
  }

  const [{ data: tenants, error: tenantError }, { data: hrGroups, error: groupError }, { data: administrations, error: administrationError }] =
    await Promise.all([
      supabase
        .from('tenants')
        .select('id, name, slug, administration_mode, sharing_mode')
        .in('id', tenantIds)
        .eq('is_active', true)
        .order('name')
        .limit(100),
      supabase
        .from('hr_groups')
        .select('id, tenant_id, code, name, description, is_active')
        .in('tenant_id', tenantIds)
        .eq('is_active', true)
        .order('name')
        .limit(500),
      supabase
        .from('administrations')
        .select('id, tenant_id, hr_group_id, code, name, administration_number, is_active')
        .in('tenant_id', tenantIds)
        .eq('is_active', true)
        .order('name')
        .limit(1000),
    ])

  if (tenantError) throw tenantError
  if (groupError) throw groupError
  if (administrationError) throw administrationError

  const tenantOptions = buildTenantContextOptions({
    groupAccesses: contextGroupAccesses,
    administrationAccesses,
    tenants,
    hrGroups,
    administrations,
    actorAdministrationIdsByHrGroup,
  })
  const cookieStore = await cookies()

  return selectActiveContext({
    tenants: tenantOptions,
    requestedTenantId: cookieStore.get(ACTIVE_TENANT_COOKIE)?.value,
    requestedHrGroupId: cookieStore.get(ACTIVE_HR_GROUP_COOKIE)?.value,
    requestedAdministrationId: cookieStore.get(ACTIVE_ADMINISTRATION_COOKIE)?.value,
  })
}
