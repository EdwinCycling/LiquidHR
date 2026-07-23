import { NextResponse } from 'next/server'
import type { Json, Tables } from '@scope/db'
import { permissionErrorResponse, requireAuthContext, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { LeaveCatalogMutation, LeaveConfigurationMutation } from './schemas'
import { calculateLeaveBalanceReport, type ReportAccrualMoment, type ReportBucket, type ReportCarryForward, type ReportLeaveType, type ReportTransaction } from './report'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type EmploymentRow = Pick<Tables<'employments'>, 'id' | 'employee_id' | 'starts_on' | 'ends_on' | 'administration_id' | 'tenant_id'>

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

function requireAdministration(context: { administrationId: string | null }): string {
  if (!context.administrationId) throw new LeaveServiceError('LEAVE_ADMINISTRATION_REQUIRED', 400)
  return context.administrationId
}

function databaseError(error: { message: string } | null): never {
  throw new LeaveServiceError(error?.message.includes('LEAVE_') ? error.message.match(/LEAVE_[A-Z_]+/)?.[0] ?? 'LEAVE_OPERATION_FAILED' : 'LEAVE_OPERATION_FAILED', 500)
}

function isActiveOn(row: Pick<EmploymentRow, 'starts_on' | 'ends_on'>, date: string): boolean {
  return row.starts_on <= date && (row.ends_on === null || row.ends_on >= date)
}

async function loadEmployment(
  supabase: SupabaseServerClient,
  context: Awaited<ReturnType<typeof requireAuthContext>>,
  employmentId: string | undefined,
  asOfDate: string,
): Promise<{ employment: EmploymentRow; options: EmploymentRow[] }> {
  if (employmentId) {
    let employmentQuery = supabase
      .from('employments')
      .select('id, employee_id, starts_on, ends_on, administration_id, tenant_id')
      .eq('id', employmentId)
      .eq('tenant_id', context.tenantId)
    if (context.administrationId) employmentQuery = employmentQuery.eq('administration_id', context.administrationId)
    const result = await employmentQuery.maybeSingle()
    if (result.error) databaseError(result.error)
    if (!result.data) throw new LeaveServiceError('LEAVE_EMPLOYMENT_NOT_FOUND', 404)
    await requirePermission('leave:read', result.data.employee_id)
    return { employment: result.data, options: [result.data] }
  }

  if (!context.employeeId) throw new LeaveServiceError('LEAVE_EMPLOYMENT_REQUIRED', 400)
  let query = supabase
    .from('employments')
    .select('id, employee_id, starts_on, ends_on, administration_id, tenant_id')
    .eq('tenant_id', context.tenantId)
    .eq('employee_id', context.employeeId)
  if (context.administrationId) query = query.eq('administration_id', context.administrationId)
  const result = await query.order('starts_on', { ascending: false }).limit(100)
  if (result.error) databaseError(result.error)
  const options = result.data.filter((row) => isActiveOn(row, asOfDate))
  if (options.length === 0) throw new LeaveServiceError('LEAVE_EMPLOYMENT_REQUIRED', 400)
  if (options.length > 1) {
    throw new LeaveServiceError('LEAVE_EMPLOYMENT_SELECTION_REQUIRED', 409, {
      options: options.map((row) => ({ id: row.id, startsOn: row.starts_on, endsOn: row.ends_on })),
    })
  }
  await requirePermission('leave:read', options[0].employee_id)
  return { employment: options[0], options }
}

async function queryReportRows(
  supabase: SupabaseServerClient,
  context: Awaited<ReturnType<typeof requireAuthContext>>,
  employment: EmploymentRow,
  calendarYear: number,
  asOfDate: string,
) {
  const administrationId = requireAdministration(context)
  const bucketQuery = supabase
    .from('leave_balance_buckets')
    .select('id, leave_type_id, accrual_year, expiration_date')
    .eq('tenant_id', context.tenantId)
    .eq('administration_id', administrationId)
    .eq('employee_id', employment.employee_id)
    .eq('employment_id', employment.id)
    .limit(1000)
  const transactionQuery = supabase
    .from('leave_accrual_transactions')
    .select('bucket_id, leave_type_id, transaction_type, amount, transaction_date, reason, actor_user_id')
    .eq('tenant_id', context.tenantId)
    .eq('administration_id', administrationId)
    .eq('employee_id', employment.employee_id)
    .eq('employment_id', employment.id)
    .lte('transaction_date', String(calendarYear + 1) + '-01-01')
    .limit(5000)
  const leaveTypesQuery = supabase
    .from('leave_types')
    .select('id, name, color_code, entitlement_mode, annual_hours_cap, weekly_hours_cap_factor')
    .eq('tenant_id', context.tenantId)
    .eq('administration_id', administrationId)
    .limit(500)
  const scheduleQuery = supabase
    .from('employment_schedules')
    .select('average_hours_per_week')
    .eq('tenant_id', context.tenantId)
    .eq('administration_id', administrationId)
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
    .eq('administration_id', administrationId)
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
      .select('id, source_bucket_id, leave_type_id, carried_hours, original_expiration_date, employment_id, tenant_id, administration_id, rollover_id, created_at')
      .eq('tenant_id', context.tenantId)
      .eq('administration_id', administrationId)
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
      options: selection.options.map((row) => ({ id: row.id, startsOn: row.starts_on, endsOn: row.ends_on })),
    },
  }
}

