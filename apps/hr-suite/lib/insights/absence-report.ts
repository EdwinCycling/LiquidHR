import { AuthorizationError } from '@/lib/auth/permissions'
import { aggregateAbsenceEmployeeMetrics, type AbsenceEmploymentMetric } from './absence-report-calculations'
import { AbsenceInsightsServiceError } from './absence-insight-error'
import { getAbsenceInsightScope } from './absence-insight-scope'

export { AbsenceInsightsServiceError } from './absence-insight-error'

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
  sickDays: number | null
  sickHours: number | null
  absenceRate: number | null
  dataQuality: AbsenceInsightDataQuality
}

export interface AbsenceInsightDataQuality {
  complete: boolean
  unknownScheduleDays: number
  unknownCapacityDays: number
  unknownPlacements: number
}

export interface AbsenceInsightPeriod {
  label: string
  startDate: string
  endDate: string
  sickHours: number | null
  availableHours: number | null
  absenceRate: number | null
  dataQuality: AbsenceInsightDataQuality
}

export interface AbsenceInsightReport {
  report: 'absence'
  period: { mode: AbsenceInsightQuery['period']; year: number; month: number; startDate: string; endDate: string }
  absenceCases: number
  activeCases: number
  sickHours: number | null
  availableHours: number | null
  sickDays: number | null
  availableDays: number | null
  absenceRate: number | null
  dataQuality: AbsenceInsightDataQuality
  rows: AbsenceInsightRow[]
  departments: AbsenceInsightDepartment[]
  trend: AbsenceInsightPeriod[]
}

type EmploymentRow = { id: string; employee_id: string; administration_id: string; starts_on: string; ends_on: string | null }
type EmployeeRow = { id: string; first_name: string; birth_name_prefix: string | null; birth_name: string }
type OrganizationRow = { employee_id: string; employment_id: string; administration_id: string; department_id: string; effective_from: string; effective_to: string | null }
type ScheduleRow = { employment_id: string; administration_id: string; schedule_type: string; monday_hours: number | null; tuesday_hours: number | null; wednesday_hours: number | null; thursday_hours: number | null; friday_hours: number | null; saturday_hours: number | null; sunday_hours: number | null; part_time_factor: number; valid_from: string; valid_until: string | null }
type CaseRow = { id: string; employee_id: string; employment_id: string; administration_id: string; status: string; first_absence_on: string; archived_at: string | null }
type SpellRow = { id: string; case_id: string; started_on: string; recovered_on: string | null }
type CapacityRow = { spell_id: string; effective_on: string; absence_percentage: number; scheduled_hours_per_week_snapshot: number | null; absence_hours_per_week: number | null }

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

function scheduledHours(schedule: ScheduleRow | undefined, date: Date): number | null {
  if (!schedule) return null
  const values = [schedule.sunday_hours, schedule.monday_hours, schedule.tuesday_hours, schedule.wednesday_hours, schedule.thursday_hours, schedule.friday_hours, schedule.saturday_hours]
  const value = values[date.getUTCDay()]
  return value === null ? null : Math.max(0, Number(value))
}

function activeSchedule(schedules: ScheduleRow[], employmentId: string, date: string): ScheduleRow | undefined {
  const matching = schedules.filter((schedule) => schedule.employment_id === employmentId && schedule.valid_from <= date && (schedule.valid_until === null || schedule.valid_until >= date))
  return matching.length === 1 ? matching[0] : undefined
}

function capacityForDay(spells: SpellRow[], capacities: CapacityRow[], date: string): number | null {
  const activeSpells = spells.filter((spell) => spell.started_on <= date && (spell.recovered_on === null || spell.recovered_on >= date))
  if (!activeSpells.length) return 0
  const values = activeSpells.map((spell) => {
    const changes = capacities.filter((change) => change.spell_id === spell.id && change.effective_on <= date).sort((left, right) => right.effective_on.localeCompare(left.effective_on))
    const change = changes[0]
    if (!change) return null
    if (change.scheduled_hours_per_week_snapshot && change.scheduled_hours_per_week_snapshot > 0 && change.absence_hours_per_week && change.absence_hours_per_week > 0) {
      return Math.min(100, Math.max(0, change.absence_hours_per_week / change.scheduled_hours_per_week_snapshot * 100))
    }
    return change.absence_percentage
  })
  if (values.some((value) => value === null)) return null
  const knownValues = values.filter((value): value is number => value !== null)
  return Math.min(100, Math.max(0, ...knownValues))
}

