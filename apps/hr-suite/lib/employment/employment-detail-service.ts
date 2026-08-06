import type { Database, Json } from '@scope/db'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type {
  CombinedTimelineMutationInput,
  ChainAssessmentRequestInput,
  ProfileLinkInput,
  RollbackTimelineInput,
  TimelineMutationInput,
} from './detail-schemas'
import { assessEmploymentChain } from './chain-assessment'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import type { EmploymentContractMutationInput } from './contract-schemas'
import type { CompanyLocationMutationInput } from './company-location-schemas'

type Tables = Database['public']['Tables']
type Employment = Tables['employments']['Row']

export class EmploymentDetailError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'EmploymentDetailError'
  }
}

async function permissionAllowed(code: string, employeeId: string): Promise<boolean> {
  try {
    await requirePermission(code, employeeId)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

async function loadEmploymentForAction(employmentId: string, permission: string): Promise<Employment> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('employments').select('*')
    .eq('id', employmentId).is('deleted_at', null).maybeSingle()
  if (error || !data) throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)
  const context = await requirePermission(permission, data.employee_id)
  if (context.tenantId !== data.tenant_id) {
    throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)
  }
  return data
}

export type EmploymentDetailLoadScope =
  | 'all'
  | 'overview'
  | 'schedule'
  | 'salary'
  | 'organization'
  | 'company-location'
  | 'costs'
  | 'history'

function throwDatabaseError(message: string): never {
  const code = message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'EMPLOYMENT_CHANGE_FAILED'
  const status = code === 'FORBIDDEN' ? 403 : code.includes('NOT_FOUND') ? 404
    : code.includes('CONFLICT') || code.includes('LATEST') || code.includes('REMAINING') ? 409 : 400
  throw new EmploymentDetailError(code, status)
}

