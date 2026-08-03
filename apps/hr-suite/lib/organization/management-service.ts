import type { Database } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type {
  DepartmentCreateInput, DepartmentUpdateInput, ManagementAssignmentCreateInput,
  ManagementAssignmentUpdateInput, PlacementCreateInput, PlacementUpdateInput,
  RoleCreateInput, RoleUpdateInput,
} from './schemas'

export class OrganizationServiceError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code) }
}

function administrationId(value: string | null): string {
  if (!value) throw new OrganizationServiceError('ADMINISTRATION_REQUIRED', 400)
  return value
}
function conflict(error: { code?: string } | null): boolean { return error?.code === '23505' || error?.code === '23P01' }

export async function createDepartment(input: DepartmentCreateInput): Promise<string> {
  const context = await requirePermission('department:write')
  const supabase = await createClient()
  const { data, error } = await supabase.from('departments').insert({
    tenant_id: context.tenantId, administration_id: null, scope_type: 'TENANT', code: input.code.toUpperCase(),
    name: input.name, description: input.description ?? null, parent_id: input.parentId ?? null,
  }).select('id').single()
  if (conflict(error)) throw new OrganizationServiceError('DEPARTMENT_CONFLICT', 409)
  if (error || !data) throw new OrganizationServiceError('DEPARTMENT_CREATE_FAILED', 500)
  return data.id
}

export async function updateDepartment(id: string, input: DepartmentUpdateInput): Promise<void> {
  const context = await requirePermission('department:write')
  const supabase = await createClient()
  const { error } = await supabase.from('departments').update({
    name: input.name, description: input.description, parent_id: input.parentId, is_active: input.isActive,
  }).eq('tenant_id', context.tenantId).eq('id', id)
  if (error) throw new OrganizationServiceError('DEPARTMENT_UPDATE_FAILED', 500)
}

