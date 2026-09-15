import { createHash } from 'node:crypto'
import type { Tables } from '@scope/db'
import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import {
  addDays,
  applyAccrualPause,
  applyLeaveAccrualRuleOverlay,
  calculateContractAccrual,
  calculateAccrualPause,
  clipAccrualSliceToCutover,
  generateAccrualPeriods,
  getMigrationCutoverDate,
  getPostedAutomaticAccrualAmounts,
  getPeriodBookingDate,
  expirationDateForAccrualYear,
  roundAccrualHours,
  type LeavePauseAllocation,
  type MigrationStartBalanceTransaction,
  type LeaveAccrualPeriod,
} from './leave-engine'
import { LeaveServiceError } from './leave-service'
import type { LeaveAccrualRunInput } from './schemas'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type Employment = Pick<Tables<'employments'>, 'id' | 'employee_id' | 'administration_id' | 'starts_on' | 'ends_on' | 'record_status' | 'deleted_at'>
type Schedule = Pick<Tables<'employment_schedules'>, 'employment_id' | 'valid_from' | 'valid_until' | 'part_time_factor' | 'fulltime_hours_per_week' | 'monday_hours' | 'tuesday_hours' | 'wednesday_hours' | 'thursday_hours' | 'friday_hours' | 'saturday_hours' | 'sunday_hours'>
type Salary = Pick<Tables<'employment_salaries'>, 'employment_id' | 'valid_from' | 'valid_until' | 'payment_frequency'>
type PauseRuleType = Pick<Tables<'leave_accrual_rule_pause_types'>, 'accrual_rule_id' | 'pause_leave_type_id'>
type PauseRequest = Pick<Tables<'leave_requests'>, 'id' | 'employment_id' | 'start_date' | 'end_date' | 'status'>
type PauseAllocationRow = Pick<Tables<'leave_request_allocations'>, 'request_id' | 'employment_id' | 'leave_type_id' | 'allocated_hours'>
type ActualWorkEntry = Pick<Tables<'employment_work_hour_entries'>, 'employment_id' | 'work_hour_type_id' | 'subject_period_start' | 'subject_period_end' | 'hours' | 'status'>
type WorkHourTypeMapping = Pick<Tables<'leave_accrual_rule_work_hour_types'>, 'accrual_rule_id' | 'work_hour_type_id'>
type LeaveAccrualItemStatus = 'READY' | 'ALREADY_POSTED' | 'DELTA_REQUIRED' | 'NO_RULE' | 'NO_PROFILE' | 'SOURCE_NOT_READY' | 'LOCKED_YEAR'

export type LeaveAccrualSlice = {
  start: string
  end: string
  ruleId: string | null
  profileId: string | null
  profileSource: string | null
  partTimeFactor: number | null
  expirationMonths: number | null
  plannedHours: number
  pausedHours: number
  sourceHours?: number | null
  amount: number
}

export type LeaveAccrualPreviewItem = {
  employeeId: string
  employeeName: string
  employmentId: string
  leaveTypeId: string
  leaveTypeName: string
  profileId: string | null
  profileName: string | null
  profileSource: string | null
  ruleId: string | null
  basis: string | null
  frequency: string | null
  timing: string | null
  periodStart: string
  periodEnd: string
  migrationCutoverDate: string | null
  bookingDate: string | null
  expirationDate: string | null
  slices: LeaveAccrualSlice[]
  calculatedAmount: number
  alreadyPostedAmount: number
  deltaToPost: number
  status: LeaveAccrualItemStatus
  reason: string | null
  sourceKey: string | null
}

export type LeaveAccrualPreview = {
  year: number
  yearStatus: 'ACTIVE' | 'OPEN_FOR_FUTURE_REQUESTS' | 'LOCKED' | null
  items: LeaveAccrualPreviewItem[]
  totals: { calculatedAmount: number; alreadyPostedAmount: number; deltaToPost: number }
}

type ResolvedRule = {
  leave_profile_id: string | null
  leave_type_id: string
  rule_id: string | null
  resolution_source: string | null
  no_accrual: boolean
  accrual_amount: number | null
  accrual_rate: number | null
  expiration_months: number | null
}

