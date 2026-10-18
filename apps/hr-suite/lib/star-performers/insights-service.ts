import type { GridCell } from '@/lib/talent-review/rules'

export const INSIGHT_GRID_CELLS: readonly GridCell[] = [
  'LOW_LOW',
  'LOW_NORMAL',
  'LOW_HIGH',
  'NORMAL_LOW',
  'NORMAL_NORMAL',
  'NORMAL_HIGH',
  'HIGH_LOW',
  'HIGH_NORMAL',
  'HIGH_HIGH',
]

export type InsightState = 'ready' | 'unavailable' | 'no-data'

export type InsightEmployee = {
  employeeId: string
  employeeNumber: string
  label: string
  departmentName: string | null
  jobName: string | null
  jobGroupName: string | null
  sourceCampaignName?: string | null
  sourceClosedAt?: string | null
  gridCell?: string | null
  criticalityLevel?: number | null
  href: string
}

export type InsightBreakdown = {
  id: string
  label: string
  assessedCount: number
  highCriticalCount: number
  employeeCount: number
  href: string
}

export type DevelopmentPopulationInput = {
  employeeId: string
  departmentId: string
  departmentName: string | null
}

export type DevelopmentPlanInput = {
  id: string
  employeeId: string
  employeeLabel: string
  title: string
  status: string
  progressPercent: number
  periodStart: string
  periodEnd: string | null
  completedAt: string | null
}

export type DevelopmentActionInput = {
  id: string
  employeeId: string
  employeeLabel: string
  title: string
  status: string
  dueOn: string | null
  nextMeetingOn: string | null
}

export type DevelopmentInsight = {
  state: InsightState
  asOf: string
  relevantEmployees: number
  sources: {
    plans: boolean
    actions: boolean
  }
  activePlansCount: number
  employeesWithActivePlans: number
  coveragePercent: number | null
  averageProgress: number | null
  planStatusCounts: Array<{ status: string; count: number }>
  openActionCount: number
  completedActionCount: number
  overdueActionCount: number
  upcomingFollowUpCount: number
  overdueFollowUpCount: number
  byDepartment: Array<{
    id: string
    label: string
    employeeCount: number
    employeesWithActivePlans: number
    coveragePercent: number | null
    activePlansCount: number
    openActionCount: number
    overdueActionCount: number
  }>
  plans: Array<{
    id: string
    employeeId: string
    employeeLabel: string
    title: string
    status: string
    progressPercent: number
    periodStart: string
    periodEnd: string | null
    completedAt: string | null
    href: string
  }>
  actions: Array<{
    id: string
    employeeId: string
    employeeLabel: string
    title: string
    status: string
    dueOn: string | null
    nextMeetingOn: string | null
    followUpOn: string | null
    followUpStatus: 'upcoming' | 'overdue' | null
    href: string
  }>
  trendAvailable: boolean
}

export const DEVELOPMENT_OPEN_ACTION_STATUSES = ['PLANNED', 'OPEN', 'WAITING', 'ACTIVE'] as const

export type StarPerformersInsights = {
  population: {
    employeesInScope: number
    assessedGrid: number
    assessedKeyEmployees: number
  }
  periods: Array<{
    id: string
    name: string
    closedAt: string | null
    startsOn: string
  }>
  selectedPeriodId: string | null
  topTalent: {
    coveragePercent: number | null
    assessedCount: number
    distribution: Array<{ cell: GridCell; count: number; percent: number | null }>
    highHigh: InsightEmployee[]
    movement: {
      state: 'available' | 'unavailable'
      previousCampaignName: string | null
      comparableEmployees: number
      up: number
      down: number
      stable: number
    }
  }
  keyEmployees: {
    criticalityDistribution: Array<{ level: number; count: number; percent: number | null }>
    highCriticalCount: number
    highCriticalPercent: number | null
    assessedCount: number
    threshold: 4
    byDepartment: InsightBreakdown[]
    byJobGroup: InsightBreakdown[]
    byJob: InsightBreakdown[]
    overlap: {
      highHighCount: number
      highCriticalCount: number
      overlapCount: number
      overlapPercent: number | null
    }
    employees: InsightEmployee[]
  }
  skills: {
    state: InsightState
    evaluatedEmployees: number
    roles: Array<{
      id: string
      label: string
      jobGroupName: string | null
      evaluatedEmployees: number
      requirements: number
      coveredRequirements: number
      gapCount: number
      coveragePercent: number | null
      evidenceBacked: boolean
      href: string
    }>
    topGaps: Array<{ label: string; occurrences: number; roles: number }>
  }
  skillGaps: FunctionSkillGapReport
  development: DevelopmentInsight
}

