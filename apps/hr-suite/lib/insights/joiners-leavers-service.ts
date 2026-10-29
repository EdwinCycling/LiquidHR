import 'server-only'

import type { Tables } from '@scope/db'
import { AuthorizationError, getRequestAuthorizationContext, requireHrGroupId, requirePermissionInContext } from '@/lib/auth/permissions'
import { listDirectTeamEmployeeScope } from '@/lib/organization/team-scope'
import { headcountFteEmployeeWithinScope, headcountFtePopulationForRoles, headcountFteSelectionWithinScope } from './headcount-fte-authorization'
import { calculateJoinersLeaversReport, type JoinersLeaversEmploymentSource, type JoinersLeaversEvent, type JoinersLeaversOrganizationSource, type JoinersLeaversTerminationSource } from './joiners-leavers-calculation'
import { latestCompletedJoinersLeaversMonth, type JoinersLeaversQuery } from './joiners-leavers-query'

type EmploymentRecord = Pick<Tables<'employments'>, 'id' | 'employee_id' | 'administration_id' | 'starts_on' | 'ends_on' | 'record_status' | 'deleted_at' | 'employment_number'>
type TerminationRecord = Pick<Tables<'employment_terminations'>, 'id' | 'employee_id' | 'employment_id' | 'administration_id' | 'last_working_day' | 'workflow_status'>
type OrganizationRecord = Pick<Tables<'employee_organizations'>, 'employee_id' | 'employment_id' | 'administration_id' | 'department_id' | 'direct_manager_id' | 'effective_from' | 'effective_to'>
type EmployeeRecord = Pick<Tables<'employees'>, 'id' | 'employee_number' | 'first_name' | 'birth_name_prefix' | 'birth_name'>

export interface JoinersLeaversDetailRow extends JoinersLeaversEvent {
  employeeNumber: string
  employeeName: string
  administrationName: string
  departmentName: string | null
  teamName: string | null
}

export interface JoinersLeaversReport {
  report: 'joiners-leavers'
  audience: 'HR_ADMIN' | 'DIRECT_MANAGER'
  period: { fromMonth: string; toMonth: string; allHistoryThroughMonth: string }
  summary: ReturnType<typeof calculateJoinersLeaversReport>['summary']
  trend: ReturnType<typeof calculateJoinersLeaversReport>['trend']
  reconciliation: {
    softDeletedEmploymentTerminations: number
    unavailableEmploymentTerminations: number
  }
  rows: JoinersLeaversDetailRow[]
  administrationOptions: Array<{ id: string; label: string }>
  departmentOptions: Array<{ id: string; label: string }>
  teamOptions: Array<{ id: string; label: string }>
}

export class JoinersLeaversServiceError extends Error {
  constructor(readonly code: string, readonly status = 500) {
    super(code)
    this.name = 'JoinersLeaversServiceError'
  }
}

function monthEnd(month: string): string {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10)
}

function employeeName(employee: EmployeeRecord): string {
  return [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' ')
}

function failDatabase(code: string, error: { message?: string } | null): never {
  throw new JoinersLeaversServiceError(error?.message?.startsWith('INSIGHTS_') ? error.message : code)
}

function emptyTrend(query: JoinersLeaversQuery): JoinersLeaversReport['trend'] {
  const [startYear, startMonth] = query.fromMonth.split('-').map(Number)
  const [endYear, endMonth] = query.toMonth.split('-').map(Number)
  const months: string[] = []
  for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth);) {
    months.push(`${year}-${String(month).padStart(2, '0')}`)
    month += 1
    if (month > 12) { month = 1; year += 1 }
  }
  return months.map((month) => ({
    month,
    employmentStarts: 0,
    employeesWithStart: 0,
    employeesEnteringScope: 0,
    employmentEnds: 0,
    employeesWithEnd: 0,
    employeesLeavingScope: 0,
    terminationWorkflowEvents: 0,
    softDeletedReconciliations: 0,
    unavailableEmploymentReconciliations: 0,
    terminationDateMismatches: 0,
  }))
}

function emptySummary(): JoinersLeaversReport['summary'] {
  return {
    employmentStarts: 0,
    employeesWithStart: 0,
    employeesEnteringScope: 0,
    employmentEnds: 0,
    employeesWithEnd: 0,
    employeesLeavingScope: 0,
    terminationWorkflowEvents: 0,
    softDeletedReconciliations: 0,
    unavailableEmploymentReconciliations: 0,
    terminationDateMismatches: 0,
  }
}