export async function listLeaveCatalog() {
  const context = await requirePermission('leave:read')
  const administrationId = requireAdministration(context)
  const supabase = await createClient()
  const [leaveTypes, workHourTypes, profiles, rules, bonusRules, priorityRules, priorityRuleItems] = await Promise.all([
    supabase.from('leave_types').select('id, name, color_code, scope, entitlement_mode, annual_hours_cap, weekly_hours_cap_factor, is_active, is_self_service, is_system').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).order('name').limit(500),
    supabase.from('work_hour_types').select('id, name, color_code, category, is_active').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).order('name').limit(500),
    supabase.from('leave_profiles').select('id, name, description, is_active').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).order('name').limit(500),
    supabase.from('leave_accrual_rules').select('id, leave_profile_id, leave_type_id, predecessor_rule_id, valid_from, valid_until, accrual_basis, accrual_frequency, accrual_timing, accrual_amount, accrual_rate, expiration_months').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).order('valid_from').limit(2000),
    supabase.from('leave_bonus_rules').select('id, leave_profile_id, leave_type_id, name, trigger_type, award_timing, pro_rate_first_year, is_active').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).order('name').limit(500),
    supabase.from('leave_priority_rules').select('id, leave_profile_id, name, valid_from, valid_until, is_active').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).order('valid_from').limit(500),
    supabase.from('leave_priority_rule_items').select('priority_rule_id, leave_type_id, sort_order').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).order('sort_order').limit(5000),
  ])
  if (leaveTypes.error) databaseError(leaveTypes.error)
  if (workHourTypes.error) databaseError(workHourTypes.error)
  if (profiles.error) databaseError(profiles.error)
  if (rules.error) databaseError(rules.error)
  if (bonusRules.error) databaseError(bonusRules.error)
  if (priorityRules.error) databaseError(priorityRules.error)
  if (priorityRuleItems.error) databaseError(priorityRuleItems.error)
  return { leaveTypes: leaveTypes.data, workHourTypes: workHourTypes.data, profiles: profiles.data, accrualRules: rules.data, bonusRules: bonusRules.data, priorityRules: priorityRules.data, priorityRuleItems: priorityRuleItems.data }
}

export type LeaveCatalog = Awaited<ReturnType<typeof listLeaveCatalog>>

export async function createLeaveCatalogItem(input: LeaveCatalogMutation) {
  const context = await requirePermission('leave:write')
  const administrationId = requireAdministration(context)
  const supabase = await createClient()

  if (input.action === 'LEAVE_TYPE') {
    const result = await supabase.from('leave_types').insert({
      tenant_id: context.tenantId,
      administration_id: administrationId,
      name: input.name,
      color_code: input.colorCode,
      scope: input.scope,
      entitlement_mode: input.entitlementMode,
      annual_hours_cap: input.entitlementMode === 'ANNUAL_HOURS_CAP' ? input.annualHoursCap ?? null : null,
      weekly_hours_cap_factor: input.entitlementMode === 'WEEKLY_HOURS_FACTOR_CAP' ? input.weeklyHoursCapFactor ?? null : null,
      is_self_service: input.isSelfService,
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
      administration_id: administrationId,
      name: input.name,
      color_code: input.colorCode,
      category: input.category,
      is_active: input.isActive,
      created_by: context.userId,
      updated_by: context.userId,
    }).select('id').single()
    if (result.error || !result.data) databaseError(result.error)
    return { kind: input.action, id: result.data.id }
  }

  const result = await supabase.from('leave_profiles').insert({
    tenant_id: context.tenantId,
    administration_id: administrationId,
    name: input.name,
    description: input.description ?? null,
    is_active: input.isActive,
    created_by: context.userId,
    updated_by: context.userId,
  }).select('id').single()
  if (result.error || !result.data) databaseError(result.error)
  return { kind: input.action, id: result.data.id }
}

