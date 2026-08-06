import { NextResponse } from 'next/server'
import type { Database, Json, Tables } from '@scope/db'
import { permissionErrorResponse, requireAuthContext, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { LeaveCatalogMutation, LeaveConfigurationMutation, OvertimeConfigurationMutation, WorkHourConfigurationMutation } from './schemas'
import { calculateLeaveBalanceReport, type ReportAccrualMoment, type ReportBucket, type ReportCarryForward, type ReportLeaveType, type ReportTransaction } from './report'
import { resolveLeaveEmployment, type LeaveEmployment, type LeaveEmploymentOption } from './employment-resolver'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type EmploymentRow = LeaveEmployment
type OvertimeLimitMode = Database['public']['Enums']['overtime_limit_mode']
type CreateLeaveAccrualRuleArgs = Omit<
  Database['public']['Functions']['create_group_leave_accrual_rule']['Args'],
  'requested_predecessor_rule_id' | 'requested_valid_until' | 'requested_accrual_amount' | 'requested_accrual_rate'
> & {
  requested_predecessor_rule_id: string | null
  requested_valid_until: string | null
  requested_accrual_amount: number | null
  requested_accrual_rate: number | null
}

export class LeaveServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(code)
    this.name = 'LeaveServiceError'
  }
}

function databaseError(error: { message: string } | null): never {
  throw new LeaveServiceError(error?.message.includes('LEAVE_') ? error.message.match(/LEAVE_[A-Z_]+/)?.[0] ?? 'LEAVE_OPERATION_FAILED' : 'LEAVE_OPERATION_FAILED', 500)
}

async function loadEmployment(
  supabase: SupabaseServerClient,
  context: Awaited<ReturnType<typeof requireAuthContext>>,
  employmentId: string | undefined,
  asOfDate: string,
): Promise<{ employment: EmploymentRow; options: LeaveEmploymentOption[] }> {
  let targetEmployeeId = context.employeeId
  if (!targetEmployeeId && employmentId && context.hrGroupId) {
    const target = await supabase.from('employments').select('employee_id').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('id', employmentId).maybeSingle()
    if (target.error) databaseError(target.error)
    targetEmployeeId = target.data?.employee_id ?? null
  }
  if (!targetEmployeeId) throw new LeaveServiceError('LEAVE_EMPLOYMENT_REQUIRED', 400)
  const selection = await resolveLeaveEmployment(supabase, context, targetEmployeeId, employmentId, asOfDate)
  if (!selection.employment) {
    if (selection.options.length > 1) {
      throw new LeaveServiceError('LEAVE_EMPLOYMENT_SELECTION_REQUIRED', 409, { options: selection.options })
    }
    throw new LeaveServiceError(employmentId ? 'LEAVE_EMPLOYMENT_NOT_FOUND' : 'LEAVE_EMPLOYMENT_REQUIRED', employmentId ? 404 : 400)
  }
  await requirePermission('leave:read', selection.employment.employee_id)
  return { employment: selection.employment, options: selection.options }
}

