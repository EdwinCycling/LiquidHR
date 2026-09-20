import type { Database, Tables } from '@scope/db'
import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { exactHoursToDatabase, isPositiveExactHours, parseExactHours } from './exact-hours'
import { actualWorkBulkSaveSchema, actualWorkEntrySchema, actualWorkTypeSchema, actualWorkTypeUpdateSchema, type ActualWorkBulkSaveInput, type ActualWorkEntryInput, type ActualWorkTypeInput } from './schemas'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type ActualWorkType = Tables<'work_hour_types'>
type ActualWorkEntry = Tables<'employment_work_hour_entries'>
type ActualWorkPeriod = Tables<'actual_work_periods'>
type ActualWorkRevision = Tables<'actual_work_revisions'>
type ActualWorkFamily = Database['public']['Enums']['actual_work_type_family']
type ActualWorkEntryGranularity = Database['public']['Enums']['actual_work_entry_granularity']
type ActualWorkBulkEmployee = Pick<Tables<'employees'>, 'id' | 'employee_number' | 'first_name' | 'birth_name_prefix' | 'birth_name'>
type ActualWorkBulkEmployment = Pick<Tables<'employments'>, 'id' | 'employee_id' | 'administration_id' | 'starts_on' | 'ends_on' | 'record_status' | 'deleted_at' | 'is_primary'>
type ActualWorkBulkDepartment = Pick<Tables<'departments'>, 'id' | 'code' | 'name'>
type ActualWorkBulkEntry = Pick<Tables<'employment_work_hour_entries'>, 'id' | 'employee_id' | 'employment_id' | 'work_hour_type_id' | 'work_date' | 'entry_granularity' | 'subject_period_start' | 'subject_period_end' | 'posting_period_start' | 'hours' | 'status' | 'note' | 'correction_reason' | 'updated_at'>
type ActualWorkBulkLimit = Pick<Tables<'actual_work_type_limits'>, 'limit_scope' | 'max_hours'>
type ActualWorkBulkSchedule = Pick<Tables<'employment_schedules'>, 'employment_id' | 'valid_from' | 'valid_until' | 'part_time_factor' | 'fulltime_hours_per_week' | 'average_hours_per_week'>
type ActualWorkAuth = Awaited<ReturnType<typeof authForGroup>>

export type ActualWorkReadDependencies = ActualWorkAuth

export type ActualWorkBulkProjection = {
  month: string
  days: string[]
  types: ActualWorkType[]
  selectedTypeId: string | null
  entryGranularity: 'DAY' | 'PERIOD'
  period: ActualWorkPeriod | null
  limits: ActualWorkBulkLimit[]
  departments: ActualWorkBulkDepartment[]
  employees: Array<{
    employee: ActualWorkBulkEmployee
    employment: ActualWorkBulkEmployment
    department: ActualWorkBulkDepartment | null
    entries: ActualWorkBulkEntry[]
    additionalEligibleDates: string[]
    additionalEligibleForPeriod: boolean
  }>
}

export class ActualWorkServiceError extends Error {
  readonly status: number

  constructor(readonly code: string, status = 400) {
    super(code)
    this.name = 'ActualWorkServiceError'
    this.status = status
  }
}

function databaseError(error: { message: string } | null): never {
  const code = error?.message.match(/ACTUAL_WORK_[A-Z_]+/)?.[0] ?? 'ACTUAL_WORK_OPERATION_FAILED'
  throw new ActualWorkServiceError(code, code === 'ACTUAL_WORK_NOT_AUTHORIZED' ? 403 : 400)
}

function categoryForFamily(family: ActualWorkFamily): Database['public']['Enums']['work_hour_type_category'] {
  return family === 'OVERTIME' ? 'OVERTIME' : family === 'TRANSPARENT' ? 'INFORMATIONAL' : 'REGULAR_WORK'
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}

function addMonth(date: string): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCMonth(value.getUTCMonth() + 1)
  return value.toISOString().slice(0, 10)
}

