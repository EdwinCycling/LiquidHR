import type { Database, Json } from '@scope/db'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type {
  CombinedTimelineMutationInput,
  FollowUpInput,
  ChainAssessmentRequestInput,
  ProfileLinkInput,
  RollbackTimelineInput,
  TimelineMutationInput,
} from './detail-schemas'
import { assessEmploymentChain } from './chain-assessment'
import { employeeAvatarHref } from '@/lib/employees/employee-service'

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
  if (context.tenantId !== data.tenant_id || context.administrationId !== data.administration_id) {
    throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)
  }
  return data
}

function throwDatabaseError(message: string): never {
  const code = message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'EMPLOYMENT_CHANGE_FAILED'
  const status = code === 'FORBIDDEN' ? 403 : code.includes('NOT_FOUND') ? 404
    : code.includes('CONFLICT') || code.includes('LATEST') || code.includes('REMAINING') ? 409 : 400
  throw new EmploymentDetailError(code, status)
}

export async function getEmploymentDetail(employeeId: string, employmentId: string) {
  const employment = await loadEmploymentForAction(employmentId, 'contract:read')
  if (employment.employee_id !== employeeId) throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)
  const supabase = await createClient()
  const [canWriteContract, canReadSalary, canWriteSalary, canReadAudit, canWriteEmployee, canWriteWorkSchedule] = await Promise.all([
    permissionAllowed('contract:write', employeeId), permissionAllowed('salary:read', employeeId),
    permissionAllowed('salary:write', employeeId), permissionAllowed('audit:read', employeeId),
    permissionAllowed('employee:write', employeeId), permissionAllowed('work-schedule:write', employeeId),
  ])

  const [
    employeeResult, administrationResult, incomeLinksResult, laborResult, scheduleResult,
    salaryResult, costResult, organizationResult, linksResult, followUpsResult, auditResult,
    costCentersResult, scalesResult,
  ] = await Promise.all([
    supabase.from('employees').select('id, employee_number, first_name, birth_name, work_email, work_mobile, avatar_url')
      .eq('id', employeeId).maybeSingle(),
    supabase.from('administrations').select('id, code, name').eq('id', employment.administration_id).maybeSingle(),
    supabase.from('employment_income_relationships').select('*, income_relationships(*)')
      .eq('employment_id', employmentId).order('valid_from', { ascending: false }).limit(100),
    supabase.from('employment_labor_conditions').select('*').eq('employment_id', employmentId)
      .order('valid_from', { ascending: false }).limit(100),
    supabase.from('employment_schedules').select('*').eq('employment_id', employmentId)
      .order('valid_from', { ascending: false }).limit(100),
    canReadSalary ? supabase.from('employment_salaries').select('*').eq('employment_id', employmentId)
      .order('valid_from', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    supabase.from('employment_cost_allocations').select('*, cost_centers(code, name)').eq('employment_id', employmentId)
      .order('valid_from', { ascending: false }).limit(500),
    supabase.from('employee_organizations').select('*, departments!employee_organizations_department_id_fkey(code, name)').eq('employment_id', employmentId)
      .order('effective_from', { ascending: false }).limit(100),
    supabase.from('employee_profile_links').select('*').eq('employee_id', employeeId)
      .order('sort_order').order('created_at').limit(50),
    supabase.from('employment_change_follow_ups').select('*').eq('employment_id', employmentId)
      .order('status').order('due_on').limit(100),
    canReadAudit ? supabase.from('audit_logs').select('*').eq('employment_id', employmentId)
      .order('created_at', { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    supabase.from('cost_centers').select('id, code, name').eq('administration_id', employment.administration_id)
      .eq('is_active', true).order('code').limit(500),
    canReadSalary ? supabase.from('salary_scale_steps').select('id, step_code, step_name, fulltime_amount, salary_scales(code, name)')
      .eq('administration_id', employment.administration_id).order('valid_from', { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
  ])
  const results = [employeeResult, administrationResult, incomeLinksResult, laborResult, scheduleResult,
    salaryResult, costResult, organizationResult, linksResult, followUpsResult, auditResult,
    costCentersResult, scalesResult]
  if (results.some((result) => result.error)) throw new EmploymentDetailError('EMPLOYMENT_DETAIL_FAILED', 500)
  if (!employeeResult.data || !administrationResult.data) throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)

  return {
    employment,
    employee: { ...employeeResult.data, avatar_url: employeeAvatarHref(employeeId, employeeResult.data.avatar_url) },
    administration: administrationResult.data,
    incomeRelationships: incomeLinksResult.data ?? [],
    laborConditions: laborResult.data ?? [], schedules: scheduleResult.data ?? [],
    salaries: salaryResult.data ?? [], costAllocations: costResult.data ?? [],
    organizations: organizationResult.data ?? [], profileLinks: linksResult.data ?? [],
    followUps: followUpsResult.data ?? [], auditLogs: auditResult.data ?? [],
    options: { costCenters: costCentersResult.data ?? [], salaryScaleSteps: scalesResult.data ?? [] },
    capabilities: { canWriteContract, canReadSalary, canWriteSalary, canReadAudit, canWriteEmployee, canWriteWorkSchedule },
  }
}

export async function applyTimelineMutation(employmentId: string, input: TimelineMutationInput): Promise<string> {
  const permission = input.timeline === 'SALARY' ? 'salary:write' : 'contract:write'
  await loadEmploymentForAction(employmentId, permission)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('apply_employment_timeline_mutation', {
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
  const { error } = await supabase.from('employments').update({ deleted_at: new Date().toISOString() }).eq('id', employment.id).eq('tenant_id', employment.tenant_id)
  if (error) throwDatabaseError(error.message)
}

export async function createFollowUp(employmentId: string, input: FollowUpInput) {
  const employment = await loadEmploymentForAction(employmentId, 'contract:write')
  if (!input.changeSetId) throw new EmploymentDetailError('CHANGE_SET_REQUIRED', 400)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employment_change_follow_ups').insert({
    tenant_id: employment.tenant_id, administration_id: employment.administration_id,
    employee_id: employment.employee_id, employment_id: employment.id, change_set_id: input.changeSetId,
    subject: input.subject, description: input.description ?? null,
    responsible_role_code: input.responsibleRoleCode ?? null,
    responsible_user_id: input.responsibleUserId ?? null, due_on: input.dueOn ?? null,
    priority: input.priority,
  }).select('*').single()
  if (error || !data) throwDatabaseError(error?.message ?? 'FOLLOW_UP_CREATE_FAILED')
  return data
}

export async function assessProposedEmploymentChain(employeeId: string, input: ChainAssessmentRequestInput) {
  const context = await requirePermission('contract:write', employeeId)
  const supabase = await createClient()
  const [{ data: employee, error: employeeError }, { data: employments, error: employmentError }, { data: externalHistory, error: historyError }] = await Promise.all([
    supabase.from('employees').select('id, tenant_id').eq('id', employeeId).maybeSingle(),
    supabase.from('employments').select('starts_on, ends_on, contract_type').eq('employee_id', employeeId)
      .is('deleted_at', null).order('starts_on').limit(100),
    supabase.from('employment_chain_history').select('starts_on, ends_on').eq('employee_id', employeeId)
      .order('starts_on').limit(100),
  ])
  if (employeeError || !employee || employee.tenant_id !== context.tenantId) {
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
