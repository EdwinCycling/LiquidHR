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
import {
  calculateNl2026PeriodSegments,
  encodeNl2026CompositeTimePeriod,
  prorateMonthlySalary,
  calculatePension,
  PFZW_2026_KINDEROPVANG_METHOD,
  type Pfzw2026CalculationInput,
  type PensionArrangementInput,
  type PensionCalculationResult,
} from '@liquid-hr/payroll-rules-nl-2026'
import { sha256, stableSerialize } from '@liquid-hr/payroll-engine'
import {
  AuthorizationError,
  requirePermission,
  type AuthContext,
} from '@/lib/auth/permissions'
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
import {
  hashPayrollEmployerConfiguration,
  isNewIncomeRelationshipWithoutOpening,
  normalizePayrollEmployerConfiguration,
  payrollEmployerConfigurationBlockers,
  type PayrollEmployerConfiguration,
} from '../payroll-setup'
import {
  createPayrollSetupRepository,
  type PayrollSetupRepository,
} from '../payroll-setup-repository'
import { mapCorePensionEligibilityRule } from '../pension-eligibility-source-mapping'
import {
  calculateCaoPayroll,
  type CaoPayrollActualWorkEntry,
  type CaoPayrollCalculation,
  type CaoRetailBusinessScope,
} from '../cao-payroll-integration'
import type {
  PayrollEmployerConfigurationVersionRow,
  PayrollOpeningCumulativeSnapshotRow,
} from '../database'
import type { PayrollScope } from '../scope'

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
  readonly retailBusinessScope?: CaoRetailBusinessScope
  readonly organizations?: readonly PayrollSourceOrganization[]
  readonly pensionAssignments?: EmploymentPayrollSourceProjection['pensionAssignments']
  readonly laborConditionPensionArrangements?: EmploymentPayrollSourceProjection['laborConditionPensionArrangements']
}

export type PayrollSourceSetup = {
  readonly configurationRows: readonly PayrollEmployerConfigurationVersionRow[]
  readonly configurationRow: PayrollEmployerConfigurationVersionRow | null
  readonly configuration: PayrollEmployerConfiguration | null
  readonly openingBalance: PayrollOpeningCumulativeSnapshotRow | null
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
  readonly loadPayrollSetup?: (
    scope: PayrollScope,
    payrollAdministrationId: string,
    sourceEmploymentId: string,
    payrollPeriod: PayrollSourceProviderInput['payrollPeriod'],
  ) => Promise<PayrollSourceSetup>
  readonly isEnabled: () => boolean
  readonly now?: () => Date
  readonly createId?: () => string
  readonly createCorrelationId?: () => string
  readonly reportDiagnostic?: (diagnostic: PayrollSourceProviderDiagnostic) => void
}

export type PayrollSourceProviderDiagnostic = {
  readonly event: 'PAYROLL_SOURCE_PROVIDER_FAILURE' | 'PAYROLL_SOURCE_PROVIDER_GAP'
  readonly sourceCategory: string
  readonly errorCode: string
  readonly correlationId: string
  readonly field?: string
  readonly sourceGaps?: readonly { readonly sourceCategory: string; readonly errorCode: string; readonly field: string }[]
}

const sourceSnapshotCorrelationIds = new WeakMap<PayrollSourceSnapshot, string>()

/** Returns request-local diagnostic metadata without changing the hash-bound source snapshot. */
export function getPayrollSourceSnapshotCorrelationId(snapshot: PayrollSourceSnapshot): string | null {
  return sourceSnapshotCorrelationIds.get(snapshot) ?? null
}

const SAFE_DATABASE_ERROR_CODE = /^(?:PGRST\d{3}|[0-9A-Z]{5})$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeSourceErrorCode(error: unknown): string {
  if (error instanceof PayrollSourceReadFailure) return safeSourceErrorCode(error.sourceError)
  if (error instanceof AuthorizationError) return 'AUTHORIZATION_DENIED'
  if (!isRecord(error)) return 'SOURCE_READ_FAILED'
  const candidate = error.databaseCode ?? error.diagnosticCode ?? error.code
  return typeof candidate === 'string' && SAFE_DATABASE_ERROR_CODE.test(candidate)
    ? candidate
    : 'SOURCE_READ_FAILED'
}

function safeSourceCategory(error: unknown, fallback: string): string {
  if (error instanceof PayrollSourceReadFailure) return safeSourceCategory(error.sourceError, error.sourceCategory)
  if (error instanceof AuthorizationError) return 'authorization'
  if (isRecord(error) && typeof error.sourceCategory === 'string'
    && /^[a-z][a-z0-9-]{0,63}$/.test(error.sourceCategory)) return error.sourceCategory
  return fallback
}

export type PayrollSourceProviderErrorCode =
  | 'PAYROLL_SOURCE_INPUT_INVALID'
  | 'PAYROLL_SOURCE_SCOPE_FORBIDDEN'
  | 'PAYROLL_SOURCE_EMPLOYMENT_NOT_FOUND'
  | 'PAYROLL_SOURCE_EMPLOYMENT_AMBIGUOUS'
  | 'PAYROLL_SOURCE_DISABLED'
  | 'PAYROLL_SOURCE_DATA_UNAVAILABLE'

export class PayrollSourceProviderError extends Error {
  constructor(
    readonly code: PayrollSourceProviderErrorCode,
    readonly status: 400 | 403 | 404 | 409 | 503,
    readonly sourceCategory?: string,
    readonly correlationId?: string,
  ) {
    super(code)
    this.name = 'PayrollSourceProviderError'
  }
}

