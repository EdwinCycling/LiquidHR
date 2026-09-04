import 'server-only'

import { AuthorizationError, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { isAbsenceActualDate } from './engine'
import { resolveLeaveEmployment, type LeaveEmploymentOption } from '@/lib/leave/employment-resolver'
import { listDirectTeamEmployeeIds } from '@/lib/organization/team-scope'
import { absenceCaseCreateSchema, absenceCapacityChangeSchema, absenceRecoverySchema } from './schemas'

export class AbsenceServiceError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code)
    this.name = 'AbsenceServiceError'
  }
}

export class AbsenceEmploymentRequiredError extends AbsenceServiceError {
  constructor(public readonly options: LeaveEmploymentOption[]) {
    super('ABSENCE_EMPLOYMENT_REQUIRED', 409)
    this.name = 'AbsenceEmploymentRequiredError'
  }
}

const globalAbsenceRoles = new Set(['TENANT_ADMIN', 'HR_ADMIN'])

async function requireAbsenceTargetPermission(permissionCode: string, employeeId: string) {
  const auth = await requirePermission(permissionCode, employeeId)
  if (auth.employeeId === employeeId || auth.activeRoles.some((role) => globalAbsenceRoles.has(role))) return auth
  if (auth.activeRoles.includes('DIRECT_MANAGER')) {
    const supabase = await createClient()
    const teamEmployeeIds = await listDirectTeamEmployeeIds(auth, supabase)
    if (teamEmployeeIds.includes(employeeId)) return auth
  }
  throw new AuthorizationError('Je hebt onvoldoende rechten voor deze actie.')
}

export interface AbsenceSpellSummary {
  id: string
  startedOn: string
  reportedAt: string
  expectedRecoveryOn: string | null
  recoveredOn: string | null
  capacityEffectiveOn: string | null
  expectedNextReviewOn: string | null
  absencePercentage: number | null
  scheduledHoursPerWeekSnapshot: number | null
  absenceHoursPerWeek: number | null
  inputMode: 'HOURS' | 'PERCENTAGE' | null
  capacityChanges: AbsenceCapacityChangeSummary[]
}

export interface AbsenceCapacityChangeSummary {
  id: string
  effectiveOn: string
  absencePercentage: number
  scheduledHoursPerWeekSnapshot: number | null
  absenceHoursPerWeek: number | null
  inputMode: 'HOURS' | 'PERCENTAGE' | null
  expectedNextReviewOn: string | null
}

type AbsenceCapacityRow = {
  id: string
  spell_id: string
  absence_percentage: number
  effective_on: string
  scheduled_hours_per_week_snapshot: number | null
  absence_hours_per_week: number | null
  input_mode: string | null
  expected_next_review_on: string | null
}

export interface AbsenceCaseSummary {
  id: string
  employmentId: string
  status: 'ACTIVE' | 'RECOVERY_WINDOW' | 'CLOSED'
  firstAbsenceOn: string
  effectiveClockStartOn: string
  recoveryWindowEndsOn: string | null
  closedAt: string | null
  createdAt: string
  hasSicknessBenefitSafetyNet: boolean | null
  isWorkAccident: boolean | null
  isThirdPartyTrafficAccident: boolean | null
  isFrequentAbsence: boolean
  priorCaseCount12Months: number
  frequentAbsenceThreshold: number
  spells: AbsenceSpellSummary[]
}

