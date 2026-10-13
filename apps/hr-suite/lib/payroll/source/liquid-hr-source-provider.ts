import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { Database } from '@scope/db'
import { getActualWorkPayrollProjection, type ActualWorkPayrollProjection } from '@/lib/actual-work/actual-work-service'
import type {
  PayrollSourceGap,
  PayrollSourceProvider,
  PayrollSourceProviderInput,
  PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import { FixedDecimal } from '@liquid-hr/payroll-engine'
import { requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { listEmployeeEmployments } from '@/lib/employment/employment-service'
import {
  getEmploymentPayrollTaxSourceProjection,
  type EmploymentPayrollTaxSourceProjection,
} from '@/lib/employment/employment-payroll-tax-profile-service'
import {
  getEmploymentIncomeRelationshipProjection,
  getEmploymentPayrollSourceProjection,
  type EmploymentPayrollSourceProjection,
} from '@/lib/employment/employment-detail-service'
import { isPayrollLabEnabled } from '../feature-flag'
import { payrollScopeFromAuthContext } from '../scope'
import { payrollSourceProviderInputSchema, payrollSourceSnapshotSchema } from './schemas'
import { hashPayrollSourceSnapshot } from './snapshot-hash'

type EmploymentRow = Database['public']['Tables']['employments']['Row']
type SalaryRow = Database['public']['Tables']['employment_salaries']['Row']
type ScheduleRow = Database['public']['Tables']['employment_schedules']['Row']

export type PayrollSourceEmployment = Pick<EmploymentRow,
  | 'id' | 'tenant_id' | 'hr_group_id' | 'administration_id' | 'employee_id'
  | 'starts_on' | 'ends_on' | 'record_status' | 'employment_type' | 'contract_type'
  | 'original_hire_date' | 'seniority_date' | 'updated_at' | 'deleted_at'
>

export type PayrollSourceSalary = Pick<SalaryRow,
  | 'id' | 'salary_basis' | 'salary_route' | 'payment_type' | 'payment_frequency'
  | 'currency_code' | 'fulltime_amount' | 'parttime_amount' | 'hourly_rate'
  | 'salary_structure_id' | 'salary_scale_id' | 'salary_scale_step_id' | 'salary_step_code'
  | 'cao_scale_name' | 'cao_step_name' | 'salary_band_id'
  | 'valid_from' | 'valid_until' | 'updated_at'
>

export type PayrollSourceSchedule = Pick<ScheduleRow,
  | 'id' | 'average_days_per_week' | 'average_hours_per_week' | 'fulltime_hours_per_week'
  | 'part_time_factor' | 'schedule_type' | 'is_on_call' | 'valid_from' | 'valid_until' | 'updated_at'
>

export type PayrollSourceContract = {
  readonly id: string
  readonly labor_condition_set_id: string
  readonly fulltime_hours_per_week: number
  readonly starts_on: string
  readonly ends_on: string | null
  readonly updated_at: string
}

export type PayrollSourceLaborCondition = {
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
}

export type PayrollSourceOrganization = {
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
}

export type PayrollSourceIncomeRelationship = {
  readonly id: string
  readonly incomeRelationshipId: string
  readonly validFrom: string
  readonly validUntil: string | null
  readonly linkUpdatedAt: string
  readonly reportingStatus: 'DRAFT' | 'READY' | 'REPORTED' | 'CLOSED'
  readonly startsOn: string
  readonly endsOn: string | null
  readonly incomeRelationshipUpdatedAt: string
}

export type PayrollSourceTaxProfileProjection = EmploymentPayrollTaxSourceProjection

export interface PayrollSourceTimeline {
  readonly employment: PayrollSourceEmployment
  readonly salaries: readonly PayrollSourceSalary[]
  readonly schedules: readonly PayrollSourceSchedule[]
  readonly incomeRelationships?: readonly PayrollSourceIncomeRelationship[]
  readonly taxProfileProjection?: PayrollSourceTaxProfileProjection
  readonly contracts?: readonly PayrollSourceContract[]
  readonly laborConditions?: readonly PayrollSourceLaborCondition[]
  readonly organizations?: readonly PayrollSourceOrganization[]
  readonly pensionAssignments?: EmploymentPayrollSourceProjection['pensionAssignments']
  readonly laborConditionPensionArrangements?: EmploymentPayrollSourceProjection['laborConditionPensionArrangements']
}

export interface PayrollSourceProviderDependencies {
  readonly authorize: (employeeId: string) => Promise<Pick<AuthContext, 'tenantId' | 'hrGroupId' | 'administrationId'>>
  readonly listEmployments: (employeeId: string) => Promise<readonly PayrollSourceEmployment[]>
  readonly loadTimeline: (
    employeeId: string,
    employmentId: string,
    payrollPeriod: PayrollSourceProviderInput['payrollPeriod'],
  ) => Promise<PayrollSourceTimeline>
  readonly loadActualWork: (employeeId: string, employmentId: string, month: string) => Promise<ActualWorkPayrollProjection>
  readonly isEnabled: () => boolean
  readonly now?: () => Date
  readonly createId?: () => string
}

export type PayrollSourceProviderErrorCode =
  | 'PAYROLL_SOURCE_INPUT_INVALID'
  | 'PAYROLL_SOURCE_SCOPE_FORBIDDEN'
  | 'PAYROLL_SOURCE_EMPLOYMENT_NOT_FOUND'
  | 'PAYROLL_SOURCE_EMPLOYMENT_AMBIGUOUS'
  | 'PAYROLL_SOURCE_DISABLED'
  | 'PAYROLL_SOURCE_DATA_UNAVAILABLE'

export class PayrollSourceProviderError extends Error {
  constructor(readonly code: PayrollSourceProviderErrorCode, readonly status: 400 | 403 | 404 | 409 | 503) {
    super(code)
    this.name = 'PayrollSourceProviderError'
  }
}

function defaultDependencies(): PayrollSourceProviderDependencies {
  return {
    authorize: async (employeeId) => {
      const salaryContext = await requirePermission('salary:read', employeeId)
      await requirePermission('contract:read', employeeId)
      await requirePermission('leave:read', employeeId)
      await requirePermission('organization-placement:read', employeeId)
      await requirePermission('job-catalog:read', employeeId)
      return salaryContext
    },
    listEmployments: async (employeeId) => await listEmployeeEmployments(employeeId),
    isEnabled: isPayrollLabEnabled,
    loadTimeline: async (employeeId, employmentId, payrollPeriod) => {
      const [source, incomeRelationships, taxProfileProjection] = await Promise.all([
        getEmploymentPayrollSourceProjection(employeeId, employmentId, payrollPeriod),
        getEmploymentIncomeRelationshipProjection(employeeId, employmentId),
        getEmploymentPayrollTaxSourceProjection(employeeId, employmentId, payrollPeriod),
      ])
      return {
        employment: source.employment,
        salaries: source.salaries,
        schedules: source.schedules,
        contracts: source.contracts,
        laborConditions: source.laborConditions,
        organizations: source.organizations,
        pensionAssignments: source.pensionAssignments,
        laborConditionPensionArrangements: source.laborConditionPensionArrangements,
        incomeRelationships,
        taxProfileProjection,
      }
    },
    loadActualWork: async (employeeId, employmentId, month) =>
      await getActualWorkPayrollProjection({ employeeId, employmentId, month }),
  }
}

type PayrollSourceActualWorkType = ActualWorkPayrollProjection['types'][number]

function actualWorkForPeriod(
  projection: ActualWorkPayrollProjection,
  periodStart: string,
  periodEndExclusive: string,
): {
  readonly canonicalSource: PayrollSourceSnapshot['canonicalSource']
  readonly sourceVersionVector: Readonly<Record<string, string>>
  readonly sourceGaps: readonly PayrollSourceGap[]
} {
  const typeById = new Map<string, PayrollSourceActualWorkType>(projection.types.map((type) => [type.id, type]))
  const entries = [...projection.entries].sort((left, right) =>
    left.work_date.localeCompare(right.work_date) || left.id.localeCompare(right.id),
  )
  const gaps: PayrollSourceGap[] = []
  const versionVector: Record<string, string> = {}
  if (projection.period) versionVector[`actual_work_period:${projection.period.id}`] = projection.period.updated_at
  if (projection.entries.length > 2000) gaps.push(makeGap('actualWork', 'UNSUPPORTED', 'ACTUAL_WORK_TIMELINE_LIMIT_REACHED'))

  const mappedEntries = entries.map((entry) => {
    const type = typeById.get(entry.work_hour_type_id)
    if (!type) {
      gaps.push(makeGap('actualWork', 'UNSUPPORTED', 'ACTUAL_WORK_TYPE_NOT_FOUND'))
      versionVector[`actual_work_entry:${entry.id}`] = entry.updated_at
      return {
        id: entry.id,
        workHourTypeId: entry.work_hour_type_id,
        family: 'UNKNOWN',
        workDate: entry.work_date,
        subjectPeriodStart: entry.subject_period_start,
        subjectPeriodEnd: entry.subject_period_end,
        postingPeriodStart: entry.posting_period_start,
        entryGranularity: entry.entry_granularity,
        hours: entry.hours.toFixed(4),
        status: entry.status,
        approvedAt: entry.approved_at,
      }
    }

    versionVector[`work_hour_type:${type.id}`] = type.updated_at
    versionVector[`actual_work_entry:${entry.id}`] = entry.updated_at
    if (type.valid_from > entry.work_date || (type.valid_until !== null && type.valid_until <= entry.work_date)) {
      gaps.push(makeGap('actualWork', 'UNSUPPORTED', 'ACTUAL_WORK_TYPE_NOT_EFFECTIVE_ON_WORK_DATE'))
    }
    if (entry.status === 'APPROVED' && entry.approved_at === null) {
      gaps.push(makeGap('actualWork', 'UNSUPPORTED', 'APPROVED_ACTUAL_WORK_MISSING_APPROVAL_TIMESTAMP'))
    }
    if (entry.status === 'PENDING' && type.family !== 'TRANSPARENT') {
      gaps.push(makeGap('actualWork', 'SOURCE_GAP', 'PAYABLE_ACTUAL_WORK_NOT_APPROVED'))
    }
    if (entry.status === 'APPROVED' && type.family === 'OVERTIME') {
      gaps.push(makeGap('actualWork', 'UNSUPPORTED', 'OVERTIME_RULE_NOT_CONFIGURED'))
    }
    if (entry.posting_period_start !== periodStart
      || entry.subject_period_start >= periodEndExclusive
      || entry.subject_period_end <= entry.subject_period_start) {
      gaps.push(makeGap('actualWork', 'UNSUPPORTED', 'ACTUAL_WORK_PERIOD_MAPPING_INVALID'))
    }
    return {
      id: entry.id,
      workHourTypeId: type.id,
      family: type.family,
      workDate: entry.work_date,
      subjectPeriodStart: entry.subject_period_start,
      subjectPeriodEnd: entry.subject_period_end,
      postingPeriodStart: entry.posting_period_start,
      entryGranularity: entry.entry_granularity,
      hours: entry.hours.toFixed(4),
      status: entry.status,
      approvedAt: entry.approved_at,
      typeValidFrom: type.valid_from,
      typeValidUntil: type.valid_until,
      approvalRequired: type.approval_required,
    }
  })

  if (projection.entries.length > 0 && !projection.period) {
    gaps.push(makeGap('actualWork', 'SOURCE_GAP', 'ACTUAL_WORK_PERIOD_NOT_FOUND'))
  }
  if (projection.period && (projection.period.period_start !== periodStart || projection.period.period_end !== periodEndExclusive)) {
    gaps.push(makeGap('actualWork', 'UNSUPPORTED', 'ACTUAL_WORK_PERIOD_RANGE_MISMATCH'))
  }

  const period = projection.period
    ? {
      id: projection.period.id,
      startsOn: projection.period.period_start,
      endsOn: projection.period.period_end,
      status: projection.period.status,
      updatedAt: projection.period.updated_at,
    }
    : { status: 'NOT_CONFIGURED' }
  return {
    canonicalSource: { period, entries: mappedEntries },
    sourceVersionVector: versionVector,
    sourceGaps: gaps,
  }
}

function periodBounds(period: PayrollSourceProviderInput['payrollPeriod']): { start: string; endInclusive: string; endExclusive: string } {
  const start = `${period.year}-${String(period.month).padStart(2, '0')}-01`
  const endInclusive = new Date(Date.UTC(period.year, period.month, 0)).toISOString().slice(0, 10)
  return { start, endInclusive, endExclusive: dayAfter(endInclusive) }
}

function employmentOverlapsPeriod(startsOn: string, endsOn: string | null, start: string, endInclusive: string): boolean {
  return startsOn <= endInclusive && (endsOn === null || endsOn >= start)
}

function effectiveRangeOverlapsPeriod(validFrom: string, validUntil: string | null, start: string, endExclusive: string): boolean {
  return validFrom < endExclusive && (validUntil === null || validUntil > start)
}

function sortTimeline<T extends { readonly valid_from: string; readonly id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => left.valid_from.localeCompare(right.valid_from) || left.id.localeCompare(right.id))
}

function dayAfter(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10)
}