async function queryReportRows(
  supabase: SupabaseServerClient,
  context: Awaited<ReturnType<typeof requireAuthContext>>,
  employment: EmploymentRow,
  calendarYear: number,
  asOfDate: string,
) {
  const bucketQuery = supabase
    .from('leave_balance_buckets')
    .select('id, leave_type_id, accrual_year, expiration_date')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', employment.hr_group_id)
    .eq('employee_id', employment.employee_id)
    .eq('employment_id', employment.id)
    .limit(1000)
  const transactionQuery = supabase
    .from('leave_accrual_transactions')
    .select('bucket_id, leave_type_id, transaction_type, amount, transaction_date, reason, actor_user_id')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', employment.hr_group_id)
    .eq('employee_id', employment.employee_id)
    .eq('employment_id', employment.id)
    .lte('transaction_date', String(calendarYear + 1) + '-01-01')
    .limit(5000)
  const leaveTypesQuery = supabase
    .from('leave_types')
    .select('id, name, color_code, entitlement_mode, annual_hours_cap, weekly_hours_cap_factor')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', employment.hr_group_id)
    .limit(500)
  const scheduleQuery = supabase
    .from('employment_schedules')
    .select('average_hours_per_week')
    .eq('tenant_id', context.tenantId)
    .eq('employee_id', employment.employee_id)
    .eq('employment_id', employment.id)
    .lte('valid_from', asOfDate)
    .or('valid_until.is.null,valid_until.gte.' + asOfDate)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  const rolloverQuery = supabase
    .from('leave_year_rollovers')
    .select('id')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', employment.hr_group_id)
    .lte('to_year', calendarYear)
    .limit(100)

  const [buckets, transactions, leaveTypes, schedule, rollovers] = await Promise.all([
    bucketQuery,
    transactionQuery,
    leaveTypesQuery,
    scheduleQuery,
    rolloverQuery,
  ])
  if (buckets.error) databaseError(buckets.error)
  if (transactions.error) databaseError(transactions.error)
  if (leaveTypes.error) databaseError(leaveTypes.error)
  if (schedule.error) databaseError(schedule.error)
  if (rollovers.error) databaseError(rollovers.error)

  let rolloverItems: Tables<'leave_year_rollover_items'>[] = []
  if (rollovers.data.length > 0) {
    const items = await supabase
      .from('leave_year_rollover_items')
      .select('id, source_bucket_id, leave_type_id, carried_hours, original_expiration_date, employment_id, hr_group_id, tenant_id, administration_id, rollover_id, created_at')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', employment.hr_group_id)
      .eq('employment_id', employment.id)
      .in('rollover_id', rollovers.data.map((row) => row.id))
      .limit(5000)
    if (items.error) databaseError(items.error)
    rolloverItems = items.data
  }

  const bucketRows: ReportBucket[] = buckets.data.map((row) => ({
    id: row.id,
    leaveTypeId: row.leave_type_id,
    accrualYear: row.accrual_year,
    expirationDate: row.expiration_date,
  }))
  const transactionsRows: ReportTransaction[] = transactions.data.map((row) => ({
    bucketId: row.bucket_id,
    leaveTypeId: row.leave_type_id,
    transactionType: row.transaction_type,
    amount: row.amount,
    transactionDate: row.transaction_date,
    reason: row.reason,
    actorUserId: row.actor_user_id,
  }))
  const leaveTypeRows: ReportLeaveType[] = leaveTypes.data.map((row) => ({
    id: row.id,
    name: row.name,
    colorCode: row.color_code,
    entitlementMode: row.entitlement_mode,
    annualHoursCap: row.annual_hours_cap,
    weeklyHoursCapFactor: row.weekly_hours_cap_factor,
    averageHoursPerWeek: schedule.data?.average_hours_per_week ?? null,
  }))
  const bucketYears = new Map(bucketRows.map((bucket) => [bucket.id, bucket.accrualYear]))
  const carryForwards: ReportCarryForward[] = rolloverItems
    .filter((item) => item.carried_hours > 0)
    .map((item) => ({
      sourceBucketId: item.source_bucket_id,
      sourceAccrualYear: bucketYears.get(item.source_bucket_id) ?? calendarYear - 1,
      carriedHours: item.carried_hours,
      expirationDate: item.original_expiration_date,
    }))
  const projectedTaken = transactionsRows
    .filter((row) => row.transactionType === 'TAKEN' && row.transactionDate > asOfDate && row.transactionDate <= String(calendarYear) + '-12-31')
    .map((row) => ({ leaveTypeId: row.leaveTypeId, amount: Math.abs(row.amount) }))

  return { bucketRows, transactionsRows, leaveTypeRows, carryForwards, projectedTaken }
}

export async function getLeaveBalanceReport(input: { employmentId?: string; asOfDate?: string }) {
  const supabase = await createClient()
  const context = await requireAuthContext(supabase)
  const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10)
  const calendarYear = Number(asOfDate.slice(0, 4))
  const selection = await loadEmployment(supabase, context, input.employmentId, asOfDate)
  const rows = await queryReportRows(supabase, context, selection.employment, calendarYear, asOfDate)
  const report = calculateLeaveBalanceReport({
    employmentId: selection.employment.id,
    calendarYear,
    asOfDate,
    employmentEndDate: selection.employment.ends_on,
    leaveTypes: rows.leaveTypeRows,
    buckets: rows.bucketRows,
    transactions: rows.transactionsRows,
    carryForwards: rows.carryForwards,
    projectedTaken: rows.projectedTaken,
    monthlyAccrualMoments: [] as ReportAccrualMoment[],
  })
  return {
    report,
    employmentSelection: {
      required: selection.options.length > 1,
      selectedEmploymentId: selection.employment.id,
      options: selection.options,
    },
  }
}

