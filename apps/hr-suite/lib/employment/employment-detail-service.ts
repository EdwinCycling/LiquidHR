import type { Database, Json } from '@scope/db'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type {
  CombinedTimelineMutationInput,
  ChainAssessmentRequestInput,
  ProfileLinkInput,
  RollbackTimelineInput,
  TimelineMutationInput,
} from './detail-schemas'
import { assessEmploymentChain } from './chain-assessment'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { isEmploymentContractEffectiveDateValid, type EmploymentContractEditInput, type EmploymentContractMutationInput } from './contract-schemas'
import { isBlockingProbationValidation, validateProbation } from './probation-rules'
import type { CompanyLocationMutationInput } from './company-location-schemas'
import { applySalaryApplicationChange as applySalaryApplicationRouteChange } from '@/lib/salary-application/service'
import { resolveSalaryStructureIntersection } from '@/lib/salary-application/availability'
import { getPensionArrangementEstablishedFrom, resolvePensionArrangementVersion } from './pension-arrangement-version'

type Tables = Database['public']['Tables']
type Employment = Tables['employments']['Row']
type PensionArrangementSource = {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly arrangement_type: string
  readonly effective_from: string
  readonly arrangement_established_from: string | null
  readonly effective_to: string | null
  readonly transition_date: string | null
  readonly grandfathering_mode: string
  readonly flat_total_rate: number | null
  readonly employer_share_pct: number
  readonly employee_share_pct: number
  readonly annual_franchise: number
  readonly annual_pensionable_salary_cap: number | null
  readonly pensionable_salary_definition: Json
  readonly eligibility_rule: Json
  readonly contract_classification: 'SOLIDARITY' | 'NON_SOLIDARITY' | 'UNKNOWN'
  readonly contract_classification_provenance: Json
  readonly provenance_json: Json
  readonly is_active: boolean
  readonly version_id: string | null
  readonly version_number: number | null
  readonly version_created_at: string | null
  readonly source_updated_at: string | null
  readonly tiers: readonly {
    readonly id: string
    readonly min_age: number
    readonly max_age: number
    readonly total_rate: number
    readonly created_at: string
  }[]
}
type EmploymentMigrationRpcName =
  | 'apply_employment_labor_condition_set_mutation'
  | 'apply_combined_labor_condition_set_mutation'
type EmploymentMigrationRpcClient = {
  rpc: (functionName: EmploymentMigrationRpcName, args: Record<string, unknown>) => PromiseLike<{
    data: string | null
    error: { message: string } | null
  }>
}

function employmentMigrationRpcClient(client: Awaited<ReturnType<typeof createClient>>): EmploymentMigrationRpcClient {
  // The existing application-domain RPC signatures are narrower than generated Database metadata.
  return client as unknown as EmploymentMigrationRpcClient
}

export class EmploymentDetailError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'EmploymentDetailError'
  }
}

async function permissionAllowed(code: string, employeeId: string): Promise<boolean> {
  try {
    await requirePermission(code, employeeId)
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

async function loadEmploymentForAction(employmentId: string, permission: string): Promise<Employment> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('employments').select('*')
    .eq('id', employmentId).is('deleted_at', null).maybeSingle()
  if (error || !data) throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)
  const context = await requirePermission(permission, data.employee_id)
  if (context.tenantId !== data.tenant_id) {
    throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)
  }
  return data
}

export type EmploymentIncomeRelationshipProjection = {
  readonly id: string
  readonly incomeRelationshipId: string
  readonly validFrom: string
  readonly validUntil: string | null
  readonly linkUpdatedAt: string
  readonly reportingStatus: Database['public']['Enums']['payroll_reporting_status']
  readonly startsOn: string
  readonly endsOn: string | null
  readonly incomeRelationshipUpdatedAt: string
}

/** Minimal, permission-checked IKV identity and effective link projection for Payroll source snapshots. */
export async function getEmploymentIncomeRelationshipProjection(
  employeeId: string,
  employmentId: string,
): Promise<readonly EmploymentIncomeRelationshipProjection[]> {
  const employment = await loadEmploymentForAction(employmentId, 'contract:read')
  if (employment.employee_id !== employeeId) throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)

  const supabase = await createClient()
  const { data, error } = await supabase.from('employment_income_relationships')
    .select('id, income_relationship_id, valid_from, valid_until, updated_at, income_relationships!inner(id, reporting_status, starts_on, ends_on, deleted_at, updated_at)')
    .eq('tenant_id', employment.tenant_id)
    .eq('administration_id', employment.administration_id)
    .eq('employee_id', employeeId)
    .eq('employment_id', employment.id)
    .order('valid_from', { ascending: true })
    .limit(100)
  if (error) throwDatabaseError(error.message)

  return (data ?? []).flatMap((row) => {
    const relationship = row.income_relationships
    if (!relationship || relationship.deleted_at !== null) return []
    return [{
      id: row.id,
      incomeRelationshipId: relationship.id,
      validFrom: row.valid_from,
      validUntil: row.valid_until,
      linkUpdatedAt: row.updated_at,
      reportingStatus: relationship.reporting_status,
      startsOn: relationship.starts_on,
      endsOn: relationship.ends_on,
      incomeRelationshipUpdatedAt: relationship.updated_at,
    }]
  })
}

export interface EmploymentPayrollSourceProjection {
  readonly employment: Pick<Employment, 'id' | 'tenant_id' | 'hr_group_id' | 'administration_id' | 'employee_id' | 'starts_on' | 'ends_on' | 'record_status' | 'employment_type' | 'contract_type' | 'original_hire_date' | 'seniority_date' | 'updated_at' | 'deleted_at'>
  readonly contracts: readonly {
    readonly id: string
    readonly labor_condition_set_id: string
    readonly fulltime_hours_per_week: number
    readonly starts_on: string
    readonly ends_on: string | null
    readonly updated_at: string
  }[]
  readonly laborConditions: readonly {
    readonly id: string
    readonly condition_group: string
    readonly labor_condition_set_id: string | null
    readonly valid_from: string
    readonly valid_until: string | null
    readonly updated_at: string
    readonly set: {
      readonly id: string
      readonly code: string
      readonly name: string
      readonly standard_hours_per_week: number
      readonly is_active: boolean
      readonly valid_from: string
      readonly updated_at: string
    } | null
  }[]
  readonly organizations: readonly {
    readonly id: string
    readonly department_id: string
    readonly job_id: string | null
    readonly job_code: string | null
    readonly job_title: string | null
    readonly job_revision_valid_from: string | null
    readonly job_revision_valid_until: string | null
    readonly job_revision_updated_at: string | null
    readonly effective_from: string
    readonly effective_to: string | null
    readonly updated_at: string
  }[]
  readonly salaries: readonly Pick<Tables['employment_salaries']['Row'],
    'id' | 'salary_basis' | 'salary_route' | 'payment_type' | 'payment_frequency' | 'currency_code'
    | 'fulltime_amount' | 'parttime_amount' | 'hourly_rate' | 'salary_structure_id' | 'salary_scale_id'
    | 'salary_scale_step_id' | 'salary_step_code' | 'cao_scale_name' | 'cao_step_name' | 'salary_band_id'
    | 'valid_from' | 'valid_until' | 'updated_at'>[]
  readonly schedules: readonly Pick<Tables['employment_schedules']['Row'],
    'id' | 'average_days_per_week' | 'average_hours_per_week' | 'fulltime_hours_per_week' | 'part_time_factor'
    | 'schedule_type' | 'is_on_call' | 'start_week' | 'time_for_time_accrual' | 'monday_hours' | 'tuesday_hours'
    | 'wednesday_hours' | 'thursday_hours' | 'friday_hours' | 'saturday_hours' | 'sunday_hours'
    | 'valid_from' | 'valid_until' | 'updated_at'>[]
  readonly pensionAssignments: readonly {
    readonly id: string
    readonly pension_arrangement_id: string
    readonly effective_from: string
    readonly effective_to: string | null
    readonly participation_start_date: string
    readonly assignment_reason: string
    readonly provenance_json: Json
    readonly updated_at: string
    readonly version_number: number
    readonly supersedes_assignment_id: string | null
    readonly arrangement: PensionArrangementSource | null
    readonly arrangement_resolution_reason: string | null
    readonly arrangement_resolution_change_version_ids: readonly string[]
    readonly age_for_tier: number | null
  }[]
  readonly laborConditionPensionArrangements: readonly {
    readonly id: string
    readonly labor_condition_set_id: string
    readonly pension_arrangement_id: string
    readonly participant_group: string
    readonly effective_from: string
    readonly effective_to: string | null
    readonly provenance_json: Json
    readonly version_number: number
    readonly supersedes_mapping_id: string | null
    readonly arrangement: PensionArrangementSource | null
    readonly arrangement_resolution_reason: string | null
    readonly arrangement_resolution_change_version_ids: readonly string[]
  }[]
}

