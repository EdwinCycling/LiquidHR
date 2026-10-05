import 'server-only'

import { randomUUID } from 'node:crypto'
import type { Database } from '@scope/db'
import type {
  PayrollSourceGap,
  PayrollSourceProvider,
  PayrollSourceProviderInput,
  PayrollSourceSnapshot,
} from '@liquid-hr/payroll-engine'
import { requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { listEmployeeEmployments } from '@/lib/employment/employment-service'
import { getEmploymentDetail } from '@/lib/employment/employment-detail-service'
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
  | 'valid_from' | 'valid_until' | 'updated_at'
>

export type PayrollSourceSchedule = Pick<ScheduleRow,
  | 'id' | 'average_days_per_week' | 'average_hours_per_week' | 'fulltime_hours_per_week'
  | 'part_time_factor' | 'schedule_type' | 'is_on_call' | 'valid_from' | 'valid_until' | 'updated_at'
>

export interface PayrollSourceTimeline {
  readonly employment: PayrollSourceEmployment
  readonly salaries: readonly PayrollSourceSalary[]
  readonly schedules: readonly PayrollSourceSchedule[]
}

export interface PayrollSourceProviderDependencies {
  readonly authorize: (employeeId: string) => Promise<Pick<AuthContext, 'tenantId' | 'hrGroupId' | 'administrationId'>>
  readonly listEmployments: (employeeId: string) => Promise<readonly PayrollSourceEmployment[]>
  readonly loadTimeline: (employeeId: string, employmentId: string) => Promise<PayrollSourceTimeline>
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
      return salaryContext
    },
    listEmployments: async (employeeId) => await listEmployeeEmployments(employeeId),
    isEnabled: isPayrollLabEnabled,
    loadTimeline: async (employeeId, employmentId) => {
      const detail = await getEmploymentDetail(employeeId, employmentId, 'salary')
      return {
        employment: detail.employment,
        salaries: detail.salaries,
        schedules: detail.schedules,
      }
    },
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

function sourceGapsFor(
  salaryRows: readonly PayrollSourceSalary[],
  scheduleRows: readonly PayrollSourceSchedule[],
  coverageStart: string,
  coverageEnd: string,
): PayrollSourceGap[] {
  const gaps: PayrollSourceGap[] = [
    makeGap('incomeRelationship', 'UNSUPPORTED', 'CONTROL02_CONTRACT_PENDING'),
    makeGap('taxProfile', 'SOURCE_GAP', 'NO_ACCEPTED_SOURCE_CONTRACT'),
  ]

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

  return gaps
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
      && employment.deleted_at === null
      && employment.record_status === 'CONFIRMED'
      && employmentOverlapsPeriod(employment.starts_on, employment.ends_on, bounds.start, bounds.endInclusive),
    )
    if (candidates.length === 0) throw new PayrollSourceProviderError('PAYROLL_SOURCE_EMPLOYMENT_NOT_FOUND', 404)
    if (candidates.length > 1) throw new PayrollSourceProviderError('PAYROLL_SOURCE_EMPLOYMENT_AMBIGUOUS', 409)
    const employment = candidates[0]
    if (!employment) throw new PayrollSourceProviderError('PAYROLL_SOURCE_EMPLOYMENT_NOT_FOUND', 404)

    let timeline: PayrollSourceTimeline
    try {
      timeline = await this.dependencies.loadTimeline(input.employeeId, employment.id)
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
    const sourceGaps = sourceGapsFor(salaries, schedules, activeStart, activeEndExclusive)
    const sourceVersionVector = Object.fromEntries([
      [`employment:${employment.id}`, employment.updated_at],
      ...salaries.map((row) => [`employment_salary:${row.id}`, row.updated_at] as const),
      ...schedules.map((row) => [`employment_schedule:${row.id}`, row.updated_at] as const),
    ])

    const canonicalSource = {
      schemaVersion: 'payroll-source-v1',
      employment: {
        startsOn: employment.starts_on,
        endsOn: employment.ends_on,
        originalHireDate: employment.original_hire_date,
        seniorityDate: employment.seniority_date,
        employmentType: employment.employment_type,
        contractType: employment.contract_type,
        recordStatus: employment.record_status,
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
      incomeRelationship: { status: 'UNSUPPORTED', reasonCode: 'CONTROL02_CONTRACT_PENDING' },
      fiscalProfile: { status: 'SOURCE_GAP', reasonCode: 'NO_ACCEPTED_SOURCE_CONTRACT' },
    }
    const hashInput = {
      sourceTenantId: input.tenantId,
      sourceHrGroupId: input.hrGroupId,
      sourceAdministrationId: input.administrationId,
      sourceEmployeeId: input.employeeId,
      sourceEmploymentId: employment.id,
      sourceIncomeRelationshipId: null,
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

