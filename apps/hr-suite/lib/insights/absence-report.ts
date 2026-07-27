import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export interface AbsenceInsightQuery {
  report: 'absence'
  period: 'month' | 'year' | '52-weeks' | 'this-year' | 'previous-year'
  year: number
  month: number
  startDate: string
  endDate: string
  departmentId: string | null
}

export interface AbsenceInsightDepartment {
  id: string
  name: string
}

export interface AbsenceInsightRow {
  employeeId: string
  employeeName: string
  departmentId: string | null
  departmentName: string | null
  status: string
  firstAbsenceOn: string
  caseCount: number
  absenceOccurrences: number
  sickDays: number
  sickHours: number
  absenceRate: number
}

export interface AbsenceInsightPeriod {
  label: string
  startDate: string
  endDate: string
  sickHours: number
  availableHours: number
  absenceRate: number
}

export interface AbsenceInsightReport {
  report: 'absence'
  period: { mode: AbsenceInsightQuery['period']; year: number; month: number; startDate: string; endDate: string }
  absenceCases: number
  activeCases: number
  sickHours: number
  availableHours: number
  sickDays: number
  availableDays: number
  absenceRate: number
  rows: AbsenceInsightRow[]
  departments: AbsenceInsightDepartment[]
  trend: AbsenceInsightPeriod[]
}

type EmploymentRow = { id: string; employee_id: string; starts_on: string; ends_on: string | null }
type EmployeeRow = { id: string; first_name: string; birth_name_prefix: string | null; birth_name: string }
type OrganizationRow = { employee_id: string; employment_id: string | null; department_id: string; effective_from: string; effective_to: string | null }
type ScheduleRow = { employment_id: string; schedule_type: string; monday_hours: number | null; tuesday_hours: number | null; wednesday_hours: number | null; thursday_hours: number | null; friday_hours: number | null; saturday_hours: number | null; sunday_hours: number | null; part_time_factor: number; valid_from: string; valid_until: string | null }
type CaseRow = { id: string; employee_id: string; employment_id: string; status: string; first_absence_on: string; archived_at: string | null }
type SpellRow = { id: string; case_id: string; started_on: string; recovered_on: string | null }
type CapacityRow = { spell_id: string; effective_on: string; absence_percentage: number }

export class AbsenceInsightsServiceError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code)
    this.name = 'AbsenceInsightsServiceError'
  }
}