type Rule = Pick<Tables<'leave_accrual_rules'>, 'id' | 'leave_profile_id' | 'leave_type_id' | 'valid_from' | 'valid_until' | 'accrual_basis' | 'accrual_frequency' | 'accrual_timing' | 'accrual_amount' | 'accrual_rate' | 'expiration_months'>
type LeaveType = Pick<Tables<'leave_types'>, 'id' | 'name' | 'entitlement_mode' | 'is_active'>

function databaseError(error: { message: string } | null): never {
  const code = error?.message.match(/LEAVE_[A-Z_]+/)?.[0] ?? 'LEAVE_ACCRUAL_OPERATION_FAILED'
  throw new LeaveServiceError(code, 500)
}

function maxDate(left: string, right: string): string {
  return left > right ? left : right
}

function minDate(left: string, right: string): string {
  return left < right ? left : right
}

function optionalNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toPauseAllocation(row: PauseAllocationRow, request: PauseRequest): LeavePauseAllocation {
  return {
    employmentId: row.employment_id,
    leaveTypeId: row.leave_type_id,
    startDate: request.start_date,
    endDate: request.end_date,
    allocatedHours: Number(row.allocated_hours),
    status: request.status,
  }
}

function addBoundary(boundaries: Set<string>, date: string | null, period: LeaveAccrualPeriod) {
  if (date && date > period.start && date < period.end) boundaries.add(date)
}

function sameEntitlementSource(left: Schedule, right: Schedule): boolean {
  return Number(left.part_time_factor) === Number(right.part_time_factor)
    && Number(left.fulltime_hours_per_week) === Number(right.fulltime_hours_per_week)
}

function addScheduleBoundaries(boundaries: Set<string>, schedules: Schedule[], period: LeaveAccrualPeriod, employment: Employment) {
  const ordered = [...schedules].sort((left, right) => left.valid_from.localeCompare(right.valid_from))
  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index]
    const next = ordered[index + 1]
    const previous = ordered[index - 1]
    if (!previous || previous.valid_until !== current.valid_from || !sameEntitlementSource(previous, current)) addBoundary(boundaries, current.valid_from, period)
    const hasMaterialEnd = current.valid_until !== null
      && (!next || current.valid_until !== next.valid_from || !sameEntitlementSource(current, next))
    const isEmploymentTerminalEnd = !next && current.valid_until === employment.ends_on
    if (hasMaterialEnd && !isEmploymentTerminalEnd) addBoundary(boundaries, current.valid_until, period)
  }
}

function scheduleForDate(schedules: Schedule[], date: string, employmentEndsOn: string | null): Schedule | null {
  const ordered = [...schedules].sort((left, right) => right.valid_from.localeCompare(left.valid_from))
  const active = ordered.find((row) => row.valid_from <= date && (row.valid_until === null || row.valid_until > date))
  if (active) return active
  if (employmentEndsOn === date) return ordered.find((row) => row.valid_from <= date && row.valid_until === employmentEndsOn) ?? null
  return null
}

function salaryForDate(salaries: Salary[], employmentId: string, date: string): Salary | null {
  return salaries
    .filter((row) => row.employment_id === employmentId && row.valid_from <= date && (row.valid_until === null || row.valid_until > date))
    .sort((left, right) => right.valid_from.localeCompare(left.valid_from))[0] ?? null
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20)
}

function itemBaseKey(item: Pick<LeaveAccrualPreviewItem, 'employmentId' | 'leaveTypeId' | 'periodStart' | 'periodEnd'>, year: number): string {
  return `LEAVE_ACCRUAL:v1:${item.employmentId}:${item.leaveTypeId}:${year}:${item.periodStart}:${item.periodEnd}`
}

function itemSourceKey(item: Pick<LeaveAccrualPreviewItem, 'employmentId' | 'leaveTypeId' | 'periodStart' | 'periodEnd' | 'calculatedAmount' | 'slices'>, year: number): string {
  const signature = item.slices.map((slice) => [
    slice.start,
    slice.end,
    slice.ruleId,
    slice.profileId,
    slice.partTimeFactor,
    slice.expirationMonths,
    slice.plannedHours,
    slice.pausedHours,
    slice.sourceHours ?? null,
    slice.amount,
  ])
  return `${itemBaseKey(item, year)}:${fingerprint(JSON.stringify({ amount: item.calculatedAmount, signature }))}`
}