export async function listLeaveCatalog() {
  const context = await requirePermission('leave:read')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [leaveTypes, workHourTypes, overtimeSettings, profiles, rules, bonusRules, bonusTiers, priorityRules, priorityRuleItems, accrualRuleWorkHourTypes, accrualRulePauseTypes, leaveAccrualExceptions, exceptionEmployees, exceptionEmployments, employeeSets, employeeSetMembers] = await Promise.all([
    supabase.from('leave_types').select('id, name, color_code, scope, entitlement_mode, annual_hours_cap, weekly_hours_cap_factor, is_active, is_self_service, is_system, allow_limit_overrun, pin_in_calendar, requires_manager_approval, notify_manager_on_request, requires_manager_approval_on_cancellation').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('name').limit(500),
    supabase.from('work_hour_types').select('id, name, color_code, category, is_active, is_self_service, pin_in_calendar').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('name').limit(500),
    supabase.from('overtime_type_settings').select('id, work_hour_type_id, notify_manager_on_entry, is_self_service, limit_mode, limit_hours, contract_hours_factor').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).limit(500),
    supabase.from('leave_profiles').select('id, name, description, is_active, is_group_default').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('name').limit(500),
    supabase.from('leave_accrual_rules').select('id, leave_profile_id, leave_type_id, predecessor_rule_id, valid_from, valid_until, accrual_basis, accrual_frequency, accrual_timing, accrual_amount, accrual_rate, expiration_months').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('valid_from').limit(2000),
    supabase.from('leave_bonus_rules').select('id, leave_profile_id, leave_type_id, name, trigger_type, award_timing, pro_rate_first_year, is_active').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('name').limit(500),
    supabase.from('leave_bonus_tiers').select('id, bonus_rule_id, threshold_years, bonus_amount').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('threshold_years').limit(5000),
    supabase.from('leave_priority_rules').select('id, leave_profile_id, name, valid_from, valid_until, is_active').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('valid_from').limit(500),
    supabase.from('leave_priority_rule_items').select('priority_rule_id, leave_type_id, sort_order').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('sort_order').limit(5000),
    supabase.from('leave_accrual_rule_work_hour_types').select('accrual_rule_id, work_hour_type_id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).limit(5000),
    supabase.from('leave_accrual_rule_pause_types').select('accrual_rule_id, pause_leave_type_id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).limit(5000),
    supabase.from('leave_accrual_exceptions').select('id, employee_id, employment_id, leave_type_id, valid_from, valid_until, no_accrual, accrual_amount, expiration_months, reason').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('valid_from', { ascending: false }).limit(2000),
    supabase.from('employees').select('id, employee_number, first_name, birth_name_prefix, birth_name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).order('birth_name').order('first_name').limit(2000),
    supabase.from('employments').select('id, employee_id, employment_number, starts_on, ends_on, is_primary').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', today).or(`ends_on.is.null,ends_on.gte.${today}`).order('is_primary', { ascending: false }).order('starts_on', { ascending: false }).limit(2000),
    supabase.from('employee_sets').select('id, name, description, priority, is_active, leave_profile_id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('priority').order('name').limit(500),
    supabase.from('employee_set_members').select('id, employee_set_id, employee_id, valid_from, valid_until').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('valid_from', { ascending: false }).limit(5000),
  ])
  if (leaveTypes.error) databaseError(leaveTypes.error)
  if (workHourTypes.error) databaseError(workHourTypes.error)
  if (overtimeSettings.error) databaseError(overtimeSettings.error)
  if (profiles.error) databaseError(profiles.error)
  if (rules.error) databaseError(rules.error)
  if (bonusRules.error) databaseError(bonusRules.error)
  if (bonusTiers.error) databaseError(bonusTiers.error)
  if (priorityRules.error) databaseError(priorityRules.error)
  if (priorityRuleItems.error) databaseError(priorityRuleItems.error)
  if (accrualRuleWorkHourTypes.error) databaseError(accrualRuleWorkHourTypes.error)
  if (accrualRulePauseTypes.error) databaseError(accrualRulePauseTypes.error)
  if (leaveAccrualExceptions.error) databaseError(leaveAccrualExceptions.error)
  if (exceptionEmployees.error) databaseError(exceptionEmployees.error)
  if (exceptionEmployments.error) databaseError(exceptionEmployments.error)
  if (employeeSets.error) databaseError(employeeSets.error)
  if (employeeSetMembers.error) databaseError(employeeSetMembers.error)
  const employeeNames = new Map(exceptionEmployees.data.map((employee) => [employee.id, [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')]))
  return {
    leaveTypes: leaveTypes.data,
    workHourTypes: workHourTypes.data,
    overtimeSettings: overtimeSettings.data,
    profiles: profiles.data,
    accrualRules: rules.data,
    bonusRules: bonusRules.data,
    bonusTiers: bonusTiers.data,
    priorityRules: priorityRules.data,
    priorityRuleItems: priorityRuleItems.data,
    accrualRuleWorkHourTypes: accrualRuleWorkHourTypes.data,
    accrualRulePauseTypes: accrualRulePauseTypes.data,
    leaveAccrualExceptions: leaveAccrualExceptions.data.map((exception) => ({ ...exception, employee_name: employeeNames.get(exception.employee_id) ?? exception.employee_id })),
    leaveExceptionEmployees: exceptionEmployments.data.map((employment) => ({
      employee_id: employment.employee_id,
      employment_id: employment.id,
      employment_number: employment.employment_number,
      employee_name: employeeNames.get(employment.employee_id) ?? employment.employee_id,
    })),
    employeeSets: employeeSets.data,
    employeeSetMembers: employeeSetMembers.data,
    employeeSetEmployees: exceptionEmployees.data.map((employee) => ({
      id: employee.id,
      employee_number: employee.employee_number,
      employee_name: employeeNames.get(employee.id) ?? employee.id,
    })),
  }
}

export type LeaveCatalog = Awaited<ReturnType<typeof listLeaveCatalog>>

export async function createLeaveCatalogItem(input: LeaveCatalogMutation) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()

  if (input.action === 'LEAVE_TYPE') {
    const result = await supabase.from('leave_types').insert({
      tenant_id: context.tenantId,
      hr_group_id: hrGroupId,
      administration_id: null,
      name: input.name,
      color_code: input.colorCode,
      scope: input.scope,
      entitlement_mode: input.entitlementMode,
      annual_hours_cap: input.entitlementMode === 'ANNUAL_HOURS_CAP' ? input.annualHoursCap ?? null : null,
      weekly_hours_cap_factor: input.entitlementMode === 'WEEKLY_HOURS_FACTOR_CAP' ? input.weeklyHoursCapFactor ?? null : null,
      is_self_service: input.isSelfService,
      allow_limit_overrun: input.allowLimitOverrun,
      pin_in_calendar: input.pinInCalendar,
      requires_manager_approval: input.requiresManagerApproval,
      notify_manager_on_request: input.notifyManagerOnRequest,
      requires_manager_approval_on_cancellation: input.requiresManagerApprovalOnCancellation,
      is_active: input.isActive,
      is_system: false,
      created_by: context.userId,
      updated_by: context.userId,
    }).select('id').single()
    if (result.error || !result.data) databaseError(result.error)
    return { kind: input.action, id: result.data.id }
  }

  if (input.action === 'WORK_HOUR_TYPE') {
    const result = await supabase.from('work_hour_types').insert({
      tenant_id: context.tenantId,
      hr_group_id: hrGroupId,
      administration_id: null,
      name: input.name,
      color_code: input.colorCode,
      category: input.category,
      is_active: input.isActive,
      is_self_service: input.isSelfService,
      pin_in_calendar: input.pinInCalendar,
      created_by: context.userId,
      updated_by: context.userId,
    }).select('id').single()
    if (result.error || !result.data) databaseError(result.error)
    {
      const settings = await supabase.from('overtime_type_settings').insert({
        tenant_id: context.tenantId,
        hr_group_id: hrGroupId,
        administration_id: null,
        work_hour_type_id: result.data.id,
        notify_manager_on_entry: input.notifyManagerOnEntry,
        is_self_service: input.isSelfService,
        limit_mode: input.limitMode,
        limit_hours: input.limitMode === 'MONTHLY_HOURS' || input.limitMode === 'YEARLY_HOURS' ? input.limitHours ?? null : null,
        contract_hours_factor: input.limitMode === 'CONTRACT_HOURS_FACTOR' ? input.contractHoursFactor ?? null : null,
        created_by: context.userId,
        updated_by: context.userId,
      }).select('id').single()
      if (settings.error || !settings.data) databaseError(settings.error)
    }
    return { kind: input.action, id: result.data.id }
  }

  const result = await supabase.from('leave_profiles').insert({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    administration_id: null,
    name: input.name,
    description: input.description ?? null,
    is_active: input.isActive,
    created_by: context.userId,
    updated_by: context.userId,
  }).select('id').single()
  if (result.error || !result.data) databaseError(result.error)
  return { kind: input.action, id: result.data.id }
}

type CatalogUpdateInput = Extract<LeaveConfigurationMutation, { action: 'UPDATE_PROFILE' }>
type CatalogArchiveInput = Extract<LeaveConfigurationMutation, { action: 'ARCHIVE_LEAVE_TYPE' | 'ARCHIVE_WORK_HOUR_TYPE' | 'ARCHIVE_PROFILE' }>

export async function updateLeaveCatalogItem(input: CatalogUpdateInput | CatalogArchiveInput) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()

  if (input.action === 'ARCHIVE_LEAVE_TYPE') {
    const result = await supabase.from('leave_types').update({ is_active: false, updated_by: context.userId }).eq('id', input.id).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).select('id').maybeSingle()
    if (result.error) databaseError(result.error)
    if (!result.data) throw new LeaveServiceError('LEAVE_CATALOG_ITEM_NOT_FOUND', 404)
    return { id: result.data.id, action: input.action }
  }

  if (input.action === 'ARCHIVE_WORK_HOUR_TYPE') {
    const result = await supabase.from('work_hour_types').update({ is_active: false, updated_by: context.userId }).eq('id', input.id).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).select('id').maybeSingle()
    if (result.error) databaseError(result.error)
    if (!result.data) throw new LeaveServiceError('LEAVE_CATALOG_ITEM_NOT_FOUND', 404)
    return { id: result.data.id, action: input.action }
  }

  if (input.action === 'ARCHIVE_PROFILE') {
    const result = await supabase.from('leave_profiles').update({ is_active: false, updated_by: context.userId }).eq('id', input.id).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).select('id').maybeSingle()
    if (result.error) databaseError(result.error)
    if (!result.data) throw new LeaveServiceError('LEAVE_CATALOG_ITEM_NOT_FOUND', 404)
    return { id: result.data.id, action: input.action }
  }

  if (!('description' in input)) throw new LeaveServiceError('LEAVE_CONFIGURATION_ACTION_NOT_AVAILABLE', 400)
  const result = await supabase.from('leave_profiles').update({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    updated_by: context.userId,
  }).eq('id', input.id).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).select('id').maybeSingle()
  if (result.error) databaseError(result.error)
  if (!result.data) throw new LeaveServiceError('LEAVE_CATALOG_ITEM_NOT_FOUND', 404)
  return { id: result.data.id, action: input.action }
}

export interface OvertimeEmployeeOption {
  id: string
  employeeNumber: string
  name: string
}

export interface OvertimeExceptionRow {
  id: string
  employeeId: string
  employeeName: string
  allowOvertimeEntry: boolean
  isSelfService: boolean
  limitMode: OvertimeLimitMode
  limitHours: number | null
  contractHoursFactor: number | null
}

export interface OvertimeSettingsPageData {
  settings: {
    id: string
    workHourTypeId: string
    notifyManagerOnEntry: boolean
    isSelfService: boolean
    limitMode: OvertimeLimitMode
    limitHours: number | null
    contractHoursFactor: number | null
  }
  exceptions: OvertimeExceptionRow[]
  employees: OvertimeEmployeeOption[]
}

export async function getOvertimeSettingsPageData(workHourTypeId: string, mode: 'OVERTIME' | 'WORK' = 'OVERTIME'): Promise<OvertimeSettingsPageData> {
  const context = await requirePermission('leave:read')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const type = await supabase.from('work_hour_types').select('id, category').eq('id', workHourTypeId).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).maybeSingle()
  if (type.error) databaseError(type.error)
  if (!type.data || (mode === 'OVERTIME' ? type.data.category !== 'OVERTIME' : type.data.category === 'INFORMATIONAL')) throw new LeaveServiceError('WORK_HOUR_TYPE_NOT_FOUND', 404)

  const [settings, exceptions, assignments] = await Promise.all([
    supabase.from('overtime_type_settings').select('id, work_hour_type_id, notify_manager_on_entry, is_self_service, limit_mode, limit_hours, contract_hours_factor').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('work_hour_type_id', workHourTypeId).maybeSingle(),
    supabase.from('overtime_type_exceptions').select('id, employee_id, allow_overtime_entry, is_self_service, limit_mode, limit_hours, contract_hours_factor').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('work_hour_type_id', workHourTypeId).order('created_at').limit(500),
    supabase.from('employments').select('employee_id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', new Date().toISOString().slice(0, 10)).or(`ends_on.is.null,ends_on.gte.${new Date().toISOString().slice(0, 10)}`).limit(5000),
  ])
  if (settings.error) databaseError(settings.error)
  if (exceptions.error) databaseError(exceptions.error)
  if (assignments.error) databaseError(assignments.error)
  if (!settings.data) throw new LeaveServiceError('OVERTIME_SETTINGS_NOT_FOUND', 404)

  const employeeIds = [...new Set(assignments.data.map((row) => row.employee_id))]
  const employees = employeeIds.length
    ? await supabase.from('employees').select('id, employee_number, first_name, birth_name_prefix, birth_name').eq('tenant_id', context.tenantId).in('id', employeeIds).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).order('birth_name').order('first_name').limit(500)
    : { data: [], error: null }
  if (employees.error) databaseError(employees.error)
  const employeeNames = new Map(employees.data.map((employee) => [employee.id, [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')]))
  return {
    settings: {
      id: settings.data.id,
      workHourTypeId: settings.data.work_hour_type_id,
      notifyManagerOnEntry: settings.data.notify_manager_on_entry,
      isSelfService: settings.data.is_self_service,
      limitMode: settings.data.limit_mode,
      limitHours: settings.data.limit_hours,
      contractHoursFactor: settings.data.contract_hours_factor,
    },
    exceptions: exceptions.data.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: employeeNames.get(row.employee_id) ?? row.employee_id,
      allowOvertimeEntry: row.allow_overtime_entry,
      isSelfService: row.is_self_service,
      limitMode: row.limit_mode,
      limitHours: row.limit_hours,
      contractHoursFactor: row.contract_hours_factor,
    })),
    employees: employees.data.map((employee) => ({ id: employee.id, employeeNumber: employee.employee_number, name: [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ') })),
  }
}

function overtimeLimitPayload(input: { limitMode: OvertimeLimitMode; limitHours?: number | null; contractHoursFactor?: number | null }) {
  return {
    limit_mode: input.limitMode,
    limit_hours: input.limitMode === 'MONTHLY_HOURS' || input.limitMode === 'YEARLY_HOURS' ? input.limitHours ?? null : null,
    contract_hours_factor: input.limitMode === 'CONTRACT_HOURS_FACTOR' ? input.contractHoursFactor ?? null : null,
  }
}

export async function updateOvertimeConfiguration(input: Extract<OvertimeConfigurationMutation, { action: 'OVERTIME_SETTINGS' }>) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const type = await supabase.from('work_hour_types').select('id, category').eq('id', input.workHourTypeId).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).maybeSingle()
  if (type.error) databaseError(type.error)
  if (!type.data || type.data.category !== 'OVERTIME') throw new LeaveServiceError('OVERTIME_TYPE_NOT_FOUND', 404)
  const result = await supabase.from('overtime_type_settings').update({
    notify_manager_on_entry: input.notifyManagerOnEntry,
    is_self_service: input.isSelfService,
    ...overtimeLimitPayload(input),
    updated_by: context.userId,
  }).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('work_hour_type_id', input.workHourTypeId).select('id').maybeSingle()
  if (result.error) databaseError(result.error)
  if (!result.data) throw new LeaveServiceError('OVERTIME_SETTINGS_NOT_FOUND', 404)
  return { id: result.data.id }
}

export async function createOvertimeExceptions(input: Extract<OvertimeConfigurationMutation, { action: 'OVERTIME_EXCEPTION' }>) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const type = await supabase.from('work_hour_types').select('id, category').eq('id', input.workHourTypeId).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).maybeSingle()
  if (type.error) databaseError(type.error)
  if (!type.data || type.data.category !== 'OVERTIME') throw new LeaveServiceError('OVERTIME_TYPE_NOT_FOUND', 404)
  const today = new Date().toISOString().slice(0, 10)
  const assignments = await supabase.from('employments').select('employee_id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('employee_id', input.employeeIds).eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', today).or(`ends_on.is.null,ends_on.gte.${today}`).limit(500)
  if (assignments.error) databaseError(assignments.error)
  const employeeIds = [...new Set(assignments.data.map((row) => row.employee_id))]
  if (employeeIds.length !== input.employeeIds.length) throw new LeaveServiceError('OVERTIME_EXCEPTION_EMPLOYEE_INVALID', 400)
  const result = await supabase.from('overtime_type_exceptions').upsert(employeeIds.map((employeeId) => ({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    administration_id: null,
    work_hour_type_id: input.workHourTypeId,
    employee_id: employeeId,
    allow_overtime_entry: input.allowOvertimeEntry,
    is_self_service: input.isSelfService,
    ...overtimeLimitPayload(input),
    created_by: context.userId,
    updated_by: context.userId,
  })), { onConflict: 'tenant_id,hr_group_id,work_hour_type_id,employee_id' }).select('id')
  if (result.error) databaseError(result.error)
  return { count: result.data.length }
}

