import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { bradfordInsightExcel } from './bradford-excel'
import { getBradfordInsightReport } from './bradford-report'
import type { BradfordInsightQuery } from './bradford-query'
import { absenceInsightExcel } from './absence-excel'
import { getAbsenceInsightReport, type AbsenceInsightQuery } from './absence-report'
import { frequentAbsenceExcel } from './frequent-absence-excel'
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
type Filter = { kind: 'eq' | 'in' | 'is' | 'lte' | 'gte'; column: string; values: readonly unknown[] }
type QueryResult = { data: Row[]; error: null }

class MockSupabaseQuery implements PromiseLike<QueryResult> {
  private readonly filters: Filter[] = []

  constructor(
    private readonly table: string,
    private readonly sourceRows: Row[],
    private readonly directTeamIds: readonly string[] | null,
    private readonly ignoreEmployeeScopeFilter = false,
    private readonly ignoredSourceFilters: readonly string[] = [],
  ) {}

  select(): this { return this }
  eq(column: string, value: unknown): this { this.filters.push({ kind: 'eq', column, values: [value] }); return this }
  in(column: string, values: readonly unknown[]): this { this.filters.push({ kind: 'in', column, values }); return this }
  is(column: string, value: unknown): this { this.filters.push({ kind: 'is', column, values: [value] }); return this }
  lte(column: string, value: unknown): this { this.filters.push({ kind: 'lte', column, values: [value] }); return this }
  gte(column: string, value: unknown): this { this.filters.push({ kind: 'gte', column, values: [value] }); return this }
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
      // Fault injection: exercise the post-query allowlist even if a permissive
      // source unexpectedly returns rows beyond the requested direct team.
      if (this.ignoreEmployeeScopeFilter && filter.kind === 'in' && filter.column === 'employee_id') return true
      if (this.ignoredSourceFilters.includes(`${this.table}.${filter.column}`)) return true
      const value = row[filter.column]
      if (filter.kind === 'eq') return value === filter.values[0]
      if (filter.kind === 'is') return filter.values[0] === null ? value === null || value === undefined : value === filter.values[0]
      if (filter.kind === 'in') return filter.values.includes(value)
      if (typeof value !== 'string' || typeof filter.values[0] !== 'string') return false
      return filter.kind === 'lte' ? value <= filter.values[0] : value >= filter.values[0]
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
const bradfordQuery: BradfordInsightQuery = {
  report: 'absence-bradford', period: '52-weeks', year: 2025, month: 2,
  startDate: '2025-02-01', endDate: '2025-02-28', departmentId: null, risk: 'ALL', search: '',
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
    ...scope, employee_id: employment.employee_id, employment_id: employment.id, administration_id: employment.administration_id, schedule_type: 'WEEKLY',
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
    absence_settings: [{ ...scope, frequent_absence_threshold: 1, default_case_manager_employee_id: 'sensitive-case-manager' }],
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

function configure(
  actor: AuthContext,
  teamEmployeeIds: string[] | null,
  sourceTruncated = false,
  dataOverride?: Record<string, Row[]>,
  ignoreEmployeeScopeFilter = false,
  ignoredSourceFilters: string[] = [],
): void {
  const data = dataOverride ?? sourceRows()
  mocks.authorization.mockResolvedValue({
    supabase: { from: mocks.from, rpc: mocks.rpc },
    context: actor,
    activeContext: { administrationsInActiveHrGroup: [{ id: 'admin-a', name: 'Administration A' }, { id: 'admin-b', name: 'Administration B' }] },
  })
  mocks.permission.mockImplementation(async (_supabase: unknown, permissionActor: AuthContext, permission: string) => {
    if (!permissionActor.permissions.includes(permission)) throw Object.assign(new Error('Permission denied.'), { status: 403 })
    return permissionActor
  })
  mocks.directTeam.mockResolvedValue({ employeeIds: teamEmployeeIds ?? [], sourceTruncated, members: [] })
  mocks.from.mockImplementation((table: string) => new MockSupabaseQuery(table, data[table] ?? [], teamEmployeeIds, ignoreEmployeeScopeFilter, ignoredSourceFilters))
  mocks.rpc.mockImplementation(async (name: unknown, input: unknown) => {
    if (name !== 'get_frequent_absence_threshold') return { data: null, error: null }
    const parameters = input as Record<string, unknown>
    const settings = (data.absence_settings ?? []).filter((row) =>
      row.tenant_id === parameters.requested_tenant_id && row.hr_group_id === parameters.requested_hr_group_id,
    )
    if (settings.length > 1) return { data: null, error: { message: 'INSIGHTS_THRESHOLD_SETTINGS_INCONSISTENT' } }
    return {
      data: [{
        configured: settings.length === 1,
        frequent_absence_threshold: settings[0]?.frequent_absence_threshold ?? null,
      }],
      error: null,
    }
  })
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
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read', 'absence:read'] }
    configure(manager, ['employee-a'])

    const absence = await getAbsenceInsightReport(absenceQuery)
    const frequent = await getFrequentAbsenceReport(frequentQuery)
    const bradford = await getBradfordInsightReport(bradfordQuery)

    expect(absence.absenceCases).toBe(1)
    expect(absence.activeCases).toBe(1)
    expect(absence.absenceRate).toBe(5)
    expect(absence.rows.map((row) => row.employeeId)).toEqual(['employee-a'])
    expect(absence.departments.map((department) => department.id)).toEqual(['department-a'])
    expect(frequent.totalReports).toBe(1)
    expect(frequent.rows.map((row) => row.employeeId)).toEqual(['employee-a'])
    expect(frequent.departments.map((department) => department.id)).toEqual(['department-a'])
    expect(bradford.rows.map((row) => row.employeeId)).toEqual(['employee-a'])
    const absenceExport = absenceInsightExcel(absence)
    expect(absenceExport).toContain('Ada Team One')
    expect(absenceExport).not.toContain('Bas Team Two')
    expect(JSON.stringify({ absence, frequent, bradford, absenceExport, frequentExport: frequentAbsenceExcel(frequent), bradfordExport: bradfordInsightExcel(bradford) })).not.toContain('employee-b')
    expect(JSON.stringify({ absence, frequent, bradford, absenceExport })).not.toContain('employee-c')
    expect(mocks.rpc).toHaveBeenCalledWith('get_frequent_absence_threshold', {
      requested_tenant_id: 'tenant-1',
      requested_hr_group_id: 'group-1',
    })
    expect(mocks.from.mock.calls.map((call) => call[0])).not.toContain('absence_settings')
    expect(mocks.permission.mock.calls.map((call) => call[2])).toContain('report-absence:read')
  })

