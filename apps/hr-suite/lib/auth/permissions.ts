import { NextResponse } from 'next/server'
import { toSelfPermission } from '@/lib/auth/permission-rules'
import { ContextAccessError } from '@/lib/context/administration-context'
import { ContextAuthenticationError, loadActiveContext } from '@/lib/context/server-context'
import { createClient } from '@/lib/supabase/server'

export interface AuthContext {
  tenantId: string
  administrationId: string | null
  userId: string
  employeeId: string | null
  activeRoles: string[]
  permissions: string[]
}

export class AuthenticationError extends Error {
  readonly status = 401
}

export class AuthorizationError extends Error {
  readonly status = 403
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function permissionCodesForRoleIds(roleIds: string[], supabase: SupabaseServerClient): Promise<string[]> {
  if (roleIds.length === 0) return []

  const { data: rolePermissions, error: rolePermissionsError } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .in('management_role_id', roleIds)

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

export async function requireAuthContext(existingClient?: SupabaseServerClient): Promise<AuthContext> {
  const supabase = existingClient ?? await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub

  if (claimsError || !userId) throw new AuthenticationError('Je bent niet ingelogd.')

  const activeContext = await loadActiveContext(userId, supabase)
  const tenantId = activeContext.tenant.id
  const administrationId = activeContext.administration?.id ?? null

  const { data: accessRows, error: accessError } = await supabase
    .from('user_access')
    .select('management_role_id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .limit(100)

  if (accessError) throw accessError

  const { data: initialActor, error: actorError } = await supabase
    .from('employees')
    .select('id, tenant_id')
    .eq('auth_user_id', userId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (actorError) throw actorError
  const actor = initialActor

  const today = new Date().toISOString().slice(0, 10)
  let assignments: Array<{ management_role_id: string }> = []
  if (actor) {
    let assignmentsQuery = supabase
      .from('department_management')
      .select('management_role_id')
      .eq('employee_id', actor.id)
      .eq('tenant_id', tenantId)

    if (administrationId) {
      assignmentsQuery = assignmentsQuery.eq('administration_id', administrationId)
    }

    const { data, error } = await assignmentsQuery
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)

    if (error) throw error
    assignments = data
  }

  const roleIds = [
    ...new Set([
      ...accessRows.map((access) => access.management_role_id),
      ...assignments.map((assignment) => assignment.management_role_id),
    ]),
  ]
  const [activeRoles, permissions] = await Promise.all([
    roleCodesForRoleIds(roleIds, supabase),
    permissionCodesForRoleIds(roleIds, supabase),
  ])

  return {
    tenantId,
    administrationId,
    userId,
    employeeId: actor?.id ?? null,
    activeRoles,
    permissions,
  }
}

export async function requirePermission(permissionCode: string, targetEmployeeId?: string): Promise<AuthContext> {
  const supabase = await createClient()
  const context = await requireAuthContext(supabase)

  if (context.employeeId && targetEmployeeId === context.employeeId) {
    const { data: employeeRole, error: employeeRoleError } = await supabase
      .from('management_roles')
      .select('id')
      .eq('code', 'EMPLOYEE')
      .is('tenant_id', null)
      .maybeSingle()

    if (employeeRoleError) throw employeeRoleError
    const selfPermissions = employeeRole ? await permissionCodesForRoleIds([employeeRole.id], supabase) : []
    if (!selfPermissions.includes(toSelfPermission(permissionCode))) {
      throw new AuthorizationError('Je hebt geen selfservice-recht voor deze actie.')
    }
  } else if (!context.permissions.includes(permissionCode)) {
    throw new AuthorizationError('Je hebt onvoldoende rechten voor deze actie.')
  }

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