type CatalogUpdateInput = Extract<LeaveConfigurationMutation, { action: 'UPDATE_LEAVE_TYPE' | 'UPDATE_WORK_HOUR_TYPE' | 'UPDATE_PROFILE' }>
type CatalogArchiveInput = Extract<LeaveConfigurationMutation, { action: 'ARCHIVE_LEAVE_TYPE' | 'ARCHIVE_WORK_HOUR_TYPE' | 'ARCHIVE_PROFILE' }>

export async function updateLeaveCatalogItem(input: CatalogUpdateInput | CatalogArchiveInput) {
  const context = await requirePermission('leave:write')
  const administrationId = requireAdministration(context)
  const supabase = await createClient()

  if (input.action === 'ARCHIVE_LEAVE_TYPE') {
    const result = await supabase.from('leave_types').update({ is_active: false, updated_by: context.userId }).eq('id', input.id).eq('tenant_id', context.tenantId).eq('administration_id', administrationId).select('id').maybeSingle()
    if (result.error) databaseError(result.error)
    if (!result.data) throw new LeaveServiceError('LEAVE_CATALOG_ITEM_NOT_FOUND', 404)
    return { id: result.data.id, action: input.action }
  }

  if (input.action === 'UPDATE_LEAVE_TYPE') {
    const patch = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.colorCode !== undefined ? { color_code: input.colorCode } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.entitlementMode !== undefined ? { entitlement_mode: input.entitlementMode } : {}),
      ...(input.annualHoursCap !== undefined ? { annual_hours_cap: input.annualHoursCap } : {}),
      ...(input.weeklyHoursCapFactor !== undefined ? { weekly_hours_cap_factor: input.weeklyHoursCapFactor } : {}),
      ...(input.isSelfService !== undefined ? { is_self_service: input.isSelfService } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      updated_by: context.userId,
    }
    const result = await supabase.from('leave_types').update(patch).eq('id', input.id).eq('tenant_id', context.tenantId).eq('administration_id', administrationId).select('id').maybeSingle()
    if (result.error) databaseError(result.error)
    if (!result.data) throw new LeaveServiceError('LEAVE_CATALOG_ITEM_NOT_FOUND', 404)
    return { id: result.data.id, action: input.action }
  }

  if (input.action === 'ARCHIVE_WORK_HOUR_TYPE') {
    const result = await supabase.from('work_hour_types').update({ is_active: false, updated_by: context.userId }).eq('id', input.id).eq('tenant_id', context.tenantId).eq('administration_id', administrationId).select('id').maybeSingle()
    if (result.error) databaseError(result.error)
    if (!result.data) throw new LeaveServiceError('LEAVE_CATALOG_ITEM_NOT_FOUND', 404)
    return { id: result.data.id, action: input.action }
  }

  if (input.action === 'UPDATE_WORK_HOUR_TYPE') {
    const patch = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.colorCode !== undefined ? { color_code: input.colorCode } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      updated_by: context.userId,
    }
    const result = await supabase.from('work_hour_types').update(patch).eq('id', input.id).eq('tenant_id', context.tenantId).eq('administration_id', administrationId).select('id').maybeSingle()
    if (result.error) databaseError(result.error)
    if (!result.data) throw new LeaveServiceError('LEAVE_CATALOG_ITEM_NOT_FOUND', 404)
    return { id: result.data.id, action: input.action }
  }

  if (input.action === 'ARCHIVE_PROFILE') {
    const result = await supabase.from('leave_profiles').update({ is_active: false, updated_by: context.userId }).eq('id', input.id).eq('tenant_id', context.tenantId).eq('administration_id', administrationId).select('id').maybeSingle()
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
  }).eq('id', input.id).eq('tenant_id', context.tenantId).eq('administration_id', administrationId).select('id').maybeSingle()
  if (result.error) databaseError(result.error)
  if (!result.data) throw new LeaveServiceError('LEAVE_CATALOG_ITEM_NOT_FOUND', 404)
  return { id: result.data.id, action: input.action }
}

type AccrualRuleInput = Extract<LeaveConfigurationMutation, { action: 'ACCRUAL_RULE' }>