function dayBefore(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10)
}

function laterDate(current: string | null, candidate: string): string {
  return current === null || candidate > current ? candidate : current
}

function timelineCoverage(
  rows: readonly { readonly valid_from: string; readonly valid_until: string | null }[],
  requiredStart: string,
  requiredEndExclusive: string,
): 'COMPLETE' | 'GAP' | 'OVERLAP' {
  let previousEnd: string | null = null
  for (const row of rows) {
    const rowStart = row.valid_from < requiredStart ? requiredStart : row.valid_from
    const rawEnd = row.valid_until ?? requiredEndExclusive
    const rowEnd = rawEnd > requiredEndExclusive ? requiredEndExclusive : rawEnd
    if (rowStart < rowEnd && previousEnd !== null && rowStart < previousEnd) return 'OVERLAP'
    if (rowStart < rowEnd) previousEnd = laterDate(previousEnd, rowEnd)
  }

  let nextRequiredDate = requiredStart
  for (const row of rows) {
    const rowStart = row.valid_from < requiredStart ? requiredStart : row.valid_from
    const rawEnd = row.valid_until ?? requiredEndExclusive
    const rowEnd = rawEnd > requiredEndExclusive ? requiredEndExclusive : rawEnd
    if (rowEnd <= nextRequiredDate) continue
    if (rowStart > nextRequiredDate) return 'GAP'
    if (rowStart < nextRequiredDate) return 'OVERLAP'
    if (rowEnd >= requiredEndExclusive) return 'COMPLETE'
    nextRequiredDate = rowEnd
  }
  return 'GAP'
}

