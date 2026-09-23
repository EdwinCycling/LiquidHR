import 'server-only'

import { AuthorizationError, getRequestAuthorizationContext, getSelfPermissions, requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { listEmployeeDashboardDocuments } from '@/lib/documents/document-service'
import { ActualWorkServiceError, getActualWorkEmployeeProjection, type ActualWorkEmployeeProjection } from '@/lib/actual-work/actual-work-service'
import { getLeaveBalanceReport, type LeaveReadDependencies } from '@/lib/leave/leave-service'
import { getEmployeeDirectoryVisibility } from '@/lib/employee-directory/service'
import { listAbsenceConfirmations, type AbsenceConfirmation, type AbsenceConfirmationStatus } from '@/lib/absence/confirmation-service'
import { createClient } from '@/lib/supabase/server'
import { resolveFocusActAsSession, type FocusActAsSession } from './act-as-token'
import { listFocusManagerEmployeeIds } from './team-service'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface FocusSectionContext {
  context: AuthContext
  supabase: SupabaseServerClient
  employeeId: string
  permissions: string[]
  actAs: FocusActAsSession | null
}

export class FocusSectionError extends Error {
  constructor(readonly code: string, readonly status: 400 | 403 | 404 | 500 = 500) {
    super(code)
  }
}

export async function loadFocusSectionContext(actAsToken?: string | null): Promise<FocusSectionContext> {
  const requestContext = await getRequestAuthorizationContext()
  const actAs = await resolveFocusActAsSession(actAsToken, requestContext.context, requestContext.supabase)
  const employeeId = actAs?.subjectEmployeeId ?? requestContext.context.employeeId
  if (!employeeId) throw new AuthorizationError('Er is geen medewerkercontext beschikbaar.')
  const permissions = actAs
    ? await getSelfPermissions(requestContext.supabase, requestContext.context.tenantId)
    : requestContext.context.permissions
  return { context: requestContext.context, supabase: requestContext.supabase, employeeId, permissions, actAs }
}

export function hasFocusPermission(section: FocusSectionContext, ...permissions: string[]): boolean {
  return permissions.some((permission) => section.permissions.includes(permission))
}

export interface FocusAbsenceWorkItem {
  caseId: string
  confirmationId: string
  employeeId: string
  employeeName: string
  firstAbsenceOn: string
  status: Extract<AbsenceConfirmationStatus, 'PENDING' | 'CORRECTION_REQUESTED'>
}

function absenceWorkEmployeeName(row: { first_name: string; birth_name: string }): string {
  return `${row.first_name} ${row.birth_name}`.trim()
}

export async function getFocusAbsenceWork(section: FocusSectionContext): Promise<FocusAbsenceWorkItem[]> {
  if (section.actAs || !hasFocusPermission(section, 'absence:read', 'absence:write')) return []
  const employeeIds = await listFocusManagerEmployeeIds(section.context, section.supabase)
  if (!employeeIds.length) return []
  const confirmations = (await listAbsenceConfirmations(employeeIds, { context: section.context, supabase: section.supabase }))
    .filter((item): item is AbsenceConfirmation & { status: 'PENDING' | 'CORRECTION_REQUESTED' } => item.status === 'PENDING' || item.status === 'CORRECTION_REQUESTED')
  if (!confirmations.length) return []
  const caseIds = confirmations.map((item) => item.caseId)
  const [casesResult, employeesResult] = await Promise.all([
    section.supabase.from('absence_cases').select('id,employee_id,first_absence_on,pending_confirmation').eq('tenant_id', section.context.tenantId).eq('hr_group_id', section.context.hrGroupId ?? '').in('id', caseIds).eq('pending_confirmation', true),
    section.supabase.from('employees').select('id,first_name,birth_name').eq('tenant_id', section.context.tenantId).eq('hr_group_id', section.context.hrGroupId ?? '').in('id', employeeIds).is('deleted_at', null),
  ])
  if (casesResult.error || employeesResult.error) throw new FocusSectionError('FOCUS_ABSENCE_WORK_READ_FAILED')
  const caseById = new Map((casesResult.data ?? []).map((item) => [item.id, item]))
  const employeeById = new Map((employeesResult.data ?? []).map((item) => [item.id, item]))
  return confirmations.flatMap((confirmation): FocusAbsenceWorkItem[] => {
    const absenceCase = caseById.get(confirmation.caseId)
    const employee = employeeById.get(confirmation.employeeId)
    if (!absenceCase || !employee) return []
    return [{
      caseId: confirmation.caseId,
      confirmationId: confirmation.id,
      employeeId: confirmation.employeeId,
      employeeName: absenceWorkEmployeeName(employee),
      firstAbsenceOn: absenceCase.first_absence_on,
      status: confirmation.status,
    }]
  })
}

export interface FocusAbsenceState {
  caseId: string | null
  firstAbsenceOn: string | null
  expectedRecoveryOn: string | null
  pendingConfirmation: boolean
  confirmationStatus: AbsenceConfirmationStatus | null
}

export function isFocusAbsenceCaseVisible(absenceCase: { status: string; recovery_window_ends_on: string | null }, today: string): boolean {
  return absenceCase.status !== 'RECOVERY_WINDOW' || absenceCase.recovery_window_ends_on === null || absenceCase.recovery_window_ends_on >= today
}

export async function getFocusAbsenceState(section: FocusSectionContext, today = new Date().toISOString().slice(0, 10)): Promise<FocusAbsenceState | null> {
  if (!hasFocusPermission(section, 'self:absence:write', 'self:absence:read')) return null
  const groupId = requireHrGroupId(section.context)
  const casesResult = await section.supabase
    .from('absence_cases')
    .select('id,status,first_absence_on,pending_confirmation,recovery_window_ends_on')
    .eq('tenant_id', section.context.tenantId)
    .eq('hr_group_id', groupId)
    .eq('employee_id', section.employeeId)
    .in('status', ['ACTIVE', 'RECOVERY_WINDOW'])
    .is('archived_at', null)
    .order('first_absence_on', { ascending: false })
    .limit(20)
  if (casesResult.error) throw new FocusSectionError('FOCUS_ABSENCE_READ_FAILED')
  const cases = casesResult.data ?? []
  if (!cases.length) return null
  const confirmations = await listAbsenceConfirmations([section.employeeId], { context: section.context, supabase: section.supabase })
  const currentCase = cases.find((absenceCase) => isFocusAbsenceCaseVisible(absenceCase, today))
  if (!currentCase) return null
  const confirmation = confirmations.find((item) => item.caseId === currentCase.id) ?? null
  const spellResult = await section.supabase
    .from('absence_spells')
    .select('expected_recovery_on')
    .eq('tenant_id', section.context.tenantId)
    .eq('hr_group_id', groupId)
    .eq('case_id', currentCase.id)
    .is('recovered_on', null)
    .order('started_on', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (spellResult.error) throw new FocusSectionError('FOCUS_ABSENCE_READ_FAILED')
  return {
    caseId: currentCase.id,
    firstAbsenceOn: currentCase.first_absence_on,
    expectedRecoveryOn: spellResult.data?.expected_recovery_on ?? null,
    pendingConfirmation: currentCase.pending_confirmation,
    confirmationStatus: confirmation?.status ?? null,
  }
}

export interface FocusProfileProjection {
  employeeId: string
  firstName: string
  updatedAt: string
  canEdit: boolean
  canEditRelations: boolean
  name: string
  avatarUrl: string | null
  editable: {
    title: string | null
    initials: string | null
    firstName: string
    birthNamePrefix: string | null
    birthName: string
    partnerNamePrefix: string | null
    partnerName: string | null
    nameUsage: 'BIRTH_NAME' | 'PARTNER_NAME' | 'PARTNER_BEFORE_BIRTH_NAME' | 'BIRTH_NAME_BEFORE_PARTNER_NAME'
    privateEmail: string | null
    privatePhone: string | null
    privateMobile: string | null
  }
  personal: Array<{ key: 'language'; value: string }>
  contact: Array<{ key: 'workEmail' | 'workPhone' | 'privateEmail' | 'privatePhone' | 'privateMobile'; value: string; href?: string }>
  relations: Array<{
    id: string
    relationType: string
    isEmergencyContact: boolean
    firstName: string | null
    initials: string | null
    prefix: string | null
    lastName: string
    gender: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | null
    birthDate: string | null
    phone: string | null
    mobile: string | null
    email: string | null
    notes: string | null
  }>
  relationTypes: Array<{ code: string; nameNl: string; nameEn: string }>
  address: string[]
  work: Array<{ key: 'jobTitle' | 'department' | 'startDate' | 'hoursPerWeek'; value: string }>
  bank: { iban: string; bic: string | null; holder: string | null } | null
}

const DEFAULT_FOCUS_RELATION_TYPES = [
  { code: 'PARTNER', nameNl: 'Partner', nameEn: 'Partner' },
  { code: 'CHILD', nameNl: 'Kind', nameEn: 'Child' },
  { code: 'PARENT', nameNl: 'Ouder', nameEn: 'Parent' },
  { code: 'SIBLING', nameNl: 'Broer of zus', nameEn: 'Sibling' },
  { code: 'DOCTOR', nameNl: 'Huisarts', nameEn: 'Doctor' },
  { code: 'DENTIST', nameNl: 'Tandarts', nameEn: 'Dentist' },
  { code: 'OTHER', nameNl: 'Overig', nameEn: 'Other' },
]

function displayName(row: { first_name: string; birth_name_prefix?: string | null; birth_name: string; partner_name_prefix?: string | null; partner_name?: string | null; name_usage?: 'BIRTH_NAME' | 'PARTNER_NAME' | 'PARTNER_BEFORE_BIRTH_NAME' | 'BIRTH_NAME_BEFORE_PARTNER_NAME' }): string {
  const birthName = [row.birth_name_prefix, row.birth_name].filter((part): part is string => Boolean(part?.trim())).join(' ').trim()
  const partnerName = [row.partner_name_prefix, row.partner_name].filter((part): part is string => Boolean(part?.trim())).join(' ').trim()
  const surname = row.name_usage === 'PARTNER_NAME'
    ? partnerName || birthName
    : row.name_usage === 'PARTNER_BEFORE_BIRTH_NAME'
      ? [partnerName, birthName].filter(Boolean).join(' ')
      : row.name_usage === 'BIRTH_NAME_BEFORE_PARTNER_NAME'
        ? [birthName, partnerName].filter(Boolean).join(' ')
        : birthName
  return [row.first_name, surname].filter(Boolean).join(' ').trim()
}

function optionalText(value: string | null | undefined): string | null {
  return value && value.trim() ? value.trim() : null
}

function contactHref(value: string, kind: 'mailto' | 'tel'): string {
  return `${kind}:${value.replace(/\s+/g, '')}`
}

export async function getFocusProfileProjection(section: FocusSectionContext): Promise<FocusProfileProjection> {
  if (!hasFocusPermission(section, 'self:employee:read', 'employee:read')) throw new AuthorizationError('Je hebt geen toegang tot dit profiel.')
  const groupId = requireHrGroupId(section.context)
  const today = new Date().toISOString().slice(0, 10)
  const [employeeResult, employmentResult, addressResult, relationsResult, relationTypesResult, bankResult] = await Promise.all([
    section.supabase.from('employees').select('id,title,initials,first_name,birth_name_prefix,birth_name,partner_name_prefix,partner_name,name_usage,avatar_url,private_email,private_phone,private_mobile,work_email,work_phone,work_phone_ext,work_mobile,preferred_language,updated_at').eq('tenant_id', section.context.tenantId).eq('hr_group_id', groupId).eq('id', section.employeeId).is('deleted_at', null).maybeSingle(),
    section.supabase.from('employments').select('id,starts_on,ends_on,is_primary,administration_id').eq('tenant_id', section.context.tenantId).eq('hr_group_id', groupId).eq('employee_id', section.employeeId).eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', today).or(`ends_on.is.null,ends_on.gte.${today}`).order('is_primary', { ascending: false }).order('starts_on', { ascending: false }).limit(20),
    section.supabase.from('employee_addresses').select('address_type,address_line_1,address_line_2,street,house_number,house_number_addition,postal_code,city,region,country_code').eq('tenant_id', section.context.tenantId).eq('employee_id', section.employeeId).is('deleted_at', null).order('valid_from', { ascending: false }).limit(5),
    section.supabase.from('employee_relations').select('id,relation_type,is_emergency_contact,first_name,initials,prefix,last_name,gender,birth_date,email,phone,mobile,notes').eq('tenant_id', section.context.tenantId).eq('employee_id', section.employeeId).is('deleted_at', null).order('is_emergency_contact', { ascending: false }).limit(20),
    section.supabase.from('relation_types').select('code,name_nl,name_en').eq('tenant_id', section.context.tenantId).eq('is_active', true).order('name_nl').limit(100),
    section.supabase.from('employee_bank_accounts').select('iban_last_four,bic,account_holder,is_primary').eq('tenant_id', section.context.tenantId).eq('employee_id', section.employeeId).is('deleted_at', null).order('is_primary', { ascending: false }).limit(5),
  ])
  if (employeeResult.error || employmentResult.error || addressResult.error || relationsResult.error || bankResult.error) throw new FocusSectionError('FOCUS_PROFILE_READ_FAILED')
  const employee = employeeResult.data
  if (!employee) throw new FocusSectionError('FOCUS_PROFILE_NOT_FOUND', 404)
  const employment = employmentResult.data?.[0] ?? null
  const [organizationResult, scheduleResult] = employment ? await Promise.all([
    section.supabase.from('employee_organizations').select('department_id,job_title').eq('tenant_id', section.context.tenantId).eq('hr_group_id', groupId).eq('employment_id', employment.id).lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).order('effective_from', { ascending: false }).limit(1).maybeSingle(),
    section.supabase.from('employment_schedules').select('average_hours_per_week').eq('tenant_id', section.context.tenantId).eq('employment_id', employment.id).lte('valid_from', today).or(`valid_until.is.null,valid_until.gte.${today}`).order('valid_from', { ascending: false }).limit(1).maybeSingle(),
  ]) : [{ data: null, error: null }, { data: null, error: null }]
  if (organizationResult.error || scheduleResult.error) throw new FocusSectionError('FOCUS_PROFILE_READ_FAILED')
  const departmentId = organizationResult.data?.department_id
  const departmentResult = departmentId ? await section.supabase.from('departments').select('name').eq('tenant_id', section.context.tenantId).eq('hr_group_id', groupId).eq('id', departmentId).maybeSingle() : { data: null, error: null }
  if (departmentResult.error) throw new FocusSectionError('FOCUS_PROFILE_READ_FAILED')
  const workEmail = optionalText(employee.work_email)
  const workPhone = optionalText(employee.work_phone) ?? optionalText(employee.work_mobile)
  const privateEmail = optionalText(employee.private_email)
  const privatePhone = optionalText(employee.private_phone) ?? optionalText(employee.private_mobile)
  const privateMobile = optionalText(employee.private_mobile)
  const address = addressResult.data?.[0]
  const relationTypes = relationTypesResult.data?.length
    ? relationTypesResult.data.map((relationType) => ({ code: relationType.code, nameNl: relationType.name_nl, nameEn: relationType.name_en }))
    : DEFAULT_FOCUS_RELATION_TYPES
  return {
    employeeId: employee.id,
    firstName: employee.first_name,
    updatedAt: employee.updated_at,
    canEdit: hasFocusPermission(section, 'self:employee:write'),
    canEditRelations: hasFocusPermission(section, 'self:relation:write'),
    name: displayName(employee),
    avatarUrl: employeeAvatarHref(employee.id, employee.avatar_url),
    editable: {
      title: optionalText(employee.title),
      initials: optionalText(employee.initials),
      firstName: employee.first_name,
      birthNamePrefix: optionalText(employee.birth_name_prefix),
      birthName: employee.birth_name,
      partnerNamePrefix: optionalText(employee.partner_name_prefix),
      partnerName: optionalText(employee.partner_name),
      nameUsage: employee.name_usage,
      privateEmail,
      privatePhone: optionalText(employee.private_phone),
      privateMobile,
    },
    personal: [
      { key: 'language', value: employee.preferred_language || '—' },
    ],
    contact: [
      ...(workEmail ? [{ key: 'workEmail' as const, value: workEmail, href: contactHref(workEmail, 'mailto') }] : []),
      ...(workPhone ? [{ key: 'workPhone' as const, value: employee.work_phone_ext ? `${workPhone} · ${employee.work_phone_ext}` : workPhone, href: contactHref(workPhone, 'tel') }] : []),
      ...(privateEmail ? [{ key: 'privateEmail' as const, value: privateEmail, href: contactHref(privateEmail, 'mailto') }] : []),
      ...(privatePhone ? [{ key: 'privatePhone' as const, value: privatePhone, href: contactHref(privatePhone, 'tel') }] : []),
      ...(privateMobile ? [{ key: 'privateMobile' as const, value: privateMobile, href: contactHref(privateMobile, 'tel') }] : []),
    ],
    relations: (relationsResult.data ?? []).map((relation) => ({
      id: relation.id,
      relationType: relation.relation_type,
      isEmergencyContact: relation.is_emergency_contact,
      firstName: relation.first_name,
      initials: relation.initials,
      prefix: relation.prefix,
      lastName: relation.last_name,
      gender: relation.gender,
      birthDate: relation.birth_date,
      phone: relation.phone,
      mobile: relation.mobile,
      email: relation.email,
      notes: relation.notes,
    })),
    relationTypes,
    address: address ? [address.address_line_1 ?? [address.street, address.house_number, address.house_number_addition].filter(Boolean).join(' '), [address.postal_code, address.city].filter(Boolean).join(' '), address.region, address.country_code].filter((part): part is string => Boolean(part?.trim())) : [],
    work: [
      ...(organizationResult.data?.job_title ? [{ key: 'jobTitle' as const, value: organizationResult.data.job_title }] : []),
      ...(departmentResult.data?.name ? [{ key: 'department' as const, value: departmentResult.data.name }] : []),
      ...(employment ? [{ key: 'startDate' as const, value: employment.starts_on }] : []),
      ...(scheduleResult.data?.average_hours_per_week !== null && scheduleResult.data?.average_hours_per_week !== undefined ? [{ key: 'hoursPerWeek' as const, value: `${scheduleResult.data.average_hours_per_week}` }] : []),
    ],
    bank: bankResult.data?.[0] ? { iban: `•••• ${bankResult.data[0].iban_last_four}`, bic: bankResult.data[0].bic, holder: bankResult.data[0].account_holder } : null,
  }
}

export interface FocusLeaveOverview {
  employmentId: string | null
  balances: Array<{ id: string; name: string; hours: number | null; unlimited: boolean }>
  upcoming: Array<{ startDate: string; endDate: string; status: string; minutes: number }>
}

export async function getFocusLeaveOverview(section: FocusSectionContext): Promise<FocusLeaveOverview> {
  if (!hasFocusPermission(section, 'self:leave:read', 'leave:read')) throw new AuthorizationError('Je hebt geen toegang tot verlof.')
  const groupId = requireHrGroupId(section.context)
  const today = new Date().toISOString().slice(0, 10)
  const employmentResult = await section.supabase.from('employments').select('id').eq('tenant_id', section.context.tenantId).eq('hr_group_id', groupId).eq('employee_id', section.employeeId).eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', today).or(`ends_on.is.null,ends_on.gte.${today}`).order('is_primary', { ascending: false }).order('starts_on', { ascending: false }).limit(1).maybeSingle()
  if (employmentResult.error) throw new FocusSectionError('FOCUS_LEAVE_READ_FAILED')
  if (!employmentResult.data) return { employmentId: null, balances: [], upcoming: [] }
  const dependencies: LeaveReadDependencies = { context: section.context as Awaited<LeaveReadDependencies['context']>, supabase: section.supabase }
  const [balanceResult, requestResult] = await Promise.all([
    getLeaveBalanceReport({ employmentId: employmentResult.data.id, asOfDate: today }, dependencies).catch(() => null),
    section.supabase.from('leave_requests').select('start_date,end_date,status,requested_minutes').eq('tenant_id', section.context.tenantId).eq('hr_group_id', groupId).eq('employee_id', section.employeeId).gte('end_date', today).order('start_date').limit(8),
  ])
  if (requestResult.error) throw new FocusSectionError('FOCUS_LEAVE_READ_FAILED')
  return {
    employmentId: employmentResult.data.id,
    balances: balanceResult?.report.leaveTypes.map((item) => ({ id: item.leaveTypeId, name: item.name, hours: item.currentBalance, unlimited: item.status === 'UNLIMITED' })) ?? [],
    upcoming: (requestResult.data ?? []).map((request) => ({ startDate: request.start_date, endDate: request.end_date, status: request.status, minutes: request.requested_minutes })),
  }
}

export interface FocusHoursOverview {
  employeeName: string
  employmentId: string | null
  days: Array<{ date: string; expected: number; recorded: number; needsAction: boolean }>
  entries: Array<{ id: string; date: string; type: string; hours: number; status: string; corrected: boolean }>
  canEdit: boolean
  projection: ActualWorkEmployeeProjection | null
}

function addDays(value: string, amount: number): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function mondayOf(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  return date.toISOString().slice(0, 10)
}

function expectedHours(schedule: ActualWorkEmployeeProjection['schedule'][number] | undefined, date: string): number {
  if (!schedule || schedule.valid_from > date || (schedule.valid_until !== null && schedule.valid_until < date)) return 0
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay()
  const hours = [schedule.sunday_hours, schedule.monday_hours, schedule.tuesday_hours, schedule.wednesday_hours, schedule.thursday_hours, schedule.friday_hours, schedule.saturday_hours][day]
  return Number(hours ?? 0)
}

export async function getFocusHoursOverview(section: FocusSectionContext): Promise<FocusHoursOverview> {
  if (!hasFocusPermission(section, 'self:leave:read', 'leave:read')) throw new AuthorizationError('Je hebt geen toegang tot uren.')
  const today = new Date().toISOString().slice(0, 10)
  let projection: ActualWorkEmployeeProjection
  try {
    projection = await getActualWorkEmployeeProjection({ employeeId: section.employeeId, month: today.slice(0, 7) }, { context: section.context, hrGroupId: requireHrGroupId(section.context), supabase: section.supabase })
  } catch (error) {
    if (error instanceof ActualWorkServiceError && error.code === 'ACTUAL_WORK_EMPLOYMENT_NOT_FOUND') return { employeeName: '', employmentId: null, days: [], entries: [], canEdit: false, projection: null }
    throw error
  }
  const start = mondayOf(today)
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index)).map((date) => {
    const schedule = [...projection.schedule].sort((left, right) => right.valid_from.localeCompare(left.valid_from)).find((item) => item.valid_from <= date && (item.valid_until === null || item.valid_until >= date))
    const recorded = projection.entries.filter((entry) => entry.entry_granularity === 'DAY' && entry.work_date === date && entry.status !== 'REVOKED').reduce((total, entry) => total + Number(entry.hours), 0)
    const expected = expectedHours(schedule, date)
    return { date, expected, recorded, needsAction: expected > 0 && recorded === 0 && date <= today }
  })
  const typeById = new Map(projection.types.map((type) => [type.id, type.name]))
  const entries = projection.entries
    .filter((entry) => entry.status !== 'REVOKED')
    .map((entry) => ({
      id: entry.id,
      date: entry.subject_period_start,
      type: typeById.get(entry.work_hour_type_id) ?? '—',
      hours: Number(entry.hours),
      status: entry.status,
      corrected: Boolean(entry.correction_reason) || projection.revisions.some((revision) => revision.entry_id === entry.id && revision.operation === 'CORRECTION'),
    }))
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id))
  return { employeeName: displayName(projection.employee), employmentId: projection.employment.id, days, entries, canEdit: !section.actAs && hasFocusPermission(section, 'self:actual-work:write'), projection }
}

