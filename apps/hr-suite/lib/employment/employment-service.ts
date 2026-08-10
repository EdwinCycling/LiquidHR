import 'server-only'

import type { Database, Json } from '@scope/db'
import { AuthorizationError, getRequestAuthorizationContext, requireAnyPermission, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createBsnFingerprint } from '@/lib/security/bsn-fingerprint'
import { createClient } from '@/lib/supabase/server'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { employeeDetailReadFailureCode } from './detail-errors'
import { deriveEmploymentStatus, isRehire, type EmploymentStatus } from './employment-status'
import { selectCurrentEmploymentSummary, type CurrentEmployeeSummary } from './employee-summary'
import { listDirectTeamEmployeeIds, type EmployeeScope } from '@/lib/organization/team-scope'
import { mapEmployeeOverviewRpcRow, type EmployeeOverview } from './employee-overview'
import { nextAvailableEmploymentNumber } from './employment-number'
import { validateProbation } from './probation-rules'
import type {
  CompleteEmploymentCreateInput,
  CreateEmploymentInput,
  IdentityMatchInput,
  TerminationInput,
} from './schemas'

type EmploymentRow = Database['public']['Tables']['employments']['Row']
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface EmployeeOverviewReadDependencies {
  context: Awaited<ReturnType<typeof requireAnyPermission>>
  supabase: SupabaseServerClient
  teamEmployeeIds?: Promise<string[]>
}

export class EmploymentServiceError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 404 | 409 | 500,
  ) {
    super(code)
  }
}

export interface IdentityCandidate {
  id: string
  employeeNumber: string
  firstName: string
  birthName: string
  birthDate: string | null
  isArchived: boolean
  employment: {
    status: 'ACTIVE' | 'LAST' | 'NONE'
    employmentType: Database['public']['Enums']['employment_type'] | null
    startsOn: string | null
    endsOn: string | null
    administrationNumber: string | null
    administrationName: string | null
  }
  canRehire: boolean
  canUseExisting: boolean
  matchKind: 'BSN_EXACT' | 'FUZZY'
}

export interface RehireEmploymentDefaults {
  sourceEmploymentId: string
  employmentType: Database['public']['Enums']['employment_type']
  countryCode: string
  contract: {
    flexPhaseId: string | null
    laborConditionSetId: string
    durationType: Database['public']['Enums']['contract_duration_type']
    endsOn: string | null
    probationApplies: boolean
    probationEndsOn: string | null
  } | null
  schedule: {
    isOnCall: boolean
    onCallObligation: boolean | null
    workScope: Database['public']['Enums']['employment_work_scope'] | null
    weeklyHours: number
    partTimeFactor: number
    days: {
      monday: number
      tuesday: number
      wednesday: number
      thursday: number
      friday: number
      saturday: number
      sunday: number
    }
  } | null
  salary: {
    salaryBasis: Database['public']['Enums']['salary_basis']
    salaryFrequencyId: string
    fulltimeAmount: number | null
    parttimeAmount: number | null
    hourlyRate: number | null
    salaryScaleStepId: string | null
  } | null
  organization: {
    departmentId: string
    jobId: string | null
    jobTitle: string | null
    managerEmployeeId: string | null
  } | null
  allocations: Array<{ costCenterId: string; costCarrierId: string; percentage: number }>
}

export type EmployeeArchiveFilter = 'active' | 'archived' | 'all'

export type { EmployeeOverview } from './employee-overview'

export interface EmploymentCreationOptions {
  administrations: Array<{
    id: string
    code: string
    name: string
    administrationNumber?: string
    cocNumber?: string | null
    vatNumber?: string | null
    activeEmployeeCount: number
    archivedEmployeeCount: number
    availableLaborConditions: Array<{ code: string; name: string }>
  }>
  selectedAdministrationId: string
  departments: Array<{ id: string; code: string; name: string }>
  jobGroups: Array<{ id: string; code: string; name: string }>
  jobs: Array<{ id: string; code: string; name: string; jobGroupId: string }>
  managers: Array<{ id: string; employeeNumber: string; name: string }>
  departmentManagers: Record<string, Array<{ id: string; employeeNumber: string; name: string }>>
  costCenters: Array<{ id: string; code: string; name: string }>
  costCarriers: Array<{ id: string; code: string; name: string }>
  laborConditionSets: Array<{ id: string; code: string; name: string; standardHoursPerWeek: number; probationMaximumMonths: 1 | 2 }>
  flexPhases: Array<{ id: string; code: string; name: string }>
  salaryFrequencies: Array<{ id: string; code: string; name: string }>
  minimumWageRates: Array<{
    minimumAge: number
    hourlyAmount: number
    validFrom: string
    validUntil: string | null
  }>
  salaryScales: Array<{ id: string; code: string; name: string }>
  salaryScaleSteps: Array<{
    id: string
    salaryScaleId: string
    label: string
    fulltimeAmount: number
  }>
  nextEmploymentNumber: string
  nextIkvNumber: number
  canWriteSalary: boolean
  defaultCountryCode: string
  defaultStartDate: string
  hasActivePrimaryEmployment: boolean
  prerequisites: {
    employeeNumber: string
    updatedAt: string
    nationality: string | null
    birthDate: string | null
    gender: Database['public']['Enums']['gender'] | null
    hasBsn: boolean
  }
  rehireDefaults: RehireEmploymentDefaults | null
}

export interface EmployeeEmploymentDetail {
  employee: {
    id: string
    employeeNumber: string
    firstName: string
    birthName: string
    workEmail: string | null
    privateEmail: string | null
    updatedAt: string
    title: string | null
    initials: string | null
    birthNamePrefix: string | null
    partnerNamePrefix: string | null
    partnerName: string | null
    nameUsage: Database['public']['Enums']['name_usage']
    gender: Database['public']['Enums']['gender']
    pronouns: string | null
    birthDate: string | null
    birthPlace: string | null
    birthCountry: string | null
    nationality: string | null
    maritalStatus: Database['public']['Enums']['marital_status'] | null
    maritalStatusDate: string | null
    educationLevel: Database['public']['Enums']['education_level'] | null
    preferredLanguage: string
    privatePhone: string | null
    privateMobile: string | null
    workPhone: string | null
    workPhoneExt: string | null
    workMobile: string | null
    avatarUrl: string | null
    originalHireDate: string | null
    isActive: boolean
    isArchived: boolean
  }
  employments: EmploymentRow[]
  defaultCountryCode: string
  employmentCards: Array<{
    employmentId: string
    administrationName: string | null
    departmentName: string | null
    jobTitle: string | null
    hoursPerWeek: number | null
    laborConditionName: string | null
    employmentType: Database['public']['Enums']['employment_type'] | null
    workerType: Database['public']['Enums']['employment_worker_type'] | null
    contractType: Database['public']['Enums']['contract_duration_type'] | null
  }>
  status: EmploymentStatus
  addresses: Array<{
    addressType: 'PRIMARY' | 'SECONDARY'; description: string | null
    id: string; addressLine1: string; addressLine2: string | null; street: string | null
    houseNumber: string | null; houseNumberAddition: string | null
    postalCode: string | null; city: string; region: string | null; countryCode: string
    source: string; sourceReference: string | null
    validFrom: string; validUntil: string | null
  }>
  bankAccounts: Array<{
    id: string; maskedIban: string; bic: string | null; accountHolder: string
    description: string | null; isPrimary: boolean
  }>
  relations: Array<{
    id: string; relationType: string
    isEmergencyContact: boolean; firstName: string | null; initials: string | null
    prefix: string | null; lastName: string; gender: Database['public']['Enums']['gender'] | null
    birthDate: string | null; phone: string | null; mobile: string | null
    email: string | null; notes: string | null
  }>
  relationTypes: Array<{
    code: string
    nameNl: string
    nameEn: string
  }>
  currentEmploymentSummary: CurrentEmployeeSummary
  profileLinks: Array<{ id: string; label: string; url: string; linkType: string }>
  capabilities: {
    canEditEmployee: boolean
    canReadBsn: boolean
    canWriteBsn: boolean
    canManageAddresses: boolean
    canManageRelations: boolean
    canManageBankAccounts: boolean
    canReadSalary: boolean
  }
}