function makeGap(field: string, status: PayrollSourceGap['status'], reasonCode: string): PayrollSourceGap {
  return { field, status, reasonCode }
}

type TaxProfileSlice = {
  readonly profile: PayrollSourceTaxProfileProjection['taxProfiles'][number]
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
}

type PayrollTaxCanonicalProfile = {
  readonly status: 'CONFIRMED' | 'SOURCE_GAP' | 'UNSUPPORTED'
  readonly reasonCode?: string
  readonly reasonCodes?: readonly string[]
  readonly id?: string
  readonly incomeRelationshipId?: string
  readonly effectiveFrom?: string
  readonly effectiveTo?: string | null
  readonly versionNumber?: number
  readonly supersedesProfileId?: string | null
  readonly residenceCountryCode?: string
  readonly wageTaxTable?: string
  readonly herleiding?: string
  readonly timePeriod?: string
  readonly regularWageOnly?: boolean
  readonly fullPeriodOnly?: boolean
  readonly hasSpecialSituation?: boolean
  readonly payrollTaxCreditApplies?: boolean
  readonly sourceClassification?: string
  readonly sourceReferenceHash?: string
  readonly confirmedByUserId?: string
  readonly confirmedAt?: string
  readonly createdAt?: string
  readonly ageCategory?: string | null
  readonly activeIncomeRelationshipCount?: number
}

function taxProfileSlices(profiles: PayrollSourceTaxProfileProjection['taxProfiles']): TaxProfileSlice[] {
  const byScope = new Map<string, typeof profiles[number][]>()
  for (const profile of profiles) {
    const scopeKey = `${profile.employment_id}:${profile.income_relationship_id}`
    const rows = byScope.get(scopeKey) ?? []
    rows.push(profile)
    byScope.set(scopeKey, rows)
  }
  const slices: TaxProfileSlice[] = []
  for (const rows of byScope.values()) {
    const sorted = [...rows].sort((left, right) =>
      left.effective_from.localeCompare(right.effective_from)
      || left.version_number - right.version_number
      || left.id.localeCompare(right.id),
    )
    const latestByStart = new Map<string, typeof sorted[number]>()
    for (const row of sorted) latestByStart.set(row.effective_from, row)
    const effectiveRows = [...latestByStart.values()].sort((left, right) => left.effective_from.localeCompare(right.effective_from))
    effectiveRows.forEach((profile, index) => {
      const next = effectiveRows[index + 1]
      const successorEnd = next ? dayBefore(next.effective_from) : null
      const explicitEnd = profile.effective_to
      const effectiveTo = explicitEnd === null
        ? successorEnd
        : successorEnd === null || explicitEnd < successorEnd ? explicitEnd : successorEnd
      slices.push({ profile, effectiveFrom: profile.effective_from, effectiveTo })
    })
  }
  return slices.sort((left, right) =>
    left.effectiveFrom.localeCompare(right.effectiveFrom)
    || left.profile.id.localeCompare(right.profile.id),
  )
}

