import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { getAbsenceInsightReport, type AbsenceInsightQuery } from './absence-report'
import { getFrequentAbsenceReport } from './frequent-absence-report'
import type { FrequentAbsenceQuery } from './frequent-absence-query'

const mocks = vi.hoisted(() => ({
  authorization: vi.fn(),
  permission: vi.fn(),
  directTeam: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error { readonly status = 403 },
  getRequestAuthorizationContext: mocks.authorization,
  requireHrGroupId: (context: { hrGroupId?: string }) => context.hrGroupId ?? 'HR_GROUP_MISSING',
  requirePermissionInContext: mocks.permission,
}))
vi.mock('@/lib/organization/team-scope', () => ({ listDirectTeamEmployeeScope: mocks.directTeam }))

type Row = Record<string, unknown>
type Filter = { kind: 'eq' | 'in' | 'is'; column: string; values: readonly unknown[] }
type QueryResult = { data: Row[]; error: null }

class MockSupabaseQuery implements PromiseLike<QueryResult> {
  private readonly filters: Filter[] = []

  constructor(private readonly table: string, private readonly sourceRows: Row[], private readonly directTeamIds: readonly string[] | null) {}

  select(): this { return this }
  eq(column: string, value: unknown): this { this.filters.push({ kind: 'eq', column, values: [value] }); return this }
  in(column: string, values: readonly unknown[]): this { this.filters.push({ kind: 'in', column, values }); return this }
  is(column: string, value: unknown): this { this.filters.push({ kind: 'is', column, values: [value] }); return this }
  lte(): this { return this }
  gte(): this { return this }
  or(): this { return this }
  limit(): this { return this }

  maybeSingle(): Promise<{ data: Row | null; error: null }> {
    return Promise.resolve({ data: this.execute()[0] ?? null, error: null })
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.execute(), error: null }).then(onfulfilled, onrejected)
  }

  private execute(): Row[] {
    const has = (kind: Filter['kind'], column: string): boolean => this.filters.some((filter) => filter.kind === kind && filter.column === column)
    if (['employments', 'employee_organizations', 'employment_schedules', 'absence_cases'].includes(this.table)) {
      expect(has('eq', 'administration_id')).toBe(true)
    }
    if (this.directTeamIds) {
      if (['employments', 'employee_organizations', 'absence_cases'].includes(this.table)) expect(has('in', 'employee_id')).toBe(true)
      if (this.table === 'employment_schedules') expect(has('in', 'employment_id')).toBe(true)
      if (this.table === 'employees') expect(has('in', 'id')).toBe(true)
      if (this.table === 'absence_spells') expect(has('in', 'case_id')).toBe(true)
      if (this.table === 'absence_capacity_changes') expect(has('in', 'spell_id')).toBe(true)
      if (this.table === 'departments') expect(has('in', 'id')).toBe(true)
    }
    return this.sourceRows.filter((row) => this.filters.every((filter) => {
      const value = row[filter.column]
      if (filter.kind === 'eq') return value === filter.values[0]
      if (filter.kind === 'is') return filter.values[0] === null ? value === null || value === undefined : value === filter.values[0]
      return filter.values.includes(value)
    }))
  }
}

const hrAdmin: AuthContext = {
  tenantId: 'tenant-1', hrGroupId: 'group-1', administrationId: 'admin-a', userId: 'hr-user', employeeId: null,
  activeRoles: ['HR_ADMIN'], permissions: ['report-absence:read', 'employee:read', 'report-employee-department:read'],
}
const absenceQuery: AbsenceInsightQuery = {
  report: 'absence', period: 'month', year: 2025, month: 2, startDate: '2025-02-01', endDate: '2025-02-28', departmentId: null,
}
const frequentQuery: FrequentAbsenceQuery = {
  report: 'absence-frequent', period: 'this-year', year: 2025, startDate: '2025-02-01', endDate: '2025-02-28', departmentId: null, search: '', frequentOnly: false,
}

