import 'server-only'

import type { Tables } from '@scope/db'
import { AuthorizationError, getRequestAuthorizationContext, requireHrGroupId, requirePermissionInContext } from '@/lib/auth/permissions'
import { listDirectTeamEmployeeScope } from '@/lib/organization/team-scope'
import { headcountFteEmployeeWithinScope, headcountFtePopulationForRoles, headcountFteSelectionWithinScope } from './headcount-fte-authorization'
import { calculateHeadcountFteSnapshot, type HeadcountEmploymentSource, type HeadcountOrganizationSource, type HeadcountScheduleSource } from './headcount-fte-calculation'
import { type HeadcountFteQuery } from './headcount-fte-query'

type EmploymentRecord = Pick<Tables<'employments'>, 'id' | 'employee_id' | 'administration_id' | 'starts_on' | 'ends_on' | 'record_status' | 'deleted_at' | 'employment_number'>
type ScheduleRecord = Pick<Tables<'employment_schedules'>, 'id' | 'employment_id' | 'valid_from' | 'valid_until' | 'part_time_factor'>
type OrganizationRecord = Pick<Tables<'employee_organizations'>, 'id' | 'employee_id' | 'employment_id' | 'administration_id' | 'department_id' | 'direct_manager_id' | 'effective_from' | 'effective_to'>
type EmployeeRecord = Pick<Tables<'employees'>, 'id' | 'employee_number' | 'first_name' | 'birth_name_prefix' | 'birth_name'>

export interface HeadcountFteDetailRow {
  employeeId: string
  employeeNumber: string
  employeeName: string
  employmentId: string
  employmentNumber: string
  administrationId: string
  administrationName: string
  departmentId: string | null
  departmentName: string | null
  teamId: string | null
  teamName: string | null
  partTimeFactor: number | null
  scheduleStatus: 'VALID' | 'MISSING' | 'MULTIPLE' | 'INVALID_FACTOR'
  placementStatus: 'VALID' | 'MISSING' | 'MULTIPLE'
}

export interface HeadcountFteReport {
  report: 'headcount-fte'
  period: { fromMonth: string; toMonth: string; asOf: string }
  headcount: number
  fte: number | null
  knownFte: number
  activeEmploymentCount: number
  completeScheduleCount: number
  incompleteScheduleCount: number
  unassignedPlacementCount: number
  trend: Array<{ month: string; headcount: number; fte: number | null; knownFte: number; incompleteScheduleCount: number }>
  rows: HeadcountFteDetailRow[]
  administrationOptions: Array<{ id: string; label: string }>
  departmentOptions: Array<{ id: string; label: string }>
  teamOptions: Array<{ id: string; label: string }>
}

export class HeadcountFteServiceError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code)
    this.name = 'HeadcountFteServiceError'
  }
}

function monthEnd(month: string): string {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10)
}

function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const [startYear, startMonth] = fromMonth.split('-').map(Number)
  const [endYear, endMonth] = toMonth.split('-').map(Number)
  const result: string[] = []
  for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth);) {
    result.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month === 13) { month = 1; year += 1 }
  }
  return result
}