function resolvePayrollTaxProfile(
  projection: PayrollSourceTaxProfileProjection | undefined,
  employmentId: string,
  incomeRelationshipId: string | null,
  employmentIncomeRelationshipId: string | null,
  periodStart: string,
  periodEndExclusive: string,
): {
  readonly canonical: PayrollTaxCanonicalProfile
  readonly sourceGaps: readonly PayrollSourceGap[]
  readonly sourceVersionVector: Readonly<Record<string, string>>
} {
  const sourceGaps: PayrollSourceGap[] = []
  const sourceVersionVector: Record<string, string> = {}
  if (!projection) {
    return {
      canonical: { status: 'SOURCE_GAP', reasonCode: 'CORE_FISCAL_PROFILE_SOURCE_UNAVAILABLE' },
      sourceGaps: [makeGap('taxProfile', 'SOURCE_GAP', 'CORE_FISCAL_PROFILE_SOURCE_UNAVAILABLE')],
      sourceVersionVector,
    }
  }
  if (!projection.ageCategory) {
    sourceGaps.push(makeGap('taxProfile', 'SOURCE_GAP', 'EMPLOYEE_BIRTH_DATE_REQUIRED_FOR_TAX_CLASSIFICATION'))
  } else if (projection.ageCategory !== 'UNDER_AOW') {
    sourceGaps.push(makeGap('taxProfile', 'UNSUPPORTED', 'NL_2026_RULES_REQUIRE_UNDER_AOW_AGE'))
  }
  sourceVersionVector.employee_tax_classification = `${projection.ageCategory ?? 'MISSING'}:${projection.ageSourceUpdatedAt ?? 'MISSING'}`
  for (const relationship of projection.incomeRelationships) {
    sourceVersionVector[`income_relationship:${relationship.id}`] = relationship.updatedAt
  }
  const slices = taxProfileSlices(projection.taxProfiles)
  for (const slice of slices) {
    const { profile } = slice
    sourceVersionVector[`employment_payroll_tax_profile:${profile.id}`] = `${profile.version_number}:${profile.created_at}`
  }

  if (projection.incomeRelationshipLinkGap) {
    sourceGaps.push(makeGap('incomeRelationship', 'SOURCE_GAP', 'ACTIVE_IKV_LINK_MISSING_OR_AMBIGUOUS'))
  } else if (projection.activeIncomeRelationshipCount !== 1) {
    sourceGaps.push(makeGap(
      'incomeRelationship',
      projection.activeIncomeRelationshipCount > 1 ? 'UNSUPPORTED' : 'SOURCE_GAP',
      projection.activeIncomeRelationshipCount > 1 ? 'MULTIPLE_ACTIVE_IKV_UNSUPPORTED' : 'NO_ACTIVE_IKV_FOR_FULL_PERIOD',
    ))
  }

  if (!incomeRelationshipId || !employmentIncomeRelationshipId) {
    sourceGaps.push(makeGap('taxProfile', 'SOURCE_GAP', 'TAX_PROFILE_REQUIRES_LINKED_IKV'))
    return {
      canonical: { status: sourceGaps.some((gap) => gap.status === 'UNSUPPORTED') ? 'UNSUPPORTED' : 'SOURCE_GAP', reasonCodes: sourceGaps.map((gap) => gap.reasonCode) },
      sourceGaps,
      sourceVersionVector,
    }
  }

  const periodEnd = dayBefore(periodEndExclusive)
  const matching = slices.filter((slice) => slice.profile.employment_id === employmentId
    && slice.profile.income_relationship_id === incomeRelationshipId)
  const covering = matching.filter((slice) => slice.effectiveFrom <= periodStart
    && (slice.effectiveTo === null || slice.effectiveTo >= periodEnd))
  const overlapping = matching.filter((slice) => effectiveRangeOverlapsPeriod(
    slice.effectiveFrom,
    slice.effectiveTo === null ? null : dayAfter(slice.effectiveTo),
    periodStart,
    periodEndExclusive,
  ))
  let selected: TaxProfileSlice | null = null
  if (covering.length === 1) selected = covering[0] ?? null
  else if (covering.length > 1) {
    sourceGaps.push(makeGap('taxProfile', 'UNSUPPORTED', 'FISCAL_PROFILE_CONFLICT'))
  } else if (overlapping.length > 0) {
    sourceGaps.push(makeGap('taxProfile', 'UNSUPPORTED', 'FISCAL_PROFILE_CHANGES_WITHIN_PERIOD'))
  } else {
    sourceGaps.push(makeGap('taxProfile', 'SOURCE_GAP', matching.length === 0
      ? 'NO_CONFIRMED_FISCAL_PROFILE'
      : 'FISCAL_PROFILE_NOT_EFFECTIVE_FOR_FULL_PERIOD'))
  }

  const activeCreditClaims = slices.filter((slice) => slice.profile.payroll_tax_credit_applies
    && slice.profile.income_relationship_id !== incomeRelationshipId
    && slice.effectiveFrom <= periodEnd
    && (slice.effectiveTo === null || slice.effectiveTo >= periodStart))
  if (activeCreditClaims.length > 0) {
    sourceGaps.push(makeGap('taxProfile', 'UNSUPPORTED', 'PAYROLL_TAX_CREDIT_ALREADY_APPLIES_TO_OTHER_IKV'))
  }

  if (!selected) {
    const unsupported = sourceGaps.some((gap) => gap.status === 'UNSUPPORTED')
    return {
      canonical: { status: unsupported ? 'UNSUPPORTED' : 'SOURCE_GAP', reasonCodes: sourceGaps.map((gap) => gap.reasonCode) },
      sourceGaps,
      sourceVersionVector,
    }
  }

  const profile = selected.profile
  if (profile.employment_income_relationship_id !== employmentIncomeRelationshipId) {
    sourceGaps.push(makeGap('taxProfile', 'UNSUPPORTED', 'FISCAL_PROFILE_IKV_LINK_SOURCE_MISMATCH'))
  }
  const supportedCombination = profile.residence_country_code === 'NL'
    && profile.wage_tax_table === 'WHITE'
    && profile.herleiding_code === 'STD'
    && profile.time_period === 'MONTH'
    && profile.regular_wage_only
    && profile.full_period_only
    && !profile.has_special_situation
    && profile.source_classification === 'EMPLOYEE_DECLARATION'
    && projection.ageCategory === 'UNDER_AOW'
  if (!supportedCombination) sourceGaps.push(makeGap('taxProfile', 'UNSUPPORTED', 'FISCAL_PROFILE_COMBINATION_UNSUPPORTED'))

  return {
    canonical: {
      status: supportedCombination && !sourceGaps.some((gap) => gap.field === 'taxProfile' || gap.field === 'incomeRelationship')
        ? 'CONFIRMED'
        : 'UNSUPPORTED',
      id: profile.id,
      incomeRelationshipId: profile.income_relationship_id,
      effectiveFrom: selected.effectiveFrom,
      effectiveTo: selected.effectiveTo,
      versionNumber: profile.version_number,
      supersedesProfileId: profile.supersedes_profile_id,
      residenceCountryCode: profile.residence_country_code,
      wageTaxTable: profile.wage_tax_table,
      herleiding: profile.herleiding_code,
      timePeriod: profile.time_period,
      regularWageOnly: profile.regular_wage_only,
      fullPeriodOnly: profile.full_period_only,
      hasSpecialSituation: profile.has_special_situation,
      payrollTaxCreditApplies: profile.payroll_tax_credit_applies,
      sourceClassification: profile.source_classification,
      sourceReferenceHash: createHash('sha256').update(profile.source_reference, 'utf8').digest('hex').slice(0, 24),
      confirmedByUserId: profile.confirmed_by_user_id,
      confirmedAt: profile.confirmed_at,
      createdAt: profile.created_at,
      ageCategory: projection.ageCategory,
      activeIncomeRelationshipCount: projection.activeIncomeRelationshipCount,
    },
    sourceGaps,
    sourceVersionVector,
  }
}