function workedHoursForSlice(entries: ActualWorkEntry[], mappings: WorkHourTypeMapping[], employmentId: string, ruleId: string, sliceStart: string, sliceEnd: string): number {
  const mappedTypeIds = new Set(mappings.filter((mapping) => mapping.accrual_rule_id === ruleId).map((mapping) => mapping.work_hour_type_id))
  return entries
    .filter((entry) => entry.employment_id === employmentId && entry.status === 'APPROVED' && mappedTypeIds.has(entry.work_hour_type_id) && entry.subject_period_start < sliceEnd && entry.subject_period_end > sliceStart)
    .reduce((total, entry) => total + Number(entry.hours), 0)
}

async function resolveRule(
  supabase: SupabaseServerClient,
  tenantId: string,
  hrGroupId: string,
  employmentId: string,
  leaveTypeId: string,
  asOfDate: string,
): Promise<ResolvedRule | null> {
  const result = await supabase.rpc('resolve_leave_accrual_rule_for_employment', {
    requested_tenant_id: tenantId,
    requested_hr_group_id: hrGroupId,
    requested_employment_id: employmentId,
    requested_leave_type_id: leaveTypeId,
    requested_as_of_date: asOfDate,
  })
  if (result.error) databaseError(result.error)
  return result.data?.[0] ?? null
}