function employeeName(employee: EmployeeRecord): string {
  return [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')
}

function failDatabase(code: string, error: { message?: string } | null): never {
  throw new HeadcountFteServiceError(error?.message?.startsWith('INSIGHTS_') ? error.message : code)
}

export async function getHeadcountFteReport(query: HeadcountFteQuery): Promise<HeadcountFteReport> {
  const { supabase, context, activeContext } = await getRequestAuthorizationContext()
  await requirePermissionInContext(supabase, context, 'report-employee-department:read')
  await requirePermissionInContext(supabase, context, 'employee:read')
  const actorPopulation = headcountFtePopulationForRoles(context.activeRoles)
  if (!actorPopulation) throw new AuthorizationError('Je hebt geen toegang tot deze Insights-rapportage.')
  const hrGroupId = requireHrGroupId(context)

  const allAdministrationIds = activeContext.administrationsInActiveHrGroup.map((item) => item.id)
  if (allAdministrationIds.length === 0) throw new HeadcountFteServiceError('INSIGHTS_ADMINISTRATION_REQUIRED', 400)
  let permittedAdminIds: string[]
  let permittedEmployeeIds: Set<string> | null = null
  if (actorPopulation === 'HR_ADMIN') {
    permittedAdminIds = allAdministrationIds
  } else {
    if (!context.administrationId || !context.employeeId) throw new AuthorizationError('Je teamcontext ontbreekt.')
    permittedAdminIds = [context.administrationId]
    const teamScope = await listDirectTeamEmployeeScope(context, supabase, 5000)
    if (teamScope.sourceTruncated) throw new HeadcountFteServiceError('INSIGHTS_SCOPE_LIMIT_REACHED', 403)
    permittedEmployeeIds = new Set(teamScope.employeeIds)
  }

  if (query.administrationIds.length && !headcountFteSelectionWithinScope(query.administrationIds, permittedAdminIds)) {
    throw new AuthorizationError('Een of meer administraties vallen buiten je toegestane scope.')
  }
  const selectedAdminIds = query.administrationIds.length ? query.administrationIds : permittedAdminIds
  if (actorPopulation === 'DIRECT_MANAGER' && selectedAdminIds.some((id) => id !== context.administrationId)) {
    throw new AuthorizationError('Een of meer administraties vallen buiten je toegestane scope.')
  }

  if (permittedEmployeeIds?.size === 0) {
    return emptyReport(query, selectedAdminIds, activeContext.administrationsInActiveHrGroup)
  }

  const months = monthsBetween(query.fromMonth, query.toMonth)
  const rangeStart = `${query.fromMonth}-01`
  const rangeEnd = monthEnd(query.toMonth)
  let employmentQuery = supabase.from('employments')
    .select('id,employee_id,administration_id,starts_on,ends_on,record_status,deleted_at,employment_number')
    .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
    .in('administration_id', selectedAdminIds)
    .eq('record_status', 'CONFIRMED').is('deleted_at', null)
    .lte('starts_on', rangeEnd).or(`ends_on.is.null,ends_on.gte.${rangeStart}`)
    .limit(10000)
  if (permittedEmployeeIds) employmentQuery = employmentQuery.in('employee_id', [...permittedEmployeeIds])
  const employmentResult = await employmentQuery
  if (employmentResult.error) failDatabase('INSIGHTS_HEADCOUNT_EMPLOYMENTS_FAILED', employmentResult.error)
  const employments = (employmentResult.data ?? []) as EmploymentRecord[]
  if (employments.length >= 10000) throw new HeadcountFteServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  const employmentIds = employments.map((row) => row.id)
  const employeeIds = [...new Set(employments.map((row) => row.employee_id))]

  const [scheduleResult, organizationResult, employeeResult, administrationResult, departmentResult] = await Promise.all([
    employmentIds.length ? supabase.from('employment_schedules').select('id,employment_id,valid_from,valid_until,part_time_factor').eq('tenant_id', context.tenantId).in('administration_id', selectedAdminIds).in('employment_id', employmentIds).lte('valid_from', rangeEnd).or(`valid_until.is.null,valid_until.gt.${rangeStart}`).limit(30000) : Promise.resolve({ data: [], error: null }),
    employeeIds.length ? supabase.from('employee_organizations').select('id,employee_id,employment_id,administration_id,department_id,direct_manager_id,effective_from,effective_to').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('administration_id', selectedAdminIds).in('employee_id', employeeIds).lte('effective_from', rangeEnd).or(`effective_to.is.null,effective_to.gte.${rangeStart}`).limit(30000) : Promise.resolve({ data: [], error: null }),
    employeeIds.length ? supabase.from('employees').select('id,employee_number,first_name,birth_name_prefix,birth_name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', employeeIds).is('deleted_at', null).limit(10000) : Promise.resolve({ data: [], error: null }),
    supabase.from('administrations').select('id,code,name').eq('tenant_id', context.tenantId).in('id', selectedAdminIds).limit(500),
    supabase.from('departments').select('id,name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).limit(5000),
  ])
  const failed = [scheduleResult, organizationResult, employeeResult, administrationResult, departmentResult].find((result) => result.error)
  if (failed?.error) failDatabase('INSIGHTS_HEADCOUNT_SOURCE_FAILED', failed.error)
  const schedules = (scheduleResult.data ?? []) as ScheduleRecord[]
  const organizations = (organizationResult.data ?? []) as OrganizationRecord[]
  if (schedules.length >= 30000 || organizations.length >= 30000) throw new HeadcountFteServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  const employees = (employeeResult.data ?? []) as EmployeeRecord[]
  const administrationNames = new Map((administrationResult.data ?? []).map((row) => [row.id, row.name || row.code]))
  const departmentNames = new Map((departmentResult.data ?? []).map((row) => [row.id, row.name]))

  const managerIds = [...new Set(organizations.map((row) => row.direct_manager_id).filter((id): id is string => id !== null))]
  const visibleManagerIds = actorPopulation === 'HR_ADMIN' ? managerIds : managerIds.filter((id) => id === context.employeeId)
  const managerResult = visibleManagerIds.length
    ? await supabase.from('employees').select('id,employee_number,first_name,birth_name_prefix,birth_name').eq('tenant_id', context.tenantId).in('id', visibleManagerIds).is('deleted_at', null).limit(5000)
    : { data: [], error: null }
  if (managerResult.error) failDatabase('INSIGHTS_HEADCOUNT_TEAMS_FAILED', managerResult.error)
  const managerNames = new Map(((managerResult.data ?? []) as EmployeeRecord[]).map((row) => [row.id, employeeName(row)]))

  const employmentSources: HeadcountEmploymentSource[] = employments.map((row) => ({ id: row.id, employeeId: row.employee_id, administrationId: row.administration_id, startsOn: row.starts_on, endsOn: row.ends_on, recordStatus: row.record_status, deletedAt: row.deleted_at }))
  const scheduleSources: HeadcountScheduleSource[] = schedules.map((row) => ({ id: row.id, employmentId: row.employment_id, validFrom: row.valid_from, validUntil: row.valid_until, partTimeFactor: row.part_time_factor }))
  const organizationSources: HeadcountOrganizationSource[] = organizations.map((row) => ({ id: row.id, employeeId: row.employee_id, employmentId: row.employment_id, administrationId: row.administration_id, departmentId: row.department_id, directManagerId: row.direct_manager_id, effectiveFrom: row.effective_from, effectiveTo: row.effective_to }))
  const employeeMap = new Map(employees.map((row) => [row.id, row]))
  if (employeeMap.size !== employeeIds.length) throw new AuthorizationError('De medewerker- en dienstverbandtoegang sluiten niet op elkaar aan.')
  const allowedDepartments = [...new Set(organizationSources.map((row) => row.departmentId).filter((id): id is string => id !== null))]
  const allowedTeams = [...new Set(organizationSources.map((row) => row.directManagerId).filter((id): id is string => id !== null))]
  if (!headcountFteSelectionWithinScope(query.departmentIds, allowedDepartments) || !headcountFteSelectionWithinScope(query.teamIds, allowedTeams)) {
    throw new AuthorizationError('Een of meer afdelings- of teamfilters vallen buiten je toegestane scope.')
  }
  if (employmentSources.some((row) => !headcountFteEmployeeWithinScope(actorPopulation, row.employeeId, permittedEmployeeIds))) {
    throw new AuthorizationError('Een of meer medewerkers vallen buiten je toegestane teamscope.')
  }

  const snapshots = months.map((month) => calculateHeadcountFteSnapshot({
    asOf: monthEnd(month),
    employments: employmentSources,
    schedules: scheduleSources,
    organizations: organizationSources,
    administrationIds: selectedAdminIds,
    departmentIds: query.departmentIds,
    teamIds: query.teamIds,
  }))
  const latest = snapshots.at(-1)
  if (!latest) throw new HeadcountFteServiceError('INSIGHTS_HEADCOUNT_PERIOD_INVALID', 400)

  const rows: HeadcountFteDetailRow[] = latest.rows.flatMap((row) => {
    const employee = employeeMap.get(row.employeeId)
    const employment = employments.find((item) => item.id === row.employmentId)
    if (!employee || !employment) return []
    return [{
      employeeId: employee.id,
      employeeNumber: employee.employee_number,
      employeeName: employeeName(employee),
      employmentId: employment.id,
      employmentNumber: employment.employment_number ?? '',
      administrationId: employment.administration_id,
      administrationName: administrationNames.get(employment.administration_id) ?? '',
      departmentId: row.departmentId,
      departmentName: row.departmentId ? departmentNames.get(row.departmentId) ?? null : null,
      teamId: row.teamId,
      teamName: row.teamId ? managerNames.get(row.teamId) ?? null : null,
      partTimeFactor: row.partTimeFactor,
      scheduleStatus: row.scheduleStatus,
      placementStatus: row.placementStatus,
    }]
  })
  rows.sort((left, right) => {
    const comparison = query.sortBy === 'administration'
      ? left.administrationName.localeCompare(right.administrationName)
      : query.sortBy === 'fte'
        ? (left.partTimeFactor ?? -1) - (right.partTimeFactor ?? -1)
        : left.employeeName.localeCompare(right.employeeName, 'nl')
    return (query.sortDirection === 'desc' ? -comparison : comparison) || left.employmentId.localeCompare(right.employmentId)
  })

  return {
    report: 'headcount-fte',
    period: { fromMonth: query.fromMonth, toMonth: query.toMonth, asOf: latest.asOf },
    headcount: latest.headcount,
    fte: latest.fte,
    knownFte: latest.knownFte,
    activeEmploymentCount: latest.activeEmploymentCount,
    completeScheduleCount: latest.completeScheduleCount,
    incompleteScheduleCount: latest.incompleteScheduleCount,
    unassignedPlacementCount: latest.unassignedPlacementCount,
    trend: snapshots.map((snapshot) => ({ month: snapshot.asOf.slice(0, 7), headcount: snapshot.headcount, fte: snapshot.fte, knownFte: snapshot.knownFte, incompleteScheduleCount: snapshot.incompleteScheduleCount })),
    rows,
    administrationOptions: activeContext.administrationsInActiveHrGroup.filter((item) => permittedAdminIds.includes(item.id)).map((item) => ({ id: item.id, label: item.name })),
    departmentOptions: allowedDepartments.map((id) => ({ id, label: departmentNames.get(id) ?? '—' })).sort((left, right) => left.label.localeCompare(right.label, 'nl')),
    teamOptions: allowedTeams.map((id) => ({ id, label: managerNames.get(id) ?? '—' })).sort((left, right) => left.label.localeCompare(right.label, 'nl')),
  }
}

function emptyReport(query: HeadcountFteQuery, administrationIds: readonly string[], administrations: readonly { id: string; name: string }[]): HeadcountFteReport {
  const trend = monthsBetween(query.fromMonth, query.toMonth).map((month) => ({ month, headcount: 0, fte: 0, knownFte: 0, incompleteScheduleCount: 0 }))
  return {
    report: 'headcount-fte', period: { fromMonth: query.fromMonth, toMonth: query.toMonth, asOf: monthEnd(query.toMonth) },
    headcount: 0, fte: 0, knownFte: 0, activeEmploymentCount: 0, completeScheduleCount: 0, incompleteScheduleCount: 0, unassignedPlacementCount: 0,
    trend, rows: [], administrationOptions: administrations.filter((item) => administrationIds.includes(item.id)).map((item) => ({ id: item.id, label: item.name })), departmentOptions: [], teamOptions: [],
  }
}