export async function getFocusDocuments(section: FocusSectionContext) {
  if (!hasFocusPermission(section, 'self:document:read', 'self:document-signing:read', 'document:read')) throw new AuthorizationError('Je hebt geen toegang tot documenten.')
  return listEmployeeDashboardDocuments(section.employeeId, 12, { context: section.context as Awaited<ReturnType<typeof requirePermission>>, supabase: section.supabase })
}

export interface FocusDirectoryEntry {
  employeeId: string
  name: string
  avatarUrl: string | null
  jobTitle: string | null
  departmentName: string | null
  workEmail: string | null
  workPhone: string | null
}

export async function getFocusDirectory(section: FocusSectionContext, search?: string): Promise<{ enabled: boolean; entries: FocusDirectoryEntry[] }> {
  if (!hasFocusPermission(section, 'self:organization-chart:read', 'organization-chart:read', 'employee-directory:read', 'employee:read')) throw new AuthorizationError('Je hebt geen toegang tot de medewerkersdirectory.')
  const visibility = await getEmployeeDirectoryVisibility({ context: section.context, supabase: section.supabase })
  if (!visibility.enabled) return { enabled: false, entries: [] }
  const groupId = requireHrGroupId(section.context)
  const today = new Date().toISOString().slice(0, 10)
  const employmentsQuery = section.supabase.from('employments').select('employee_id,id').eq('tenant_id', section.context.tenantId).eq('hr_group_id', groupId).eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', today).or(`ends_on.is.null,ends_on.gte.${today}`).limit(1000)
  if (section.context.administrationId) employmentsQuery.eq('administration_id', section.context.administrationId)
  const employmentResult = await employmentsQuery
  if (employmentResult.error) throw new FocusSectionError('FOCUS_DIRECTORY_READ_FAILED')
  const employeeIds = [...new Set((employmentResult.data ?? []).map((row) => row.employee_id))]
  if (!employeeIds.length) return { enabled: true, entries: [] }
  const [employeesResult, organizationsResult, departmentsResult] = await Promise.all([
    section.supabase.from('employees').select('id,first_name,birth_name_prefix,birth_name,avatar_url,work_email,work_phone,work_mobile').eq('tenant_id', section.context.tenantId).eq('hr_group_id', groupId).in('id', employeeIds).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).limit(1000),
    section.supabase.from('employee_organizations').select('employee_id,department_id,job_title,effective_from,effective_to').eq('tenant_id', section.context.tenantId).eq('hr_group_id', groupId).in('employee_id', employeeIds).lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).order('effective_from', { ascending: false }).limit(2000),
    section.supabase.from('departments').select('id,name').eq('tenant_id', section.context.tenantId).eq('hr_group_id', groupId).limit(1000),
  ])
  if (employeesResult.error || organizationsResult.error || departmentsResult.error) throw new FocusSectionError('FOCUS_DIRECTORY_READ_FAILED')
  const departmentById = new Map((departmentsResult.data ?? []).map((department) => [department.id, department.name]))
  const organizationByEmployee = new Map<string, (typeof organizationsResult.data)[number]>()
  for (const organization of organizationsResult.data ?? []) if (!organizationByEmployee.has(organization.employee_id)) organizationByEmployee.set(organization.employee_id, organization)
  const normalizedSearch = search?.trim().toLocaleLowerCase('nl-NL') ?? ''
  const entries = (employeesResult.data ?? []).map((employee): FocusDirectoryEntry => {
    const organization = organizationByEmployee.get(employee.id)
    return {
      employeeId: employee.id,
      name: displayName(employee),
      avatarUrl: employeeAvatarHref(employee.id, employee.avatar_url),
      jobTitle: visibility.showJobDepartment ? organization?.job_title ?? null : null,
      departmentName: visibility.showJobDepartment ? organization?.department_id ? departmentById.get(organization.department_id) ?? null : null : null,
      workEmail: visibility.showWorkEmail ? employee.work_email : null,
      workPhone: visibility.showWorkPhone ? employee.work_phone ?? employee.work_mobile : null,
    }
  }).filter((entry) => !normalizedSearch || entry.name.toLocaleLowerCase('nl-NL').includes(normalizedSearch) || entry.jobTitle?.toLocaleLowerCase('nl-NL').includes(normalizedSearch) || entry.departmentName?.toLocaleLowerCase('nl-NL').includes(normalizedSearch)).sort((left, right) => left.name.localeCompare(right.name, 'nl-NL')).slice(0, 100)
  return { enabled: true, entries }
}