function sourceRows(): Record<string, Row[]> {
  const scope = { tenant_id: 'tenant-1', hr_group_id: 'group-1' }
  const employees: Row[] = [
    { ...scope, id: 'employee-a', first_name: 'Ada', birth_name_prefix: null, birth_name: 'Team One', deleted_at: null },
    { ...scope, id: 'employee-b', first_name: 'Bas', birth_name_prefix: null, birth_name: 'Team Two', deleted_at: null },
    { ...scope, id: 'employee-c', first_name: 'Cato', birth_name_prefix: null, birth_name: 'Admin B', deleted_at: null },
  ]
  const employments: Row[] = [
    { ...scope, id: 'employment-a', employee_id: 'employee-a', administration_id: 'admin-a', starts_on: '2024-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null },
    { ...scope, id: 'employment-b', employee_id: 'employee-b', administration_id: 'admin-a', starts_on: '2024-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null },
    { ...scope, id: 'employment-c', employee_id: 'employee-c', administration_id: 'admin-b', starts_on: '2024-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null },
  ]
  const organizations: Row[] = [
    { ...scope, employee_id: 'employee-a', employment_id: 'employment-a', administration_id: 'admin-a', department_id: 'department-a', effective_from: '2020-01-01', effective_to: null },
    { ...scope, employee_id: 'employee-b', employment_id: 'employment-b', administration_id: 'admin-a', department_id: 'department-b', effective_from: '2020-01-01', effective_to: null },
    { ...scope, employee_id: 'employee-c', employment_id: 'employment-c', administration_id: 'admin-b', department_id: 'department-c', effective_from: '2020-01-01', effective_to: null },
  ]
  const schedules: Row[] = employments.map((employment) => ({
    ...scope, employment_id: employment.id, administration_id: employment.administration_id, schedule_type: 'WEEKLY',
    monday_hours: 8, tuesday_hours: 8, wednesday_hours: 8, thursday_hours: 8, friday_hours: 8,
    saturday_hours: 0, sunday_hours: 0, part_time_factor: 1, valid_from: '2020-01-01', valid_until: null,
  }))
  const cases: Row[] = employments.map((employment, index) => ({
    ...scope, id: `case-${String.fromCharCode(97 + index)}`, employee_id: employment.employee_id, employment_id: employment.id,
    administration_id: employment.administration_id, status: 'ACTIVE', first_absence_on: '2025-02-04', archived_at: null, pending_confirmation: false,
  }))
  const spells: Row[] = cases.map((absenceCase) => ({
    ...scope, id: `spell-${absenceCase.id}`, case_id: absenceCase.id, started_on: '2025-02-04', recovered_on: '2025-02-04',
  }))
  const capacities: Row[] = spells.map((spell) => ({
    ...scope, spell_id: spell.id, effective_on: '2025-02-04', absence_percentage: 100, scheduled_hours_per_week_snapshot: 40, absence_hours_per_week: 40,
  }))
  return {
    absence_settings: [{ ...scope, frequent_absence_threshold: 1 }],
    employments, employee_organizations: organizations, employment_schedules: schedules,
    absence_cases: cases, employees,
    departments: [
      { ...scope, id: 'department-a', name: 'Team One' },
      { ...scope, id: 'department-b', name: 'Team Two' },
      { ...scope, id: 'department-c', name: 'Admin B department' },
    ],
    absence_spells: spells, absence_capacity_changes: capacities,
  }
}

function configure(actor: AuthContext, teamEmployeeIds: string[] | null, sourceTruncated = false, dataOverride?: Record<string, Row[]>): void {
  const data = dataOverride ?? sourceRows()
  mocks.authorization.mockResolvedValue({
    supabase: { from: mocks.from, rpc: mocks.rpc },
    context: actor,
    activeContext: { administrationsInActiveHrGroup: [{ id: 'admin-a', name: 'Administration A' }, { id: 'admin-b', name: 'Administration B' }] },
  })
  mocks.permission.mockResolvedValue(actor)
  mocks.directTeam.mockResolvedValue({ employeeIds: teamEmployeeIds ?? [], sourceTruncated, members: [] })
  mocks.from.mockImplementation((table: string) => new MockSupabaseQuery(table, data[table] ?? [], teamEmployeeIds))
}

describe('absence Insights authorization and source quality', () => {
  beforeEach(() => {
    mocks.authorization.mockReset()
    mocks.permission.mockReset()
    mocks.directTeam.mockReset()
    mocks.from.mockReset()
    mocks.rpc.mockReset()
  })

  it('filters cases, spells, capacity, schedules and placements to one Manager direct team before each query executes', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read'] }
    configure(manager, ['employee-a'])

    const absence = await getAbsenceInsightReport(absenceQuery)
    const frequent = await getFrequentAbsenceReport(frequentQuery)

    expect(absence.absenceCases).toBe(1)
    expect(absence.activeCases).toBe(1)
    expect(absence.absenceRate).toBe(5)
    expect(absence.rows.map((row) => row.employeeId)).toEqual(['employee-a'])
    expect(absence.departments.map((department) => department.id)).toEqual(['department-a'])
    expect(frequent.totalReports).toBe(1)
    expect(frequent.rows.map((row) => row.employeeId)).toEqual(['employee-a'])
    expect(frequent.departments.map((department) => department.id)).toEqual(['department-a'])
    expect(JSON.stringify({ absence, frequent })).not.toContain('employee-b')
    expect(JSON.stringify({ absence, frequent })).not.toContain('employee-c')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.permission.mock.calls.map((call) => call[2])).toContain('report-absence:read')
  })

  it('limits an HR Admin to the active authorized administration even when more are available', async () => {
    configure(hrAdmin, null)
    const absence = await getAbsenceInsightReport(absenceQuery)
    const frequent = await getFrequentAbsenceReport(frequentQuery)
    expect(absence.absenceCases).toBe(2)
    expect(absence.rows.map((row) => row.employeeId).sort()).toEqual(['employee-a', 'employee-b'])
    expect(frequent.rows.map((row) => row.employeeId).sort()).toEqual(['employee-a', 'employee-b'])
    expect(JSON.stringify({ absence, frequent })).not.toContain('employee-c')
  })

  it('denies Employee access before any report source query', async () => {
    configure({ ...hrAdmin, activeRoles: ['EMPLOYEE'], permissions: ['employee:read'] }, null)
    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ status: 403 })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('fails closed when the direct team source is truncated', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read'] }
    configure(manager, ['employee-a'], true)
    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ code: 'INSIGHTS_SCOPE_LIMIT_REACHED', status: 403 })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('keeps missing schedules and capacity as unknown instead of manufacturing hours or 0% absence', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read'] }
    const missingSchedule = sourceRows()
    missingSchedule.employment_schedules = []
    configure(manager, ['employee-a'], false, missingSchedule)
    const noScheduleReport = await getAbsenceInsightReport(absenceQuery)
    expect(noScheduleReport.absenceRate).toBeNull()
    expect(noScheduleReport.availableHours).toBeNull()
    expect(noScheduleReport.sickHours).toBeNull()
    expect(noScheduleReport.dataQuality.unknownScheduleDays).toBeGreaterThan(0)

    const missingCapacity = sourceRows()
    missingCapacity.absence_capacity_changes = []
    configure(manager, ['employee-a'], false, missingCapacity)
    const noCapacityReport = await getAbsenceInsightReport(absenceQuery)
    expect(noCapacityReport.absenceRate).toBeNull()
    expect(noCapacityReport.sickHours).toBeNull()
    expect(noCapacityReport.dataQuality.unknownCapacityDays).toBe(1)
  })

  it('reports missing historical placements and rejects department-filter calculations when membership is unknown', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read'] }
    const data = sourceRows()
    data.employee_organizations = data.employee_organizations.filter((row) => row.employee_id !== 'employee-a')
    configure(manager, ['employee-a'], false, data)
    const report = await getAbsenceInsightReport(absenceQuery)
    expect(report.dataQuality.complete).toBe(false)
    expect(report.dataQuality.unknownPlacements).toBe(1)
    expect(report.rows[0]?.departmentName).toBeNull()
    await expect(getAbsenceInsightReport({ ...absenceQuery, departmentId: 'department-a' })).rejects.toMatchObject({ code: 'INSIGHTS_PLACEMENT_SCOPE_INCOMPLETE', status: 503 })
  })

  it('fails closed at the employment source limit', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read'] }
    const data = sourceRows()
    data.employments = Array.from({ length: 5000 }, () => ({ ...data.employments[0] }))
    configure(manager, ['employee-a'], false, data)
    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ code: 'INSIGHTS_SOURCE_LIMIT_REACHED', status: 503 })
  })
})
