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
  development: {
    state: InsightState
    activePlansCount: number
    employeesWithActivePlans: number
    averageProgress: number | null
    openActionCount: number
    plans: Array<{
      id: string
      employeeId: string
      employeeLabel: string
      title: string
      progressPercent: number
      periodEnd: string | null
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
      href: string
    }>
    trendAvailable: boolean
  }
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

function percentage(value: number, total: number): number | null {
  return total > 0 ? Math.round((value / total) * 100) : null
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

export function percentageOf(value: number, total: number): number | null {
  return percentage(value, total)
}