export type EmployeeDetailLoadScope = 'all' | 'overview' | 'personal' | 'employments'

export interface EmployeeDetailLoadOptions {
  includeSalary?: boolean
  supabase?: SupabaseServerClient
}

async function permissionAllowed(permissionCode: string, employeeId: string): Promise<boolean> {
  try {
    await requirePermission(permissionCode, employeeId)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

function requireAdministrationId(administrationId: string | null): string {
  if (!administrationId) throw new EmploymentServiceError('ADMINISTRATION_REQUIRED', 400)
  return administrationId
}

async function resolveEmploymentAdministration(employeeId: string, requestedAdministrationId?: string): Promise<{
  context: Awaited<ReturnType<typeof getRequestAuthorizationContext>>['context']
  supabase: SupabaseServerClient
  administrationId: string
  administrations: Awaited<ReturnType<typeof getRequestAuthorizationContext>>['activeContext']['administrationsInActiveHrGroup']
}> {
  await requirePermission('contract:write', employeeId)
  const authorization = await getRequestAuthorizationContext()
  const administrationId = requestedAdministrationId ?? requireAdministrationId(authorization.context.administrationId)
  const administrations = authorization.activeContext.administrationsInActiveHrGroup
  if (!administrations.some((administration) => administration.id === administrationId)) {
    throw new EmploymentServiceError('ADMINISTRATION_NOT_FOUND', 404)
  }
  return { context: authorization.context, supabase: authorization.supabase, administrationId, administrations }
}

async function getRehireEmploymentDefaults(
  supabase: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
  employeeId: string,
  administrationId: string,
): Promise<RehireEmploymentDefaults | null> {
  const today = new Date().toISOString().slice(0, 10)
  const previousResult = await supabase.from('employments')
    .select('id, employment_type, country_code')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('administration_id', administrationId)
    .eq('employee_id', employeeId)
    .eq('record_status', 'CONFIRMED')
    .not('ends_on', 'is', null)
    .lt('ends_on', today)
    .is('deleted_at', null)
    .order('ends_on', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (previousResult.error) throw new EmploymentServiceError('REHIRE_DEFAULTS_READ_FAILED', 500)
  if (!previousResult.data) return null

  const previousEmploymentId = previousResult.data.id
  const [contractResult, scheduleResult, salaryResult, organizationResult, allocationResult] = await Promise.all([
    supabase.from('employment_contracts').select('flex_phase_id, labor_condition_set_id, duration_type, ends_on, probation_applies, probation_ends_on').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId).eq('employee_id', employeeId).eq('employment_id', previousEmploymentId).order('starts_on', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('employment_schedules').select('is_on_call, on_call_obligation, work_scope, average_hours_per_week, part_time_factor, monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours').eq('tenant_id', tenantId).eq('administration_id', administrationId).eq('employee_id', employeeId).eq('employment_id', previousEmploymentId).order('valid_from', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('employment_salaries').select('salary_basis, salary_frequency_id, fulltime_amount, parttime_amount, hourly_rate, salary_scale_step_id').eq('tenant_id', tenantId).eq('administration_id', administrationId).eq('employee_id', employeeId).eq('employment_id', previousEmploymentId).order('valid_from', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('employee_organizations').select('department_id, job_id, job_title, direct_manager_id').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId).eq('employee_id', employeeId).eq('employment_id', previousEmploymentId).order('effective_from', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('employment_cost_allocations').select('cost_center_id, cost_carrier_id, percentage, valid_from').eq('tenant_id', tenantId).eq('administration_id', administrationId).eq('employee_id', employeeId).eq('employment_id', previousEmploymentId).order('valid_from', { ascending: false }).limit(50),
  ])
  if ([contractResult, scheduleResult, salaryResult, organizationResult, allocationResult].some((result) => result.error)) {
    throw new EmploymentServiceError('REHIRE_DEFAULTS_READ_FAILED', 500)
  }

  const latestAllocationDate = allocationResult.data?.[0]?.valid_from
  return {
    sourceEmploymentId: previousEmploymentId,
    employmentType: previousResult.data.employment_type,
    countryCode: previousResult.data.country_code,
    contract: contractResult.data ? {
      flexPhaseId: contractResult.data.flex_phase_id,
      laborConditionSetId: contractResult.data.labor_condition_set_id,
      durationType: contractResult.data.duration_type,
      endsOn: contractResult.data.ends_on,
      probationApplies: contractResult.data.probation_applies,
      probationEndsOn: contractResult.data.probation_ends_on,
    } : null,
    schedule: scheduleResult.data ? {
      isOnCall: scheduleResult.data.is_on_call,
      onCallObligation: scheduleResult.data.on_call_obligation,
      workScope: scheduleResult.data.work_scope,
      weeklyHours: scheduleResult.data.average_hours_per_week,
      partTimeFactor: scheduleResult.data.part_time_factor,
      days: {
        monday: scheduleResult.data.monday_hours ?? 0,
        tuesday: scheduleResult.data.tuesday_hours ?? 0,
        wednesday: scheduleResult.data.wednesday_hours ?? 0,
        thursday: scheduleResult.data.thursday_hours ?? 0,
        friday: scheduleResult.data.friday_hours ?? 0,
        saturday: scheduleResult.data.saturday_hours ?? 0,
        sunday: scheduleResult.data.sunday_hours ?? 0,
      },
    } : null,
    salary: salaryResult.data ? {
      salaryBasis: salaryResult.data.salary_basis,
      salaryFrequencyId: salaryResult.data.salary_frequency_id,
      fulltimeAmount: salaryResult.data.fulltime_amount,
      parttimeAmount: salaryResult.data.parttime_amount,
      hourlyRate: salaryResult.data.hourly_rate,
      salaryScaleStepId: salaryResult.data.salary_scale_step_id,
    } : null,
    organization: organizationResult.data ? {
      departmentId: organizationResult.data.department_id,
      jobId: organizationResult.data.job_id,
      jobTitle: organizationResult.data.job_title,
      managerEmployeeId: organizationResult.data.direct_manager_id,
    } : null,
    allocations: (allocationResult.data ?? [])
      .filter((allocation) => allocation.valid_from === latestAllocationDate)
      .map((allocation) => ({ costCenterId: allocation.cost_center_id, costCarrierId: allocation.cost_carrier_id, percentage: allocation.percentage })),
  }
}

export async function findIdentityCandidates(input: IdentityMatchInput): Promise<IdentityCandidate[]> {
  const context = await requirePermission('employee:match')
  const supabase = await createClient()
  const hrGroupId = requireHrGroupId(context)

  if (input.bsn) {
    const key = process.env.BSN_HASH_KEY
    if (!key) throw new EmploymentServiceError('BSN_HASH_KEY_MISSING', 500)
    const fingerprint = createBsnFingerprint(context.tenantId, input.bsn, key)
    const { data: identifiers, error: identifierError } = await supabase
      .from('employee_secure_identifiers')
      .select('employee_id')
      .eq('tenant_id', context.tenantId)
      .eq('bsn_fingerprint', fingerprint)
      .limit(1)
    if (identifierError) throw new EmploymentServiceError('IDENTITY_MATCH_FAILED', 500)
    const employeeIds = identifiers.map((identifier) => identifier.employee_id)
    if (employeeIds.length === 0) return []
    const { data, error } = await supabase.from('employees')
      .select('id, employee_number, first_name, birth_name, birth_date, is_archived')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .in('id', employeeIds)
      .is('deleted_at', null)
      .limit(1)
    if (error) throw new EmploymentServiceError('IDENTITY_MATCH_FAILED', 500)
    return enrichIdentityCandidates(supabase, context.tenantId, hrGroupId, data, 'BSN_EXACT')
  }

  if (!input.birthDate || !input.birthName) return []
  let query = supabase
    .from('employees')
    .select('id, employee_number, first_name, birth_name, birth_date, is_archived, initials, private_email')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('birth_date', input.birthDate)
    .ilike('birth_name', input.birthName)
    .is('deleted_at', null)

  if (input.initials) query = query.ilike('initials', input.initials)
  if (input.privateEmail) query = query.eq('private_email', input.privateEmail.toLowerCase())

  const { data, error } = await query.order('employee_number').limit(10)
  if (error) throw new EmploymentServiceError('IDENTITY_MATCH_FAILED', 500)
  return enrichIdentityCandidates(supabase, context.tenantId, hrGroupId, data, 'FUZZY')
}

async function enrichIdentityCandidates(
  supabase: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
  employees: Array<{ id: string; employee_number: string; first_name: string; birth_name: string; birth_date: string | null; is_archived: boolean }>,
  matchKind: IdentityCandidate['matchKind'],
): Promise<IdentityCandidate[]> {
  const employeeIds = employees.map((employee) => employee.id)
  const { data: employments, error: employmentError } = await supabase
    .from('employments')
    .select('employee_id, starts_on, ends_on, record_status, employment_type, administration_id')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .in('employee_id', employeeIds)
    .is('deleted_at', null)
    .order('starts_on', { ascending: false })
  if (employmentError) throw new EmploymentServiceError('IDENTITY_MATCH_FAILED', 500)

  const administrationIds = [...new Set(employments.map((employment) => employment.administration_id))]
  const { data: administrations, error: administrationError } = administrationIds.length > 0
    ? await supabase.from('administrations').select('id, administration_number, name').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).in('id', administrationIds)
    : { data: [], error: null }
  if (administrationError) throw new EmploymentServiceError('IDENTITY_MATCH_FAILED', 500)

  const administrationById = new Map(administrations.map((administration) => [administration.id, administration]))
  const today = new Date().toISOString().slice(0, 10)
  return employees.map((employee) => {
    const employeeEmployments = employments.filter((employment) => employment.employee_id === employee.id && employment.record_status === 'CONFIRMED')
    const activeEmployment = employeeEmployments.find((employment) => employment.starts_on <= today && (employment.ends_on === null || employment.ends_on >= today))
    const closedEmployment = employeeEmployments.find((employment) => employment.ends_on !== null && employment.ends_on < today)
    const selectedEmployment = activeEmployment ?? closedEmployment ?? employeeEmployments[0]
    const administration = selectedEmployment ? administrationById.get(selectedEmployment.administration_id) : undefined
    return {
      id: employee.id,
      employeeNumber: employee.employee_number,
      firstName: employee.first_name,
      birthName: employee.birth_name,
      birthDate: employee.birth_date,
      isArchived: employee.is_archived,
      employment: selectedEmployment ? {
        status: activeEmployment ? 'ACTIVE' : 'LAST',
        employmentType: selectedEmployment.employment_type,
        startsOn: selectedEmployment.starts_on,
        endsOn: selectedEmployment.ends_on,
        administrationNumber: administration?.administration_number ?? null,
        administrationName: administration?.name ?? null,
      } : {
        status: 'NONE',
        employmentType: null,
        startsOn: null,
        endsOn: null,
        administrationNumber: null,
        administrationName: null,
      },
      canRehire: !activeEmployment && Boolean(closedEmployment),
      canUseExisting: employeeEmployments.length === 0,
      matchKind,
    }
  })
}

export async function createEmployment(input: CreateEmploymentInput): Promise<{
  employment: EmploymentRow
  isRehire: boolean
}> {
  const context = await requirePermission('contract:write', input.employeeId)
  const administrationId = requireAdministrationId(context.administrationId)
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const { data: assignment, error: assignmentError } = await supabase
    .from('employee_administration_assignments')
    .select('id')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('administration_id', administrationId)
    .eq('employee_id', input.employeeId)
    .lte('effective_from', input.startsOn)
    .or(`effective_to.is.null,effective_to.gte.${input.startsOn}`)
    .limit(1)
    .maybeSingle()

  if (assignmentError) throw new EmploymentServiceError('EMPLOYEE_SCOPE_CHECK_FAILED', 500)
  if (!assignment) throw new EmploymentServiceError('EMPLOYEE_ADMINISTRATION_MISMATCH', 409)

  const { data: history, error: historyError } = await supabase
    .from('employments')
    .select('starts_on, ends_on, record_status')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('employee_id', input.employeeId)
    .is('deleted_at', null)
  if (historyError) throw new EmploymentServiceError('EMPLOYMENT_HISTORY_FAILED', 500)

  const { data, error } = await supabase
    .from('employments')
    .insert({
      tenant_id: context.tenantId,
      hr_group_id: hrGroupId,
      administration_id: administrationId,
      employee_id: input.employeeId,
      employment_number: input.employmentNumber,
      employment_type: input.employmentType,
      contract_type: input.contractType,
      starts_on: input.startsOn,
      ends_on: input.endsOn ?? null,
      probation_ends_on: input.probationEndsOn ?? null,
      seniority_date: input.seniorityDate,
      original_hire_date: input.originalHireDate,
      is_primary: input.isPrimary,
      reason_started: input.reasonStarted ?? null,
      contract_document_url: input.contractDocumentUrl ?? null,
    })
    .select('*')
    .single()

  if (error?.code === '23505') throw new EmploymentServiceError('EMPLOYMENT_NUMBER_CONFLICT', 409)
  if (error || !data) throw new EmploymentServiceError('EMPLOYMENT_CREATE_FAILED', 500)

  return {
    employment: data,
    isRehire: isRehire(
      history.map((row) => ({
        startsOn: row.starts_on,
        endsOn: row.ends_on,
        recordStatus: row.record_status,
      })),
      input.startsOn,
    ),
  }
}

export async function publishCompleteEmployment(
  employeeId: string,
  input: CompleteEmploymentCreateInput,
  requestedAdministrationId?: string,
): Promise<string> {
  const { context, supabase, administrationId } = await resolveEmploymentAdministration(employeeId, requestedAdministrationId)
  if (input.contract) await requirePermission('organization-placement:write', employeeId)
  if (input.salary) await requirePermission('salary:write', employeeId)
  if (input.contract) {
    const { data: laborCondition, error: laborConditionError } = await supabase
      .from('labor_condition_sets')
      .select('*')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', requireHrGroupId(context))
      .eq('administration_id', administrationId)
      .eq('id', input.contract.laborConditionSetId)
      .maybeSingle()
    if (laborConditionError || !laborCondition) throw new EmploymentServiceError('LABOR_CONDITION_NOT_FOUND', 400)
    const probationError = validateProbation({
      ...input.contract,
      caoAllowsTwoMonths: laborCondition.probation_maximum_months === 2,
    })
    if (probationError) throw new EmploymentServiceError(probationError, 400)
  }
  await ensureEmployeeAdministrationAssignment(employeeId, input.employment.startsOn, administrationId)

  let requestedInput = input
  if (input.organization) {
    const [assignmentsResult, rolesResult] = await Promise.all([
      supabase.from('department_management').select('employee_id, management_role_id, effective_from, effective_to')
        .eq('tenant_id', context.tenantId)
        .eq('hr_group_id', requireHrGroupId(context))
        .eq('department_id', input.organization.departmentId)
        .lte('effective_from', input.employment.startsOn)
        .or(`effective_to.is.null,effective_to.gte.${input.employment.startsOn}`)
        .order('effective_from', { ascending: false }).limit(100),
      supabase.from('management_roles').select('id, code')
        .or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`)
        .eq('code', 'DIRECT_MANAGER').eq('is_active', true).is('deleted_at', null).limit(20),
    ])
    if (!assignmentsResult.error && !rolesResult.error) {
      const directManagerRoleIds = new Set((rolesResult.data ?? []).map((role) => role.id))
      const managerEmployeeId = assignmentsResult.data?.find((assignment) => directManagerRoleIds.has(assignment.management_role_id) && assignment.employee_id !== employeeId)?.employee_id ?? null
      requestedInput = {
        ...input,
        organization: { ...input.organization, managerEmployeeId },
      }
    }
  }

  const { data, error } = await supabase.rpc('publish_complete_employment', {
    requested_employee_id: employeeId,
    requested_administration_id: administrationId,
    requested_payload: requestedInput as Json,
  })
  if (error || !data) {
    const code = error?.message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'EMPLOYMENT_CREATE_FAILED'
    const status = code === 'FORBIDDEN' ? 403
      : code.includes('NOT_FOUND') ? 404
        : code.includes('CONFLICT') || code.includes('MISMATCH') ? 409 : 400
    throw new EmploymentServiceError(code, status)
  }
  return data
}

export async function getEmploymentCreationOptions(
  employeeId: string,
  requestedAdministrationId?: string,
): Promise<EmploymentCreationOptions> {
  const { context, supabase, administrationId, administrations } = await resolveEmploymentAdministration(employeeId, requestedAdministrationId)
  const canWriteSalary = await permissionAllowed('salary:write', employeeId)
  const today = new Date().toISOString().slice(0, 10)
  const [currentYear, currentMonth] = today.split('-').map(Number)
  const defaultStartDate = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString().slice(0, 10)
  const administrationIds = administrations.map((administration) => administration.id)
  const hrGroupId = requireHrGroupId(context)

  const [
    departmentsResult, jobGroupsResult, jobsResult, costCentersResult, costCarriersResult,
    laborConditionSetsResult, flexPhasesResult, salaryFrequenciesResult,
    hrSettingsResult, employeeResult, bsnResult, primaryResult, employmentNumbersResult, ikvResult,
    minimumWagesResult, salaryScalesResult, scaleStepsResult, managersResult,
    managementAssignmentsResult, managementRolesResult, administrationEmploymentStatsResult, administrationEmployeesResult,
  ] = await Promise.all([
    supabase.from('departments').select('id, code, name')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('is_active', true).order('code').limit(500),
    supabase.from('job_groups').select('id, code, name')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('is_active', true).order('code').limit(500),
    supabase.from('jobs').select('id, code, job_group_id, job_revisions!job_revisions_job_hr_group_fkey(name)')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('is_active', true).order('code').limit(500),
    supabase.from('cost_centers').select('id, code, name')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .eq('is_active', true).order('code').limit(500),
    supabase.from('cost_carriers').select('id, code, name')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .eq('is_active', true).order('code').limit(500),
    supabase.from('labor_condition_sets').select('*')
      .eq('tenant_id', context.tenantId).in('administration_id', administrationIds)
      .eq('is_active', true).order('code').limit(500),
    supabase.from('flex_phases').select('id, code, name')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .eq('is_active', true).order('sort_order').limit(500),
    supabase.from('salary_frequencies').select('id, code, name')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .eq('is_active', true).order('code').limit(100),
    supabase.from('administration_hr_settings').select('default_employment_country_code')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId).maybeSingle(),
    supabase.from('employees').select('employee_number, nationality, birth_date, gender, updated_at')
      .eq('tenant_id', context.tenantId).eq('id', employeeId).maybeSingle(),
    supabase.from('employee_secure_identifiers').select('employee_id')
      .eq('tenant_id', context.tenantId).eq('employee_id', employeeId)
      .not('bsn_fingerprint', 'is', null).maybeSingle(),
    supabase.from('employments').select('id, starts_on, ends_on')
      .eq('tenant_id', context.tenantId)
      .eq('employee_id', employeeId).eq('is_primary', true).is('deleted_at', null)
      .order('starts_on', { ascending: false }).limit(100),
    supabase.from('employments').select('employment_number')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('employee_id', employeeId)
      .is('deleted_at', null).limit(5_000),
    supabase.from('income_relationships').select('ikv_number')
      .eq('tenant_id', context.tenantId).eq('employee_id', employeeId)
      .is('deleted_at', null)
      .order('ikv_number', { ascending: false }).limit(1),
    canWriteSalary
      ? supabase.from('statutory_minimum_wages')
        .select('minimum_age, hourly_amount, valid_from, valid_until')
        .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
        .eq('country_code', 'NL').order('valid_from').order('minimum_age').limit(100)
      : Promise.resolve({ data: [], error: null }),
    canWriteSalary
      ? supabase.from('salary_scales').select('id, code, name')
        .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
        .eq('is_active', true).order('code').limit(100)
      : Promise.resolve({ data: [], error: null }),
    canWriteSalary
      ? supabase.from('salary_scale_steps')
        .select('id, salary_scale_id, step_code, step_name, fulltime_amount, salary_scales(code, name)')
        .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
        .lte('valid_from', today).or(`valid_until.is.null,valid_until.gt.${today}`)
        .order('fulltime_amount').limit(500)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('employees').select('id, employee_number, first_name, birth_name')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
      .is('deleted_at', null).order('employee_number').limit(500),
    supabase.from('department_management').select('department_id, management_role_id, employee_id, effective_from, effective_to')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
      .lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).limit(1000),
    supabase.from('management_roles').select('id, code')
      .or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`).eq('code', 'DIRECT_MANAGER').eq('is_active', true).is('deleted_at', null).limit(20),
    supabase.from('employments').select('administration_id, employee_id, starts_on, ends_on, record_status')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('administration_id', administrationIds)
      .is('deleted_at', null).limit(10_000),
    supabase.from('employees').select('id, is_archived')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).is('deleted_at', null).limit(10_000),
  ])
  const optionResults = [
    departmentsResult, jobGroupsResult, jobsResult, costCentersResult, costCarriersResult,
    laborConditionSetsResult, flexPhasesResult, salaryFrequenciesResult,
    hrSettingsResult, employeeResult, bsnResult, primaryResult, employmentNumbersResult, ikvResult,
    minimumWagesResult, salaryScalesResult, scaleStepsResult, managersResult,
  ]
  if (optionResults.some((result) => result.error) || !employeeResult.data) {
    throw new EmploymentServiceError('EMPLOYMENT_OPTIONS_FAILED', 500)
  }
  const rehireDefaults = await getRehireEmploymentDefaults(
    supabase,
    context.tenantId,
    requireHrGroupId(context),
    employeeId,
    administrationId,
  )
  const managerRoleIds = new Set((managementRolesResult.data ?? []).map((role) => role.id))
  const employeesById = new Map((managersResult.data ?? []).map((employee) => [employee.id, {
    id: employee.id,
    employeeNumber: employee.employee_number,
    name: `${employee.first_name} ${employee.birth_name}`.trim(),
  }]))
  const departmentManagers = (managementAssignmentsResult.data ?? []).reduce<Record<string, Array<{ id: string; employeeNumber: string; name: string }>>>((result, assignment) => {
    if (!assignment.department_id || !managerRoleIds.has(assignment.management_role_id) || assignment.employee_id === employeeId) return result
    const manager = employeesById.get(assignment.employee_id)
    if (!manager) return result
    const existing = result[assignment.department_id] ?? []
    if (!existing.some((item) => item.id === manager.id)) result[assignment.department_id] = [...existing, manager]
    return result
  }, {})
  const nextEmploymentNumber = nextAvailableEmploymentNumber((employmentNumbersResult.data ?? []).map((row) => row.employment_number))
  const highestIkvNumber = ikvResult.data?.[0]?.ikv_number ?? 0
  const archivedByEmployeeId = new Map((administrationEmployeesResult.data ?? []).map((employee) => [employee.id, employee.is_archived]))
  const activeEmployeeIdsByAdministration = new Map<string, Set<string>>()
  const archivedEmployeeIdsByAdministration = new Map<string, Set<string>>()
  for (const employment of administrationEmploymentStatsResult.data ?? []) {
    if (employment.record_status !== 'CONFIRMED') continue
    if (employment.starts_on <= today && (!employment.ends_on || employment.ends_on >= today) && archivedByEmployeeId.get(employment.employee_id) !== true) {
      const activeEmployeeIds = activeEmployeeIdsByAdministration.get(employment.administration_id) ?? new Set<string>()
      activeEmployeeIds.add(employment.employee_id)
      activeEmployeeIdsByAdministration.set(employment.administration_id, activeEmployeeIds)
    }
    if (archivedByEmployeeId.get(employment.employee_id) === true) {
      const archivedEmployeeIds = archivedEmployeeIdsByAdministration.get(employment.administration_id) ?? new Set<string>()
      archivedEmployeeIds.add(employment.employee_id)
      archivedEmployeeIdsByAdministration.set(employment.administration_id, archivedEmployeeIds)
    }
  }
  const laborConditionRowsByAdministration = new Map<string, Array<{ code: string; name: string }>>()
  for (const conditionSet of laborConditionSetsResult.data ?? []) {
    const rows = laborConditionRowsByAdministration.get(conditionSet.administration_id) ?? []
    rows.push({ code: conditionSet.code, name: conditionSet.name })
    laborConditionRowsByAdministration.set(conditionSet.administration_id, rows)
  }

  return {
    administrations: administrations.map((administration) => ({
      id: administration.id,
      code: administration.code,
      name: administration.name,
      administrationNumber: administration.administrationNumber,
      cocNumber: administration.cocNumber,
      vatNumber: administration.vatNumber,
      activeEmployeeCount: activeEmployeeIdsByAdministration.get(administration.id)?.size ?? 0,
      archivedEmployeeCount: archivedEmployeeIdsByAdministration.get(administration.id)?.size ?? 0,
      availableLaborConditions: laborConditionRowsByAdministration.get(administration.id) ?? [],
    })),
    selectedAdministrationId: administrationId,
    nextEmploymentNumber,
    departments: departmentsResult.data ?? [],
    jobGroups: jobGroupsResult.data ?? [],
    jobs: (jobsResult.data ?? []).map((job) => ({
      id: job.id,
      code: job.code,
      jobGroupId: job.job_group_id,
      name: job.job_revisions[0]?.name ?? job.code,
    })),
    managers: (managersResult.data ?? []).filter((employee) => employee.id !== employeeId).map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employee_number,
      name: `${employee.first_name} ${employee.birth_name}`.trim(),
    })),
    departmentManagers,
    costCenters: costCentersResult.data ?? [],
    costCarriers: costCarriersResult.data ?? [],
    laborConditionSets: (laborConditionSetsResult.data ?? []).filter((item) => item.administration_id === administrationId).map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      standardHoursPerWeek: item.standard_hours_per_week,
      probationMaximumMonths: item.probation_maximum_months === 2 ? 2 : 1,
    })),
    flexPhases: flexPhasesResult.data ?? [],
    salaryFrequencies: salaryFrequenciesResult.data ?? [],
    minimumWageRates: (minimumWagesResult.data ?? []).map((rate) => ({
      minimumAge: rate.minimum_age,
      hourlyAmount: rate.hourly_amount,
      validFrom: rate.valid_from,
      validUntil: rate.valid_until,
    })),
    salaryScales: salaryScalesResult.data ?? [],
    salaryScaleSteps: (scaleStepsResult.data ?? []).map((step) => ({
      id: step.id,
      salaryScaleId: step.salary_scale_id,
      label: `${step.salary_scales?.code ?? ''} · ${step.step_name || step.step_code}`,
      fulltimeAmount: step.fulltime_amount,
    })),
    nextIkvNumber: highestIkvNumber < 99 ? highestIkvNumber + 1 : 0,
    canWriteSalary,
    defaultCountryCode: hrSettingsResult.data?.default_employment_country_code ?? 'NL',
    defaultStartDate,
    hasActivePrimaryEmployment: (primaryResult.data ?? []).some((employment) =>
      employment.starts_on <= today && (!employment.ends_on || employment.ends_on >= today)),
    prerequisites: {
      employeeNumber: employeeResult.data.employee_number,
      updatedAt: employeeResult.data.updated_at,
      nationality: employeeResult.data.nationality,
      birthDate: employeeResult.data.birth_date,
      gender: employeeResult.data.gender,
      hasBsn: Boolean(bsnResult.data),
    },
    rehireDefaults,
  }
}

