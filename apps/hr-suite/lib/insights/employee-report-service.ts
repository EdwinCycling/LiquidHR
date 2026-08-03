import type { Tables } from '@scope/db'
import { requirePermission } from '@/lib/auth/permissions'
import { insightReportPermission } from '@/lib/insights/report-catalog'
import { createClient } from '@/lib/supabase/server'
import type { EmployeeInsightGroup, EmployeeInsightQuery, EmployeeInsightReport, EmployeeInsightRow } from './types'

type EmployeeRow = Pick<Tables<'employees'>, 'id' | 'employee_number' | 'first_name' | 'birth_name_prefix' | 'birth_name' | 'gender' | 'birth_date'>
type EmploymentRow = Pick<Tables<'employments'>, 'id' | 'employee_id' | 'starts_on' | 'ends_on' | 'seniority_date' | 'is_primary'>
type OrganizationRow = Pick<Tables<'employee_organizations'>, 'employee_id' | 'employment_id' | 'department_id' | 'cost_bearer' | 'effective_from' | 'effective_to'>
type TerminationRow = Pick<Tables<'employment_terminations'>, 'employee_id' | 'employment_id' | 'last_working_day' | 'internal_reason_id' | 'statutory_reason_id'>

export class EmployeeInsightsServiceError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code)
    this.name = 'EmployeeInsightsServiceError'
  }
}

function fail(error: { message?: string } | null): never {
  throw new EmployeeInsightsServiceError(error?.message?.startsWith('INSIGHTS_') ? error.message : 'INSIGHTS_EMPLOYEE_REPORT_FAILED')
}

function ageOn(birthDate: string | null, asOf: string): number | null {
  if (!birthDate) return null
  const birth = new Date(`${birthDate}T00:00:00Z`)
  const date = new Date(`${asOf}T00:00:00Z`)
  if (Number.isNaN(birth.getTime()) || Number.isNaN(date.getTime())) return null
  let age = date.getUTCFullYear() - birth.getUTCFullYear()
  const birthdayPassed = date.getUTCMonth() > birth.getUTCMonth() || (date.getUTCMonth() === birth.getUTCMonth() && date.getUTCDate() >= birth.getUTCDate())
  if (!birthdayPassed) age -= 1
  return age >= 0 ? age : null
}

function ageGroup(age: number | null): string {
  if (age === null) return 'unknown'
  if (age < 20) return 'under20'
  if (age < 30) return '20to30'
  if (age < 40) return '30to40'
  if (age < 50) return '40to50'
  if (age < 60) return '50to60'
  return 'over60'
}

