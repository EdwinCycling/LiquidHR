import 'server-only'

import { requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { absenceCaseCreateSchema, absenceRecoverySchema } from './schemas'

export interface AbsenceSpellSummary {
  id: string
  startedOn: string
  expectedRecoveryOn: string | null
  recoveredOn: string | null
  absencePercentage: number | null
}

export interface AbsenceCaseSummary {
  id: string
  status: 'ACTIVE' | 'RECOVERY_WINDOW' | 'CLOSED'
  firstAbsenceOn: string
  effectiveClockStartOn: string
  recoveryWindowEndsOn: string | null
  isFrequentAbsence: boolean
  priorCaseCount12Months: number
  frequentAbsenceThreshold: number
  spells: AbsenceSpellSummary[]
}

function mapCase(row: {
  id: string
  status: AbsenceCaseSummary['status']
  first_absence_on: string
  effective_clock_start_on: string
  recovery_window_ends_on: string | null
  is_frequent_absence: boolean
  prior_case_count_12_months: number
  frequent_absence_threshold: number
}, spells: Array<{ id: string; started_on: string; expected_recovery_on: string | null; recovered_on: string | null; absence_capacity_changes: Array<{ absence_percentage: number }> }>): AbsenceCaseSummary {
  return {
    id: row.id,
    status: row.status,
    firstAbsenceOn: row.first_absence_on,
    effectiveClockStartOn: row.effective_clock_start_on,
    recoveryWindowEndsOn: row.recovery_window_ends_on,
    isFrequentAbsence: row.is_frequent_absence,
    priorCaseCount12Months: row.prior_case_count_12_months,
    frequentAbsenceThreshold: row.frequent_absence_threshold,
    spells: spells.map((spell) => ({
      id: spell.id,
      startedOn: spell.started_on,
      expectedRecoveryOn: spell.expected_recovery_on,
      recoveredOn: spell.recovered_on,
      absencePercentage: spell.absence_capacity_changes[0]?.absence_percentage ?? null,
    })),
  }
}

export async function listEmployeeAbsence(employeeId: string): Promise<AbsenceCaseSummary[]> {
  await requirePermission('absence:read', employeeId)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('absence_cases')
    .select('id,status,first_absence_on,effective_clock_start_on,recovery_window_ends_on,is_frequent_absence,prior_case_count_12_months,frequent_absence_threshold')
    .eq('employee_id', employeeId)
    .is('archived_at', null)
    .order('first_absence_on', { ascending: false })
    .limit(50)
  if (error) throw new Error('ABSENCE_READ_FAILED')
  const caseRows = data ?? []
  const caseIds = caseRows.map((row) => row.id)
  if (caseIds.length === 0) return []
  const { data: spellRows, error: spellError } = await supabase.from('absence_spells').select('id,case_id,started_on,expected_recovery_on,recovered_on').in('case_id', caseIds).order('started_on', { ascending: false })
  if (spellError) throw new Error('ABSENCE_READ_FAILED')
  const spellIds = (spellRows ?? []).map((row) => row.id)
  const { data: capacityRows, error: capacityError } = spellIds.length ? await supabase.from('absence_capacity_changes').select('spell_id,absence_percentage').in('spell_id', spellIds).order('effective_on', { ascending: false }) : { data: [], error: null }
  if (capacityError) throw new Error('ABSENCE_READ_FAILED')
  const capacities = new Map<string, number>()
  for (const row of capacityRows ?? []) if (!capacities.has(row.spell_id)) capacities.set(row.spell_id, row.absence_percentage)
  const spellsByCase = new Map<string, AbsenceSpellSummary[]>()
  for (const row of spellRows ?? []) {
    const spell = { id: row.id, startedOn: row.started_on, expectedRecoveryOn: row.expected_recovery_on, recoveredOn: row.recovered_on, absencePercentage: capacities.get(row.id) ?? null }
    spellsByCase.set(row.case_id, [...(spellsByCase.get(row.case_id) ?? []), spell])
  }
  return caseRows.map((row) => mapCase(row, (spellsByCase.get(row.id) ?? []).map((spell) => ({ id: spell.id, started_on: spell.startedOn, expected_recovery_on: spell.expectedRecoveryOn, recovered_on: spell.recoveredOn, absence_capacity_changes: spell.absencePercentage === null ? [] : [{ absence_percentage: spell.absencePercentage }] }))))
}

export async function getEmployeeAbsenceOverview(employeeId: string): Promise<AbsenceCaseSummary | null> {
  const cases = await listEmployeeAbsence(employeeId)
  return cases.find((item) => item.status !== 'CLOSED') ?? cases[0] ?? null
}

export async function reportEmployeeAbsence(employeeId: string, input: unknown): Promise<string> {
  const auth = await requirePermission('absence:write', employeeId)
  const parsed = absenceCaseCreateSchema.parse({ ...(typeof input === 'object' && input !== null ? input : {}), employeeId })
  const supabase = await createClient()
  const employmentId = await resolveEmploymentId(auth, employeeId, parsed.employmentId, parsed.startDate)
  const { data, error } = await supabase.rpc('report_absence', {
    requested_tenant_id: auth.tenantId,
    requested_administration_id: auth.administrationId ?? '',
    requested_employee_id: employeeId,
    requested_employment_id: employmentId,
    requested_start_date: parsed.startDate,
    requested_absence_percentage: parsed.absencePercentage,
    requested_expected_recovery_on: parsed.expectedRecoveryOn ?? undefined,
    requested_has_sickness_benefit_safety_net: parsed.hasSicknessBenefitSafetyNet ?? undefined,
    requested_is_work_accident: parsed.isWorkAccident ?? undefined,
    requested_is_third_party_traffic_accident: parsed.isThirdPartyTrafficAccident ?? undefined,
    requested_idempotency_key: parsed.idempotencyKey,
  })
  if (error || typeof data !== 'string') throw new Error('ABSENCE_REPORT_FAILED')
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
  if (error || typeof data !== 'string') throw new Error('ABSENCE_RECOVERY_FAILED')
  return data
}

async function resolveEmploymentId(auth: AuthContext, employeeId: string, requestedId: string | undefined, startDate: string): Promise<string> {
  const supabase = await createClient()
  const query = supabase.from('employments').select('id').eq('tenant_id', auth.tenantId).eq('employee_id', employeeId).is('deleted_at', null).lte('starts_on', startDate).or(`ends_on.is.null,ends_on.gte.${startDate}`).order('is_primary', { ascending: false }).order('starts_on', { ascending: false }).limit(1)
  const { data, error } = requestedId ? await query.eq('id', requestedId).maybeSingle() : await query.maybeSingle()
  if (error || !data) throw new Error('ABSENCE_EMPLOYMENT_REQUIRED')
  return data.id
}