function mapCase(row: {
  id: string
  employment_id: string
  status: AbsenceCaseSummary['status']
  first_absence_on: string
  effective_clock_start_on: string
  recovery_window_ends_on: string | null
  closed_at: string | null
  created_at: string
  has_sickness_benefit_safety_net: boolean | null
  is_work_accident: boolean | null
  is_third_party_traffic_accident: boolean | null
  is_frequent_absence: boolean
  prior_case_count_12_months: number
  frequent_absence_threshold: number
}, spells: Array<{ id: string; started_on: string; reported_at: string; expected_recovery_on: string | null; recovered_on: string | null; absence_capacity_changes: Array<{ id: string; absence_percentage: number; effective_on: string; scheduled_hours_per_week_snapshot: number | null; absence_hours_per_week: number | null; input_mode: string | null; expected_next_review_on: string | null }> }>): AbsenceCaseSummary {
  return {
    id: row.id,
    employmentId: row.employment_id,
    status: row.status,
    firstAbsenceOn: row.first_absence_on,
    effectiveClockStartOn: row.effective_clock_start_on,
    recoveryWindowEndsOn: row.recovery_window_ends_on,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    hasSicknessBenefitSafetyNet: row.has_sickness_benefit_safety_net,
    isWorkAccident: row.is_work_accident,
    isThirdPartyTrafficAccident: row.is_third_party_traffic_accident,
    isFrequentAbsence: row.is_frequent_absence,
    priorCaseCount12Months: row.prior_case_count_12_months,
    frequentAbsenceThreshold: row.frequent_absence_threshold,
    spells: spells.map((spell) => ({
      id: spell.id,
      startedOn: spell.started_on,
      reportedAt: spell.reported_at,
      expectedRecoveryOn: spell.expected_recovery_on,
      recoveredOn: spell.recovered_on,
      capacityEffectiveOn: spell.absence_capacity_changes[0]?.effective_on ?? null,
      expectedNextReviewOn: spell.absence_capacity_changes[0]?.expected_next_review_on ?? null,
      absencePercentage: spell.absence_capacity_changes[0]?.absence_percentage ?? null,
      scheduledHoursPerWeekSnapshot: spell.absence_capacity_changes[0]?.scheduled_hours_per_week_snapshot ?? null,
      absenceHoursPerWeek: spell.absence_capacity_changes[0]?.absence_hours_per_week ?? null,
      inputMode: spell.absence_capacity_changes[0]?.input_mode === 'HOURS' || spell.absence_capacity_changes[0]?.input_mode === 'PERCENTAGE' ? spell.absence_capacity_changes[0].input_mode : null,
      capacityChanges: spell.absence_capacity_changes.map((change) => ({
        id: change.id,
        effectiveOn: change.effective_on,
        absencePercentage: change.absence_percentage,
        scheduledHoursPerWeekSnapshot: change.scheduled_hours_per_week_snapshot,
        absenceHoursPerWeek: change.absence_hours_per_week,
        inputMode: change.input_mode === 'HOURS' || change.input_mode === 'PERCENTAGE' ? change.input_mode : null,
        expectedNextReviewOn: change.expected_next_review_on,
      })),
    })),
  }
}

export async function listEmployeeAbsence(employeeId: string): Promise<AbsenceCaseSummary[]> {
  const auth = await requireAbsenceTargetPermission('absence:read', employeeId)
  const hrGroupId = requireHrGroupId(auth)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('absence_cases')
    .select('id,employment_id,status,first_absence_on,effective_clock_start_on,recovery_window_ends_on,closed_at,created_at,has_sickness_benefit_safety_net,is_work_accident,is_third_party_traffic_accident,is_frequent_absence,prior_case_count_12_months,frequent_absence_threshold')
    .eq('tenant_id', auth.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('employee_id', employeeId)
    .is('archived_at', null)
    .order('first_absence_on', { ascending: false })
    .limit(50)
  if (error) throw new AbsenceServiceError('ABSENCE_READ_FAILED')
  const caseRows = data ?? []
  const caseIds = caseRows.map((row) => row.id)
  if (caseIds.length === 0) return []
  const { data: spellRows, error: spellError } = await supabase
    .from('absence_spells')
    .select('id,case_id,employment_id,started_on,reported_at,expected_recovery_on,recovered_on')
    .eq('tenant_id', auth.tenantId)
    .eq('hr_group_id', hrGroupId)
    .in('case_id', caseIds)
    .order('started_on', { ascending: false })
  if (spellError) throw new AbsenceServiceError('ABSENCE_READ_FAILED')
  const spellIds = (spellRows ?? []).map((row) => row.id)
  let capacityRows: AbsenceCapacityRow[] = []
  if (spellIds.length > 0) {
    const currentCapacityResult = await supabase.from('absence_capacity_changes').select('id,spell_id,absence_percentage,effective_on,scheduled_hours_per_week_snapshot,absence_hours_per_week,input_mode,expected_next_review_on').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).in('spell_id', spellIds).order('effective_on', { ascending: false }).order('created_at', { ascending: false }).limit(10000)
    if (currentCapacityResult.error) {
      const legacyCapacityResult = await supabase.from('absence_capacity_changes').select('id,spell_id,absence_percentage,effective_on,expected_next_review_on').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).in('spell_id', spellIds).order('effective_on', { ascending: false }).order('created_at', { ascending: false }).limit(10000)
      if (legacyCapacityResult.error) throw new AbsenceServiceError('ABSENCE_READ_FAILED')
      capacityRows = (legacyCapacityResult.data ?? []).map((row) => ({
        ...row,
        scheduled_hours_per_week_snapshot: null,
        absence_hours_per_week: null,
        input_mode: null,
      }))
    } else {
      capacityRows = currentCapacityResult.data ?? []
    }
  }
  const capacities = new Map<string, AbsenceCapacityChangeSummary[]>()
  for (const row of capacityRows) {
    const change: AbsenceCapacityChangeSummary = {
      id: row.id,
      effectiveOn: row.effective_on,
      absencePercentage: row.absence_percentage,
      scheduledHoursPerWeekSnapshot: row.scheduled_hours_per_week_snapshot,
      absenceHoursPerWeek: row.absence_hours_per_week,
      inputMode: row.input_mode === 'HOURS' || row.input_mode === 'PERCENTAGE' ? row.input_mode : null,
      expectedNextReviewOn: row.expected_next_review_on,
    }
    capacities.set(row.spell_id, [...(capacities.get(row.spell_id) ?? []), change])
  }
  const spellsByCase = new Map<string, AbsenceSpellSummary[]>()
  for (const row of spellRows ?? []) {
    const capacityChanges = capacities.get(row.id) ?? []
    const capacity = capacityChanges[0]
    const spell = {
      id: row.id,
      startedOn: row.started_on,
      reportedAt: row.reported_at,
      expectedRecoveryOn: row.expected_recovery_on,
      recoveredOn: row.recovered_on,
      absencePercentage: capacity?.absencePercentage ?? null,
      capacityEffectiveOn: capacity?.effectiveOn ?? null,
      expectedNextReviewOn: capacity?.expectedNextReviewOn ?? null,
      scheduledHoursPerWeekSnapshot: capacity?.scheduledHoursPerWeekSnapshot ?? null,
      absenceHoursPerWeek: capacity?.absenceHoursPerWeek ?? null,
      inputMode: capacity?.inputMode ?? null,
      capacityChanges,
    }
    spellsByCase.set(row.case_id, [...(spellsByCase.get(row.case_id) ?? []), spell])
  }
  return caseRows.map((row) => mapCase(row, (spellsByCase.get(row.id) ?? []).map((spell) => ({
    id: spell.id,
    started_on: spell.startedOn,
    reported_at: spell.reportedAt,
    expected_recovery_on: spell.expectedRecoveryOn,
    recovered_on: spell.recoveredOn,
    absence_capacity_changes: spell.capacityChanges.map((change) => ({
      id: change.id,
      absence_percentage: change.absencePercentage,
      effective_on: change.effectiveOn,
      scheduled_hours_per_week_snapshot: change.scheduledHoursPerWeekSnapshot,
      absence_hours_per_week: change.absenceHoursPerWeek,
      input_mode: change.inputMode,
      expected_next_review_on: change.expectedNextReviewOn,
    })),
  }))))
}

