import 'server-only'

import type { Database, Json } from '@scope/db'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { createBsnFingerprint } from '@/lib/security/bsn-fingerprint'
import { createClient } from '@/lib/supabase/server'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { employeeDetailReadFailureCode } from './detail-errors'
import { deriveEmploymentStatus, isRehire, type EmploymentStatus } from './employment-status'
import { selectCurrentEmploymentSummary, type CurrentEmployeeSummary } from './employee-summary'
import { mapEmployeeOverviewRpcRow, type EmployeeOverview } from './employee-overview'
import type {
  CompleteEmploymentCreateInput,
  CreateEmploymentInput,
  IdentityMatchInput,
  TerminationInput,
} from './schemas'

type EmploymentRow = Database['public']['Tables']['employments']['Row']

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
  matchKind: 'BSN_EXACT' | 'FUZZY'
}

export type EmployeeArchiveFilter = 'active' | 'archived' | 'all'

export type { EmployeeOverview } from './employee-overview'

export interface EmploymentCreationOptions {
  departments: Array<{ id: string; code: string; name: string }>
  jobs: Array<{ id: string; code: string; name: string }>
  costCenters: Array<{ id: string; code: string; name: string }>
  costCarriers: Array<{ id: string; code: string; name: string }>
  laborConditionSets: Array<{ id: string; code: string; name: string; standardHoursPerWeek: number }>
  flexPhases: Array<{ id: string; code: string; name: string }>
  salaryFrequencies: Array<{ id: string; code: string; name: string }>
  minimumWageRates: Array<{
    minimumAge: number
    hourlyAmount: number
    validFrom: string
    validUntil: string | null
  }>
  salaryScaleSteps: Array<{
    id: string
    label: string
    fulltimeAmount: number
  }>
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
    departmentName: string | null
    jobTitle: string | null
    hoursPerWeek: number | null
    laborConditionName: string | null
    workerType: Database['public']['Enums']['employment_worker_type'] | null
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

export async function findIdentityCandidates(input: IdentityMatchInput): Promise<IdentityCandidate[]> {
  const context = await requirePermission('employee:match')
  const supabase = await createClient()

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
      .select('id, employee_number, first_name, birth_name, birth_date')
      .eq('tenant_id', context.tenantId)
      .in('id', employeeIds)
      .is('deleted_at', null)
      .limit(1)
    if (error) throw new EmploymentServiceError('IDENTITY_MATCH_FAILED', 500)
    return data.map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employee_number,
      firstName: employee.first_name,
      birthName: employee.birth_name,
      birthDate: employee.birth_date,
      matchKind: 'BSN_EXACT' as const,
    }))
  }

  if (!input.birthDate || !input.birthName) return []
  let query = supabase
    .from('employees')
    .select('id, employee_number, first_name, birth_name, birth_date, initials, private_email')
    .eq('tenant_id', context.tenantId)
    .eq('birth_date', input.birthDate)
    .ilike('birth_name', input.birthName)
    .is('deleted_at', null)

  if (input.initials) query = query.ilike('initials', input.initials)
  if (input.privateEmail) query = query.eq('private_email', input.privateEmail.toLowerCase())

  const { data, error } = await query.order('employee_number').limit(10)
  if (error) throw new EmploymentServiceError('IDENTITY_MATCH_FAILED', 500)
  return data.map((employee) => ({
    id: employee.id,
    employeeNumber: employee.employee_number,
    firstName: employee.first_name,
    birthName: employee.birth_name,
    birthDate: employee.birth_date,
    matchKind: 'FUZZY' as const,
  }))
}

