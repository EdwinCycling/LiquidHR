import { cookies } from 'next/headers'
import {
  buildTenantContextOptions,
  selectActiveContext,
  type ActiveContext,
} from '@/lib/context/administration-context'
import { createClient } from '@/lib/supabase/server'

export const ACTIVE_TENANT_COOKIE = 'liquid-hr-tenant'
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

  const { data: accesses, error: accessError } = await supabase
    .from('user_access')
    .select('tenant_id, scope_type, administration_id, management_role_id')
    .eq('user_id', resolvedUserId)
    .eq('is_active', true)
    .limit(100)

  if (accessError) throw accessError
  const tenantIds = [...new Set(accesses.map((access) => access.tenant_id))]

  if (tenantIds.length === 0) {
    return selectActiveContext({ tenants: [] })
  }

  const roleIds = [...new Set(accesses.map((access) => access.management_role_id))]
  const { data: roles, error: roleError } = await supabase
    .from('management_roles')
    .select('id, code')
    .in('id', roleIds)
    .limit(100)

  if (roleError) throw roleError

  const roleCodesById = new Map(roles.map((role) => [role.id, role.code]))
  const contextAccesses = accesses.map((access) => ({
    tenant_id: access.tenant_id,
    scope_type: access.scope_type,
    administration_id: access.administration_id,
    management_role_code: roleCodesById.get(access.management_role_id) ?? 'UNKNOWN',
  }))
  const actorScopedTenantIds = tenantIds.filter((tenantId) => {
    const tenantAccesses = contextAccesses.filter((access) => access.tenant_id === tenantId)
    return tenantAccesses.length > 0
      && tenantAccesses.every((access) => EMPLOYEE_MANAGER_ROLE_CODES.has(access.management_role_code))
  })

  const actorAdministrationIdsByTenant = new Map<string, Set<string>>()
  if (actorScopedTenantIds.length > 0) {
    const { data: actors, error: actorError } = await supabase
      .from('employees')
      .select('id, tenant_id')
      .eq('auth_user_id', resolvedUserId)
      .in('tenant_id', actorScopedTenantIds)
      .is('deleted_at', null)
      .limit(100)

    if (actorError) throw actorError

    const actorIds = actors.map((actor) => actor.id)
    if (actorIds.length > 0) {
      const today = new Date().toISOString().slice(0, 10)
      const [{ data: employments, error: employmentError }, { data: assignments, error: assignmentError }] = await Promise.all([
        supabase
          .from('employments')
          .select('tenant_id, administration_id')
          .in('employee_id', actorIds)
          .eq('record_status', 'CONFIRMED')
          .lte('starts_on', today)
          .or(`ends_on.is.null,ends_on.gte.${today}`)
          .is('deleted_at', null)
          .limit(500),
        supabase
          .from('department_management')
          .select('tenant_id, administration_id')
          .in('employee_id', actorIds)
          .lte('effective_from', today)
          .or(`effective_to.is.null,effective_to.gte.${today}`)
          .limit(500),
      ])

      if (employmentError) throw employmentError
      if (assignmentError) throw assignmentError

      for (const row of [...employments, ...assignments]) {
        const administrationIds = actorAdministrationIdsByTenant.get(row.tenant_id) ?? new Set<string>()
        administrationIds.add(row.administration_id)
        actorAdministrationIdsByTenant.set(row.tenant_id, administrationIds)
      }
    }
  }

  const [{ data: tenants, error: tenantError }, { data: administrations, error: administrationError }] =
    await Promise.all([
      supabase
        .from('tenants')
        .select('id, name, slug, administration_mode, sharing_mode')
        .in('id', tenantIds)
        .eq('is_active', true)
        .order('name')
        .limit(50),
      supabase
        .from('administrations')
        .select('id, tenant_id, code, name, is_active')
        .in('tenant_id', tenantIds)
        .eq('is_active', true)
        .order('name')
        .limit(200),
    ])

  if (tenantError) throw tenantError
  if (administrationError) throw administrationError

  const tenantOptions = buildTenantContextOptions({
    accesses: contextAccesses,
    actorAdministrationIdsByTenant,
    tenants,
    administrations,
  })
  const cookieStore = await cookies()

  return selectActiveContext({
    tenants: tenantOptions,
    requestedTenantId: cookieStore.get(ACTIVE_TENANT_COOKIE)?.value,
    requestedAdministrationId: cookieStore.get(ACTIVE_ADMINISTRATION_COOKIE)?.value,
  })
}