export async function updateWorkHourSettings(input: Extract<WorkHourConfigurationMutation, { action: 'WORK_HOUR_SETTINGS' }>) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const type = await supabase.from('work_hour_types').select('id, category').eq('id', input.workHourTypeId).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).maybeSingle()
  if (type.error) databaseError(type.error)
  if (!type.data || type.data.category === 'INFORMATIONAL') throw new LeaveServiceError('WORK_HOUR_TYPE_NOT_FOUND', 404)
  const result = await supabase.from('work_hour_types').update({ is_self_service: input.isSelfService, ...(input.isActive === undefined ? {} : { is_active: input.isActive }), ...(input.pinInCalendar === undefined ? {} : { pin_in_calendar: input.pinInCalendar }), updated_by: context.userId }).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('id', input.workHourTypeId).select('id').maybeSingle()
  if (result.error) databaseError(result.error)
  if (!result.data) throw new LeaveServiceError('WORK_HOUR_TYPE_NOT_FOUND', 404)
  const settings = await supabase.from('overtime_type_settings').update({ ...(input.notifyManagerOnEntry === undefined ? {} : { notify_manager_on_entry: input.notifyManagerOnEntry }), is_self_service: input.isSelfService, limit_mode: input.limitMode, limit_hours: input.limitHours ?? null, contract_hours_factor: input.contractHoursFactor ?? null, updated_by: context.userId }).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('work_hour_type_id', input.workHourTypeId).select('id').maybeSingle()
  if (settings.error) databaseError(settings.error)
  return { id: result.data.id }
}

