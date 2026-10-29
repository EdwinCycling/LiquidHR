import { AuthorizationError } from '@/lib/auth/permissions'
import { AbsenceInsightsServiceError } from './absence-insight-error'
import { getAbsenceInsightScope } from './absence-insight-scope'
import type { FrequentAbsenceQuery } from './frequent-absence-query'

export interface FrequentAbsenceRow {
  employeeId: string
  employeeName: string
  departmentName: string | null
  reportCount: number
  totalSickDays: number
  isFrequent: boolean
}

export interface FrequentAbsenceDepartment {
  id: string
  name: string
}

export interface FrequentAbsenceReport {
  report: 'absence-frequent'
  period: FrequentAbsenceQuery
  threshold: number
  rows: FrequentAbsenceRow[]
  departments: FrequentAbsenceDepartment[]
  totalEmployees: number
  frequentCount: number
  totalReports: number
  dataQuality: { complete: boolean; unknownPlacements: number }
}

type EmploymentRow = { id: string; employee_id: string; administration_id: string; starts_on: string; ends_on: string | null }
type EmployeeRow = { id: string; first_name: string; birth_name_prefix: string | null; birth_name: string }
type OrganizationRow = { employee_id: string; employment_id: string; administration_id: string; department_id: string; effective_from: string; effective_to: string | null }
type CaseRow = { id: string; employee_id: string; employment_id: string; administration_id: string; first_absence_on: string }
type SpellRow = { id: string; case_id: string; started_on: string; recovered_on: string | null }