async function authForGroup(permission: 'leave:read' | 'leave:write', employeeId?: string) {
  const context = employeeId ? await requirePermission(permission, employeeId) : await requirePermission(permission)
  return { context, hrGroupId: requireHrGroupId(context), supabase: await createClient() }
}

export async function listActualWorkTypes(includeInactive = false): Promise<ActualWorkType[]> {
  const { context, hrGroupId, supabase } = await authForGroup('leave:read')
  let query = supabase.from('work_hour_types').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
  if (!includeInactive) query = query.eq('is_active', true)
  const result = await query.order('display_order').order('name').limit(500)
  if (result.error) databaseError(result.error)
  return result.data ?? []
}

export async function createActualWorkType(input: unknown): Promise<ActualWorkType> {
  const parsed = actualWorkTypeSchema.safeParse(input)
  if (!parsed.success) throw new ActualWorkServiceError(parsed.error.issues[0]?.message ?? 'ACTUAL_WORK_INPUT_INVALID')
  const { context, hrGroupId, supabase } = await authForGroup('leave:write')
  const value = parsed.data
  const insert = {
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    administration_id: null,
    code: value.code,
    name: value.name,
    family: value.family,
    category: categoryForFamily(value.family),
    is_active: true,
    created_by: context.userId,
    updated_by: context.userId,
    valid_from: value.validFrom,
    valid_until: value.validUntil ?? null,
    entry_granularity: value.entryGranularity,
    comment_required: value.commentRequired,
    future_entry_allowed: value.futureEntryAllowed,
    show_in_team_overview: value.showInTeamOverview,
    show_in_calendar: value.showInCalendar,
    approval_required: value.approvalRequired,
    display_order: value.displayOrder,
  } satisfies Database['public']['Tables']['work_hour_types']['Insert']
  const result = await supabase.from('work_hour_types').insert(insert).select('*').single()
  if (result.error || !result.data) databaseError(result.error)
  await replaceActualWorkTypeLimits({ supabase, tenantId: context.tenantId, hrGroupId, userId: context.userId, typeId: result.data.id, limits: value.limits })
  return result.data
}

async function replaceActualWorkTypeLimits(input: {
  supabase: SupabaseServerClient
  tenantId: string
  hrGroupId: string
  userId: string
  typeId: string
  limits: ActualWorkTypeInput['limits']
}): Promise<void> {
  const parsedLimits = input.limits.map((limit) => ({ ...limit, exact: parseExactHours(limit.maxHours) }))
  if (parsedLimits.some((limit) => !isPositiveExactHours(limit.exact))) throw new ActualWorkServiceError('ACTUAL_WORK_LIMIT_INVALID')
  const deleteResult = await input.supabase.from('actual_work_type_limits').delete().eq('tenant_id', input.tenantId).eq('hr_group_id', input.hrGroupId).eq('work_hour_type_id', input.typeId)
  if (deleteResult.error) databaseError(deleteResult.error)
  if (parsedLimits.length === 0) return
  const result = await input.supabase.from('actual_work_type_limits').insert(parsedLimits.map((limit) => ({
    tenant_id: input.tenantId,
    hr_group_id: input.hrGroupId,
    work_hour_type_id: input.typeId,
    limit_scope: limit.scope,
    // Supabase maps numeric columns to number, but the JSON payload stays exact decimal text.
    max_hours: exactHoursToDatabase(limit.exact) as unknown as number,
    created_by: input.userId,
    updated_by: input.userId,
  })))
  if (result.error) databaseError(result.error)
}