export async function createWorkHourExceptions(input: Extract<WorkHourConfigurationMutation, { action: 'WORK_HOUR_EXCEPTION' }>) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const type = await supabase.from('work_hour_types').select('id, category').eq('id', input.workHourTypeId).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).maybeSingle()
  if (type.error) databaseError(type.error)
  if (!type.data || type.data.category === 'INFORMATIONAL') throw new LeaveServiceError('WORK_HOUR_TYPE_NOT_FOUND', 404)
  const today = new Date().toISOString().slice(0, 10)
  const assignments = await supabase.from('employments').select('employee_id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('employee_id', input.employeeIds).eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', today).or(`ends_on.is.null,ends_on.gte.${today}`).limit(500)
  if (assignments.error) databaseError(assignments.error)
  const employeeIds = [...new Set(assignments.data.map((row) => row.employee_id))]
  if (employeeIds.length !== input.employeeIds.length) throw new LeaveServiceError('WORK_HOUR_EXCEPTION_EMPLOYEE_INVALID', 400)
  const result = await supabase.from('overtime_type_exceptions').upsert(employeeIds.map((employeeId) => ({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    administration_id: null,
    work_hour_type_id: input.workHourTypeId,
    employee_id: employeeId,
    allow_overtime_entry: true,
    is_self_service: input.isSelfService,
    ...overtimeLimitPayload(input),
    created_by: context.userId,
    updated_by: context.userId,
  })), { onConflict: 'tenant_id,hr_group_id,work_hour_type_id,employee_id' }).select('id')
  if (result.error) databaseError(result.error)
  return { count: result.data.length }
}