export type GridDistributionInput = {
  employeeId: string
  gridCell: GridCell | null
}

export type CriticalityInput = {
  employeeId: string
  criticalityLevel: number
}

export type MovementInput = 'UP' | 'DOWN' | 'STABLE' | 'NEW' | null

export type SkillComparisonInput = {
  employeeId: string
  roleId: string
  roleLabel: string
  jobGroupName: string | null
  axes: Array<{
    capabilityName: string
    status: 'MATCH' | 'GAP' | 'MISSING_EVIDENCE' | 'UNKNOWN'
  }>
}

export const SKILL_GAP_STATUSES = ['MATCH', 'MISSING_LEVEL', 'INSUFFICIENT_LEVEL', 'EXPIRED_EVIDENCE', 'NOT_ASSESSED', 'MISSING_EVIDENCE'] as const
export type SkillGapStatus = (typeof SKILL_GAP_STATUSES)[number]
export type SkillGapStatusCounts = Record<SkillGapStatus, number>

export type SkillGapComparisonInput = {
  employeeId: string
  employeeLabel: string
  employeeNumber: string
  roleId: string
  roleLabel: string
  jobGroupName: string | null
  departmentId: string
  departmentName: string | null
  profileVersionId: string
  profileVersion: number
  profileValidFrom: string | null
  profileValidUntil: string | null
  axes: Array<{
    requirementId: string
    capabilityId: string
    capabilityName: string
    requiredLevelLabel: string | null
    currentLevelLabel: string | null
    status: SkillGapStatus
  }>
}

export type FunctionSkillGapReport = {
  state: InsightState
  asOf: string
  relevantEmployees: number
  assessedEmployees: number
  rows: Array<{
    id: string
    roleId: string
    roleLabel: string
    jobGroupName: string | null
    departmentId: string
    departmentName: string | null
    requirementId: string
    capabilityId: string
    capabilityName: string
    requiredLevelLabel: string | null
    profileVersionId: string
    profileVersion: number
    profileValidFrom: string | null
    profileValidUntil: string | null
    totalRelevantEmployees: number
    assessedEmployees: number
    coveragePercent: number | null
    statusCounts: SkillGapStatusCounts
    singlePersonDependency: boolean
    employees: Array<{
      employeeId: string
      employeeLabel: string
      employeeNumber: string
      status: SkillGapStatus
      currentLevelLabel: string | null
      href: string
    }>
    href: string
  }>
}

function percentage(value: number, total: number): number | null {
  return total > 0 ? Math.round((value / total) * 100) : null
}

function dateOnly(value: string | null): string | null {
  return value ? value.slice(0, 10) : null
}

function isBefore(value: string | null, asOf: string): boolean {
  const date = dateOnly(value)
  return date !== null && date < asOf
}

function actionFollowUpDate(action: DevelopmentActionInput): string | null {
  return action.nextMeetingOn
}

function actionFollowUpStatus(action: DevelopmentActionInput, asOf: string): 'upcoming' | 'overdue' | null {
  if (!DEVELOPMENT_OPEN_ACTION_STATUSES.includes(action.status as (typeof DEVELOPMENT_OPEN_ACTION_STATUSES)[number])) return null
  const followUpOn = actionFollowUpDate(action)
  if (!followUpOn) return null
  return isBefore(followUpOn, asOf) ? 'overdue' : 'upcoming'
}

