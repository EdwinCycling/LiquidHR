import { NextResponse } from 'next/server'
import { cache } from 'react'
import { toSelfPermission } from '@/lib/auth/permission-rules'
import { ContextAccessError, type ActiveContext } from '@/lib/context/administration-context'
import { ContextAuthenticationError, loadActiveContext } from '@/lib/context/server-context'
import {
  isPreboardingAllowedSelfPermission,
  resolveEmploymentAccessState,
  resolveFocusExperience,
  type EmploymentTimelineEntry,
  type FocusExperience,
} from '@/lib/focus/access-state'
import { createClient } from '@/lib/supabase/server'
import { hasActiveFocusPreviewToken } from '@/lib/focus/preview-token'

export interface AuthContext {
  tenantId: string
  /** Wordt door requireAuthContext altijd gevuld; leesgereedschap hoeft geen groepsmutatie te kennen. */
  hrGroupId?: string
  administrationId: string | null
  userId: string
  employeeId: string | null
  activeRoles: string[]
  permissions: string[]
  focusExperience?: FocusExperience
  effectiveEmploymentStartDate?: string | null
  employeePortalMode?: ActiveContext['activeHrGroup']['employeePortalMode']
  managerPortalMode?: ActiveContext['activeHrGroup']['managerPortalMode']
}

export class AuthenticationError extends Error {
  readonly status = 401
}

export class AuthorizationError extends Error {
  readonly status = 403
}

export function requireHrGroupId(context: Pick<AuthContext, 'hrGroupId'>): string {
  if (!context.hrGroupId) throw new AuthorizationError('HR-groepcontext ontbreekt.')
  return context.hrGroupId
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

interface RequestAuthorizationContext {
  supabase: SupabaseServerClient
  context: AuthContext
  activeContext: ActiveContext
  email: unknown
}

// React cache is request-scoped during Server Component rendering. Keeping the
// client and resolved context together prevents each permission check in one
// render from repeating auth, active-context, role, and permission queries.
export interface RequestAuthorizationOptions {
  allowFocusPreview?: boolean
}

export const getRequestAuthorizationContext = cache(async (options: RequestAuthorizationOptions = {}): Promise<RequestAuthorizationContext> => {
  if (!options.allowFocusPreview && await hasActiveFocusPreviewToken()) {
    throw new AuthorizationError('Deze Focus-preview is alleen-lezen.')
  }
  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (claimsError || !userId) throw new AuthenticationError('Je bent niet ingelogd.')

  const activeContext = await loadActiveContext(userId, supabase)
  return {
    supabase,
    context: await resolveAuthContext(supabase, activeContext, userId),
    activeContext,
    email: claimsData.claims.email,
  }
})

export const getSelfPermissions = cache(async (supabase: SupabaseServerClient, tenantId: string): Promise<string[]> => {
  const { data: employeeRoles, error: employeeRoleError } = await supabase
    .from('management_roles')
    .select('id,tenant_id')
    .eq('code', 'EMPLOYEE')
    .eq('is_active', true)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)

  if (employeeRoleError) throw employeeRoleError
  const employeeRole = employeeRoles.find((role) => role.tenant_id === tenantId) ?? employeeRoles.find((role) => role.tenant_id === null)
  return employeeRole ? permissionCodesForRoleIds([employeeRole.id], supabase) : []
})

async function permissionCodesForRoleIds(roleIds: string[], supabase: SupabaseServerClient, tenantId?: string): Promise<string[]> {
  if (roleIds.length === 0) return []

  let effectiveRoleIds = roleIds
  if (tenantId) {
    const { data: assignedRoles, error: assignedRolesError } = await supabase.from('management_roles').select('id,code,tenant_id').in('id', roleIds)
    if (assignedRolesError) throw assignedRolesError
    const globalCodes = assignedRoles.filter((role) => role.tenant_id === null).map((role) => role.code)
    if (globalCodes.length > 0) {
      const { data: tenantOverrides, error: tenantOverridesError } = await supabase.from('management_roles').select('id,code')
        .eq('tenant_id', tenantId).eq('is_active', true).in('code', globalCodes)
      if (tenantOverridesError) throw tenantOverridesError
      const overrideByCode = new Map(tenantOverrides.map((role) => [role.code, role.id]))
      effectiveRoleIds = assignedRoles.map((role) => role.tenant_id === null ? overrideByCode.get(role.code) ?? role.id : role.id)
    }
  }

  const { data: rolePermissions, error: rolePermissionsError } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .in('management_role_id', effectiveRoleIds)

  if (rolePermissionsError) throw rolePermissionsError
  const permissionIds = rolePermissions.map((rolePermission) => rolePermission.permission_id)
  if (permissionIds.length === 0) return []

  const { data: permissions, error: permissionsError } = await supabase
    .from('permissions')
    .select('code')
    .in('id', permissionIds)

  if (permissionsError) throw permissionsError
  return permissions.map((permission) => permission.code)
}