export async function getEmployeeAbsenceOverview(employeeId: string, employmentId?: string): Promise<AbsenceCaseSummary | null> {
  const cases = await listEmployeeAbsence(employeeId)
  const scopedCases = employmentId ? cases.filter((item) => item.employmentId === employmentId) : cases
  return scopedCases.find((item) => item.status !== 'CLOSED') ?? scopedCases[0] ?? null
}

export async function resolveEmployeeAbsenceEmployment(
  employeeId: string,
  requestedEmploymentId: string | undefined,
  asOfDate: string,
) {
  const auth = await requireAbsenceTargetPermission('absence:write', employeeId)
  const supabase = await createClient()
  return resolveLeaveEmployment(supabase, auth, employeeId, requestedEmploymentId, asOfDate)
}

export async function listEmployeeAbsenceEmploymentOptions(employeeId: string) {
  const asOfDate = new Date().toISOString().slice(0, 10)
  const [selection, cases] = await Promise.all([
    resolveEmployeeAbsenceEmployment(employeeId, undefined, asOfDate),
    listEmployeeAbsence(employeeId),
  ])
  const openEmploymentIds = new Set(
    cases
      .filter((item) => item.status === 'ACTIVE' || item.status === 'RECOVERY_WINDOW')
      .map((item) => item.employmentId),
  )
  return {
    employment: selection.employment && openEmploymentIds.has(selection.employment.id) ? null : selection.employment,
    options: selection.options.filter((option) => !openEmploymentIds.has(option.id)),
  }
}

