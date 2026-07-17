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
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { data, error } = await supabase.from('departments').insert({
    tenant_id: context.tenantId, administration_id: adminId, code: input.code.toUpperCase(),
    name: input.name, description: input.description ?? null, parent_id: input.parentId ?? null,
  }).select('id').single()
  if (conflict(error)) throw new OrganizationServiceError('DEPARTMENT_CONFLICT', 409)
  if (error || !data) throw new OrganizationServiceError('DEPARTMENT_CREATE_FAILED', 500)
  return data.id
}

export async function updateDepartment(id: string, input: DepartmentUpdateInput): Promise<void> {
  const context = await requirePermission('department:write')
  const adminId = administrationId(context.administrationId)
  const supabase = await createClient()
  const { error } = await supabase.from('departments').update({
    name: input.name, description: input.description, parent_id: input.parentId, is_active: input.isActive,
  }).eq('tenant_id', context.tenantId).eq('administration_id', adminId).eq('id', id)
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
  return { roles: roles.data, permissions: permissions.data, rolePermissions: rolePermissions.data }
}

export async function createRole(input: RoleCreateInput): Promise<string> {
  const context = await requirePermission('authorization:write')
  const supabase = await createClient()
  const { data, error } = await supabase.from('management_roles').insert({
    tenant_id: context.tenantId, code: input.code, name: input.name,
    description: input.description ?? null, deputy_role_id: input.deputyRoleId ?? null, is_system: false,
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
    is_active: input.isActive, deleted_at: input.isActive === false ? new Date().toISOString() : undefined,
  }).eq('tenant_id', context.tenantId).eq('id', id).eq('is_system', false)
  if (error) throw new OrganizationServiceError('ROLE_UPDATE_FAILED', 500)
}

export async function setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
  const context = await requirePermission('authorization:write')
  const supabase = await createClient()
  const { data: role, error: roleError } = await supabase.from('management_roles')
    .select('id').eq('id', roleId).eq('tenant_id', context.tenantId).eq('is_system', false).maybeSingle()
  if (roleError || !role) throw new OrganizationServiceError('ROLE_NOT_EDITABLE', 404)
  const { error: deleteError } = await supabase.from('role_permissions').delete().eq('management_role_id', roleId)
  if (deleteError) throw new OrganizationServiceError('ROLE_PERMISSIONS_WRITE_FAILED', 500)
  if (permissionIds.length > 0) {
    const { error } = await supabase.from('role_permissions').insert(permissionIds.map((permissionId) => ({ management_role_id: roleId, permission_id: permissionId })))
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
    tenant_id: context.tenantId, administration_id: adminId, department_id: input.departmentId,
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