export function buildDevelopmentInsight(input: {
  asOf: string
  population: readonly DevelopmentPopulationInput[]
  plans: readonly DevelopmentPlanInput[]
  actions: readonly DevelopmentActionInput[]
  sources?: { plans: boolean; actions: boolean }
}): DevelopmentInsight {
  const sources = input.sources ?? { plans: true, actions: true }
  const populationByEmployee = new Map<string, DevelopmentPopulationInput>()
  for (const employee of input.population) {
    if (!populationByEmployee.has(employee.employeeId)) populationByEmployee.set(employee.employeeId, employee)
  }
  const population = [...populationByEmployee.values()]
  const employeeIds = new Set(population.map((employee) => employee.employeeId))
  const plansById = new Map(input.plans.filter((plan) => sources.plans && employeeIds.has(plan.employeeId)).map((plan) => [plan.id, plan]))
  const actionsById = new Map(input.actions.filter((action) => sources.actions && employeeIds.has(action.employeeId)).map((action) => [action.id, action]))
  const plans = [...plansById.values()]
  const actions = [...actionsById.values()]
  const activePlans = plans.filter((plan) => plan.status === 'ACTIVE')
  const activePlanEmployees = new Set(activePlans.map((plan) => plan.employeeId))
  const openActions = actions.filter((action) => DEVELOPMENT_OPEN_ACTION_STATUSES.includes(action.status as (typeof DEVELOPMENT_OPEN_ACTION_STATUSES)[number]))
  const completedActions = actions.filter((action) => action.status === 'DONE')
  const overdueActions = openActions.filter((action) => isBefore(action.dueOn, input.asOf))
  const upcomingFollowUps = openActions.filter((action) => actionFollowUpStatus(action, input.asOf) === 'upcoming')
  const overdueFollowUps = openActions.filter((action) => actionFollowUpStatus(action, input.asOf) === 'overdue')
  const planStatusCounts = [...plans.reduce((counts, plan) => counts.set(plan.status, (counts.get(plan.status) ?? 0) + 1), new Map<string, number>()).entries()]
    .sort(([left], [right]) => {
      const order = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED']
      return (order.indexOf(left) === -1 ? order.length : order.indexOf(left)) - (order.indexOf(right) === -1 ? order.length : order.indexOf(right)) || left.localeCompare(right)
    })
    .map(([status, count]) => ({ status, count }))

  const byDepartment = new Map<string, {
    label: string
    employeeIds: Set<string>
    activePlanEmployeeIds: Set<string>
    activePlansCount: number
    openActionCount: number
    overdueActionCount: number
  }>()
  for (const employee of population) {
    const current = byDepartment.get(employee.departmentId) ?? {
      label: employee.departmentName ?? employee.departmentId,
      employeeIds: new Set<string>(),
      activePlanEmployeeIds: new Set<string>(),
      activePlansCount: 0,
      openActionCount: 0,
      overdueActionCount: 0,
    }
    current.employeeIds.add(employee.employeeId)
    byDepartment.set(employee.departmentId, current)
  }
  for (const plan of activePlans) {
    const employee = populationByEmployee.get(plan.employeeId)
    if (!employee) continue
    const group = byDepartment.get(employee.departmentId)
    if (!group) continue
    group.activePlansCount += 1
    group.activePlanEmployeeIds.add(plan.employeeId)
  }
  for (const action of openActions) {
    const employee = populationByEmployee.get(action.employeeId)
    if (!employee) continue
    const group = byDepartment.get(employee.departmentId)
    if (!group) continue
    group.openActionCount += 1
    if (isBefore(action.dueOn, input.asOf)) group.overdueActionCount += 1
  }

  const result: DevelopmentInsight = {
    state: !sources.plans && !sources.actions ? 'unavailable' : plans.length > 0 || actions.length > 0 ? 'ready' : 'no-data',
    asOf: input.asOf,
    relevantEmployees: population.length,
    sources,
    activePlansCount: sources.plans ? activePlans.length : 0,
    employeesWithActivePlans: sources.plans ? activePlanEmployees.size : 0,
    coveragePercent: sources.plans ? percentage(activePlanEmployees.size, population.length) : null,
    averageProgress: sources.plans && activePlans.length > 0 ? Math.round(activePlans.reduce((total, plan) => total + plan.progressPercent, 0) / activePlans.length) : null,
    planStatusCounts,
    openActionCount: sources.actions ? openActions.length : 0,
    completedActionCount: sources.actions ? completedActions.length : 0,
    overdueActionCount: sources.actions ? overdueActions.length : 0,
    upcomingFollowUpCount: sources.actions ? upcomingFollowUps.length : 0,
    overdueFollowUpCount: sources.actions ? overdueFollowUps.length : 0,
    byDepartment: [...byDepartment.entries()].map(([id, group]) => ({
      id,
      label: group.label,
      employeeCount: group.employeeIds.size,
      employeesWithActivePlans: group.activePlanEmployeeIds.size,
      coveragePercent: sources.plans ? percentage(group.activePlanEmployeeIds.size, group.employeeIds.size) : null,
      activePlansCount: sources.plans ? group.activePlansCount : 0,
      openActionCount: sources.actions ? group.openActionCount : 0,
      overdueActionCount: sources.actions ? group.overdueActionCount : 0,
    })).sort((left, right) => left.label.localeCompare(right.label, 'nl')),
    plans: plans.map((plan) => ({
      id: plan.id,
      employeeId: plan.employeeId,
      employeeLabel: plan.employeeLabel,
      title: plan.title,
      status: plan.status,
      progressPercent: plan.progressPercent,
      periodStart: plan.periodStart,
      periodEnd: plan.periodEnd,
      completedAt: plan.completedAt,
      href: `/workforce/talent/goals?employeeId=${encodeURIComponent(plan.employeeId)}`,
    })),
    actions: actions.map((action) => ({
      id: action.id,
      employeeId: action.employeeId,
      employeeLabel: action.employeeLabel,
      title: action.title,
      status: action.status,
      dueOn: action.dueOn,
      nextMeetingOn: action.nextMeetingOn,
      followUpOn: actionFollowUpDate(action),
      followUpStatus: actionFollowUpStatus(action, input.asOf),
      href: `/workforce/continuous-appraisal?employeeId=${encodeURIComponent(action.employeeId)}`,
    })),
    trendAvailable: false,
  }
  return result
}