/** Bounded Payroll source projection. Progressive tier resolution reads only the DOB needed to derive age; raw DOB/contact data is never returned. */
export async function getEmploymentPayrollSourceProjection(
  employeeId: string,
  employmentId: string,
  payrollPeriod: { readonly year: number; readonly month: number },
): Promise<EmploymentPayrollSourceProjection> {
  const context = await requirePermission('salary:read', employeeId)
  await Promise.all([
    requirePermission('contract:read', employeeId),
    requirePermission('organization-placement:read', employeeId),
    requirePermission('job-catalog:read', employeeId),
  ])
  if (!context.administrationId || !context.hrGroupId) {
    throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)
  }

  const supabase = await createClient()
  const [employmentResult, contractResult, laborResult, organizationResult, salaryResult, scheduleResult, pensionAssignmentResult, laborPensionResult] = await Promise.all([
    supabase.from('employments')
      .select('id, tenant_id, hr_group_id, administration_id, employee_id, starts_on, ends_on, record_status, employment_type, contract_type, original_hire_date, seniority_date, updated_at, deleted_at')
      .eq('id', employmentId).eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId)
      .eq('administration_id', context.administrationId).eq('employee_id', employeeId).maybeSingle(),
    supabase.from('employment_contracts')
      .select('id, labor_condition_set_id, fulltime_hours_per_week, starts_on, ends_on, updated_at')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId)
      .eq('employee_id', employeeId).eq('employment_id', employmentId).order('starts_on').limit(100),
    supabase.from('employment_labor_conditions')
      .select('id, employment_contract_id, condition_group, valid_from, valid_until, updated_at')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId)
      .eq('employee_id', employeeId).eq('employment_id', employmentId).order('valid_from').limit(100),
    supabase.from('employee_organizations')
      .select('id, department_id, job_id, job_title, effective_from, effective_to, updated_at')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId)
      .eq('employee_id', employeeId).eq('employment_id', employmentId).order('effective_from').limit(100),
    supabase.from('employment_salaries')
      .select('id, salary_basis, salary_route, payment_type, payment_frequency, currency_code, fulltime_amount, parttime_amount, hourly_rate, salary_structure_id, salary_scale_id, salary_scale_step_id, salary_step_code, cao_scale_name, cao_step_name, salary_band_id, valid_from, valid_until, updated_at')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId)
      .eq('employee_id', employeeId).eq('employment_id', employmentId).order('valid_from').limit(100),
    supabase.from('employment_schedules')
      .select('id, average_days_per_week, average_hours_per_week, fulltime_hours_per_week, part_time_factor, schedule_type, is_on_call, start_week, time_for_time_accrual, monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours, valid_from, valid_until, updated_at')
      .eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId)
      .eq('employee_id', employeeId).eq('employment_id', employmentId).order('valid_from').limit(100),
    supabase.from('employment_pension_arrangement_assignments')
      .select('id, pension_arrangement_id, effective_from, effective_to, participation_start_date, assignment_reason, provenance_json, updated_at, version_number, supersedes_assignment_id')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId)
      .eq('employment_id', employmentId).order('effective_from').limit(100),
    supabase.from('labor_condition_pension_arrangements')
      .select('id, labor_condition_set_id, pension_arrangement_id, participant_group, effective_from, effective_to, provenance_json, version_number, supersedes_mapping_id')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId)
      .order('effective_from').limit(100),
  ])
  const failed = [employmentResult, contractResult, laborResult, organizationResult, salaryResult, scheduleResult, pensionAssignmentResult, laborPensionResult]
    .find((result) => result.error)
  if (failed?.error) throwDatabaseError(failed.error.message)
  const employment = employmentResult.data
  if (!employment || employment.deleted_at !== null) throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)

  const laborRows = laborResult.data ?? []
  const contractRows = contractResult.data ?? []
  const contractsById = new Map(contractRows.map((row) => [row.id, row]))
  const laborSetIds = [...new Set(contractRows.flatMap((row) => row.labor_condition_set_id ? [row.labor_condition_set_id] : []))]
  const jobIds = [...new Set((organizationResult.data ?? []).flatMap((row) => row.job_id ? [row.job_id] : []))]
  const pensionArrangementIds = [...new Set([
    ...(pensionAssignmentResult.data ?? []).map((row) => row.pension_arrangement_id),
    ...(laborPensionResult.data ?? []).map((row) => row.pension_arrangement_id),
  ])]
  const payrollStart = `${payrollPeriod.year}-${String(payrollPeriod.month).padStart(2, '0')}-01`
  const payrollEnd = new Date(Date.UTC(payrollPeriod.year, payrollPeriod.month, 0)).toISOString().slice(0, 10)
  const [setsResult, jobsResult, revisionsResult, pensionArrangementsResult, pensionTiersResult,
    pensionVersionsResult] = await Promise.all([
    laborSetIds.length > 0
      ? supabase.from('labor_condition_sets').select('id, code, name, standard_hours_per_week, is_active, valid_from, updated_at')
        .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId).in('id', laborSetIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length > 0
      ? supabase.from('jobs').select('id, code, updated_at')
        .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).in('id', jobIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length > 0
      ? supabase.from('job_revisions').select('job_id, name, valid_from, valid_until, updated_at')
        .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).in('job_id', jobIds).order('valid_from')
      : Promise.resolve({ data: [], error: null }),
    pensionArrangementIds.length > 0
      ? supabase.from('pension_arrangements')
        .select('id, code, name, arrangement_type, effective_from, effective_to, transition_date, grandfathering_mode, flat_total_rate, employer_share_pct, employee_share_pct, annual_franchise, annual_pensionable_salary_cap, pensionable_salary_definition, eligibility_rule, provenance_json, is_active, updated_at')
        .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId)
        .in('id', pensionArrangementIds)
      : Promise.resolve({ data: [], error: null }),
    pensionArrangementIds.length > 0
      ? supabase.from('pension_arrangement_tiers')
        .select('id, pension_arrangement_id, min_age, max_age, total_rate, created_at')
        .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId)
        .in('pension_arrangement_id', pensionArrangementIds).order('min_age')
      : Promise.resolve({ data: [], error: null }),
    pensionArrangementIds.length > 0
      ? supabase.from('pension_arrangement_versions')
        .select('id, tenant_id, hr_group_id, administration_id, pension_arrangement_id, version_number, code, name, arrangement_type, effective_from, effective_to, transition_date, grandfathering_mode, flat_total_rate, employer_share_pct, employee_share_pct, annual_franchise, annual_pensionable_salary_cap, pensionable_salary_definition, eligibility_rule, contract_classification, contract_classification_provenance, provenance_json, is_active, created_at')
        .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId)
        .in('pension_arrangement_id', pensionArrangementIds).order('version_number')
      : Promise.resolve({ data: [], error: null }),
  ])
  const pensionVersionIds = (pensionVersionsResult.data ?? []).map((version) => version.id)
  const pensionVersionTiersLoaded = pensionVersionIds.length > 0
    ? await supabase.from('pension_arrangement_version_tiers')
      .select('id, tenant_id, hr_group_id, administration_id, pension_arrangement_id, pension_arrangement_version_id, min_age, max_age, total_rate, created_at')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('administration_id', context.administrationId)
      .in('pension_arrangement_version_id', pensionVersionIds).order('min_age')
    : { data: [], error: null }
  const catalogFailure = [setsResult, jobsResult, revisionsResult, pensionArrangementsResult, pensionTiersResult,
    pensionVersionsResult, pensionVersionTiersLoaded].find((result) => result.error)
  if (catalogFailure?.error) throwDatabaseError(catalogFailure.error.message)
  const setsById = new Map((setsResult.data ?? []).map((row) => [row.id, row]))
  const jobsById = new Map((jobsResult.data ?? []).map((row) => [row.id, row]))
  const tiersByArrangementId = new Map<string, Pick<Tables['pension_arrangement_tiers']['Row'], 'id' | 'min_age' | 'max_age' | 'total_rate' | 'created_at'>[]>()
  for (const tier of pensionTiersResult.data ?? []) {
    const tiers = tiersByArrangementId.get(tier.pension_arrangement_id) ?? []
    tiers.push(tier)
    tiersByArrangementId.set(tier.pension_arrangement_id, tiers)
  }
  const legacyArrangementsById = new Map((pensionArrangementsResult.data ?? []).map((row) => [row.id, {
    ...row,
    tiers: tiersByArrangementId.get(row.id) ?? [],
  }]))
  const versionTiersByVersionId = new Map<string, PensionArrangementSource['tiers'][number][]>()
  for (const tier of pensionVersionTiersLoaded.data ?? []) {
    const tiers = versionTiersByVersionId.get(tier.pension_arrangement_version_id) ?? []
    tiers.push(tier)
    versionTiersByVersionId.set(tier.pension_arrangement_version_id, tiers)
  }
  const pensionVersionsByArrangementId = new Map<string, typeof pensionVersionsResult.data>()
  for (const version of pensionVersionsResult.data ?? []) {
    const versions = pensionVersionsByArrangementId.get(version.pension_arrangement_id) ?? []
    pensionVersionsByArrangementId.set(version.pension_arrangement_id, [...versions, version])
  }
  const resolveArrangement = (arrangementId: string): {
    readonly arrangement: PensionArrangementSource | null
    readonly reasonCode: string | null
    readonly changeVersionIds: readonly string[]
  } => {
    const versions = pensionVersionsByArrangementId.get(arrangementId) ?? []
    if (versions.length === 0) {
      const legacy = legacyArrangementsById.get(arrangementId)
      return {
        arrangement: legacy ? {
          ...legacy,
          arrangement_established_from: legacy.effective_from,
          contract_classification: 'UNKNOWN',
          contract_classification_provenance: { status: 'UNVERIFIED' },
          version_id: null,
          version_number: null,
          version_created_at: null,
          source_updated_at: legacy.updated_at,
        } : null,
        reasonCode: null,
        changeVersionIds: [],
      }
    }
    const resolution = resolvePensionArrangementVersion(versions, arrangementId, payrollStart, payrollEnd)
    const selected = resolution.selected
    return {
      arrangement: selected ? {
        id: selected.pension_arrangement_id,
        code: selected.code,
        name: selected.name,
        arrangement_type: selected.arrangement_type,
        effective_from: selected.effective_from,
        arrangement_established_from: getPensionArrangementEstablishedFrom(versions, arrangementId),
        effective_to: selected.effective_to,
        transition_date: selected.transition_date,
        grandfathering_mode: selected.grandfathering_mode,
        flat_total_rate: selected.flat_total_rate,
        employer_share_pct: selected.employer_share_pct,
        employee_share_pct: selected.employee_share_pct,
        annual_franchise: selected.annual_franchise,
        annual_pensionable_salary_cap: selected.annual_pensionable_salary_cap,
        pensionable_salary_definition: selected.pensionable_salary_definition,
        eligibility_rule: selected.eligibility_rule,
        contract_classification: selected.contract_classification as PensionArrangementSource['contract_classification'],
        contract_classification_provenance: selected.contract_classification_provenance,
        provenance_json: selected.provenance_json,
        is_active: selected.is_active,
        version_id: selected.id,
        version_number: selected.version_number,
        version_created_at: selected.created_at,
        source_updated_at: null,
        tiers: versionTiersByVersionId.get(selected.id) ?? [],
      } : null,
      reasonCode: resolution.reasonCode,
      changeVersionIds: resolution.changeVersionIds,
    }
  }
  const activePensionAssignments = (pensionAssignmentResult.data ?? []).filter((row) =>
    row.effective_from <= payrollEnd && (row.effective_to === null || row.effective_to >= payrollStart),
  )
  const activeAssignmentArrangements = activePensionAssignments.map((row) => resolveArrangement(row.pension_arrangement_id))
  const progressiveActive = activeAssignmentArrangements.some((resolved) =>
    resolved.reasonCode === null && resolved.arrangement?.arrangement_type === 'PROGRESSIVE_PREMIUM',
  )
  let birthDate: string | null = null
  if (progressiveActive) {
    const identityContext = await requirePermission('employee:read', employeeId)
    if (identityContext.tenantId !== context.tenantId || identityContext.hrGroupId !== context.hrGroupId
      || identityContext.administrationId !== context.administrationId) {
      throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)
    }
    const birthDateResult = await supabase.from('employees').select('birth_date')
      .eq('id', employeeId).eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId)
      .is('deleted_at', null).maybeSingle()
    if (birthDateResult.error) throwDatabaseError(birthDateResult.error.message)
    birthDate = birthDateResult.data?.birth_date ?? null
  }
  const ageAt = (date: string): number | null => {
    if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
    const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
    const [year, month, day] = date.split('-').map(Number)
    if (birthYear === undefined || birthMonth === undefined || birthDay === undefined
      || year === undefined || month === undefined || day === undefined) return null
    const onOrBeforeBirthday = month > birthMonth || (month === birthMonth && day >= birthDay)
    return year - birthYear - (onOrBeforeBirthday ? 0 : 1)
  }
  const pensionAge = (arrangement: {
    readonly arrangement_type: string
    readonly eligibility_rule: Json
    readonly pensionable_salary_definition: Json
  }): number | null => {
    if (arrangement.arrangement_type !== 'PROGRESSIVE_PREMIUM' || !birthDate) return null
    const eligibility = arrangement.eligibility_rule
    const salaryDefinition = arrangement.pensionable_salary_definition
    const eligibilityAgeDetermination = typeof eligibility === 'object' && eligibility !== null && !Array.isArray(eligibility)
      ? eligibility.ageDetermination
      : undefined
    const salaryAgeDetermination = typeof salaryDefinition === 'object' && salaryDefinition !== null && !Array.isArray(salaryDefinition)
      ? salaryDefinition.ageDetermination
      : undefined
    const ageDetermination = salaryAgeDetermination ?? eligibilityAgeDetermination
    if (ageDetermination === 'AGE_AT_END_OF_CALENDAR_YEAR') return ageAt(`${payrollPeriod.year}-12-31`)
    if (ageDetermination === 'AGE_AT_PERIOD_END') return ageAt(payrollEnd)
    return null
  }
  const pensionAssignments = (pensionAssignmentResult.data ?? []).map((row) => {
    const resolved = resolveArrangement(row.pension_arrangement_id)
    const arrangement = resolved.arrangement
    return {
      ...row,
      arrangement,
      arrangement_resolution_reason: resolved.reasonCode,
      arrangement_resolution_change_version_ids: resolved.changeVersionIds,
      age_for_tier: arrangement ? pensionAge(arrangement) : null,
    }
  })
  const laborConditionPensionArrangements = (laborPensionResult.data ?? []).map((row) => {
    const resolved = resolveArrangement(row.pension_arrangement_id)
    return {
      ...row,
      arrangement: resolved.arrangement,
      arrangement_resolution_reason: resolved.reasonCode,
      arrangement_resolution_change_version_ids: resolved.changeVersionIds,
    }
  })
  const laborConditions = laborRows.map((row) => {
    const linkedContract = row.employment_contract_id ? contractsById.get(row.employment_contract_id) : null
    const laborConditionSetId = linkedContract?.labor_condition_set_id ?? null
    return {
      id: row.id,
      condition_group: row.condition_group,
      labor_condition_set_id: laborConditionSetId,
      valid_from: row.valid_from,
      valid_until: row.valid_until,
      updated_at: row.updated_at,
      set: laborConditionSetId ? setsById.get(laborConditionSetId) ?? null : null,
    }
  })

  return {
    employment,
    contracts: contractRows,
    laborConditions,
    organizations: (organizationResult.data ?? []).map((row) => {
      const revision = (revisionsResult.data ?? []).filter((item) => item.job_id === row.job_id
        && item.valid_from <= row.effective_from && (item.valid_until === null || item.valid_until > row.effective_from))
        .sort((left, right) => right.valid_from.localeCompare(left.valid_from))[0]
      const job = row.job_id ? jobsById.get(row.job_id) : null
      return {
        ...row,
        job_code: job?.code ?? null,
        job_title: revision?.name ?? row.job_title,
        job_revision_valid_from: revision?.valid_from ?? null,
        job_revision_valid_until: revision?.valid_until ?? null,
        job_revision_updated_at: revision?.updated_at ?? null,
      }
    }),
    salaries: salaryResult.data ?? [],
    schedules: scheduleResult.data ?? [],
    pensionAssignments,
    laborConditionPensionArrangements,
  }
}