function employeeName(employee: EmployeeRow): string {
  return [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')
}

function averageAge(rows: EmployeeInsightRow[]): number | null {
  const ages = rows.map((row) => row.age).filter((age): age is number => age !== null)
  return ages.length ? Math.round((ages.reduce((sum, age) => sum + age, 0) / ages.length) * 10) / 10 : null
}

function toGroups(rows: EmployeeInsightRow[], query: EmployeeInsightQuery): EmployeeInsightGroup[] {
  const grouped = new Map<string, EmployeeInsightRow[]>()
  for (const row of rows) {
    const key = query.groupBy === 'team'
      ? row.team ?? 'no-team'
      : query.groupBy === 'gender'
        ? row.gender
        : query.groupBy === 'age'
          ? ageGroup(row.age)
          : query.groupBy === 'reason'
            ? row.reason ?? 'no-reason'
            : row.employeeName
    const group = grouped.get(key) ?? []
    group.push(row)
    grouped.set(key, group)
  }
  const total = rows.length || 1
  return [...grouped.entries()]
    .map(([label, group]) => ({ label, count: group.length, percentage: Math.round((group.length / total) * 1000) / 10, averageAge: averageAge(group) }))
    .sort((left, right) => query.sortBy === 'name' ? left.label.localeCompare(right.label, 'nl') : right.count - left.count || left.label.localeCompare(right.label, 'nl'))
}

function toTrend(rows: EmployeeInsightRow[], query: EmployeeInsightQuery): Array<{ month: string; total: number }> {
  const cursor = new Date(`${query.startDate}T00:00:00Z`)
  cursor.setUTCDate(1)
  const end = new Date(`${query.endDate}T00:00:00Z`)
  const trend: Array<{ month: string; total: number }> = []
  while (cursor <= end) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
    const monthStart = cursor.toISOString().slice(0, 10)
    const total = query.report === 'terminations'
      ? rows.filter((row) => row.endDate !== null && row.endDate >= monthStart && row.endDate <= monthEnd).length
      : rows.filter((row) => row.startDate <= monthEnd && (row.endDate === null || row.endDate >= monthEnd)).length
    trend.push({ month: monthStart.slice(0, 7), total })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return trend
}

export async function getEmployeeInsightReport(query: EmployeeInsightQuery): Promise<EmployeeInsightReport> {
  const [context] = await Promise.all([
    requirePermission(insightReportPermission(query.report)),
    requirePermission('employee:read'),
  ])
  if (!context.administrationId) throw new EmployeeInsightsServiceError('INSIGHTS_ADMINISTRATION_REQUIRED', 400)
  const supabase = await createClient()
  const administrationId = context.administrationId

  const employmentResult = await supabase.from('employments')
    .select('id, employee_id, starts_on, ends_on, seniority_date, is_primary')
    .eq('tenant_id', context.tenantId).eq('administration_id', administrationId)
    .eq('record_status', 'CONFIRMED').is('deleted_at', null)
    .lte('starts_on', query.endDate)
    .or(`ends_on.is.null,ends_on.gte.${query.startDate}`)
    .limit(2000)
  if (employmentResult.error) fail(employmentResult.error)
  const employments = employmentResult.data as EmploymentRow[]
  const employeeIds = [...new Set(employments.map((employment) => employment.employee_id))]

  const [employeesResult, organizationsResult, departmentsResult, terminationsResult, internalReasonsResult, administrationResult] = await Promise.all([
    employeeIds.length ? supabase.from('employees').select('id, employee_number, first_name, birth_name_prefix, birth_name, gender, birth_date').eq('tenant_id', context.tenantId).in('id', employeeIds).is('deleted_at', null).limit(2000) : Promise.resolve({ data: [], error: null }),
    employeeIds.length ? supabase.from('employee_organizations').select('employee_id, employment_id, department_id, cost_bearer, effective_from, effective_to').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).lte('effective_from', query.endDate).or(`effective_to.is.null,effective_to.gte.${query.startDate}`).limit(5000) : Promise.resolve({ data: [], error: null }),
    supabase.from('departments').select('id, name').eq('tenant_id', context.tenantId).eq('is_active', true).order('name').limit(500),
    query.report === 'terminations' ? supabase.from('employment_terminations').select('employee_id, employment_id, last_working_day, internal_reason_id, statutory_reason_id').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).in('workflow_status', ['CONFIRMED', 'PAYROLL_READY', 'REPORTED']).gte('last_working_day', query.startDate).lte('last_working_day', query.endDate).limit(2000) : Promise.resolve({ data: [], error: null }),
    supabase.from('employment_end_reasons').select('id, name_nl').eq('tenant_id', context.tenantId).eq('administration_id', administrationId).eq('is_active', true).order('name_nl').limit(500),
    supabase.from('administrations').select('code').eq('tenant_id', context.tenantId).eq('id', administrationId).single(),
  ])
  if (employeesResult.error) fail(employeesResult.error)
  if (organizationsResult.error) fail(organizationsResult.error)
  if (departmentsResult.error) fail(departmentsResult.error)
  if (terminationsResult.error) fail(terminationsResult.error)
  if (internalReasonsResult.error) fail(internalReasonsResult.error)
  if (administrationResult.error) fail(administrationResult.error)

  const employees = employeesResult.data as EmployeeRow[]
  const organizations = organizationsResult.data as OrganizationRow[]
  const terminations = terminationsResult.data as TerminationRow[]
  const departmentNames = new Map(departmentsResult.data.map((department) => [department.id, department.name]))
  const internalReasons = new Map(internalReasonsResult.data.map((reason) => [reason.id, reason.name_nl]))
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]))
  const employmentByEmployee = new Map<string, EmploymentRow>()
  for (const employment of employments) {
    const current = employmentByEmployee.get(employment.employee_id)
    if (!current || (employment.is_primary && !current.is_primary) || employment.starts_on > current.starts_on) employmentByEmployee.set(employment.employee_id, employment)
  }
  const organizationByEmployee = new Map<string, OrganizationRow>()
  for (const organization of organizations) {
    const current = organizationByEmployee.get(organization.employee_id)
    if (!current || (organization.employment_id && organization.employment_id === employmentByEmployee.get(organization.employee_id)?.id) || organization.effective_from > current.effective_from) organizationByEmployee.set(organization.employee_id, organization)
  }
  const terminationByEmployment = new Map(terminations.map((termination) => [termination.employment_id, termination]))
  const rows: EmployeeInsightRow[] = []
  const sourceRows = query.report === 'terminations' ? terminations.map((termination) => ({ employeeId: termination.employee_id, employment: employments.find((item) => item.id === termination.employment_id), termination })) : [...employmentByEmployee.entries()].map(([employeeId, employment]) => ({ employeeId, employment, termination: undefined }))
  for (const source of sourceRows) {
    const employee = employeeById.get(source.employeeId)
    if (!employee || !source.employment) continue
    const organization = organizationByEmployee.get(source.employeeId)
    const team = organization ? departmentNames.get(organization.department_id) ?? null : null
    const segment = organization?.cost_bearer ?? null
    const status = source.termination || (source.employment.ends_on && source.employment.ends_on < query.endDate) ? 'former' : 'active'
    if (query.employeeStatus !== 'all' && status !== query.employeeStatus) continue
    if (query.teams.length && (!team || !query.teams.includes(team))) continue
    if (query.segments.length && (!segment || !query.segments.includes(segment))) continue
    const termination = source.termination ?? terminationByEmployment.get(source.employment.id)
    const reason = termination?.internal_reason_id ? internalReasons.get(termination.internal_reason_id) ?? null : null
    if (query.reasons.length && (!reason || !query.reasons.includes(reason))) continue
    rows.push({ administrationNumber: administrationResult.data.code, employeeNumber: employee.employee_number, employeeId: employee.id, employeeName: employeeName(employee), gender: employee.gender, birthDate: employee.birth_date, age: ageOn(employee.birth_date, query.endDate), team, segment, startDate: source.employment.starts_on, endDate: termination?.last_working_day ?? source.employment.ends_on, reason })
  }

  const filterOptions = {
    teams: departmentsResult.data.map((department) => department.name),
    segments: [...new Set(organizations.map((organization) => organization.cost_bearer).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right, 'nl')),
    reasons: [...new Set([...internalReasons.values(), ...rows.map((row) => row.reason).filter((value): value is string => Boolean(value))])].sort((left, right) => left.localeCompare(right, 'nl')),
  }
  return { report: query.report, period: { startDate: query.startDate, endDate: query.endDate }, total: rows.length, groups: toGroups(rows, query), trend: toTrend(rows, query), rows, filterOptions }
}
