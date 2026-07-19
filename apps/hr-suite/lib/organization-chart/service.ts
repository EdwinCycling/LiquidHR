import type { Json } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
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

async function listStarPerformerAssessmentsSafe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  administrationId: string,
): Promise<Array<{ employee_id: string; job_id: string | null; job_group_id: string | null; criticality_level: number }>> {
  const result = await supabase
    .from('star_performer_assessments')
    .select('employee_id, job_id, job_group_id, criticality_level')
    .eq('administration_id', administrationId)
    .limit(5000)

  if (!result.error) return result.data ?? []
  if (result.error.code === '42P01' || result.error.message.toLowerCase().includes('star_performer_assessments')) {
    return []
  }
  throw new OrganizationChartError('ORGANIZATION_CHART_READ_FAILED', 500)
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
    supabase.from('employee_organizations').select('id, employee_id, employment_id, department_id, direct_manager_id, job_id, job_title, effective_from, effective_to').eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId).lte('effective_from', query.date).or(`effective_to.is.null,effective_to.gte.${query.date}`).limit(5000),
    supabase.from('department_management').select('id, department_id, employee_id, management_role_id, effective_from, effective_to').eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId).lte('effective_from', query.date).or(`effective_to.is.null,effective_to.gte.${query.date}`).limit(5000),
    supabase.from('management_roles').select('id, code, name').or(`tenant_id.is.null,tenant_id.eq.${scope.tenantId}`).eq('is_active', true).is('deleted_at', null).limit(500),
    supabase.from('custom_field_definitions').select('id, key, label_nl, field_type').eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId).eq('entity_type', 'EMPLOYEE').eq('is_active', true).is('deleted_at', null).eq('show_in_organization_chart_filter', true).order('sort_order').limit(500),
    supabase.from('employees').select('id, first_name, birth_name, avatar_url, is_archived').eq('tenant_id', scope.tenantId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).limit(5000),
  ])

  const failures = [administrationResult, departmentsResult, placementsResult, managementResult, rolesResult, definitionsResult, employeesResult]
  if (failures.some((result) => result.error)) throw new OrganizationChartError('ORGANIZATION_CHART_READ_FAILED', 500)
  if (!administrationResult.data) throw new OrganizationChartError('ADMINISTRATION_NOT_FOUND', 404)

  const definitionIds = (definitionsResult.data ?? []).map((definition) => definition.id)
  const jobIds = [...new Set((placementsResult.data ?? []).flatMap((placement) => placement.job_id ? [placement.job_id] : []))]
  const valuesResult = definitionIds.length > 0
    ? await supabase.from('employee_custom_field_values').select('employee_id, definition_id, value').eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId).in('definition_id', definitionIds).limit(5000)
    : { data: [], error: null }
  if (valuesResult.error) throw new OrganizationChartError('ORGANIZATION_CHART_READ_FAILED', 500)

  const [jobsResult, jobRevisionsResult, starAssessments] = await Promise.all([
    jobIds.length > 0
      ? supabase.from('jobs').select('id, code, job_group_id').eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId).in('id', jobIds).limit(2000)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length > 0
      ? supabase.from('job_revisions').select('job_id, name, valid_from, valid_until').eq('administration_id', scope.administrationId).in('job_id', jobIds).lte('valid_from', query.date).or(`valid_until.is.null,valid_until.gt.${query.date}`).order('valid_from', { ascending: false }).limit(4000)
      : Promise.resolve({ data: [], error: null }),
    listStarPerformerAssessmentsSafe(supabase, scope.administrationId),
  ])
  if (jobsResult.error || jobRevisionsResult.error) throw new OrganizationChartError('ORGANIZATION_CHART_READ_FAILED', 500)

  const jobGroupIds = [...new Set((jobsResult.data ?? []).flatMap((job) => job.job_group_id ? [job.job_group_id] : []))]
  const jobGroupsResult = jobGroupIds.length > 0
    ? await supabase.from('job_groups').select('id, code, name').eq('tenant_id', scope.tenantId).eq('administration_id', scope.administrationId).in('id', jobGroupIds).limit(500)
    : { data: [], error: null }
  if (jobGroupsResult.error) throw new OrganizationChartError('ORGANIZATION_CHART_READ_FAILED', 500)

  const jobNameById = new Map<string, string>()
  for (const revision of jobRevisionsResult.data ?? []) {
    if (!jobNameById.has(revision.job_id)) jobNameById.set(revision.job_id, revision.name)
  }

  const roles = new Map((rolesResult.data ?? []).map((role) => [role.id, role]))
  return projectOrganizationChart({
    asOfDate: query.date,
    administration: administrationResult.data,
    departments: (departmentsResult.data ?? []).map((department) => ({ id: department.id, parentId: department.parent_id, code: department.code, name: department.name })),
    employees: (employeesResult.data ?? []).map((employee) => ({ id: employee.id, firstName: employee.first_name, birthName: employee.birth_name, avatarUrl: employeeAvatarHref(employee.id, employee.avatar_url) })),
    placements: (placementsResult.data ?? []).map((placement) => ({ id: placement.id, employeeId: placement.employee_id, employmentId: placement.employment_id, departmentId: placement.department_id, directManagerId: placement.direct_manager_id, jobId: placement.job_id, jobTitle: placement.job_id ? (jobNameById.get(placement.job_id) ?? placement.job_title) : placement.job_title, effectiveFrom: placement.effective_from, effectiveTo: placement.effective_to })),
    managementAssignments: (managementResult.data ?? []).flatMap((assignment) => {
      const role = roles.get(assignment.management_role_id)
      return role ? [{ id: assignment.id, departmentId: assignment.department_id, employeeId: assignment.employee_id, roleCode: role.code, roleName: role.name, effectiveFrom: assignment.effective_from, effectiveTo: assignment.effective_to }] : []
    }),
    customFieldDefinitions: (definitionsResult.data ?? []).map((definition) => ({ id: definition.id, key: definition.key, label: definition.label_nl, fieldType: definition.field_type })),
    customFieldValues: (valuesResult.data ?? []).map((value) => ({ employeeId: value.employee_id, definitionId: value.definition_id, displayValue: displayValue(value.value) })),
    jobs: (jobsResult.data ?? []).map((job) => ({ id: job.id, code: job.code, name: jobNameById.get(job.id) ?? job.code, jobGroupId: job.job_group_id })),
    jobGroups: (jobGroupsResult.data ?? []).map((group) => ({ id: group.id, code: group.code, name: group.name })),
    starPerformerAssessments: starAssessments.map((assessment) => ({ employeeId: assessment.employee_id, jobId: assessment.job_id, jobGroupId: assessment.job_group_id, criticalityLevel: assessment.criticality_level })),
    filters: { view: query.view, query: query.q, departmentId: query.department, roleCode: query.role, fieldDefinitionId: query.field, fieldValue: query.value },
  })
}