async function validateSelectedContract(
  employmentId: string,
  contractId: string | null | undefined,
  effectiveOn: string,
): Promise<void> {
  if (!contractId) return
  const supabase = await createClient()
  const { data, error } = await supabase.from('employment_contracts')
    .select('id, starts_on, ends_on')
    .eq('id', contractId)
    .eq('employment_id', employmentId)
    .maybeSingle()
  if (error || !data) throw new EmploymentDetailError('CONTRACT_NOT_FOUND', 404)
  if (!isEmploymentContractEffectiveDateValid(effectiveOn, data.starts_on, data.ends_on)) {
    throw new EmploymentDetailError('CONTRACT_DATE_OUTSIDE_CONTRACT', 400)
  }
}

export type EmploymentDetailLoadScope =
  | 'all'
  | 'overview'
  | 'schedule'
  | 'salary'
  | 'organization'
  | 'company-location'
  | 'costs'
  | 'history'

function throwDatabaseError(message: string): never {
  const code = message.match(/[A-Z][A-Z_]+/)?.[0] ?? 'EMPLOYMENT_CHANGE_FAILED'
  const status = code === 'FORBIDDEN' ? 403 : code.includes('NOT_FOUND') ? 404
    : code.includes('CONFLICT') || code.includes('LATEST') || code.includes('REMAINING') ? 409 : 400
  throw new EmploymentDetailError(code, status)
}