async function roleCodesForRoleIds(roleIds: string[], supabase: SupabaseServerClient): Promise<string[]> {
  if (roleIds.length === 0) return []

  const { data: roles, error } = await supabase
    .from('management_roles')
    .select('code')
    .in('id', roleIds)

  if (error) throw error
  return roles.map((role) => role.code)
}

async function resolveAuthContext(supabase: SupabaseServerClient, activeContext: ActiveContext, userId: string): Promise<AuthContext> {
  const tenantId = activeContext.tenant.id
  const hrGroupId = activeContext.activeHrGroup.id
  const administrationId = activeContext.activeAdministration?.id ?? null

  const { data: accessRows, error: accessError } = await supabase
    .from('user_hr_group_access')
    .select('management_role_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('is_active', true)
    .limit(100)

  if (accessError) throw accessError

  const { data: initialActor, error: actorError } = await supabase
    .from('employees')
    .select('id, tenant_id')
    .eq('auth_user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .is('deleted_at', null)
    .maybeSingle()

  if (actorError) throw actorError
  const actor = initialActor

  const today = new Date().toISOString().slice(0, 10)
  let assignments: Array<{ management_role_id: string }> = []
  let actorEmployments: EmploymentTimelineEntry[] = []
  if (actor) {
    const [assignmentsResult, employmentsResult] = await Promise.all([
      supabase
        .from('department_management')
        .select('management_role_id')
        .eq('employee_id', actor.id)
        .eq('tenant_id', tenantId)
        .eq('hr_group_id', hrGroupId)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`),
      supabase
        .from('employments')
        .select('starts_on,ends_on,record_status,deleted_at')
        .eq('employee_id', actor.id)
        .eq('tenant_id', tenantId)
        .eq('hr_group_id', hrGroupId)
        .is('deleted_at', null)
        .order('starts_on', { ascending: true })
        .limit(100),
    ])

    if (assignmentsResult.error) throw assignmentsResult.error
    if (employmentsResult.error) throw employmentsResult.error
    assignments = assignmentsResult.data
    actorEmployments = employmentsResult.data.map((employment) => ({
      startsOn: employment.starts_on,
      endsOn: employment.ends_on,
      recordStatus: employment.record_status,
      deletedAt: employment.deleted_at,
    }))
  }

  const roleIds = [
    ...new Set([
      ...accessRows.map((access) => access.management_role_id),
      ...assignments.map((assignment) => assignment.management_role_id),
    ]),
  ]
  const [activeRoles, permissions] = await Promise.all([
    roleCodesForRoleIds(roleIds, supabase),
    permissionCodesForRoleIds(roleIds, supabase, tenantId),
  ])
  const accessState = resolveEmploymentAccessState(today, actorEmployments)

  return {
    tenantId,
    hrGroupId,
    administrationId,
    userId,
    employeeId: actor?.id ?? null,
    activeRoles,
    permissions,
    focusExperience: resolveFocusExperience(accessState, activeRoles),
    effectiveEmploymentStartDate: accessState.effectiveStartDate,
    employeePortalMode: activeContext.activeHrGroup.employeePortalMode,
    managerPortalMode: activeContext.activeHrGroup.managerPortalMode,
  }
}

async function assertEmployeeEssIsAvailable(
  supabase: SupabaseServerClient,
  context: AuthContext,
  permissionCode: string,
  targetEmployeeId?: string,
): Promise<void> {
  const isEmployeeSelfRequest = permissionCode.startsWith('self:')
    || (context.employeeId !== null && targetEmployeeId === context.employeeId)
  const isPrivilegedAdmin = context.activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN')
  if (!isEmployeeSelfRequest || isPrivilegedAdmin || !context.employeeId || !context.hrGroupId) return

  if (context.focusExperience === 'NO_EMPLOYMENT' && toSelfPermission(permissionCode) !== 'self:employee:read') {
    throw new AuthorizationError('Er is geen actief of toekomstig dienstverband voor Employee-selfservice.')
  }

  const { data, error } = await supabase
    .from('employee_ess_access')
    .select('status')
    .eq('employee_id', context.employeeId)
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', context.hrGroupId)
    .maybeSingle()
  if (error) throw error
  if (data?.status === 'BLOCKED') throw new AuthorizationError('Je Employee-toegang is geblokkeerd.')
}

export async function requireAuthContext(existingClient?: SupabaseServerClient, existingActiveContext?: ActiveContext): Promise<AuthContext> {
  if (!existingClient && !existingActiveContext) {
    return (await getRequestAuthorizationContext()).context
  }

  const supabase = existingClient ?? await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (claimsError || !userId) throw new AuthenticationError('Je bent niet ingelogd.')

  const activeContext = existingActiveContext ?? await loadActiveContext(userId, supabase)
  return resolveAuthContext(supabase, activeContext, userId)
}

export async function requirePermission(permissionCode: string, targetEmployeeId?: string): Promise<AuthContext> {
  const { supabase, context } = await getRequestAuthorizationContext()

  await assertEmployeeEssIsAvailable(supabase, context, permissionCode, targetEmployeeId)

  if (context.focusExperience === 'PREBOARDING') {
    const isOwnRequest = permissionCode.startsWith('self:')
      || (context.employeeId !== null && targetEmployeeId === context.employeeId)
    if (!isOwnRequest || !isPreboardingAllowedSelfPermission(toSelfPermission(permissionCode))) {
      throw new AuthorizationError('Deze actie is pas beschikbaar vanaf de eerste werkdag.')
    }
  }

  if (context.employeeId && targetEmployeeId === context.employeeId) {
    const selfPermissions = await getSelfPermissions(supabase, context.tenantId)
    if (!selfPermissions.includes(toSelfPermission(permissionCode))) {
      throw new AuthorizationError('Je hebt geen selfservice-recht voor deze actie.')
    }
  } else if (!context.permissions.includes(permissionCode)) {
    throw new AuthorizationError('Je hebt onvoldoende rechten voor deze actie.')
  }

  return context
}

export async function requireAnyPermission(permissionCodes: readonly string[], targetEmployeeId?: string): Promise<AuthContext> {
  const { supabase, context } = await getRequestAuthorizationContext()

  for (const permissionCode of permissionCodes) {
    await assertEmployeeEssIsAvailable(supabase, context, permissionCode, targetEmployeeId)
  }

  if (context.focusExperience === 'PREBOARDING') {
    const isOwnRequest = context.employeeId !== null && targetEmployeeId === context.employeeId
    const allowed = permissionCodes.some((permissionCode) =>
      (permissionCode.startsWith('self:') || isOwnRequest)
      && isPreboardingAllowedSelfPermission(toSelfPermission(permissionCode)),
    )
    if (!allowed) throw new AuthorizationError('Deze actie is pas beschikbaar vanaf de eerste werkdag.')
  }

  const isSelf = context.employeeId !== null && targetEmployeeId === context.employeeId
  const availablePermissions = isSelf
    ? await getSelfPermissions(supabase, context.tenantId)
    : context.permissions
  const allowed = permissionCodes.some((permissionCode) => availablePermissions.includes(isSelf ? toSelfPermission(permissionCode) : permissionCode))

  if (!allowed) throw new AuthorizationError('Je hebt onvoldoende rechten voor deze actie.')
  return context
}

export function permissionErrorResponse(error: unknown): NextResponse | null {
  if (
    error instanceof AuthenticationError
    || error instanceof AuthorizationError
    || error instanceof ContextAuthenticationError
    || error instanceof ContextAccessError
  ) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  return null
}