function sourceGapsFor(
  salaryRows: readonly PayrollSourceSalary[],
  scheduleRows: readonly PayrollSourceSchedule[],
  contractRows: readonly PayrollSourceContract[],
  laborConditionRows: readonly PayrollSourceLaborCondition[],
  incomeRelationshipGap: PayrollSourceGap | null,
  taxProfileGaps: readonly PayrollSourceGap[],
  coverageStart: string,
  coverageEnd: string,
): PayrollSourceGap[] {
  const gaps: PayrollSourceGap[] = [...taxProfileGaps]
  if (incomeRelationshipGap) gaps.push(incomeRelationshipGap)

  const salaryCoverage = timelineCoverage(salaryRows, coverageStart, coverageEnd)
  if (salaryCoverage !== 'COMPLETE') {
    gaps.push(makeGap(
      'contractualSalary',
      salaryCoverage === 'OVERLAP' ? 'UNSUPPORTED' : 'SOURCE_GAP',
      salaryRows.length === 0 ? 'NO_EFFECTIVE_SALARY_ROW' : `SALARY_TIMELINE_${salaryCoverage}`,
    ))
  }
  if (salaryRows.length >= 100) gaps.push(makeGap('contractualSalary', 'UNSUPPORTED', 'SOURCE_TIMELINE_LIMIT_REACHED'))

  const scheduleCoverage = timelineCoverage(scheduleRows, coverageStart, coverageEnd)
  if (scheduleCoverage !== 'COMPLETE') {
    gaps.push(makeGap(
      'contractualHours',
      scheduleCoverage === 'OVERLAP' ? 'UNSUPPORTED' : 'SOURCE_GAP',
      scheduleRows.length === 0 ? 'NO_EFFECTIVE_SCHEDULE_ROW' : `SCHEDULE_TIMELINE_${scheduleCoverage}`,
    ))
  }
  if (scheduleRows.length >= 100) gaps.push(makeGap('contractualHours', 'UNSUPPORTED', 'SOURCE_TIMELINE_LIMIT_REACHED'))

  const contractTimeline = contractRows.map((row) => ({
    valid_from: row.starts_on,
    valid_until: row.ends_on === null ? null : dayAfter(row.ends_on),
  }))
  const contractCoverage = timelineCoverage(contractTimeline, coverageStart, coverageEnd)
  if (contractCoverage !== 'COMPLETE') {
    gaps.push(makeGap('contract', contractCoverage === 'OVERLAP' ? 'UNSUPPORTED' : 'SOURCE_GAP',
      contractRows.length === 0 ? 'NO_EFFECTIVE_CONTRACT' : `CONTRACT_TIMELINE_${contractCoverage}`))
  }
  if (contractRows.length > 1) gaps.push(makeGap('contract', 'UNSUPPORTED', 'CONTRACT_CHANGES_WITHIN_PERIOD'))

  const laborCoverage = timelineCoverage(laborConditionRows, coverageStart, coverageEnd)
  if (laborCoverage !== 'COMPLETE') {
    gaps.push(makeGap('laborCondition', laborCoverage === 'OVERLAP' ? 'UNSUPPORTED' : 'SOURCE_GAP',
      laborConditionRows.length === 0 ? 'NO_EFFECTIVE_LABOR_CONDITION' : `LABOR_CONDITION_TIMELINE_${laborCoverage}`))
  }
  if (laborConditionRows.length > 1) gaps.push(makeGap('laborCondition', 'UNSUPPORTED', 'LABOR_CONDITION_CHANGES_WITHIN_PERIOD'))
  const conditionSet = laborConditionRows[0]?.set
  if (laborConditionRows.length === 1 && (!conditionSet || !conditionSet.is_active
    || conditionSet.valid_from > coverageStart)) {
    gaps.push(makeGap('laborCondition', 'SOURCE_GAP', 'EFFECTIVE_LABOR_CONDITION_SET_UNAVAILABLE'))
  }

  return gaps
}

function payrollMoneySource(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null
  try {
    const amount = FixedDecimal.parse(String(value))
    if (amount.scale > 2 || amount.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0) return null
    return amount.toString(2)
  } catch {
    return null
  }
}

function regularWageInput(
  salaries: readonly PayrollSourceSalary[],
  schedules: readonly PayrollSourceSchedule[],
  period: PayrollSourceProviderInput['payrollPeriod'],
  start: string,
  endExclusive: string,
  incomeRelationshipId: string | null,
  fiscalProfile: PayrollTaxCanonicalProfile,
): Record<string, string | boolean> | null {
  if (salaries.length !== 1 || schedules.length !== 1
    || incomeRelationshipId === null || fiscalProfile.status !== 'CONFIRMED') return null
  if (typeof fiscalProfile.wageTaxTable !== 'string'
    || typeof fiscalProfile.residenceCountryCode !== 'string'
    || typeof fiscalProfile.ageCategory !== 'string'
    || typeof fiscalProfile.herleiding !== 'string'
    || typeof fiscalProfile.timePeriod !== 'string'
    || typeof fiscalProfile.payrollTaxCreditApplies !== 'boolean'
    || typeof fiscalProfile.hasSpecialSituation !== 'boolean'
    || typeof fiscalProfile.activeIncomeRelationshipCount !== 'number') return null
  const salary = salaries[0]
  const schedule = schedules[0]
  if (!salary || !schedule
    || salary.valid_from > start || (salary.valid_until !== null && salary.valid_until < endExclusive)
    || schedule.valid_from > start || (schedule.valid_until !== null && schedule.valid_until < endExclusive)) return null
  const grossAmount = payrollMoneySource(salary.parttime_amount)
  if (!grossAmount) return null
  return {
    fiscalYear: String(period.year),
    table: fiscalProfile.wageTaxTable,
    residence: fiscalProfile.residenceCountryCode,
    ageCategory: fiscalProfile.ageCategory,
    herleiding: fiscalProfile.herleiding,
    timePeriod: fiscalProfile.timePeriod,
    payrollTaxCredit: fiscalProfile.payrollTaxCreditApplies,
    regularWage: true,
    fullPeriod: true,
    hasSpecialSituation: fiscalProfile.hasSpecialSituation,
    incomeRelationshipCount: String(fiscalProfile.activeIncomeRelationshipCount),
    grossAmount,
  }
}

function resolveIncomeRelationship(
  rows: readonly PayrollSourceIncomeRelationship[],
  coverageStart: string,
  coverageEndExclusive: string,
  coverageEndInclusive: string,
): { readonly selected: PayrollSourceIncomeRelationship | null; readonly gap: PayrollSourceGap | null } {
  const overlapping = rows
    .filter((row) => effectiveRangeOverlapsPeriod(row.validFrom, row.validUntil, coverageStart, coverageEndExclusive))
    .sort((left, right) => left.validFrom.localeCompare(right.validFrom) || left.id.localeCompare(right.id))

  if (overlapping.length === 0) {
    return { selected: null, gap: makeGap('incomeRelationship', 'SOURCE_GAP', 'NO_LINKED_INCOME_RELATIONSHIP') }
  }
  if (overlapping.length > 1) {
    return { selected: null, gap: makeGap('incomeRelationship', 'UNSUPPORTED', 'INCOME_RELATIONSHIP_AMBIGUOUS') }
  }

  const selected = overlapping[0]
  if (!selected) {
    return { selected: null, gap: makeGap('incomeRelationship', 'SOURCE_GAP', 'NO_LINKED_INCOME_RELATIONSHIP') }
  }
  if (
    selected.validFrom > coverageStart
    || (selected.validUntil !== null && selected.validUntil < coverageEndExclusive)
    || selected.startsOn > coverageStart
    || (selected.endsOn !== null && selected.endsOn < coverageEndInclusive)
  ) {
    return { selected, gap: makeGap('incomeRelationship', 'SOURCE_GAP', 'INCOME_RELATIONSHIP_TIMELINE_GAP') }
  }
  if (selected.reportingStatus === 'DRAFT') {
    return { selected, gap: makeGap('incomeRelationship', 'UNSUPPORTED', 'CONTROL02_CONTRACT_PENDING') }
  }
  if (selected.reportingStatus !== 'READY' && selected.reportingStatus !== 'REPORTED') {
    return { selected, gap: makeGap('incomeRelationship', 'UNSUPPORTED', 'INCOME_RELATIONSHIP_NOT_PAYROLL_ACTIVE') }
  }
  return { selected, gap: null }
}