export async function getEmploymentDetail(
  employeeId: string,
  employmentId: string,
  scope: EmploymentDetailLoadScope = 'all',
) {
  const employment = await loadEmploymentForAction(employmentId, 'contract:read')
  if (employment.employee_id !== employeeId) throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)
  const supabase = await createClient()
  const isAllScope = scope === 'all'
  const includeOverview = isAllScope || scope === 'overview'
  const includeBasics = includeOverview
  const includeLabor = includeOverview
  const includeSchedule = includeOverview || scope === 'schedule' || scope === 'salary'
  const includeSalary = includeOverview || scope === 'salary' || scope === 'schedule'
  const includeOrganization = includeOverview || scope === 'organization'
  const includeOrganizationContext = true
  const includeCompanyLocation = isAllScope || scope === 'company-location'
  const includeCosts = includeOverview || scope === 'costs'
  const includeHistory = isAllScope || scope === 'history'
  const canWriteContractPromise = includeLabor || includeSchedule || includeCosts || isAllScope
    ? permissionAllowed('contract:write', employeeId)
    : Promise.resolve(false)
  const canReadSalaryPromise = includeOverview || includeSalary
    ? permissionAllowed('salary:read', employeeId)
    : Promise.resolve(false)
  const canWriteSalaryPromise = includeSalary
    ? permissionAllowed('salary:write', employeeId)
    : Promise.resolve(false)
  const canReadAuditPromise = includeHistory
    ? permissionAllowed('audit:read', employeeId)
    : Promise.resolve(false)
  const canWriteEmployeePromise = includeOverview
    ? permissionAllowed('employee:write', employeeId)
    : Promise.resolve(false)
  const canWriteWorkSchedulePromise = includeSchedule
    ? permissionAllowed('work-schedule:write', employeeId)
    : Promise.resolve(false)
  const canWriteOrganizationPromise = includeOrganization
    ? permissionAllowed('organization-placement:write', employeeId)
    : Promise.resolve(false)
  const canWriteCompanyLocationPromise = includeCompanyLocation
    ? permissionAllowed('organization-placement:write', employeeId)
    : Promise.resolve(false)
  const employeeQuery = supabase.from('employees').select('id, employee_number, first_name, birth_name, birth_date, gender, work_email, work_phone, work_mobile, avatar_url')
    .eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id).eq('id', employeeId).maybeSingle()
  const administrationQuery = supabase.from('administrations').select('id, code, name')
    .eq('id', employment.administration_id).maybeSingle()
  const incomeLinksQuery = includeBasics
    ? supabase.from('employment_income_relationships').select('*, income_relationships(*)')
      .eq('employment_id', employmentId).order('valid_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const laborQuery = includeLabor
    ? supabase.from('employment_labor_conditions').select('*').eq('employment_id', employmentId)
      .order('valid_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const contractsQuery = includeOverview
    ? supabase.from('employment_contracts')
      .select('*, flex_phases(code, name), labor_condition_sets!employment_contracts_labor_condition_set_fkey(code, name, standard_hours_per_week)')
      .eq('employment_id', employmentId).order('starts_on', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const scheduleQuery = includeSchedule
    ? supabase.from('employment_schedules').select('*').eq('employment_id', employmentId)
      .order('valid_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const salaryQuery = canReadSalaryPromise.then(async (canReadSalary) => canReadSalary
    ? await supabase.from('employment_salaries').select('*').eq('employment_id', employmentId)
      .order('valid_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null }))
  const costQuery = includeCosts
    ? supabase.from('employment_cost_allocations').select('*, cost_centers(code, name), cost_carriers(code, name)').eq('employment_id', employmentId)
      .order('valid_from', { ascending: false }).limit(500)
    : Promise.resolve({ data: [], error: null })
  const organizationQuery = includeOrganizationContext
    ? supabase.from('employee_organizations').select('*, departments!employee_organizations_department_hr_group_fkey(code, name), jobs!employee_organizations_job_hr_group_fkey(code)').eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id).eq('employment_id', employmentId)
      .order('effective_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const companyDataQuery = includeCompanyLocation
    ? supabase.from('administration_company_data').select('*')
      .eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id).maybeSingle()
    : Promise.resolve({ data: null, error: null })
  const companyLocationsQuery = includeCompanyLocation
    ? supabase.from('administration_locations').select('id, name, is_active')
      .eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id)
      .order('is_active', { ascending: false }).order('name').limit(250)
    : Promise.resolve({ data: [], error: null })
  const companyLocationAssignmentsQuery = includeCompanyLocation
    ? supabase.from('employee_organizations').select('id, location_id, effective_from, effective_to')
      .eq('employment_id', employmentId).not('location_id', 'is', null).order('effective_from', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null })
  const linksQuery = supabase.from('employee_profile_links').select('*').eq('employee_id', employeeId)
    .order('sort_order').order('created_at').limit(50)
  const auditQuery = canReadAuditPromise.then(async (canReadAudit) => canReadAudit
    ? await supabase.from('audit_logs').select('*').eq('employment_id', employmentId)
      .order('created_at', { ascending: false }).limit(100)
    : Promise.resolve({ data: [], error: null }))
  const costCentersQuery = includeCosts
    ? supabase.from('cost_centers').select('id, code, name').eq('administration_id', employment.administration_id)
      .eq('is_active', true).order('code').limit(500)
    : Promise.resolve({ data: [], error: null })
  const costCarriersQuery = includeCosts
    ? supabase.from('cost_carriers').select('id, code, name')
      .eq('administration_id', employment.administration_id)
      .eq('is_active', true).order('code').limit(500)
    : Promise.resolve({ data: [], error: null })
  const scalesQuery = canReadSalaryPromise.then(async (canReadSalary) => {
    const emptyResult = { data: [], bandValues: [], salaryScales: [], salaryBands: [], salaryRoutes: [], revisions: [], scaleValues: [], resolutionSteps: [], resolutionBandValues: [], laborConditionSalaryStructureIds: {}, salaryStructureIds: [], error: null }
    if (!canReadSalary || !includeSalary) return emptyResult
    const today = new Date().toISOString().slice(0, 10)
    const settingsResult = await supabase.from('administration_hr_settings')
      .select('salary_routes, salary_structure_ids')
      .eq('tenant_id', employment.tenant_id)
      .eq('administration_id', employment.administration_id)
      .maybeSingle()
    if (settingsResult.error) return { ...emptyResult, error: settingsResult.error }
    const configuredStructureIds = new Set(settingsResult.data?.salary_structure_ids ?? [])
    const salaryRoutes = settingsResult.data?.salary_routes ?? ['MANUAL', 'MINIMUM_WAGE']
    const revisionsResult = await supabase.from('salary_structure_revisions')
      .select('id, salary_structure_id, effective_from, revision_number, status')
      .eq('tenant_id', employment.tenant_id)
      .eq('hr_group_id', employment.hr_group_id)
      .eq('status', 'PUBLISHED')
      .order('effective_from', { ascending: false })
      .order('revision_number', { ascending: false })
      .limit(5_000)
    if (revisionsResult.error) return { ...emptyResult, salaryRoutes, error: revisionsResult.error }

    const seenSalaryStructures = new Set<string>()
    const allRevisionIds = (revisionsResult.data ?? []).map((revision) => revision.id)
    const revisionIds = (revisionsResult.data ?? []).filter((revision) => revision.effective_from <= today).filter((revision) => {
      if (seenSalaryStructures.has(revision.salary_structure_id)) return false
      seenSalaryStructures.add(revision.salary_structure_id)
      return true
    }).map((revision) => revision.id)
    if (allRevisionIds.length === 0) return { ...emptyResult, salaryRoutes, salaryStructureIds: [...configuredStructureIds] }

    const [salaryContractsResult, laborConditionRelationsResult] = await Promise.all([
      supabase.from('employment_contracts').select('labor_condition_set_id, starts_on, ends_on')
        .eq('employment_id', employmentId).order('starts_on', { ascending: false }).limit(100),
      supabase.from('labor_condition_salary_structures').select('labor_condition_set_id, salary_structure_id')
        .eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id).limit(5_000),
    ])
    if (salaryContractsResult.error) return { ...emptyResult, salaryRoutes, error: salaryContractsResult.error }
    if (laborConditionRelationsResult.error) return { ...emptyResult, salaryRoutes, error: laborConditionRelationsResult.error }
    const currentContract = (salaryContractsResult.data ?? []).find((contract) => contract.starts_on <= today && (!contract.ends_on || contract.ends_on >= today))
    const laborConditionSalaryStructureIds = (laborConditionRelationsResult.data ?? []).reduce<Record<string, string[]>>((result, row) => {
      const current = result[row.labor_condition_set_id] ?? []
      if (!current.includes(row.salary_structure_id)) result[row.labor_condition_set_id] = [...current, row.salary_structure_id]
      return result
    }, {})
    const availableStructureIds = new Set(resolveSalaryStructureIntersection(
      [...configuredStructureIds],
      currentContract?.labor_condition_set_id ? laborConditionSalaryStructureIds[currentContract.labor_condition_set_id] : undefined,
    ))

    const [stepsResult, scalesResult, bandValuesResult, scalesCatalogResult, bandsCatalogResult] = await Promise.all([
      supabase.from('salary_scale_steps')
        .select('id, salary_structure_revision_id, salary_scale_id, step_code, step_name, fulltime_amount')
        .eq('tenant_id', employment.tenant_id)
        .eq('hr_group_id', employment.hr_group_id)
        .in('salary_structure_revision_id', allRevisionIds)
        .order('sequence_number')
        .limit(10_000),
      supabase.from('salary_scale_revision_values')
        .select('salary_structure_revision_id, salary_scale_id, code, name')
        .eq('tenant_id', employment.tenant_id)
        .eq('hr_group_id', employment.hr_group_id)
        .in('salary_structure_revision_id', allRevisionIds)
        .limit(5_000),
      supabase.from('salary_band_values')
        .select('id, salary_structure_revision_id, salary_band_id, code, name, minimum_amount, midpoint_amount, maximum_amount')
        .eq('tenant_id', employment.tenant_id)
        .eq('hr_group_id', employment.hr_group_id)
        .in('salary_structure_revision_id', allRevisionIds)
        .order('sort_order')
        .limit(10_000),
      supabase.from('salary_scales')
        .select('id, salary_structure_id, code, name')
        .eq('tenant_id', employment.tenant_id)
        .eq('hr_group_id', employment.hr_group_id)
        .eq('is_active', true)
        .limit(1_000),
      supabase.from('salary_bands')
        .select('id, salary_structure_id')
        .eq('tenant_id', employment.tenant_id)
        .eq('hr_group_id', employment.hr_group_id)
        .limit(1_000),
    ])
    if (stepsResult.error) return { ...emptyResult, salaryRoutes, error: stepsResult.error }
    if (scalesResult.error) return { ...emptyResult, salaryRoutes, error: scalesResult.error }
    if (bandValuesResult.error) return { ...emptyResult, salaryRoutes, error: bandValuesResult.error }
    if (scalesCatalogResult.error) return { ...emptyResult, salaryRoutes, error: scalesCatalogResult.error }
    if (bandsCatalogResult.error) return { ...emptyResult, salaryRoutes, error: bandsCatalogResult.error }
    const currentRevisionIds = new Set(revisionIds)
    const scaleLabels = new Map((scalesResult.data ?? []).filter((scale) => currentRevisionIds.has(scale.salary_structure_revision_id)).map((scale) => [scale.salary_scale_id, scale]))
    const revisionDates = new Map((revisionsResult.data ?? []).map((revision) => [revision.id, revision.effective_from]))
    const scaleCatalog = (scalesCatalogResult.data ?? [])
      .filter((scale) => availableStructureIds.has(scale.salary_structure_id) && salaryRoutes.includes('SCALE_WITH_STEPS'))
      .map((scale) => ({ id: scale.id, structureId: scale.salary_structure_id, code: scale.code, name: scale.name }))
    const bandStructureById = new Map((bandsCatalogResult.data ?? []).map((band) => [band.id, band.salary_structure_id]))
    const latestBands = new Map<string, { id: string; structureId: string; code: string; name: string; minimumAmount: number; midpointAmount: number; maximumAmount: number | null; effectiveFrom: string }>()
    for (const band of bandValuesResult.data ?? []) {
      const structureId = bandStructureById.get(band.salary_band_id)
      const effectiveFrom = revisionDates.get(band.salary_structure_revision_id)
      if (!structureId || !availableStructureIds.has(structureId) || !salaryRoutes.includes('SALARY_BAND') || !effectiveFrom || effectiveFrom > today) continue
      const current = latestBands.get(band.salary_band_id)
      if (!current || effectiveFrom > current.effectiveFrom) latestBands.set(band.salary_band_id, {
        id: band.salary_band_id,
        structureId,
        code: band.code,
        name: band.name,
        minimumAmount: Number(band.minimum_amount),
        midpointAmount: Number(band.midpoint_amount),
        maximumAmount: band.maximum_amount === null ? null : Number(band.maximum_amount),
        effectiveFrom,
      })
    }
    return {
       data: (stepsResult.data ?? []).filter((step) => currentRevisionIds.has(step.salary_structure_revision_id) && (scaleCatalog.some((scale) => scale.id === step.salary_scale_id))).map((step) => ({
         id: step.id,
         salary_structure_revision_id: step.salary_structure_revision_id,
        salary_scale_id: step.salary_scale_id,
        step_code: step.step_code,
        step_name: step.step_name,
        fulltime_amount: step.fulltime_amount,
          salary_scales: scaleLabels.get(step.salary_scale_id) ?? null,
      })),
      bandValues: (bandValuesResult.data ?? []).map((band) => ({
        id: band.id,
        salary_band_id: band.salary_band_id,
        code: band.code,
        name: band.name,
        minimum_amount: band.minimum_amount,
        midpoint_amount: band.midpoint_amount,
        maximum_amount: band.maximum_amount,
        effective_from: revisionDates.get(band.salary_structure_revision_id) ?? null,
      })),
      salaryScales: scaleCatalog,
      salaryBands: [...latestBands.values()],
      salaryRoutes,
      revisions: (revisionsResult.data ?? []).map((revision) => ({ id: revision.id, salary_structure_id: revision.salary_structure_id, effective_from: revision.effective_from, revision_number: revision.revision_number, status: revision.status })),
      scaleValues: (scalesResult.data ?? []).map((scale) => ({ salary_structure_revision_id: scale.salary_structure_revision_id, salary_scale_id: scale.salary_scale_id, code: scale.code, name: scale.name })),
      resolutionSteps: (stepsResult.data ?? []).map((step) => ({ id: step.id, salary_structure_revision_id: step.salary_structure_revision_id, salary_scale_id: step.salary_scale_id, step_code: step.step_code, step_name: step.step_name, fulltime_amount: step.fulltime_amount })),
      resolutionBandValues: (bandValuesResult.data ?? []).map((band) => ({ id: band.id, salary_structure_revision_id: band.salary_structure_revision_id, salary_band_id: band.salary_band_id, code: band.code, name: band.name, minimum_amount: band.minimum_amount, midpoint_amount: band.midpoint_amount, maximum_amount: band.maximum_amount })),
      laborConditionSalaryStructureIds,
      salaryStructureIds: [...configuredStructureIds],
      error: null,
    }
  })
  const contractOptionsQuery = includeOverview
    ? Promise.all([
      supabase.from('labor_condition_sets').select('*')
        .eq('administration_id', employment.administration_id).eq('is_active', true).order('code').limit(500),
      supabase.from('flex_phases').select('id, code, name')
        .eq('administration_id', employment.administration_id).eq('is_active', true).order('sort_order').limit(500),
    ])
    : Promise.resolve([
      { data: [], error: null },
      { data: [], error: null },
    ] as const)
  const organizationOptionsQuery = includeOrganization
    ? Promise.all([
      supabase.from('departments').select('id, code, name')
        .eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id).eq('is_active', true).order('code').limit(500),
      supabase.from('jobs').select('id, code, job_revisions!job_revisions_job_hr_group_fkey(name)')
        .eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id).eq('is_active', true).order('code').limit(500),
    ])
    : Promise.resolve([
      { data: [], error: null },
      { data: [], error: null },
    ] as const)

  const [
    employeeResult, administrationResult, incomeLinksResult, laborResult, contractsResult, scheduleResult,
    salaryResult, costResult, organizationResult, companyDataResult, companyLocationsResult,
    companyLocationAssignmentsResult, linksResult, auditResult,
    costCentersResult, costCarriersResult, scalesResult, contractOptionsResult, organizationOptionsResult,
    canWriteContract, canReadSalary, canWriteSalary, canReadAudit, canWriteEmployee, canWriteWorkSchedule,
    canWriteOrganization, canWriteCompanyLocation,
  ] = await Promise.all([
    employeeQuery,
    administrationQuery,
    incomeLinksQuery,
    laborQuery,
    contractsQuery,
    scheduleQuery,
    salaryQuery,
    costQuery,
    organizationQuery,
    companyDataQuery,
    companyLocationsQuery,
    companyLocationAssignmentsQuery,
    linksQuery,
    auditQuery,
    costCentersQuery,
    costCarriersQuery,
    scalesQuery,
    contractOptionsQuery,
    organizationOptionsQuery,
    canWriteContractPromise,
    canReadSalaryPromise,
    canWriteSalaryPromise,
    canReadAuditPromise,
    canWriteEmployeePromise,
    canWriteWorkSchedulePromise,
    canWriteOrganizationPromise,
    canWriteCompanyLocationPromise,
  ])
  const results = [employeeResult, administrationResult, incomeLinksResult, laborResult, contractsResult, scheduleResult,
    salaryResult, costResult, organizationResult, companyDataResult, companyLocationsResult,
    companyLocationAssignmentsResult, linksResult, auditResult,
    costCentersResult, costCarriersResult, scalesResult,
    ...contractOptionsResult, ...organizationOptionsResult]
  if (results.some((result) => result.error)) throw new EmploymentDetailError('EMPLOYMENT_DETAIL_FAILED', 500)
  if (!employeeResult.data || !administrationResult.data) throw new EmploymentDetailError('EMPLOYMENT_NOT_FOUND', 404)

  return {
    employment,
    employee: { ...employeeResult.data, avatar_url: employeeAvatarHref(employeeId, employeeResult.data.avatar_url) },
    administration: administrationResult.data,
    incomeRelationships: incomeLinksResult.data ?? [],
    contracts: contractsResult.data ?? [],
    laborConditions: laborResult.data ?? [], schedules: scheduleResult.data ?? [],
    salaries: salaryResult.data ?? [], costAllocations: costResult.data ?? [],
    organizations: organizationResult.data ?? [], profileLinks: linksResult.data ?? [],
    companyLocation: {
      company: companyDataResult.data,
      locations: companyLocationsResult.data ?? [],
      assignments: companyLocationAssignmentsResult.data ?? [],
    },
    auditLogs: auditResult.data ?? [],
    options: {
      costCenters: costCentersResult.data ?? [],
      costCarriers: costCarriersResult.data ?? [],
      salaryScaleSteps: scalesResult.data ?? [],
      salaryScales: scalesResult.salaryScales ?? [],
      salaryBands: scalesResult.salaryBands ?? [],
      salaryRoutes: scalesResult.salaryRoutes ?? [],
      salaryBandValues: scalesResult.bandValues ?? [],
      salaryRevisions: scalesResult.revisions ?? [],
      salaryScaleValues: scalesResult.scaleValues ?? [],
      salaryResolutionSteps: scalesResult.resolutionSteps ?? [],
      salaryResolutionBandValues: scalesResult.resolutionBandValues ?? [],
      laborConditionSalaryStructureIds: scalesResult.laborConditionSalaryStructureIds ?? {},
      salaryStructureIds: scalesResult.salaryStructureIds ?? [],
      laborConditionSets: contractOptionsResult[0].data ?? [],
      flexPhases: contractOptionsResult[1].data ?? [],
      departments: organizationOptionsResult[0].data ?? [],
      jobs: (organizationOptionsResult[1].data ?? []).map((job) => ({
        id: job.id,
        code: job.code,
        name: job.job_revisions[0]?.name ?? job.code,
      })),
    },
    capabilities: {
      canWriteContract, canReadSalary, canWriteSalary, canReadAudit, canWriteEmployee,
      canWriteWorkSchedule, canWriteOrganization, canWriteCompanyLocation,
    },
  }
}