export async function createEmployment(input: CreateEmploymentInput): Promise<{
  employment: EmploymentRow
  isRehire: boolean
}> {
  const context = await requirePermission('contract:write', input.employeeId)
  const administrationId = requireAdministrationId(context.administrationId)
  const supabase = await createClient()
  const { data: assignment, error: assignmentError } = await supabase
    .from('employee_administration_assignments')
    .select('id')
    .eq('tenant_id', context.tenantId)
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
    .eq('employee_id', input.employeeId)
    .is('deleted_at', null)
  if (historyError) throw new EmploymentServiceError('EMPLOYMENT_HISTORY_FAILED', 500)

  const { data, error } = await supabase
    .from('employments')
    .insert({
      tenant_id: context.tenantId,
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
): Promise<string> {
  const context = await requirePermission('contract:write', employeeId)
  const administrationId = requireAdministrationId(context.administrationId)
  await requirePermission('organization-placement:write', employeeId)
  if (input.salary) await requirePermission('salary:write', employeeId)

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('publish_complete_employment', {
    requested_employee_id: employeeId,
    requested_administration_id: administrationId,
    requested_payload: input as Json,
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
): Promise<EmploymentCreationOptions> {
  const context = await requirePermission('contract:write', employeeId)
  await requirePermission('organization-placement:write', employeeId)
  const administrationId = requireAdministrationId(context.administrationId)
  const canWriteSalary = await permissionAllowed('salary:write', employeeId)
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [currentYear, currentMonth] = today.split('-').map(Number)
  const defaultStartDate = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString().slice(0, 10)

  const [
    departmentsResult, jobsResult, costCentersResult, costCarriersResult,
    laborConditionSetsResult, flexPhasesResult, salaryFrequenciesResult,
    hrSettingsResult, employeeResult, bsnResult, primaryResult, ikvResult,
    minimumWagesResult, scaleStepsResult,
  ] = await Promise.all([
    supabase.from('departments').select('id, code, name')
      .eq('tenant_id', context.tenantId)
      .eq('is_active', true).order('code').limit(500),
    supabase.from('jobs').select('id, code, job_revisions(name)')
      .eq('tenant_id', context.tenantId)
      .eq('is_active', true).order('code').limit(500),
    supabase.from('cost_centers').select('id, code, name')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .eq('is_active', true).order('code').limit(500),
    supabase.from('cost_carriers').select('id, code, name')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .eq('is_active', true).order('code').limit(500),
    supabase.from('labor_condition_sets').select('id, code, name, standard_hours_per_week')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
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
    supabase.from('income_relationships').select('ikv_number')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .order('ikv_number', { ascending: false }).limit(1),
    canWriteSalary
      ? supabase.from('statutory_minimum_wages')
        .select('minimum_age, hourly_amount, valid_from, valid_until')
        .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
        .eq('country_code', 'NL').order('valid_from').order('minimum_age').limit(100)
      : Promise.resolve({ data: [], error: null }),
    canWriteSalary
      ? supabase.from('salary_scale_steps')
        .select('id, step_code, step_name, fulltime_amount, salary_scales(code, name)')
        .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
        .lte('valid_from', today).or(`valid_until.is.null,valid_until.gt.${today}`)
        .order('fulltime_amount').limit(500)
      : Promise.resolve({ data: [], error: null }),
  ])
  const optionResults = [
    departmentsResult, jobsResult, costCentersResult, costCarriersResult,
    laborConditionSetsResult, flexPhasesResult, salaryFrequenciesResult,
    hrSettingsResult, employeeResult, bsnResult, primaryResult, ikvResult,
    minimumWagesResult, scaleStepsResult,
  ]
  if (optionResults.some((result) => result.error) || !employeeResult.data) {
    throw new EmploymentServiceError('EMPLOYMENT_OPTIONS_FAILED', 500)
  }

  return {
    departments: departmentsResult.data ?? [],
    jobs: (jobsResult.data ?? []).map((job) => ({
      id: job.id,
      code: job.code,
      name: job.job_revisions[0]?.name ?? job.code,
    })),
    costCenters: costCentersResult.data ?? [],
    costCarriers: costCarriersResult.data ?? [],
    laborConditionSets: (laborConditionSetsResult.data ?? []).map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      standardHoursPerWeek: item.standard_hours_per_week,
    })),
    flexPhases: flexPhasesResult.data ?? [],
    salaryFrequencies: salaryFrequenciesResult.data ?? [],
    minimumWageRates: (minimumWagesResult.data ?? []).map((rate) => ({
      minimumAge: rate.minimum_age,
      hourlyAmount: rate.hourly_amount,
      validFrom: rate.valid_from,
      validUntil: rate.valid_until,
    })),
    salaryScaleSteps: (scaleStepsResult.data ?? []).map((step) => ({
      id: step.id,
      label: `${step.salary_scales?.code ?? ''} · ${step.step_name || step.step_code}`,
      fulltimeAmount: step.fulltime_amount,
    })),
    nextIkvNumber: Math.min((ikvResult.data?.[0]?.ikv_number ?? 0) + 1, 99),
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
  }
}

export async function listEmployeeEmployments(employeeId: string): Promise<EmploymentRow[]> {
  const context = await requirePermission('contract:read', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employments')
    .select('*')
    .eq('tenant_id', context.tenantId)
    .eq('employee_id', employeeId)
    .is('deleted_at', null)
    .order('starts_on', { ascending: false })
    .order('is_primary', { ascending: false })
    .limit(100)
  if (error) throw new EmploymentServiceError('EMPLOYMENT_READ_FAILED', 500)
  return data
}

export async function listEmployeesOverview(archiveFilter: EmployeeArchiveFilter = 'active'): Promise<EmployeeOverview[]> {
  const context = await requirePermission('employee:read')
  const administrationId = requireAdministrationId(context.administrationId)
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase.rpc('list_employee_overviews', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: administrationId,
    requested_as_of: today,
    requested_archive_filter: archiveFilter,
  })
  if (error) throw new EmploymentServiceError('EMPLOYEE_OVERVIEW_FAILED', 500)

  return data.map((employee) => mapEmployeeOverviewRpcRow(employee, today))
}

export async function getEmployeeEmploymentDetail(
  employeeId: string,
  scope: EmployeeDetailLoadScope = 'all',
  options: EmployeeDetailLoadOptions = {},
): Promise<EmployeeEmploymentDetail> {
  const context = await requirePermission('employee:read', employeeId)
  const supabase = await createClient()
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
    .eq('tenant_id', context.tenantId).eq('id', employeeId).is('deleted_at', null).maybeSingle()
  const employmentsQuery = supabase.from('employments').select('*')
    .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).is('deleted_at', null)
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
        .select('employment_id, job_title, direct_manager_id, effective_from, effective_to, departments!employee_organizations_department_id_fkey(name)')
        .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`).order('effective_from', { ascending: false }).limit(100)
      if (context.administrationId) query.eq('administration_id', context.administrationId)
      return query
    })()
    : Promise.resolve({ data: [], error: null })
  const contractsQuery = includeOverviewData
    ? supabase.from('employment_contracts').select('employment_id, worker_type, starts_on, ends_on, labor_condition_sets(name)')
      .eq('tenant_id', context.tenantId).eq('employee_id', employeeId).lte('starts_on', today)
      .or(`ends_on.is.null,ends_on.gte.${today}`).order('starts_on', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const profileLinksQuery = includeOverviewData
    ? supabase.from('employee_profile_links').select('id, label, url, link_type').eq('tenant_id', context.tenantId).eq('employee_id', employeeId).order('sort_order').order('created_at').limit(50)
    : Promise.resolve({ data: [], error: null })
  const settingsQuery = context.administrationId
    ? supabase.from('administration_hr_settings').select('default_employment_country_code').eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).maybeSingle()
    : Promise.resolve({ data: null, error: null })
  const capabilityValuesPromise = Promise.all([
    permissionAllowed('employee:write', employeeId),
    includePersonalData ? permissionAllowed('employee-bsn:read', employeeId) : Promise.resolve(false),
    includePersonalData ? permissionAllowed('employee-bsn:write', employeeId) : Promise.resolve(false),
    includePersonalData ? permissionAllowed(context.employeeId === employeeId ? 'address:write' : 'employee:write', employeeId) : Promise.resolve(false),
    includePersonalData ? permissionAllowed(context.employeeId === employeeId ? 'relation:write' : 'employee:write', employeeId) : Promise.resolve(false),
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
    const { data: manager } = await supabase.from('employees').select('first_name, birth_name').eq('tenant_id', context.tenantId).eq('id', currentOrganization.direct_manager_id).is('deleted_at', null).maybeSingle()
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
        departmentName: organization?.departments?.name ?? null,
        jobTitle: organization?.job_title ?? null,
        hoursPerWeek: schedule?.average_hours_per_week ?? null,
        laborConditionName: contract?.labor_condition_sets?.name ?? null,
        workerType: contract?.worker_type ?? null,
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
  const administrationId = requireAdministrationId(context.administrationId)
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [internalResult, statutoryResult] = await Promise.all([
    supabase
      .from('employment_end_reasons')
      .select('id, name_nl')
      .eq('tenant_id', context.tenantId)
      .eq('administration_id', administrationId)
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
    .select('tenant_id, administration_id, employee_id, starts_on')
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
