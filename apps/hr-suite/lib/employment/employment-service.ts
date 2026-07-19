import 'server-only'

import type { Database, Json } from '@scope/db'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { createBsnFingerprint } from '@/lib/security/bsn-fingerprint'
import { createClient } from '@/lib/supabase/server'
import { employeeDetailReadFailureCode } from './detail-errors'
import { deriveEmploymentStatus, isRehire, type EmploymentStatus } from './employment-status'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
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

export interface EmployeeOverview {
  id: string
  employeeNumber: string
  firstName: string
  birthNamePrefix: string | null
  birthName: string
  departmentName: string | null
  jobTitle: string | null
  workEmail: string | null
  avatarUrl: string | null
  isArchived: boolean
  status: EmploymentStatus
  employmentCount: number
}

export type EmployeeArchiveFilter = 'active' | 'archived' | 'all'

export interface EmploymentCreationOptions {
  departments: Array<{ id: string; code: string; name: string }>
  costCenters: Array<{ id: string; code: string; name: string }>
  salaryScaleSteps: Array<{
    id: string
    label: string
    fulltimeAmount: number
  }>
  nextIkvNumber: number
  canWriteSalary: boolean
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
  status: EmploymentStatus
  addresses: Array<{
    id: string; street: string; houseNumber: string; addition: string | null
    postalCode: string; city: string; province: string | null; countryCode: string
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
  capabilities: {
    canEditEmployee: boolean
    canReadBsn: boolean
    canWriteBsn: boolean
    canManageAddresses: boolean
    canManageRelations: boolean
    canManageBankAccounts: boolean
  }
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

  const [departmentsResult, costCentersResult, ikvResult, scaleStepsResult] = await Promise.all([
    supabase.from('departments').select('id, code, name')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .eq('is_active', true).order('code').limit(500),
    supabase.from('cost_centers').select('id, code, name')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .eq('is_active', true).order('code').limit(500),
    supabase.from('income_relationships').select('ikv_number')
      .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
      .order('ikv_number', { ascending: false }).limit(1),
    canWriteSalary
      ? supabase.from('salary_scale_steps')
        .select('id, step_code, step_name, fulltime_amount, salary_scales(code, name)')
        .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
        .lte('valid_from', today).or(`valid_until.is.null,valid_until.gt.${today}`)
        .order('fulltime_amount').limit(500)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (departmentsResult.error || costCentersResult.error || ikvResult.error || scaleStepsResult.error) {
    throw new EmploymentServiceError('EMPLOYMENT_OPTIONS_FAILED', 500)
  }

  return {
    departments: departmentsResult.data,
    costCenters: costCentersResult.data,
    salaryScaleSteps: (scaleStepsResult.data ?? []).map((step) => ({
      id: step.id,
      label: `${step.salary_scales?.code ?? ''} · ${step.step_name || step.step_code}`,
      fulltimeAmount: step.fulltime_amount,
    })),
    nextIkvNumber: (ikvResult.data[0]?.ikv_number ?? 0) + 1,
    canWriteSalary,
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
    .limit(100)
  if (error) throw new EmploymentServiceError('EMPLOYMENT_READ_FAILED', 500)
  return data
}

export async function listEmployeesOverview(archiveFilter: EmployeeArchiveFilter = 'active'): Promise<EmployeeOverview[]> {
  const context = await requirePermission('employee:read')
  const administrationId = requireAdministrationId(context.administrationId)
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data: assignments, error: assignmentError } = await supabase
    .from('employee_administration_assignments')
    .select('employee_id')
    .eq('tenant_id', context.tenantId)
    .eq('administration_id', administrationId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .limit(500)
  if (assignmentError) throw new EmploymentServiceError('EMPLOYEE_SCOPE_READ_FAILED', 500)

  const employeeIds = [...new Set(assignments.map((assignment) => assignment.employee_id))]
  if (employeeIds.length === 0) return []
  const [
    { data: employees, error: employeeError },
    { data: employments, error: employmentError },
    { data: placements, error: placementError },
  ] =
    await Promise.all([
      supabase
        .from('employees')
        .select('id, employee_number, first_name, birth_name_prefix, birth_name, work_email, avatar_url, is_archived')
        .eq('tenant_id', context.tenantId)
        .in('id', employeeIds)
        .is('deleted_at', null)
        .order('birth_name')
        .order('first_name')
        .limit(500),
      supabase
        .from('employments')
        .select('employee_id, starts_on, ends_on, record_status')
        .eq('tenant_id', context.tenantId)
        .in('employee_id', employeeIds)
        .is('deleted_at', null)
        .limit(1_000),
      supabase
        .from('employee_organizations')
        .select('employee_id, job_title, effective_from, departments!employee_organizations_department_id_fkey(name)')
        .eq('tenant_id', context.tenantId)
        .eq('administration_id', administrationId)
        .in('employee_id', employeeIds)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('effective_from', { ascending: false })
        .limit(1_000),
    ])
  if (employeeError || employmentError || placementError) throw new EmploymentServiceError('EMPLOYEE_OVERVIEW_FAILED', 500)

  const scopedEmployees = (employees ?? []).filter((employee) => archiveFilter === 'all' || (archiveFilter === 'archived' ? employee.is_archived : !employee.is_archived))
  const placementByEmployeeId = new Map<string, { departmentName: string | null; jobTitle: string | null }>()
  for (const placement of placements ?? []) {
    if (placementByEmployeeId.has(placement.employee_id)) continue
    placementByEmployeeId.set(placement.employee_id, {
      departmentName: placement.departments?.name ?? null,
      jobTitle: placement.job_title,
    })
  }

  return scopedEmployees.map((employee) => {
    const periods = employments
      .filter((employment) => employment.employee_id === employee.id)
      .map((employment) => ({
        startsOn: employment.starts_on,
        endsOn: employment.ends_on,
        recordStatus: employment.record_status,
      }))
    const placement = placementByEmployeeId.get(employee.id)
    return {
      id: employee.id,
      employeeNumber: employee.employee_number,
      firstName: employee.first_name,
      birthNamePrefix: employee.birth_name_prefix,
      birthName: employee.birth_name,
      departmentName: placement?.departmentName ?? null,
      jobTitle: placement?.jobTitle ?? null,
      workEmail: employee.work_email,
      avatarUrl: employeeAvatarHref(employee.id, employee.avatar_url),
      isArchived: employee.is_archived,
      status: deriveEmploymentStatus(periods, today),
      employmentCount: periods.length,
    }
  })
}

export async function getEmployeeEmploymentDetail(
  employeeId: string,
): Promise<EmployeeEmploymentDetail> {
  const context = await requirePermission('employee:read', employeeId)
  const supabase = await createClient()
  const [
    { data: employee, error: employeeError }, employments,
    { data: addresses, error: addressesError },
    { data: bankAccounts, error: bankError },
    { data: relations, error: relationsError },
    { data: relationTypes, error: relationTypesError },
    capabilityValues,
  ] = await Promise.all([
    supabase
      .from('employees')
      .select(`id, employee_number, title, initials, first_name, birth_name_prefix,
        birth_name, partner_name_prefix, partner_name, name_usage, gender, pronouns,
        birth_date, birth_place, birth_country, nationality, marital_status,
        marital_status_date, education_level, preferred_language, private_email,
        private_phone, private_mobile, work_email, work_phone, work_phone_ext,
        work_mobile, avatar_url, original_hire_date, is_active, is_archived, updated_at`)
      .eq('tenant_id', context.tenantId)
      .eq('id', employeeId)
      .is('deleted_at', null)
      .maybeSingle(),
    listEmployeeEmployments(employeeId),
    supabase.from('employee_addresses').select('*')
      .eq('tenant_id', context.tenantId).eq('employee_id', employeeId)
      .is('deleted_at', null).order('valid_from', { ascending: false }).limit(100),
    supabase.from('employee_bank_accounts')
      .select('id, iban_last_four, bic, account_holder, description, is_primary')
      .eq('tenant_id', context.tenantId).eq('employee_id', employeeId)
      .is('deleted_at', null).order('is_primary', { ascending: false }).limit(100),
    supabase.from('employee_relations').select('*')
      .eq('tenant_id', context.tenantId).eq('employee_id', employeeId)
      .is('deleted_at', null).order('is_emergency_contact', { ascending: false }).limit(100),
    supabase.from('relation_types').select('code, name_nl, name_en').eq('tenant_id', context.tenantId).eq('is_active', true).order('name_nl').limit(100),
    Promise.all([
      permissionAllowed('employee:write', employeeId),
      permissionAllowed('employee-bsn:read', employeeId),
      permissionAllowed('employee-bsn:write', employeeId),
      permissionAllowed(context.employeeId === employeeId ? 'address:write' : 'employee:write', employeeId),
      permissionAllowed(context.employeeId === employeeId ? 'relation:write' : 'employee:write', employeeId),
      permissionAllowed('bank-account:write', employeeId),
    ]),
  ])
  if (employeeError || !employee) throw new EmploymentServiceError('EMPLOYEE_NOT_FOUND', 404)
  const detailReadFailureCode = employeeDetailReadFailureCode({
    addresses: addressesError !== null,
    bankAccounts: bankError !== null,
    relations: relationsError !== null || relationTypesError !== null,
  })
  if (detailReadFailureCode) throw new EmploymentServiceError(detailReadFailureCode, 500)

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
    status: deriveEmploymentStatus(
      employments.map((employment) => ({
        startsOn: employment.starts_on,
        endsOn: employment.ends_on,
        recordStatus: employment.record_status,
      })),
      new Date().toISOString().slice(0, 10),
    ),
    addresses: (addresses ?? []).map((address) => ({
      id: address.id, street: address.street, houseNumber: address.house_number,
      addition: address.addition, postalCode: address.postal_code, city: address.city,
      province: address.province, countryCode: address.country_code,
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
    capabilities: {
      canEditEmployee: capabilityValues[0], canReadBsn: capabilityValues[1],
      canWriteBsn: capabilityValues[2], canManageAddresses: capabilityValues[3],
      canManageRelations: capabilityValues[4], canManageBankAccounts: capabilityValues[5],
    },
  }
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
