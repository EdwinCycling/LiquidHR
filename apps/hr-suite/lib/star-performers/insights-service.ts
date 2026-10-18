import { deriveGridCell, GRID_VALUES, type GridCell, type GridValue } from '@/lib/talent-review/rules'

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

export const APPRAISAL_OPEN_STATUSES = ['PLANNED', 'OPEN', 'WAITING', 'ACTIVE'] as const
export type AppraisalStatusFilter = 'all' | 'open' | 'done' | 'overdue' | 'without-due-date' | 'conversation' | 'no-conversation'

export type AppraisalPopulationInput = {
  employee: InsightEmployee
  departmentId: string
}

export type AppraisalItemInput = {
  id: string
  employeeId: string
  itemType: string
  title: string
  occurredOn: string | null
  dueOn: string | null
  nextMeetingOn: string | null
  status: string
}

export type AppraisalInsight = {
  state: InsightState
  asOf: string
  periodFrom: string | null
  periodTo: string | null
  relevantEmployees: number
  sources: { items: boolean }
  registeredConversationEmployees: number
  completedConversationEmployees: number
  incompleteConversationEmployees: number
  noConversationEmployees: number
  conversationCoveragePercent: number | null
  lastConversationDate: string | null
  openAgreementCount: number
  completedAgreementCount: number
  overdueAgreementCount: number
  agreementsWithoutDueDateCount: number
  upcomingFollowUpCount: number
  overdueFollowUpCount: number
  byDepartment: Array<{
    id: string
    label: string
    employeeCount: number
    registeredConversationEmployees: number
    conversationCoveragePercent: number | null
    openAgreementCount: number
    overdueAgreementCount: number
  }>
  employees: Array<{
    employeeId: string
    employeeNumber: string
    employeeLabel: string
    departmentName: string | null
    conversationStatus: 'COMPLETED' | 'REGISTERED' | 'INCOMPLETE' | 'NO_REGISTERED'
    lastConversationDate: string | null
    registeredConversationCount: number
    openAgreementCount: number
    completedAgreementCount: number
    overdueAgreementCount: number
    agreementsWithoutDueDateCount: number
    upcomingFollowUpCount: number
    overdueFollowUpCount: number
    href: string
  }>
  items: Array<{
    id: string
    employeeId: string
    employeeLabel: string
    itemType: 'MEETING_SUMMARY' | 'AGREEMENT'
    title: string
    status: string
    occurredOn: string | null
    dueOn: string | null
    nextMeetingOn: string | null
    followUpStatus: 'upcoming' | 'overdue' | null
    href: string
  }>
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
    history: GridMovementInsight
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
  appraisal: AppraisalInsight
}

export type GridMovementCampaignInput = {
  id: string
  name: string
  status: string
  startsOn: string
  endsOn: string | null
  closedAt: string | null
  previousCampaignId: string | null
  /** Optional fixture-only contract markers. Production campaigns use the canonical DB score contract. */
  modelKey?: string | null
  scaleKey?: string | null
  mappingKey?: string | null
}

export type GridMovementScoreInput = {
  employeeId: string
  campaignId: string
  performanceScore: string | null
  potentialScore: string | null
  gridCell: string | null
  status: string
  updatedAt: string
}

export type GridMovementPopulationInput = InsightEmployee

export type GridMovementSnapshot = {
  campaignId: string
  campaignName: string
  status: string
  closedAt: string | null
  performanceScore: GridValue
  potentialScore: GridValue
  gridCell: GridCell
}

export type GridMovementCampaignSummary = {
  id: string
  name: string
  status: string
  startsOn: string
  endsOn: string | null
  closedAt: string | null
  finalizedEmployees: number
  coveragePercent: number | null
  sourceHref: string
}