class PayrollSourceReadFailure extends Error {
  constructor(readonly sourceCategory: string, readonly sourceError: unknown) {
    super('PAYROLL_SOURCE_READ_FAILED')
    this.name = 'PayrollSourceReadFailure'
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
    createCorrelationId: randomUUID,
    reportDiagnostic: (diagnostic) => {
      console.error(diagnostic.event, diagnostic)
    },
    isEnabled: isPayrollLabEnabled,
    loadTimeline: async (employeeId, employmentId, payrollPeriod) => {
      const source = await getEmploymentPayrollSourceProjection(employeeId, employmentId, payrollPeriod).catch((error: unknown) => {
        throw new PayrollSourceReadFailure('employment-payroll-projection', error)
      })
      const incomeRelationships = await getEmploymentIncomeRelationshipProjection(employeeId, employmentId).catch((error: unknown) => {
        throw new PayrollSourceReadFailure('income-relationship-projection', error)
      })
      const taxProfileProjection = await getEmploymentPayrollTaxSourceProjection(employeeId, employmentId, payrollPeriod).catch((error: unknown) => {
        throw new PayrollSourceReadFailure('tax-profile-projection', error)
      })
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
      await getActualWorkPayrollProjection({ employeeId, employmentId, month }).catch((error: unknown) => {
        throw new PayrollSourceReadFailure('actual-work-projection', error)
      }),
    loadPayrollSetup: async (scope, _sourceAdministrationId, sourceEmploymentId, payrollPeriod) => {
      const repository = createPayrollSetupRepository()
      const payrollAdministration = await repository.getPayrollAdministration(scope)
      if (!payrollAdministration || payrollAdministration.status !== 'ACTIVE' || !payrollAdministration.capabilityEnabled) {
        return { configurationRows: [], configurationRow: null, configuration: null, openingBalance: null }
      }
      const payrollAdministrationId = payrollAdministration.id
      const configurationRows = await repository.listEmployerConfigurations(scope, payrollAdministrationId)
      const periodStart = `${payrollPeriod.year}-${String(payrollPeriod.month).padStart(2, '0')}-01`
      const configurationRow = configurationRows.find((row) => row.status === 'ACTIVE'
        && row.effective_from <= periodStart
        && (row.effective_to === null || row.effective_to >= periodStart)) ?? null
      const configuration = configurationRow && typeof configurationRow.configuration_json === 'object'
        && configurationRow.configuration_json !== null && !Array.isArray(configurationRow.configuration_json)
        ? normalizePayrollEmployerConfiguration(configurationRow.configuration_json as unknown as Parameters<typeof normalizePayrollEmployerConfiguration>[0])
        : null
      const openingRows = await repository.listOpeningCumulativeSnapshots(scope, payrollAdministrationId, sourceEmploymentId)
      const openingBalance = openingRows.find((row) => row.as_of_date <= periodStart) ?? null
      return { configurationRows, configurationRow, configuration, openingBalance }
    },
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
        typeCode: null,
        typeName: null,
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
      typeCode: type.code ?? null,
      typeName: type.name ?? null,
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
    && (profile.source_classification === 'EMPLOYEE_DECLARATION'
      || profile.source_classification === 'HR_ADMIN_CONFIRMED')
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

interface PayrollSourceVersionReference {
  readonly field: string
  readonly sourceType: string
  readonly sourceRowId: string
  readonly versionKey: string
  readonly version: string
  readonly versionParts: readonly string[]
  readonly validFrom: string
  readonly validUntilExclusive: string | null
  readonly effectiveAt?: string
}

function sourceVersionContract(
  references: readonly PayrollSourceVersionReference[],
  versionVector: Readonly<Record<string, string>>,
  scope: {
    readonly tenantId: string
    readonly hrGroupId: string
    readonly administrationId: string
    readonly employeeId: string
    readonly employmentId: string
    readonly incomeRelationshipId: string | null
  },
  periodStart: string,
  periodEndExclusive: string,
): { readonly contract: Readonly<Record<string, unknown>>; readonly sourceGaps: readonly PayrollSourceGap[] } {
  const sourceGaps: PayrollSourceGap[] = []
  const tracedReferences = references.map((reference) => {
    const hasVersion = reference.versionParts.length > 0
      && reference.versionParts.every((part) => part.trim().length > 0 && part !== 'MISSING')
    const vectorVersion = versionVector[reference.versionKey]
    const versionConsistent = vectorVersion === reference.version
    const validRange = /^\d{4}-\d{2}-\d{2}$/.test(reference.validFrom)
      && (reference.validUntilExclusive === null
        || (/^\d{4}-\d{2}-\d{2}$/.test(reference.validUntilExclusive)
          && reference.validUntilExclusive > reference.validFrom))
    const effectiveInPeriod = validRange && (reference.effectiveAt
      ? reference.validFrom <= reference.effectiveAt
        && (reference.validUntilExclusive === null || reference.validUntilExclusive > reference.effectiveAt)
      : reference.validFrom < periodEndExclusive
        && (reference.validUntilExclusive === null || reference.validUntilExclusive > periodStart))
    let status: 'BOUND' | 'SOURCE_GAP' = 'BOUND'
    if (!reference.sourceRowId.trim() || !hasVersion) {
      status = 'SOURCE_GAP'
      sourceGaps.push(makeGap(reference.field, 'SOURCE_GAP', 'SOURCE_VERSION_REFERENCE_MISSING'))
    } else if (!versionConsistent) {
      status = 'SOURCE_GAP'
      sourceGaps.push(makeGap(reference.field, 'SOURCE_GAP', 'SOURCE_VERSION_REFERENCE_INCONSISTENT'))
    } else if (!effectiveInPeriod) {
      status = 'SOURCE_GAP'
      sourceGaps.push(makeGap(reference.field, 'SOURCE_GAP', 'SOURCE_VERSION_EFFECTIVE_RANGE_INVALID'))
    }
    return { ...reference, versionParts: [...reference.versionParts], status }
  })

  return {
    contract: {
      schemaVersion: 'payroll-source-contract-v1',
      scope,
      periodStart,
      periodEndExclusive,
      references: tracedReferences,
      versionVector: Object.fromEntries(Object.entries(versionVector).sort(([left], [right]) => left.localeCompare(right))),
    },
    sourceGaps,
  }
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

function payrollDecimalSource(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null
  try {
    const amount = FixedDecimal.parse(String(value))
    if (amount.compare(FixedDecimal.fromInteger(BigInt(0))) <= 0) return null
    return amount.toString(4)
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
  const monthlyAmount = payrollMoneySource(salary.parttime_amount)
  const fulltimeMonthlyAmount = payrollMoneySource(salary.fulltime_amount)
  const contractHoursPerWeek = payrollDecimalSource(schedule.average_hours_per_week)
  const fulltimeHoursPerWeek = payrollDecimalSource(schedule.fulltime_hours_per_week)
  if (!monthlyAmount || !fulltimeMonthlyAmount || !contractHoursPerWeek || !fulltimeHoursPerWeek) return null
  const periodBoundsForWage = periodBounds(period)
  const fullPeriod = start === periodBoundsForWage.start && endExclusive === periodBoundsForWage.endExclusive
  let grossAmount = monthlyAmount
  let timePeriod = fiscalProfile.timePeriod
  if (!fullPeriod) {
    let segments: ReturnType<typeof calculateNl2026PeriodSegments>
    try {
      segments = calculateNl2026PeriodSegments({
        periodStart: periodBoundsForWage.start,
        periodEndExclusive: periodBoundsForWage.endExclusive,
        paidStart: start,
        paidEndExclusive: endExclusive,
      })
      grossAmount = prorateMonthlySalary(
        FixedDecimal.parse(monthlyAmount),
        segments.paidWorkdays,
        segments.periodWorkdays,
      ).toString(2)
      timePeriod = encodeNl2026CompositeTimePeriod(segments)
    } catch {
      return null
    }
  }
  return {
    fiscalYear: String(period.year),
    table: fiscalProfile.wageTaxTable,
    residence: fiscalProfile.residenceCountryCode,
    ageCategory: fiscalProfile.ageCategory,
    herleiding: fiscalProfile.herleiding,
    timePeriod,
    payrollTaxCredit: fiscalProfile.payrollTaxCreditApplies,
    regularWage: true,
    fullPeriod,
    hasSpecialSituation: fiscalProfile.hasSpecialSituation,
    incomeRelationshipCount: String(fiscalProfile.activeIncomeRelationshipCount),
    grossAmount,
    fulltimeMonthlyAmount,
    contractHoursPerWeek,
    fulltimeHoursPerWeek,
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function monthlyAmountFromAnnual(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null
  try {
    return FixedDecimal.parse(String(value)).divideToScale(FixedDecimal.parse('12'), 8, 'ARITHMETIC').round(2, 'HALF_UP').toString(2)
  } catch {
    return null
  }
}

function pensionArrangementInput(
  assignment: NonNullable<PayrollSourceTimeline['pensionAssignments']>[number],
): PensionArrangementInput | null {
  const arrangement = assignment.arrangement
  if (!arrangement) return null
  const contractClassification = arrangement.contract_classification === 'SOLIDARITY'
    || arrangement.contract_classification === 'NON_SOLIDARITY'
    ? arrangement.contract_classification : 'UNKNOWN'
  const eligibility = mapCorePensionEligibilityRule({
    arrangementType: arrangement.arrangement_type === 'PROGRESSIVE_PREMIUM' ? 'PROGRESSIVE_PREMIUM' : 'FLAT_PREMIUM',
    effectiveFrom: arrangement.effective_from,
    eligibilityRule: asRecord(arrangement.eligibility_rule) ?? {},
  })
  return {
    arrangementId: arrangement.id,
    arrangementCode: arrangement.code,
    arrangementVersion: arrangement.version_id ?? arrangement.source_updated_at ?? `CORE:${arrangement.id}`,
    arrangementType: arrangement.arrangement_type === 'PROGRESSIVE_PREMIUM' ? 'PROGRESSIVE_PREMIUM' : 'FLAT_PREMIUM',
    effectiveFrom: arrangement.effective_from,
    arrangementEstablishedFrom: arrangement.arrangement_established_from,
    effectiveTo: arrangement.effective_to,
    transitionDate: arrangement.transition_date,
    grandfatheringMode: arrangement.grandfathering_mode === 'EERBIEDIGENDE_WERKING' ? 'EERBIEDIGENDE_WERKING' : 'NONE',
    flatTotalRate: arrangement.flat_total_rate === null ? null : String(arrangement.flat_total_rate),
    employerSharePercent: String(arrangement.employer_share_pct),
    employeeSharePercent: String(arrangement.employee_share_pct),
    annualFranchise: String(arrangement.annual_franchise),
    annualPensionableSalaryCap: arrangement.annual_pensionable_salary_cap === null
      ? null : String(arrangement.annual_pensionable_salary_cap),
    pensionableSalaryDefinition: asRecord(arrangement.pensionable_salary_definition) ?? {},
    eligibilityRule: eligibility.eligibilityRule,
    eligibilityRuleMapping: eligibility.mapping,
    contractClassification,
    contractClassificationProvenance: asRecord(arrangement.contract_classification_provenance) ?? {},
    provenance: asRecord(arrangement.provenance_json) ?? {},
    tiers: arrangement.tiers.map((tier) => ({
      minAge: tier.min_age,
      maxAge: tier.max_age,
      totalRate: String(tier.total_rate),
    })),
  }
}

function calendarDayFactor(activeStart: string, activeEndExclusive: string, periodStart: string, periodEndExclusive: string): string {
  if (activeStart <= periodStart && activeEndExclusive >= periodEndExclusive) return '1.0000'
  const start = Math.max(Date.parse(`${activeStart}T00:00:00.000Z`), Date.parse(`${periodStart}T00:00:00.000Z`))
  const end = Math.min(Date.parse(`${activeEndExclusive}T00:00:00.000Z`), Date.parse(`${periodEndExclusive}T00:00:00.000Z`))
  const periodDays = (Date.parse(`${periodEndExclusive}T00:00:00.000Z`) - Date.parse(`${periodStart}T00:00:00.000Z`)) / 86_400_000
  const paidDays = Math.max(0, (end - start) / 86_400_000)
  if (!Number.isFinite(periodDays) || periodDays <= 0 || !Number.isFinite(paidDays) || paidDays <= 0) return '0.0000'
  return FixedDecimal.parse(String(paidDays)).divideToScale(FixedDecimal.parse(String(periodDays)), 8, 'ARITHMETIC').round(4, 'HALF_UP').toString(4)
}

function openingCumulatives(row: PayrollOpeningCumulativeSnapshotRow | null): Record<string, string> | null {
  if (!row || typeof row.opening_balance_json !== 'object' || row.opening_balance_json === null || Array.isArray(row.opening_balance_json)) return null
  if (!/^[0-9a-f]{64}$/i.test(row.snapshot_hash)
    || sha256(stableSerialize(row.opening_balance_json)) !== row.snapshot_hash) return null
  const raw = row.opening_balance_json as Record<string, unknown>
  const values = asRecord(raw.meaning) ?? asRecord(raw.cumulativeBalances) ?? raw
  const keys = [
    'grossWageBeforePeriod', 'holidayReserveBeforePeriod', 'yearEndReserveBeforePeriod',
    'taxableWageBeforePeriod', 'wageTaxBeforePeriod', 'employeeInsuranceWageBeforePeriod', 'zvwWageBeforePeriod',
  ] as const
  const result: Record<string, string> = {}
  for (const key of keys) {
    if (typeof values[key] !== 'string' && typeof values[key] !== 'number') return null
    try { result[key] = FixedDecimal.parse(String(values[key])).toString(2) } catch { return null }
  }
  return result
}

function actualPensionRate(totalRate: string | null, sharePercent: string): string | null {
  if (!totalRate) return null
  try {
    return FixedDecimal.parse(totalRate).multiply(FixedDecimal.parse(sharePercent))
      .divideToScale(FixedDecimal.parse('100'), 8, 'ARITHMETIC').toString(4)
  } catch {
    return null
  }
}

function pfzwBaseComponentRates(definition: Readonly<Record<string, unknown>>): {
  readonly totalRate: string
  readonly employeeRate: string
  readonly employerRate: string
} | null {
  if (sourceText(definition.method) !== PFZW_2026_KINDEROPVANG_METHOD || !Array.isArray(definition.components)) return null
  const base = definition.components.map(asRecord).find((component) =>
    sourceText(component?.code) === 'PFZW_OP_NP_2026'
      && sourceText(component?.componentType) === 'BASE',
  )
  const totalRate = sourceText(base?.totalRate)
  const employeeRate = sourceText(base?.employeeRate)
  const employerRate = sourceText(base?.employerRate)
  if (!totalRate || !employeeRate || !employerRate) return null
  try {
    if (FixedDecimal.parse(employeeRate).add(FixedDecimal.parse(employerRate))
      .compare(FixedDecimal.parse(totalRate)) !== 0) return null
  } catch {
    return null
  }
  return { totalRate, employeeRate, employerRate }
}

function sourceText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function monthlyPayrollGrossForPension(
  regularWage: Record<string, string | boolean>,
  caoCalculation: CaoPayrollCalculation,
): string {
  try {
    const base = FixedDecimal.parse(String(regularWage.grossAmount))
    const premium = caoCalculation.status === 'CALCULATED' && caoCalculation.premiumAmount
      ? FixedDecimal.parse(caoCalculation.premiumAmount)
      : FixedDecimal.fromInteger(BigInt(0))
    return base.add(premium).round(2, 'HALF_UP').toString(2)
  } catch {
    return String(regularWage.grossAmount)
  }
}

function pfzwSalaryBasisDateFor(participationStartDate: string, year: number): string {
  const yearStart = `${year}-01-01`
  return participationStartDate < yearStart ? yearStart : participationStartDate
}

function salaryRowsEffectiveOn(
  salaries: readonly PayrollSourceSalary[],
  effectiveDate: string,
): readonly PayrollSourceSalary[] {
  return salaries.filter((salary) => salary.valid_from <= effectiveDate
    && (salary.valid_until === null || salary.valid_until > effectiveDate))
}

function buildPfzw2026Input(input: {
  readonly arrangement: PensionArrangementInput
  readonly assignment: NonNullable<PayrollSourceTimeline['pensionAssignments']>[number]
  readonly laborConditionPensionArrangements: readonly NonNullable<PayrollSourceTimeline['laborConditionPensionArrangements']>[number][]
  readonly laborConditionSetId: string | null
  readonly regularWage: Record<string, string | boolean>
  readonly salaryBasisCandidates: readonly PayrollSourceSalary[]
  readonly monthlyPayrollGross: string
  readonly period: PayrollSourceProviderInput['payrollPeriod']
  readonly actualEntries: readonly unknown[]
  readonly sourceId: string
  readonly sourceHash: string
}): Pfzw2026CalculationInput | null {
  const definition = input.arrangement.pensionableSalaryDefinition
  if (sourceText(definition.method) !== PFZW_2026_KINDEROPVANG_METHOD) return null
  const pfzw = asRecord(definition.pfzw2026) ?? definition
  const participationStart = input.assignment.participation_start_date
  const salaryBasisDate = pfzwSalaryBasisDateFor(participationStart, input.period.year)
  const salaryRows = salaryRowsEffectiveOn(input.salaryBasisCandidates, salaryBasisDate)
  if (salaryRows.length !== 1) return null
  const salary = salaryRows[0]
  if (!salary || salary.fulltime_amount === null) return null

  const eligibility = asRecord(input.arrangement.eligibilityRule)
  const participantGroup = sourceText(eligibility?.participantGroup)
  const mappings = input.laborConditionPensionArrangements.filter((mapping) =>
    participantGroup === null || mapping.participant_group === participantGroup,
  )
  if (mappings.length !== 1) return null
  const mapping = mappings[0]!
  if (input.laborConditionSetId === null
    || mapping.labor_condition_set_id !== input.laborConditionSetId
    || mapping.pension_arrangement_id !== input.assignment.pension_arrangement_id
    || mapping.pension_arrangement_id !== input.arrangement.arrangementId) return null
  const assignmentProvenance = asRecord(input.assignment.provenance_json)
  const mappingProvenance = asRecord(mapping.provenance_json)
  if (sourceText(assignmentProvenance?.status) !== 'USER_RECORDED'
    || sourceText(mappingProvenance?.status) !== 'USER_RECORDED') return null
  if (sourceText(assignmentProvenance?.laborConditionMappingId) !== mapping.id
    || sourceText(assignmentProvenance?.laborConditionMappingVersion) !== String(mapping.version_number)) return null
  const assignmentSourceClassification = sourceText(assignmentProvenance?.sourceClassification)
  const mappingSourceClassification = sourceText(mappingProvenance?.sourceClassification)
  if (!assignmentSourceClassification || !mappingSourceClassification) return null

  let fullTimeMonthlySalary: FixedDecimal
  let contractHours: FixedDecimal
  let fullTimeHours: FixedDecimal
  let fullTimePeriodHours: FixedDecimal
  try {
    fullTimeMonthlySalary = FixedDecimal.parse(String(salary.fulltime_amount))
    contractHours = FixedDecimal.parse(String(input.regularWage.contractHoursPerWeek))
    fullTimeHours = FixedDecimal.parse(String(input.regularWage.fulltimeHoursPerWeek))
    fullTimePeriodHours = fullTimeHours.multiply(FixedDecimal.parse('52'))
      .divideToScale(FixedDecimal.parse('12'), 2, 'ARITHMETIC')
  } catch {
    return null
  }
  const paymentPeriodsRaw = sourceText(pfzw.monthlyPaymentsPerYear)
  const monthlyPaymentsPerYear = paymentPeriodsRaw === '13'
    ? 13 as const
    : paymentPeriodsRaw === '12'
      ? 12 as const
        : salary.payment_frequency === 'FOUR_WEEKLY'
        ? 13 as const
        : salary.payment_frequency === 'MONTHLY'
          ? 12 as const
          : null
  if (monthlyPaymentsPerYear === null) return null

  const holidayAllowancePercent = sourceText(pfzw.holidayAllowancePercent)
  const structuralYearEndAllowancePercent = sourceText(pfzw.structuralYearEndAllowancePercent)
  if (!holidayAllowancePercent || !structuralYearEndAllowancePercent) return null
  const structuralYearEndAllowanceReferenceDate = sourceText(pfzw.structuralYearEndAllowanceReferenceDate)
  const structuralYearEndAllowanceSourceReference = sourceText(pfzw.structuralYearEndAllowanceSourceReference)
  const structuralYearEndAllowanceSourceVersion = sourceText(pfzw.structuralYearEndAllowanceSourceVersion)
  const annualSalaryBase = fullTimeMonthlySalary.multiply(FixedDecimal.fromInteger(BigInt(monthlyPaymentsPerYear)))

  const additionalStructuralSalaryComponents: {
    code: string
    annualAmount: string
    sourceVersion: string
    sourceReference: string
  }[] = []
  const componentRows = Array.isArray(pfzw.additionalStructuralSalaryComponents)
    ? pfzw.additionalStructuralSalaryComponents : []
  for (const value of componentRows) {
    const row = asRecord(value)
    const code = sourceText(row?.code)
    const annualAmount = sourceText(row?.annualAmount)
    const sourceVersion = sourceText(row?.sourceVersion)
    const sourceReference = sourceText(row?.sourceReference)
    if (!code || !annualAmount || !sourceVersion || !sourceReference) return null
    additionalStructuralSalaryComponents.push({ code, annualAmount, sourceVersion, sourceReference })
  }

  let additionalWorkedHours = FixedDecimal.fromInteger(BigInt(0))
  for (const value of input.actualEntries) {
    const row = asRecord(value)
    if (row?.family !== 'ADDITIONAL' || row.status !== 'APPROVED') continue
    try {
      additionalWorkedHours = additionalWorkedHours.add(FixedDecimal.parse(String(row.hours)))
    } catch {
      return null
    }
  }
  const explicitAdditionalHours = sourceText(pfzw.additionalWorkedHours)
  if (explicitAdditionalHours !== null) {
    try { additionalWorkedHours = FixedDecimal.parse(explicitAdditionalHours) } catch { return null }
  }
  if (additionalWorkedHours.compare(FixedDecimal.fromInteger(BigInt(0))) < 0) return null

  const upliftEvidence = sourceText(pfzw.additionalHoursUpliftEvidence)
  const upliftEvidenceValue = upliftEvidence === 'VERIFIED_CAO_OR_EMPLOYER_RULE'
    || upliftEvidence === 'SYNTHETIC_TEST_ONLY_POLICY'
    || upliftEvidence === 'PROVISIONAL_CAO_ENTITLEMENT_DERIVATION'
    || upliftEvidence === 'NOT_APPLICABLE'
    ? upliftEvidence : additionalWorkedHours.compare(FixedDecimal.fromInteger(BigInt(0))) === 0 ? 'NOT_APPLICABLE' : null
  const policyStatus = sourceText(pfzw.monthlyAllocationPolicyStatus)
  const calculationPolicyStatus = policyStatus === 'VERIFIED_EMPLOYER_POLICY'
    ? 'VERIFIED_EMPLOYER_POLICY'
    : policyStatus === 'SYNTHETIC_TEST_APPROVED'
      ? 'SYNTHETIC_TEST_APPROVED'
      : 'PROVISIONAL_PREVIEW'

  return {
    period: input.period,
    participationStatus: 'CONFIRMED',
    participationStartDate: participationStart,
    participationEvidenceReference: `Core participation assignment ${input.assignment.id} v${input.assignment.version_number} [${assignmentSourceClassification}]; effective labor-condition arrangement mapping ${mapping.id} v${mapping.version_number} [${mappingSourceClassification}]`,
    arrangementVersion: input.arrangement.arrangementVersion,
    salaryBasisDate,
    salaryBasisSourceId: salary.id,
    salaryBasisSourceVersion: salary.valid_from,
    fullTimeMonthlySalary: fullTimeMonthlySalary.toString(),
    monthlyPaymentsPerYear,
    holidayAllowancePercent,
    structuralYearEndAllowancePercent,
    structuralYearEndAllowanceReferenceDate,
    structuralYearEndAllowanceEligibleAnnualBase: sourceText(pfzw.structuralYearEndAllowanceEligibleAnnualBase) ?? annualSalaryBase.toString(),
    structuralYearEndAllowanceSourceReference,
    structuralYearEndAllowanceSourceVersion,
    additionalStructuralSalaryComponents,
    contractHoursPerWeek: contractHours.toString(),
    fullTimeHoursPerWeek: fullTimeHours.toString(),
    additionalWorkedHours: additionalWorkedHours.toString(4),
    additionalHoursUpliftPercent: sourceText(pfzw.additionalHoursUpliftPercent),
    additionalHoursUpliftEvidence: upliftEvidenceValue,
    additionalHoursUpliftSourceReference: sourceText(pfzw.additionalHoursUpliftSourceReference),
    additionalHoursUpliftSourceVersion: sourceText(pfzw.additionalHoursUpliftSourceVersion),
    fullTimePeriodHours: fullTimePeriodHours.toString(2),
    monthlyPayrollGross: input.monthlyPayrollGross,
    calculationPolicy: {
      status: calculationPolicyStatus,
      version: sourceText(pfzw.monthlyAllocationPolicyVersion) ?? 'UNVERIFIED',
      sourceReference: sourceText(pfzw.monthlyAllocationPolicySourceReference),
      monthlyMethod: 'ANNUAL_RATE_DIVIDED_BY_12',
      shareRounding: 'HALF_UP_CENTS_PER_EMPLOYEE_AND_EMPLOYER_SHARE',
    },
    sourceSnapshotId: input.sourceId,
    sourceSnapshotHash: input.sourceHash,
  }
}

function buildRegularPayrollOwned(input: {
  readonly configuration: PayrollEmployerConfiguration | null
  readonly configurationRow: PayrollEmployerConfigurationVersionRow | null
  readonly openingBalance: PayrollOpeningCumulativeSnapshotRow | null
  readonly configurationRows: readonly PayrollEmployerConfigurationVersionRow[]
  readonly employmentStartsOn: string
  readonly activeStart: string
  readonly activeEndExclusive: string
  readonly period: PayrollSourceProviderInput['payrollPeriod']
  readonly periodStart: string
  readonly periodEndExclusive: string
  readonly regularWage: Record<string, string | boolean> | null
  readonly salaryBasisCandidates: readonly PayrollSourceSalary[]
  readonly schedule: PayrollSourceSchedule | undefined
  readonly laborConditionSetId: string | null
  readonly pensionAssignments: readonly NonNullable<PayrollSourceTimeline['pensionAssignments']>[number][]
  readonly laborConditionPensionArrangements: readonly NonNullable<PayrollSourceTimeline['laborConditionPensionArrangements']>[number][]
  readonly actualWorkSnapshot: ReturnType<typeof actualWorkForPeriod>
  readonly caoCalculation: CaoPayrollCalculation
  readonly sourceId: string
  readonly coreSourceHash: string
  readonly sourceGaps: PayrollSourceGap[]
}): { readonly payrollOwned: Record<string, unknown> | null; readonly sourceGaps: readonly PayrollSourceGap[] } {
  const gaps = input.sourceGaps
  const configuration = input.configuration
  if (!configuration || !input.configurationRow) {
    gaps.push(makeGap('payrollConfiguration', 'SOURCE_GAP', input.configurationRows.length === 0
      ? 'PAYROLL_EMPLOYER_CONFIGURATION_MISSING'
      : 'PAYROLL_EMPLOYER_CONFIGURATION_NOT_ACTIVE'))
  } else if (hashPayrollEmployerConfiguration(configuration) !== input.configurationRow.configuration_hash) {
    gaps.push(makeGap('payrollConfiguration', 'UNSUPPORTED', 'PAYROLL_EMPLOYER_CONFIGURATION_HASH_INVALID'))
  } else {
    for (const blocker of payrollEmployerConfigurationBlockers(configuration)) {
      gaps.push(makeGap('payrollConfiguration', 'SOURCE_GAP', `PAYROLL_CONFIGURATION_${blocker.code}`))
    }
  }

  const isNewIncomeRelationship = isNewIncomeRelationshipWithoutOpening(input.employmentStartsOn, input.periodStart)
  const opening = openingCumulatives(input.openingBalance)
  if (!opening && !isNewIncomeRelationship) gaps.push(makeGap('openingCumulative', 'SOURCE_GAP', 'PAYROLL_OPENING_CUMULATIVE_MISSING'))
  if (input.openingBalance && !opening) gaps.push(makeGap('openingCumulative', 'UNSUPPORTED', 'PAYROLL_OPENING_CUMULATIVE_INVALID'))

  const actualWorkRecord = asRecord(input.actualWorkSnapshot.canonicalSource)
  const actualEntries = Array.isArray(actualWorkRecord?.entries) ? actualWorkRecord.entries : []
  const caoConsumesActualWork = input.caoCalculation.status === 'CALCULATED'
    && input.caoCalculation.actualWorkConsumed === true
  if (actualEntries.some((entry) => asRecord(entry)?.family !== 'TRANSPARENT') && !caoConsumesActualWork) {
    gaps.push(makeGap('actualWork', 'UNSUPPORTED', 'PAYROLL_VARIABLE_WAGE_NOT_CONFIGURED'))
  }

  const assignment = input.pensionAssignments.length === 1 ? input.pensionAssignments[0] : undefined
  if (!assignment) gaps.push(makeGap('pension', 'SOURCE_GAP', input.pensionAssignments.length === 0
    ? 'NO_EFFECTIVE_PENSION_ASSIGNMENT' : 'PENSION_ASSIGNMENT_AMBIGUOUS'))
  const arrangementInput = assignment ? pensionArrangementInput(assignment) : null
  if (assignment && !arrangementInput) gaps.push(makeGap('pension', 'SOURCE_GAP', 'PENSION_ARRANGEMENT_UNAVAILABLE'))
  const method = configuration?.pension.partialMonthMethod ?? 'UNCONFIGURED'
  const periodFactor = method === 'CALENDAR_DAYS_PRO_RATA'
    ? calendarDayFactor(input.activeStart, input.activeEndExclusive, input.periodStart, input.periodEndExclusive)
    : '1.0000'
  const scheduleFactor = input.schedule?.part_time_factor
  let effectivePartTimeFactor: string | null = null
  if (scheduleFactor !== undefined) {
    try {
      effectivePartTimeFactor = FixedDecimal.parse(String(scheduleFactor))
        .multiply(FixedDecimal.parse(periodFactor))
        .round(4, 'HALF_UP')
        .toString(4)
    } catch {
      effectivePartTimeFactor = null
    }
  }
  if (configuration && method === 'UNCONFIGURED') gaps.push(makeGap('pension', 'SOURCE_GAP', 'PENSION_PARTIAL_MONTH_METHOD_REQUIRED'))
  if (!effectivePartTimeFactor) gaps.push(makeGap('pension', 'SOURCE_GAP', 'PENSION_PART_TIME_FACTOR_MISSING'))

  const bpfDetailhandelVcr = sourceText(arrangementInput?.pensionableSalaryDefinition.method)
    === 'BPF_DETAILHANDEL_2026_VCR'
  const zeroOpeningCumulatives = opening !== null
    && Object.values(opening).every((value) => FixedDecimal.parse(value).compare(FixedDecimal.fromInteger(BigInt(0))) === 0)
  const bpfVcrFirstPeriodReady = !bpfDetailhandelVcr || (zeroOpeningCumulatives
    && input.employmentStartsOn === input.periodStart
    && input.activeStart === input.periodStart
    && periodFactor === '1.0000')
  if (bpfDetailhandelVcr && !bpfVcrFirstPeriodReady) {
    gaps.push(makeGap('pension', 'SOURCE_GAP', 'BPF_DETAILHANDEL_VCR_REQUIRES_ZERO_OPENING_FIRST_FULL_PERIOD'))
  }

  let pensionResult: PensionCalculationResult | null = null
  if (arrangementInput && input.regularWage && effectivePartTimeFactor && assignment && bpfVcrFirstPeriodReady) {
    const monthlyPayrollGross = monthlyPayrollGrossForPension(input.regularWage, input.caoCalculation)
    const pfzw2026 = buildPfzw2026Input({
      arrangement: arrangementInput,
      assignment,
      laborConditionPensionArrangements: input.laborConditionPensionArrangements,
      laborConditionSetId: input.laborConditionSetId,
      regularWage: input.regularWage,
      salaryBasisCandidates: input.salaryBasisCandidates,
      monthlyPayrollGross,
      period: input.period,
      actualEntries,
      sourceId: input.sourceId,
      sourceHash: input.coreSourceHash,
    })
    pensionResult = calculatePension({
      arrangement: arrangementInput,
      period: input.period,
      fullTimeMonthlyPensionableSalary: String(input.regularWage.fulltimeMonthlyAmount),
      monthlyPayrollGross,
      partTimeFactor: effectivePartTimeFactor,
      ageForTier: assignment.age_for_tier,
      participationStartDate: assignment.participation_start_date,
      sourceSnapshotId: input.sourceId,
      sourceSnapshotHash: input.coreSourceHash,
      ...(pfzw2026 ? { pfzw2026 } : {}),
    })
    if (pensionResult.status !== 'CALCULATED') {
      const reasonCode = pensionResult.reasonCode === 'PENSION_RATE_UNRESOLVED'
        && arrangementInput.arrangementType === 'FLAT_PREMIUM'
        ? arrangementInput.flatTotalRate === null
          ? 'PENSION_TOTAL_RATE_MISSING'
          : 'PENSION_TOTAL_RATE_INVALID'
        : pensionResult.reasonCode ?? 'PENSION_CALCULATION_BLOCKED'
      gaps.push(makeGap('pension', 'SOURCE_GAP', reasonCode))
    }
  }

  const cumulative = opening ?? {
    grossWageBeforePeriod: '0.00',
    holidayReserveBeforePeriod: '0.00',
    yearEndReserveBeforePeriod: '0.00',
    taxableWageBeforePeriod: '0.00',
    wageTaxBeforePeriod: '0.00',
    employeeInsuranceWageBeforePeriod: '0.00',
    zvwWageBeforePeriod: '0.00',
  }
  if (configuration && configuration.reserves.yearEndApplies === true && !configuration.reserves.yearEndRate) {
    gaps.push(makeGap('reserves', 'SOURCE_GAP', 'PAYROLL_CONFIGURATION_YEAR_END_RATE_REQUIRED'))
  }
  if (pensionResult?.status === 'CALCULATED' && configuration && input.configurationRow) {
    const typedPfzwRates = arrangementInput
      ? pfzwBaseComponentRates(arrangementInput.pensionableSalaryDefinition)
      : null
    const totalRate = typedPfzwRates?.totalRate ?? arrangementInput?.flatTotalRate ?? null
    const employeeRate = typedPfzwRates?.employeeRate
      ?? actualPensionRate(totalRate, arrangementInput?.employeeSharePercent ?? '')
    const employerRate = typedPfzwRates?.employerRate
      ?? actualPensionRate(totalRate, arrangementInput?.employerSharePercent ?? '')
    if (!employeeRate) gaps.push(makeGap('pension', 'SOURCE_GAP', 'PENSION_EMPLOYEE_RATE_UNRESOLVED'))
    if (!employerRate) gaps.push(makeGap('pension', 'SOURCE_GAP', 'PENSION_EMPLOYER_RATE_UNRESOLVED'))
    const payrollOwned: Record<string, unknown> = {
      configuration: {
        schemaVersion: 'payroll-employer-configuration-v1',
        configurationVersionId: input.configurationRow.id,
        configurationVersion: input.configurationRow.configuration_version,
        effectiveFrom: input.configurationRow.effective_from,
        effectiveTo: input.configurationRow.effective_to,
        configurationHash: input.configurationRow.configuration_hash,
        sourceReference: input.configurationRow.source_reference,
        componentSet: configuration.componentSet,
      },
      amounts: {
        variableRegularWage: input.caoCalculation.status === 'CALCULATED'
          ? input.caoCalculation.premiumAmount ?? '0.00'
          : '0.00',
        specialRewardWage: '0.00',
        netReimbursement: '0.00',
        netDeduction: '0.00',
        netCorrection: '0.00',
        employeePension: pensionResult.employeePremiumMonthly,
        employerPension: pensionResult.employerPremiumMonthly,
      },
      controls: {
        sourceReady: gaps.length === 0,
        employmentStartConsistent: true,
        ikvUnambiguous: true,
        salaryConsistent: input.regularWage !== null,
        hoursConsistent: input.schedule !== undefined,
        normalHoursNotDuplicated: actualEntries.length === 0 || caoConsumesActualWork,
        additionalHoursSupported: actualEntries.length === 0 || caoConsumesActualWork,
        sourceFresh: true,
        compositionSupported: true,
        pensionRuleReady: pensionResult.status === 'CALCULATED',
        socialWageCapClear: true,
        cumulativeContinuity: Boolean(opening) || isNewIncomeRelationship,
        reservationContinuity: Boolean(opening) || isNewIncomeRelationship,
        hashesConsistent: Boolean(input.configurationRow.configuration_hash)
          && (Boolean(input.openingBalance) ? /^[0-9a-f]{64}$/i.test(input.openingBalance?.snapshot_hash ?? '') : isNewIncomeRelationship),
        variableWageIsRegular: true,
        specialRewardPensionable: false,
        specialRewardIncludedInHolidayReserve: false,
        specialRewardIncludedInYearEndReserve: false,
        netReimbursementsTaxFree: true,
        netDeductionsAuthorized: true,
      },
      fiscalBases: {
        wageTax: pensionResult.fiscalBases.wageTax,
        employeeInsurance: pensionResult.fiscalBases.employeeInsurance,
        zvw: pensionResult.fiscalBases.zvw,
      },
      pension: {
        planId: assignment?.arrangement?.id ?? null,
        planCode: assignment?.arrangement?.code ?? null,
        planVersion: arrangementInput?.arrangementVersion ?? null,
        effectiveFrom: arrangementInput?.effectiveFrom ?? null,
        effectiveTo: arrangementInput?.effectiveTo ?? null,
        annualFranchise: arrangementInput?.annualFranchise ?? null,
        monthlyFranchise: monthlyAmountFromAnnual(assignment?.arrangement?.annual_franchise ?? null),
        annualPensionableMaximum: arrangementInput?.annualPensionableSalaryCap ?? null,
        monthlyMaximum: monthlyAmountFromAnnual(assignment?.arrangement?.annual_pensionable_salary_cap ?? null),
        partTimeFactor: effectivePartTimeFactor,
        totalPremiumRate: totalRate,
        employeeSharePercent: arrangementInput?.employeeSharePercent ?? null,
        employerSharePercent: arrangementInput?.employerSharePercent ?? null,
        employeeRate,
        employerRate,
        active: assignment?.arrangement?.is_active === true,
        partialMonthMethod: method,
        periodFactor,
        sourceReference: configuration.pension.methodSourceReference,
        calculationStatus: pensionResult.status,
        calculationTrace: pensionResult.trace,
      },
      employerRates: {
        awf: configuration.employerRates.awf,
        aof: configuration.employerRates.aof,
        wko: configuration.employerRates.wko,
        whk: configuration.employerRates.whk,
        zvw: configuration.employerRates.zvw,
      },
      reserveRates: {
        holidayAllowance: configuration.reserves.holidayAllowanceRate,
        yearEnd: configuration.reserves.yearEndApplies ? configuration.reserves.yearEndRate : '0.00',
      },
      parameters: {
        annualSocialWageMaximum: '79409.00',
        parameterSetVersion: 'NL-2026-01',
        sourceReference: 'Bestaande NL-2026 PAYFULL02-regelset; parameter blijft buiten werkgeversconfiguratie.',
      },
      cumulatives: cumulative,
      actualWorkProjection: { cashCompensatedHours: '0.0000' },
      taxProfile: { specialRewardAnnualWage: '0.00', specialRewardAnnualWageResolved: false },
    }
    return { payrollOwned, sourceGaps: gaps }
  }
  return { payrollOwned: null, sourceGaps: gaps }
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

    const correlationId = (this.dependencies.createCorrelationId ?? randomUUID)()
    const reportFailure = (sourceCategory: string, errorCode: string, field?: string): void => {
      try {
        this.dependencies.reportDiagnostic?.({
          event: 'PAYROLL_SOURCE_PROVIDER_FAILURE',
          sourceCategory,
          errorCode,
          correlationId,
          ...(field ? { field } : {}),
        })
      } catch {
        // Diagnostics must never replace the source failure.
      }
    }
    const reportSourceGaps = (gaps: readonly PayrollSourceGap[]): void => {
      if (gaps.length === 0) return
      try {
        this.dependencies.reportDiagnostic?.({
          event: 'PAYROLL_SOURCE_PROVIDER_GAP',
          sourceCategory: 'source-validation',
          errorCode: 'SOURCE_GAPS_PRESENT',
          correlationId,
          sourceGaps: gaps.map((gap) => ({
            sourceCategory: gap.field,
            errorCode: gap.reasonCode,
            field: gap.field,
          })),
        })
      } catch {
        // Diagnostics must never change payroll source evaluation.
      }
    }

    let context: Pick<AuthContext, 'tenantId' | 'hrGroupId' | 'administrationId'>
    try {
      context = await this.dependencies.authorize(input.employeeId)
    } catch (error) {
      if (error instanceof AuthorizationError) reportFailure('authorization', 'AUTHORIZATION_DENIED')
      throw error
    }
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
    } catch (error) {
      const sourceCategory = safeSourceCategory(error, 'employment-directory')
      reportFailure(sourceCategory, safeSourceErrorCode(error))
      throw new PayrollSourceProviderError('PAYROLL_SOURCE_DATA_UNAVAILABLE', 503, sourceCategory, correlationId)
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
      timeline = await this.dependencies.loadTimeline(input.employeeId, employment.id, input.payrollPeriod)
      actualWork = await this.dependencies.loadActualWork(
        input.employeeId,
        employment.id,
        `${input.payrollPeriod.year}-${String(input.payrollPeriod.month).padStart(2, '0')}`,
      )
    } catch (error) {
      const sourceCategory = safeSourceCategory(error, 'employment-timeline-or-actual-work')
      reportFailure(sourceCategory, safeSourceErrorCode(error))
      throw new PayrollSourceProviderError('PAYROLL_SOURCE_DATA_UNAVAILABLE', 503, sourceCategory, correlationId)
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
    const solePensionAssignment = pensionAssignments.length === 1 ? pensionAssignments[0] : undefined
    const pensionDefinition = asRecord(solePensionAssignment?.arrangement?.pensionable_salary_definition)
    const pensionSalaryBasisDate = solePensionAssignment
      && sourceText(pensionDefinition?.method) === PFZW_2026_KINDEROPVANG_METHOD
      ? pfzwSalaryBasisDateFor(solePensionAssignment.participation_start_date, input.payrollPeriod.year)
      : null
    const pensionSalaryBasisCandidates = pensionSalaryBasisDate
      ? salaryRowsEffectiveOn(timeline.salaries, pensionSalaryBasisDate)
      : []
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
    const actualWorkRecord = asRecord(actualWorkSnapshot.canonicalSource)
    const caoActualWorkEntries: CaoPayrollActualWorkEntry[] = (Array.isArray(actualWorkRecord?.entries)
      ? actualWorkRecord.entries : []).flatMap((entry) => {
        const record = asRecord(entry)
        if (!record || typeof record.family !== 'string'
          || (typeof record.hours !== 'string' && typeof record.hours !== 'number')
          || typeof record.status !== 'string') return []
        return [{
          family: record.family,
          typeCode: typeof record.typeCode === 'string' ? record.typeCode : null,
          typeName: typeof record.typeName === 'string' ? record.typeName : null,
          hours: record.hours,
          status: record.status,
        }]
      })
    const activeLaborConditionSet = laborConditions.length === 1 ? laborConditions[0]?.set ?? null : null
    const caoCalculation = calculateCaoPayroll({
      tenantId: input.tenantId,
      hrGroupId: input.hrGroupId,
      administrationId: input.administrationId,
      employeeId: input.employeeId,
      employmentId: employment.id,
      incomeRelationshipId: incomeRelationship.selected?.incomeRelationshipId ?? null,
      period: input.payrollPeriod,
      activeStart,
      activeEndExclusive,
      laborConditionCode: activeLaborConditionSet?.code ?? null,
      laborConditionName: activeLaborConditionSet?.name ?? null,
      retailBusinessScope: timeline.retailBusinessScope,
      salary: salaries.length === 1 ? {
        id: salaries[0]!.id,
        salaryBasis: salaries[0]!.salary_basis,
        caoScaleName: salaries[0]!.cao_scale_name,
        caoStepName: salaries[0]!.cao_step_name,
        salaryStepCode: salaries[0]!.salary_step_code,
        hourlyRate: salaries[0]!.hourly_rate,
        validFrom: salaries[0]!.valid_from,
      } : null,
      schedule: schedules.length === 1 ? {
        contractHoursPerWeek: schedules[0]!.average_hours_per_week,
        fullTimeHoursPerWeek: schedules[0]!.fulltime_hours_per_week,
      } : null,
      actualWorkEntries: caoActualWorkEntries,
    })
    const retailOvertimeHours = caoCalculation.inputs?.dailyOvertimeHours
    const caoConsumesRetailOvertime = caoCalculation.status === 'CALCULATED'
      && caoCalculation.family === 'RETAIL_MODE'
      && caoCalculation.inputs?.scenarioCode === 'R2'
      && (typeof retailOvertimeHours === 'string' || typeof retailOvertimeHours === 'number')
      && FixedDecimal.parse(String(retailOvertimeHours)).compare(FixedDecimal.fromInteger(BigInt(0))) > 0
    const actualWorkSourceGaps = actualWorkSnapshot.sourceGaps.filter((gap) =>
      !(caoConsumesRetailOvertime && gap.reasonCode === 'OVERTIME_RULE_NOT_CONFIGURED'),
    )
    const sourceGaps: PayrollSourceGap[] = [
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
      ...actualWorkSourceGaps,
    ]
    if (caoCalculation.status === 'BLOCKED' && caoCalculation.reasonCode) {
      sourceGaps.push(makeGap('cao', caoCalculation.blockingStatus ?? 'SOURCE_GAP', caoCalculation.reasonCode))
    }
    const baseRegularWage = regularWageInput(
      salaries,
      schedules,
      input.payrollPeriod,
      activeStart,
      activeEndExclusive,
      incomeRelationship.selected?.incomeRelationshipId ?? null,
      fiscalProfile.canonical,
    )
    const regularWage = caoCalculation.status === 'CALCULATED' && baseRegularWage && caoCalculation.baseAmount
      && caoCalculation.fullTimeMonthlyAmount && caoCalculation.grossAmount
      ? {
        ...baseRegularWage,
        grossAmount: caoCalculation.baseAmount,
        fulltimeMonthlyAmount: caoCalculation.fullTimeMonthlyAmount,
        caoGrossAmount: caoCalculation.grossAmount,
        caoApplied: true,
      }
      : baseRegularWage
    let payrollSetup: PayrollSourceSetup | null = null
    if (this.dependencies.loadPayrollSetup) {
      try {
        payrollSetup = await this.dependencies.loadPayrollSetup(
          authorizedScope,
          input.administrationId,
          employment.id,
          input.payrollPeriod,
        )
      } catch {
        sourceGaps.push(makeGap('payrollConfiguration', 'SOURCE_GAP', 'PAYROLL_SETUP_SOURCE_UNAVAILABLE'))
      }
    }
    const sourceVersionVector = Object.fromEntries([
      [`employment:${employment.id}`, employment.updated_at],
      ...salaries.map((row) => [`employment_salary:${row.id}`, row.updated_at] as const),
      ...pensionSalaryBasisCandidates.map((row) => [`employment_salary_basis:${row.id}`, row.updated_at] as const),
      ...schedules.map((row) => [`employment_schedule:${row.id}`, row.updated_at] as const),
      ...contracts.map((row) => [`employment_contract:${row.id}`, row.updated_at] as const),
      ...laborConditions.flatMap((row) => [
        [`employment_labor_condition:${row.id}`, row.updated_at] as const,
        ...(row.set ? [[`labor_condition_set:${row.set.id}`, row.set.updated_at] as const] : []),
      ]),
      ...(timeline.retailBusinessScope ? [[
        `retail_business_scope:${employment.id}`,
        `${timeline.retailBusinessScope.sourceClassification}:${timeline.retailBusinessScope.sourceVersion}`,
      ] as const] : []),
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
      ...(payrollSetup?.configurationRow ? [[
        `payroll_employer_configuration:${payrollSetup.configurationRow.id}`,
        `${payrollSetup.configurationRow.configuration_version}:${payrollSetup.configurationRow.configuration_hash}`,
      ] as const] : []),
      ...(payrollSetup?.openingBalance ? [[
        `payroll_opening_cumulative:${payrollSetup.openingBalance.id}`,
        `${payrollSetup.openingBalance.snapshot_version}:${payrollSetup.openingBalance.snapshot_hash}`,
      ] as const] : []),
    ])
    if (caoCalculation.status === 'CALCULATED' && caoCalculation.compositionId && caoCalculation.packageHash) {
      sourceVersionVector[`cao:rule-package:${caoCalculation.compositionId}`] = `${caoCalculation.packageVersion ?? ''}:${caoCalculation.packageHash}`
      sourceVersionVector[`cao:input:${employment.id}`] = `${caoCalculation.inputHash ?? ''}:${caoCalculation.sourceHash ?? ''}`
    } else if (caoCalculation.status === 'BLOCKED') {
      sourceVersionVector[`cao:blocked:${employment.id}`] = caoCalculation.reasonCode ?? 'UNKNOWN'
    }

    const sourceVersionReferences: PayrollSourceVersionReference[] = [
      {
        field: 'employment', sourceType: 'employments', sourceRowId: employment.id,
        versionKey: `employment:${employment.id}`, version: employment.updated_at,
        versionParts: [employment.updated_at], validFrom: employment.starts_on,
        validUntilExclusive: employment.ends_on === null ? null : dayAfter(employment.ends_on),
      },
      ...salaries.map((row) => ({
        field: 'contractualSalary', sourceType: 'employment_salaries', sourceRowId: row.id,
        versionKey: `employment_salary:${row.id}`, version: row.updated_at,
        versionParts: [row.updated_at], validFrom: row.valid_from, validUntilExclusive: row.valid_until,
      })),
      ...pensionSalaryBasisCandidates.map((row) => ({
        field: 'pension', sourceType: 'employment_salaries', sourceRowId: row.id,
        versionKey: `employment_salary_basis:${row.id}`, version: row.updated_at,
        versionParts: [row.updated_at], validFrom: row.valid_from, validUntilExclusive: row.valid_until,
        effectiveAt: pensionSalaryBasisDate ?? undefined,
      })),
      ...schedules.map((row) => ({
        field: 'contractualHours', sourceType: 'employment_schedules', sourceRowId: row.id,
        versionKey: `employment_schedule:${row.id}`, version: row.updated_at,
        versionParts: [row.updated_at], validFrom: row.valid_from, validUntilExclusive: row.valid_until,
      })),
      ...contracts.map((row) => ({
        field: 'contract', sourceType: 'employment_contracts', sourceRowId: row.id,
        versionKey: `employment_contract:${row.id}`, version: row.updated_at,
        versionParts: [row.updated_at], validFrom: row.starts_on,
        validUntilExclusive: row.ends_on === null ? null : dayAfter(row.ends_on),
      })),
      ...laborConditions.flatMap((row) => [
        {
          field: 'laborCondition', sourceType: 'employment_labor_conditions', sourceRowId: row.id,
          versionKey: `employment_labor_condition:${row.id}`, version: row.updated_at,
          versionParts: [row.updated_at], validFrom: row.valid_from, validUntilExclusive: row.valid_until,
        },
        ...(row.set ? [{
          field: 'laborCondition', sourceType: 'labor_condition_sets', sourceRowId: row.set.id,
          versionKey: `labor_condition_set:${row.set.id}`, version: row.set.updated_at,
          versionParts: [row.set.updated_at], validFrom: row.set.valid_from, validUntilExclusive: null,
        }] : []),
      ]),
      ...(timeline.retailBusinessScope ? [{
        field: 'retailBusinessScope',
        sourceType: timeline.retailBusinessScope.sourceClassification === 'SYNTHETIC_FIXTURE'
          ? 'synthetic_fixture' : 'retail_business_scope',
        sourceRowId: `${timeline.retailBusinessScope.sourceClassification}:${employment.id}`,
        versionKey: `retail_business_scope:${employment.id}`,
        version: `${timeline.retailBusinessScope.sourceClassification}:${timeline.retailBusinessScope.sourceVersion}`,
        versionParts: [timeline.retailBusinessScope.sourceClassification, timeline.retailBusinessScope.sourceVersion],
        validFrom: timeline.retailBusinessScope.effectiveFrom,
        validUntilExclusive: timeline.retailBusinessScope.effectiveTo === null
          ? null : dayAfter(timeline.retailBusinessScope.effectiveTo),
      }] : []),
      ...organizations.flatMap((row) => [
        {
          field: 'organization', sourceType: 'employee_organizations', sourceRowId: row.id,
          versionKey: `employee_organization:${row.id}`, version: row.updated_at,
          versionParts: [row.updated_at], validFrom: row.effective_from,
          validUntilExclusive: row.effective_to === null ? null : dayAfter(row.effective_to),
        },
        ...(row.job_id && row.job_revision_updated_at && row.job_revision_valid_from ? [{
          field: 'job', sourceType: 'job_revisions', sourceRowId: `${row.job_id}:${row.job_revision_valid_from}`,
          versionKey: `job_revision:${row.job_id}:${row.job_revision_valid_from}`,
          version: row.job_revision_updated_at, versionParts: [row.job_revision_updated_at],
          validFrom: row.job_revision_valid_from,
          validUntilExclusive: row.job_revision_valid_until === null ? null : dayAfter(row.job_revision_valid_until),
        }] : []),
      ]),
      ...pensionAssignments.flatMap((row) => [
        {
          field: 'pension', sourceType: 'employment_pension_assignments', sourceRowId: row.id,
          versionKey: `employment_pension_assignment:${row.id}`,
          version: `${row.version_number}:${row.updated_at}`,
          versionParts: [String(row.version_number), row.updated_at],
          validFrom: row.effective_from, validUntilExclusive: row.effective_to,
        },
        ...(row.arrangement ? [
          {
            field: 'pension', sourceType: row.arrangement.version_id ? 'pension_arrangement_versions' : 'pension_arrangements',
            sourceRowId: row.arrangement.version_id ?? row.arrangement.id,
            versionKey: row.arrangement.version_id
              ? `pension_arrangement_version:${row.arrangement.version_id}`
              : `pension_arrangement:${row.arrangement.id}`,
            version: row.arrangement.version_id
              ? row.arrangement.version_created_at ?? ''
              : row.arrangement.source_updated_at ?? '',
            versionParts: [row.arrangement.version_id
              ? row.arrangement.version_created_at ?? ''
              : row.arrangement.source_updated_at ?? ''],
            validFrom: row.arrangement.effective_from, validUntilExclusive: row.arrangement.effective_to,
          },
          ...row.arrangement.tiers.map((tier) => ({
            field: 'pension', sourceType: row.arrangement?.version_id
              ? 'pension_arrangement_version_tiers' : 'pension_arrangement_tiers',
            sourceRowId: tier.id,
            versionKey: `${row.arrangement?.version_id ? 'pension_arrangement_version_tier' : 'pension_arrangement_tier'}:${tier.id}`,
            version: tier.created_at, versionParts: [tier.created_at],
            validFrom: row.arrangement!.effective_from, validUntilExclusive: row.arrangement!.effective_to,
          })),
        ] : []),
      ]),
      ...laborConditionPensionArrangements.map((row) => ({
        field: 'pension', sourceType: 'labor_condition_pension_arrangements', sourceRowId: row.id,
        versionKey: `labor_condition_pension_arrangement:${row.id}`,
        version: `${row.version_number}:${row.effective_from}`,
        versionParts: [String(row.version_number), row.effective_from],
        validFrom: row.effective_from, validUntilExclusive: row.effective_to,
      })),
      ...(actualWork.period ? [{
        field: 'actualWorkPeriod', sourceType: 'actual_work_periods', sourceRowId: actualWork.period.id,
        versionKey: `actual_work_period:${actualWork.period.id}`, version: actualWork.period.updated_at,
        versionParts: [actualWork.period.updated_at], validFrom: actualWork.period.period_start,
        validUntilExclusive: actualWork.period.period_end,
      }] : []),
      ...actualWork.types.map((type) => ({
        field: 'actualWorkType', sourceType: 'work_hour_types', sourceRowId: type.id,
        versionKey: `work_hour_type:${type.id}`, version: type.updated_at,
        versionParts: [type.updated_at], validFrom: type.valid_from,
        validUntilExclusive: type.valid_until,
      })),
      ...actualWork.entries.map((entry) => ({
        field: 'actualWork', sourceType: 'employment_work_hour_entries', sourceRowId: entry.id,
        versionKey: `actual_work_entry:${entry.id}`, version: entry.updated_at,
        versionParts: [entry.updated_at], validFrom: entry.subject_period_start,
        validUntilExclusive: entry.subject_period_end,
      })),
      ...(incomeRelationship.selected ? [
        {
          field: 'incomeRelationshipLink', sourceType: 'employment_income_relationships',
          sourceRowId: incomeRelationship.selected.id,
          versionKey: `employment_income_relationship:${incomeRelationship.selected.id}`,
          version: incomeRelationship.selected.linkUpdatedAt,
          versionParts: [incomeRelationship.selected.linkUpdatedAt],
          validFrom: incomeRelationship.selected.validFrom,
          validUntilExclusive: incomeRelationship.selected.validUntil,
        },
        {
          field: 'incomeRelationship', sourceType: 'income_relationships',
          sourceRowId: incomeRelationship.selected.incomeRelationshipId,
          versionKey: `income_relationship:${incomeRelationship.selected.incomeRelationshipId}`,
          version: incomeRelationship.selected.incomeRelationshipUpdatedAt,
          versionParts: [incomeRelationship.selected.incomeRelationshipUpdatedAt],
          validFrom: incomeRelationship.selected.startsOn,
          validUntilExclusive: incomeRelationship.selected.endsOn === null
            ? null : dayAfter(incomeRelationship.selected.endsOn),
        },
      ] : []),
      ...(fiscalProfile.canonical.id ? [(() => {
        const profile = timeline.taxProfileProjection?.taxProfiles.find((row) => row.id === fiscalProfile.canonical.id)
        return {
          field: 'taxProfile', sourceType: 'employment_payroll_tax_profiles',
          sourceRowId: profile?.id ?? fiscalProfile.canonical.id!,
          versionKey: `employment_payroll_tax_profile:${fiscalProfile.canonical.id}`,
          version: profile ? `${profile.version_number}:${profile.created_at}` : '',
          versionParts: profile ? [String(profile.version_number), profile.created_at] : [],
          validFrom: profile?.effective_from ?? activeStart,
          validUntilExclusive: profile?.effective_to === null || profile?.effective_to === undefined
            ? null : dayAfter(profile.effective_to),
        }
      })()] : []),
      ...(payrollSetup?.configurationRow ? [{
        field: 'payrollConfiguration', sourceType: 'payroll_employer_configurations',
        sourceRowId: payrollSetup.configurationRow.id,
        versionKey: `payroll_employer_configuration:${payrollSetup.configurationRow.id}`,
        version: `${payrollSetup.configurationRow.configuration_version}:${payrollSetup.configurationRow.configuration_hash}`,
        versionParts: [String(payrollSetup.configurationRow.configuration_version), payrollSetup.configurationRow.configuration_hash],
        validFrom: payrollSetup.configurationRow.effective_from,
        validUntilExclusive: payrollSetup.configurationRow.effective_to === null
          ? null : dayAfter(payrollSetup.configurationRow.effective_to),
      }] : []),
      ...(payrollSetup?.openingBalance ? [{
        field: 'openingCumulative', sourceType: 'payroll_opening_cumulative_snapshots',
        sourceRowId: payrollSetup.openingBalance.id,
        versionKey: `payroll_opening_cumulative:${payrollSetup.openingBalance.id}`,
        version: `${payrollSetup.openingBalance.snapshot_version}:${payrollSetup.openingBalance.snapshot_hash}`,
        versionParts: [String(payrollSetup.openingBalance.snapshot_version), payrollSetup.openingBalance.snapshot_hash],
        validFrom: payrollSetup.openingBalance.as_of_date, validUntilExclusive: null,
      }] : []),
    ]
    const versionContractResult = sourceVersionContract(
      sourceVersionReferences,
      sourceVersionVector,
      {
        tenantId: input.tenantId,
        hrGroupId: input.hrGroupId,
        administrationId: input.administrationId,
        employeeId: input.employeeId,
        employmentId: employment.id,
        incomeRelationshipId: incomeRelationship.selected?.incomeRelationshipId ?? null,
      },
      activeStart,
      activeEndExclusive,
    )
    sourceGaps.push(...versionContractResult.sourceGaps)

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

    const coreCanonicalSource = {
      schemaVersion: 'payroll-source-v4',
      sourceContract: versionContractResult.contract,
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
      retailBusinessScope: timeline.retailBusinessScope
        ? { ...timeline.retailBusinessScope }
        : { status: 'MISSING', reasonCode: 'RETAIL_BUSINESS_SCOPE_UNVERIFIED' },
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
        ...(pensionSalaryBasisDate ? {
          salaryBasis: {
            date: pensionSalaryBasisDate,
            candidates: pensionSalaryBasisCandidates.map((row) => ({
              id: row.id,
              fulltimeAmount: row.fulltime_amount,
              paymentFrequency: row.payment_frequency,
              validFrom: row.valid_from,
              validUntil: row.valid_until,
            })),
          },
        } : {}),
      },
      fiscalProfile: fiscalProfile.canonical,
      ...(regularWage ? { regularWage } : {}),
      actualWork: actualWorkSnapshot.canonicalSource,
      ...(caoCalculation.status !== 'NOT_APPLICABLE' ? { caoCalculation } : {}),
    }
    const coreHashInput = {
      sourceTenantId: input.tenantId,
      sourceHrGroupId: input.hrGroupId,
      sourceAdministrationId: input.administrationId,
      sourceEmployeeId: input.employeeId,
      sourceEmploymentId: employment.id,
      sourceIncomeRelationshipId: incomeRelationship.selected?.incomeRelationshipId ?? null,
      periodReference: input.payrollPeriod,
      canonicalSource: coreCanonicalSource,
      sourceVersionVector,
      sourceGaps,
    }
    const sourceId = (this.dependencies.createId ?? randomUUID)()
    const coreSourceHash = sha256(stableSerialize(coreHashInput))
    // The provider snapshot id is intentionally fresh. The pension trace is part of
    // the hash-bound canonical source, so it must use a stable pre-persistence
    // identity or a re-read would look like a source change.
    const calculationSourceId = `CORE_SOURCE:${coreSourceHash}`
    const regularPayroll = this.dependencies.loadPayrollSetup
      ? buildRegularPayrollOwned({
          configuration: payrollSetup?.configuration ?? null,
          configurationRow: payrollSetup?.configurationRow ?? null,
          openingBalance: payrollSetup?.openingBalance ?? null,
          configurationRows: payrollSetup?.configurationRows ?? [],
          employmentStartsOn: employment.starts_on,
          activeStart,
          activeEndExclusive,
          period: input.payrollPeriod,
          periodStart: bounds.start,
          periodEndExclusive: bounds.endExclusive,
          regularWage,
          salaryBasisCandidates: pensionSalaryBasisCandidates,
          schedule: schedules.length === 1 ? schedules[0] : undefined,
          laborConditionSetId: activeLaborConditionSet?.id ?? null,
          pensionAssignments,
          laborConditionPensionArrangements,
          actualWorkSnapshot,
          caoCalculation,
          sourceId: calculationSourceId,
          coreSourceHash,
          sourceGaps,
        })
      : { payrollOwned: null, sourceGaps }
    const canonicalSource = {
      ...coreCanonicalSource,
      ...(regularPayroll.payrollOwned ? { payrollOwned: regularPayroll.payrollOwned } : {}),
    } as unknown as PayrollSourceSnapshot['canonicalSource']
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
      id: sourceId,
      ...hashInput,
      sourceHash: hashPayrollSourceSnapshot(hashInput),
      createdAt: (this.dependencies.now ?? (() => new Date()))().toISOString(),
    }

    const validated = payrollSourceSnapshotSchema.safeParse(snapshot)
    if (!validated.success) {
      const field = validated.error.issues[0]?.path.map(String).join('.')
      reportFailure('source-snapshot-schema', 'SNAPSHOT_SCHEMA_INVALID', field || undefined)
      throw new PayrollSourceProviderError('PAYROLL_SOURCE_DATA_UNAVAILABLE', 503, 'source-snapshot-schema', correlationId)
    }
    sourceSnapshotCorrelationIds.set(validated.data, correlationId)
    reportSourceGaps(validated.data.sourceGaps)
    return validated.data
  }
}

export function createLiquidHrPayrollSourceProvider(
  dependencies?: PayrollSourceProviderDependencies,
): PayrollSourceProvider {
  return new LiquidHrPayrollSourceProvider(dependencies)
}