export async function reportEmployeeAbsence(employeeId: string, input: unknown): Promise<string> {
  const auth = await requireAbsenceTargetPermission('absence:write', employeeId)
  const hrGroupId = requireHrGroupId(auth)
  const parsed = absenceCaseCreateSchema.parse({ ...(typeof input === 'object' && input !== null ? input : {}), employeeId })
  assertAbsenceActualDate(parsed.startDate)
  const supabase = await createClient()
  const selection = await resolveLeaveEmployment(supabase, auth, employeeId, parsed.employmentId, parsed.startDate)
  if (!selection.employment) {
    if (!parsed.employmentId && selection.options.length > 1) throw new AbsenceEmploymentRequiredError(selection.options)
    throw new AbsenceServiceError('ABSENCE_EMPLOYMENT_INVALID', 422)
  }
  const { data, error } = await supabase.rpc('report_absence', {
    requested_tenant_id: auth.tenantId,
    requested_hr_group_id: hrGroupId,
    requested_employee_id: employeeId,
    requested_employment_id: selection.employment.id,
    requested_start_date: parsed.startDate,
    requested_absence_percentage: parsed.absencePercentage ?? 100,
    requested_expected_recovery_on: parsed.expectedRecoveryOn ?? undefined,
    requested_has_sickness_benefit_safety_net: parsed.hasSicknessBenefitSafetyNet ?? undefined,
    requested_is_work_accident: parsed.isWorkAccident ?? undefined,
    requested_is_third_party_traffic_accident: parsed.isThirdPartyTrafficAccident ?? undefined,
    requested_idempotency_key: parsed.idempotencyKey,
  })
  if (error || typeof data !== 'string') throwAbsenceRpcError(error, 'ABSENCE_REPORT_FAILED')
  return data
}

export async function recoverEmployeeAbsence(caseId: string, input: unknown): Promise<string> {
  const parsed = absenceRecoverySchema.parse({ ...(typeof input === 'object' && input !== null ? input : {}), caseId })
  assertAbsenceActualDate(parsed.recoveredOn)
  await requirePermission('absence:recover')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('recover_absence', {
    requested_case_id: caseId,
    requested_recovered_on: parsed.recoveredOn,
    requested_idempotency_key: parsed.idempotencyKey,
  })
  if (error || typeof data !== 'string') throwAbsenceRpcError(error, 'ABSENCE_RECOVERY_FAILED')
  return data
}

export async function changeEmployeeAbsenceCapacity(caseId: string, input: unknown): Promise<string> {
  const parsed = absenceCapacityChangeSchema.parse({ ...(typeof input === 'object' && input !== null ? input : {}), caseId })
  assertAbsenceActualDate(parsed.effectiveOn)
  await requirePermission('absence:write')
  const supabase = await createClient()
  const inputMode = parsed.inputMode ?? 'PERCENTAGE'
  const { data, error } = await supabase.rpc('change_absence_capacity_v2', {
    requested_case_id: caseId,
    requested_effective_on: parsed.effectiveOn,
    requested_absence_percentage: parsed.absencePercentage,
    requested_absence_hours_per_week: parsed.absenceHoursPerWeek,
    requested_input_mode: inputMode,
    requested_expected_next_review_on: parsed.expectedNextReviewOn ?? undefined,
    requested_idempotency_key: parsed.idempotencyKey,
  })
  if (error || typeof data !== 'string') throwAbsenceRpcError(error, 'ABSENCE_CAPACITY_FAILED')
  return data
}

function assertAbsenceActualDate(value: string): void {
  const today = new Date().toISOString().slice(0, 10)
  if (!isAbsenceActualDate(value, today)) throw new AbsenceServiceError('ABSENCE_DATE_IN_FUTURE', 422)
}

function throwAbsenceRpcError(error: { message?: string } | null, fallback: string): never {
  const knownCodes = new Set([
    'ABSENCE_FORBIDDEN',
    'ABSENCE_EMPLOYMENT_INVALID',
    'ABSENCE_PERCENTAGE_INVALID',
    'ABSENCE_CAPACITY_HOURS_INVALID',
    'ABSENCE_CAPACITY_INPUT_INVALID',
    'ABSENCE_SCHEDULE_NOT_FOUND',
    'ABSENCE_CASE_NOT_FOUND',
    'ABSENCE_CAPACITY_SCOPE_INVALID',
    'ABSENCE_NO_OPEN_SPELL',
    'ABSENCE_DATE_IN_FUTURE',
    'ABSENCE_DATE_ORDER_INVALID',
    'ABSENCE_SELF_SERVICE_FIELDS_FORBIDDEN',
    'ABSENCE_ACTIVE_SPELL_EXISTS',
    'ABSENCE_OVERLAP',
    'ABSENCE_NO_OPEN_SPELL',
    'ABSENCE_IDEMPOTENCY_CONFLICT',
  ])
  const candidate = error?.message?.trim() ?? ''
  const code = knownCodes.has(candidate) ? candidate : fallback
  const status = code === 'ABSENCE_FORBIDDEN' ? 403 : code === 'ABSENCE_CASE_NOT_FOUND' ? 404 : code === 'ABSENCE_ACTIVE_SPELL_EXISTS' || code === 'ABSENCE_OVERLAP' || code === 'ABSENCE_IDEMPOTENCY_CONFLICT' ? 409 : code === fallback ? 500 : 422
  throw new AbsenceServiceError(code, status)
}