export async function ensureEmployeeAdministrationAssignment(
  employeeId: string,
  effectiveFrom: string,
  requestedAdministrationId?: string,
): Promise<void> {
  const { context, supabase, administrationId } = await resolveEmploymentAdministration(employeeId, requestedAdministrationId)
  const groupId = requireHrGroupId(context)
  const { data: existing, error: existingError } = await supabase
    .from('employee_administration_assignments')
    .select('id')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', groupId)
    .eq('administration_id', administrationId)
    .eq('employee_id', employeeId)
    .lte('effective_from', effectiveFrom)
    .or(`effective_to.is.null,effective_to.gte.${effectiveFrom}`)
    .limit(1)
    .maybeSingle()
  if (existingError) throw new EmploymentServiceError('EMPLOYEE_ADMINISTRATION_ASSIGNMENT_READ_FAILED', 500)
  if (existing) return

  const { error: insertError } = await supabase.from('employee_administration_assignments').insert({
    tenant_id: context.tenantId,
    hr_group_id: groupId,
    administration_id: administrationId,
    employee_id: employeeId,
    effective_from: effectiveFrom,
    effective_to: null,
  })
  if (insertError?.code === '23505') return
  if (insertError) throw new EmploymentServiceError('EMPLOYEE_ADMINISTRATION_ASSIGNMENT_CREATE_FAILED', 500)
}