function employeeName(employee: EmployeeRow): string {
  return [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function filterFrequentAbsenceRows(rows: readonly FrequentAbsenceRow[], query: Pick<FrequentAbsenceQuery, 'search' | 'frequentOnly'>): FrequentAbsenceRow[] {
  const search = query.search.trim().toLocaleLowerCase('nl-NL')
  return rows.filter((row) => (!query.frequentOnly || row.isFrequent) && row.employeeName.toLocaleLowerCase('nl-NL').includes(search))
}

function fail(code: string, error: { message?: string } | null): never {
  throw new AbsenceInsightsServiceError(error?.message?.startsWith('INSIGHTS_') ? error.message : code)
}

function emptyFrequentAbsenceReport(query: FrequentAbsenceQuery, threshold: number): FrequentAbsenceReport {
  return { report: 'absence-frequent', period: query, threshold, rows: [], departments: [], totalEmployees: 0, frequentCount: 0, totalReports: 0, dataQuality: { complete: true, unknownPlacements: 0 } }
}

function uniqueAbsenceCases(cases: readonly CaseRow[]): CaseRow[] {
  const unique = new Map<string, CaseRow>()
  for (const absenceCase of cases) if (!unique.has(absenceCase.id)) unique.set(absenceCase.id, absenceCase)
  return [...unique.values()]
}

export async function getFrequentAbsenceReport(query: FrequentAbsenceQuery): Promise<FrequentAbsenceReport> {
  const scope = await getAbsenceInsightScope()
  if (scope.scopeTruncated) throw new AbsenceInsightsServiceError('INSIGHTS_SCOPE_LIMIT_REACHED', 403)
  const { supabase, context, hrGroupId, administrationId, employeeIds: directTeamEmployeeIds } = scope

  let employmentQuery = supabase.from('employments').select('id,employee_id,administration_id,starts_on,ends_on')
    .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId)
    .eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', query.endDate)
    .or(`ends_on.is.null,ends_on.gte.${query.startDate}`).limit(5000)
  if (directTeamEmployeeIds) employmentQuery = employmentQuery.in('employee_id', [...directTeamEmployeeIds])
  const [settingsResult, employmentResult] = await Promise.all([
    supabase.from('absence_settings').select('frequent_absence_threshold').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).maybeSingle(),
    employmentQuery,
  ])
  if (settingsResult.error) fail('INSIGHTS_FREQUENT_SETTINGS_FAILED', settingsResult.error)
  if (employmentResult.error) fail('INSIGHTS_FREQUENT_REPORT_FAILED', employmentResult.error)
  const threshold = settingsResult.data?.frequent_absence_threshold ?? 3
  const employments = (employmentResult.data ?? []) as EmploymentRow[]
  if (employments.length >= 5000) throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  if (employments.some((row) => row.administration_id !== administrationId || (directTeamEmployeeIds && !directTeamEmployeeIds.includes(row.employee_id)))) {
    throw new AuthorizationError('Een of meer dienstverbanden vallen buiten je toegestane scope.')
  }
  if (!employments.length) return emptyFrequentAbsenceReport(query, threshold)

  const employmentIds = [...new Set(employments.map((item) => item.id))]
  const employeeIds = [...new Set(employments.map((item) => item.employee_id))]
  let organizationQuery = supabase.from('employee_organizations').select('employee_id,employment_id,administration_id,department_id,effective_from,effective_to')
    .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId)
    .in('employment_id', employmentIds).in('employee_id', employeeIds)
    .lte('effective_from', query.endDate).or(`effective_to.is.null,effective_to.gte.${query.startDate}`).limit(10000)
  let caseQuery = supabase.from('absence_cases').select('id,employee_id,employment_id,administration_id,first_absence_on')
    .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('administration_id', administrationId)
    .eq('pending_confirmation', false).is('archived_at', null).in('employment_id', employmentIds).in('employee_id', employeeIds)
    .gte('first_absence_on', query.startDate).lte('first_absence_on', query.endDate).limit(10000)
  if (directTeamEmployeeIds) {
    const allowedEmployeeIds = [...directTeamEmployeeIds]
    organizationQuery = organizationQuery.in('employee_id', allowedEmployeeIds)
    caseQuery = caseQuery.in('employee_id', allowedEmployeeIds)
  }
  const [organizationResult, caseResult, employeesResult] = await Promise.all([
    organizationQuery,
    caseQuery,
    supabase.from('employees').select('id,first_name,birth_name_prefix,birth_name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', employeeIds).is('deleted_at', null).limit(10000),
  ])
  if (organizationResult.error) fail('INSIGHTS_FREQUENT_REPORT_FAILED', organizationResult.error)
  if (caseResult.error) fail('INSIGHTS_FREQUENT_REPORT_FAILED', caseResult.error)
  if (employeesResult.error) fail('INSIGHTS_FREQUENT_REPORT_FAILED', employeesResult.error)

  const organizations = (organizationResult.data ?? []) as OrganizationRow[]
  const sourceCases = (caseResult.data ?? []) as CaseRow[]
  if (sourceCases.length >= 10000) throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  const cases = uniqueAbsenceCases(sourceCases)
  const employees = (employeesResult.data ?? []) as EmployeeRow[]
  if (organizations.length >= 10000 || employees.length >= 10000) throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  if (employees.length !== employeeIds.length) throw new AuthorizationError('De medewerker- en dienstverbandtoegang sluiten niet op elkaar aan.')
  const employmentById = new Map(employments.map((item) => [item.id, item]))
  if (organizations.some((row) => row.administration_id !== administrationId || employmentById.get(row.employment_id)?.employee_id !== row.employee_id || (directTeamEmployeeIds && !directTeamEmployeeIds.includes(row.employee_id)))) {
    throw new AuthorizationError('Een of meer organisatieplaatsingen vallen buiten je toegestane scope.')
  }
  if (cases.some((row) => row.administration_id !== administrationId || employmentById.get(row.employment_id)?.employee_id !== row.employee_id)) {
    throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_INCONSISTENT', 503)
  }

  const departmentIds = [...new Set(organizations.map((item) => item.department_id))]
  const departmentResult = departmentIds.length
    ? await supabase.from('departments').select('id,name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', departmentIds).limit(500)
    : { data: [], error: null }
  if (departmentResult.error) fail('INSIGHTS_FREQUENT_REPORT_FAILED', departmentResult.error)
  const departmentRecords = (departmentResult.data ?? []) as FrequentAbsenceDepartment[]
  if (departmentRecords.length >= 500) throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  const caseIds = cases.map((item) => item.id)
  const spellsResult = caseIds.length
    ? await supabase.from('absence_spells').select('id,case_id,started_on,recovered_on').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('case_id', caseIds).limit(10000)
    : { data: [], error: null }
  if (spellsResult.error) fail('INSIGHTS_FREQUENT_REPORT_FAILED', spellsResult.error)
  const spells = (spellsResult.data ?? []) as SpellRow[]
  if (spells.length >= 10000) throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  if (spells.some((spell) => !caseIds.includes(spell.case_id))) throw new AbsenceInsightsServiceError('INSIGHTS_SOURCE_INCONSISTENT', 503)

  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]))
  const departmentMap = new Map(departmentRecords.map((department) => [department.id, department.name]))
  const organizationsByEmployment = new Map<string, OrganizationRow[]>()
  for (const organization of organizations) organizationsByEmployment.set(organization.employment_id, [...(organizationsByEmployment.get(organization.employment_id) ?? []), organization])
  const placementForDate = (employmentId: string, date: string): OrganizationRow | null => {
    const placements = (organizationsByEmployment.get(employmentId) ?? []).filter((item) => item.effective_from <= date && (item.effective_to === null || item.effective_to >= date))
    return placements.length === 1 ? placements[0] : null
  }
  const accessibleDepartmentIds = new Set(organizations.map((organization) => organization.department_id))
  if (query.departmentId && !accessibleDepartmentIds.has(query.departmentId)) throw new AuthorizationError('De geselecteerde afdeling valt buiten je toegestane scope.')
  const departments = departmentRecords.filter((department) => accessibleDepartmentIds.has(department.id)).sort((left, right) => left.name.localeCompare(right.name, 'nl'))

  const spellsByCase = new Map<string, SpellRow[]>()
  for (const spell of spells) spellsByCase.set(spell.case_id, [...(spellsByCase.get(spell.case_id) ?? []), spell])

  interface EmployeeAccumulator {
    reportCount: number
    totalSickDays: number
    sickDates: Set<string>
    departmentName: string | null
  }
  const accumulator = new Map<string, EmployeeAccumulator>()
  const unknownPlacementEmploymentIds = new Set<string>()
  for (const absenceCase of cases) {
    const employment = employmentById.get(absenceCase.employment_id)
    if (!employment) continue
    const organization = placementForDate(employment.id, absenceCase.first_absence_on)
    if (!organization) {
      unknownPlacementEmploymentIds.add(employment.id)
      if (query.departmentId) throw new AbsenceInsightsServiceError('INSIGHTS_PLACEMENT_SCOPE_INCOMPLETE', 503)
    }
    if (query.departmentId && organization?.department_id !== query.departmentId) continue
    const employee = employeeMap.get(employment.employee_id)
    if (!employee) continue

    const uniqueSickDates = new Set<string>()
    for (const spell of spellsByCase.get(absenceCase.id) ?? []) {
      const spellEnd = spell.recovered_on ?? query.endDate
      const effectiveStart = spell.started_on > query.startDate ? spell.started_on : query.startDate
      const effectiveEnd = spellEnd < query.endDate ? spellEnd : query.endDate
      if (effectiveStart <= effectiveEnd) {
        const cursor = new Date(`${effectiveStart}T00:00:00Z`)
        const end = new Date(`${effectiveEnd}T00:00:00Z`)
        while (cursor <= end) {
          uniqueSickDates.add(cursor.toISOString().slice(0, 10))
          cursor.setUTCDate(cursor.getUTCDate() + 1)
        }
      }
    }
    const current = accumulator.get(employee.id)
    if (current) {
      current.reportCount += 1
      for (const date of uniqueSickDates) current.sickDates.add(date)
      current.totalSickDays = current.sickDates.size
      const currentDepartmentName = organization ? departmentMap.get(organization.department_id) ?? null : null
      if (current.departmentName !== currentDepartmentName) current.departmentName = null
    } else {
      accumulator.set(employee.id, {
        reportCount: 1,
        totalSickDays: uniqueSickDates.size,
        sickDates: uniqueSickDates,
        departmentName: organization ? departmentMap.get(organization.department_id) ?? null : null,
      })
    }
  }

  const calculatedRows: FrequentAbsenceRow[] = [...accumulator.entries()].map(([employeeId, data]) => {
    const employee = employeeMap.get(employeeId)
    return {
      employeeId,
      employeeName: employee ? employeeName(employee) : '',
      departmentName: data.departmentName,
      reportCount: data.reportCount,
      totalSickDays: round(data.totalSickDays),
      isFrequent: data.reportCount >= threshold,
    }
  }).filter((row) => row.employeeName).sort((left, right) => right.reportCount - left.reportCount || left.employeeName.localeCompare(right.employeeName, 'nl'))
  const rows = filterFrequentAbsenceRows(calculatedRows, query)

  return {
    report: 'absence-frequent',
    period: query,
    threshold,
    rows,
    departments,
    totalEmployees: rows.length,
    frequentCount: rows.filter((row) => row.isFrequent).length,
    totalReports: rows.reduce((total, row) => total + row.reportCount, 0),
    dataQuality: { complete: unknownPlacementEmploymentIds.size === 0, unknownPlacements: unknownPlacementEmploymentIds.size },
  }
}