export function emptyDevelopmentInsight(asOf: string): DevelopmentInsight {
  return buildDevelopmentInsight({ asOf, population: [], plans: [], actions: [], sources: { plans: true, actions: true } })
}

export function buildGridDistribution(
  inputs: readonly GridDistributionInput[],
  populationIds: readonly string[],
): Array<{ cell: GridCell; count: number; percent: number | null }> {
  const population = new Set(populationIds)
  const uniqueByEmployee = new Map<string, GridCell>()
  for (const input of inputs) {
    if (!population.has(input.employeeId) || !input.gridCell || uniqueByEmployee.has(input.employeeId)) continue
    uniqueByEmployee.set(input.employeeId, input.gridCell)
  }
  const counts = new Map<GridCell, number>(INSIGHT_GRID_CELLS.map((cell) => [cell, 0]))
  for (const cell of uniqueByEmployee.values()) counts.set(cell, (counts.get(cell) ?? 0) + 1)
  return INSIGHT_GRID_CELLS.map((cell) => ({
    cell,
    count: counts.get(cell) ?? 0,
    percent: percentage(counts.get(cell) ?? 0, uniqueByEmployee.size),
  }))
}

export function buildCriticalityDistribution(
  inputs: readonly CriticalityInput[],
): Array<{ level: number; count: number; percent: number | null }> {
  const uniqueByEmployee = new Map<string, number>()
  for (const input of inputs) {
    if (!uniqueByEmployee.has(input.employeeId)) uniqueByEmployee.set(input.employeeId, input.criticalityLevel)
  }
  return [1, 2, 3, 4, 5].map((level) => {
    const count = [...uniqueByEmployee.values()].filter((value) => value === level).length
    return { level, count, percent: percentage(count, uniqueByEmployee.size) }
  })
}

export function buildMovementSummary(inputs: readonly MovementInput[]): {
  state: 'available' | 'unavailable'
  comparableEmployees: number
  up: number
  down: number
  stable: number
} {
  const up = inputs.filter((value) => value === 'UP').length
  const down = inputs.filter((value) => value === 'DOWN').length
  const stable = inputs.filter((value) => value === 'STABLE').length
  const comparableEmployees = up + down + stable
  return { state: comparableEmployees > 0 ? 'available' : 'unavailable', comparableEmployees, up, down, stable }
}