export async function listAuthorizationMatrix(): Promise<{
  roles: Database['public']['Tables']['management_roles']['Row'][]
  permissions: Database['public']['Tables']['permissions']['Row'][]
  rolePermissions: Database['public']['Tables']['role_permissions']['Row'][]
}> {
  const context = await requirePermission('authorization:read')
  const supabase = await createClient()
  const [roles, permissions, rolePermissions] = await Promise.all([
    supabase.from('management_roles').select('*').or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`).is('deleted_at', null).order('is_system', { ascending: false }).order('name').limit(250),
    supabase.from('permissions').select('*').order('category').order('code').limit(500),
    supabase.from('role_permissions').select('*').limit(5000),
  ])
  if (roles.error || permissions.error || rolePermissions.error) throw new OrganizationServiceError('AUTHORIZATION_READ_FAILED', 500)
  const globalRolesByCode = new Map(roles.data.filter((role) => role.tenant_id === null && role.is_system).map((role) => [role.code, role]))
  const tenantOverrides = roles.data.filter((role) => role.tenant_id === context.tenantId && globalRolesByCode.has(role.code))
  const visibleRoles = roles.data.filter((role) => !tenantOverrides.some((override) => override.id === role.id))
  const overriddenGlobalIds = new Set(tenantOverrides.map((override) => globalRolesByCode.get(override.code)?.id).filter((id): id is string => Boolean(id)))
  const overrideToGlobalId = new Map(tenantOverrides.map((override) => [override.id, globalRolesByCode.get(override.code)?.id]).filter((entry): entry is [string, string] => Boolean(entry[1])))
  const visibleRolePermissions = rolePermissions.data
    .filter((item) => !overriddenGlobalIds.has(item.management_role_id))
    .map((item) => overrideToGlobalId.has(item.management_role_id) ? { ...item, management_role_id: overrideToGlobalId.get(item.management_role_id) as string } : item)
  return { roles: visibleRoles, permissions: permissions.data, rolePermissions: visibleRolePermissions }
}

export async function createRole(input: RoleCreateInput): Promise<string> {
  const context = await requirePermission('authorization:write')
  const supabase = await createClient()
  const { data, error } = await supabase.from('management_roles').insert({
    tenant_id: context.tenantId, code: input.code, name: input.name,
    description: input.description ?? null, deputy_role_id: input.deputyRoleId ?? null, is_organization_scoped: input.isOrganizationScoped, is_system: false,
  }).select('id').single()
  if (conflict(error)) throw new OrganizationServiceError('ROLE_CODE_CONFLICT', 409)
  if (error || !data) throw new OrganizationServiceError('ROLE_CREATE_FAILED', 500)
  return data.id
}

export async function updateRole(id: string, input: RoleUpdateInput): Promise<void> {
  const context = await requirePermission('authorization:write')
  const supabase = await createClient()
  const { error } = await supabase.from('management_roles').update({
    name: input.name, description: input.description, deputy_role_id: input.deputyRoleId,
    is_organization_scoped: input.isOrganizationScoped, is_active: input.isActive, deleted_at: input.isActive === false ? new Date().toISOString() : undefined,
  }).eq('tenant_id', context.tenantId).eq('id', id).eq('is_system', false)
  if (error) throw new OrganizationServiceError('ROLE_UPDATE_FAILED', 500)
}

export async function setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
  const context = await requirePermission('authorization:write')
  const supabase = await createClient()
  const { data: requestedRole, error: requestedRoleError } = await supabase.from('management_roles')
    .select('id,code,name,description,is_organization_scoped,tenant_id,is_system').eq('id', roleId).maybeSingle()
  if (requestedRoleError || !requestedRole) throw new OrganizationServiceError('ROLE_NOT_EDITABLE', 404)
  let editableRoleId = requestedRole.id
  let effectiveRoleIdBeforeChange = requestedRole.id
  if (requestedRole.tenant_id === null && requestedRole.is_system) {
    const { data: existingTenantRole, error: existingTenantRoleError } = await supabase.from('management_roles')
      .select('id').eq('tenant_id', context.tenantId).eq('code', requestedRole.code).maybeSingle()
    if (existingTenantRoleError) throw new OrganizationServiceError('ROLE_PERMISSIONS_WRITE_FAILED', 500)
    if (existingTenantRole) {
      editableRoleId = existingTenantRole.id
      effectiveRoleIdBeforeChange = existingTenantRole.id
    }
    else {
      const { data: globalRolePermissions, error: globalRolePermissionsError } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('management_role_id', requestedRole.id)
      if (globalRolePermissionsError) throw new OrganizationServiceError('ROLE_PERMISSIONS_WRITE_FAILED', 500)
      const guardPermissionIds = [...new Set([...permissionIds, ...globalRolePermissions.map((permission) => permission.permission_id)])]
      const { data: guardPermissions, error: guardPermissionsError } = guardPermissionIds.length > 0
        ? await supabase.from('permissions').select('id,code').in('id', guardPermissionIds)
        : { data: [], error: null }
      if (guardPermissionsError) throw new OrganizationServiceError('ROLE_PERMISSIONS_WRITE_FAILED', 500)
      const guardCodeByPermissionId = new Map(guardPermissions.map((permission) => [permission.id, permission.code]))
      const requestedPermissionCodes = new Set(permissionIds.map((permissionId) => guardCodeByPermissionId.get(permissionId)))
      const removesOwnAuthorization = ['authorization:read', 'authorization:write'].some((code) =>
        context.activeRoles.includes(requestedRole.code)
        && context.permissions.includes(code)
        && globalRolePermissions.some((permission) => guardCodeByPermissionId.get(permission.permission_id) === code)
        && !requestedPermissionCodes.has(code),
      )
      if (removesOwnAuthorization) throw new OrganizationServiceError('SELF_AUTHORIZATION_LOCKOUT', 409)
      const { data: tenantRole, error: tenantRoleError } = await supabase.from('management_roles').insert({
        tenant_id: context.tenantId, code: requestedRole.code, name: requestedRole.name, description: requestedRole.description,
        is_organization_scoped: requestedRole.is_organization_scoped, is_system: false, is_active: true,
      }).select('id').single()
      if (tenantRoleError || !tenantRole) throw new OrganizationServiceError('ROLE_PERMISSIONS_WRITE_FAILED', 500)
      editableRoleId = tenantRole.id
    }
  }
  const { data: currentRolePermissions, error: currentRolePermissionsError } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('management_role_id', effectiveRoleIdBeforeChange)
  if (currentRolePermissionsError) throw new OrganizationServiceError('ROLE_PERMISSIONS_WRITE_FAILED', 500)

  const permissionIdsForGuard = [...new Set([
    ...permissionIds,
    ...currentRolePermissions.map((permission) => permission.permission_id),
  ])]
  const { data: permissionCodes, error: permissionCodesError } = permissionIdsForGuard.length > 0
    ? await supabase.from('permissions').select('id,code').in('id', permissionIdsForGuard)
    : { data: [], error: null }
  if (permissionCodesError) throw new OrganizationServiceError('ROLE_PERMISSIONS_WRITE_FAILED', 500)

  const codeByPermissionId = new Map(permissionCodes.map((permission) => [permission.id, permission.code]))
  const retainedAuthorizationPermissions = ['authorization:read', 'authorization:write'].filter((code) =>
    context.activeRoles.includes(requestedRole.code)
    && context.permissions.includes(code)
    && currentRolePermissions.some((permission) => codeByPermissionId.get(permission.permission_id) === code),
  )
  const requestedPermissionCodes = new Set(permissionIds.map((permissionId) => codeByPermissionId.get(permissionId)))
  if (retainedAuthorizationPermissions.some((code) => !requestedPermissionCodes.has(code))) {
    throw new OrganizationServiceError('SELF_AUTHORIZATION_LOCKOUT', 409)
  }
  const { data: role, error: roleError } = await supabase.from('management_roles')
    .select('id').eq('id', editableRoleId).eq('tenant_id', context.tenantId).eq('is_system', false).maybeSingle()
  if (roleError || !role) throw new OrganizationServiceError('ROLE_NOT_EDITABLE', 404)
  const { error: deleteError } = await supabase.from('role_permissions').delete().eq('management_role_id', editableRoleId)
  if (deleteError) throw new OrganizationServiceError('ROLE_PERMISSIONS_WRITE_FAILED', 500)
  if (permissionIds.length > 0) {
    const { error } = await supabase.from('role_permissions').insert(permissionIds.map((permissionId) => ({ management_role_id: editableRoleId, permission_id: permissionId })))
    if (error) throw new OrganizationServiceError('ROLE_PERMISSIONS_WRITE_FAILED', 500)
  }
}

export async function listOrganizationAssignments(): Promise<{
  placements: Database['public']['Tables']['employee_organizations']['Row'][]
  managementAssignments: Database['public']['Tables']['department_management']['Row'][]
}> {
  const context = await requirePermission('organization-placement:read')
  const adminId = administrationId(context.administrationId)
  await requirePermission('management-assignment:read')
  const supabase = await createClient()
  const [placements, assignments] = await Promise.all([
    supabase.from('employee_organizations').select('*').eq('tenant_id', context.tenantId).eq('administration_id', adminId).order('effective_from', { ascending: false }).limit(1000),
    supabase.from('department_management').select('*').eq('tenant_id', context.tenantId).eq('administration_id', adminId).order('effective_from', { ascending: false }).limit(1000),
  ])
  if (placements.error || assignments.error) throw new OrganizationServiceError('ORGANIZATION_ASSIGNMENTS_READ_FAILED', 500)
  return { placements: placements.data, managementAssignments: assignments.data }
}

export async function listRoleAssignments(): Promise<{
  roles: Database['public']['Tables']['management_roles']['Row'][]
  assignments: Database['public']['Tables']['department_management']['Row'][]
  employees: Array<{ id: string; name: string; employeeNumber: string; jobTitle: string | null; departmentName: string | null }>
  departments: Array<{ id: string; name: string; code: string }>
  placementDepartments: Array<{ employeeId: string; departmentId: string }>
}> {
  const context = await requirePermission('management-assignment:read')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [roles, assignments, employees, departments, placements] = await Promise.all([
    supabase.from('management_roles').select('*').or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`).eq('is_active', true).is('deleted_at', null).order('name').limit(250),
    supabase.from('department_management').select('*').eq('tenant_id', context.tenantId).eq('administration_id', adminId).order('effective_from', { ascending: false }).limit(1000),
    supabase.from('employees').select('id,first_name,birth_name,employee_number').eq('tenant_id', context.tenantId).eq('is_archived', false).is('deleted_at', null).order('birth_name').limit(1000),
    supabase.from('departments').select('id,name,code').eq('tenant_id', context.tenantId).eq('is_active', true).order('name').limit(500),
    supabase.from('employee_organizations').select('employee_id,department_id,job_title,effective_from').eq('tenant_id', context.tenantId).eq('administration_id', adminId).lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).order('effective_from', { ascending: false }).limit(2000),
  ])
  if (roles.error || assignments.error || employees.error || departments.error || placements.error) throw new OrganizationServiceError('ROLE_ASSIGNMENTS_READ_FAILED', 500)
  const departmentById = new Map(departments.data.map((department) => [department.id, department.name]))
  const placementByEmployee = new Map<string, (typeof placements.data)[number]>()
  for (const placement of placements.data) {
    if (!placementByEmployee.has(placement.employee_id)) placementByEmployee.set(placement.employee_id, placement)
  }
  return {
    roles: roles.data.filter((role) => !(role.tenant_id === context.tenantId && ['TENANT_ADMIN', 'DIRECT_MANAGER', 'EMPLOYEE'].includes(role.code))),
    assignments: assignments.data,
    employees: employees.data.map((employee) => {
      const placement = placementByEmployee.get(employee.id)
      return { id: employee.id, employeeNumber: employee.employee_number, name: `${employee.first_name} ${employee.birth_name}`, jobTitle: placement?.job_title ?? null, departmentName: placement ? departmentById.get(placement.department_id) ?? null : null }
    }),
    departments: departments.data,
    placementDepartments: placements.data.map((placement) => ({ employeeId: placement.employee_id, departmentId: placement.department_id })),
  }
}