export type GridMovementInsight = {
  state: InsightState
  asOf: string
  comparisonStatus: 'comparable' | 'no-previous-reference' | 'previous-not-finalized' | 'incomparable' | 'no-current-campaign'
  comparisonReason: string | null
  relevantEmployees: number
  currentAssessedEmployees: number
  currentCoveragePercent: number | null
  comparableEmployees: number
  changedPositionEmployees: number
  unchangedPositionEmployees: number
  noComparableHistoryEmployees: number
  currentCampaign: GridMovementCampaignSummary | null
  previousCampaign: GridMovementCampaignSummary | null
  performance: { up: number; down: number; unchanged: number }
  potential: { up: number; down: number; unchanged: number }
  rows: Array<{
    employeeId: string
    employeeLabel: string
    employeeNumber: string
    departmentName: string | null
    jobName: string | null
    current: GridMovementSnapshot | null
    previous: GridMovementSnapshot | null
    category: 'COMPARABLE' | 'NO_COMPARABLE_HISTORY'
    position: 'CHANGED' | 'UNCHANGED' | 'NO_COMPARABLE_HISTORY'
    performanceMovement: 'UP' | 'DOWN' | 'UNCHANGED' | 'UNKNOWN'
    potentialMovement: 'UP' | 'DOWN' | 'UNCHANGED' | 'UNKNOWN'
    href: string
    sourceHref: string | null
  }>
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

function appraisalItemInPeriod(item: AppraisalItemInput, periodFrom: string | null, periodTo: string | null): boolean {
  const occurredOn = dateOnly(item.occurredOn)
  if (periodFrom && (!occurredOn || occurredOn < periodFrom)) return false
  if (periodTo && (!occurredOn || occurredOn > periodTo)) return false
  return true
}

function isRegisteredConversation(item: AppraisalItemInput): boolean {
  return item.itemType === 'MEETING_SUMMARY' && !['CANCELLED', 'ARCHIVED'].includes(item.status)
}

function isOpenAgreement(item: AppraisalItemInput): boolean {
  return item.itemType === 'AGREEMENT' && APPRAISAL_OPEN_STATUSES.includes(item.status as (typeof APPRAISAL_OPEN_STATUSES)[number])
}

function appraisalFollowUpStatus(item: AppraisalItemInput, asOf: string): 'upcoming' | 'overdue' | null {
  if (!isOpenAgreement(item) || !item.nextMeetingOn) return null
  return isBefore(item.nextMeetingOn, asOf) ? 'overdue' : 'upcoming'
}

function appraisalEmployeeMatchesStatus(items: readonly AppraisalItemInput[], status: AppraisalStatusFilter, asOf: string): boolean {
  if (status === 'all') return true
  if (status === 'conversation') return items.some(isRegisteredConversation)
  if (status === 'no-conversation') return !items.some(isRegisteredConversation)
  if (status === 'open') return items.some(isOpenAgreement)
  if (status === 'done') return items.some((item) => item.status === 'DONE' && ['AGREEMENT', 'MEETING_SUMMARY'].includes(item.itemType))
  if (status === 'without-due-date') return items.some((item) => isOpenAgreement(item) && item.dueOn === null)
  return items.some((item) => appraisalFollowUpStatus(item, asOf) === 'overdue' || (isOpenAgreement(item) && isBefore(item.dueOn, asOf)))
}

function appraisalItemMatchesStatus(item: AppraisalItemInput, status: AppraisalStatusFilter, asOf: string): boolean {
  if (status === 'all') return true
  if (status === 'conversation') return isRegisteredConversation(item)
  if (status === 'no-conversation') return false
  if (status === 'open') return isOpenAgreement(item)
  if (status === 'done') return item.status === 'DONE' && ['AGREEMENT', 'MEETING_SUMMARY'].includes(item.itemType)
  if (status === 'without-due-date') return isOpenAgreement(item) && item.dueOn === null
  return appraisalFollowUpStatus(item, asOf) === 'overdue' || (isOpenAgreement(item) && isBefore(item.dueOn, asOf))
}

function latestDate(values: readonly (string | null)[]): string | null {
  return values.filter((value): value is string => value !== null).sort((left, right) => right.localeCompare(left))[0] ?? null
}

export function buildAppraisalInsight(input: {
  asOf: string
  periodFrom?: string | null
  periodTo?: string | null
  status?: AppraisalStatusFilter
  population: readonly AppraisalPopulationInput[]
  items: readonly AppraisalItemInput[]
  sources?: { items: boolean }
}): AppraisalInsight {
  const sources = input.sources ?? { items: true }
  const periodFrom = input.periodFrom ?? null
  const periodTo = input.periodTo ?? null
  const populationByEmployee = new Map<string, AppraisalPopulationInput>()
  for (const employee of input.population) {
    if (!populationByEmployee.has(employee.employee.employeeId)) populationByEmployee.set(employee.employee.employeeId, employee)
  }

  const itemById = new Map<string, AppraisalItemInput>()
  for (const item of input.items) {
    if (!populationByEmployee.has(item.employeeId) || !['MEETING_SUMMARY', 'AGREEMENT'].includes(item.itemType) || !appraisalItemInPeriod(item, periodFrom, periodTo)) continue
    if (!itemById.has(item.id)) itemById.set(item.id, item)
  }
  const itemsByEmployee = new Map<string, AppraisalItemInput[]>()
  for (const item of itemById.values()) itemsByEmployee.set(item.employeeId, [...(itemsByEmployee.get(item.employeeId) ?? []), item])
  const status = input.status ?? 'all'
  const population = [...populationByEmployee.values()].filter((employee) => appraisalEmployeeMatchesStatus(itemsByEmployee.get(employee.employee.employeeId) ?? [], status, input.asOf))
  const populationIds = new Set(population.map((employee) => employee.employee.employeeId))
  const scopedItems = [...itemById.values()].filter((item) => populationIds.has(item.employeeId))
  const visibleItems = scopedItems.filter((item) => appraisalItemMatchesStatus(item, status, input.asOf))
  const employeeRows = population.map((populationEmployee) => {
    const employeeItems = scopedItems.filter((item) => item.employeeId === populationEmployee.employee.employeeId)
    const conversations = employeeItems.filter(isRegisteredConversation)
    const unknownConversationStatus = conversations.some((item) => ![...APPRAISAL_OPEN_STATUSES, 'DONE', 'NOT_RELEVANT'].includes(item.status))
    const conversationStatus: AppraisalInsight['employees'][number]['conversationStatus'] = conversations.length === 0
      ? 'NO_REGISTERED'
      : unknownConversationStatus
        ? 'INCOMPLETE'
        : conversations.some((item) => item.status === 'DONE')
          ? 'COMPLETED'
          : 'REGISTERED'
    const agreements = employeeItems.filter((item) => item.itemType === 'AGREEMENT')
    const openAgreements = agreements.filter(isOpenAgreement)
    const followUps = openAgreements.map((item) => appraisalFollowUpStatus(item, input.asOf))
    return {
      employeeId: populationEmployee.employee.employeeId,
      employeeNumber: populationEmployee.employee.employeeNumber,
      employeeLabel: populationEmployee.employee.label,
      departmentName: populationEmployee.employee.departmentName,
      conversationStatus,
      lastConversationDate: latestDate(conversations.map((item) => dateOnly(item.occurredOn))),
      registeredConversationCount: conversations.length,
      openAgreementCount: openAgreements.length,
      completedAgreementCount: agreements.filter((item) => item.status === 'DONE').length,
      overdueAgreementCount: openAgreements.filter((item) => isBefore(item.dueOn, input.asOf)).length,
      agreementsWithoutDueDateCount: openAgreements.filter((item) => item.dueOn === null).length,
      upcomingFollowUpCount: followUps.filter((value) => value === 'upcoming').length,
      overdueFollowUpCount: followUps.filter((value) => value === 'overdue').length,
      href: populationEmployee.employee.href,
    }
  })

  const byDepartment = new Map<string, { label: string; employeeIds: Set<string>; conversationEmployeeIds: Set<string>; openAgreementCount: number; overdueAgreementCount: number }>()
  for (const populationEmployee of population) {
    const id = populationEmployee.departmentId
    const group = byDepartment.get(id) ?? { label: populationEmployee.employee.departmentName ?? id, employeeIds: new Set<string>(), conversationEmployeeIds: new Set<string>(), openAgreementCount: 0, overdueAgreementCount: 0 }
    const row = employeeRows.find((employee) => employee.employeeId === populationEmployee.employee.employeeId)
    group.employeeIds.add(populationEmployee.employee.employeeId)
    if (row && row.conversationStatus !== 'NO_REGISTERED') group.conversationEmployeeIds.add(row.employeeId)
    group.openAgreementCount += row?.openAgreementCount ?? 0
    group.overdueAgreementCount += row?.overdueAgreementCount ?? 0
    byDepartment.set(id, group)
  }

  const result: AppraisalInsight = {
    state: !sources.items ? 'unavailable' : scopedItems.length > 0 ? 'ready' : 'no-data',
    asOf: input.asOf,
    periodFrom,
    periodTo,
    relevantEmployees: population.length,
    sources,
    registeredConversationEmployees: employeeRows.filter((employee) => employee.conversationStatus !== 'NO_REGISTERED').length,
    completedConversationEmployees: employeeRows.filter((employee) => employee.conversationStatus === 'COMPLETED').length,
    incompleteConversationEmployees: employeeRows.filter((employee) => employee.conversationStatus === 'INCOMPLETE').length,
    noConversationEmployees: employeeRows.filter((employee) => employee.conversationStatus === 'NO_REGISTERED').length,
    conversationCoveragePercent: sources.items ? percentage(employeeRows.filter((employee) => employee.conversationStatus !== 'NO_REGISTERED').length, population.length) : null,
    lastConversationDate: latestDate(employeeRows.map((employee) => employee.lastConversationDate)),
    openAgreementCount: employeeRows.reduce((total, employee) => total + employee.openAgreementCount, 0),
    completedAgreementCount: employeeRows.reduce((total, employee) => total + employee.completedAgreementCount, 0),
    overdueAgreementCount: employeeRows.reduce((total, employee) => total + employee.overdueAgreementCount, 0),
    agreementsWithoutDueDateCount: employeeRows.reduce((total, employee) => total + employee.agreementsWithoutDueDateCount, 0),
    upcomingFollowUpCount: employeeRows.reduce((total, employee) => total + employee.upcomingFollowUpCount, 0),
    overdueFollowUpCount: employeeRows.reduce((total, employee) => total + employee.overdueFollowUpCount, 0),
    byDepartment: [...byDepartment.entries()].map(([id, group]) => ({
      id,
      label: group.label,
      employeeCount: group.employeeIds.size,
      registeredConversationEmployees: group.conversationEmployeeIds.size,
      conversationCoveragePercent: sources.items ? percentage(group.conversationEmployeeIds.size, group.employeeIds.size) : null,
      openAgreementCount: group.openAgreementCount,
      overdueAgreementCount: group.overdueAgreementCount,
    })).sort((left, right) => left.label.localeCompare(right.label, 'nl')),
    employees: employeeRows,
     items: visibleItems.sort((left, right) => (dateOnly(right.occurredOn) ?? '').localeCompare(dateOnly(left.occurredOn) ?? '') || left.id.localeCompare(right.id)).map((item) => ({
      id: item.id,
      employeeId: item.employeeId,
      employeeLabel: populationByEmployee.get(item.employeeId)?.employee.label ?? item.employeeId,
      itemType: item.itemType as 'MEETING_SUMMARY' | 'AGREEMENT',
      title: item.title,
      status: item.status,
      occurredOn: item.occurredOn,
      dueOn: item.dueOn,
      nextMeetingOn: item.nextMeetingOn,
      followUpStatus: appraisalFollowUpStatus(item, input.asOf),
      href: `/workforce/continuous-appraisal?employeeId=${encodeURIComponent(item.employeeId)}`,
    })),
  }
  return result
}

export function emptyAppraisalInsight(asOf: string, periodFrom: string | null = null, periodTo: string | null = null): AppraisalInsight {
  return buildAppraisalInsight({ asOf, periodFrom, periodTo, population: [], items: [], sources: { items: true } })
}

function isGridValue(value: string | null): value is GridValue {
  return value !== null && GRID_VALUES.includes(value as GridValue)
}

function validGridScore(score: GridMovementScoreInput | undefined): { performanceScore: GridValue; potentialScore: GridValue; gridCell: GridCell } | null {
  if (!score || score.status !== 'CLOSED' || !isGridValue(score.performanceScore) || !isGridValue(score.potentialScore)) return null
  const gridCell = deriveGridCell(score.performanceScore, score.potentialScore)
  return gridCell !== null && score.gridCell === gridCell ? { performanceScore: score.performanceScore, potentialScore: score.potentialScore, gridCell } : null
}

function latestValidGridScores(scores: readonly GridMovementScoreInput[], campaignId: string): Map<string, { input: GridMovementScoreInput; value: { performanceScore: GridValue; potentialScore: GridValue; gridCell: GridCell } }> {
  const result = new Map<string, { input: GridMovementScoreInput; value: { performanceScore: GridValue; potentialScore: GridValue; gridCell: GridCell } }>()
  for (const score of scores) {
    if (score.campaignId !== campaignId) continue
    const value = validGridScore(score)
    if (!value) continue
    const current = result.get(score.employeeId)
    if (!current || score.updatedAt > current.input.updatedAt) result.set(score.employeeId, { input: score, value })
  }
  return result
}

function movementForAxis(previous: GridValue, current: GridValue): 'UP' | 'DOWN' | 'UNCHANGED' {
  const previousIndex = GRID_VALUES.indexOf(previous)
  const currentIndex = GRID_VALUES.indexOf(current)
  if (currentIndex > previousIndex) return 'UP'
  if (currentIndex < previousIndex) return 'DOWN'
  return 'UNCHANGED'
}

function gridSourceHref(campaignId: string): string {
  return `/workforce/9-grid?campaignId=${encodeURIComponent(campaignId)}&tab=results`
}

function campaignContractsComparable(current: GridMovementCampaignInput, previous: GridMovementCampaignInput): boolean {
  const canonical = {
    modelKey: 'canonical-performance-potential-v1',
    scaleKey: 'LOW|NORMAL|HIGH',
    mappingKey: 'performance_potential',
  }
  return (current.modelKey ?? canonical.modelKey) === (previous.modelKey ?? canonical.modelKey)
    && (current.scaleKey ?? canonical.scaleKey) === (previous.scaleKey ?? canonical.scaleKey)
    && (current.mappingKey ?? canonical.mappingKey) === (previous.mappingKey ?? canonical.mappingKey)
}

function gridCampaignSummary(
  campaign: GridMovementCampaignInput,
  finalizedEmployees: number,
  relevantEmployees: number,
): GridMovementCampaignSummary {
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    startsOn: campaign.startsOn,
    endsOn: campaign.endsOn,
    closedAt: campaign.closedAt,
    finalizedEmployees,
    coveragePercent: percentage(finalizedEmployees, relevantEmployees),
    sourceHref: gridSourceHref(campaign.id),
  }
}