  it('fails closed when a permissive source returns a same-group colleague outside the Manager direct team', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read', 'absence:read'] }
    configure(manager, ['employee-a'], false, sourceRows(), true)

    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ status: 403 })
    await expect(getFrequentAbsenceReport(frequentQuery)).rejects.toMatchObject({ status: 403 })
    await expect(getBradfordInsightReport(bradfordQuery)).rejects.toMatchObject({ status: 403 })
  })

  it('fails closed if a source returns a direct-team employee employment from another administration', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read', 'absence:read'] }
    const data = sourceRows()
    data.employments.push({ ...data.employments.find((row) => row.id === 'employment-a')!, id: 'employment-a-other-admin', administration_id: 'admin-b' })
    configure(manager, ['employee-a'], false, data, false, ['employments.administration_id'])

    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ status: 403 })
    await expect(getFrequentAbsenceReport(frequentQuery)).rejects.toMatchObject({ status: 403 })
    await expect(getBradfordInsightReport(bradfordQuery)).rejects.toMatchObject({ status: 403 })
  })

  it('fails closed when a direct-team allowlist result contains a different tenant or HR group', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read', 'absence:read'] }
    const data = sourceRows()
    const foreignEmployee = data.employees.find((row) => row.id === 'employee-c')!
    foreignEmployee.tenant_id = 'tenant-2'
    foreignEmployee.hr_group_id = 'group-2'
    const foreignEmployment = data.employments.find((row) => row.id === 'employment-c')!
    foreignEmployment.tenant_id = 'tenant-2'
    foreignEmployment.hr_group_id = 'group-2'
    foreignEmployment.administration_id = 'admin-a'
    configure(manager, ['employee-a', 'employee-c'], false, data, false, ['employments.tenant_id', 'employments.hr_group_id'])

    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ status: 403 })
    await expect(getFrequentAbsenceReport(frequentQuery)).rejects.toMatchObject({ status: 403 })
    await expect(getBradfordInsightReport(bradfordQuery)).rejects.toMatchObject({ status: 403 })
  })

  it('limits an HR Admin to the active authorized administration even when more are available', async () => {
    configure(hrAdmin, null)
    const absence = await getAbsenceInsightReport(absenceQuery)
    const frequent = await getFrequentAbsenceReport(frequentQuery)
    const bradford = await getBradfordInsightReport(bradfordQuery)
    expect(absence.absenceCases).toBe(2)
    expect(absence.rows.map((row) => row.employeeId).sort()).toEqual(['employee-a', 'employee-b'])
    expect(frequent.rows.map((row) => row.employeeId).sort()).toEqual(['employee-a', 'employee-b'])
    expect(bradford.rows.map((row) => row.employeeId).sort()).toEqual(['employee-a', 'employee-b'])
    expect(JSON.stringify({ absence, frequent, bradford })).not.toContain('employee-c')
  })

  it('denies a Manager missing report-absence:read before resolving team scope or querying report sources', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['employee:read', 'absence:read'] }
    configure(manager, ['employee-a'])

    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ status: 403 })

    expect(mocks.permission.mock.calls.map((call) => call[2])).toContain('report-absence:read')
    expect(mocks.directTeam).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('continues requiring employee:read for Managers who have the report permission', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'absence:read'] }
    configure(manager, ['employee-a'])

    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ status: 403 })

    expect(mocks.permission.mock.calls.map((call) => call[2])).toContain('employee:read')
    expect(mocks.directTeam).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns empty reports for a Manager with an empty direct team without querying report sources', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read', 'absence:read'] }
    configure(manager, [])

    const absence = await getAbsenceInsightReport(absenceQuery)
    const frequent = await getFrequentAbsenceReport(frequentQuery)
    const bradford = await getBradfordInsightReport(bradfordQuery)

    expect(absence).toMatchObject({ absenceCases: 0, activeCases: 0, rows: [] })
    expect(frequent).toMatchObject({ threshold: 1, totalEmployees: 0, frequentCount: 0, totalReports: 0, rows: [] })
    expect(bradford).toMatchObject({ totalOccurrences: 0, totalSickDays: 0, rows: [] })
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledWith('get_frequent_absence_threshold', {
      requested_tenant_id: 'tenant-1',
      requested_hr_group_id: 'group-1',
    })
  })

  it('rejects an HR Admin administration outside the active authorization context before source queries', async () => {
    configure({ ...hrAdmin, administrationId: 'admin-c' }, null)

    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ status: 403 })

    expect(mocks.directTeam).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('counts a case once for frequency while Bradford counts its two unique spells and exports the same rows', async () => {
    const data = sourceRows()
    const caseA = data.absence_cases.find((row) => row.id === 'case-a')!
    data.absence_cases.push({ ...caseA })
    data.absence_spells.push({ tenant_id: 'tenant-1', hr_group_id: 'group-1', id: 'spell-a-2', case_id: 'case-a', started_on: '2025-02-06', recovered_on: '2025-02-06' })
    data.absence_spells.push({ ...data.absence_spells.find((row) => row.id === 'spell-a-2')! })
    data.absence_capacity_changes.push({ tenant_id: 'tenant-1', hr_group_id: 'group-1', spell_id: 'spell-a-2', effective_on: '2025-02-06', absence_percentage: 100, scheduled_hours_per_week_snapshot: 40, absence_hours_per_week: 40 })
    configure(hrAdmin, null, false, data)

    const frequent = await getFrequentAbsenceReport(frequentQuery)
    const bradford = await getBradfordInsightReport(bradfordQuery)
    const frequentRow = frequent.rows.find((row) => row.employeeId === 'employee-a')
    const bradfordRow = bradford.rows.find((row) => row.employeeId === 'employee-a')

    expect(frequentRow?.reportCount).toBe(1)
    expect(frequent.totalReports).toBe(2)
    expect(bradfordRow).toMatchObject({ absenceOccurrences: 2, sickDays: 2, score: 8, band: 'LOW' })
    expect(bradford.totalOccurrences).toBe(3)
    expect(frequentAbsenceExcel(frequent)).toContain('Ada Team One')
    expect(bradfordInsightExcel(bradford)).toContain('<Data ss:Type="Number">8</Data>')
  })

  it('includes spells crossing the window start for Bradford but does not treat their earlier case start as a new frequency case', async () => {
    const data = sourceRows()
    const caseA = data.absence_cases.find((row) => row.id === 'case-a')!
    caseA.first_absence_on = '2025-02-03'
    const spellA = data.absence_spells.find((row) => row.id === 'spell-case-a')!
    spellA.started_on = '2025-02-03'
    spellA.recovered_on = '2025-02-04'
    const period = { startDate: '2025-02-04', endDate: '2025-02-05' }
    configure(hrAdmin, null, false, data)

    const frequent = await getFrequentAbsenceReport({ ...frequentQuery, ...period })
    const bradford = await getBradfordInsightReport({ ...bradfordQuery, ...period })

    expect(frequent.rows.some((row) => row.employeeId === 'employee-a')).toBe(false)
    expect(bradford.rows.find((row) => row.employeeId === 'employee-a')).toMatchObject({ absenceOccurrences: 1, sickDays: 1, score: 1 })
  })

  it('counts events on both exact 365-day window boundaries', async () => {
    const data = sourceRows()
    const employment = data.employments.find((row) => row.id === 'employment-a')!
    const boundaryDates = ['2025-10-30', '2026-10-29']
    const boundaryCases = boundaryDates.map((date, index) => ({
      tenant_id: 'tenant-1', hr_group_id: 'group-1', id: `case-edge-${index}`, employee_id: employment.employee_id,
      employment_id: employment.id, administration_id: employment.administration_id, status: 'ACTIVE', first_absence_on: date,
      archived_at: null, pending_confirmation: false,
    }))
    data.absence_cases.push(...boundaryCases)
    data.absence_spells.push(...boundaryCases.map((absenceCase, index) => ({
      tenant_id: 'tenant-1', hr_group_id: 'group-1', id: `spell-edge-${index}`, case_id: absenceCase.id,
      started_on: boundaryDates[index], recovered_on: boundaryDates[index],
    })))
    data.absence_capacity_changes.push(...boundaryCases.map((absenceCase, index) => ({
      tenant_id: 'tenant-1', hr_group_id: 'group-1', spell_id: `spell-edge-${index}`, effective_on: boundaryDates[index],
      absence_percentage: 100, scheduled_hours_per_week_snapshot: 40, absence_hours_per_week: 40,
    })))
    const period = { startDate: '2025-10-30', endDate: '2026-10-29' }
    expect((Date.parse(`${period.endDate}T00:00:00Z`) - Date.parse(`${period.startDate}T00:00:00Z`)) / 86_400_000 + 1).toBe(365)
    configure(hrAdmin, null, false, data)

    const frequent = await getFrequentAbsenceReport({ ...frequentQuery, ...period })
    const bradford = await getBradfordInsightReport({ ...bradfordQuery, ...period })

    expect(frequent.rows.find((row) => row.employeeId === 'employee-a')?.reportCount).toBe(2)
    expect(bradford.rows.find((row) => row.employeeId === 'employee-a')).toMatchObject({ absenceOccurrences: 2, sickDays: 2, score: 8 })
  })

  it('returns an unknown Bradford score for overlapping spells within one employment', async () => {
    const data = sourceRows()
    data.absence_spells.push({ tenant_id: 'tenant-1', hr_group_id: 'group-1', id: 'spell-overlap', case_id: 'case-a', started_on: '2025-02-04', recovered_on: '2025-02-05' })
    data.absence_capacity_changes.push({ tenant_id: 'tenant-1', hr_group_id: 'group-1', spell_id: 'spell-overlap', effective_on: '2025-02-04', absence_percentage: 100, scheduled_hours_per_week_snapshot: 40, absence_hours_per_week: 40 })
    configure(hrAdmin, null, false, data)

    const report = await getBradfordInsightReport(bradfordQuery)
    const row = report.rows.find((item) => item.employeeId === 'employee-a')

    expect(row).toMatchObject({ absenceOccurrences: 2, sickDays: null, score: null, band: 'UNKNOWN' })
    expect(report.dataQuality).toMatchObject({ complete: false, overlappingSpellPairs: 1 })
  })

  it('fails closed at 10,000 raw absence-spell records before deduplicating duplicate IDs', async () => {
    const data = sourceRows()
    const spell = data.absence_spells.find((row) => row.id === 'spell-case-a')!
    data.absence_spells = Array.from({ length: 10000 }, (_, index) => ({
      ...spell,
      id: index % 2 === 0 ? 'duplicate-spell-id' : `spell-${index}`,
    }))
    expect(data.absence_spells).toHaveLength(10000)
    expect(new Set(data.absence_spells.map((row) => row.id)).size).toBeLessThan(10000)
    configure(hrAdmin, null, false, data)

    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ code: 'INSIGHTS_SOURCE_LIMIT_REACHED', status: 503 })
  })

  it('fails closed at 10,000 raw absence-case records before deduplicating duplicate IDs', async () => {
    const data = sourceRows()
    const absenceCase = data.absence_cases.find((row) => row.id === 'case-a')!
    data.absence_cases = Array.from({ length: 10000 }, () => ({ ...absenceCase }))
    expect(data.absence_cases).toHaveLength(10000)
    expect(new Set(data.absence_cases.map((row) => row.id)).size).toBe(1)
    configure(hrAdmin, null, false, data)

    await expect(getFrequentAbsenceReport(frequentQuery)).rejects.toMatchObject({ code: 'INSIGHTS_SOURCE_LIMIT_REACHED', status: 503 })
  })

  it('uses rostered workday units for Bradford-D when scheduled shift hours differ', async () => {
    const data = sourceRows()
    const schedule = data.employment_schedules.find((row) => row.employment_id === 'employment-a')!
    schedule.tuesday_hours = 2
    schedule.wednesday_hours = 8
    const spell = data.absence_spells.find((row) => row.id === 'spell-case-a')!
    spell.recovered_on = '2025-02-05'
    configure(hrAdmin, null, false, data)
    const period = { startDate: '2025-02-04', endDate: '2025-02-05' }

    const absence = await getAbsenceInsightReport({ ...absenceQuery, ...period })
    const bradford = await getBradfordInsightReport({ ...bradfordQuery, ...period })

    expect(absence.rows.find((row) => row.employeeId === 'employee-a')).toMatchObject({ sickHours: 10, sickDays: 2 })
    expect(bradford.rows.find((row) => row.employeeId === 'employee-a')).toMatchObject({ absenceOccurrences: 1, sickDays: 2, score: 2 })
  })

  it('adds roster-weighted days across valid parallel employments without counting a duplicate spell ID twice', async () => {
    const data = sourceRows()
    const employment = data.employments.find((row) => row.id === 'employment-a')!
    const organization = data.employee_organizations.find((row) => row.employment_id === employment.id)!
    const schedule = data.employment_schedules.find((row) => row.employment_id === employment.id)!
    const parallelEmployment = { ...employment, id: 'employment-a-parallel' }
    data.employments.push(parallelEmployment)
    data.employee_organizations.push({ ...organization, employment_id: parallelEmployment.id })
    data.employment_schedules.push({ ...schedule, employment_id: parallelEmployment.id })
    data.absence_cases.push({ tenant_id: 'tenant-1', hr_group_id: 'group-1', id: 'case-a-parallel', employee_id: 'employee-a', employment_id: parallelEmployment.id, administration_id: 'admin-a', status: 'ACTIVE', first_absence_on: '2025-02-04', archived_at: null, pending_confirmation: false })
    data.absence_spells.push({ tenant_id: 'tenant-1', hr_group_id: 'group-1', id: 'spell-a-parallel', case_id: 'case-a-parallel', started_on: '2025-02-04', recovered_on: '2025-02-04' })
    data.absence_capacity_changes.push({ tenant_id: 'tenant-1', hr_group_id: 'group-1', spell_id: 'spell-a-parallel', effective_on: '2025-02-04', absence_percentage: 100, scheduled_hours_per_week_snapshot: 40, absence_hours_per_week: 40 })
    configure(hrAdmin, null, false, data)

    const report = await getBradfordInsightReport(bradfordQuery)
    const row = report.rows.find((item) => item.employeeId === 'employee-a')

    expect(row).toMatchObject({ absenceOccurrences: 2, sickDays: 2, score: 8 })
  })

  it('uses internal day precision for the final score and displays D to one decimal', async () => {
    const data = sourceRows()
    const caseA = data.absence_cases.find((row) => row.id === 'case-a')!
    caseA.first_absence_on = '2025-02-04'
    const spells = [
      { id: 'spell-precision-1', start: '2025-02-04', end: '2025-02-05' },
      { id: 'spell-precision-2', start: '2025-02-06', end: '2025-02-07' },
      { id: 'spell-precision-3', start: '2025-02-10', end: '2025-02-11' },
    ]
    data.absence_spells = data.absence_spells.filter((row) => row.case_id !== 'case-a')
    data.absence_capacity_changes = data.absence_capacity_changes.filter((row) => row.spell_id !== 'spell-case-a')
    for (const spell of spells) {
      data.absence_spells.push({ tenant_id: 'tenant-1', hr_group_id: 'group-1', id: spell.id, case_id: caseA.id, started_on: spell.start, recovered_on: spell.end })
      data.absence_capacity_changes.push({ tenant_id: 'tenant-1', hr_group_id: 'group-1', spell_id: spell.id, effective_on: spell.start, absence_percentage: 93.52, scheduled_hours_per_week_snapshot: null, absence_hours_per_week: null })
    }
    configure(hrAdmin, null, false, data)

    const report = await getBradfordInsightReport({ ...bradfordQuery, startDate: '2025-02-04', endDate: '2025-02-11' })
    const row = report.rows.find((item) => item.employeeId === 'employee-a')

    expect(row?.sickDays).toBe(5.6)
    expect(row?.score).toBe(51)
    expect(row?.band).toBe('MEDIUM')
  })

  it('denies Employee access before any report source query', async () => {
    configure({ ...hrAdmin, activeRoles: ['EMPLOYEE'], permissions: ['employee:read'] }, null)
    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ status: 403 })
    await expect(getBradfordInsightReport(bradfordQuery)).rejects.toMatchObject({ status: 403 })
    await expect(getFrequentAbsenceReport(frequentQuery)).rejects.toMatchObject({ status: 403 })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('fails closed when the direct team source is truncated', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read', 'absence:read'] }
    configure(manager, ['employee-a'], true)
    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ code: 'INSIGHTS_SCOPE_LIMIT_REACHED', status: 403 })
    await expect(getBradfordInsightReport(bradfordQuery)).rejects.toMatchObject({ code: 'INSIGHTS_SCOPE_LIMIT_REACHED', status: 403 })
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('keeps missing schedules and capacity as unknown instead of manufacturing hours or 0% absence', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read', 'absence:read'] }
    const missingSchedule = sourceRows()
    missingSchedule.employment_schedules = []
    configure(manager, ['employee-a'], false, missingSchedule)
    const noScheduleReport = await getAbsenceInsightReport(absenceQuery)
    expect(noScheduleReport.absenceRate).toBeNull()
    expect(noScheduleReport.availableHours).toBeNull()
    expect(noScheduleReport.sickHours).toBeNull()
    expect(noScheduleReport.dataQuality.unknownScheduleDays).toBeGreaterThan(0)
    const noScheduleBradford = await getBradfordInsightReport(bradfordQuery)
    expect(noScheduleBradford.rows.find((row) => row.employeeId === 'employee-a')).toMatchObject({ sickDays: null, score: null, band: 'UNKNOWN' })

    const missingCapacity = sourceRows()
    missingCapacity.absence_capacity_changes = []
    configure(manager, ['employee-a'], false, missingCapacity)
    const noCapacityReport = await getAbsenceInsightReport(absenceQuery)
    expect(noCapacityReport.absenceRate).toBeNull()
    expect(noCapacityReport.sickHours).toBeNull()
    expect(noCapacityReport.dataQuality.unknownCapacityDays).toBe(1)
    const noCapacityBradford = await getBradfordInsightReport(bradfordQuery)
    expect(noCapacityBradford.rows.find((row) => row.employeeId === 'employee-a')).toMatchObject({ sickDays: null, score: null, band: 'UNKNOWN' })
  })

  it('reports missing historical placements and rejects department-filter calculations when membership is unknown', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read', 'absence:read'] }
    const data = sourceRows()
    data.employee_organizations = data.employee_organizations.filter((row) => row.employee_id !== 'employee-a')
    configure(manager, ['employee-a'], false, data)
    const report = await getAbsenceInsightReport(absenceQuery)
    const bradford = await getBradfordInsightReport(bradfordQuery)
    expect(report.dataQuality.complete).toBe(false)
    expect(report.dataQuality.unknownPlacements).toBe(1)
    expect(report.rows[0]?.departmentName).toBeNull()
    expect(bradford.dataQuality.unknownPlacements).toBe(1)
    await expect(getAbsenceInsightReport({ ...absenceQuery, departmentId: 'department-a' })).rejects.toMatchObject({ code: 'INSIGHTS_PLACEMENT_SCOPE_INCOMPLETE', status: 503 })
  })

  it('keeps the configured frequency threshold and defaults to three when no setting exists', async () => {
    const configured = sourceRows()
    const caseA = configured.absence_cases.find((row) => row.id === 'case-a')!
    const caseB = { ...caseA, id: 'case-a-2', first_absence_on: '2025-02-06' }
    configured.absence_cases.push(caseB)
    configured.absence_spells.push({ tenant_id: 'tenant-1', hr_group_id: 'group-1', id: 'spell-a-2', case_id: caseB.id, started_on: '2025-02-06', recovered_on: '2025-02-06' })
    configured.absence_capacity_changes.push({ tenant_id: 'tenant-1', hr_group_id: 'group-1', spell_id: 'spell-a-2', effective_on: '2025-02-06', absence_percentage: 100, scheduled_hours_per_week_snapshot: 40, absence_hours_per_week: 40 })
    configure(hrAdmin, null, false, configured)
    const thresholdOne = await getFrequentAbsenceReport(frequentQuery)
    expect(thresholdOne.threshold).toBe(1)
    expect(thresholdOne.rows.find((row) => row.employeeId === 'employee-a')?.isFrequent).toBe(true)
    expect(frequentAbsenceExcel(thresholdOne)).toContain('<Data ss:Type=\"Number\">1</Data>')

    const withoutSetting = sourceRows()
    withoutSetting.absence_settings = []
    configure(hrAdmin, null, false, withoutSetting)
    const defaultThreshold = await getFrequentAbsenceReport(frequentQuery)
    expect(defaultThreshold.threshold).toBe(3)
    expect(defaultThreshold.rows.every((row) => !row.isFrequent)).toBe(true)
  })

  it('uses the scoped threshold projection for the report and Excel without reading other settings', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read', 'absence:read'] }
    const data = sourceRows()
    data.absence_settings[0]!.frequent_absence_threshold = 4
    configure(manager, ['employee-a'], false, data)

    const report = await getFrequentAbsenceReport(frequentQuery)
    const workbook = frequentAbsenceExcel(report)

    expect(report.threshold).toBe(4)
    expect(report.rows.find((row) => row.employeeId === 'employee-a')?.isFrequent).toBe(false)
    expect(workbook).toContain('<Data ss:Type=\"Number\">4</Data>')
    expect(mocks.rpc).toHaveBeenCalledWith('get_frequent_absence_threshold', {
      requested_tenant_id: 'tenant-1',
      requested_hr_group_id: 'group-1',
    })
    expect(mocks.from.mock.calls.map((call) => call[0])).not.toContain('absence_settings')
    expect(JSON.stringify({ report, workbook })).not.toContain('sensitive-case-manager')
  })

  it('fails closed instead of defaulting to three when the threshold projection is denied or unusable', async () => {
    configure(hrAdmin, null)
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'INSIGHTS_THRESHOLD_FORBIDDEN' } })
    await expect(getFrequentAbsenceReport(frequentQuery)).rejects.toMatchObject({ status: 403 })

    configure(hrAdmin, null)
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null })
    await expect(getFrequentAbsenceReport(frequentQuery)).rejects.toMatchObject({
      code: 'INSIGHTS_FREQUENT_SETTINGS_FAILED',
      status: 503,
    })
  })

  it('returns valid empty datasets for each absence report without invented employees or scores', async () => {
    const data = sourceRows()
    data.employments = []
    configure(hrAdmin, null, false, data)

    const absence = await getAbsenceInsightReport(absenceQuery)
    const frequent = await getFrequentAbsenceReport(frequentQuery)
    const bradford = await getBradfordInsightReport(bradfordQuery)

    expect(absence).toMatchObject({ absenceCases: 0, rows: [], sickDays: 0 })
    expect(frequent).toMatchObject({ totalEmployees: 0, frequentCount: 0, totalReports: 0, rows: [] })
    expect(bradford).toMatchObject({ totalOccurrences: 0, totalSickDays: 0, rows: [] })
  })

  it('fails closed at the employment source limit', async () => {
    const manager: AuthContext = { ...hrAdmin, activeRoles: ['DIRECT_MANAGER'], employeeId: 'manager-a', permissions: ['report-absence:read', 'employee:read', 'absence:read'] }
    const data = sourceRows()
    data.employments = Array.from({ length: 5000 }, () => ({ ...data.employments[0] }))
    configure(manager, ['employee-a'], false, data)
    await expect(getAbsenceInsightReport(absenceQuery)).rejects.toMatchObject({ code: 'INSIGHTS_SOURCE_LIMIT_REACHED', status: 503 })
  })
})