export async function updateActualWorkType(typeId: string, input: unknown): Promise<ActualWorkType> {
  const parsed = actualWorkTypeUpdateSchema.safeParse(input)
  if (!parsed.success) throw new ActualWorkServiceError(parsed.error.issues[0]?.message ?? 'ACTUAL_WORK_INPUT_INVALID')
  const { context, hrGroupId, supabase } = await authForGroup('leave:write')
  const value = parsed.data
  const update: Database['public']['Tables']['work_hour_types']['Update'] = {
    ...(value.validFrom === undefined ? {} : { valid_from: value.validFrom }),
    ...(value.validUntil === undefined ? {} : { valid_until: value.validUntil }),
    ...(value.entryGranularity === undefined ? {} : { entry_granularity: value.entryGranularity }),
    ...(value.commentRequired === undefined ? {} : { comment_required: value.commentRequired }),
    ...(value.futureEntryAllowed === undefined ? {} : { future_entry_allowed: value.futureEntryAllowed }),
    ...(value.showInTeamOverview === undefined ? {} : { show_in_team_overview: value.showInTeamOverview }),
    ...(value.showInCalendar === undefined ? {} : { show_in_calendar: value.showInCalendar }),
    ...(value.approvalRequired === undefined ? {} : { approval_required: value.approvalRequired }),
    ...(value.displayOrder === undefined ? {} : { display_order: value.displayOrder }),
    updated_by: context.userId,
  }
  const result = await supabase.from('work_hour_types').update(update).eq('id', typeId).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).select('*').single()
  if (result.error || !result.data) databaseError(result.error)
  if (value.limits) await replaceActualWorkTypeLimits({ supabase, tenantId: context.tenantId, hrGroupId, userId: context.userId, typeId, limits: value.limits })
  return result.data
}

export async function listActualWorkPeriods(): Promise<ActualWorkPeriod[]> {
  const { context, hrGroupId, supabase } = await authForGroup('leave:read')
  const result = await supabase.from('actual_work_periods').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('period_start', { ascending: false }).limit(120)
  if (result.error) databaseError(result.error)
  return result.data ?? []
}

export async function closeActualWorkPeriod(input: unknown): Promise<ActualWorkPeriod> {
  const parsed = zPeriodClose(input)
  const { context, hrGroupId, supabase } = await authForGroup('leave:write')
  const result = await supabase.rpc('close_actual_work_period', {
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: hrGroupId,
    requested_period_start: parsed.periodStart,
    requested_period_end: parsed.periodEnd,
  })
  if (result.error || !result.data) databaseError(result.error)
  return result.data
}

function zPeriodClose(input: unknown): { periodStart: string; periodEnd: string } {
  if (!input || typeof input !== 'object') throw new ActualWorkServiceError('ACTUAL_WORK_INPUT_INVALID')
  const candidate = input as { periodStart?: unknown; periodEnd?: unknown }
  if (typeof candidate.periodStart !== 'string' || typeof candidate.periodEnd !== 'string') throw new ActualWorkServiceError('ACTUAL_WORK_INPUT_INVALID')
  if (candidate.periodStart !== monthStart(candidate.periodStart) || candidate.periodEnd !== addMonth(candidate.periodStart)) throw new ActualWorkServiceError('ACTUAL_WORK_PERIOD_INVALID')
  return { periodStart: candidate.periodStart, periodEnd: candidate.periodEnd }
}

async function loadEmployment(input: Pick<ActualWorkEntryInput, 'employeeId' | 'employmentId'>, context: { tenantId: string; hrGroupId: string }, supabase: SupabaseServerClient) {
  const result = await supabase.from('employments').select('id,employee_id,administration_id,starts_on,ends_on,record_status,deleted_at').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('id', input.employmentId).eq('employee_id', input.employeeId).eq('record_status', 'CONFIRMED').is('deleted_at', null).maybeSingle()
  if (result.error) databaseError(result.error)
  if (!result.data) throw new ActualWorkServiceError('ACTUAL_WORK_EMPLOYMENT_NOT_FOUND', 404)
  return result.data
}

