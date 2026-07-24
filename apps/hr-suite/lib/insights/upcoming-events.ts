import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type UpcomingEventType = 'BIRTHDAY' | 'ANNIVERSARY' | 'STARTER'

export interface UpcomingEventsQuery {
  types: UpcomingEventType[]
  periodDays: 7 | 28 | 84 | 365
  departmentIds: string[]
}

export interface UpcomingEventRow {
  administrationNumber: string
  employeeNumber: string
  employeeId: string
  id: string
  type: UpcomingEventType
  date: string
  employeeName: string
  departmentName: string | null
  years: number | null
}

export interface UpcomingEventsReport {
  startDate: string
  endDate: string
  rows: UpcomingEventRow[]
  departments: Array<{ id: string; name: string }>
}

export class UpcomingEventsServiceError extends Error {
  constructor(readonly code: string, readonly status = 500) { super(code) }
}

function dateOnly(value: Date): string { return value.toISOString().slice(0, 10) }

function anniversaryDate(source: string, year: number): string | null {
  const [, month, day] = source.split('-').map(Number)
  if (!month || !day) return null
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

function nextAnnualDate(source: string, startDate: string, endDate: string): string | null {
  const startYear = Number(startDate.slice(0, 4))
  for (const year of [startYear, startYear + 1]) {
    const candidate = anniversaryDate(source, year)
    if (candidate && candidate >= startDate && candidate <= endDate) return candidate
  }
  return null
}

function yearsOn(source: string, date: string): number {
  return Number(date.slice(0, 4)) - Number(source.slice(0, 4))
}

export async function getUpcomingEventsReport(query: UpcomingEventsQuery): Promise<UpcomingEventsReport> {
  const [context] = await Promise.all([requirePermission('report-upcoming-events:read'), requirePermission('employee:read')])
  if (!context.administrationId) throw new UpcomingEventsServiceError('INSIGHTS_ADMINISTRATION_REQUIRED', 400)
  const startDate = dateOnly(new Date())
  const end = new Date(`${startDate}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + query.periodDays)
  const endDate = dateOnly(end)
  const supabase = await createClient()
  const [employmentsResult, departmentsResult, anniversaryRulesResult, administrationResult] = await Promise.all([
    supabase.from('employments').select('id,employee_id,starts_on,ends_on,seniority_date,is_primary').eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).eq('record_status', 'CONFIRMED').is('deleted_at', null).lte('starts_on', endDate).or(`ends_on.is.null,ends_on.gte.${startDate}`).limit(2000),
    supabase.from('departments').select('id,name').eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).eq('is_active', true).order('name').limit(500),
    supabase.from('tenant_anniversary_rules').select('years').eq('tenant_id', context.tenantId).eq('is_active', true).order('years').limit(100),
    supabase.from('administrations').select('code').eq('tenant_id', context.tenantId).eq('id', context.administrationId).single(),
  ])
  if (employmentsResult.error || departmentsResult.error || anniversaryRulesResult.error || administrationResult.error) throw new UpcomingEventsServiceError('UPCOMING_EVENTS_READ_FAILED')
  const employments = employmentsResult.data
  const employeeIds = [...new Set(employments.map((employment) => employment.employee_id))]
  const [employeesResult, organizationsResult] = await Promise.all([
    employeeIds.length ? supabase.from('employees').select('id,employee_number,first_name,birth_name_prefix,birth_name,birth_date').eq('tenant_id', context.tenantId).in('id', employeeIds).is('deleted_at', null).limit(2000) : Promise.resolve({ data: [], error: null }),
    employeeIds.length ? supabase.from('employee_organizations').select('employee_id,employment_id,department_id,effective_from,effective_to').eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).lte('effective_from', startDate).or(`effective_to.is.null,effective_to.gte.${startDate}`).limit(5000) : Promise.resolve({ data: [], error: null }),
  ])
  if (employeesResult.error || organizationsResult.error) throw new UpcomingEventsServiceError('UPCOMING_EVENTS_READ_FAILED')
  const employeeById = new Map(employeesResult.data.map((employee) => [employee.id, employee]))
  const departmentById = new Map(departmentsResult.data.map((department) => [department.id, department.name]))
  const organizationByEmployment = new Map(organizationsResult.data.map((organization) => [organization.employment_id ?? organization.employee_id, organization]))
  const selectedEmploymentByEmployee = new Map<string, typeof employments[number]>()
  for (const employment of employments) {
    const current = selectedEmploymentByEmployee.get(employment.employee_id)
    if (!current || (employment.is_primary && !current.is_primary) || employment.starts_on > current.starts_on) selectedEmploymentByEmployee.set(employment.employee_id, employment)
  }
  const rows: UpcomingEventRow[] = []
  for (const employment of selectedEmploymentByEmployee.values()) {
    const employee = employeeById.get(employment.employee_id)
    if (!employee) continue
    const organization = organizationByEmployment.get(employment.id) ?? organizationByEmployment.get(employment.employee_id)
    const departmentId = organization?.department_id ?? null
    if (query.departmentIds.length && (!departmentId || !query.departmentIds.includes(departmentId))) continue
    const employeeName = [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')
    const departmentName = departmentId ? departmentById.get(departmentId) ?? null : null
    if (query.types.includes('BIRTHDAY') && employee.birth_date) {
      const date = nextAnnualDate(employee.birth_date, startDate, endDate)
      if (date) rows.push({ administrationNumber: administrationResult.data.code, employeeNumber: employee.employee_number, employeeId: employee.id, id: `birthday-${employment.id}-${date}`, type: 'BIRTHDAY', date, employeeName, departmentName, years: yearsOn(employee.birth_date, date) })
    }
    if (query.types.includes('ANNIVERSARY')) {
      for (const rule of anniversaryRulesResult.data) {
        const date = anniversaryDate(employment.seniority_date, Number(employment.seniority_date.slice(0, 4)) + rule.years)
        if (date && date >= startDate && date <= endDate) rows.push({ administrationNumber: administrationResult.data.code, employeeNumber: employee.employee_number, employeeId: employee.id, id: `anniversary-${employment.id}-${rule.years}`, type: 'ANNIVERSARY', date, employeeName, departmentName, years: rule.years })
      }
    }
    if (query.types.includes('STARTER') && employment.starts_on >= startDate && employment.starts_on <= endDate) rows.push({ administrationNumber: administrationResult.data.code, employeeNumber: employee.employee_number, employeeId: employee.id, id: `starter-${employment.id}`, type: 'STARTER', date: employment.starts_on, employeeName, departmentName, years: null })
  }
  return { startDate, endDate, rows: rows.sort((left, right) => left.date.localeCompare(right.date) || left.employeeName.localeCompare(right.employeeName, 'nl')), departments: departmentsResult.data }
}