export function emptyGridMovementInsight(asOf: string, relevantEmployees = 0): GridMovementInsight {
  return {
    state: 'no-data',
    asOf,
    comparisonStatus: 'no-current-campaign',
    comparisonReason: 'No finalized campaign is available for this scope.',
    relevantEmployees,
    currentAssessedEmployees: 0,
    currentCoveragePercent: percentage(0, relevantEmployees),
    comparableEmployees: 0,
    changedPositionEmployees: 0,
    unchangedPositionEmployees: 0,
    noComparableHistoryEmployees: 0,
    currentCampaign: null,
    previousCampaign: null,
    performance: { up: 0, down: 0, unchanged: 0 },
    potential: { up: 0, down: 0, unchanged: 0 },
    rows: [],
  }
}

export function buildGridMovementInsight(input: {
  asOf: string
  population: readonly GridMovementPopulationInput[]
  campaigns: readonly GridMovementCampaignInput[]
  scores: readonly GridMovementScoreInput[]
  selectedCampaignId: string | null
}): GridMovementInsight {
  const populationById = new Map<string, GridMovementPopulationInput>()
  for (const employee of input.population) if (!populationById.has(employee.employeeId)) populationById.set(employee.employeeId, employee)
  const relevantEmployees = populationById.size
  const campaigns = input.campaigns.filter((campaign) => campaign.status === 'CLOSED' || campaign.status === 'ARCHIVED')
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]))
  const currentCampaign = (input.selectedCampaignId ? campaignById.get(input.selectedCampaignId) : null)
    ?? [...campaigns].sort((left, right) => (right.closedAt ?? right.startsOn).localeCompare(left.closedAt ?? left.startsOn))[0]
    ?? null
  if (!currentCampaign) return emptyGridMovementInsight(input.asOf, relevantEmployees)

  const currentScores = latestValidGridScores(input.scores, currentCampaign.id)
  const currentSummary = gridCampaignSummary(currentCampaign, [...currentScores.keys()].filter((employeeId) => populationById.has(employeeId)).length, relevantEmployees)
  const currentRows = [...currentScores.entries()]
    .filter(([employeeId]) => populationById.has(employeeId))
    .map(([employeeId, score]) => ({ employee: populationById.get(employeeId)!, score }))
    .sort((left, right) => left.employee.label.localeCompare(right.employee.label, 'nl'))
  const baseRows = currentRows.map(({ employee, score }) => {
    const snapshot: GridMovementSnapshot = {
      campaignId: currentCampaign.id,
      campaignName: currentCampaign.name,
      status: score.input.status,
      closedAt: currentCampaign.closedAt,
      performanceScore: score.value.performanceScore,
      potentialScore: score.value.potentialScore,
      gridCell: score.value.gridCell,
    }
    return {
      employee,
      current: snapshot,
      previous: null as GridMovementSnapshot | null,
      category: 'NO_COMPARABLE_HISTORY' as const,
      position: 'NO_COMPARABLE_HISTORY' as const,
      performanceMovement: 'UNKNOWN' as const,
      potentialMovement: 'UNKNOWN' as const,
    }
  })
  const previousCampaignId = currentCampaign.previousCampaignId
  const previousCampaign = previousCampaignId ? campaignById.get(previousCampaignId) ?? null : null
  let comparisonStatus: GridMovementInsight['comparisonStatus'] = 'no-previous-reference'
  let comparisonReason: string | null = 'The current campaign has no explicit previous campaign reference.'
  let previousScores = new Map<string, { input: GridMovementScoreInput; value: { performanceScore: GridValue; potentialScore: GridValue; gridCell: GridCell } }>()
  if (previousCampaignId && !previousCampaign) {
    comparisonStatus = 'previous-not-finalized'
    comparisonReason = 'The referenced previous campaign is not finalized or is outside the authorized history.'
  } else if (previousCampaign) {
    if (!campaignContractsComparable(currentCampaign, previousCampaign)) {
      comparisonStatus = 'incomparable'
      comparisonReason = 'The campaign score model, scale, or grid mapping is not comparable.'
    } else {
      comparisonStatus = 'comparable'
      comparisonReason = null
      previousScores = latestValidGridScores(input.scores, previousCampaign.id)
    }
  }

  let comparableEmployees = 0
  let changedPositionEmployees = 0
  let unchangedPositionEmployees = 0
  let noComparableHistoryEmployees = 0
  const performance = { up: 0, down: 0, unchanged: 0 }
  const potential = { up: 0, down: 0, unchanged: 0 }
  const rows = baseRows.map((row) => {
    const previousScore = comparisonStatus === 'comparable' ? previousScores.get(row.employee.employeeId) : undefined
    if (!previousScore) {
      noComparableHistoryEmployees += 1
      return {
        employeeId: row.employee.employeeId,
        employeeLabel: row.employee.label,
        employeeNumber: row.employee.employeeNumber,
        departmentName: row.employee.departmentName,
        jobName: row.employee.jobName,
        current: row.current,
        previous: null,
        category: row.category,
        position: row.position,
        performanceMovement: row.performanceMovement,
        potentialMovement: row.potentialMovement,
        href: row.employee.href,
        sourceHref: currentSummary.sourceHref,
      }
    }
    comparableEmployees += 1
    const previous: GridMovementSnapshot = {
      campaignId: previousCampaign!.id,
      campaignName: previousCampaign!.name,
      status: previousScore.input.status,
      closedAt: previousCampaign!.closedAt,
      performanceScore: previousScore.value.performanceScore,
      potentialScore: previousScore.value.potentialScore,
      gridCell: previousScore.value.gridCell,
    }
    const performanceMovement = movementForAxis(previous.performanceScore, row.current.performanceScore)
    const potentialMovement = movementForAxis(previous.potentialScore, row.current.potentialScore)
    const position = previous.gridCell === row.current.gridCell ? 'UNCHANGED' as const : 'CHANGED' as const
    if (position === 'CHANGED') changedPositionEmployees += 1
    else unchangedPositionEmployees += 1
    performance[performanceMovement === 'UP' ? 'up' : performanceMovement === 'DOWN' ? 'down' : 'unchanged'] += 1
    potential[potentialMovement === 'UP' ? 'up' : potentialMovement === 'DOWN' ? 'down' : 'unchanged'] += 1
    return {
      employeeId: row.employee.employeeId,
      employeeLabel: row.employee.label,
      employeeNumber: row.employee.employeeNumber,
      departmentName: row.employee.departmentName,
      jobName: row.employee.jobName,
      current: row.current,
      previous,
      category: 'COMPARABLE' as const,
      position,
      performanceMovement,
      potentialMovement,
      href: row.employee.href,
      sourceHref: currentSummary.sourceHref,
    }
  })

  return {
    state: comparableEmployees > 0 ? 'ready' : 'no-data',
    asOf: input.asOf,
    comparisonStatus,
    comparisonReason,
    relevantEmployees,
    currentAssessedEmployees: currentRows.length,
    currentCoveragePercent: percentage(currentRows.length, relevantEmployees),
    comparableEmployees,
    changedPositionEmployees,
    unchangedPositionEmployees,
    noComparableHistoryEmployees,
    currentCampaign: currentSummary,
    previousCampaign: previousCampaign ? gridCampaignSummary(previousCampaign, [...previousScores.keys()].filter((employeeId) => populationById.has(employeeId)).length, relevantEmployees) : null,
    performance,
    potential,
    rows,
  }
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