async function saveActualWorkEntryValue(value: ActualWorkEntryInput, auth: ActualWorkAuth, existingEmployment?: Awaited<ReturnType<typeof loadEmployment>>): Promise<ActualWorkEntry> {
  const { context, hrGroupId, supabase } = auth
  const employment = existingEmployment ?? await loadEmployment(value, { tenantId: context.tenantId, hrGroupId }, supabase)
  const exactHours = parseExactHours(value.hours)
  if (!isPositiveExactHours(exactHours)) throw new ActualWorkServiceError('ACTUAL_WORK_HOURS_REQUIRED')
  const subjectEnd = value.entryGranularity === 'DAY' ? addDays(value.subjectPeriodStart, 1) : value.subjectPeriodEnd ?? addMonth(value.subjectPeriodStart)
  const postingStart = monthStart(value.subjectPeriodStart)
  const operation: Database['public']['Enums']['actual_work_revision_operation'] = value.entryId
    ? value.correctionReason ? 'CORRECTION' : 'EDIT'
    : 'CREATE'
  const result = await supabase.rpc('save_actual_work_entry', {
    requested_entry_id: (value.entryId ?? null) as unknown as string,
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: hrGroupId,
    requested_administration_id: employment.administration_id,
    requested_employee_id: value.employeeId,
    requested_employment_id: employment.id,
    requested_work_hour_type_id: value.workHourTypeId,
    requested_entry_granularity: value.entryGranularity as ActualWorkEntryGranularity,
    requested_subject_period_start: value.subjectPeriodStart,
    requested_subject_period_end: subjectEnd,
    requested_posting_period_start: postingStart,
    // Supabase maps numeric columns to number, but the JSON payload stays exact decimal text.
    requested_hours: exactHoursToDatabase(exactHours) as unknown as number,
    requested_status: 'APPROVED',
    requested_note: value.note ?? '',
    requested_operation: operation,
    requested_reason: value.correctionReason ?? undefined,
  })
  if (result.error || !result.data) databaseError(result.error)
  return result.data
}

export async function saveActualWorkEntry(input: unknown): Promise<ActualWorkEntry> {
  const parsed = actualWorkEntrySchema.safeParse(input)
  if (!parsed.success) throw new ActualWorkServiceError(parsed.error.issues[0]?.message ?? 'ACTUAL_WORK_INPUT_INVALID')
  const value = parsed.data
  const auth = await authForGroup('leave:write', value.employeeId)
  return saveActualWorkEntryValue(value, auth)
}

export type ActualWorkEmployeeProjection = {
  employee: Pick<Tables<'employees'>, 'id' | 'employee_number' | 'first_name' | 'birth_name_prefix' | 'birth_name'>
  employment: Pick<Tables<'employments'>, 'id' | 'employee_id' | 'administration_id' | 'starts_on' | 'ends_on'>
  types: ActualWorkType[]
  entries: ActualWorkEntry[]
  revisions: ActualWorkRevision[]
  period: ActualWorkPeriod | null
  schedule: Pick<Tables<'employment_schedules'>, 'valid_from' | 'valid_until' | 'part_time_factor' | 'fulltime_hours_per_week' | 'average_hours_per_week' | 'monday_hours' | 'tuesday_hours' | 'wednesday_hours' | 'thursday_hours' | 'friday_hours' | 'saturday_hours' | 'sunday_hours'>[]
}