export class LiquidHrPayrollSourceProvider implements PayrollSourceProvider {
  private readonly dependencies: PayrollSourceProviderDependencies

  constructor(dependencies: PayrollSourceProviderDependencies = defaultDependencies()) {
    this.dependencies = dependencies
  }

  async getPayrollSourceSnapshot(rawInput: PayrollSourceProviderInput): Promise<PayrollSourceSnapshot> {
    const parsedInput = payrollSourceProviderInputSchema.safeParse(rawInput)
    if (!parsedInput.success) throw new PayrollSourceProviderError('PAYROLL_SOURCE_INPUT_INVALID', 400)
    const input = parsedInput.data
    if (!this.dependencies.isEnabled()) throw new PayrollSourceProviderError('PAYROLL_SOURCE_DISABLED', 503)

    const context = await this.dependencies.authorize(input.employeeId)
    const authorizedScope = payrollScopeFromAuthContext(context)
    if (
      !authorizedScope
      || authorizedScope.tenantId !== input.tenantId
      || authorizedScope.hrGroupId !== input.hrGroupId
      || authorizedScope.administrationId !== input.administrationId
    ) {
      throw new PayrollSourceProviderError('PAYROLL_SOURCE_SCOPE_FORBIDDEN', 403)
    }

    let employments: readonly PayrollSourceEmployment[]
    try {
      employments = await this.dependencies.listEmployments(input.employeeId)
    } catch {
      throw new PayrollSourceProviderError('PAYROLL_SOURCE_DATA_UNAVAILABLE', 503)
    }

    const bounds = periodBounds(input.payrollPeriod)
    const candidates = employments.filter((employment) =>
      employment.tenant_id === input.tenantId
      && employment.hr_group_id === input.hrGroupId
      && employment.administration_id === input.administrationId
      && employment.employee_id === input.employeeId
      && (input.employmentId === undefined || employment.id === input.employmentId)
      && employment.deleted_at === null
      && employment.record_status === 'CONFIRMED'
      && employmentOverlapsPeriod(employment.starts_on, employment.ends_on, bounds.start, bounds.endInclusive),
    )
    if (candidates.length === 0) throw new PayrollSourceProviderError('PAYROLL_SOURCE_EMPLOYMENT_NOT_FOUND', 404)
    if (candidates.length > 1) throw new PayrollSourceProviderError('PAYROLL_SOURCE_EMPLOYMENT_AMBIGUOUS', 409)
    const employment = candidates[0]
    if (!employment) throw new PayrollSourceProviderError('PAYROLL_SOURCE_EMPLOYMENT_NOT_FOUND', 404)

    let timeline: PayrollSourceTimeline
    let actualWork: ActualWorkPayrollProjection
    try {
      [timeline, actualWork] = await Promise.all([
        this.dependencies.loadTimeline(input.employeeId, employment.id, input.payrollPeriod),
        this.dependencies.loadActualWork(input.employeeId, employment.id, `${input.payrollPeriod.year}-${String(input.payrollPeriod.month).padStart(2, '0')}`),
      ])
    } catch {
      throw new PayrollSourceProviderError('PAYROLL_SOURCE_DATA_UNAVAILABLE', 503)
    }
    if (
      timeline.employment.id !== employment.id
      || timeline.employment.tenant_id !== input.tenantId
      || timeline.employment.hr_group_id !== input.hrGroupId
      || timeline.employment.administration_id !== input.administrationId
      || timeline.employment.employee_id !== input.employeeId
      || timeline.employment.deleted_at !== null
      || timeline.employment.record_status !== 'CONFIRMED'
    ) {
      throw new PayrollSourceProviderError('PAYROLL_SOURCE_SCOPE_FORBIDDEN', 403)
    }

    const activeStart = employment.starts_on > bounds.start ? employment.starts_on : bounds.start
    const employmentEndExclusive = employment.ends_on === null ? bounds.endExclusive : dayAfter(employment.ends_on)
    const activeEndExclusive = employmentEndExclusive < bounds.endExclusive ? employmentEndExclusive : bounds.endExclusive
    const salaries = sortTimeline(timeline.salaries.filter((row) => effectiveRangeOverlapsPeriod(row.valid_from, row.valid_until, activeStart, activeEndExclusive)))
    const schedules = sortTimeline(timeline.schedules.filter((row) => effectiveRangeOverlapsPeriod(row.valid_from, row.valid_until, activeStart, activeEndExclusive)))
    const contracts = [...(timeline.contracts ?? [])]
      .filter((row) => row.starts_on < activeEndExclusive && (row.ends_on === null || dayAfter(row.ends_on) > activeStart))
      .sort((left, right) => left.starts_on.localeCompare(right.starts_on) || left.id.localeCompare(right.id))
    const laborConditions = sortTimeline((timeline.laborConditions ?? [])
      .filter((row) => effectiveRangeOverlapsPeriod(row.valid_from, row.valid_until, activeStart, activeEndExclusive)))
    const organizations = [...(timeline.organizations ?? [])]
      .filter((row) => row.effective_from < activeEndExclusive && (row.effective_to === null || dayAfter(row.effective_to) > activeStart))
      .sort((left, right) => left.effective_from.localeCompare(right.effective_from) || left.id.localeCompare(right.id))
    const pensionAssignments = [...(timeline.pensionAssignments ?? [])]
      .filter((row) => effectiveRangeOverlapsPeriod(row.effective_from, row.effective_to, activeStart, activeEndExclusive))
      .sort((left, right) => left.effective_from.localeCompare(right.effective_from) || left.id.localeCompare(right.id))
    const activeLaborConditionSetIds = new Set(laborConditions.flatMap((row) =>
      row.labor_condition_set_id ? [row.labor_condition_set_id] : [],
    ))
    const laborConditionPensionArrangements = [...(timeline.laborConditionPensionArrangements ?? [])]
      .filter((row) => activeLaborConditionSetIds.has(row.labor_condition_set_id)
        && effectiveRangeOverlapsPeriod(row.effective_from, row.effective_to, activeStart, activeEndExclusive))
      .sort((left, right) => left.effective_from.localeCompare(right.effective_from) || left.id.localeCompare(right.id))
    const incomeRelationship = resolveIncomeRelationship(
      timeline.incomeRelationships ?? [],
      activeStart,
      activeEndExclusive,
      dayBefore(activeEndExclusive),
    )
    const fiscalProfile = resolvePayrollTaxProfile(
      timeline.taxProfileProjection,
      employment.id,
      incomeRelationship.selected?.incomeRelationshipId ?? null,
      incomeRelationship.selected?.id ?? null,
      activeStart,
      activeEndExclusive,
    )
    const actualWorkSnapshot = actualWorkForPeriod(actualWork, bounds.start, bounds.endExclusive)
    const sourceGaps = [
      ...sourceGapsFor(
        salaries,
        schedules,
        contracts,
        laborConditions,
        incomeRelationship.gap,
        fiscalProfile.sourceGaps,
        activeStart,
        activeEndExclusive,
      ),
      ...actualWorkSnapshot.sourceGaps,
    ]
    if (activeStart !== bounds.start || activeEndExclusive !== bounds.endExclusive) {
      sourceGaps.push(makeGap('employment', 'UNSUPPORTED', 'PARTIAL_EMPLOYMENT_PERIOD_UNSUPPORTED'))
    }
    const regularWage = regularWageInput(
      salaries,
      schedules,
      input.payrollPeriod,
      activeStart,
      activeEndExclusive,
      incomeRelationship.selected?.incomeRelationshipId ?? null,
      fiscalProfile.canonical,
    )
    const sourceVersionVector = Object.fromEntries([
      [`employment:${employment.id}`, employment.updated_at],
      ...salaries.map((row) => [`employment_salary:${row.id}`, row.updated_at] as const),
      ...schedules.map((row) => [`employment_schedule:${row.id}`, row.updated_at] as const),
      ...contracts.map((row) => [`employment_contract:${row.id}`, row.updated_at] as const),
      ...laborConditions.flatMap((row) => [
        [`employment_labor_condition:${row.id}`, row.updated_at] as const,
        ...(row.set ? [[`labor_condition_set:${row.set.id}`, row.set.updated_at] as const] : []),
      ]),
      ...organizations.flatMap((row) => [
        [`employee_organization:${row.id}`, row.updated_at] as const,
        ...(row.job_id && row.job_revision_updated_at ? [[`job_revision:${row.job_id}:${row.job_revision_valid_from ?? ''}`, row.job_revision_updated_at] as const] : []),
      ]),
      ...pensionAssignments.flatMap((row) => [
        [`employment_pension_assignment:${row.id}`, `${row.version_number}:${row.updated_at}`] as const,
        ...(row.arrangement?.version_id
          ? [[`pension_arrangement_version:${row.arrangement.version_id}`, row.arrangement.version_created_at ?? ''] as const]
          : row.arrangement?.source_updated_at
            ? [[`pension_arrangement:${row.arrangement.id}`, row.arrangement.source_updated_at] as const]
            : []),
        ...(row.arrangement?.tiers.map((tier) => [
          `${row.arrangement?.version_id ? 'pension_arrangement_version_tier' : 'pension_arrangement_tier'}:${tier.id}`,
          tier.created_at,
        ] as const) ?? []),
        ...row.arrangement_resolution_change_version_ids.map((versionId) => [
          `pension_arrangement_version_change:${versionId}`,
          'EFFECTIVE_WITHIN_PERIOD',
        ] as const),
      ]),
      ...laborConditionPensionArrangements.flatMap((row) => [
        [`labor_condition_pension_arrangement:${row.id}`, `${row.version_number}:${row.effective_from}`] as const,
        ...(row.arrangement?.version_id
          ? [[`pension_arrangement_version:${row.arrangement.version_id}`, row.arrangement.version_created_at ?? ''] as const]
          : row.arrangement?.source_updated_at
            ? [[`pension_arrangement:${row.arrangement.id}`, row.arrangement.source_updated_at] as const]
            : []),
        ...(row.arrangement?.tiers.map((tier) => [
          `${row.arrangement?.version_id ? 'pension_arrangement_version_tier' : 'pension_arrangement_tier'}:${tier.id}`,
          tier.created_at,
        ] as const) ?? []),
        ...row.arrangement_resolution_change_version_ids.map((versionId) => [
          `pension_arrangement_version_change:${versionId}`,
          'EFFECTIVE_WITHIN_PERIOD',
        ] as const),
      ]),
      ...(incomeRelationship.selected ? [
        [`employment_income_relationship:${incomeRelationship.selected.id}`, incomeRelationship.selected.linkUpdatedAt] as const,
        [`income_relationship:${incomeRelationship.selected.incomeRelationshipId}`, incomeRelationship.selected.incomeRelationshipUpdatedAt] as const,
      ] : []),
      ...Object.entries(fiscalProfile.sourceVersionVector),
      ...Object.entries(actualWorkSnapshot.sourceVersionVector),
    ])

    const pensionArrangementCanonical = (
      arrangement: NonNullable<(typeof pensionAssignments)[number]['arrangement']>,
    ) => ({
      id: arrangement.id,
      versionId: arrangement.version_id,
      versionNumber: arrangement.version_number,
      code: arrangement.code,
      name: arrangement.name,
      arrangementType: arrangement.arrangement_type,
      effectiveFrom: arrangement.effective_from,
      arrangementEstablishedFrom: arrangement.arrangement_established_from,
      effectiveTo: arrangement.effective_to,
      transitionDate: arrangement.transition_date,
      grandfatheringMode: arrangement.grandfathering_mode,
      flatTotalRate: arrangement.flat_total_rate === null ? null : String(arrangement.flat_total_rate),
      employerSharePercent: String(arrangement.employer_share_pct),
      employeeSharePercent: String(arrangement.employee_share_pct),
      annualFranchise: String(arrangement.annual_franchise),
      annualPensionableSalaryCap: arrangement.annual_pensionable_salary_cap === null
        ? null : String(arrangement.annual_pensionable_salary_cap),
      pensionableSalaryDefinition: arrangement.pensionable_salary_definition,
      eligibilityRule: arrangement.eligibility_rule,
      contractClassification: arrangement.contract_classification,
      contractClassificationProvenance: arrangement.contract_classification_provenance,
      provenance: arrangement.provenance_json,
      isActive: arrangement.is_active,
      version: arrangement.version_id ?? arrangement.source_updated_at,
      tiers: arrangement.tiers.map((tier) => ({
        id: tier.id,
        minAge: tier.min_age,
        maxAge: tier.max_age,
        totalRate: String(tier.total_rate),
      })),
    })

    const canonicalSource = {
      schemaVersion: 'payroll-source-v4',
      employment: {
        startsOn: employment.starts_on,
        endsOn: employment.ends_on,
        originalHireDate: employment.original_hire_date,
        seniorityDate: employment.seniority_date,
        employmentType: employment.employment_type,
        contractType: employment.contract_type,
        recordStatus: employment.record_status,
      },
      contract: {
        entries: contracts.map((row) => ({
          id: row.id,
          laborConditionSetId: row.labor_condition_set_id,
          fulltimeHoursPerWeek: row.fulltime_hours_per_week,
          validFrom: row.starts_on,
          validUntil: row.ends_on === null ? null : dayAfter(row.ends_on),
        })),
      },
      laborConditions: {
        entries: laborConditions.map((row) => ({
          id: row.id,
          laborConditionSetId: row.labor_condition_set_id,
          conditionGroup: row.set?.name ?? null,
          set: row.set ? {
            id: row.set.id,
            code: row.set.code,
            name: row.set.name,
            standardHoursPerWeek: row.set.standard_hours_per_week,
            isActive: row.set.is_active,
            validFrom: row.set.valid_from,
          } : null,
          validFrom: row.valid_from,
          validUntil: row.valid_until,
        })),
      },
      organization: {
        entries: organizations.map((row) => ({
          id: row.id,
          departmentId: row.department_id,
          jobId: row.job_id,
          jobCode: row.job_code,
          jobTitle: row.job_title,
          jobRevisionValidFrom: row.job_revision_valid_from,
          jobRevisionValidUntil: row.job_revision_valid_until,
          validFrom: row.effective_from,
          validUntil: row.effective_to === null ? null : dayAfter(row.effective_to),
        })),
      },
      compensation: {
        entries: salaries.map((row) => ({
          id: row.id,
          salaryBasis: row.salary_basis,
          salaryRoute: row.salary_route,
          paymentType: row.payment_type,
          paymentFrequency: row.payment_frequency,
          currencyCode: row.currency_code,
          fulltimeAmount: row.fulltime_amount,
          parttimeAmount: row.parttime_amount,
          hourlyRate: row.hourly_rate,
          salaryStructureId: row.salary_structure_id,
          salaryScaleId: row.salary_scale_id,
          salaryScaleStepId: row.salary_scale_step_id,
          salaryStepCode: row.salary_step_code,
          caoScaleName: row.cao_scale_name,
          caoStepName: row.cao_step_name,
          salaryBandId: row.salary_band_id,
          validFrom: row.valid_from,
          validUntil: row.valid_until,
        })),
      },
      schedule: {
        entries: schedules.map((row) => ({
          id: row.id,
          averageDaysPerWeek: row.average_days_per_week,
          averageHoursPerWeek: row.average_hours_per_week,
          fulltimeHoursPerWeek: row.fulltime_hours_per_week,
          partTimeFactor: row.part_time_factor,
          scheduleType: row.schedule_type,
          isOnCall: row.is_on_call,
          validFrom: row.valid_from,
          validUntil: row.valid_until,
        })),
      },
      incomeRelationship: incomeRelationship.selected
        ? {
          id: incomeRelationship.selected.incomeRelationshipId,
          employmentIncomeRelationshipId: incomeRelationship.selected.id,
          reportingStatus: incomeRelationship.selected.reportingStatus,
          startsOn: incomeRelationship.selected.startsOn,
          endsOn: incomeRelationship.selected.endsOn,
          validFrom: incomeRelationship.selected.validFrom,
          validUntil: incomeRelationship.selected.validUntil,
          ...(incomeRelationship.gap
            ? { status: incomeRelationship.gap.status, reasonCode: incomeRelationship.gap.reasonCode }
            : { status: 'LINKED' }),
        }
        : {
          status: incomeRelationship.gap?.status ?? 'SOURCE_GAP',
          reasonCode: incomeRelationship.gap?.reasonCode ?? 'NO_LINKED_INCOME_RELATIONSHIP',
        },
      pension: {
        assignments: pensionAssignments.map((row) => ({
          id: row.id,
          pensionArrangementId: row.pension_arrangement_id,
          effectiveFrom: row.effective_from,
          effectiveTo: row.effective_to,
          participationStartDate: row.participation_start_date,
          assignmentVersion: row.version_number,
          supersedesAssignmentId: row.supersedes_assignment_id,
          assignmentReason: row.assignment_reason,
          provenance: row.provenance_json,
          ageForTier: row.age_for_tier,
          arrangement: row.arrangement ? pensionArrangementCanonical(row.arrangement) : null,
          arrangementResolutionReason: row.arrangement_resolution_reason,
          arrangementResolutionChangeVersionIds: row.arrangement_resolution_change_version_ids,
        })),
        laborConditionArrangements: laborConditionPensionArrangements.map((row) => ({
          id: row.id,
          laborConditionSetId: row.labor_condition_set_id,
          pensionArrangementId: row.pension_arrangement_id,
          participantGroup: row.participant_group,
          effectiveFrom: row.effective_from,
          effectiveTo: row.effective_to,
          mappingVersion: row.version_number,
          supersedesMappingId: row.supersedes_mapping_id,
          provenance: row.provenance_json,
          arrangementResolutionReason: row.arrangement_resolution_reason,
          arrangementResolutionChangeVersionIds: row.arrangement_resolution_change_version_ids,
          arrangement: row.arrangement ? pensionArrangementCanonical(row.arrangement) : null,
        })),
      },
      fiscalProfile: fiscalProfile.canonical,
      ...(regularWage ? { regularWage } : {}),
      actualWork: actualWorkSnapshot.canonicalSource,
    }
    const hashInput = {
      sourceTenantId: input.tenantId,
      sourceHrGroupId: input.hrGroupId,
      sourceAdministrationId: input.administrationId,
      sourceEmployeeId: input.employeeId,
      sourceEmploymentId: employment.id,
      sourceIncomeRelationshipId: incomeRelationship.selected?.incomeRelationshipId ?? null,
      periodReference: input.payrollPeriod,
      canonicalSource,
      sourceVersionVector,
      sourceGaps,
    }
    const snapshot = {
      id: (this.dependencies.createId ?? randomUUID)(),
      ...hashInput,
      sourceHash: hashPayrollSourceSnapshot(hashInput),
      createdAt: (this.dependencies.now ?? (() => new Date()))().toISOString(),
    }

    const validated = payrollSourceSnapshotSchema.safeParse(snapshot)
    if (!validated.success) throw new PayrollSourceProviderError('PAYROLL_SOURCE_DATA_UNAVAILABLE', 503)
    return validated.data
  }
}

export function createLiquidHrPayrollSourceProvider(
  dependencies?: PayrollSourceProviderDependencies,
): PayrollSourceProvider {
  return new LiquidHrPayrollSourceProvider(dependencies)
}