export async function applyTimelineMutation(employmentId: string, input: TimelineMutationInput): Promise<string> {
  const permission = input.timeline === 'SALARY' ? 'salary:write' : 'contract:write'
  const employment = await loadEmploymentForAction(employmentId, permission)
  await validateSelectedContract(employmentId, input.contractId, input.effectiveOn)
  if (input.timeline === 'LABOR_CONDITIONS') {
    await validateLaborConditionSetSelection(employment, input.payload.laborConditionSetId, input.effectiveOn)
  }
  if (input.timeline === 'SALARY' && input.payload.salaryRoute) {
    const result = await applySalaryApplicationRouteChange({
      employmentId,
      effectiveOn: input.effectiveOn,
      reason: input.reason,
      warningCodes: input.warningCodes,
      acknowledgements: input.acknowledgements,
      payload: input.payload,
    })
    return result.changeSetId
  }
  const supabase = await createClient()
  const { data, error } = input.timeline === 'COST_ALLOCATION'
    ? await supabase.rpc('apply_employment_cost_allocation', {
      requested_employment_id: employmentId,
      requested_effective_on: input.effectiveOn,
      requested_payload: input.payload as Json,
      requested_reason: input.reason,
      requested_warning_codes: input.warningCodes,
      requested_acknowledgements: input.acknowledgements as Json,
    })
    : input.timeline === 'LABOR_CONDITIONS'
      ? await employmentMigrationRpcClient(supabase).rpc('apply_employment_labor_condition_set_mutation', {
        requested_employment_id: employmentId,
        requested_effective_on: input.effectiveOn,
        requested_payload: input.payload as Json,
        requested_reason: input.reason,
        requested_warning_codes: input.warningCodes,
        requested_acknowledgements: input.acknowledgements as Json,
      })
      : await supabase.rpc('apply_employment_timeline_mutation', {
      requested_employment_id: employmentId,
      requested_timeline: input.timeline,
      requested_effective_on: input.effectiveOn,
      requested_payload: input.payload as Json,
      requested_reason: input.reason,
      requested_warning_codes: input.warningCodes,
      requested_acknowledgements: input.acknowledgements as Json,
    })
  if (error || !data) throwDatabaseError(error?.message ?? 'EMPLOYMENT_CHANGE_FAILED')
  return data
}