type AccrualRuleInput = Extract<LeaveConfigurationMutation, { action: 'ACCRUAL_RULE' }>

export async function createLeaveAccrualRule(input: AccrualRuleInput) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const args: CreateLeaveAccrualRuleArgs = {
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: hrGroupId,
    requested_leave_profile_id: input.leaveProfileId,
    requested_leave_type_id: input.leaveTypeId,
    requested_predecessor_rule_id: input.predecessorRuleId ?? null,
    requested_valid_from: input.validFrom,
    requested_valid_until: input.validUntil ?? null,
    requested_accrual_basis: input.accrualBasis,
    requested_accrual_frequency: input.accrualFrequency,
    requested_accrual_timing: input.accrualTiming,
    requested_accrual_amount: input.accrualBasis === 'CONTRACT_HOURS' ? input.accrualAmount ?? null : null,
    requested_accrual_rate: input.accrualBasis === 'WORKED_HOURS' ? input.accrualRate ?? null : null,
    requested_expiration_months: input.expirationMonths,
    requested_work_hour_type_ids: input.workHourTypeIds,
    requested_pause_leave_type_ids: input.pauseLeaveTypeIds,
  }
  // Postgres-functieargumenten mogen null zijn, maar de generator neemt die nullability niet op.
  const rule = await supabase.rpc(
    'create_group_leave_accrual_rule',
    args as unknown as Database['public']['Functions']['create_group_leave_accrual_rule']['Args'],
  )
  if (rule.error || !rule.data) databaseError(rule.error)
  return { id: rule.data }
}