export async function getEmploymentDetail(
  employeeId: string,
  employmentId: string,
  scope: EmploymentDetailLoadScope = 'all',
) {
  const employment = await loadEmploymentForAction(employmentId, 'contract:read')
  if (employment.employee_id !== employeeId) throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)
  const supabase = await createClient()
  const isAllScope = scope === 'all'
  const includeOverview = isAllScope || scope === 'overview'
  const includeBasics = includeOverview
  const includeLabor = includeOverview
  const includeSchedule = includeOverview || scope === 'schedule' || scope === 'salary'
  const includeSalary = includeOverview || scope === 'salary' || scope === 'schedule'
  const includeOrganization = includeOverview || scope === 'organization'
  const includeCompanyLocation = isAllScope || scope === 'company-location'
  const includeCosts = includeOverview || scope === 'costs'
  const includeHistory = isAllScope || scope === 'history'
  const canWriteContractPromise = includeLabor || includeSchedule || includeCosts || isAllScope
    ? permissionAllowed('contract:write', employeeId)
    : Promise.resolve(false)
  const canReadSalaryPromise = includeOverview || includeSalary
    ? permissionAllowed('salary:read', employeeId)
    : Promise.resolve(false)
  const canWriteSalaryPromise = includeSalary
    ? permissionAllowed('salary:write', employeeId)
    : Promise.resolve(false)
  const canReadAuditPromise = includeHistory
    ? permissionAllowed('audit:read', employeeId)
    : Promise.resolve(false)
  const canWriteEmployeePromise = includeOverview
    ? permissionAllowed('employee:write', employeeId)
    : Promise.resolve(false)
  const canWriteWorkSchedulePromise = includeSchedule
    ? permissionAllowed('work-schedule:write', employeeId)
    : Promise.resolve(false)
  const canWriteOrganizationPromise = includeOrganization
    ? permissionAllowed('organization-placement:write', employeeId)
    : Promise.resolve(false)
  const canWriteCompanyLocationPromise = includeCompanyLocation
    ? permissionAllowed('organization-placement:write', employeeId)
    : Promise.resolve(false)
  const employeeQuery = supabase.from('employees').select('id, employee_number, first_name, birth_name, work_email, work_phone, work_mobile, avatar_url')
    .eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id).eq('id', employeeId).maybeSingle()
  const administrationQuery = supabase.from('administrations').select('id, code, name')
    .eq('id', employment.administration_id).maybeSingle()
  const incomeLinksQuery = includeBasics
    ? supabase.from('employment_income_relationships').select('*, income_relationships(*)')
      .eq('employment_id', employmentId).order('valid_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const laborQuery = includeLabor
    ? supabase.from('employment_labor_conditions').select('*').eq('employment_id', employmentId)
      .order('valid_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const contractsQuery = includeOverview
    ? supabase.from('employment_contracts')
      .select('*, flex_phases(code, name), labor_condition_sets!employment_contracts_labor_condition_set_fkey(code, name, standard_hours_per_week)')
      .eq('employment_id', employmentId).order('starts_on', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const scheduleQuery = includeSchedule
    ? supabase.from('employment_schedules').select('*').eq('employment_id', employmentId)
      .order('valid_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const salaryQuery = canReadSalaryPromise.then(async (canReadSalary) => canReadSalary
    ? await supabase.from('employment_salaries').select('*').eq('employment_id', employmentId)
      .order('valid_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null }))
  const costQuery = includeCosts
    ? supabase.from('employment_cost_allocations').select('*, cost_centers(code, name), cost_carriers(code, name)').eq('employment_id', employmentId)
      .order('valid_from', { ascending: false }).limit(500)
    : Promise.resolve({ data: [], error: null })
  const organizationQuery = includeOrganization
    ? supabase.from('employee_organizations').select('*, departments!employee_organizations_department_hr_group_fkey(code, name), jobs!employee_organizations_job_hr_group_fkey(code)').eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id).eq('employment_id', employmentId)
      .order('effective_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const companyDataQuery = includeCompanyLocation
    ? supabase.from('administration_company_data').select('*')
      .eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id).maybeSingle()
    : Promise.resolve({ data: null, error: null })
  const companyLocationsQuery = includeCompanyLocation
    ? supabase.from('administration_locations').select('id, name, is_active')
      .eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id)
      .order('is_active', { ascending: false }).order('name').limit(250)
    : Promise.resolve({ data: [], error: null })
  const companyLocationAssignmentsQuery = includeCompanyLocation
    ? supabase.from('employee_organizations').select('id, location_id, effective_from, effective_to')
      .eq('employment_id', employmentId).order('effective_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const linksQuery = supabase.from('employee_profile_links').select('*').eq('employee_id', employeeId)
    .order('sort_order').order('created_at').limit(50)
  const auditQuery = canReadAuditPromise.then(async (canReadAudit) => canReadAudit
    ? await supabase.from('audit_logs').select('*').eq('employment_id', employmentId)
      .order('created_at', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null }))
  const costCentersQuery = includeCosts
    ? supabase.from('cost_centers').select('id, code, name').eq('administration_id', employment.administration_id)
      .eq('is_active', true).order('code').limit(500)
    : Promise.resolve({ data: [], error: null })
  const costCarriersQuery = includeCosts
    ? supabase.from('cost_carriers').select('id, code, name')
      .eq('administration_id', employment.administration_id)
      .eq('is_active', true).order('code').limit(500)
    : Promise.resolve({ data: [], error: null })
  const scalesQuery = canReadSalaryPromise.then(async (canReadSalary) => canReadSalary && includeSalary
    ? await supabase.from('salary_scale_steps').select('id, step_code, step_name, fulltime_amount, salary_scales(code, name)')
      .eq('administration_id', employment.administration_id).order('valid_from', { ascending: false }).limit(500)
    : Promise.resolve({ data: [], error: null }))
  const contractOptionsQuery = includeOverview
    ? Promise.all([
      supabase.from('labor_condition_sets').select('id, code, name, standard_hours_per_week')
        .eq('administration_id', employment.administration_id).eq('is_active', true).order('code').limit(500),
      supabase.from('flex_phases').select('id, code, name')
        .eq('administration_id', employment.administration_id).eq('is_active', true).order('sort_order').limit(500),
    ])
    : Promise.resolve([
      { data: [], error: null },
      { data: [], error: null },
    ] as const)
  const organizationOptionsQuery = includeOrganization
    ? Promise.all([
      supabase.from('departments').select('id, code, name')
        .eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id).eq('is_active', true).order('code').limit(500),
      supabase.from('jobs').select('id, code, job_revisions!job_revisions_job_hr_group_fkey(name)')
        .eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id).eq('is_active', true).order('code').limit(500),
    ])
    : Promise.resolve([
      { data: [], error: null },
      { data: [], error: null },
    ] as const)

  const [
    employeeResult, administrationResult, incomeLinksResult, laborResult, contractsResult, scheduleResult,
    salaryResult, costResult, organizationResult, companyDataResult, companyLocationsResult,
    companyLocationAssignmentsResult, linksResult, auditResult,
    costCentersResult, costCarriersResult, scalesResult, contractOptionsResult, organizationOptionsResult,
    canWriteContract, canReadSalary, canWriteSalary, canReadAudit, canWriteEmployee, canWriteWorkSchedule,
    canWriteOrganization, canWriteCompanyLocation,
  ] = await Promise.all([
    employeeQuery,
    administrationQuery,
    incomeLinksQuery,
    laborQuery,
    contractsQuery,
    scheduleQuery,
    salaryQuery,
    costQuery,
    organizationQuery,
    companyDataQuery,
    companyLocationsQuery,
    companyLocationAssignmentsQuery,
    linksQuery,
    auditQuery,
    costCentersQuery,
    costCarriersQuery,
    scalesQuery,
    contractOptionsQuery,
    organizationOptionsQuery,
    canWriteContractPromise,
    canReadSalaryPromise,
    canWriteSalaryPromise,
    canReadAuditPromise,
    canWriteEmployeePromise,
    canWriteWorkSchedulePromise,
    canWriteOrganizationPromise,
    canWriteCompanyLocationPromise,
  ])
  const results = [employeeResult, administrationResult, incomeLinksResult, laborResult, contractsResult, scheduleResult,
    salaryResult, costResult, organizationResult, companyDataResult, companyLocationsResult,
    companyLocationAssignmentsResult, linksResult, auditResult,
    costCentersResult, costCarriersResult, scalesResult,
    ...contractOptionsResult, ...organizationOptionsResult]
  if (results.some((result) => result.error)) throw new EmploymentDetailError('EMPLOYMENT_DETAIL_FAILED', 500)
  if (!employeeResult.data || !administrationResult.data) throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)

  return {
    employment,
    employee: { ...employeeResult.data, avatar_url: employeeAvatarHref(employeeId, employeeResult.data.avatar_url) },
    administration: administrationResult.data,
    incomeRelationships: incomeLinksResult.data ?? [],
    contracts: contractsResult.data ?? [],
    laborConditions: laborResult.data ?? [], schedules: scheduleResult.data ?? [],
    salaries: salaryResult.data ?? [], costAllocations: costResult.data ?? [],
    organizations: organizationResult.data ?? [], profileLinks: linksResult.data ?? [],
    companyLocation: {
      company: companyDataResult.data,
      locations: companyLocationsResult.data ?? [],
      assignments: companyLocationAssignmentsResult.data ?? [],
    },
    auditLogs: auditResult.data ?? [],
    options: {
      costCenters: costCentersResult.data ?? [],
      costCarriers: costCarriersResult.data ?? [],
      salaryScaleSteps: scalesResult.data ?? [],
      laborConditionSets: contractOptionsResult[0].data ?? [],
      flexPhases: contractOptionsResult[1].data ?? [],
      departments: organizationOptionsResult[0].data ?? [],
      jobs: (organizationOptionsResult[1].data ?? []).map((job) => ({
        id: job.id,
        code: job.code,
        name: job.job_revisions[0]?.name ?? job.code,
      })),
    },
    capabilities: {
      canWriteContract, canReadSalary, canWriteSalary, canReadAudit, canWriteEmployee,
      canWriteWorkSchedule, canWriteOrganization, canWriteCompanyLocation,
    },
  }
}