export async function applyCombinedTimelineMutation(
  employmentId: string,
  input: CombinedTimelineMutationInput,
): Promise<string> {
  const requiresSalaryWrite = input.mutations.some((mutation) => mutation.timeline === 'SALARY')
  const employment = await loadEmploymentForAction(employmentId, 'contract:write')
  if (requiresSalaryWrite) await loadEmploymentForAction(employmentId, 'salary:write')
  await validateSelectedContract(employmentId, input.contractId, input.effectiveOn)
  const laborMutation = input.mutations.find((mutation) => mutation.timeline === 'LABOR_CONDITIONS')
  if (laborMutation?.timeline === 'LABOR_CONDITIONS') {
    await validateLaborConditionSetSelection(employment, laborMutation.payload.laborConditionSetId, input.effectiveOn)
  }
  const supabase = await createClient()
  const usesSalaryApplicationRoute = input.mutations.some((mutation) => mutation.timeline === 'SALARY' && Boolean(mutation.payload.salaryRoute))
  const { data, error } = laborMutation
    ? await employmentMigrationRpcClient(supabase).rpc('apply_combined_labor_condition_set_mutation', {
      requested_employment_id: employmentId,
      requested_effective_on: input.effectiveOn,
      requested_mutations: input.mutations as Json,
      requested_reason: input.reason,
      requested_warning_codes: input.warningCodes,
      requested_acknowledgements: input.acknowledgements as Json,
    })
    : usesSalaryApplicationRoute
      ? await supabase.rpc('apply_combined_salary_application_change', {
        requested_employment_id: employmentId,
        requested_effective_on: input.effectiveOn,
        requested_mutations: input.mutations as Json,
        requested_reason: input.reason,
        requested_warning_codes: input.warningCodes,
        requested_acknowledgements: input.acknowledgements as Json,
      })
      : await supabase.rpc('apply_combined_employment_timeline_mutation', {
      requested_employment_id: employmentId,
      requested_effective_on: input.effectiveOn,
      requested_mutations: input.mutations as Json,
      requested_reason: input.reason,
      requested_warning_codes: input.warningCodes,
      requested_acknowledgements: input.acknowledgements as Json,
    })
  if (error || !data) throwDatabaseError(error?.message ?? 'EMPLOYMENT_CHANGE_FAILED')
  return data
}