export function buildSkillCoverage(inputs: readonly SkillComparisonInput[]): {
  roles: StarPerformersInsights['skills']['roles']
  topGaps: StarPerformersInsights['skills']['topGaps']
  evaluatedEmployees: number
} {
  const roleMap = new Map<string, {
    roleId: string
    roleLabel: string
    jobGroupName: string | null
    employeeIds: Set<string>
    coveredRequirements: number
    gapCount: number
    requirementCount: number
    gaps: Map<string, number>
  }>()
  const evaluatedEmployees = new Set<string>()

  for (const input of inputs) {
    const comparableAxes = input.axes.filter((axis) => axis.status !== 'UNKNOWN')
    if (comparableAxes.length > 0) evaluatedEmployees.add(input.employeeId)
    const current = roleMap.get(input.roleId) ?? {
      roleId: input.roleId,
      roleLabel: input.roleLabel,
      jobGroupName: input.jobGroupName,
      employeeIds: new Set<string>(),
      coveredRequirements: 0,
      gapCount: 0,
      requirementCount: 0,
      gaps: new Map<string, number>(),
    }
    current.employeeIds.add(input.employeeId)
    for (const axis of comparableAxes) {
      current.requirementCount += 1
      if (axis.status === 'MATCH') current.coveredRequirements += 1
      if (axis.status === 'GAP' || axis.status === 'MISSING_EVIDENCE') {
        current.gapCount += 1
        current.gaps.set(axis.capabilityName, (current.gaps.get(axis.capabilityName) ?? 0) + 1)
      }
    }
    roleMap.set(input.roleId, current)
  }

  const roles = [...roleMap.values()].map((role) => ({
    id: role.roleId,
    label: role.roleLabel,
    jobGroupName: role.jobGroupName,
    evaluatedEmployees: role.employeeIds.size,
    requirements: role.requirementCount,
    coveredRequirements: role.coveredRequirements,
    gapCount: role.gapCount,
    coveragePercent: percentage(role.coveredRequirements, role.requirementCount),
    evidenceBacked: role.gapCount > 0 || role.coveredRequirements > 0,
    href: '/workforce/talent/role-explorer',
  })).sort((left, right) => (left.coveragePercent ?? 101) - (right.coveragePercent ?? 101) || right.gapCount - left.gapCount || left.label.localeCompare(right.label, 'nl'))

  const gapMap = new Map<string, { occurrences: number; roles: Set<string> }>()
  for (const role of roleMap.values()) {
    for (const [label, occurrences] of role.gaps.entries()) {
      const current = gapMap.get(label) ?? { occurrences: 0, roles: new Set<string>() }
      current.occurrences += occurrences
      current.roles.add(role.roleId)
      gapMap.set(label, current)
    }
  }
  const topGaps = [...gapMap.entries()].map(([label, value]) => ({ label, occurrences: value.occurrences, roles: value.roles.size })).sort((left, right) => right.occurrences - left.occurrences || left.label.localeCompare(right.label, 'nl')).slice(0, 8)

  return { roles, topGaps, evaluatedEmployees: evaluatedEmployees.size }
}

function emptySkillGapStatusCounts(): SkillGapStatusCounts {
  return { MATCH: 0, MISSING_LEVEL: 0, INSUFFICIENT_LEVEL: 0, EXPIRED_EVIDENCE: 0, NOT_ASSESSED: 0, MISSING_EVIDENCE: 0 }
}

export function buildFunctionSkillGapReport(inputs: readonly SkillGapComparisonInput[], asOf: string): FunctionSkillGapReport {
  const relevantEmployees = new Set<string>()
  const assessedEmployees = new Set<string>()
  const rows = new Map<string, {
    input: SkillGapComparisonInput
    axis: SkillGapComparisonInput['axes'][number]
    employeeById: Map<string, { employeeId: string; employeeLabel: string; employeeNumber: string; status: SkillGapStatus; currentLevelLabel: string | null; href: string }>
  }>()

  for (const input of inputs) {
    relevantEmployees.add(input.employeeId)
    for (const axis of input.axes) {
      if (axis.status !== 'NOT_ASSESSED') assessedEmployees.add(input.employeeId)
      const key = `${input.roleId}:${input.departmentId}:${axis.requirementId}`
      const row = rows.get(key) ?? {
        input,
        axis,
        employeeById: new Map(),
      }
      if (!row.employeeById.has(input.employeeId)) {
        row.employeeById.set(input.employeeId, {
          employeeId: input.employeeId,
          employeeLabel: input.employeeLabel,
          employeeNumber: input.employeeNumber,
          status: axis.status,
          currentLevelLabel: axis.currentLevelLabel,
          href: `/employees/${encodeURIComponent(input.employeeId)}`,
        })
      }
      rows.set(key, row)
    }
  }

  const reportRows = [...rows.entries()].map(([id, row]) => {
    const employees = [...row.employeeById.values()].sort((left, right) => left.employeeLabel.localeCompare(right.employeeLabel, 'nl'))
    const statusCounts = emptySkillGapStatusCounts()
    for (const employee of employees) statusCounts[employee.status] += 1
    const totalRelevantEmployees = employees.length
    const assessedCount = totalRelevantEmployees - statusCounts.NOT_ASSESSED
    return {
      id,
      roleId: row.input.roleId,
      roleLabel: row.input.roleLabel,
      jobGroupName: row.input.jobGroupName,
      departmentId: row.input.departmentId,
      departmentName: row.input.departmentName,
      requirementId: row.axis.requirementId,
      capabilityId: row.axis.capabilityId,
      capabilityName: row.axis.capabilityName,
      requiredLevelLabel: row.axis.requiredLevelLabel,
      profileVersionId: row.input.profileVersionId,
      profileVersion: row.input.profileVersion,
      profileValidFrom: row.input.profileValidFrom,
      profileValidUntil: row.input.profileValidUntil,
      totalRelevantEmployees,
      assessedEmployees: assessedCount,
      coveragePercent: percentage(statusCounts.MATCH, totalRelevantEmployees),
      statusCounts,
      singlePersonDependency: totalRelevantEmployees > 1
        && statusCounts.MATCH === 1
        && statusCounts.MISSING_LEVEL === 0
        && statusCounts.EXPIRED_EVIDENCE === 0
        && statusCounts.NOT_ASSESSED === 0
        && statusCounts.MISSING_EVIDENCE === 0,
      employees,
      href: `/workforce/talent/role-explorer?profileVersionId=${encodeURIComponent(row.input.profileVersionId)}`,
    }
  }).sort((left, right) => {
    const leftGaps = left.totalRelevantEmployees - left.statusCounts.MATCH
    const rightGaps = right.totalRelevantEmployees - right.statusCounts.MATCH
    return rightGaps - leftGaps || (left.coveragePercent ?? 101) - (right.coveragePercent ?? 101) || left.roleLabel.localeCompare(right.roleLabel, 'nl') || left.capabilityName.localeCompare(right.capabilityName, 'nl')
  })

  return {
    state: reportRows.length > 0 ? 'ready' : 'no-data',
    asOf,
    relevantEmployees: relevantEmployees.size,
    assessedEmployees: assessedEmployees.size,
    rows: reportRows,
  }
}