export function appraisalInsightCsv(report: AppraisalInsight): string {
  const header = ['as_of', 'period_from', 'period_to', 'record_type', 'employee_id', 'employee', 'title', 'status', 'occurred_on', 'due_on', 'next_meeting_on', 'follow_up_status', 'relevant_employees', 'registered_conversation_employees', 'conversation_coverage_percent', 'open_agreements', 'completed_agreements', 'overdue_agreements', 'agreements_without_due_date', 'source_href']
  const rows = report.items.length > 0
    ? report.items.map((item) => [report.asOf, report.periodFrom, report.periodTo, item.itemType, item.employeeId, item.employeeLabel, item.title, item.status, item.occurredOn, item.dueOn, item.nextMeetingOn, item.followUpStatus, report.relevantEmployees, report.registeredConversationEmployees, report.conversationCoveragePercent, report.openAgreementCount, report.completedAgreementCount, report.overdueAgreementCount, report.agreementsWithoutDueDateCount, item.href])
    : [[report.asOf, report.periodFrom, report.periodTo, null, null, null, null, null, null, null, null, null, report.relevantEmployees, report.registeredConversationEmployees, report.conversationCoveragePercent, report.openAgreementCount, report.completedAgreementCount, report.overdueAgreementCount, report.agreementsWithoutDueDateCount, null]]
  return [header, ...rows].map((row) => row.map((value) => csvCell(value)).join(',')).join('\r\n') + '\r\n'
}