export async function listEmployeeRoleAssignments(employeeId: string): Promise<Array<{
  id: string
  roleName: string
  roleCode: string
  departmentName: string | null
  effectiveFrom: string
  effectiveTo: string | null
}>> {
  const context = await requirePermission('employee:read', employeeId)
  const supabase = await createClient()
  const { data: assignments, error: assignmentError } = await supabase.from('department_management')
    .select('id,management_role_id,department_id,effective_from,effective_to')
    .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).order('effective_from', { ascending: false }).limit(100)
  if (assignmentError) throw new OrganizationServiceError('EMPLOYEE_ROLE_ASSIGNMENTS_READ_FAILED', 500)
  const roleIds = [...new Set((assignments ?? []).map((assignment) => assignment.management_role_id))]
  const departmentIds = [...new Set((assignments ?? []).flatMap((assignment) => assignment.department_id ? [assignment.department_id] : []))]
  const [{ data: roles, error: roleError }, { data: departments, error: departmentError }] = await Promise.all([
    roleIds.length ? supabase.from('management_roles').select('id,name,code').in('id', roleIds) : Promise.resolve({ data: [], error: null }),
    departmentIds.length ? supabase.from('departments').select('id,name').eq('tenant_id', context.tenantId).in('id', departmentIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (roleError || departmentError) throw new OrganizationServiceError('EMPLOYEE_ROLE_ASSIGNMENTS_READ_FAILED', 500)
  const roleById = new Map((roles ?? []).map((role) => [role.id, role]))
  const departmentById = new Map((departments ?? []).map((department) => [department.id, department.name]))
  return (assignments ?? []).flatMap((assignment) => {
    const role = roleById.get(assignment.management_role_id)
    return role ? [{ id: assignment.id, roleName: role.name, roleCode: role.code, departmentName: assignment.department_id ? departmentById.get(assignment.department_id) ?? null : null, effectiveFrom: assignment.effective_from, effectiveTo: assignment.effective_to }] : []
  })
}

export async function deleteManagementAssignment(id: string): Promise<void> {
  const context = await requirePermission('management-assignment:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { error } = await supabase.from('department_management').delete()
    .eq('id', id).eq('tenant_id', context.tenantId).eq('administration_id', adminId)
  if (error) throw new OrganizationServiceError('ROLE_ASSIGNMENT_DELETE_FAILED', 500)
}

export async function createPlacement(input: PlacementCreateInput): Promise<string> {
  const context = await requirePermission('organization-placement:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_organizations').insert({
    tenant_id: context.tenantId, administration_id: adminId, employee_id: input.employeeId,
    employment_id: input.employmentId ?? null, department_id: input.departmentId,
    direct_manager_id: input.directManagerId ?? null, direct_manager_deputy_id: input.directManagerDeputyId ?? null,
    job_title: input.jobTitle ?? null, cost_bearer: input.costBearer ?? null,
    effective_from: input.effectiveFrom, effective_to: input.effectiveTo ?? null,
  }).select('id').single()
  if (conflict(error)) throw new OrganizationServiceError('PLACEMENT_PERIOD_CONFLICT', 409)
  if (error || !data) throw new OrganizationServiceError('PLACEMENT_CREATE_FAILED', 500)
  return data.id
}

export async function updatePlacement(
  id: string,
  input: PlacementUpdateInput,
  expectedUpdatedAt?: string,
): Promise<void> {
  const context = await requirePermission('organization-placement:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  let query = supabase.from('employee_organizations').update({
    employment_id: input.employmentId, department_id: input.departmentId,
    direct_manager_id: input.directManagerId, direct_manager_deputy_id: input.directManagerDeputyId,
    job_title: input.jobTitle, cost_bearer: input.costBearer,
    effective_from: input.effectiveFrom, effective_to: input.effectiveTo,
  }).eq('tenant_id', context.tenantId).eq('administration_id', adminId).eq('id', id)
  if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt)
  const { data, error } = await query.select('id').maybeSingle()
  if (conflict(error)) throw new OrganizationServiceError('PLACEMENT_PERIOD_CONFLICT', 409)
  if (error) throw new OrganizationServiceError('PLACEMENT_UPDATE_FAILED', 500)
  if (!data) throw new OrganizationServiceError(expectedUpdatedAt ? 'PLACEMENT_STALE_WRITE' : 'PLACEMENT_NOT_FOUND', 409)
}

export async function createManagementAssignment(input: ManagementAssignmentCreateInput): Promise<string> {
  const context = await requirePermission('management-assignment:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('department_management').insert({
    tenant_id: context.tenantId, administration_id: adminId, department_id: input.departmentId ?? null,
    management_role_id: input.managementRoleId, employee_id: input.employeeId,
    effective_from: input.effectiveFrom, effective_to: input.effectiveTo ?? null,
  }).select('id').single()
  if (conflict(error)) throw new OrganizationServiceError('MANAGEMENT_ASSIGNMENT_PERIOD_CONFLICT', 409)
  if (error || !data) throw new OrganizationServiceError('MANAGEMENT_ASSIGNMENT_CREATE_FAILED', 500)
  return data.id
}

export async function updateManagementAssignment(id: string, input: ManagementAssignmentUpdateInput): Promise<void> {
  const context = await requirePermission('management-assignment:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { error } = await supabase.from('department_management').update({
    effective_from: input.effectiveFrom, effective_to: input.effectiveTo,
  }).eq('tenant_id', context.tenantId).eq('administration_id', adminId).eq('id', id)
  if (conflict(error)) throw new OrganizationServiceError('MANAGEMENT_ASSIGNMENT_PERIOD_CONFLICT', 409)
  if (error) throw new OrganizationServiceError('MANAGEMENT_ASSIGNMENT_UPDATE_FAILED', 500)
}