async function loadPreviewData(supabase: SupabaseServerClient, tenantId: string, hrGroupId: string, input: LeaveAccrualRunInput) {
  let migrationTransactionsQuery = supabase
    .from('leave_accrual_transactions')
    .select('employment_id, leave_type_id, transaction_type, source_type, transaction_date')
    .eq('tenant_id', tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('transaction_type', 'OPENING_BALANCE')
    .eq('source_type', 'MIGRATION_START_BALANCE')
    .limit(20000)
  if (input.employeeId) migrationTransactionsQuery = migrationTransactionsQuery.eq('employee_id', input.employeeId)
  if (input.employmentId) migrationTransactionsQuery = migrationTransactionsQuery.eq('employment_id', input.employmentId)

  const yearStart = `${input.year}-01-01`
  const yearEnd = `${input.year + 1}-01-01`
  const [employeesResult, employmentsResult, schedulesResult, salariesResult, leaveTypesResult, profilesResult, rulesResult, workEntriesResult, workTypeMappingsResult, assignmentsResult, setsResult, membersResult, exceptionsResult, pauseRuleTypesResult, pauseRequestsResult, pauseAllocationsResult, bucketsResult, migrationTransactionsResult] = await Promise.all([
    supabase.from('employees').select('id, first_name, birth_name_prefix, birth_name').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).order('birth_name').order('first_name').limit(5000),
    supabase.from('employments').select('id, employee_id, administration_id, starts_on, ends_on, record_status, deleted_at').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('record_status', 'CONFIRMED').is('deleted_at', null).limit(5000),
    supabase.from('employment_schedules').select('employment_id, valid_from, valid_until, part_time_factor, fulltime_hours_per_week, monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours').eq('tenant_id', tenantId).limit(10000),
    supabase.from('employment_salaries').select('employment_id, valid_from, valid_until, payment_frequency').eq('tenant_id', tenantId).limit(10000),
    supabase.from('leave_types').select('id, name, entitlement_mode, is_active').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).eq('entitlement_mode', 'ACCRUAL').order('name').limit(500),
    supabase.from('leave_profiles').select('id, name, is_active').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).limit(500),
    supabase.from('leave_accrual_rules').select('id, leave_profile_id, leave_type_id, valid_from, valid_until, accrual_basis, accrual_frequency, accrual_timing, accrual_amount, accrual_rate, expiration_months').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).limit(5000),
    supabase.from('employment_work_hour_entries').select('employment_id, work_hour_type_id, subject_period_start, subject_period_end, hours, status').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('status', 'APPROVED').lt('subject_period_start', yearEnd).gt('subject_period_end', yearStart).limit(50000),
    supabase.from('leave_accrual_rule_work_hour_types').select('accrual_rule_id, work_hour_type_id').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).limit(20000),
    supabase.from('employment_leave_profiles').select('employment_id, valid_from, valid_until').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).limit(5000),
    supabase.from('employee_sets').select('id').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).limit(500),
    supabase.from('employee_set_members').select('employee_set_id, employee_id, valid_from, valid_until').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).limit(10000),
    supabase.from('leave_accrual_exceptions').select('employment_id, leave_type_id, valid_from, valid_until').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).limit(5000),
    supabase.from('leave_accrual_rule_pause_types').select('accrual_rule_id, pause_leave_type_id').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).limit(10000),
    supabase.from('leave_requests').select('id, employment_id, start_date, end_date, status').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('status', 'APPROVED').lt('start_date', yearEnd).gte('end_date', yearStart).limit(20000),
    supabase.from('leave_request_allocations').select('request_id, employment_id, leave_type_id, allocated_hours').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).limit(20000),
    supabase.from('leave_balance_buckets').select('id, employee_id, employment_id, leave_type_id, accrual_year').eq('tenant_id', tenantId).eq('hr_group_id', hrGroupId).eq('accrual_year', input.year).limit(10000),
    migrationTransactionsQuery,
  ])
  for (const result of [employeesResult, employmentsResult, schedulesResult, salariesResult, leaveTypesResult, profilesResult, rulesResult, workEntriesResult, workTypeMappingsResult, assignmentsResult, setsResult, membersResult, exceptionsResult, pauseRuleTypesResult, pauseRequestsResult, pauseAllocationsResult, bucketsResult, migrationTransactionsResult]) {
    if (result.error) databaseError(result.error)
  }
  const employees = employeesResult.data ?? []
  const employments = employmentsResult.data as Employment[]
  const migrationTransactions: MigrationStartBalanceTransaction[] = (migrationTransactionsResult.data ?? []).map((transaction) => ({
    employmentId: transaction.employment_id,
    leaveTypeId: transaction.leave_type_id,
    transactionType: transaction.transaction_type,
    sourceType: transaction.source_type,
    transactionDate: transaction.transaction_date,
  }))
  const selectedEmployeeIds = input.employeeId ? new Set([input.employeeId]) : null
  const selectedEmploymentIds = input.employmentId ? new Set([input.employmentId]) : null
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]))
  const scopedEmployments = employments.filter((employment) => employeeById.has(employment.employee_id)
    && (!selectedEmployeeIds || selectedEmployeeIds.has(employment.employee_id))
    && (!selectedEmploymentIds || selectedEmploymentIds.has(employment.id)))
  if (input.employeeId && !employeeById.has(input.employeeId)) throw new LeaveServiceError('LEAVE_EMPLOYEE_NOT_FOUND', 404)
  if (input.employmentId && scopedEmployments.length === 0) throw new LeaveServiceError('LEAVE_EMPLOYMENT_NOT_FOUND', 404)
  if (scopedEmployments.length > 500) throw new LeaveServiceError('LEAVE_ACCRUAL_SCOPE_TOO_LARGE', 413)
  const leaveTypeRows = leaveTypesResult.data ?? []
  const leaveTypes = (input.leaveTypeId ? leaveTypeRows.filter((leaveType) => leaveType.id === input.leaveTypeId) : leaveTypeRows) as LeaveType[]
  if (input.leaveTypeId && leaveTypes.length === 0) throw new LeaveServiceError('LEAVE_ACCRUAL_TYPE_NOT_FOUND', 404)
  const pauseRequestsById = new Map((pauseRequestsResult.data as PauseRequest[] | null ?? []).map((request) => [request.id, request]))
  const pauseAllocations = (pauseAllocationsResult.data as PauseAllocationRow[] | null ?? [])
    .flatMap((allocation) => {
      const request = pauseRequestsById.get(allocation.request_id)
      return request ? [toPauseAllocation(allocation, request)] : []
    })
  return {
    employees,
    scopedEmployments,
    schedules: schedulesResult.data as Schedule[],
    salaries: salariesResult.data as Salary[],
    leaveTypes,
    profiles: profilesResult.data ?? [],
    rules: rulesResult.data as Rule[],
    actualWorkEntries: workEntriesResult.data as ActualWorkEntry[],
    workHourTypeMappings: workTypeMappingsResult.data as WorkHourTypeMapping[],
    assignments: assignmentsResult.data ?? [],
    employeeSetIds: new Set((setsResult.data ?? []).map((set) => set.id)),
    members: membersResult.data ?? [],
    exceptions: exceptionsResult.data ?? [],
    pauseRuleTypes: pauseRuleTypesResult.data as PauseRuleType[],
    pauseAllocations,
    buckets: bucketsResult.data ?? [],
    migrationTransactions,
  }
}