export function gridMovementCsv(report: GridMovementInsight): string {
  const header = [
    'as_of', 'comparison_status', 'relevant_employees', 'current_assessed_employees', 'current_coverage_percent',
    'comparable_employees', 'changed_position_employees', 'unchanged_position_employees', 'no_comparable_history_employees',
    'current_campaign_id', 'current_campaign', 'current_campaign_status', 'current_starts_on', 'current_ends_on', 'current_closed_at',
    'previous_campaign_id', 'previous_campaign', 'previous_campaign_status', 'previous_starts_on', 'previous_ends_on', 'previous_closed_at',
    'employee_id', 'employee_number', 'employee', 'department', 'job', 'current_performance', 'current_potential', 'current_grid_cell',
    'previous_performance', 'previous_potential', 'previous_grid_cell', 'performance_movement', 'potential_movement', 'position', 'category', 'source_href',
  ]
  const current = report.currentCampaign
  const previous = report.previousCampaign
  const rows = report.rows.length > 0 ? report.rows.map((row) => [
    report.asOf, report.comparisonStatus, report.relevantEmployees, report.currentAssessedEmployees, report.currentCoveragePercent,
    report.comparableEmployees, report.changedPositionEmployees, report.unchangedPositionEmployees, report.noComparableHistoryEmployees,
    current?.id ?? null, current?.name ?? null, current?.status ?? null, current?.startsOn ?? null, current?.endsOn ?? null, current?.closedAt ?? null,
    previous?.id ?? null, previous?.name ?? null, previous?.status ?? null, previous?.startsOn ?? null, previous?.endsOn ?? null, previous?.closedAt ?? null,
    row.employeeId, row.employeeNumber, row.employeeLabel, row.departmentName, row.jobName, row.current?.performanceScore ?? null, row.current?.potentialScore ?? null, row.current?.gridCell ?? null,
    row.previous?.performanceScore ?? null, row.previous?.potentialScore ?? null, row.previous?.gridCell ?? null, row.performanceMovement, row.potentialMovement, row.position, row.category, row.sourceHref,
  ]) : [[
    report.asOf, report.comparisonStatus, report.relevantEmployees, report.currentAssessedEmployees, report.currentCoveragePercent,
    report.comparableEmployees, report.changedPositionEmployees, report.unchangedPositionEmployees, report.noComparableHistoryEmployees,
    current?.id ?? null, current?.name ?? null, current?.status ?? null, current?.startsOn ?? null, current?.endsOn ?? null, current?.closedAt ?? null,
    previous?.id ?? null, previous?.name ?? null, previous?.status ?? null, previous?.startsOn ?? null, previous?.endsOn ?? null, previous?.closedAt ?? null,
    ...Array.from({ length: header.length - 21 }, () => null),
  ]]
  return [header, ...rows].map((row) => row.map((value) => csvCell(value)).join(',')).join('\r\n') + '\r\n'
}

export function percentageOf(value: number, total: number): number | null {
  return percentage(value, total)
}
