import 'server-only'

import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { resolveLeaveEmployment, type LeaveEmploymentOption } from '@/lib/leave/employment-resolver'
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

export interface AbsenceSpellSummary {
  id: string
  startedOn: string
  reportedAt: string
  expectedRecoveryOn: string | null
  recoveredOn: string | null
  capacityEffectiveOn: string | null
  expectedNextReviewOn: string | null
  absencePercentage: number | null
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
}, spells: Array<{ id: string; started_on: string; reported_at: string; expected_recovery_on: string | null; recovered_on: string | null; absence_capacity_changes: Array<{ absence_percentage: number; effective_on: string; expected_next_review_on: string | null }> }>): AbsenceCaseSummary {
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
    })),
  }
}

export async function listEmployeeAbsence(employeeId: string): Promise<AbsenceCaseSummary[]> {
  const auth = await requirePermission('absence:read', employeeId)
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
  const { data: capacityRows, error: capacityError } = spellIds.length
    ? await supabase.from('absence_capacity_changes').select('spell_id,absence_percentage,effective_on,expected_next_review_on').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).in('spell_id', spellIds).order('effective_on', { ascending: false })
    : { data: [], error: null }
  if (capacityError) throw new AbsenceServiceError('ABSENCE_READ_FAILED')
  const capacities = new Map<string, { absencePercentage: number; effectiveOn: string; expectedNextReviewOn: string | null }>()
  for (const row of capacityRows ?? []) {
    if (!capacities.has(row.spell_id)) capacities.set(row.spell_id, { absencePercentage: row.absence_percentage, effectiveOn: row.effective_on, expectedNextReviewOn: row.expected_next_review_on })
  }
  const spellsByCase = new Map<string, AbsenceSpellSummary[]>()
  for (const row of spellRows ?? []) {
    const capacity = capacities.get(row.id)
    const spell = {
      id: row.id,
      startedOn: row.started_on,
      reportedAt: row.reported_at,
      expectedRecoveryOn: row.expected_recovery_on,
      recoveredOn: row.recovered_on,
      absencePercentage: capacity?.absencePercentage ?? null,
      capacityEffectiveOn: capacity?.effectiveOn ?? null,
      expectedNextReviewOn: capacity?.expectedNextReviewOn ?? null,
    }
    spellsByCase.set(row.case_id, [...(spellsByCase.get(row.case_id) ?? []), spell])
  }
  return caseRows.map((row) => mapCase(row, (spellsByCase.get(row.id) ?? []).map((spell) => ({
    id: spell.id,
    started_on: spell.startedOn,
    reported_at: spell.reportedAt,
    expected_recovery_on: spell.expectedRecoveryOn,
    recovered_on: spell.recoveredOn,
    absence_capacity_changes: spell.absencePercentage === null || spell.capacityEffectiveOn === null
      ? []
      : [{ absence_percentage: spell.absencePercentage, effective_on: spell.capacityEffectiveOn, expected_next_review_on: spell.expectedNextReviewOn }],
  }))))
}

export async function getEmployeeAbsenceOverview(employeeId: string): Promise<AbsenceCaseSummary | null> {
  const cases = await listEmployeeAbsence(employeeId)
  return cases.find((item) => item.status !== 'CLOSED') ?? cases[0] ?? null
}

export async function resolveEmployeeAbsenceEmployment(
  employeeId: string,
  requestedEmploymentId: string | undefined,
  asOfDate: string,
) {
  const auth = await requirePermission('absence:write', employeeId)
  const supabase = await createClient()
  return resolveLeaveEmployment(supabase, auth, employeeId, requestedEmploymentId, asOfDate)
}

export async function listEmployeeAbsenceEmploymentOptions(employeeId: string) {
  const asOfDate = new Date().toISOString().slice(0, 10)
  return resolveEmployeeAbsenceEmployment(employeeId, undefined, asOfDate)
}

export async function reportEmployeeAbsence(employeeId: string, input: unknown): Promise<string> {
  const auth = await requirePermission('absence:write', employeeId)
  const hrGroupId = requireHrGroupId(auth)
  const parsed = absenceCaseCreateSchema.parse({ ...(typeof input === 'object' && input !== null ? input : {}), employeeId })
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
    requested_absence_percentage: parsed.absencePercentage,
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
  await requirePermission('absence:write')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('change_absence_capacity', {
    requested_case_id: caseId,
    requested_effective_on: parsed.effectiveOn,
    requested_absence_percentage: parsed.absencePercentage,
    requested_expected_next_review_on: parsed.expectedNextReviewOn ?? undefined,
    requested_idempotency_key: parsed.idempotencyKey,
  })
  if (error || typeof data !== 'string') throwAbsenceRpcError(error, 'ABSENCE_CAPACITY_FAILED')
  return data
}

function throwAbsenceRpcError(error: { message?: string } | null, fallback: string): never {
  const knownCodes = new Set([
    'ABSENCE_FORBIDDEN',
    'ABSENCE_EMPLOYMENT_INVALID',
    'ABSENCE_PERCENTAGE_INVALID',
    'ABSENCE_DATE_ORDER_INVALID',
    'ABSENCE_SELF_SERVICE_FIELDS_FORBIDDEN',
    'ABSENCE_ACTIVE_SPELL_EXISTS',
    'ABSENCE_OVERLAP',
    'ABSENCE_NO_OPEN_SPELL',
    'ABSENCE_IDEMPOTENCY_CONFLICT',
  ])
  const candidate = error?.message?.trim() ?? ''
  const code = knownCodes.has(candidate) ? candidate : fallback
  const status = code === 'ABSENCE_FORBIDDEN' ? 403 : code === 'ABSENCE_ACTIVE_SPELL_EXISTS' || code === 'ABSENCE_OVERLAP' || code === 'ABSENCE_IDEMPOTENCY_CONFLICT' ? 409 : code === fallback ? 500 : 422
  throw new AbsenceServiceError(code, status)
}