export async function getLeaveAccrualPreview(input: LeaveAccrualRunInput): Promise<LeaveAccrualPreview> {
  const context = await requirePermission('leave:read')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const yearControlResult = await supabase.from('leave_year_controls').select('status').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('year', input.year).maybeSingle()
  if (yearControlResult.error) databaseError(yearControlResult.error)
  const data = await loadPreviewData(supabase, context.tenantId, hrGroupId, input)
  const bucketIds = data.buckets.map((bucket) => bucket.id)
  const transactionsResult = bucketIds.length === 0
    ? { data: [], error: null }
    : await supabase.from('leave_accrual_transactions').select('bucket_id, source_type, source_key, transaction_type, amount').in('bucket_id', bucketIds).limit(20000)
  if (transactionsResult.error) databaseError(transactionsResult.error)

  const employeeNames = new Map(data.employees.map((employee) => [employee.id, [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')]))
  const profileNames = new Map(data.profiles.map((profile) => [profile.id, profile.name]))
  const rulesById = new Map(data.rules.map((rule) => [rule.id, rule]))
  const postedByBaseKey = getPostedAutomaticAccrualAmounts((transactionsResult.data ?? []).map((transaction) => ({
    transactionType: transaction.transaction_type,
    sourceType: transaction.source_type,
    sourceKey: transaction.source_key,
    amount: Number(transaction.amount),
  })))

  const items: LeaveAccrualPreviewItem[] = []
  for (const employment of data.scopedEmployments) {
    const employmentSchedules = data.schedules.filter((schedule) => schedule.employment_id === employment.id)
    const employmentAssignments = data.assignments.filter((assignment) => assignment.employment_id === employment.id)
    const employeeSetMembers = data.members.filter((member) => member.employee_id === employment.employee_id && data.employeeSetIds.has(member.employee_set_id))
    const employmentExceptions = data.exceptions.filter((exception) => exception.employment_id === employment.id)
    const employmentPauseAllocations = data.pauseAllocations.filter((allocation) => allocation.employmentId === employment.id)
    for (const leaveType of data.leaveTypes) {
      const migrationCutoverDate = getMigrationCutoverDate(data.migrationTransactions, employment.id, leaveType.id)
      const configuredFrequencies = [...new Set(data.rules.filter((rule) => rule.leave_type_id === leaveType.id).map((rule) => rule.accrual_frequency))]
      const frequencyConflict = configuredFrequencies.length > 1
      const calculationFrequency = frequencyConflict ? 'YEARLY' : (configuredFrequencies[0] ?? 'YEARLY')
      const yearStart = `${input.year}-01-01`
      const payrollAsOfDate = employment.starts_on > yearStart ? employment.starts_on : yearStart
      const payrollFrequency = calculationFrequency === 'PAYROLL_PERIOD'
        ? salaryForDate(data.salaries, employment.id, payrollAsOfDate)?.payment_frequency ?? null
        : null
      let periods: LeaveAccrualPeriod[]
      let periodGenerationReason: string | null = null
      try {
        periods = generateAccrualPeriods({ calendarYear: input.year, frequency: calculationFrequency, payrollFrequency })
      } catch (error) {
        periods = [{ start: `${input.year}-01-01`, end: `${input.year + 1}-01-01` }]
        periodGenerationReason = error instanceof Error ? error.message : 'LEAVE_ACCRUAL_PERIOD_GENERATION_FAILED'
      }
      for (const period of periods) {
        const boundaries = new Set<string>()
        addBoundary(boundaries, employment.starts_on, period)
        addBoundary(boundaries, employment.ends_on ? addDays(employment.ends_on, 1) : null, period)
        addBoundary(boundaries, migrationCutoverDate, period)
        addScheduleBoundaries(boundaries, employmentSchedules, period, employment)
        for (const row of employmentAssignments) { addBoundary(boundaries, row.valid_from, period); addBoundary(boundaries, row.valid_until, period) }
        for (const row of employeeSetMembers) { addBoundary(boundaries, row.valid_from, period); addBoundary(boundaries, row.valid_until, period) }
        for (const row of employmentExceptions.filter((exception) => exception.leave_type_id === leaveType.id)) { addBoundary(boundaries, row.valid_from, period); addBoundary(boundaries, row.valid_until, period) }
        for (const row of data.rules.filter((rule) => rule.leave_type_id === leaveType.id)) { addBoundary(boundaries, row.valid_from, period); addBoundary(boundaries, row.valid_until, period) }
        const points = [period.start, ...[...boundaries].sort(), period.end]
        const slices: LeaveAccrualSlice[] = []
        const reasons = new Set<string>()
        if (frequencyConflict) reasons.add('RULE_CONFLICT')
        if (periodGenerationReason) reasons.add(periodGenerationReason)
        for (let index = 0; index < points.length - 1; index += 1) {
          const sliceStart = points[index]
          const sliceEnd = points[index + 1]
          const normalEligibleStart = maxDate(sliceStart, employment.starts_on)
          const eligibleEnd = minDate(sliceEnd, employment.ends_on ? addDays(employment.ends_on, 1) : period.end)
          const eligibleSlice = clipAccrualSliceToCutover({ sliceStart: normalEligibleStart, sliceEnd: eligibleEnd, cutoverDate: migrationCutoverDate })
          if (!eligibleSlice) continue
          const eligibleStart = eligibleSlice.start
          const resolved = await resolveRule(supabase, context.tenantId, hrGroupId, employment.id, leaveType.id, eligibleStart)
          const schedule = scheduleForDate(employmentSchedules, eligibleStart, employment.ends_on)
          const salary = salaryForDate(data.salaries, employment.id, eligibleStart)
          if (!resolved?.leave_profile_id) reasons.add('NO_PROFILE')
          if (!resolved?.rule_id) reasons.add('NO_RULE')
          if (!schedule) reasons.add('SOURCE_NOT_READY')
          const rule = resolved?.rule_id ? rulesById.get(resolved.rule_id) : null
          const effectiveRule = rule
            ? applyLeaveAccrualRuleOverlay({
              accrualBasis: rule.accrual_basis,
              accrualFrequency: rule.accrual_frequency,
              accrualTiming: rule.accrual_timing,
              accrualAmount: optionalNumber(rule.accrual_amount),
              accrualRate: optionalNumber(rule.accrual_rate),
              expirationMonths: optionalNumber(rule.expiration_months),
            }, resolved ? {
              noAccrual: resolved.no_accrual,
              accrualAmount: optionalNumber(resolved.accrual_amount),
              accrualRate: optionalNumber(resolved.accrual_rate),
              expirationMonths: optionalNumber(resolved.expiration_months),
            } : null)
            : null
          if (effectiveRule?.accrualBasis !== 'CONTRACT_HOURS' && effectiveRule?.accrualBasis !== 'WORKED_HOURS') reasons.add('SOURCE_NOT_READY')
          const pauseLeaveTypeIds = rule
            ? data.pauseRuleTypes.filter((pauseRuleType) => pauseRuleType.accrual_rule_id === rule.id).map((pauseRuleType) => pauseRuleType.pause_leave_type_id)
            : []
          const pause = calculateAccrualPause({
            sliceStart: eligibleStart,
            sliceEnd: eligibleEnd,
            schedules: employmentSchedules.map((employmentSchedule) => ({
              validFrom: employmentSchedule.valid_from,
              validUntil: employmentSchedule.valid_until,
              mondayHours: employmentSchedule.monday_hours,
              tuesdayHours: employmentSchedule.tuesday_hours,
              wednesdayHours: employmentSchedule.wednesday_hours,
              thursdayHours: employmentSchedule.thursday_hours,
              fridayHours: employmentSchedule.friday_hours,
              saturdayHours: employmentSchedule.saturday_hours,
              sundayHours: employmentSchedule.sunday_hours,
            })),
            pauseLeaveTypeIds,
            allocations: employmentPauseAllocations,
          })
          let amount = 0
          let sourceHours: number | null = null
          if (effectiveRule && !effectiveRule.noAccrual && effectiveRule.accrualBasis === 'CONTRACT_HOURS' && schedule && effectiveRule.accrualAmount !== null) {
            try {
              const baseAmount = calculateContractAccrual({
                fullPeriodStart: period.start,
                fullPeriodEnd: period.end,
                sliceStart: eligibleStart,
                sliceEnd: eligibleEnd,
                annualEntitlement: effectiveRule.accrualAmount,
                frequency: effectiveRule.accrualFrequency,
                payrollFrequency: salary?.payment_frequency ?? payrollFrequency,
                partTimeFactor: Number(schedule.part_time_factor),
              })
              amount = applyAccrualPause({ ...pause, baseAccrual: baseAmount })
            } catch (error) {
              if (error instanceof Error && error.message.includes('LEAVE_PAYROLL_FREQUENCY_REQUIRED')) reasons.add('LEAVE_PAYROLL_FREQUENCY_REQUIRED')
              else throw error
            }
          }
          if (effectiveRule && !effectiveRule.noAccrual && effectiveRule.accrualBasis === 'WORKED_HOURS') {
            sourceHours = workedHoursForSlice(data.actualWorkEntries, data.workHourTypeMappings, employment.id, resolved?.rule_id ?? '', eligibleStart, eligibleEnd)
            if (effectiveRule.accrualRate === null || !resolved?.rule_id) reasons.add('SOURCE_NOT_READY')
            else amount = applyAccrualPause({ ...pause, baseAccrual: sourceHours * effectiveRule.accrualRate })
          }
          slices.push({
            start: eligibleStart,
            end: eligibleEnd,
            ruleId: resolved?.rule_id ?? null,
            profileId: resolved?.leave_profile_id ?? null,
            profileSource: resolved?.resolution_source ?? null,
            partTimeFactor: schedule ? Number(schedule.part_time_factor) : null,
            expirationMonths: effectiveRule?.expirationMonths ?? null,
            plannedHours: pause.plannedHours,
            pausedHours: pause.pausedHours,
            sourceHours,
            amount,
          })
        }
        const firstSlice = slices[0] ?? null
        const firstRule = firstSlice?.ruleId ? rulesById.get(firstSlice.ruleId) : null
        const firstSalary = firstSlice ? salaryForDate(data.salaries, employment.id, firstSlice.start) : null
        const calculatedAmount = roundAccrualHours(slices.reduce((total, slice) => total + slice.amount, 0))
        const baseKey = itemBaseKey({ employmentId: employment.id, leaveTypeId: leaveType.id, periodStart: period.start, periodEnd: period.end }, input.year)
        const alreadyPostedAmount = roundAccrualHours(postedByBaseKey.get(baseKey) ?? 0)
        const deltaToPost = roundAccrualHours(calculatedAmount - alreadyPostedAmount)
        const expirationMonths = firstSlice?.expirationMonths ?? null
        const expirationDate = expirationMonths === null ? null : expirationDateForAccrualYear(input.year, expirationMonths)
        const sourceKey = reasons.size === 0 && calculatedAmount !== 0
          ? itemSourceKey({ employmentId: employment.id, leaveTypeId: leaveType.id, periodStart: period.start, periodEnd: period.end, calculatedAmount, slices }, input.year)
          : null
        let status: LeaveAccrualItemStatus = 'READY'
        let reason: string | null = null
        if (yearControlResult.data?.status === 'LOCKED') { status = 'LOCKED_YEAR'; reason = 'LOCKED_YEAR' }
        else if (reasons.has('NO_PROFILE')) { status = 'NO_PROFILE'; reason = 'NO_PROFILE' }
        else if (reasons.has('NO_RULE')) { status = 'NO_RULE'; reason = 'NO_RULE' }
        else if (reasons.size > 0) { status = 'SOURCE_NOT_READY'; reason = [...reasons].sort().join(',') }
        else if (deltaToPost === 0) { status = 'ALREADY_POSTED'; reason = 'UP_TO_DATE' }
        else if (alreadyPostedAmount !== 0) { status = 'DELTA_REQUIRED'; reason = 'DELTA_REQUIRED' }
        let bookingDate: string | null = null
        if (firstRule) {
          try {
            bookingDate = getPeriodBookingDate({ periodStart: period.start, periodEnd: period.end, timing: firstRule.accrual_timing, frequency: firstRule.accrual_frequency, payrollFrequency: firstSalary?.payment_frequency ?? payrollFrequency })
          } catch (error) {
            reasons.add(error instanceof Error ? error.message : 'LEAVE_ACCRUAL_BOOKING_DATE_FAILED')
          }
        }
        if (reasons.size > 0 && status !== 'LOCKED_YEAR') {
          status = reasons.has('NO_PROFILE') ? 'NO_PROFILE' : reasons.has('NO_RULE') ? 'NO_RULE' : 'SOURCE_NOT_READY'
          reason = [...reasons].sort().join(',')
        }
        items.push({
          employeeId: employment.employee_id,
          employeeName: employeeNames.get(employment.employee_id) ?? employment.employee_id,
          employmentId: employment.id,
          leaveTypeId: leaveType.id,
          leaveTypeName: leaveType.name,
          profileId: firstSlice?.profileId ?? null,
          profileName: firstSlice?.profileId ? profileNames.get(firstSlice.profileId) ?? null : null,
          profileSource: firstSlice?.profileSource ?? null,
          ruleId: firstSlice?.ruleId ?? null,
          basis: firstRule?.accrual_basis ?? null,
          frequency: firstRule?.accrual_frequency ?? null,
          timing: firstRule?.accrual_timing ?? null,
          periodStart: period.start,
          periodEnd: period.end,
          migrationCutoverDate,
          bookingDate,
          expirationDate,
          slices,
          calculatedAmount,
          alreadyPostedAmount,
          deltaToPost,
          status,
          reason,
          sourceKey,
        })
      }
    }
  }
  items.sort((left, right) => left.employeeName.localeCompare(right.employeeName) || left.leaveTypeName.localeCompare(right.leaveTypeName) || left.periodStart.localeCompare(right.periodStart))
  return {
    year: input.year,
    yearStatus: yearControlResult.data?.status ?? null,
    items,
    totals: {
      calculatedAmount: roundAccrualHours(items.reduce((total, item) => total + item.calculatedAmount, 0)),
      alreadyPostedAmount: roundAccrualHours(items.reduce((total, item) => total + item.alreadyPostedAmount, 0)),
      deltaToPost: roundAccrualHours(items.reduce((total, item) => total + item.deltaToPost, 0)),
    },
  }
}

export async function postLeaveAccrualRun(input: LeaveAccrualRunInput) {
  const context = await requirePermission('leave:adjust')
  const hrGroupId = requireHrGroupId(context)
  const preview = await getLeaveAccrualPreview(input)
  const supabase = await createClient()
  const posted: Array<{ item: LeaveAccrualPreviewItem; transactionId: string }> = []
  const failures: Array<{ item: LeaveAccrualPreviewItem; error: string }> = []
  for (const item of preview.items.filter((candidate) => (candidate.status === 'READY' || candidate.status === 'DELTA_REQUIRED') && candidate.deltaToPost !== 0 && candidate.sourceKey && candidate.bookingDate && candidate.expirationDate)) {
    if (!item.sourceKey || !item.bookingDate || !item.expirationDate) continue
    const result = await supabase.rpc('post_group_leave_accrual', {
      requested_tenant_id: context.tenantId,
      requested_hr_group_id: hrGroupId,
      requested_employee_id: item.employeeId,
      requested_employment_id: item.employmentId,
      requested_leave_type_id: item.leaveTypeId,
      requested_accrual_year: input.year,
      requested_period_start: item.periodStart,
      requested_period_end: item.periodEnd,
      requested_booking_date: item.bookingDate,
      requested_expiration_date: item.expirationDate,
      requested_amount: item.deltaToPost,
      requested_source_key: item.sourceKey,
      requested_reason: 'Automatische verlofopbouw (Leave Engine V1)',
    })
    const transactionId = typeof result.data === 'string'
      ? result.data
      : Array.isArray(result.data) && typeof result.data[0] === 'string' ? result.data[0] : null
    if (result.error || !transactionId) failures.push({ item, error: result.error?.message ?? 'LEAVE_ACCRUAL_POST_FAILED' })
    else posted.push({ item, transactionId })
  }
  const finalPreview = await getLeaveAccrualPreview(input)
  if (failures.length > 0) throw new LeaveServiceError('LEAVE_ACCRUAL_POST_PARTIAL', 409, { posted: posted.length, failures: failures.map((failure) => ({ employeeId: failure.item.employeeId, employmentId: failure.item.employmentId, leaveTypeId: failure.item.leaveTypeId, periodStart: failure.item.periodStart, error: failure.error })), preview: finalPreview })
  return { posted: posted.length, transactionIds: posted.map((entry) => entry.transactionId), preview: finalPreview }
}