export async function applyTimelineMutation(employmentId: string, input: TimelineMutationInput): Promise<string> {
  const permission = input.timeline === 'SALARY' ? 'salary:write' : 'contract:write'
  await loadEmploymentForAction(employmentId, permission)
  const supabase = await createClient()
  const { data, error } = input.timeline === 'COST_ALLOCATION'
    ? await supabase.rpc('apply_employment_cost_allocation', {
      requested_employment_id: employmentId,
      requested_effective_on: input.effectiveOn,
      requested_payload: input.payload as Json,
      requested_reason: input.reason,
      requested_warning_codes: input.warningCodes,
      requested_acknowledgements: input.acknowledgements as Json,
    })
    : await supabase.rpc('apply_employment_timeline_mutation', {
      requested_employment_id: employmentId,
      requested_timeline: input.timeline,
      requested_effective_on: input.effectiveOn,
      requested_payload: input.payload as Json,
      requested_reason: input.reason,
      requested_warning_codes: input.warningCodes,
      requested_acknowledgements: input.acknowledgements as Json,
    })
  if (error || !data) throwDatabaseError(error?.message ?? 'EMPLOYMENT_CHANGE_FAILED')
  return data
}

export async function applyCombinedTimelineMutation(
  employmentId: string,
  input: CombinedTimelineMutationInput,
): Promise<string> {
  const requiresSalaryWrite = input.mutations.some((mutation) => mutation.timeline === 'SALARY')
  await loadEmploymentForAction(employmentId, 'contract:write')
  if (requiresSalaryWrite) await loadEmploymentForAction(employmentId, 'salary:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('apply_combined_employment_timeline_mutation', {
    requested_employment_id: employmentId,
    requested_effective_on: input.effectiveOn,
    requested_mutations: input.mutations as Json,
    requested_reason: input.reason,
    requested_warning_codes: input.warningCodes,
    requested_acknowledgements: input.acknowledgements as Json,
  })
  if (error || !data) throwDatabaseError(error?.message ?? 'EMPLOYMENT_CHANGE_FAILED')
  return data
}