export async function getActualWorkEmployeeProjection(input: { employeeId: string; employmentId?: string; month: string }, dependencies?: ActualWorkReadDependencies): Promise<ActualWorkEmployeeProjection> {
  const { context, hrGroupId, supabase } = dependencies ?? await authForGroup('leave:read', input.employeeId)
  const from = monthStart(input.month)
  const to = addMonth(from)
  let employmentQuery = supabase.from('employments').select('id,employee_id,administration_id,starts_on,ends_on').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('employee_id', input.employeeId).eq('record_status', 'CONFIRMED').is('deleted_at', null)
  if (input.employmentId) employmentQuery = employmentQuery.eq('id', input.employmentId)
  if (context.administrationId) employmentQuery = employmentQuery.eq('administration_id', context.administrationId)
  const employmentResult = await employmentQuery.order('starts_on', { ascending: false }).limit(20)
  if (employmentResult.error) databaseError(employmentResult.error)
  const employment = employmentResult.data?.[0]
  if (!employment) throw new ActualWorkServiceError('ACTUAL_WORK_EMPLOYMENT_NOT_FOUND', 404)
  const [employeeResult, typesResult, entriesResult, periodResult, scheduleResult] = await Promise.all([
    supabase.from('employees').select('id,employee_number,first_name,birth_name_prefix,birth_name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('id', input.employeeId).maybeSingle(),
    supabase.from('work_hour_types').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('display_order').order('name').limit(500),
    supabase.from('employment_work_hour_entries').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('employment_id', employment.id).lt('subject_period_start', to).gt('subject_period_end', from).order('subject_period_start').limit(2000),
    supabase.from('actual_work_periods').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('period_start', from).maybeSingle(),
    supabase.from('employment_schedules').select('valid_from,valid_until,part_time_factor,fulltime_hours_per_week,average_hours_per_week,monday_hours,tuesday_hours,wednesday_hours,thursday_hours,friday_hours,saturday_hours,sunday_hours').eq('tenant_id', context.tenantId).eq('employment_id', employment.id).lt('valid_from', to).or(`valid_until.is.null,valid_until.gt.${from}`).order('valid_from').limit(100),
  ])
  const failed = [employeeResult, typesResult, entriesResult, periodResult, scheduleResult].find((result) => result.error)
  if (failed?.error) databaseError(failed.error)
  if (!employeeResult.data) throw new ActualWorkServiceError('ACTUAL_WORK_EMPLOYEE_NOT_FOUND', 404)
  const entryIds = (entriesResult.data ?? []).map((entry) => entry.id)
  const revisionResult = entryIds.length ? await supabase.from('actual_work_revisions').select('*').in('entry_id', entryIds).order('revision_number') : { data: [], error: null }
  if (revisionResult.error) databaseError(revisionResult.error)
  return { employee: employeeResult.data, employment, types: typesResult.data ?? [], entries: entriesResult.data ?? [], revisions: revisionResult.data ?? [], period: periodResult.data ?? null, schedule: scheduleResult.data ?? [] }
}

export type ActualWorkBulkQuery = {
  month: string
  typeId?: string
  entryGranularity?: 'DAY' | 'PERIOD'
  employeeQuery?: string
  departmentId?: string
}

function validBulkMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

function safeEmployeeSearch(value: string | undefined): string {
  return (value ?? '').replace(/[^\p{L}\p{N} _-]/gu, ' ').trim().slice(0, 80)
}

function effectiveScheduleForDate(schedules: ActualWorkBulkSchedule[], date: string): ActualWorkBulkSchedule | null {
  return schedules
    .filter((schedule) => schedule.valid_from <= date && (schedule.valid_until === null || schedule.valid_until > date))
    .sort((left, right) => right.valid_from.localeCompare(left.valid_from))[0] ?? null
}

function additionalEligible(schedules: ActualWorkBulkSchedule[], date: string): boolean {
  const schedule = effectiveScheduleForDate(schedules, date)
  return schedule !== null && schedule.part_time_factor < 1
}

async function getActualWorkBulkProjectionForAuth(input: ActualWorkBulkQuery, auth: ActualWorkAuth): Promise<ActualWorkBulkProjection> {
  if (!validBulkMonth(input.month)) throw new ActualWorkServiceError('ACTUAL_WORK_MONTH_INVALID')
  const { context, hrGroupId, supabase } = auth
  const from = monthStart(input.month)
  const to = addMonth(from)
  const lastDay = addDays(to, -1)
  const days = daysBetween(from, to)
  const [typesResult, periodResult, departmentsResult, employeesResult] = await Promise.all([
    supabase.from('work_hour_types').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('display_order').order('name').limit(500),
    supabase.from('actual_work_periods').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('period_start', from).maybeSingle(),
    supabase.from('departments').select('id,code,name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('name').limit(500),
    (() => {
      let query = supabase.from('employees').select('id,employee_number,first_name,birth_name_prefix,birth_name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_archived', false).is('deleted_at', null).order('birth_name').order('first_name').limit(1000)
      const search = safeEmployeeSearch(input.employeeQuery)
      if (search) query = query.or(`first_name.ilike.%${search}%,birth_name.ilike.%${search}%,employee_number.ilike.%${search}%`)
      return query
    })(),
  ])
  const failed = [typesResult, periodResult, departmentsResult, employeesResult].find((result) => result.error)
  if (failed?.error) databaseError(failed.error)

  const types = typesResult.data ?? []
  const selectedType = (input.typeId ? types.find((type) => type.id === input.typeId) : undefined) ?? types.find((type) => type.family !== 'TRANSPARENT') ?? types[0] ?? null
  const entryGranularity: 'DAY' | 'PERIOD' = selectedType?.entry_granularity === 'PERIOD'
    ? 'PERIOD'
    : selectedType?.entry_granularity === 'DAY'
      ? 'DAY'
      : input.entryGranularity === 'PERIOD' ? 'PERIOD' : 'DAY'
  const departments = (departmentsResult.data ?? []) as ActualWorkBulkDepartment[]
  const baseProjection = {
    month: input.month,
    days,
    types,
    selectedTypeId: selectedType?.id ?? null,
    entryGranularity,
    period: periodResult.data ?? null,
    limits: [] as ActualWorkBulkLimit[],
    departments,
    employees: [],
  }
  if (!selectedType || !employeesResult.data?.length) return baseProjection

  const limitsResult = await supabase.from('actual_work_type_limits').select('limit_scope,max_hours').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('work_hour_type_id', selectedType.id).order('limit_scope')
  if (limitsResult.error) databaseError(limitsResult.error)

  const employeeRows = employeesResult.data
  const employeeById = new Map(employeeRows.map((employee) => [employee.id, employee]))
  let employmentsQuery = supabase.from('employments').select('id,employee_id,administration_id,starts_on,ends_on,record_status,deleted_at,is_primary').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('employee_id', employeeRows.map((employee) => employee.id)).eq('record_status', 'CONFIRMED').is('deleted_at', null).lt('starts_on', to).or(`ends_on.is.null,ends_on.gte.${from}`).order('employee_id').order('is_primary', { ascending: false }).order('starts_on', { ascending: false }).limit(2000)
  if (context.administrationId) employmentsQuery = employmentsQuery.eq('administration_id', context.administrationId)
  const employmentsResult = await employmentsQuery
  if (employmentsResult.error) databaseError(employmentsResult.error)

  const employmentByEmployee = new Map<string, ActualWorkBulkEmployment>()
  for (const employment of employmentsResult.data ?? []) {
    if (!employmentByEmployee.has(employment.employee_id)) employmentByEmployee.set(employment.employee_id, employment)
  }
  const initialEmployments = [...employmentByEmployee.values()]
  if (!initialEmployments.length) return { ...baseProjection, limits: (limitsResult.data ?? []) as ActualWorkBulkLimit[] }
  const employmentIds = initialEmployments.map((employment) => employment.id)
  let placementsQuery = supabase.from('employee_organizations').select('employment_id,employee_id,department_id,effective_from,effective_to').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('employment_id', employmentIds).lte('effective_from', lastDay).or(`effective_to.is.null,effective_to.gte.${from}`).order('effective_from', { ascending: false }).limit(5000)
  if (context.administrationId) placementsQuery = placementsQuery.eq('administration_id', context.administrationId)
  const placementsResult = await placementsQuery
  if (placementsResult.error) databaseError(placementsResult.error)
  const placementByEmployment = new Map<string, { employee_id: string; department_id: string }>()
  for (const placement of placementsResult.data ?? []) {
    if (placement.employment_id && !placementByEmployment.has(placement.employment_id)) placementByEmployment.set(placement.employment_id, placement)
  }
  const filteredEmployments = initialEmployments.filter((employment) => !input.departmentId || placementByEmployment.get(employment.id)?.department_id === input.departmentId)
  if (!filteredEmployments.length) return { ...baseProjection, limits: (limitsResult.data ?? []) as ActualWorkBulkLimit[] }
  const filteredEmploymentIds = filteredEmployments.map((employment) => employment.id)
  const [entriesResult, schedulesResult] = await Promise.all([
    supabase.from('employment_work_hour_entries').select('id,employee_id,employment_id,work_hour_type_id,work_date,entry_granularity,subject_period_start,subject_period_end,posting_period_start,hours,status,note,correction_reason,updated_at').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('employment_id', filteredEmploymentIds).eq('work_hour_type_id', selectedType.id).eq('entry_granularity', entryGranularity).eq(entryGranularity === 'PERIOD' ? 'subject_period_start' : 'posting_period_start', from).order('subject_period_start').order('updated_at', { ascending: false }).limit(10000),
    supabase.from('employment_schedules').select('employment_id,valid_from,valid_until,part_time_factor,fulltime_hours_per_week,average_hours_per_week').eq('tenant_id', context.tenantId).in('employment_id', filteredEmploymentIds).lt('valid_from', to).or(`valid_until.is.null,valid_until.gt.${from}`).order('valid_from').limit(5000),
  ])
  if (entriesResult.error || schedulesResult.error) databaseError(entriesResult.error ?? schedulesResult.error)
  const entriesByEmployment = new Map<string, ActualWorkBulkEntry[]>()
  for (const entry of entriesResult.data ?? []) {
    const entries = entriesByEmployment.get(entry.employment_id) ?? []
    entries.push(entry)
    entriesByEmployment.set(entry.employment_id, entries)
  }
  const schedulesByEmployment = new Map<string, ActualWorkBulkSchedule[]>()
  for (const schedule of schedulesResult.data ?? []) {
    const schedules = schedulesByEmployment.get(schedule.employment_id) ?? []
    schedules.push(schedule)
    schedulesByEmployment.set(schedule.employment_id, schedules)
  }
  const departmentById = new Map(departments.map((department) => [department.id, department]))
  const bulkEmployees = filteredEmployments.flatMap((employment) => {
    const employee = employeeById.get(employment.employee_id)
    if (!employee) return []
    const placement = placementByEmployment.get(employment.id)
    const schedules = schedulesByEmployment.get(employment.id) ?? []
    return [{
      employee,
      employment,
      department: placement ? departmentById.get(placement.department_id) ?? null : null,
      entries: entriesByEmployment.get(employment.id) ?? [],
      additionalEligibleDates: days.filter((day) => additionalEligible(schedules, day)),
      additionalEligibleForPeriod: additionalEligible(schedules, from),
    }]
  })
  return { ...baseProjection, limits: (limitsResult.data ?? []) as ActualWorkBulkLimit[], employees: bulkEmployees }
}

export async function getActualWorkBulkProjection(input: ActualWorkBulkQuery): Promise<ActualWorkBulkProjection> {
  const auth = await authForGroup('leave:write')
  return getActualWorkBulkProjectionForAuth(input, auth)
}

function bulkCellKey(employmentId: string, subjectPeriodStart: string): string {
  return `${employmentId}:${subjectPeriodStart}`
}

export async function saveActualWorkBulkEntries(input: unknown): Promise<{ saved: ActualWorkEntry[] }> {
  const parsed = actualWorkBulkSaveSchema.safeParse(input)
  if (!parsed.success) throw new ActualWorkServiceError(parsed.error.issues[0]?.message ?? 'ACTUAL_WORK_INPUT_INVALID')
  const value: ActualWorkBulkSaveInput = parsed.data
  const auth = await authForGroup('leave:write')
  const projection = await getActualWorkBulkProjectionForAuth({ month: value.month, typeId: value.workHourTypeId, entryGranularity: value.entryGranularity }, auth)
  if (projection.selectedTypeId !== value.workHourTypeId) throw new ActualWorkServiceError('ACTUAL_WORK_TYPE_NOT_ACTIVE')
  const rowsByEmployee = new Map(projection.employees.map((row) => [row.employee.id, row]))
  const entriesByCell = new Map<string, ActualWorkBulkEntry>()
  for (const row of projection.employees) {
    for (const entry of row.entries) {
      const key = bulkCellKey(row.employment.id, entry.subject_period_start)
      if (!entriesByCell.has(key)) entriesByCell.set(key, entry)
    }
  }
  const seenCells = new Set<string>()
  const closed = projection.period?.status === 'CLOSED'
  const saved: ActualWorkEntry[] = []
  for (const change of value.changes) {
    const row = rowsByEmployee.get(change.employeeId)
    if (!row || row.employment.id !== change.employmentId) throw new ActualWorkServiceError('ACTUAL_WORK_BULK_SCOPE_INVALID', 403)
    const isPeriodCell = value.entryGranularity === 'PERIOD'
    const validSubject = isPeriodCell ? change.subjectPeriodStart === monthStart(value.month) : change.subjectPeriodStart >= monthStart(value.month) && change.subjectPeriodStart < addMonth(monthStart(value.month))
    if (!validSubject) throw new ActualWorkServiceError('ACTUAL_WORK_BULK_DATE_INVALID')
    const key = bulkCellKey(row.employment.id, change.subjectPeriodStart)
    if (seenCells.has(key)) throw new ActualWorkServiceError('ACTUAL_WORK_BULK_DUPLICATE_CELL')
    seenCells.add(key)
    const existing = entriesByCell.get(key)
    if (change.entryId && (!existing || existing.id !== change.entryId)) throw new ActualWorkServiceError('ACTUAL_WORK_ENTRY_NOT_FOUND', 404)
    const entryId = existing?.id ?? null
    if (closed && (!entryId || !change.correctionReason)) throw new ActualWorkServiceError(entryId ? 'ACTUAL_WORK_CORRECTION_REASON_REQUIRED' : 'ACTUAL_WORK_PERIOD_CLOSED')
    saved.push(await saveActualWorkEntryValue({
      employeeId: row.employee.id,
      employmentId: row.employment.id,
      entryId,
      workHourTypeId: value.workHourTypeId,
      entryGranularity: value.entryGranularity,
      subjectPeriodStart: change.subjectPeriodStart,
      subjectPeriodEnd: isPeriodCell ? addMonth(change.subjectPeriodStart) : null,
      postingPeriodStart: monthStart(change.subjectPeriodStart),
      hours: change.hours,
      note: change.note ?? null,
      correctionReason: change.correctionReason ?? null,
    }, auth, row.employment))
  }
  return { saved }
}

export async function getActualWorkTeamProjection(month: string) {
  const { context, hrGroupId, supabase } = await authForGroup('leave:write')
  const from = monthStart(month)
  const to = addMonth(from)
  const [entriesResult, typesResult, employeesResult] = await Promise.all([
    supabase.from('employment_work_hour_entries').select('id,employee_id,employment_id,work_hour_type_id,work_date,hours,entry_granularity,note').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('status', 'APPROVED').eq('entry_granularity', 'DAY').gte('work_date', from).lt('work_date', to).limit(5000),
    supabase.from('work_hour_types').select('id,name,code,family,color_code,show_in_team_overview').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).eq('show_in_team_overview', true).limit(500),
    supabase.from('employees').select('id,first_name,birth_name_prefix,birth_name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_archived', false).is('deleted_at', null).limit(5000),
  ])
  if (entriesResult.error || typesResult.error || employeesResult.error) databaseError(entriesResult.error ?? typesResult.error ?? employeesResult.error)
  const typeById = new Map((typesResult.data ?? []).map((type) => [type.id, type]))
  const employeeById = new Map((employeesResult.data ?? []).map((employee) => [employee.id, employee]))
  return (entriesResult.data ?? []).flatMap((entry) => {
    const type = typeById.get(entry.work_hour_type_id)
    const employee = employeeById.get(entry.employee_id)
    return type && employee ? [{ ...entry, type, employee }] : []
  })
}

export async function getActualWorkInsights(month: string) {
  const rows = await getActualWorkTeamProjection(month)
  const totals = new Map<ActualWorkFamily, number>()
  for (const row of rows) totals.set(row.type.family, (totals.get(row.type.family) ?? 0) + Number(row.hours))
  const { context, hrGroupId, supabase } = await authForGroup('leave:write')
  const correctionResult = await supabase.from('actual_work_revisions').select('id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('operation', 'CORRECTION').gte('subject_period_start', monthStart(month)).lt('subject_period_start', addMonth(month)).limit(5000)
  if (correctionResult.error) databaseError(correctionResult.error)
  return { month: monthStart(month), totalEntries: rows.length, totals: Object.fromEntries(totals), corrections: correctionResult.data?.length ?? 0, rows }
}

function addDays(date: string, count: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + count)
  return value.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): string[] {
  const days: string[] = []
  let cursor = from
  while (cursor < to) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}