type BonusRuleInput = Extract<LeaveConfigurationMutation, { action: 'BONUS_RULE' }>

export async function createLeaveBonusRule(input: BonusRuleInput) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const result = await supabase.rpc('create_group_leave_bonus_rule', {
    requested_tenant_id: context.tenantId,
    requested_hr_group_id: hrGroupId,
    requested_leave_profile_id: input.leaveProfileId,
    requested_leave_type_id: input.leaveTypeId,
    requested_name: input.name,
    requested_trigger_type: input.triggerType,
    requested_award_timing: input.awardTiming,
    requested_pro_rate_first_year: input.proRateFirstYear,
    requested_is_active: input.isActive,
    requested_tiers: input.tiers as Json,
  })
  if (result.error || !result.data) databaseError(result.error)
  return { id: result.data }
}

type ExceptionInput = Extract<LeaveConfigurationMutation, { action: 'ACCRUAL_EXCEPTION' }>
type ProfileAssignmentInput = Extract<LeaveConfigurationMutation, { action: 'PROFILE_ASSIGNMENT' }>

export async function createLeaveException(input: ExceptionInput) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const employmentIds = input.employmentSelections.map((selection) => selection.employmentId)
  if (new Set(employmentIds).size !== employmentIds.length || (input.validUntil !== undefined && input.validUntil !== null && input.validUntil <= input.validFrom)) throw new LeaveServiceError('LEAVE_EXCEPTION_PERIOD_INVALID', 400)
  const leaveType = await supabase.from('leave_types').select('id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('id', input.leaveTypeId).eq('is_active', true).maybeSingle()
  if (leaveType.error) databaseError(leaveType.error)
  if (!leaveType.data) throw new LeaveServiceError('LEAVE_TYPE_NOT_FOUND', 404)
  const employments = await supabase.from('employments').select('id, employee_id, administration_id, starts_on, ends_on').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', employmentIds).eq('record_status', 'CONFIRMED').is('deleted_at', null).limit(2000)
  if (employments.error) databaseError(employments.error)
  const selectedEmploymentById = new Map(employments.data.map((employment) => [employment.id, employment]))
  if (selectedEmploymentById.size !== new Set(employmentIds).size || input.employmentSelections.some((selection) => {
    const employment = selectedEmploymentById.get(selection.employmentId)
    return !employment || employment.employee_id !== selection.employeeId || input.validFrom < employment.starts_on || (employment.ends_on !== null && input.validFrom > employment.ends_on) || (input.validUntil !== undefined && input.validUntil !== null && employment.ends_on !== null && input.validUntil > employment.ends_on)
  })) throw new LeaveServiceError('LEAVE_EXCEPTION_EMPLOYMENT_INVALID', 400)
  const result = await supabase.from('leave_accrual_exceptions').insert(input.employmentSelections.map((selection) => {
    const administrationId = selectedEmploymentById.get(selection.employmentId)?.administration_id
    if (!administrationId) throw new LeaveServiceError('LEAVE_EXCEPTION_EMPLOYMENT_INVALID', 400)
    return {
      administration_id: administrationId,
      tenant_id: context.tenantId,
      hr_group_id: hrGroupId,
      employee_id: selection.employeeId,
      employment_id: selection.employmentId,
      leave_type_id: input.leaveTypeId,
      valid_from: input.validFrom,
      valid_until: input.validUntil ?? null,
      no_accrual: input.noAccrual,
      accrual_amount: input.noAccrual ? null : input.accrualAmount ?? null,
      expiration_months: input.expirationMonths ?? null,
      reason: input.reason,
      created_by: context.userId,
    }
  })).select('id')
  if (result.error) databaseError(result.error)
  return { count: result.data.length, ids: result.data.map((row) => row.id) }
}