export async function listEmployeeEmployments(employeeId: string): Promise<EmploymentRow[]> {
  const context = await requirePermission('contract:read', employeeId)
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employments')
    .select('*')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('employee_id', employeeId)
    .is('deleted_at', null)
    .order('starts_on', { ascending: false })
    .order('is_primary', { ascending: false })
    .limit(100)
  if (error) throw new EmploymentServiceError('EMPLOYMENT_READ_FAILED', 500)
  return data
}

async function listDirectTeamEmployeeOverviews(
  context: EmployeeOverviewReadDependencies['context'],
  archiveFilter: EmployeeArchiveFilter,
  today: string,
  supabase: SupabaseServerClient,
  requestedTeamEmployeeIds?: string[],
): Promise<EmployeeOverview[]> {
  const teamEmployeeIds = requestedTeamEmployeeIds ?? await listDirectTeamEmployeeIds(context, supabase)
  if (teamEmployeeIds.length === 0) return []

  const { data, error } = await supabase.rpc('list_employee_overviews', {
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: requireHrGroupId(context),
    requested_as_of: today,
    requested_archive_filter: archiveFilter,
  })
  if (error) throw new EmploymentServiceError('EMPLOYEE_OVERVIEW_FAILED', 500)

  const teamEmployeeIdSet = new Set(teamEmployeeIds)
  return data
    .filter((employee) => teamEmployeeIdSet.has(employee.id))
    .map((employee) => mapEmployeeOverviewRpcRow(employee, today))
}