export async function createLeaveAccrualRule(input: AccrualRuleInput) {
  const context = await requirePermission('leave:write')
  const administrationId = requireAdministration(context)
  const supabase = await createClient()
  const rule = await supabase.rpc('create_leave_accrual_rule', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: administrationId,
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
  })
  if (rule.error || !rule.data) databaseError(rule.error)
  return { id: rule.data }
}

type BonusRuleInput = Extract<LeaveConfigurationMutation, { action: 'BONUS_RULE' }>

export async function createLeaveBonusRule(input: BonusRuleInput) {
  const context = await requirePermission('leave:write')
  const administrationId = requireAdministration(context)
  const supabase = await createClient()
  const result = await supabase.rpc('create_leave_bonus_rule', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: administrationId,
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
  const administrationId = requireAdministration(context)
  const supabase = await createClient()
  const result = await supabase.from('leave_accrual_exceptions').insert({
    tenant_id: context.tenantId,
    administration_id: administrationId,
    employee_id: input.employeeId,
    employment_id: input.employmentId,
    leave_type_id: input.leaveTypeId,
    valid_from: input.validFrom,
    valid_until: input.validUntil ?? null,
    no_accrual: input.noAccrual,
    accrual_amount: input.noAccrual ? null : input.accrualAmount ?? null,
    expiration_months: input.expirationMonths ?? null,
    reason: input.reason,
    created_by: context.userId,
  }).select('id').single()
  if (result.error || !result.data) databaseError(result.error)
  return { id: result.data.id }
}

export async function assignLeaveProfile(input: ProfileAssignmentInput) {
  const context = await requirePermission('leave:write')
  const administrationId = requireAdministration(context)
  const supabase = await createClient()
  const result = await supabase.from('employment_leave_profiles').insert({
    tenant_id: context.tenantId,
    administration_id: administrationId,
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

type PriorityRuleInput = Extract<LeaveConfigurationMutation, { action: 'PRIORITY_RULE' }>
type PriorityRuleUpdateInput = Extract<LeaveConfigurationMutation, { action: 'UPDATE_PRIORITY_RULE' }>

async function insertPriorityRuleItems(supabase: SupabaseServerClient, context: Awaited<ReturnType<typeof requireAuthContext>>, administrationId: string, priorityRuleId: string, items: PriorityRuleInput['items']) {
  const result = await supabase.from('leave_priority_rule_items').insert(items.map((item) => ({
    tenant_id: context.tenantId,
    administration_id: administrationId,
    priority_rule_id: priorityRuleId,
    leave_type_id: item.leaveTypeId,
    sort_order: item.sortOrder,
  })))
  if (result.error) databaseError(result.error)
}

export async function createLeavePriorityRule(input: PriorityRuleInput) {
  const context = await requirePermission('leave:write')
  const administrationId = requireAdministration(context)
  const supabase = await createClient()
  const rule = await supabase.from('leave_priority_rules').insert({
    tenant_id: context.tenantId,
    administration_id: administrationId,
    leave_profile_id: input.leaveProfileId,
    name: input.name,
    valid_from: input.validFrom,
    valid_until: input.validUntil ?? null,
    is_active: input.isActive,
    created_by: context.userId,
  }).select('id').single()
  if (rule.error || !rule.data) databaseError(rule.error)
  await insertPriorityRuleItems(supabase, context, administrationId, rule.data.id, input.items)
  return { id: rule.data.id }
}

export async function updateLeavePriorityRule(input: PriorityRuleUpdateInput) {
  const context = await requirePermission('leave:write')
  const administrationId = requireAdministration(context)
  const supabase = await createClient()
  const rule = await supabase.from('leave_priority_rules').update({
    leave_profile_id: input.leaveProfileId,
    name: input.name,
    valid_from: input.validFrom,
    valid_until: input.validUntil ?? null,
    is_active: input.isActive,
  }).eq('id', input.id).eq('tenant_id', context.tenantId).eq('administration_id', administrationId).select('id').maybeSingle()
  if (rule.error) databaseError(rule.error)
  if (!rule.data) throw new LeaveServiceError('LEAVE_PRIORITY_RULE_NOT_FOUND', 404)

  const deletedItems = await supabase.from('leave_priority_rule_items').delete().eq('priority_rule_id', input.id).eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
  if (deletedItems.error) databaseError(deletedItems.error)
  await insertPriorityRuleItems(supabase, context, administrationId, input.id, input.items)
  return { id: input.id }
}

export function leaveErrorResponse(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof LeaveServiceError) return NextResponse.json({ error: error.code, details: error.details }, { status: error.status })
  return NextResponse.json({ error: 'LEAVE_OPERATION_FAILED' }, { status: 500 })
}