function fail(error: { message?: string } | null): never {
  throw new AbsenceInsightsServiceError(error?.message?.startsWith('INSIGHTS_') ? error.message : 'INSIGHTS_ABSENCE_REPORT_FAILED')
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`)
}

function maxDate(left: string, right: string): string {
  return left > right ? left : right
}

function minDate(left: string, right: string): string {
  return left < right ? left : right
}

function dayKey(date: Date): string {
  return isoDate(date)
}

function scheduledHours(schedule: ScheduleRow | undefined, date: Date): number {
  if (schedule) {
    const values = [schedule.sunday_hours, schedule.monday_hours, schedule.tuesday_hours, schedule.wednesday_hours, schedule.thursday_hours, schedule.friday_hours, schedule.saturday_hours]
    return Math.max(0, Number(values[date.getUTCDay()] ?? 0))
  }
  return date.getUTCDay() === 0 || date.getUTCDay() === 6 ? 0 : 8
}

function activeSchedule(schedules: ScheduleRow[], employmentId: string, date: string): ScheduleRow | undefined {
  return schedules
    .filter((schedule) => schedule.employment_id === employmentId && schedule.valid_from <= date && (schedule.valid_until === null || schedule.valid_until >= date))
    .sort((left, right) => right.valid_from.localeCompare(left.valid_from))[0]
}

function capacityForDay(spells: SpellRow[], capacities: CapacityRow[], caseIds: Set<string>, date: string): number {
  const values = spells.filter((spell) => caseIds.has(spell.case_id) && spell.started_on <= date && (spell.recovered_on === null || spell.recovered_on >= date)).map((spell) => {
    const changes = capacities.filter((change) => change.spell_id === spell.id && change.effective_on <= date).sort((left, right) => right.effective_on.localeCompare(left.effective_on))
    return changes[0]?.absence_percentage ?? 0
  })
  return Math.min(100, Math.max(0, ...values))
}

function employeeName(employee: EmployeeRow): string {
  return [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function periodDates(query: AbsenceInsightQuery): Array<{ label: string; startDate: string; endDate: string }> {
  if (query.period === 'month') return [{ label: `${query.year}-${String(query.month).padStart(2, '0')}`, startDate: query.startDate, endDate: query.endDate }]
  if (query.period !== 'year') return []
  return Array.from({ length: 12 }, (_, index) => {
    const start = new Date(Date.UTC(query.year, index, 1))
    const end = new Date(Date.UTC(query.year, index + 1, 0))
    return { label: isoDate(start).slice(0, 7), startDate: isoDate(start), endDate: isoDate(end) }
  })
}

export async function getAbsenceInsightReport(query: AbsenceInsightQuery): Promise<AbsenceInsightReport> {
  const context = await requirePermission('report-absence:read')
  await requirePermission('employee:read')
  if (!context.administrationId) throw new AbsenceInsightsServiceError('INSIGHTS_ADMINISTRATION_REQUIRED', 400)
  const supabase = await createClient()
  const administrationId = context.administrationId

  const [employmentResult, departmentsResult, organizationResult, scheduleResult, caseResult] = await Promise.all([
    supabase.from('employments').select('id,employee_id,starts_on,ends_on').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', query.endDate).or(`ends_on.is.null,ends_on.gte.${query.startDate}`).limit(5000),
    supabase.from('departments').select('id,name').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).eq('is_active', true).order('name').limit(500),
    supabase.from('employee_organizations').select('employee_id,employment_id,department_id,effective_from,effective_to').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).lte('effective_from', query.endDate).or(`effective_to.is.null,effective_to.gte.${query.startDate}`).limit(10000),
    supabase.from('employment_schedules').select('employment_id,schedule_type,monday_hours,tuesday_hours,wednesday_hours,thursday_hours,friday_hours,saturday_hours,sunday_hours,part_time_factor,valid_from,valid_until').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).lte('valid_from', query.endDate).or(`valid_until.is.null,valid_until.gte.${query.startDate}`).limit(10000),
    supabase.from('absence_cases').select('id,employee_id,employment_id,status,first_absence_on,archived_at').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).is('archived_at', null).lte('first_absence_on', query.endDate).limit(10000),
  ])
  if (employmentResult.error) fail(employmentResult.error)
  if (departmentsResult.error) fail(departmentsResult.error)
  if (organizationResult.error) fail(organizationResult.error)
  if (scheduleResult.error) fail(scheduleResult.error)
  if (caseResult.error) fail(caseResult.error)

  const employments = employmentResult.data as EmploymentRow[]
  const departments = departmentsResult.data as AbsenceInsightDepartment[]
  const organizations = organizationResult.data as OrganizationRow[]
  const schedules = scheduleResult.data as ScheduleRow[]
  const cases = (caseResult.data as CaseRow[]).filter((item) => item.first_absence_on <= query.endDate)
  const employeeIds = [...new Set(employments.map((item) => item.employee_id))]
  const caseIds = cases.map((item) => item.id)
  const [employeesResult, spellsResult] = await Promise.all([
    employeeIds.length ? supabase.from('employees').select('id,first_name,birth_name_prefix,birth_name').eq('tenant_id', context.tenantId).in('id', employeeIds).is('deleted_at', null).limit(10000) : Promise.resolve({ data: [], error: null }),
    caseIds.length ? supabase.from('absence_spells').select('id,case_id,started_on,recovered_on').eq('tenant_id', context.tenantId).in('case_id', caseIds).limit(10000) : Promise.resolve({ data: [], error: null }),
  ])
  if (employeesResult.error) fail(employeesResult.error)
  if (spellsResult.error) fail(spellsResult.error)
  const spellIds = (spellsResult.data as Array<{ id: string }>).map((spell) => spell.id)
  const capacitiesResult = spellIds.length
    ? await supabase.from('absence_capacity_changes').select('spell_id,effective_on,absence_percentage').eq('tenant_id', context.tenantId).in('spell_id', spellIds).limit(20000)
    : { data: [], error: null }
  if (capacitiesResult.error) fail(capacitiesResult.error)
  const employees = employeesResult.data as EmployeeRow[]
  const spells = spellsResult.data as SpellRow[]
  const capacities = capacitiesResult.data as CapacityRow[]
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]))
  const departmentMap = new Map(departments.map((department) => [department.id, department.name]))
  const organizationByEmployment = new Map<string, OrganizationRow>()
  for (const organization of organizations) {
    if (!organization.employment_id) continue
    const current = organizationByEmployment.get(organization.employment_id)
    if (!current || organization.effective_from > current.effective_from) organizationByEmployment.set(organization.employment_id, organization)
  }
  const casesByEmployment = new Map<string, CaseRow[]>()
  for (const item of cases) casesByEmployment.set(item.employment_id, [...(casesByEmployment.get(item.employment_id) ?? []), item])

  function calculate(periodStart: string, periodEnd: string): { sickHours: number; availableHours: number; sickDays: number; availableDays: number; rows: AbsenceInsightRow[] } {
    let sickHours = 0
    let availableHours = 0
    let sickDays = 0
    let availableDays = 0
    const rowMap = new Map<string, AbsenceInsightRow>()
    for (const employment of employments) {
      const activeStart = maxDate(periodStart, employment.starts_on)
      const activeEnd = minDate(periodEnd, employment.ends_on ?? periodEnd)
      if (activeStart > activeEnd) continue
      const employmentCases = casesByEmployment.get(employment.id) ?? []
      const organization = organizationByEmployment.get(employment.id)
      if (query.departmentId && organization?.department_id !== query.departmentId) continue
      const employee = employeeMap.get(employment.employee_id)
      if (!employee) continue
      const employeeCaseIds = new Set(employmentCases.map((item) => item.id))
      let employeeSickHours = 0
      let employeeSickDays = 0
      let employeeAvailableHours = 0
      let employeeAvailableDays = 0
      const employeeSpells = spells.filter((spell) => employeeCaseIds.has(spell.case_id) && spell.started_on <= periodEnd && (spell.recovered_on === null || spell.recovered_on >= periodStart))
      const cursor = parseDate(activeStart)
      const end = parseDate(activeEnd)
      while (cursor <= end) {
        const date = dayKey(cursor)
        const schedule = activeSchedule(schedules, employment.id, date)
        const hours = scheduledHours(schedule, cursor)
        const capacity = capacityForDay(spells.filter((spell) => employeeCaseIds.has(spell.case_id)), capacities, employeeCaseIds, date)
        employeeAvailableHours += hours
        employeeAvailableDays += hours > 0 ? 1 : 0
        employeeSickHours += hours * capacity / 100
        employeeSickDays += (hours > 0 ? 1 : 0) * capacity / 100
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
      availableHours += employeeAvailableHours
      availableDays += employeeAvailableDays
      sickHours += employeeSickHours
      sickDays += employeeSickDays
      if (employeeSickHours > 0) {
        const current = rowMap.get(employee.id)
        const latestCase = [...employmentCases].sort((left, right) => right.first_absence_on.localeCompare(left.first_absence_on))[0]
        rowMap.set(employee.id, {
          employeeId: employee.id,
          employeeName: employeeName(employee),
          departmentId: organization?.department_id ?? null,
          departmentName: organization ? departmentMap.get(organization.department_id) ?? null : null,
          status: latestCase?.status ?? 'ACTIVE',
          firstAbsenceOn: latestCase?.first_absence_on ?? periodStart,
          caseCount: (current?.caseCount ?? 0) + new Set(employeeSpells.map((spell) => spell.case_id)).size,
          absenceOccurrences: (current?.absenceOccurrences ?? 0) + employeeSpells.length,
          sickDays: round((current?.sickDays ?? 0) + employeeSickDays),
          sickHours: round((current?.sickHours ?? 0) + employeeSickHours),
          absenceRate: 0,
        })
        const row = rowMap.get(employee.id)
        if (row) row.absenceRate = round(employeeAvailableHours ? employeeSickHours / employeeAvailableHours * 100 : 0)
      }
    }
    return { sickHours: round(sickHours), availableHours: round(availableHours), sickDays: round(sickDays), availableDays: round(availableDays), rows: [...rowMap.values()].sort((left, right) => right.sickHours - left.sickHours || left.employeeName.localeCompare(right.employeeName, 'nl')) }
  }

  const current = calculate(query.startDate, query.endDate)
  const periodCaseIds = new Set(spells.filter((spell) => spell.started_on <= query.endDate && (spell.recovered_on === null || spell.recovered_on >= query.startDate)).map((spell) => spell.case_id))
  const trend = periodDates(query).map((period) => {
    const result = calculate(period.startDate, period.endDate)
    return { ...period, sickHours: result.sickHours, availableHours: result.availableHours, absenceRate: round(result.availableHours ? result.sickHours / result.availableHours * 100 : 0) }
  })
  return {
    report: 'absence',
    period: { mode: query.period, year: query.year, month: query.month, startDate: query.startDate, endDate: query.endDate },
    absenceCases: cases.filter((item) => periodCaseIds.has(item.id)).length,
    activeCases: cases.filter((item) => periodCaseIds.has(item.id) && (item.status === 'ACTIVE' || item.status === 'RECOVERY_WINDOW')).length,
    sickHours: current.sickHours,
    availableHours: current.availableHours,
    sickDays: current.sickDays,
    availableDays: current.availableDays,
    absenceRate: round(current.availableHours ? current.sickHours / current.availableHours * 100 : 0),
    rows: current.rows,
    departments,
    trend,
  }
}