export async function listEmployeesOverview(
  archiveFilter: EmployeeArchiveFilter = 'active',
  scope: EmployeeScope = 'all',
  options: { activeDirectoryOnly?: boolean } = {},
  dependencies?: EmployeeOverviewReadDependencies,
): Promise<EmployeeOverview[]> {
  const context = dependencies?.context ?? await requireAnyPermission(['employee:read', 'employee-directory:read'])
  if (dependencies && !context.permissions.includes('employee:read') && !context.permissions.includes('employee-directory:read')) {
    throw new AuthorizationError('Je hebt onvoldoende rechten voor deze actie.')
  }
  const supabase = dependencies?.supabase ?? await createClient()
  const hrGroupId = requireHrGroupId(context)
  const today = new Date().toISOString().slice(0, 10)
  const effectiveArchiveFilter = options.activeDirectoryOnly ? 'active' : archiveFilter
  if (scope === 'team' && !context.activeRoles.includes('DIRECT_MANAGER')) throw new AuthorizationError('Je hebt geen toegang tot de teamscope.')
  if (scope === 'team') return listDirectTeamEmployeeOverviews(context, effectiveArchiveFilter, today, supabase, dependencies?.teamEmployeeIds ? await dependencies.teamEmployeeIds : undefined)

  const { data, error } = await supabase.rpc('list_employee_overviews', {
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: hrGroupId,
    requested_as_of: today,
    requested_archive_filter: effectiveArchiveFilter,
  })
  if (error) throw new EmploymentServiceError('EMPLOYEE_OVERVIEW_FAILED', 500)

  const employees = data.map((employee) => mapEmployeeOverviewRpcRow(employee, today))
  return options.activeDirectoryOnly ? employees.filter((employee) => employee.status === 'ACTIVE_EMPLOYEE') : employees
}

