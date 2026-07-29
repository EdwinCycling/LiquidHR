import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
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
}

type EmploymentRow = { id: string; employee_id: string; starts_on: string; ends_on: string | null }
type EmployeeRow = { id: string; first_name: string; birth_name_prefix: string | null; birth_name: string }
type OrganizationRow = { employee_id: string; employment_id: string | null; department_id: string; effective_from: string; effective_to: string | null }
type CaseRow = { id: string; employee_id: string; employment_id: string; first_absence_on: string }
type SpellRow = { id: string; case_id: string; started_on: string; recovered_on: string | null }

function employeeName(employee: EmployeeRow): string {
  return [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function daysBetween(start: string, end: string): number {
  const startDate = new Date(`${start}T00:00:00Z`)
  const endDate = new Date(`${end}T00:00:00Z`)
  return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1)
}

export async function getFrequentAbsenceReport(query: FrequentAbsenceQuery): Promise<FrequentAbsenceReport> {
  const context = await requirePermission('report-absence:read')
  await requirePermission('employee:read')
  if (!context.administrationId) throw new Error('INSIGHTS_ADMINISTRATION_REQUIRED')
  const supabase = await createClient()
  const administrationId = context.administrationId

  const [settingsResult, employmentResult, departmentsResult, organizationResult, caseResult] = await Promise.all([
    supabase.from('absence_settings').select('frequent_absence_threshold').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).maybeSingle(),
    supabase.from('employments').select('id,employee_id,starts_on,ends_on').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', query.endDate).or(`ends_on.is.null,ends_on.gte.${query.startDate}`).limit(5000),
    supabase.from('departments').select('id,name').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).eq('is_active', true).order('name').limit(500),
    supabase.from('employee_organizations').select('employee_id,employment_id,department_id,effective_from,effective_to').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).lte('effective_from', query.endDate).or(`effective_to.is.null,effective_to.gte.${query.startDate}`).limit(10000),
    supabase.from('absence_cases').select('id,employee_id,employment_id,first_absence_on').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).is('archived_at', null).gte('first_absence_on', query.startDate).lte('first_absence_on', query.endDate).limit(10000),
  ])
  if (settingsResult.error) throw new Error('INSIGHTS_FREQUENT_SETTINGS_FAILED')
  if (employmentResult.error) throw new Error('INSIGHTS_FREQUENT_REPORT_FAILED')
  if (departmentsResult.error) throw new Error('INSIGHTS_FREQUENT_REPORT_FAILED')
  if (organizationResult.error) throw new Error('INSIGHTS_FREQUENT_REPORT_FAILED')
  if (caseResult.error) throw new Error('INSIGHTS_FREQUENT_REPORT_FAILED')

  const threshold = settingsResult.data?.frequent_absence_threshold ?? 3
  const employments = employmentResult.data as EmploymentRow[]
  const departments = departmentsResult.data as FrequentAbsenceDepartment[]
  const organizations = organizationResult.data as OrganizationRow[]
  const cases = caseResult.data as CaseRow[]

  const employeeIds = [...new Set(employments.map((item) => item.employee_id))]
  const caseIds = cases.map((item) => item.id)

  const [employeesResult, spellsResult] = await Promise.all([
    employeeIds.length ? supabase.from('employees').select('id,first_name,birth_name_prefix,birth_name').eq('tenant_id', context.tenantId).in('id', employeeIds).is('deleted_at', null).limit(10000) : Promise.resolve({ data: [], error: null }),
    caseIds.length ? supabase.from('absence_spells').select('id,case_id,started_on,recovered_on').eq('tenant_id', context.tenantId).in('case_id', caseIds).limit(10000) : Promise.resolve({ data: [], error: null }),
  ])
  if (employeesResult.error) throw new Error('INSIGHTS_FREQUENT_REPORT_FAILED')
  if (spellsResult.error) throw new Error('INSIGHTS_FREQUENT_REPORT_FAILED')

  const employees = employeesResult.data as EmployeeRow[]
  const spells = spellsResult.data as SpellRow[]
  const employeeMap = new Map(employees.map((employee) => [employee.id, employee]))
  const departmentMap = new Map(departments.map((department) => [department.id, department.name]))

  const organizationByEmployment = new Map<string, OrganizationRow>()
  for (const organization of organizations) {
    if (!organization.employment_id) continue
    const current = organizationByEmployment.get(organization.employment_id)
    if (!current || organization.effective_from > current.effective_from) organizationByEmployment.set(organization.employment_id, organization)
  }

  const spellsByCase = new Map<string, SpellRow[]>()
  for (const spell of spells) {
    spellsByCase.set(spell.case_id, [...(spellsByCase.get(spell.case_id) ?? []), spell])
  }

  interface EmployeeAccumulator {
    reportCount: number
    totalSickDays: number
    departmentName: string | null
  }
  const accumulator = new Map<string, EmployeeAccumulator>()

  for (const absenceCase of cases) {
    const employment = employments.find((item) => item.id === absenceCase.employment_id)
    if (!employment) continue
    const organization = organizationByEmployment.get(employment.id)
    if (query.departmentId && organization?.department_id !== query.departmentId) continue
    const employee = employeeMap.get(employment.employee_id)
    if (!employee) continue

    const caseSpells = spellsByCase.get(absenceCase.id) ?? []
    let caseDays = 0
    for (const spell of caseSpells) {
      const spellEnd = spell.recovered_on ?? query.endDate
      const effectiveStart = spell.started_on > query.startDate ? spell.started_on : query.startDate
      const effectiveEnd = spellEnd < query.endDate ? spellEnd : query.endDate
      if (effectiveStart <= effectiveEnd) caseDays += daysBetween(effectiveStart, effectiveEnd)
    }

    const current = accumulator.get(employee.id)
    if (current) {
      current.reportCount += 1
      current.totalSickDays += caseDays
    } else {
      accumulator.set(employee.id, {
        reportCount: 1,
        totalSickDays: caseDays,
        departmentName: organization ? departmentMap.get(organization.department_id) ?? null : null,
      })
    }
  }

  const rows: FrequentAbsenceRow[] = [...accumulator.entries()].map(([employeeId, data]) => {
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

  return {
    report: 'absence-frequent',
    period: query,
    threshold,
    rows,
    departments,
    totalEmployees: rows.length,
    frequentCount: rows.filter((row) => row.isFrequent).length,
    totalReports: rows.reduce((total, row) => total + row.reportCount, 0),
  }
}