function sortedOptions(ids: readonly string[], names: ReadonlyMap<string, string>): Array<{ id: string; label: string }> {
  return [...new Set(ids)].map((id) => ({ id, label: names.get(id) ?? '—' })).sort((left, right) => left.label.localeCompare(right.label, 'nl') || left.id.localeCompare(right.id))
}

export async function getJoinersLeaversReport(query: JoinersLeaversQuery): Promise<JoinersLeaversReport> {
  const { supabase, context, activeContext } = await getRequestAuthorizationContext()
  const population = headcountFtePopulationForRoles(context.activeRoles)
  if (!population) throw new AuthorizationError('Je hebt geen toegang tot deze Insights-rapportage.')
  await requirePermissionInContext(supabase, context, 'employee:read')
  if (population === 'HR_ADMIN') await requirePermissionInContext(supabase, context, 'report-employee-department:read')

  const hrGroupId = requireHrGroupId(context)
  const allAdministrationIds = [...new Set(activeContext.administrationsInActiveHrGroup.map((item) => item.id))]
  if (!allAdministrationIds.length) throw new JoinersLeaversServiceError('INSIGHTS_ADMINISTRATION_REQUIRED', 400)
  let permittedAdministrationIds: string[]
  let permittedEmployeeIds: Set<string> | null = null
  if (population === 'HR_ADMIN') {
    permittedAdministrationIds = allAdministrationIds
  } else {
    if (!context.administrationId || !context.employeeId) throw new AuthorizationError('Je teamcontext ontbreekt.')
    if (!allAdministrationIds.includes(context.administrationId)) throw new AuthorizationError('Je actieve administratie valt buiten je toegestane scope.')
    permittedAdministrationIds = [context.administrationId]
    const teamScope = await listDirectTeamEmployeeScope(context, supabase, 5000)
    if (teamScope.sourceTruncated) throw new JoinersLeaversServiceError('INSIGHTS_SCOPE_LIMIT_REACHED', 403)
    permittedEmployeeIds = new Set(teamScope.employeeIds)
  }

  if (query.administrationIds.length && !headcountFteSelectionWithinScope(query.administrationIds, permittedAdministrationIds)) {
    throw new AuthorizationError('Een of meer administraties vallen buiten je toegestane scope.')
  }
  const selectedAdministrationIds = query.administrationIds.length ? query.administrationIds : permittedAdministrationIds
  if (population === 'DIRECT_MANAGER' && selectedAdministrationIds.some((id) => id !== context.administrationId)) {
    throw new AuthorizationError('Een of meer administraties vallen buiten je toegestane scope.')
  }
  if (population === 'DIRECT_MANAGER' && permittedEmployeeIds?.size === 0) {
    const throughMonth = latestCompletedJoinersLeaversMonth()
    return {
      report: 'joiners-leavers', audience: population,
      period: { fromMonth: query.fromMonth, toMonth: query.toMonth, allHistoryThroughMonth: throughMonth },
      summary: emptySummary(), trend: emptyTrend(query),
      reconciliation: { softDeletedEmploymentTerminations: 0, unavailableEmploymentTerminations: 0 }, rows: [],
      administrationOptions: activeContext.administrationsInActiveHrGroup.filter((item) => permittedAdministrationIds.includes(item.id)).map((item) => ({ id: item.id, label: item.name })),
      departmentOptions: [], teamOptions: [],
    }
  }

  const throughMonth = latestCompletedJoinersLeaversMonth()
  const historyThroughDate = monthEnd(throughMonth)
  const [employmentResult, terminationResult] = await Promise.all([
    supabase.from('employments').select('id,employee_id,administration_id,starts_on,ends_on,record_status,deleted_at,employment_number')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('administration_id', permittedAdministrationIds)
      .eq('record_status', 'CONFIRMED').lte('starts_on', historyThroughDate).limit(10000),
    supabase.from('employment_terminations').select('id,employee_id,employment_id,administration_id,last_working_day,workflow_status')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('administration_id', permittedAdministrationIds)
      .in('workflow_status', ['CONFIRMED', 'PAYROLL_READY', 'REPORTED']).lte('last_working_day', historyThroughDate).limit(10000),
  ])
  if (employmentResult.error) failDatabase('INSIGHTS_JOINERS_LEAVERS_EMPLOYMENTS_FAILED', employmentResult.error)
  if (terminationResult.error) failDatabase('INSIGHTS_JOINERS_LEAVERS_TERMINATIONS_FAILED', terminationResult.error)
  const rawEmployments = (employmentResult.data ?? []) as EmploymentRecord[]
  const rawTerminations = (terminationResult.data ?? []) as TerminationRecord[]
  if (rawEmployments.length >= 10000 || rawTerminations.length >= 10000) throw new JoinersLeaversServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)

  for (const row of rawEmployments) {
    if (!permittedAdministrationIds.includes(row.administration_id) || !headcountFteEmployeeWithinScope(population, row.employee_id, permittedEmployeeIds)) {
      throw new AuthorizationError('Een of meer dienstverbanden vallen buiten je toegestane scope.')
    }
  }
  for (const row of rawTerminations) {
    if (!permittedAdministrationIds.includes(row.administration_id) || !headcountFteEmployeeWithinScope(population, row.employee_id, permittedEmployeeIds)) {
      throw new AuthorizationError('Een of meer beëindigingen vallen buiten je toegestane scope.')
    }
  }

  const sourceEmployeeIds = [...new Set([...rawEmployments.map((row) => row.employee_id), ...rawTerminations.map((row) => row.employee_id)])]
  if (sourceEmployeeIds.length >= 10000) throw new JoinersLeaversServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  const [employeeResult, organizationResult] = await Promise.all([
    sourceEmployeeIds.length ? supabase.from('employees').select('id,employee_number,first_name,birth_name_prefix,birth_name')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', sourceEmployeeIds).is('deleted_at', null).limit(10000)
      : Promise.resolve({ data: [], error: null }),
    sourceEmployeeIds.length ? supabase.from('employee_organizations').select('employee_id,employment_id,administration_id,department_id,direct_manager_id,effective_from,effective_to')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('administration_id', permittedAdministrationIds)
      .in('employee_id', sourceEmployeeIds).lte('effective_from', historyThroughDate).limit(30000)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (employeeResult.error) failDatabase('INSIGHTS_JOINERS_LEAVERS_EMPLOYEES_FAILED', employeeResult.error)
  if (organizationResult.error) failDatabase('INSIGHTS_JOINERS_LEAVERS_ORGANIZATIONS_FAILED', organizationResult.error)
  const employeeRecords = (employeeResult.data ?? []) as EmployeeRecord[]
  const organizationRecords = (organizationResult.data ?? []) as OrganizationRecord[]
  if (employeeRecords.length >= 10000 || organizationRecords.length >= 30000) throw new JoinersLeaversServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
  const employeeMap = new Map(employeeRecords.map((row) => [row.id, row]))
  if (employeeMap.size !== sourceEmployeeIds.length) throw new AuthorizationError('De medewerker- en dienstverbandtoegang sluiten niet op elkaar aan.')

  for (const row of organizationRecords) {
    if (!permittedAdministrationIds.includes(row.administration_id) || !headcountFteEmployeeWithinScope(population, row.employee_id, permittedEmployeeIds)) {
      throw new AuthorizationError('Een of meer organisatieplaatsingen vallen buiten je toegestane scope.')
    }
  }

  const employmentById = new Map(rawEmployments.map((row) => [row.id, row]))
  for (const row of rawTerminations) {
    const employment = employmentById.get(row.employment_id)
    if (employment && (employment.employee_id !== row.employee_id || employment.administration_id !== row.administration_id)) {
      throw new JoinersLeaversServiceError('INSIGHTS_SOURCE_INCONSISTENT', 503)
    }
  }

  const employmentSources: JoinersLeaversEmploymentSource[] = rawEmployments.map((row) => ({
    id: row.id, employeeId: row.employee_id, administrationId: row.administration_id,
    startsOn: row.starts_on, endsOn: row.ends_on, recordStatus: row.record_status,
    deletedAt: row.deleted_at, employmentNumber: row.employment_number,
  }))
  const terminationSources: JoinersLeaversTerminationSource[] = rawTerminations.map((row) => ({
    id: row.id, employeeId: row.employee_id, employmentId: row.employment_id,
    administrationId: row.administration_id, lastWorkingDay: row.last_working_day, workflowStatus: row.workflow_status,
  }))
  const organizationSources: JoinersLeaversOrganizationSource[] = organizationRecords.map((row) => ({
    employeeId: row.employee_id, employmentId: row.employment_id, administrationId: row.administration_id,
    departmentId: row.department_id, directManagerId: row.direct_manager_id,
    effectiveFrom: row.effective_from, effectiveTo: row.effective_to,
  }))

  const departmentIds = [...new Set(organizationSources.map((row) => row.departmentId).filter((id): id is string => id !== null))]
  const teamIds = population === 'HR_ADMIN'
    ? [...new Set(organizationSources.map((row) => row.directManagerId).filter((id): id is string => id !== null))]
    : context.employeeId ? [context.employeeId] : []
  if (!headcountFteSelectionWithinScope(query.departmentIds, departmentIds) || !headcountFteSelectionWithinScope(query.teamIds, teamIds)) {
    throw new AuthorizationError('Een of meer afdelings- of teamfilters vallen buiten je toegestane scope.')
  }

  const calculated = calculateJoinersLeaversReport({
    query,
    allHistoryThroughDate: historyThroughDate,
    authorizedAdministrationIds: permittedAdministrationIds,
    employments: employmentSources,
    terminations: terminationSources,
    organizations: organizationSources,
  })

  const departmentNames = new Map<string, string>()
  if (departmentIds.length) {
    const result = await supabase.from('departments').select('id,name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', departmentIds).limit(5000)
    if (result.error) failDatabase('INSIGHTS_JOINERS_LEAVERS_DEPARTMENTS_FAILED', result.error)
    if ((result.data ?? []).length >= 5000) throw new JoinersLeaversServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
    for (const row of result.data ?? []) departmentNames.set(row.id, row.name)
  }

  const visibleTeamIds = population === 'HR_ADMIN' ? teamIds : teamIds.filter((id) => id === context.employeeId)
  const teamNames = new Map<string, string>()
  if (visibleTeamIds.length) {
    const result = await supabase.from('employees').select('id,employee_number,first_name,birth_name_prefix,birth_name')
      .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', visibleTeamIds).is('deleted_at', null).limit(5000)
    if (result.error) failDatabase('INSIGHTS_JOINERS_LEAVERS_TEAMS_FAILED', result.error)
    if ((result.data ?? []).length >= 5000) throw new JoinersLeaversServiceError('INSIGHTS_SOURCE_LIMIT_REACHED', 503)
    for (const employee of (result.data ?? []) as EmployeeRecord[]) teamNames.set(employee.id, employeeName(employee))
  }

  const administrationNames = new Map(activeContext.administrationsInActiveHrGroup.map((item) => [item.id, item.name]))
  const rows: JoinersLeaversDetailRow[] = calculated.events.map((event) => {
    const employee = employeeMap.get(event.employeeId)
    if (!employee) throw new AuthorizationError('De medewerker- en dienstverbandtoegang sluiten niet op elkaar aan.')
    const visibleTeamId = population === 'HR_ADMIN' || event.teamId === context.employeeId ? event.teamId : null
    return {
      ...event,
      teamId: visibleTeamId,
      employeeNumber: employee.employee_number,
      employeeName: employeeName(employee),
      administrationName: administrationNames.get(event.administrationId) ?? '',
      departmentName: event.departmentId ? departmentNames.get(event.departmentId) ?? null : null,
      teamName: visibleTeamId ? teamNames.get(visibleTeamId) ?? null : null,
    }
  })
  rows.sort((left, right) => {
    const comparison = query.sortBy === 'employeeName'
      ? left.employeeName.localeCompare(right.employeeName, 'nl')
      : query.sortBy === 'eventType'
        ? left.eventType.localeCompare(right.eventType)
        : query.sortBy === 'administration'
          ? left.administrationName.localeCompare(right.administrationName, 'nl')
          : left.eventDate.localeCompare(right.eventDate)
    return (query.sortDirection === 'desc' ? -comparison : comparison) || left.id.localeCompare(right.id)
  })

  return {
    report: 'joiners-leavers',
    audience: population,
    period: { fromMonth: query.fromMonth, toMonth: query.toMonth, allHistoryThroughMonth: throughMonth },
    summary: calculated.summary,
    trend: calculated.trend,
    reconciliation: {
      softDeletedEmploymentTerminations: calculated.allHistorySoftDeletedReconciliationCount,
      unavailableEmploymentTerminations: calculated.allHistoryUnavailableEmploymentReconciliationCount,
    },
    rows,
    administrationOptions: activeContext.administrationsInActiveHrGroup.filter((item) => permittedAdministrationIds.includes(item.id)).map((item) => ({ id: item.id, label: item.name })),
    departmentOptions: sortedOptions(departmentIds, departmentNames),
    teamOptions: sortedOptions(visibleTeamIds, teamNames),
  }
}
