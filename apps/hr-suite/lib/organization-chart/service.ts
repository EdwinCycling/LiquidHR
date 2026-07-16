import type { Json } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { projectOrganizationChart } from './projector'
import type { OrganizationChartQuery } from './schemas'
import type { OrganizationChartGraph } from './types'

export class OrganizationChartError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'OrganizationChartError'
  }
}

function displayValue(value: Json): string {
  if (value === null) return ''
  if (Array.isArray(value)) return value.map(String).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export async function getOrganizationChart(query: OrganizationChartQuery): Promise<OrganizationChartGraph> {
  const context = await requirePermission('organization-chart:read')
  await Promise.all([
    requirePermission('department:read'), requirePermission('organization-placement:read'),
    requirePermission('management-assignment:read'), requirePermission('employee:read'),
  ])
  if (!context.administrationId) throw new OrganizationChartError('ADMINISTRATION_REQUIRED', 400)

  const supabase = await createClient()
  const scope = { tenantId: context.tenantId, administrationId: context.administrationId }
  const [administrationResult, departmentsResult, placementsResult, managementResult, rolesResult, definitionsResult, employeesResult] = await Promise.all([
    supabase.from('administrations').select('id, code, name').eq('tenant_id', scope.tenantId).eq('id', scope.administrationId).maybeSingle(),
    supabase.from('departments').select('id, parent_id, code, name').eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId).eq('is_active', true).order('code').limit(500),
    supabase.from('employee_organizations').select('id, employee_id, employment_id, department_id, job_title, effective_from, effective_to').eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId).lte('effective_from', query.date).or(`effective_to.is.null,effective_to.gte.${query.date}`).limit(5000),
    supabase.from('department_management').select('id, department_id, employee_id, management_role_id, effective_from, effective_to').eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId).lte('effective_from', query.date).or(`effective_to.is.null,effective_to.gte.${query.date}`).limit(5000),
    supabase.from('management_roles').select('id, code, name').or(`tenant_id.is.null,tenant_id.eq.${scope.tenantId}`).eq('is_active', true).is('deleted_at', null).limit(500),
    supabase.from('custom_field_definitions').select('id, key, label_nl, field_type').eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId).eq('entity_type', 'EMPLOYEE').eq('is_active', true).is('deleted_at', null).eq('show_in_organization_chart_filter', true).order('sort_order').limit(500),
    supabase.from('employees').select('id, first_name, birth_name, avatar_url').eq('tenant_id', scope.tenantId).eq('is_active', true).is('deleted_at', null).limit(5000),
  ])

  const failures = [administrationResult, departmentsResult, placementsResult, managementResult, rolesResult, definitionsResult, employeesResult]
  if (failures.some((result) => result.error)) throw new OrganizationChartError('ORGANIZATION_CHART_READ_FAILED', 500)
  if (!administrationResult.data) throw new OrganizationChartError('ADMINISTRATION_NOT_FOUND', 404)

  const definitionIds = (definitionsResult.data ?? []).map((definition) => definition.id)
  const valuesResult = definitionIds.length > 0
    ? await supabase.from('employee_custom_field_values').select('employee_id, definition_id, value').eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId).in('definition_id', definitionIds).limit(5000)
    : { data: [], error: null }
  if (valuesResult.error) throw new OrganizationChartError('ORGANIZATION_CHART_READ_FAILED', 500)

  const roles = new Map((rolesResult.data ?? []).map((role) => [role.id, role]))
  return projectOrganizationChart({
    asOfDate: query.date,
    administration: administrationResult.data,
    departments: (departmentsResult.data ?? []).map((department) => ({ id: department.id, parentId: department.parent_id, code: department.code, name: department.name })),
    employees: (employeesResult.data ?? []).map((employee) => ({ id: employee.id, firstName: employee.first_name, birthName: employee.birth_name, avatarUrl: employee.avatar_url })),
    placements: (placementsResult.data ?? []).map((placement) => ({ id: placement.id, employeeId: placement.employee_id, employmentId: placement.employment_id, departmentId: placement.department_id, jobTitle: placement.job_title, effectiveFrom: placement.effective_from, effectiveTo: placement.effective_to })),
    managementAssignments: (managementResult.data ?? []).flatMap((assignment) => {
      const role = roles.get(assignment.management_role_id)
      return role ? [{ id: assignment.id, departmentId: assignment.department_id, employeeId: assignment.employee_id, roleCode: role.code, roleName: role.name, effectiveFrom: assignment.effective_from, effectiveTo: assignment.effective_to }] : []
    }),
    customFieldDefinitions: (definitionsResult.data ?? []).map((definition) => ({ id: definition.id, key: definition.key, label: definition.label_nl, fieldType: definition.field_type })),
    customFieldValues: (valuesResult.data ?? []).map((value) => ({ employeeId: value.employee_id, definitionId: value.definition_id, displayValue: displayValue(value.value) })),
    filters: { query: query.q, departmentId: query.department, roleCode: query.role, fieldDefinitionId: query.field, fieldValue: query.value },
  })
}