export async function manageEmploymentContract(
  employmentId: string,
  contractId: string | null,
  input: EmploymentContractMutationInput,
): Promise<string> {
  await loadEmploymentForAction(employmentId, 'contract:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('manage_employment_contract', {
    requested_employment_id: employmentId,
    requested_contract_id: contractId as string,
    requested_payload: input as Json,
  })
  if (error || !data) throwDatabaseError(error?.message ?? 'CONTRACT_CHANGE_FAILED')
  return data
}

export async function manageEmploymentOrganization(
  employmentId: string,
  placementId: string | null,
  input: { effectiveOn: string; departmentId: string; jobId: string },
): Promise<string> {
  const employment = await loadEmploymentForAction(employmentId, 'contract:read')
  await requirePermission('organization-placement:write', employment.employee_id)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('manage_employment_organization_timeline', {
    requested_employment_id: employmentId,
    requested_placement_id: placementId as string,
    requested_effective_on: input.effectiveOn,
    requested_department_id: input.departmentId,
    requested_job_id: input.jobId,
  })
  if (error || !data) throwDatabaseError(error?.message ?? 'ORGANIZATION_CHANGE_FAILED')
  return data
}

export async function manageEmploymentCompanyLocation(
  employmentId: string,
  input: CompanyLocationMutationInput,
): Promise<string> {
  const employment = await loadEmploymentForAction(employmentId, 'contract:read')
  await requirePermission('organization-placement:write', employment.employee_id)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('manage_employment_company_location', {
    requested_employment_id: employmentId,
    requested_placement_id: input.placementId as string,
    requested_effective_on: input.effectiveOn,
    requested_location_id: input.locationId,
  })
  if (error || !data) throwDatabaseError(error?.message ?? 'COMPANY_LOCATION_CHANGE_FAILED')
  return data
}

export async function rollbackTimeline(
  employmentId: string,
  timeline: TimelineMutationInput['timeline'],
  input: RollbackTimelineInput,
): Promise<string> {
  const permission = timeline === 'SALARY' ? 'salary:write' : 'contract:write'
  await loadEmploymentForAction(employmentId, permission)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('rollback_latest_employment_timeline', {
    requested_employment_id: employmentId,
    requested_timeline: timeline,
    requested_effective_on: input.effectiveOn,
    requested_reason: input.reason,
  })
  if (error || !data) throwDatabaseError(error?.message ?? 'EMPLOYMENT_ROLLBACK_FAILED')
  return data
}

export async function createProfileLink(employmentId: string, input: ProfileLinkInput) {
  const employment = await loadEmploymentForAction(employmentId, 'employee:write')
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_profile_links').insert({
    tenant_id: employment.tenant_id, employee_id: employment.employee_id,
    link_type: input.linkType, label: input.label, url: input.url,
    is_featured: input.isFeatured, sort_order: input.sortOrder,
  }).select('*').single()
  if (error || !data) throwDatabaseError(error?.message ?? 'PROFILE_LINK_CREATE_FAILED')
  return data
}

export async function deleteEmployment(employmentId: string): Promise<void> {
  const employment = await loadEmploymentForAction(employmentId, 'contract:write')
  const supabase = await createClient()
  const { error } = await supabase.from('employments').update({ deleted_at: new Date().toISOString() }).eq('id', employment.id).eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id)
  if (error) throwDatabaseError(error.message)
}

export async function assessProposedEmploymentChain(employeeId: string, input: ChainAssessmentRequestInput) {
  const context = await requirePermission('contract:write', employeeId)
  const supabase = await createClient()
  const [{ data: employee, error: employeeError }, { data: employments, error: employmentError }, { data: externalHistory, error: historyError }] = await Promise.all([
    supabase.from('employees').select('id, tenant_id, hr_group_id').eq('id', employeeId).eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId ?? '').maybeSingle(),
    supabase.from('employments').select('starts_on, ends_on, contract_type').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId ?? '').eq('employee_id', employeeId)
      .is('deleted_at', null).order('starts_on').limit(100),
    supabase.from('employment_chain_history').select('starts_on, ends_on').eq('employee_id', employeeId)
      .order('starts_on').limit(100),
  ])
  if (employeeError || !employee || employee.tenant_id !== context.tenantId || employee.hr_group_id !== context.hrGroupId) {
    throw new EmploymentDetailError('EMPLOYEE_NOT_FOUND', 404)
  }
  if (employmentError || historyError) throw new EmploymentDetailError('CHAIN_ASSESSMENT_FAILED', 500)
  const history = [
    ...(employments ?? []).filter((item) => item.contract_type !== 'INDEFINITE').map((item) => ({
      startsOn: item.starts_on,
      endsOn: item.ends_on,
    })),
    ...(externalHistory ?? []).map((item) => ({ startsOn: item.starts_on, endsOn: item.ends_on })),
  ]
  return assessEmploymentChain({
    ...input,
    proposed: { ...input.proposed, endsOn: input.proposed.endsOn ?? null },
    history,
  })
}