async function validateLaborConditionSetSelection(
  employment: Employment,
  laborConditionSetId: string,
  effectiveOn: string,
): Promise<void> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('labor_condition_sets')
    .select('id')
    .eq('id', laborConditionSetId)
    .eq('tenant_id', employment.tenant_id)
    .eq('administration_id', employment.administration_id)
    .eq('hr_group_id', employment.hr_group_id)
    .eq('is_active', true)
    .lte('valid_from', effectiveOn)
    .maybeSingle()
  if (error) throwDatabaseError(error.message)
  if (!data) throw new EmploymentDetailError('LABOR_CONDITION_SET_SCOPE_MISMATCH', 400)
}

export async function manageEmploymentContract(
  employmentId: string,
  contractId: string | null,
  input: EmploymentContractMutationInput | EmploymentContractEditInput,
): Promise<string> {
  const employment = await loadEmploymentForAction(employmentId, 'contract:write')
  const supabase = await createClient()
  const { data: laborCondition, error: laborConditionError } = await supabase
    .from('labor_condition_sets')
    .select('id, probation_maximum_months')
    .eq('tenant_id', employment.tenant_id)
    .eq('administration_id', employment.administration_id)
    .eq('hr_group_id', employment.hr_group_id)
    .eq('id', input.laborConditionSetId)
    .lte('valid_from', input.startsOn)
    .maybeSingle()
  if (laborConditionError || !laborCondition) throw new EmploymentDetailError('LABOR_CONDITION_NOT_FOUND', 400)
  const probationError = validateProbation({
    ...input,
    caoAllowsTwoMonths: laborCondition.probation_maximum_months === 2,
  })
  if (isBlockingProbationValidation(probationError)) throw new EmploymentDetailError(probationError, 400)
  const { data, error } = await supabase.rpc('manage_employment_contract', {
    requested_employment_id: employmentId,
    requested_contract_id: contractId as string,
    requested_payload: input as Json,
  })
  if (error || !data) throwDatabaseError(error?.message ?? 'CONTRACT_CHANGE_FAILED')
  return data
}