function csvCell(value: string | number | boolean | null): string {
  const raw = value === null ? '' : String(value)
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}

export function functionSkillGapReportCsv(report: FunctionSkillGapReport): string {
  const header = ['as_of', 'job', 'job_group', 'department', 'capability', 'required_level', 'employee_id', 'employee', 'status', 'evidenced_level', 'assessed_employees', 'relevant_employees', 'coverage_percent', 'single_person_dependency', 'profile_version', 'profile_valid_from']
  const rows = report.rows.flatMap((row) => row.employees.length > 0
    ? row.employees.map((employee) => [report.asOf, row.roleLabel, row.jobGroupName, row.departmentName, row.capabilityName, row.requiredLevelLabel, employee.employeeId, employee.employeeLabel, employee.status, employee.currentLevelLabel, row.assessedEmployees, row.totalRelevantEmployees, row.coveragePercent, row.singlePersonDependency, row.profileVersion, row.profileValidFrom])
    : [[report.asOf, row.roleLabel, row.jobGroupName, row.departmentName, row.capabilityName, row.requiredLevelLabel, null, null, null, null, row.assessedEmployees, row.totalRelevantEmployees, row.coveragePercent, row.singlePersonDependency, row.profileVersion, row.profileValidFrom]])
  return [header, ...rows].map((row) => row.map((value) => csvCell(value)).join(',')).join('\r\n') + '\r\n'
}

export function developmentInsightCsv(report: DevelopmentInsight): string {
  const header = ['as_of', 'record_type', 'employee_id', 'employee', 'title', 'status', 'progress_percent', 'period_start', 'period_end', 'due_on', 'next_meeting_on', 'follow_up_on', 'follow_up_status', 'relevant_employees', 'active_plan_coverage_percent']
  const planRows = report.plans.map((plan) => [report.asOf, 'development_plan', plan.employeeId, plan.employeeLabel, plan.title, plan.status, plan.progressPercent, plan.periodStart, plan.periodEnd, null, null, null, null, report.relevantEmployees, report.coveragePercent])
  const actionRows = report.actions.map((action) => [report.asOf, 'follow_up_action', action.employeeId, action.employeeLabel, action.title, action.status, null, null, null, action.dueOn, action.nextMeetingOn, action.followUpOn, action.followUpStatus, report.relevantEmployees, report.coveragePercent])
  return [header, ...planRows, ...actionRows].map((row) => row.map((value) => csvCell(value)).join(',')).join('\r\n') + '\r\n'
}

export function percentageOf(value: number, total: number): number | null {
  return percentage(value, total)
}
