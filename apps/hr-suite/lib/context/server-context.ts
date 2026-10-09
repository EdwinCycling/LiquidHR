import { cookies } from 'next/headers'
import {
  buildTenantContextOptions,
  selectActiveContext,
  type ActiveContext,
  type TenantContextOption,
} from '@/lib/context/administration-context'
import type { PortalMode } from '@/lib/context/administration-context'
import { createClient } from '@/lib/supabase/server'

export const ACTIVE_TENANT_COOKIE = 'liquid-hr-tenant'
export const ACTIVE_HR_GROUP_COOKIE = 'liquid-hr-hr-group'
export const ACTIVE_ADMINISTRATION_COOKIE = 'liquid-hr-administration'

export class ContextAuthenticationError extends Error {
  readonly status = 401
}

const EMPLOYEE_MANAGER_ROLE_CODES = new Set(['EMPLOYEE', 'DIRECT_MANAGER'])

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface AccessibleContextOptions {
  supabase: SupabaseServerClient
  userId: string
  tenants: TenantContextOption[]
}

export interface LoadAccessibleContextOptions {
  /** Include confirmed future employments for flows that explicitly allow preboarding. */
  includeFutureEmployment?: boolean
  /** Refuse a context assembled from any query result that may have hit its safety limit. */
  requireComplete?: boolean
}

function assertCompleteResult(enabled: boolean, table: string, rows: readonly unknown[], limit: number): void {
  if (enabled && rows.length >= limit) {
    throw new Error(`The ${table} result reached its context safety limit.`)
  }
}

export async function loadAccessibleContextOptions(
  userId?: string,
  existingClient?: SupabaseServerClient,
  options: LoadAccessibleContextOptions = {},
): Promise<AccessibleContextOptions> {
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
  assertCompleteResult(options.requireComplete === true, 'user_hr_group_access', groupAccesses, 500)
  assertCompleteResult(options.requireComplete === true, 'user_access', administrationAccesses, 500)

  const tenantIds = [...new Set(groupAccesses.map((access) => access.tenant_id))]
  if (tenantIds.length === 0) return { supabase, userId: resolvedUserId, tenants: [] }

  const roleIds = [...new Set(groupAccesses.map((access) => access.management_role_id))]
  const { data: roles, error: roleError } = await supabase
    .from('management_roles')
    .select('id, code')
    .in('id', roleIds)
    .limit(500)

  if (roleError) throw roleError
  assertCompleteResult(options.requireComplete === true, 'management_roles', roles, 500)

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
    assertCompleteResult(options.requireComplete === true, 'employees', actors, 500)

    const actorIds = actors.map((actor) => actor.id)
    if (actorIds.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      let employmentQuery = supabase
        .from('employments')
        .select('hr_group_id, administration_id')
        .in('employee_id', actorIds)
        .in('hr_group_id', actorScopedGroupIds)
        .eq('record_status', 'CONFIRMED')
        .or(`ends_on.is.null,ends_on.gte.${today}`)
        .is('deleted_at', null)
      if (options.includeFutureEmployment !== true) {
        employmentQuery = employmentQuery.lte('starts_on', today)
      }
      const { data: employments, error: employmentError } = await employmentQuery.limit(1000)

      if (employmentError) throw employmentError
      assertCompleteResult(options.requireComplete === true, 'employments', employments, 1000)

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
        .select('id, tenant_id, code, name, description, is_active, employee_portal_mode, manager_portal_mode')
        .in('tenant_id', tenantIds)
        .eq('is_active', true)
        .order('name')
        .limit(500),
      supabase
        .from('administrations')
        .select('id, tenant_id, hr_group_id, code, name, administration_number, coc_number, vat_number, parent_id, is_active')
        .in('tenant_id', tenantIds)
        .eq('is_active', true)
        .order('name')
        .limit(1000),
    ])

  if (tenantError) throw tenantError
  if (groupError) throw groupError
  if (administrationError) throw administrationError
  assertCompleteResult(options.requireComplete === true, 'tenants', tenants, 100)
  assertCompleteResult(options.requireComplete === true, 'hr_groups', hrGroups, 500)
  assertCompleteResult(options.requireComplete === true, 'administrations', administrations, 1000)

  const normalizedHrGroups = hrGroups.map((group) => ({
    ...group,
    employee_portal_mode: group.employee_portal_mode === 'FOCUS_ONLY' || group.employee_portal_mode === 'FOCUS_AND_FULL'
      ? group.employee_portal_mode as PortalMode
      : undefined,
    manager_portal_mode: group.manager_portal_mode === 'FOCUS_ONLY' || group.manager_portal_mode === 'FOCUS_AND_FULL'
      ? group.manager_portal_mode as PortalMode
      : undefined,
  }))
  const tenantOptions = buildTenantContextOptions({
    groupAccesses: contextGroupAccesses,
    administrationAccesses,
    tenants,
    hrGroups: normalizedHrGroups,
    administrations,
    actorAdministrationIdsByHrGroup,
  })
  return { supabase, userId: resolvedUserId, tenants: tenantOptions }
}

export async function loadActiveContext(userId?: string, existingClient?: SupabaseServerClient): Promise<ActiveContext> {
  const { tenants } = await loadAccessibleContextOptions(userId, existingClient)
  const cookieStore = await cookies()

  return selectActiveContext({
    tenants,
    requestedTenantId: cookieStore.get(ACTIVE_TENANT_COOKIE)?.value,
    requestedHrGroupId: cookieStore.get(ACTIVE_HR_GROUP_COOKIE)?.value,
    requestedAdministrationId: cookieStore.get(ACTIVE_ADMINISTRATION_COOKIE)?.value,
  })
}