function quality(unknownScheduleDays: number, unknownCapacityDays: number, unknownPlacements: number): AbsenceInsightDataQuality {
  return { complete: unknownScheduleDays === 0 && unknownCapacityDays === 0 && unknownPlacements === 0, unknownScheduleDays, unknownCapacityDays, unknownPlacements }
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
  const scope = await getAbsenceInsightScope()
  if (scope.scopeTruncated) throw new AbsenceInsightsServiceError('INSIGHTS_SCOPE_LIMIT_REACHED', 403)
  const { supabase, context, hrGroupId, administrationId, employeeIds: directTeamEmployeeIds } = scope
  if (directTeamEmployeeIds?.length === 0) return emptyAbsenceReport(query)

  // Insights is a report read. Lifecycle normalization remains in the absence domain service.
  let employmentQuery = supabase.from('employments').select('id,employee_id,administration_id,starts_on,ends_on')
    .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId)
    .eq('record_status', 'CONFIRMED').is('deleted_at', null)
    .lte('starts_on', query.endDate).or(`ends_on.is.null,ends_on.gte.${query.startDate}`).limit(5000)
  if (directTeamEmployeeIds) employmentQuery = employmentQuery.in('employee_id', [...directTeamEmployeeIds])
  const employmentResult = await employmentQuery
  if (employmentResult.error) fail(employmentResult.error)
  const employments = (employmentResult.data ?? []) as EmploymentRow[]
  if (employments.length >= 5000) throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  if (employments.some((row) => row.administration_id !== administrationId || (directTeamEmployeeIds && !directTeamEmployeeIds.includes(row.employee_id)))) {
    throw new AuthorizationError('Een of meer dienstverbanden vallen buiten je toegestane scope.')
  }
  if (!employments.length) return emptyAbsenceReport(query)

  const employmentIds = [...new Set(employments.map((item) => item.id))]
  const employeeIds = [...new Set(employments.map((item) => item.employee_id))]
  let organizationQuery = supabase.from('employee_organizations').select('employee_id,employment_id,administration_id,department_id,effective_from,effective_to')
    .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId)
    .in('employment_id', employmentIds).in('employee_id', employeeIds)
    .lte('effective_from', query.endDate).or(`effective_to.is.null,effective_to.gte.${query.startDate}`).limit(10000)
  const scheduleQuery = supabase.from('employment_schedules').select('employment_id,administration_id,schedule_type,monday_hours,tuesday_hours,wednesday_hours,thursday_hours,friday_hours,saturday_hours,sunday_hours,part_time_factor,valid_from,valid_until')
    .eq('tenant_id', context.tenantId).eq('administration_id', administrationId).in('employment_id', employmentIds)
    .lte('valid_from', query.endDate).or(`valid_until.is.null,valid_until.gte.${query.startDate}`).limit(10000)
  let caseQuery = supabase.from('absence_cases').select('id,employee_id,employment_id,administration_id,status,first_absence_on,archived_at')
    .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId)
    .eq('pending_confirmation', false).is('archived_at', null).in('employment_id', employmentIds).in('employee_id', employeeIds)
    .lte('first_absence_on', query.endDate).limit(10000)
  if (directTeamEmployeeIds) {
    const allowedEmployeeIds = [...directTeamEmployeeIds]
    organizationQuery = organizationQuery.in('employee_id', allowedEmployeeIds)
    caseQuery = caseQuery.in('employee_id', allowedEmployeeIds)
  }
  const [employeeResult, organizationResult, scheduleResult, caseResult] = await Promise.all([
    supabase.from('employees').select('id,first_name,birth_name_prefix,birth_name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', employeeIds).is('deleted_at', null).limit(10000),
    organizationQuery,
    scheduleQuery,
    caseQuery,
  ])
  if (employeeResult.error) fail(employeeResult.error)
  if (organizationResult.error) fail(organizationResult.error)
  if (scheduleResult.error) fail(scheduleResult.error)
  if (caseResult.error) fail(caseResult.error)

  const employees = (employeeResult.data ?? []) as EmployeeRow[]
  const organizations = (organizationResult.data ?? []) as OrganizationRow[]
  const schedules = (scheduleResult.data ?? []) as ScheduleRow[]
  const cases = (caseResult.data ?? []) as CaseRow[]
  if (employees.length >= 10000 || organizations.length >= 10000 || schedules.length >= 10000 || cases.length >= 10000) {
    throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  }
  if (employees.length !== employeeIds.length) throw new AuthorizationError('De medewerker- en dienstverbandtoegang sluiten niet op elkaar aan.')
  if (organizations.some((row) => row.administration_id !== administrationId || !employmentIds.includes(row.employment_id) || !employeeIds.includes(row.employee_id) || (directTeamEmployeeIds && !directTeamEmployeeIds.includes(row.employee_id)))) {
    throw new AuthorizationError('Een of meer organisatieplaatsingen vallen buiten je toegestane scope.')
  }
  if (schedules.some((row) => row.administration_id !== administrationId || !employmentIds.includes(row.employment_id))) {
    throw new AuthorizationError('Een of meer roosters vallen buiten je toegestane scope.')
  }
  const employmentById = new Map(employments.map((row) => [row.id, row]))
  if (cases.some((row) => row.administration_id !== administrationId || employmentById.get(row.employment_id)?.employee_id !== row.employee_id)) {
    throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_INCONSISTENT', 503)
  }

  const departmentIds = [...new Set(organizations.map((item) => item.department_id))]
  const departmentResult = departmentIds.length
    ? await supabase.from('departments').select('id,name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', departmentIds).limit(500)
    : { data: [], error: null }
  if (departmentResult.error) fail(departmentResult.error)
  const departments = (departmentResult.data ?? []) as AbsenceInsightDepartment[]
  if (departments.length >= 500) throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)

  const caseIds = cases.map((item) => item.id)
  const spellsResult = caseIds.length
    ? await supabase.from('absence_spells').select('id,case_id,started_on,recovered_on').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('case_id', caseIds).limit(10000)
    : { data: [], error: null }
  if (spellsResult.error) fail(spellsResult.error)
  const spells = (spellsResult.data ?? []) as SpellRow[]
  if (spells.length >= 10000) throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  if (spells.some((spell) => !caseIds.includes(spell.case_id))) throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_INCONSISTENT', 503)
  const spellIds = spells.map((spell) => spell.id)
  const capacitiesResult = spellIds.length
    ? await supabase.from('absence_capacity_changes').select('spell_id,effective_on,absence_percentage,scheduled_hours_per_week_snapshot,absence_hours_per_week').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('spell_id', spellIds).limit(20000)
    : { data: [], error: null }
  if (capacitiesResult.error) fail(capacitiesResult.error)
  const capacities = (capacitiesResult.data ?? []) as CapacityRow[]
  if (capacities.length >= 20000) throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  if (capacities.some((capacity) => !spellIds.includes(capacity.spell_id))) throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_INCONSISTENT', 503)

  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]))
  const departmentMap = new Map(departments.map((department) => [department.id, department.name]))
  const organizationsByEmployment = new Map<string, OrganizationRow[]>()
  for (const organization of organizations) organizationsByEmployment.set(organization.employment_id, [...(organizationsByEmployment.get(organization.employment_id) ?? []), organization])
  const casesByEmployment = new Map<string, CaseRow[]>()
  for (const item of cases) casesByEmployment.set(item.employment_id, [...(casesByEmployment.get(item.employment_id) ?? []), item])
  const spellsByCase = new Map<string, SpellRow[]>()
  for (const spell of spells) spellsByCase.set(spell.case_id, [...(spellsByCase.get(spell.case_id) ?? []), spell])

  function calculate(periodStart: string, periodEnd: string) {
    const employmentMetrics: AbsenceEmploymentMetric[] = []
    const includedCases = new Map<string, CaseRow>()
    for (const employment of employments) {
      const activeStart = maxDate(periodStart, employment.starts_on)
      const activeEnd = minDate(periodEnd, employment.ends_on ?? periodEnd)
      if (activeStart > activeEnd) continue
      const employee = employeeMap.get(employment.employee_id)
      if (!employee) continue
      const placementDate = minDate(periodEnd, employment.ends_on ?? periodEnd)
      const matchingPlacements = (organizationsByEmployment.get(employment.id) ?? []).filter((item) => item.effective_from <= placementDate && (item.effective_to === null || item.effective_to >= placementDate))
      const organization = matchingPlacements.length === 1 ? matchingPlacements[0] : null
      if (query.departmentId && !organization) throw new AbsenceInsightsServiceError('INSIGHTS_PLACEMENT_SCOPE_INCOMPLETE', 503)
      if (query.departmentId && organization?.department_id !== query.departmentId) continue

      const employmentCases = casesByEmployment.get(employment.id) ?? []
      const employmentCaseIds = new Set(employmentCases.map((item) => item.id))
      const employmentSpells = [...employmentCaseIds].flatMap((caseId) => spellsByCase.get(caseId) ?? [])
        .filter((spell) => spell.started_on <= periodEnd && (spell.recovered_on === null || spell.recovered_on >= periodStart))
      const activeCaseIds = new Set(employmentSpells.map((spell) => spell.case_id))
      for (const absenceCase of employmentCases) if (activeCaseIds.has(absenceCase.id)) includedCases.set(absenceCase.id, absenceCase)

      let sickHours = 0
      let sickDays = 0
      let availableHours = 0
      let availableDays = 0
      let unknownScheduleDays = 0
      let unknownCapacityDays = 0
      const cursor = parseDate(activeStart)
      const end = parseDate(activeEnd)
      while (cursor <= end) {
        const date = dayKey(cursor)
        const schedule = activeSchedule(schedules, employment.id, date)
        const hours = scheduledHours(schedule, cursor)
        const dailySpells = employmentSpells.filter((spell) => spell.started_on <= date && (spell.recovered_on === null || spell.recovered_on >= date))
        const capacity = dailySpells.length ? capacityForDay(dailySpells, capacities, date) : 0
        if (hours === null) unknownScheduleDays += 1
        if (dailySpells.length && (hours === null || hours > 0) && capacity === null) unknownCapacityDays += 1
        if (hours !== null) {
          availableHours += hours
          availableDays += hours > 0 ? 1 : 0
          if (hours > 0 && dailySpells.length) {
            if (capacity !== null) {
              sickHours += hours * capacity / 100
              sickDays += capacity / 100
            }
          }
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
      const latestCase = [...employmentCases].sort((left, right) => right.first_absence_on.localeCompare(left.first_absence_on))[0]
      employmentMetrics.push({
        employeeId: employee.id,
        employeeName: employeeName(employee),
        departmentId: organization?.department_id ?? null,
        departmentName: organization ? departmentMap.get(organization.department_id) ?? null : null,
        status: latestCase?.status ?? 'ACTIVE',
        firstAbsenceOn: latestCase?.first_absence_on ?? periodStart,
        availableHours,
        availableDays,
        sickHours,
        sickDays,
        unknownScheduleDays,
        unknownCapacityDays,
        unknownPlacements: organization ? 0 : 1,
        caseIds: [...activeCaseIds],
        spellIds: employmentSpells.map((spell) => spell.id),
      })
    }

    const totalUnknownScheduleDays = employmentMetrics.reduce((total, item) => total + item.unknownScheduleDays, 0)
    const totalUnknownCapacityDays = employmentMetrics.reduce((total, item) => total + item.unknownCapacityDays, 0)
    const totalUnknownPlacements = employmentMetrics.reduce((total, item) => total + item.unknownPlacements, 0)
    const dataQuality = quality(totalUnknownScheduleDays, totalUnknownCapacityDays, totalUnknownPlacements)
    const knownAvailableHours = employmentMetrics.reduce((total, item) => total + item.availableHours, 0)
    const knownAvailableDays = employmentMetrics.reduce((total, item) => total + item.availableDays, 0)
    const knownSickHours = employmentMetrics.reduce((total, item) => total + item.sickHours, 0)
    const knownSickDays = employmentMetrics.reduce((total, item) => total + item.sickDays, 0)
    const availabilityComplete = totalUnknownScheduleDays === 0
    const sicknessComplete = availabilityComplete && totalUnknownCapacityDays === 0
    const availableHours = availabilityComplete ? round(knownAvailableHours) : null
    const sickHours = sicknessComplete ? round(knownSickHours) : null
    const sickDays = sicknessComplete ? round(knownSickDays) : null
    const availableDays = availabilityComplete ? round(knownAvailableDays) : null
    const rows = aggregateAbsenceEmployeeMetrics(employmentMetrics)
      .filter((metric) => metric.caseIds.size > 0)
      .map((metric): AbsenceInsightRow => {
        const rowQuality = quality(metric.unknownScheduleDays, metric.unknownCapacityDays, metric.unknownPlacements)
        const rowAvailabilityComplete = metric.unknownScheduleDays === 0
        const rowSicknessComplete = rowAvailabilityComplete && metric.unknownCapacityDays === 0
        const rowAvailableHours = rowAvailabilityComplete ? round(metric.availableHours) : null
        const rowSickHours = rowSicknessComplete ? round(metric.sickHours) : null
        return {
          employeeId: metric.employeeId,
          employeeName: metric.employeeName,
          departmentId: metric.departmentId,
          departmentName: metric.departmentName,
          status: metric.status,
          firstAbsenceOn: metric.firstAbsenceOn,
          caseCount: metric.caseIds.size,
          absenceOccurrences: metric.spellIds.size,
          sickDays: rowSicknessComplete ? round(metric.sickDays) : null,
          sickHours: rowSickHours,
          absenceRate: rowAvailableHours && rowSickHours !== null ? round(rowSickHours / rowAvailableHours * 100) : null,
          dataQuality: rowQuality,
        }
      })
      .sort((left, right) => (right.sickHours ?? -1) - (left.sickHours ?? -1) || left.employeeName.localeCompare(right.employeeName, 'nl'))
    return { sickHours, availableHours, sickDays, availableDays, absenceRate: availableHours && sickHours !== null ? round(sickHours / availableHours * 100) : null, rows, dataQuality, cases: [...includedCases.values()] }
  }

  const current = calculate(query.startDate, query.endDate)
  const trend = periodDates(query).map((period) => {
    const result = calculate(period.startDate, period.endDate)
    return { ...period, sickHours: result.sickHours, availableHours: result.availableHours, absenceRate: result.absenceRate, dataQuality: result.dataQuality }
  })
  return {
    report: 'absence',
    period: { mode: query.period, year: query.year, month: query.month, startDate: query.startDate, endDate: query.endDate },
    absenceCases: current.cases.length,
    activeCases: current.cases.filter((item) => item.status === 'ACTIVE' || item.status === 'RECOVERY_WINDOW').length,
    sickHours: current.sickHours,
    availableHours: current.availableHours,
    sickDays: current.sickDays,
    availableDays: current.availableDays,
    absenceRate: current.absenceRate,
    dataQuality: current.dataQuality,
    rows: current.rows,
    departments,
    trend,
  }
}

function emptyAbsenceReport(query: AbsenceInsightQuery): AbsenceInsightReport {
  const dataQuality = quality(0, 0, 0)
  return {
    report: 'absence',
    period: { mode: query.period, year: query.year, month: query.month, startDate: query.startDate, endDate: query.endDate },
    absenceCases: 0, activeCases: 0,
    sickHours: 0, availableHours: 0, sickDays: 0, availableDays: 0,
    absenceRate: null, dataQuality, rows: [], departments: [], trend: [],
  }
}