export async function assignLeaveProfile(input: ProfileAssignmentInput) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const employment = await supabase.from('employments').select('administration_id, employee_id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('id', input.employmentId).eq('employee_id', input.employeeId).eq('record_status', 'CONFIRMED').is('deleted_at', null).maybeSingle()
  if (employment.error) databaseError(employment.error)
  if (!employment.data) throw new LeaveServiceError('LEAVE_EMPLOYMENT_NOT_FOUND', 404)
  const profile = await supabase.from('leave_profiles').select('id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('id', input.leaveProfileId).eq('is_active', true).maybeSingle()
  if (profile.error) databaseError(profile.error)
  if (!profile.data) throw new LeaveServiceError('LEAVE_PROFILE_NOT_FOUND', 404)
  const result = await supabase.from('employment_leave_profiles').insert({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    administration_id: employment.data.administration_id,
    employee_id: input.employeeId,
    employment_id: input.employmentId,
    leave_profile_id: input.leaveProfileId,
    valid_from: input.validFrom,
    valid_until: input.validUntil ?? null,
    created_by: context.userId,
  }).select('id').single()
  if (result.error || !result.data) databaseError(result.error)
  return { id: result.data.id }
}

type EmployeeSetInput = Extract<LeaveConfigurationMutation, { action: 'EMPLOYEE_SET' }>
type EmployeeSetMemberInput = Extract<LeaveConfigurationMutation, { action: 'EMPLOYEE_SET_MEMBER' }>

export async function createEmployeeSet(input: EmployeeSetInput) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const profile = await supabase.from('leave_profiles').select('id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('id', input.leaveProfileId).eq('is_active', true).maybeSingle()
  if (profile.error) databaseError(profile.error)
  if (!profile.data) throw new LeaveServiceError('LEAVE_PROFILE_NOT_FOUND', 404)
  const result = await supabase.from('employee_sets').insert({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    leave_profile_id: input.leaveProfileId,
    name: input.name,
    description: input.description ?? null,
    priority: input.priority,
    is_active: input.isActive,
    created_by: context.userId,
    updated_by: context.userId,
  }).select('id').single()
  if (result.error || !result.data) databaseError(result.error)
  return { id: result.data.id }
}

export async function addEmployeeSetMember(input: EmployeeSetMemberInput) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  if (input.validUntil && input.validUntil <= input.validFrom) throw new LeaveServiceError('EMPLOYEE_SET_MEMBER_PERIOD_INVALID', 400)
  const [employeeSet, employee] = await Promise.all([
    supabase.from('employee_sets').select('id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('id', input.employeeSetId).eq('is_active', true).maybeSingle(),
    supabase.from('employees').select('id').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('id', input.employeeId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).maybeSingle(),
  ])
  if (employeeSet.error) databaseError(employeeSet.error)
  if (employee.error) databaseError(employee.error)
  if (!employeeSet.data) throw new LeaveServiceError('EMPLOYEE_SET_NOT_FOUND', 404)
  if (!employee.data) throw new LeaveServiceError('EMPLOYEE_NOT_FOUND', 404)
  const result = await supabase.from('employee_set_members').insert({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    employee_set_id: input.employeeSetId,
    employee_id: input.employeeId,
    valid_from: input.validFrom,
    valid_until: input.validUntil ?? null,
    created_by: context.userId,
  }).select('id').single()
  if (result.error || !result.data) databaseError(result.error)
  return { id: result.data.id }
}

type PriorityRuleInput = Extract<LeaveConfigurationMutation, { action: 'PRIORITY_RULE' }>
type PriorityRuleUpdateInput = Extract<LeaveConfigurationMutation, { action: 'UPDATE_PRIORITY_RULE' }>

async function insertPriorityRuleItems(supabase: SupabaseServerClient, context: Awaited<ReturnType<typeof requireAuthContext>>, priorityRuleId: string, items: PriorityRuleInput['items']) {
  const hrGroupId = requireHrGroupId(context)
  const result = await supabase.from('leave_priority_rule_items').insert(items.map((item) => ({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    administration_id: null,
    priority_rule_id: priorityRuleId,
    leave_type_id: item.leaveTypeId,
    sort_order: item.sortOrder,
  })))
  if (result.error) databaseError(result.error)
}

export async function createLeavePriorityRule(input: PriorityRuleInput) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const rule = await supabase.from('leave_priority_rules').insert({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    administration_id: null,
    leave_profile_id: input.leaveProfileId,
    name: input.name,
    valid_from: input.validFrom,
    valid_until: input.validUntil ?? null,
    is_active: input.isActive,
    created_by: context.userId,
  }).select('id').single()
  if (rule.error || !rule.data) databaseError(rule.error)
  await insertPriorityRuleItems(supabase, context, rule.data.id, input.items)
  return { id: rule.data.id }
}

export async function updateLeavePriorityRule(input: PriorityRuleUpdateInput) {
  const context = await requirePermission('leave:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const rule = await supabase.from('leave_priority_rules').update({
    leave_profile_id: input.leaveProfileId,
    name: input.name,
    valid_from: input.validFrom,
    valid_until: input.validUntil ?? null,
    is_active: input.isActive,
  }).eq('id', input.id).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).select('id').maybeSingle()
  if (rule.error) databaseError(rule.error)
  if (!rule.data) throw new LeaveServiceError('LEAVE_PRIORITY_RULE_NOT_FOUND', 404)

  const deletedItems = await supabase.from('leave_priority_rule_items').delete().eq('priority_rule_id', input.id).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
  if (deletedItems.error) databaseError(deletedItems.error)
  await insertPriorityRuleItems(supabase, context, input.id, input.items)
  return { id: input.id }
}

export function leaveErrorResponse(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof LeaveServiceError) return NextResponse.json({ error: error.code, details: error.details }, { status: error.status })
  return NextResponse.json({ error: 'LEAVE_OPERATION_FAILED' }, { status: 500 })
}