export async function manageEmploymentOrganization(
  employmentId: string,
  placementId: string | null,
  input: { contractId?: string | null; effectiveOn: string; departmentId: string; jobId: string },
): Promise<string> {
  const employment = await loadEmploymentForAction(employmentId, 'contract:read')
  await requirePermission('organization-placement:write', employment.employee_id)
  await validateSelectedContract(employmentId, input.contractId, input.effectiveOn)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('manage_employment_organization_timeline', {
    requested_employment_id: employmentId,
    requested_placement_id: placementId as string,
    requested_effective_on: input.effectiveOn,
    requested_department_id: input.departmentId,
    requested_job_id: input.jobId,
  })
  if (error || !data) throwDatabaseError(error?.message ?? 'ORGANIZATION_CHANGE_FAILED')
  return data
}

export async function manageEmploymentCompanyLocation(
  employmentId: string,
  input: CompanyLocationMutationInput,
): Promise<string> {
  const employment = await loadEmploymentForAction(employmentId, 'contract:read')
  await requirePermission('organization-placement:write', employment.employee_id)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('manage_employment_company_location', {
    requested_employment_id: employmentId,
    requested_placement_id: input.placementId as string,
    requested_effective_on: input.effectiveOn,
    requested_location_id: input.locationId,
  })
  if (error || !data) throwDatabaseError(error?.message ?? 'COMPANY_LOCATION_CHANGE_FAILED')
  return data
}

export async function rollbackTimeline(
  employmentId: string,
  timeline: TimelineMutationInput['timeline'],
  input: RollbackTimelineInput,
): Promise<string> {
  const permission = timeline === 'SALARY' ? 'salary:write' : 'contract:write'
  await loadEmploymentForAction(employmentId, permission)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('rollback_latest_employment_timeline', {
    requested_employment_id: employmentId,
    requested_timeline: timeline,
    requested_effective_on: input.effectiveOn,
    requested_reason: input.reason,
  })
  if (error || !data) throwDatabaseError(error?.message ?? 'EMPLOYMENT_ROLLBACK_FAILED')
  return data
}

export async function createProfileLink(employmentId: string, input: ProfileLinkInput) {
  const employment = await loadEmploymentForAction(employmentId, 'employee:write')
  const supabase = await createClient()
  const { data, error } = await supabase.from('employee_profile_links').insert({
    tenant_id: employment.tenant_id, employee_id: employment.employee_id,
    link_type: input.linkType, label: input.label, url: input.url,
    is_featured: input.isFeatured, sort_order: input.sortOrder,
  }).select('*').single()
  if (error || !data) throwDatabaseError(error?.message ?? 'PROFILE_LINK_CREATE_FAILED')
  return data
}

export async function deleteEmployment(employmentId: string): Promise<void> {
  const employment = await loadEmploymentForAction(employmentId, 'contract:write')
  const supabase = await createClient()
  const { error } = await supabase.from('employments').update({ deleted_at: new Date().toISOString() }).eq('id', employment.id).eq('tenant_id', employment.tenant_id).eq('hr_group_id', employment.hr_group_id)
  if (error) throwDatabaseError(error.message)
}

export async function assessProposedEmploymentChain(employeeId: string, input: ChainAssessmentRequestInput) {
  const context = await requirePermission('contract:write', employeeId)
  const supabase = await createClient()
  const [{ data: employee, error: employeeError }, { data: employments, error: employmentError }, { data: externalHistory, error: historyError }] = await Promise.all([
    supabase.from('employees').select('id, tenant_id, hr_group_id').eq('id', employeeId).eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId ?? '').maybeSingle(),
    supabase.from('employments').select('starts_on, ends_on, contract_type').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId ?? '').eq('employee_id', employeeId)
      .is('deleted_at', null).order('starts_on').limit(100),
    supabase.from('employment_chain_history').select('starts_on, ends_on').eq('employee_id', employeeId)
      .order('starts_on').limit(100),
  ])
  if (employeeError || !employee || employee.tenant_id !== context.tenantId || employee.hr_group_id !== context.hrGroupId) {
    throw new EmploymentDetailError('EMPLOYEE_NOT_FOUND', 404)
  }
  if (employmentError || historyError) throw new EmploymentDetailError('CHAIN_ASSESSMENT_FAILED', 500)
  const history = [
    ...(employments ?? []).filter((item) => item.contract_type !== 'INDEFINITE').map((item) => ({
      startsOn: item.starts_on,
      endsOn: item.ends_on,
    })),
    ...(externalHistory ?? []).map((item) => ({ startsOn: item.starts_on, endsOn: item.ends_on })),
  ]
  return assessEmploymentChain({
    ...input,
    proposed: { ...input.proposed, endsOn: input.proposed.endsOn ?? null },
    history,
  })
}