export async function getEmployeeEmploymentDetail(
  employeeId: string,
  scope: EmployeeDetailLoadScope = 'all',
  options: EmployeeDetailLoadOptions = {},
): Promise<EmployeeEmploymentDetail> {
  const context = await requirePermission('employee:read', employeeId)
  const supabase = options.supabase ?? await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const isAllScope = scope === 'all'
  const includePersonalData = isAllScope || scope === 'overview' || scope === 'personal'
  const includeOverviewData = isAllScope || scope === 'overview' || scope === 'employments'
  const canReadSalaryPromise = includeOverviewData
    ? permissionAllowed('salary:read', employeeId)
    : Promise.resolve(false)
  const loadSalary = includeOverviewData && options.includeSalary !== false
  const employeeQuery = supabase
    .from('employees')
    .select(`id, employee_number, title, initials, first_name, birth_name_prefix,
        birth_name, partner_name_prefix, partner_name, name_usage, gender, pronouns,
        birth_date, birth_place, birth_country, nationality, marital_status,
        marital_status_date, education_level, preferred_language, private_email,
        private_phone, private_mobile, work_email, work_phone, work_phone_ext,
        work_mobile, avatar_url, original_hire_date, is_active, is_archived, updated_at`)
    .eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('id', employeeId).is('deleted_at', null).maybeSingle()
  const employmentsQuery = supabase.from('employments').select('*, administrations!employments_administration_hr_group_fkey(code, name)')
    .eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('employee_id', employeeId).is('deleted_at', null)
    .order('starts_on', { ascending: false }).order('is_primary', { ascending: false }).limit(100)
  const addressesQuery = includePersonalData
    ? supabase.from('employee_addresses').select('*').eq('tenant_id', context.tenantId).eq('employee_id', employeeId)
      .is('deleted_at', null).order('valid_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const bankAccountsQuery = includePersonalData
    ? supabase.from('employee_bank_accounts').select('id, iban_last_four, bic, account_holder, description, is_primary')
      .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).is('deleted_at', null)
      .order('is_primary', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const relationsQuery = includePersonalData
    ? supabase.from('employee_relations').select('*').eq('tenant_id', context.tenantId).eq('employee_id', employeeId)
      .is('deleted_at', null).order('is_emergency_contact', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const relationTypesQuery = includePersonalData
    ? supabase.from('relation_types').select('code, name_nl, name_en').eq('tenant_id', context.tenantId)
      .eq('is_active', true).order('name_nl').limit(100)
    : Promise.resolve({ data: [], error: null })
  const laborConditionsQuery = includeOverviewData
    ? supabase.from('employment_labor_conditions').select('employment_id, condition_group, valid_from, valid_until')
      .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).lte('valid_from', today)
      .or(`valid_until.is.null,valid_until.gte.${today}`).order('valid_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const schedulesQuery = includeOverviewData
    ? supabase.from('employment_schedules').select('employment_id, average_hours_per_week, valid_from, valid_until')
      .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).lte('valid_from', today)
      .or(`valid_until.is.null,valid_until.gte.${today}`).order('valid_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const salaryQuery = loadSalary ? canReadSalaryPromise.then(async (canReadSalary) => canReadSalary
    ? await supabase.from('employment_salaries').select('employment_id, fulltime_amount, hourly_rate, currency_code, payment_type, valid_from, valid_until')
      .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).lte('valid_from', today)
      .or(`valid_until.is.null,valid_until.gte.${today}`).order('valid_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })) : Promise.resolve({ data: [], error: null })
  const organizationQuery = includeOverviewData
    ? (() => {
      const query = supabase.from('employee_organizations')
        .select('employment_id, job_title, direct_manager_id, effective_from, effective_to, departments!employee_organizations_department_hr_group_fkey(name)')
        .eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('employee_id', employeeId).lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`).order('effective_from', { ascending: false }).limit(100)
      return query
    })()
    : Promise.resolve({ data: [], error: null })
  const contractsQuery = includeOverviewData
    ? supabase.from('employment_contracts').select('employment_id, worker_type, duration_type, starts_on, ends_on, labor_condition_sets!employment_contracts_labor_condition_set_fkey(name)')
      .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).lte('starts_on', today)
      .or(`ends_on.is.null,ends_on.gte.${today}`).order('starts_on', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const profileLinksQuery = includeOverviewData
    ? supabase.from('employee_profile_links').select('id, label, url, link_type').eq('tenant_id', context.tenantId).eq('employee_id', employeeId).order('sort_order').order('created_at').limit(50)
    : Promise.resolve({ data: [], error: null })
  const settingsQuery = context.administrationId
    ? supabase.from('administration_hr_settings').select('default_employment_country_code').eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).maybeSingle()
    : Promise.resolve({ data: null, error: null })
  const isSelf = context.employeeId === employeeId
  const capabilityValuesPromise = Promise.all([
    permissionAllowed(isSelf ? 'self:employee:write' : 'employee:write', employeeId),
    includePersonalData ? permissionAllowed(isSelf ? 'self:employee-bsn:read' : 'employee-bsn:read', employeeId) : Promise.resolve(false),
    includePersonalData ? permissionAllowed('employee-bsn:write', employeeId) : Promise.resolve(false),
    includePersonalData ? permissionAllowed(context.employeeId === employeeId ? 'self:address:write' : 'employee:write', employeeId) : Promise.resolve(false),
    includePersonalData ? permissionAllowed(context.employeeId === employeeId ? 'self:relation:write' : 'employee:write', employeeId) : Promise.resolve(false),
    includePersonalData ? permissionAllowed('bank-account:write', employeeId) : Promise.resolve(false),
  ])
  const [
    { data: employee, error: employeeError }, { data: employments, error: employmentsError },
    { data: addresses, error: addressesError },
    { data: bankAccounts, error: bankError },
    { data: relations, error: relationsError },
    { data: relationTypes, error: relationTypesError },
    { data: laborConditions, error: laborConditionsError },
    { data: schedules, error: schedulesError },
    { data: contracts, error: contractsError },
    salaryResult,
    { data: organizations, error: organizationsError },
    { data: profileLinks, error: profileLinksError },
    { data: settings, error: settingsError },
    capabilityValues,
    canReadSalary,
  ] = await Promise.all([
    employeeQuery,
    employmentsQuery,
    addressesQuery,
    bankAccountsQuery,
    relationsQuery,
    relationTypesQuery,
    laborConditionsQuery,
    schedulesQuery,
    contractsQuery,
    salaryQuery,
    organizationQuery,
    profileLinksQuery,
    settingsQuery,
    capabilityValuesPromise,
    canReadSalaryPromise,
  ])
  if (employeeError || !employee) throw new EmploymentServiceError('EMPLOYEE_NOT_FOUND', 404)
  const detailReadFailureCode = employeeDetailReadFailureCode({
    addresses: addressesError !== null,
    bankAccounts: bankError !== null,
    relations: relationsError !== null || relationTypesError !== null,
  })
  if (detailReadFailureCode || employmentsError || laborConditionsError || schedulesError || contractsError || organizationsError || profileLinksError || settingsError || salaryResult.error) throw new EmploymentServiceError(detailReadFailureCode ?? 'EMPLOYMENT_SUMMARY_READ_FAILED', 500)

  const currentEmploymentSummary = selectCurrentEmploymentSummary({
    today,
    employments: employments.map((employment) => ({ id: employment.id, startsOn: employment.starts_on, endsOn: employment.ends_on, recordStatus: employment.record_status })),
    laborConditions: (laborConditions ?? []).map((item) => ({ employmentId: item.employment_id, value: item.condition_group, validFrom: item.valid_from, validUntil: item.valid_until })),
    schedules: (schedules ?? []).map((item) => ({ employmentId: item.employment_id, value: item.average_hours_per_week, validFrom: item.valid_from, validUntil: item.valid_until })),
    salaries: (salaryResult.data ?? []).flatMap((item) => {
      const amount = item.payment_type === 'PERIODIC_FIXED' ? item.fulltime_amount : item.hourly_rate
      return amount === null ? [] : [{ employmentId: item.employment_id, amount, currencyCode: item.currency_code, paymentType: item.payment_type, validFrom: item.valid_from, validUntil: item.valid_until }]
    }),
    organizations: (organizations ?? []).map((item) => ({ employmentId: item.employment_id, departmentName: item.departments?.name ?? null, jobTitle: item.job_title, validFrom: item.effective_from, validUntil: item.effective_to })),
  })
  const currentOrganization = (organizations ?? []).find((item) => item.employment_id === currentEmploymentSummary.employmentId)
  if (currentOrganization?.direct_manager_id) {
    const { data: manager } = await supabase.from('employees').select('first_name, birth_name').eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('id', currentOrganization.direct_manager_id).is('deleted_at', null).maybeSingle()
    currentEmploymentSummary.managerName = manager ? `${manager.first_name} ${manager.birth_name}` : null
  }

  return {
    employee: {
      id: employee.id,
      employeeNumber: employee.employee_number,
      firstName: employee.first_name,
      birthName: employee.birth_name,
      workEmail: employee.work_email,
      privateEmail: employee.private_email,
      updatedAt: employee.updated_at,
      title: employee.title,
      initials: employee.initials,
      birthNamePrefix: employee.birth_name_prefix,
      partnerNamePrefix: employee.partner_name_prefix,
      partnerName: employee.partner_name,
      nameUsage: employee.name_usage,
      gender: employee.gender,
      pronouns: employee.pronouns,
      birthDate: employee.birth_date,
      birthPlace: employee.birth_place,
      birthCountry: employee.birth_country,
      nationality: employee.nationality,
      maritalStatus: employee.marital_status,
      maritalStatusDate: employee.marital_status_date,
      educationLevel: employee.education_level,
      preferredLanguage: employee.preferred_language,
      privatePhone: employee.private_phone,
      privateMobile: employee.private_mobile,
      workPhone: employee.work_phone,
      workPhoneExt: employee.work_phone_ext,
      workMobile: employee.work_mobile,
      avatarUrl: employeeAvatarHref(employee.id, employee.avatar_url),
      originalHireDate: employee.original_hire_date,
      isActive: employee.is_active,
      isArchived: employee.is_archived,
    },
    employments,
    defaultCountryCode: settings?.default_employment_country_code ?? 'NL',
    employmentCards: employments.map((employment) => {
      const organization = (organizations ?? []).find((item) => item.employment_id === employment.id)
      const schedule = (schedules ?? []).find((item) => item.employment_id === employment.id)
      const contract = (contracts ?? []).find((item) => item.employment_id === employment.id)
      return {
        employmentId: employment.id,
        administrationName: employment.administrations?.name ?? null,
        departmentName: organization?.departments?.name ?? null,
        jobTitle: organization?.job_title ?? null,
        hoursPerWeek: schedule?.average_hours_per_week ?? null,
        laborConditionName: contract?.labor_condition_sets?.name ?? null,
        employmentType: employment.employment_type ?? null,
        workerType: contract?.worker_type ?? null,
        contractType: contract?.duration_type ?? null,
      }
    }),
    status: deriveEmploymentStatus(
      employments.map((employment) => ({
        startsOn: employment.starts_on,
        endsOn: employment.ends_on,
        recordStatus: employment.record_status,
      })),
      new Date().toISOString().slice(0, 10),
    ),
    addresses: (addresses ?? []).map((address) => ({
      addressType: address.address_type as 'PRIMARY' | 'SECONDARY', description: address.description,
      id: address.id, addressLine1: address.address_line_1, addressLine2: address.address_line_2,
      street: address.street, houseNumber: address.house_number,
      houseNumberAddition: address.house_number_addition, postalCode: address.postal_code, city: address.city,
      region: address.region, countryCode: address.country_code,
      source: address.source, sourceReference: address.source_reference,
      validFrom: address.valid_from, validUntil: address.valid_until,
    })),
    bankAccounts: (bankAccounts ?? []).map((account) => ({
      id: account.id, maskedIban: `•••• ${account.iban_last_four}`, bic: account.bic,
      accountHolder: account.account_holder, description: account.description,
      isPrimary: account.is_primary,
    })),
    relations: (relations ?? []).map((relation) => ({
      id: relation.id, relationType: relation.relation_type,
      isEmergencyContact: relation.is_emergency_contact, firstName: relation.first_name,
      initials: relation.initials, prefix: relation.prefix, lastName: relation.last_name,
      gender: relation.gender, birthDate: relation.birth_date, phone: relation.phone,
      mobile: relation.mobile, email: relation.email, notes: relation.notes,
    })),
    relationTypes: (relationTypes ?? []).map((relationType) => ({ code: relationType.code, nameNl: relationType.name_nl, nameEn: relationType.name_en })),
    currentEmploymentSummary,
    profileLinks: (profileLinks ?? []).map((link) => ({ id: link.id, label: link.label, url: link.url, linkType: link.link_type })),
    capabilities: {
      canEditEmployee: capabilityValues[0], canReadBsn: capabilityValues[1],
      canWriteBsn: capabilityValues[2], canManageAddresses: capabilityValues[3],
      canManageRelations: capabilityValues[4], canManageBankAccounts: capabilityValues[5], canReadSalary,
    },
  }
}

export async function getEmployeeSalarySummary(employeeId: string, employmentId?: string): Promise<CurrentEmployeeSummary['salary']> {
  await requirePermission('salary:read', employeeId)
  if (employmentId) {
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase.from('employment_salaries')
      .select('employment_id, fulltime_amount, hourly_rate, currency_code, payment_type')
      .eq('employee_id', employeeId).eq('employment_id', employmentId).lte('valid_from', today)
      .or(`valid_until.is.null,valid_until.gte.${today}`).order('valid_from', { ascending: false }).limit(1).maybeSingle()
    if (error) throw new EmploymentServiceError('EMPLOYEE_SALARY_READ_FAILED', 500)
    if (!data) return null
    const amount = data.payment_type === 'PERIODIC_FIXED' ? data.fulltime_amount : data.hourly_rate
    return amount === null ? null : { amount, currencyCode: data.currency_code, paymentType: data.payment_type }
  }
  const detail = await getEmployeeEmploymentDetail(employeeId, 'overview', { includeSalary: true })
  return detail.currentEmploymentSummary.salary
}

export async function getTerminationOptions(): Promise<{
  internalReasons: Array<{ id: string; name: string }>
  statutoryReasons: Array<{ id: string; code: string; label: string }>
}> {
  const context = await requirePermission('contract:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [internalResult, statutoryResult] = await Promise.all([
    supabase
      .from('employment_end_reasons')
      .select('id, name_nl')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .eq('is_active', true)
      .order('name_nl'),
    supabase
      .from('statutory_termination_reasons')
      .select('id, code, label_nl')
      .lte('valid_from', today)
      .or(`valid_until.is.null,valid_until.gt.${today}`)
      .order('code'),
  ])
  if (internalResult.error || statutoryResult.error) {
    throw new EmploymentServiceError('TERMINATION_OPTIONS_FAILED', 500)
  }
  return {
    internalReasons: internalResult.data.map((reason) => ({ id: reason.id, name: reason.name_nl })),
    statutoryReasons: statutoryResult.data.map((reason) => ({
      id: reason.id,
      code: reason.code,
      label: reason.label_nl,
    })),
  }
}

export async function terminateEmployment(
  employmentId: string,
  input: TerminationInput,
): Promise<string> {
  const supabase = await createClient()
  const { data: employment, error: readError } = await supabase
    .from('employments')
    .select('tenant_id, hr_group_id, administration_id, employee_id, starts_on')
    .eq('id', employmentId)
    .maybeSingle()
  if (readError || !employment) throw new EmploymentServiceError('EMPLOYMENT_NOT_FOUND', 404)

  const context = await requirePermission('contract:write', employment.employee_id)
  if (
    context.tenantId !== employment.tenant_id ||
    context.administrationId !== employment.administration_id
  ) {
    throw new EmploymentServiceError('EMPLOYMENT_NOT_FOUND', 404)
  }
  if (input.lastWorkingDay < employment.starts_on) {
    throw new EmploymentServiceError('TERMINATION_DATE_INVALID', 400)
  }

  const { data: termination, error: insertError } = await supabase
    .from('employment_terminations')
    .insert({
      tenant_id: context.tenantId,
      hr_group_id: employment.hr_group_id,
      administration_id: employment.administration_id,
      employee_id: employment.employee_id,
      employment_id: employmentId,
      last_working_day: input.lastWorkingDay,
      internal_reason_id: input.internalReasonId,
      statutory_reason_id: input.statutoryReasonId,
      initiator: input.initiator,
      explanation: input.explanation ?? null,
      created_by_user_id: context.userId,
    })
    .select('id')
    .single()
  if (insertError?.code === '23505') throw new EmploymentServiceError('TERMINATION_ALREADY_EXISTS', 409)
  if (insertError || !termination) throw new EmploymentServiceError('TERMINATION_CREATE_FAILED', 500)

  const { error: confirmError } = await supabase.rpc('confirm_employment_termination', {
    requested_termination_id: termination.id,
  })
  if (confirmError) {
    const code = confirmError.message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'TERMINATION_CONFIRM_FAILED'
    throw new EmploymentServiceError(code, code.includes('CONFLICT') ? 409 : 400)
  }
  return termination.id
}
