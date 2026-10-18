import 'server-only'

import { AuthorizationError, getRequestAuthorizationContext, requirePermissionInContext, type AuthContext } from '@/lib/auth/permissions'
import { listContinuousAppraisalItemsForEmployees, listContinuousAppraisalWorkspace } from '@/lib/continuous-appraisal/service'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { listTalentEmployeeCapabilityRecords } from '@/lib/talent/employee-capability-service'
import { listTalentGoals } from '@/lib/talent/goal-service'
import { evaluateTalentRoleExplorerOutcome, listTalentRoleExplorerWorkspace, type TalentRoleExplorerComparison } from '@/lib/talent/role-explorer-service'
import { listTalentProfilesForWorkforce } from '@/lib/talent/service'
import { movementDirection, type GridCell } from '@/lib/talent-review/rules'
import { listDirectTeamEmployeeIds } from '@/lib/organization/team-scope'
import { createClient } from '@/lib/supabase/server'
import type { StarPerformerAssessment, StarPerformerTag } from './service'
import type { StarPerformerWorkspaceQuery } from './schemas'
import { StarPerformerError } from './service'
import {
  buildCriticalityDistribution,
  buildDevelopmentInsight,
  buildFunctionSkillGapReport,
  buildGridDistribution,
  buildMovementSummary,
  buildSkillCoverage,
  emptyDevelopmentInsight,
  percentageOf,
  type DevelopmentActionInput,
  type DevelopmentPlanInput,
  type FunctionSkillGapReport,
  type InsightBreakdown,
  type InsightEmployee,
  type SkillGapComparisonInput,
  type SkillComparisonInput,
  type StarPerformersInsights,
} from './insights-service'

const MAX_SCOPE_EMPLOYEES = 5000
const MAX_ASSESSMENTS = 5000
const MAX_GRID_CAMPAIGNS = 100
const PAGE_SIZE = 20

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface StarPerformersReadDependencies {
  readonly auth: AuthContext
  readonly supabase: SupabaseServerClient
  /**
   * A server-derived dashboard scope. The report route omits this and lets
   * the access resolver derive the direct-team scope for Managers.
   */
  readonly scopeEmployeeIds?: readonly string[] | null
}

export interface StarPerformersReadAccess {
  readonly auth: AuthContext
  readonly supabase: SupabaseServerClient
  readonly employeeIds: readonly string[] | null
  readonly isManager: boolean
  readonly isAdmin: boolean
}

type PlacementRow = {
  employee_id: string
  department_id: string
  job_id: string | null
  job_title: string | null
  effective_from: string
}

type AssessmentRow = {
  id: string
  employee_id: string
  job_id: string | null
  job_group_id: string | null
  criticality_level: number
  updated_at: string
}

type GridCampaignRow = {
  id: string
  name: string
  status: string
  closed_at: string | null
  starts_on: string
  previous_campaign_id: string | null
}

type GridScoreRow = {
  employee_id: string
  campaign_id: string
  performance_score: string | null
  potential_score: string | null
  grid_cell: string | null
  status: string
  updated_at: string
}

export type StarPerformersGridMovement = 'UP' | 'DOWN' | 'STABLE' | 'NEW' | null

export type StarPerformersGridSignal = {
  campaignId: string
  campaignName: string
  closedAt: string | null
  performanceScore: string | null
  potentialScore: string | null
  gridCell: string | null
  isHighHigh: boolean
  movement: StarPerformersGridMovement
}

export type StarPerformersWorkspaceRow = {
  employeeId: string
  employeeNumber: string
  firstName: string
  birthName: string
  workEmail: string | null
  avatarUrl: string | null
  departmentId: string | null
  departmentName: string | null
  jobId: string | null
  jobName: string | null
  jobGroupId: string | null
  jobGroupName: string | null
  assessment: StarPerformerAssessment | null
  gridSignal: StarPerformersGridSignal | null
}

export type StarPerformersWorkspacePage = {
  perspective: StarPerformerWorkspaceQuery['perspective']
  rows: StarPerformersWorkspaceRow[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  kpis: {
    employeesInScope: number
    approvedGrid: number
    highHighSignals: number
    assessedKeyEmployees: number
  }
  filters: {
    departments: Array<{ id: string; name: string }>
    jobs: Array<{ id: string; name: string; jobGroupId: string | null }>
    jobGroups: Array<{ id: string; name: string }>
    tags: StarPerformerTag[]
  }
}

type ModuleState = 'ready' | 'unavailable'

export type StarPerformersDetail = {
  employee: StarPerformersWorkspaceRow
  tags: StarPerformerTag[]
  grid: { state: ModuleState; signal: StarPerformersGridSignal | null }
  skills: {
    state: ModuleState
    records: Array<{
      id: string
      name: string
      type: string
      level: string | null
      evidenceStatus: string | null
      status: string
      source: string
      validUntil: string | null
    }>
  }
  jobProfile: {
    state: ModuleState
    profile: {
      id: string
      jobCode: string
      jobGroupName: string | null
      version: number
    } | null
    gaps: Array<{
      name: string
      status: string
      currentLevel: string | null
      targetLevel: string | null
      rationale: string | null
    }>
  }
  development: {
    state: ModuleState
    plans: Array<{
      id: string
      title: string
      status: string
      progressPercent: number
      periodStart: string
      periodEnd: string | null
    }>
  }
  appraisal: {
    state: ModuleState
    items: Array<{
      id: string
      title: string
      status: string
      occurredOn: string
      dueOn: string | null
      nextMeetingOn: string | null
      itemType: string
    }>
  }
  links: {
    grid: string
    skills: string
    roleExplorer: string
    comparison: string
    development: string
    appraisal: string
    employee: string
  }
}

function databaseError(message: string): never {
  const normalized = message.toLocaleUpperCase('en-US')
  const status = normalized.includes('FORBIDDEN') || normalized.includes('42501') ? 403 : 400
  throw new StarPerformerError('STAR_PERFORMER_WORKSPACE_FAILED', status)
}

function isUnavailableError(error: unknown): boolean {
  if (error instanceof AuthorizationError) return true
  if (!error || typeof error !== 'object') return false
  const candidate = error as { status?: unknown; code?: unknown }
  return candidate.status === 403 || (typeof candidate.code === 'string' && candidate.code.includes('FORBIDDEN'))
}

function currentDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function resolveStarPerformersReadAccess(
  dependencies?: StarPerformersReadDependencies,
): Promise<StarPerformersReadAccess> {
  const requestContext = dependencies ? null : await getRequestAuthorizationContext()
  const auth = dependencies?.auth ?? requestContext!.context
  const supabase = dependencies?.supabase ?? requestContext!.supabase
  const isAdmin = auth.activeRoles.some((role) => role === 'TENANT_ADMIN' || role === 'HR_ADMIN')

  if (isAdmin) {
    await requirePermissionInContext(supabase, auth, 'star-performer:read')
    return {
      auth,
      supabase,
      employeeIds: dependencies?.scopeEmployeeIds === undefined ? null : dependencies.scopeEmployeeIds,
      isManager: false,
      isAdmin: true,
    }
  }

  if (!auth.activeRoles.includes('DIRECT_MANAGER')) {
    throw new AuthorizationError('Je hebt geen toegang tot Star Performers-inzichten.')
  }
  await requirePermissionInContext(supabase, auth, 'star-performer:manager-read')
  const employeeIds = dependencies?.scopeEmployeeIds === undefined
    ? await listDirectTeamEmployeeIds(auth, supabase)
    : [...(dependencies.scopeEmployeeIds ?? [])]
  return { auth, supabase, employeeIds, isManager: true, isAdmin: false }
}

export function restrictStarPerformersEmployeeIds(
  searchIds: string[] | null,
  allowedEmployeeIds: readonly string[] | null,
): string[] | null {
  if (allowedEmployeeIds === null) return searchIds
  if (searchIds === null) return [...allowedEmployeeIds]
  const allowed = new Set(allowedEmployeeIds)
  return searchIds.filter((employeeId) => allowed.has(employeeId))
}

function gridCell(value: string | null): GridCell | null {
  if (value === 'LOW_LOW' || value === 'LOW_NORMAL' || value === 'LOW_HIGH' || value === 'NORMAL_LOW' || value === 'NORMAL_NORMAL' || value === 'NORMAL_HIGH' || value === 'HIGH_LOW' || value === 'HIGH_NORMAL' || value === 'HIGH_HIGH') return value
  return null
}

function latestRevisionNameByJobId(
  revisions: Array<{ job_id: string; name: string; valid_from: string }>,
): Map<string, string> {
  const names = new Map<string, string>()
  for (const revision of revisions) {
    if (!names.has(revision.job_id)) names.set(revision.job_id, revision.name)
  }
  return names
}

function assessmentMatchesPlacement(
  assessment: AssessmentRow,
  placement: Pick<PlacementRow, 'job_id'>,
  jobGroupByJobId: Map<string, string>,
): boolean {
  if (assessment.job_id && assessment.job_id === placement.job_id) return true
  const placementJobGroupId = placement.job_id ? jobGroupByJobId.get(placement.job_id) : undefined
  return Boolean(assessment.job_group_id && placementJobGroupId && assessment.job_group_id === placementJobGroupId)
}

function assessmentForPlacement(
  employeeId: string,
  placement: Pick<PlacementRow, 'job_id'>,
  assessments: AssessmentRow[],
  jobGroupByJobId: Map<string, string>,
  tagIdsByAssessmentId: Map<string, string[]>,
): StarPerformerAssessment | null {
  const matching = assessments
    .filter((assessment) => assessment.employee_id === employeeId && assessmentMatchesPlacement(assessment, placement, jobGroupByJobId))
    .sort((left, right) => {
      const leftExact = left.job_id === placement.job_id ? 1 : 0
      const rightExact = right.job_id === placement.job_id ? 1 : 0
      return rightExact - leftExact || right.updated_at.localeCompare(left.updated_at)
    })
  const assessment = matching[0]
  if (!assessment) return null
  return {
    id: assessment.id,
    employeeId: assessment.employee_id,
    jobId: assessment.job_id,
    jobGroupId: assessment.job_group_id,
    criticalityLevel: assessment.criticality_level,
    tagIds: tagIdsByAssessmentId.get(assessment.id) ?? [],
    updatedAt: assessment.updated_at,
  }
}

export function selectLatestApprovedGridSignals(
  campaigns: GridCampaignRow[],
  scores: GridScoreRow[],
): Map<string, StarPerformersGridSignal> {
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]))
  const approvedScores = scores
    .filter((score) => score.status === 'CLOSED')
    .flatMap((score) => {
      const campaign = campaignById.get(score.campaign_id)
      if (!campaign || !['CLOSED', 'ARCHIVED'].includes(campaign.status)) return []
      return [{ score, campaign }]
    })
    .sort((left, right) => {
      const leftDate = left.campaign.closed_at ?? left.campaign.starts_on
      const rightDate = right.campaign.closed_at ?? right.campaign.starts_on
      return rightDate.localeCompare(leftDate) || right.score.updated_at.localeCompare(left.score.updated_at)
    })

  const previousByCampaignAndEmployee = new Map<string, GridScoreRow>()
  for (const item of approvedScores) {
    previousByCampaignAndEmployee.set(`${item.score.campaign_id}::${item.score.employee_id}`, item.score)
  }

  const result = new Map<string, StarPerformersGridSignal>()
  for (const item of approvedScores) {
    if (result.has(item.score.employee_id)) continue
    const previous = item.campaign.previous_campaign_id
      ? previousByCampaignAndEmployee.get(`${item.campaign.previous_campaign_id}::${item.score.employee_id}`)
      : undefined
    const currentCell = gridCell(item.score.grid_cell)
    const previousCell = gridCell(previous?.grid_cell ?? null)
    const movement = movementDirection(previousCell, currentCell)
    result.set(item.score.employee_id, {
      campaignId: item.campaign.id,
      campaignName: item.campaign.name,
      closedAt: item.campaign.closed_at,
      performanceScore: item.score.performance_score,
      potentialScore: item.score.potential_score,
      gridCell: item.score.grid_cell,
      isHighHigh: item.score.grid_cell === 'HIGH_HIGH',
      movement: movement === 'UNKNOWN' ? null : movement,
    })
  }
  return result
}

async function readReferenceData(supabase: SupabaseServerClient, tenantId: string, today: string, includeTags = true) {
  const [departmentsResult, jobsResult, jobGroupsResult, revisionsResult] = await Promise.all([
    supabase.from('departments').select('id, name').eq('tenant_id', tenantId).eq('is_active', true).order('name').limit(500),
    supabase.from('jobs').select('id, code, job_group_id').eq('tenant_id', tenantId).eq('is_active', true).order('code').limit(2000),
    supabase.from('job_groups').select('id, name').eq('tenant_id', tenantId).eq('is_active', true).order('name').limit(500),
    supabase.from('job_revisions').select('job_id, name, valid_from').eq('tenant_id', tenantId).lte('valid_from', today).or(`valid_until.is.null,valid_until.gt.${today}`).order('valid_from', { ascending: false }).limit(4000),
  ])
  const failed = [departmentsResult, jobsResult, jobGroupsResult, revisionsResult].find((result) => result.error)
  if (failed?.error) databaseError(failed.error.message)

  const tagsResult = includeTags
    ? await supabase.from('star_performer_tags').select('id, name, is_active').eq('tenant_id', tenantId).order('name').limit(500)
    : { data: [], error: null }
  if (tagsResult.error) databaseError(tagsResult.error.message)

  const departmentById = new Map((departmentsResult.data ?? []).map((department) => [department.id, department.name]))
  const jobById = new Map((jobsResult.data ?? []).map((job) => [job.id, job]))
  const jobGroupById = new Map((jobGroupsResult.data ?? []).map((group) => [group.id, group.name]))
  const jobGroupByJobId = new Map((jobsResult.data ?? []).map((job) => [job.id, job.job_group_id]))
  const jobNameById = latestRevisionNameByJobId(revisionsResult.data ?? [])
  const tags: StarPerformerTag[] = (tagsResult.data ?? []).map((tag) => ({
    id: tag.id,
    name: tag.name,
    isActive: tag.is_active,
    usageCount: 0,
  }))

  return { departmentById, jobById, jobGroupById, jobGroupByJobId, jobNameById, tags }
}

async function readAssessments(supabase: SupabaseServerClient, administrationId: string): Promise<AssessmentRow[]> {
  const { data, error } = await supabase
    .from('star_performer_assessments')
    .select('id, employee_id, job_id, job_group_id, criticality_level, updated_at')
    .eq('administration_id', administrationId)
    .order('updated_at', { ascending: false })
    .limit(MAX_ASSESSMENTS)
  if (error) databaseError(error.message)
  return data ?? []
}

async function readGridSignals(
  supabase: SupabaseServerClient,
  tenantId: string,
  administrationId: string,
  employeeIds: string[],
): Promise<Map<string, StarPerformersGridSignal>> {
  const history = await readGridHistory(supabase, tenantId, administrationId, employeeIds)
  return selectLatestApprovedGridSignals(history.campaigns, history.scores)
}

async function readGridHistory(
  supabase: SupabaseServerClient,
  tenantId: string,
  administrationId: string,
  employeeIds: string[],
): Promise<{ campaigns: GridCampaignRow[]; scores: GridScoreRow[] }> {
  if (!employeeIds.length) return { campaigns: [], scores: [] }
  const { data: campaigns, error: campaignsError } = await supabase
    .from('talent_review_campaigns')
    .select('id, name, status, closed_at, starts_on, previous_campaign_id')
    .eq('tenant_id', tenantId)
    .eq('administration_id', administrationId)
    .in('status', ['CLOSED', 'ARCHIVED'])
    .order('closed_at', { ascending: false })
    .limit(MAX_GRID_CAMPAIGNS)
  if (campaignsError) databaseError(campaignsError.message)

  const campaignRows: GridCampaignRow[] = campaigns ?? []
  const campaignIds = campaignRows.map((campaign) => campaign.id)
  if (!campaignIds.length) return { campaigns: campaignRows, scores: [] }
  const { data: scores, error: scoresError } = await supabase
    .from('talent_review_scores')
    .select('employee_id, campaign_id, performance_score, potential_score, grid_cell, status, updated_at')
    .eq('tenant_id', tenantId)
    .in('campaign_id', campaignIds)
    .in('employee_id', employeeIds)
    .eq('status', 'CLOSED')
    .limit(MAX_ASSESSMENTS)
  if (scoresError) databaseError(scoresError.message)
  return { campaigns: campaignRows, scores: scores ?? [] }
}

async function searchEmployeeIds(
  supabase: SupabaseServerClient,
  tenantId: string,
  query: string,
): Promise<string[] | null> {
  const needle = query.trim().replace(/[%,]/g, ' ')
  if (!needle) return null
  const { data, error } = await supabase
    .from('employees')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('is_archived', false)
    .is('deleted_at', null)
    .or(`first_name.ilike.%${needle}%,birth_name.ilike.%${needle}%,employee_number.ilike.%${needle}%`)
    .limit(MAX_SCOPE_EMPLOYEES)
  if (error) databaseError(error.message)
  return (data ?? []).map((employee) => employee.id)
}

async function readPlacements(
  supabase: SupabaseServerClient,
  administrationId: string,
  query: StarPerformerWorkspaceQuery,
  today: string,
  jobIdsForGroup: string[] | null,
  allowedEmployeeIds: string[] | null,
): Promise<PlacementRow[]> {
  let placementsQuery = supabase
    .from('employee_organizations')
    .select('employee_id, department_id, job_id, job_title, effective_from')
    .eq('administration_id', administrationId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('employee_id')
    .order('effective_from', { ascending: false })

  if (query.departmentId) placementsQuery = placementsQuery.eq('department_id', query.departmentId)
  if (query.jobId) placementsQuery = placementsQuery.eq('job_id', query.jobId)
  if (query.jobGroupId) {
    if (!jobIdsForGroup?.length) return []
    placementsQuery = placementsQuery.in('job_id', jobIdsForGroup)
  }
  if (allowedEmployeeIds) {
    if (!allowedEmployeeIds.length) return []
    placementsQuery = placementsQuery.in('employee_id', allowedEmployeeIds)
  }

  placementsQuery = placementsQuery.limit(MAX_SCOPE_EMPLOYEES)
  const { data, error } = await placementsQuery
  if (error) databaseError(error.message)
  return data ?? []
}

async function readPageEmployees(
  supabase: SupabaseServerClient,
  tenantId: string,
  employeeIds: string[],
) {
  if (!employeeIds.length) return []
  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_number, first_name, birth_name, work_email, avatar_url')
    .eq('tenant_id', tenantId)
    .in('id', employeeIds)
    .eq('is_active', true)
    .eq('is_archived', false)
    .is('deleted_at', null)
    .limit(employeeIds.length)
  if (error) databaseError(error.message)
  return data ?? []
}

function toWorkspaceRow(
  employee: Awaited<ReturnType<typeof readPageEmployees>>[number],
  placement: PlacementRow,
  refs: Awaited<ReturnType<typeof readReferenceData>>,
  assessments: AssessmentRow[],
  tagIdsByAssessmentId: Map<string, string[]>,
  gridSignal: StarPerformersGridSignal | null,
): StarPerformersWorkspaceRow {
  const job = placement.job_id ? refs.jobById.get(placement.job_id) : undefined
  return {
    employeeId: employee.id,
    employeeNumber: employee.employee_number,
    firstName: employee.first_name,
    birthName: employee.birth_name,
    workEmail: employee.work_email,
    avatarUrl: employeeAvatarHref(employee.id, employee.avatar_url),
    departmentId: placement.department_id,
    departmentName: refs.departmentById.get(placement.department_id) ?? null,
    jobId: placement.job_id,
    jobName: placement.job_id ? refs.jobNameById.get(placement.job_id) ?? placement.job_title ?? job?.code ?? null : placement.job_title,
    jobGroupId: job?.job_group_id ?? null,
    jobGroupName: job?.job_group_id ? refs.jobGroupById.get(job.job_group_id) ?? null : null,
    assessment: assessmentForPlacement(employee.id, placement, assessments, refs.jobGroupByJobId, tagIdsByAssessmentId),
    gridSignal,
  }
}

export async function listStarPerformersWorkspacePage(
  query: StarPerformerWorkspaceQuery,
  dependencies?: StarPerformersReadDependencies,
): Promise<StarPerformersWorkspacePage> {
  const access = await resolveStarPerformersReadAccess(dependencies)
  const auth = access.auth
  if (!auth.administrationId) throw new StarPerformerError('ADMINISTRATION_REQUIRED', 400)
  const supabase = access.supabase
  const today = currentDate()
  const refs = await readReferenceData(supabase, auth.tenantId, today, access.isAdmin)
  const searchIds = restrictStarPerformersEmployeeIds(await searchEmployeeIds(supabase, auth.tenantId, query.q), access.employeeIds)
  if (searchIds?.length === 0) {
    return emptyWorkspacePage(query, refs)
  }

  const baseQuery = { ...query, status: 'all' as const }
  const jobIdsForGroup = query.jobGroupId
    ? [...refs.jobById.values()].filter((job) => job.job_group_id === query.jobGroupId).map((job) => job.id)
    : null
  const basePlacements = await readPlacements(supabase, auth.administrationId, baseQuery, today, jobIdsForGroup, searchIds)
  const placementByEmployee = new Map<string, PlacementRow>()
  for (const placement of basePlacements) {
    if (!placementByEmployee.has(placement.employee_id)) placementByEmployee.set(placement.employee_id, placement)
  }
  const baseEmployeeIds = [...placementByEmployee.keys()]
  if (!baseEmployeeIds.length) return emptyWorkspacePage(query, refs)

  const { data: activeEmployees, error: activeEmployeesError } = await supabase
    .from('employees')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .in('id', baseEmployeeIds)
    .eq('is_active', true)
    .eq('is_archived', false)
    .is('deleted_at', null)
  if (activeEmployeesError) databaseError(activeEmployeesError.message)
  const activeIds = new Set((activeEmployees ?? []).map((employee) => employee.id))
  const scopedPlacements = basePlacements.filter((placement) => activeIds.has(placement.employee_id))
  const scopeEmployeeIds = [...new Set(scopedPlacements.map((placement) => placement.employee_id))]

  const [assessmentRows, gridSignals] = await Promise.all([
    readAssessments(supabase, auth.administrationId),
    query.perspective === 'top-talent'
      ? readGridSignals(supabase, auth.tenantId, auth.administrationId, scopeEmployeeIds)
      : Promise.resolve(new Map<string, StarPerformersGridSignal>()),
  ])

  const relevantAssessmentIds = new Set(
    scopedPlacements.flatMap((placement) => assessmentRows
      .filter((assessment) => assessment.employee_id === placement.employee_id && assessmentMatchesPlacement(assessment, placement, refs.jobGroupByJobId))
      .map((assessment) => assessment.employee_id)),
  )
  const highHighIds = new Set([...gridSignals.entries()].filter(([, signal]) => signal.isHighHigh).map(([employeeId]) => employeeId))

  let filteredEmployeeIds = scopeEmployeeIds
  if (query.status === 'assessed') filteredEmployeeIds = scopeEmployeeIds.filter((employeeId) => query.perspective === 'top-talent' ? gridSignals.has(employeeId) : relevantAssessmentIds.has(employeeId))
  if (query.status === 'not-assessed') filteredEmployeeIds = scopeEmployeeIds.filter((employeeId) => query.perspective === 'top-talent' ? !gridSignals.has(employeeId) : !relevantAssessmentIds.has(employeeId))
  if (query.status === 'high-high') filteredEmployeeIds = scopeEmployeeIds.filter((employeeId) => highHighIds.has(employeeId))
  if (query.perspective === 'key-employees' && query.status === 'all') filteredEmployeeIds = scopeEmployeeIds

  const totalCount = filteredEmployeeIds.length
  const pageSize = query.pageSize || PAGE_SIZE
  const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 0
  const page = totalPages ? Math.min(query.page, totalPages) : 1
  const requestedPageEmployeeIds = filteredEmployeeIds.slice((page - 1) * pageSize, page * pageSize)
  const pagePlacements = requestedPageEmployeeIds.length
    ? await readPlacements(supabase, auth.administrationId, baseQuery, today, jobIdsForGroup, requestedPageEmployeeIds)
    : []
  const pagePlacementByEmployee = new Map<string, PlacementRow>()
  for (const placement of pagePlacements) {
    if (!pagePlacementByEmployee.has(placement.employee_id)) pagePlacementByEmployee.set(placement.employee_id, placement)
  }
  const pageEmployeeIds = requestedPageEmployeeIds.filter((employeeId) => pagePlacementByEmployee.has(employeeId))
  const employees = await readPageEmployees(supabase, auth.tenantId, pageEmployeeIds)
  const assessmentIds = assessmentRows
    .filter((assessment) => pageEmployeeIds.includes(assessment.employee_id))
    .map((assessment) => assessment.id)
  const { data: tagLinks, error: tagLinksError } = access.isAdmin && assessmentIds.length
    ? await supabase.from('star_performer_assessment_tags').select('assessment_id, tag_id').in('assessment_id', assessmentIds).limit(5000)
    : { data: [], error: null }
  if (tagLinksError) databaseError(tagLinksError.message)
  const tagIdsByAssessmentId = new Map<string, string[]>()
  for (const link of tagLinks ?? []) tagIdsByAssessmentId.set(link.assessment_id, [...(tagIdsByAssessmentId.get(link.assessment_id) ?? []), link.tag_id])
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]))
  const rows = pageEmployeeIds.flatMap((employeeId) => {
    const employee = employeeById.get(employeeId)
    const placement = pagePlacementByEmployee.get(employeeId)
    if (!employee || !placement) return []
    return [toWorkspaceRow(employee, placement, refs, assessmentRows, tagIdsByAssessmentId, gridSignals.get(employeeId) ?? null)]
  })

  return {
    perspective: query.perspective,
    rows,
    page,
    pageSize,
    totalCount,
    totalPages,
    kpis: {
      employeesInScope: totalCount,
      approvedGrid: scopeEmployeeIds.filter((employeeId) => gridSignals.has(employeeId)).length,
      highHighSignals: scopeEmployeeIds.filter((employeeId) => highHighIds.has(employeeId)).length,
      assessedKeyEmployees: scopeEmployeeIds.filter((employeeId) => relevantAssessmentIds.has(employeeId)).length,
    },
    filters: {
      departments: [...refs.departmentById.entries()].map(([id, name]) => ({ id, name })),
      jobs: [...refs.jobById.entries()].map(([id, job]) => ({ id, name: refs.jobNameById.get(id) ?? job.code, jobGroupId: job.job_group_id })),
      jobGroups: [...refs.jobGroupById.entries()].map(([id, name]) => ({ id, name })),
      tags: refs.tags,
    },
  }
}

function emptyWorkspacePage(
  query: StarPerformerWorkspaceQuery,
  refs: Awaited<ReturnType<typeof readReferenceData>>,
): StarPerformersWorkspacePage {
  return {
    perspective: query.perspective,
    rows: [],
    page: 1,
    pageSize: query.pageSize || PAGE_SIZE,
    totalCount: 0,
    totalPages: 0,
    kpis: { employeesInScope: 0, approvedGrid: 0, highHighSignals: 0, assessedKeyEmployees: 0 },
    filters: {
      departments: [...refs.departmentById.entries()].map(([id, name]) => ({ id, name })),
      jobs: [...refs.jobById.entries()].map(([id, job]) => ({ id, name: refs.jobNameById.get(id) ?? job.code, jobGroupId: job.job_group_id })),
      jobGroups: [...refs.jobGroupById.entries()].map(([id, name]) => ({ id, name })),
      tags: refs.tags,
    },
  }
}

async function optionalRead<T>(reader: () => Promise<T>): Promise<{ state: ModuleState; data: T | null }> {
  try {
    return { state: 'ready', data: await reader() }
  } catch (error) {
    if (isUnavailableError(error)) return { state: 'unavailable', data: null }
    return { state: 'unavailable', data: null }
  }
}

async function readDetailEmployee(
  supabase: SupabaseServerClient,
  tenantId: string,
  administrationId: string,
  employeeId: string,
) {
  const today = currentDate()
  const [employeeResult, placementResult] = await Promise.all([
    supabase.from('employees').select('id, employee_number, first_name, birth_name, work_email, avatar_url').eq('tenant_id', tenantId).eq('id', employeeId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).maybeSingle(),
    supabase.from('employee_organizations').select('employee_id, department_id, job_id, job_title, effective_from').eq('administration_id', administrationId).eq('employee_id', employeeId).lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).order('effective_from', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (employeeResult.error || placementResult.error) databaseError(employeeResult.error?.message ?? placementResult.error?.message ?? 'STAR_PERFORMER_EMPLOYEE_READ_FAILED')
  if (!employeeResult.data || !placementResult.data) throw new StarPerformerError('STAR_PERFORMER_EMPLOYEE_NOT_FOUND', 404)
  return { employee: employeeResult.data, placement: placementResult.data }
}

async function readDetailReferences(
  supabase: SupabaseServerClient,
  tenantId: string,
  placement: PlacementRow,
  today: string,
) {
  const [departmentResult, jobResult, revisionResult] = await Promise.all([
    supabase.from('departments').select('id, name').eq('tenant_id', tenantId).eq('id', placement.department_id).maybeSingle(),
    placement.job_id ? supabase.from('jobs').select('id, code, job_group_id').eq('tenant_id', tenantId).eq('id', placement.job_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    placement.job_id ? supabase.from('job_revisions').select('job_id, name, valid_from').eq('tenant_id', tenantId).eq('job_id', placement.job_id).lte('valid_from', today).or(`valid_until.is.null,valid_until.gt.${today}`).order('valid_from', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  if (departmentResult.error || jobResult.error || revisionResult.error) databaseError(departmentResult.error?.message ?? jobResult.error?.message ?? revisionResult.error?.message ?? 'STAR_PERFORMER_CONTEXT_FAILED')
  const job = jobResult.data
  const groupResultData = job?.job_group_id
    ? await supabase.from('job_groups').select('id, name').eq('tenant_id', tenantId).eq('id', job.job_group_id).maybeSingle()
    : { data: null, error: null }
  if (groupResultData.error) databaseError(groupResultData.error.message)
  return {
    departmentName: departmentResult.data?.name ?? null,
    job,
    jobName: revisionResult.data?.name ?? placement.job_title ?? job?.code ?? null,
    jobGroupName: groupResultData.data?.name ?? null,
  }
}

async function readDetailAssessment(
  supabase: SupabaseServerClient,
  administrationId: string,
  employeeId: string,
  includeTags: boolean,
): Promise<{ assessments: AssessmentRow[]; tagIdsByAssessmentId: Map<string, string[]> }> {
  const assessments = (await readAssessments(supabase, administrationId)).filter((assessment) => assessment.employee_id === employeeId)
  const { data, error } = includeTags && assessments.length
    ? await supabase.from('star_performer_assessment_tags').select('assessment_id, tag_id').in('assessment_id', assessments.map((assessment) => assessment.id)).limit(500)
    : { data: [], error: null }
  if (error) databaseError(error.message)
  const tagIdsByAssessmentId = new Map<string, string[]>()
  for (const link of data ?? []) tagIdsByAssessmentId.set(link.assessment_id, [...(tagIdsByAssessmentId.get(link.assessment_id) ?? []), link.tag_id])
  return { assessments, tagIdsByAssessmentId }
}

async function readDetailTags(supabase: SupabaseServerClient, tenantId: string): Promise<StarPerformerTag[]> {
  const { data, error } = await supabase.from('star_performer_tags').select('id, name, is_active').eq('tenant_id', tenantId).order('name').limit(500)
  if (error) databaseError(error.message)
  return (data ?? []).map((tag) => ({ id: tag.id, name: tag.name, isActive: tag.is_active, usageCount: 0 }))
}

function detailLink(path: string, employeeId: string): string {
  return `${path}?employeeId=${encodeURIComponent(employeeId)}`
}

export async function getStarPerformersDetail(employeeId: string): Promise<StarPerformersDetail> {
  const access = await resolveStarPerformersReadAccess()
  const { auth, supabase } = access
  if (access.employeeIds !== null && !access.employeeIds.includes(employeeId)) {
    throw new AuthorizationError('Je hebt geen toegang tot deze medewerker.')
  }
  if (!auth.administrationId) throw new StarPerformerError('ADMINISTRATION_REQUIRED', 400)
  const base = await readDetailEmployee(supabase, auth.tenantId, auth.administrationId, employeeId)
  const refs = await readDetailReferences(supabase, auth.tenantId, base.placement, currentDate())
  const detailAssessment = await readDetailAssessment(supabase, auth.administrationId, employeeId, access.isAdmin)
  const tags = access.isAdmin ? await readDetailTags(supabase, auth.tenantId) : []
  const job = refs.job
  const placementForRow: PlacementRow = base.placement
  const jobGroupByJobId = new Map<string, string>(job ? [[job.id, job.job_group_id]] : [])
  const employeeRow = toWorkspaceRow(base.employee, placementForRow, {
    departmentById: new Map([[base.placement.department_id, refs.departmentName ?? '']]),
    jobById: new Map(job ? [[job.id, job]] : []),
    jobGroupById: new Map(job?.job_group_id && refs.jobGroupName ? [[job.job_group_id, refs.jobGroupName]] : []),
    jobGroupByJobId,
    jobNameById: new Map(job ? [[job.id, refs.jobName ?? job.code]] : []),
    tags,
  }, detailAssessment.assessments, detailAssessment.tagIdsByAssessmentId, null)

  const grid = await optionalRead(() => readGridSignals(supabase, auth.tenantId, auth.administrationId as string, [employeeId]))
  const skills = await optionalRead(() => listTalentEmployeeCapabilityRecords({ employeeId }))
  const jobProfile = await optionalRead(async () => {
    const mode = access.isAdmin ? 'admin' : 'manager'
    const initial = await listTalentRoleExplorerWorkspace(mode, { employeeId })
    const selectedEmployee = initial.employees.find((employee) => employee.employeeId === employeeId)
    const profile = selectedEmployee?.currentProfileVersionId
      ? initial.profiles.find((candidate) => candidate.profileVersionId === selectedEmployee.currentProfileVersionId) ?? null
      : null
    if (!profile) return { profile: null, gaps: [] as StarPerformersDetail['jobProfile']['gaps'] }
    const comparison: TalentRoleExplorerComparison | null = initial.comparison ?? (await listTalentRoleExplorerWorkspace(mode, { employeeId, profileVersionId: profile.profileVersionId })).comparison
    return {
      profile: { id: profile.profileVersionId, jobCode: profile.jobCode, jobGroupName: profile.jobGroupName, version: profile.profileVersion },
      gaps: (comparison?.axes ?? []).filter((axis) => axis.status !== 'MATCH').slice(0, 12).map((axis) => ({ name: axis.capabilityName, status: axis.status, currentLevel: axis.currentLevelCode, targetLevel: axis.targetLevelCode, rationale: axis.rationale })),
    }
  })
  const development = await optionalRead(async () => {
    const workspace = await listTalentGoals(access.isAdmin ? 'admin' : 'manager', { employeeId }, { includeOptions: false, includeEmployeeOptions: false, includeCapabilityOptions: false })
    return workspace.goals.filter((goal) => goal.status !== 'ARCHIVED').slice(0, 12).map((goal) => ({ id: goal.id, title: goal.title, status: goal.status, progressPercent: goal.progress_percent, periodStart: goal.period_start, periodEnd: goal.period_end }))
  })
  const appraisal = await optionalRead(async () => {
    const workspace = await listContinuousAppraisalWorkspace(employeeId)
    return workspace.items.slice(0, 8).map((item) => ({ id: item.id, title: item.title, status: item.item_status, occurredOn: item.occurred_on, dueOn: item.due_on, nextMeetingOn: item.next_meeting_on, itemType: item.item_type }))
  })

  return {
    employee: employeeRow,
    tags,
    grid: { state: grid.state, signal: grid.data?.get(employeeId) ?? null },
    skills: {
      state: skills.state,
      records: (skills.data ?? []).slice(0, 20).map((record) => ({ id: record.id, name: record.capabilityName, type: record.capabilityType, level: record.talentLevelName ?? record.languageLevel, evidenceStatus: record.evidenceStatus, status: record.status, source: record.sourceType, validUntil: record.validUntil })),
    },
    jobProfile: { state: jobProfile.state, profile: jobProfile.data?.profile ?? null, gaps: jobProfile.data?.gaps ?? [] },
    development: { state: development.state, plans: development.data ?? [] },
    appraisal: { state: appraisal.state, items: appraisal.data ?? [] },
    links: {
      grid: detailLink('/workforce/9-grid', employeeId),
      skills: detailLink('/workforce/talent', employeeId),
      roleExplorer: detailLink('/workforce/talent/role-explorer', employeeId),
      comparison: detailLink('/workforce/talent/comparison', employeeId),
      development: detailLink('/workforce/talent/goals', employeeId),
      appraisal: detailLink('/workforce/continuous-appraisal', employeeId),
      employee: `/employees/${employeeId}`,
    },
  }
}

type InsightScopeRow = {
  employee: InsightEmployee
  departmentId: string
  jobId: string | null
  jobGroupId: string | null
}

type InsightMovement = 'UP' | 'DOWN' | 'STABLE' | 'NEW' | null

function insightEmployeeFromRow(row: StarPerformersWorkspaceRow, gridSignal: StarPerformersGridSignal | null, criticalityLevel: number | null): InsightEmployee {
  return {
    employeeId: row.employeeId,
    employeeNumber: row.employeeNumber,
    label: [row.firstName, row.birthName].filter(Boolean).join(' '),
    departmentName: row.departmentName,
    jobName: row.jobName,
    jobGroupName: row.jobGroupName,
    sourceCampaignName: gridSignal?.campaignName ?? null,
    sourceClosedAt: gridSignal?.closedAt ?? null,
    gridCell: gridSignal?.gridCell ?? null,
    criticalityLevel,
    href: `/employees/${encodeURIComponent(row.employeeId)}`,
  }
}

function workspaceFilterHref(query: StarPerformerWorkspaceQuery, key: 'departmentId' | 'jobGroupId' | 'jobId', value: string): string {
  const params = new URLSearchParams()
  params.set('perspective', 'key-employees')
  params.set('area', 'insights')
  params.set('insight', 'key-employees')
  params.set('status', 'assessed')
  if (query.q) params.set('q', query.q)
  if (query.departmentId) params.set('departmentId', query.departmentId)
  if (query.jobGroupId) params.set('jobGroupId', query.jobGroupId)
  if (query.jobId) params.set('jobId', query.jobId)
  params.set(key, value)
  return `/workforce/star-performers?${params.toString()}`
}

function buildInsightBreakdowns(
  rows: readonly InsightScopeRow[],
  field: 'department' | 'job-group' | 'job',
  query: StarPerformerWorkspaceQuery,
): InsightBreakdown[] {
  const groups = new Map<string, { label: string; employeeIds: Set<string>; assessedCount: number; highCriticalCount: number }>()
  for (const row of rows) {
    const id = field === 'department' ? row.departmentId : field === 'job-group' ? row.jobGroupId : row.jobId
    const label = field === 'department' ? row.employee.departmentName : field === 'job-group' ? row.employee.jobGroupName : row.employee.jobName
    if (!id || !label) continue
    const current = groups.get(id) ?? { label, employeeIds: new Set<string>(), assessedCount: 0, highCriticalCount: 0 }
    current.employeeIds.add(row.employee.employeeId)
    if (row.employee.criticalityLevel !== null && row.employee.criticalityLevel !== undefined) {
      current.assessedCount += 1
      if (row.employee.criticalityLevel >= 4) current.highCriticalCount += 1
    }
    groups.set(id, current)
  }
  const key = field === 'department' ? 'departmentId' : field === 'job-group' ? 'jobGroupId' : 'jobId'
  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      label: group.label,
      assessedCount: group.assessedCount,
      highCriticalCount: group.highCriticalCount,
      employeeCount: group.employeeIds.size,
      href: workspaceFilterHref(query, key, id),
    }))
    .sort((left, right) => right.highCriticalCount - left.highCriticalCount || right.assessedCount - left.assessedCount || left.label.localeCompare(right.label, 'nl'))
}

function scoreForCampaign(scores: readonly GridScoreRow[], campaignId: string): Map<string, GridScoreRow> {
  const result = new Map<string, GridScoreRow>()
  for (const score of scores) {
    if (score.campaign_id !== campaignId || score.status !== 'CLOSED') continue
    const current = result.get(score.employee_id)
    if (!current || score.updated_at > current.updated_at) result.set(score.employee_id, score)
  }
  return result
}

function signalForScore(score: GridScoreRow, campaign: GridCampaignRow, movement: InsightMovement): StarPerformersGridSignal {
  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    closedAt: campaign.closed_at,
    performanceScore: score.performance_score,
    potentialScore: score.potential_score,
    gridCell: score.grid_cell,
    isHighHigh: score.grid_cell === 'HIGH_HIGH',
    movement,
  }
}

function selectedGridSignals(
  campaigns: readonly GridCampaignRow[],
  scores: readonly GridScoreRow[],
  query: StarPerformerWorkspaceQuery,
  employeeIds: readonly string[],
): { signals: Map<string, StarPerformersGridSignal>; movements: Map<string, InsightMovement>; previousCampaignName: string | null; selectedPeriodId: string | null } {
  const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]))
  const selectedCampaign = query.period ? campaignById.get(query.period) ?? null : null
  if (selectedCampaign) {
    const currentScores = scoreForCampaign(scores, selectedCampaign.id)
    const previousCampaign = selectedCampaign.previous_campaign_id ? campaignById.get(selectedCampaign.previous_campaign_id) ?? null : null
    const previousScores = previousCampaign ? scoreForCampaign(scores, previousCampaign.id) : new Map<string, GridScoreRow>()
    const signals = new Map<string, StarPerformersGridSignal>()
    const movements = new Map<string, InsightMovement>()
    for (const employeeId of employeeIds) {
      const current = currentScores.get(employeeId)
      if (!current) continue
      const previous = previousScores.get(employeeId)
      const direction = movementDirection(gridCell(previous?.grid_cell ?? null), gridCell(current.grid_cell))
      const movement = direction === 'UNKNOWN' ? null : direction
      signals.set(employeeId, signalForScore(current, selectedCampaign, movement))
      movements.set(employeeId, movement)
    }
    return { signals, movements, previousCampaignName: previousCampaign?.name ?? null, selectedPeriodId: selectedCampaign.id }
  }

  const signals = selectLatestApprovedGridSignals([...campaigns], [...scores])
  const movements = new Map<string, InsightMovement>()
  let previousCampaignName: string | null = null
  for (const employeeId of employeeIds) {
    const signal = signals.get(employeeId)
    if (!signal) continue
    movements.set(employeeId, signal.movement)
    const campaign = campaignById.get(signal.campaignId)
    const previous = campaign?.previous_campaign_id ? campaignById.get(campaign.previous_campaign_id) : null
    if (previous && previousCampaignName === null) previousCampaignName = previous.name
  }
  return { signals, movements, previousCampaignName, selectedPeriodId: null }
}

type SkillGapRecord = Awaited<ReturnType<typeof listTalentEmployeeCapabilityRecords>>[number]

function skillGapRecordPriority(record: SkillGapRecord, today: string): number {
  if (record.status === 'RELEASED' && record.validFrom <= today && (record.validUntil === null || record.validUntil > today)) return 4
  if (record.status === 'EXPIRED') return 3
  if (record.status === 'RELEASED' && record.validFrom <= today) return 2
  if (record.status === 'DRAFT' && record.validFrom <= today) return 1
  return 0
}

function skillGapStatus(
  requirement: { capability: { capability_type: string } | null; target_level_id: string | null; language_level: string | null },
  record: SkillGapRecord | undefined,
  levelRankById: ReadonlyMap<string, number>,
  today: string,
): import('./insights-service').SkillGapStatus {
  if (record?.status === 'EXPIRED' || (record?.validUntil !== null && record?.validUntil !== undefined && record.validUntil <= today)) return 'EXPIRED_EVIDENCE'
  const isCurrentRecord = Boolean(record && record.status === 'RELEASED' && record.validFrom <= today && (record.validUntil === null || record.validUntil > today))
  if (!record || !isCurrentRecord) return 'NOT_ASSESSED'
  const targetLevelRank = requirement.target_level_id ? levelRankById.get(requirement.target_level_id) ?? null : null
  const currentLevelRank = record.talentLevelId ? levelRankById.get(record.talentLevelId) ?? null : null
  const outcome = evaluateTalentRoleExplorerOutcome({
    capabilityAvailable: Boolean(requirement.capability),
    recordStatus: record.status,
    isCurrentRecord,
    isCertificate: requirement.capability?.capability_type === 'CERTIFICATE',
    evidenceStatus: record.evidenceStatus,
    targetLevelRank,
    currentLevelRank,
    targetLanguageLevel: requirement.language_level,
    currentLanguageLevel: record.languageLevel,
  })
  if (outcome === 'MATCH') return 'MATCH'
  if (outcome === 'MISSING_EVIDENCE') return 'MISSING_EVIDENCE'
  if (targetLevelRank !== null && currentLevelRank === null) return 'MISSING_LEVEL'
  if (requirement.language_level && !record.languageLevel) return 'MISSING_LEVEL'
  return outcome === 'GAP' ? 'INSUFFICIENT_LEVEL' : 'MISSING_LEVEL'
}

function legacySkillStatus(status: import('./insights-service').SkillGapStatus): SkillComparisonInput['axes'][number]['status'] {
  if (status === 'MATCH') return 'MATCH'
  if (status === 'MISSING_EVIDENCE' || status === 'EXPIRED_EVIDENCE') return 'MISSING_EVIDENCE'
  if (status === 'NOT_ASSESSED') return 'UNKNOWN'
  return 'GAP'
}

async function readTalentLevelRanks(access: StarPerformersReadAccess) {
  await requirePermissionInContext(access.supabase, access.auth, access.isAdmin ? 'talent:manage' : 'talent:manager-read')
  const { data, error } = await access.supabase
    .from('talent_levels')
    .select('id,sort_order')
    .eq('tenant_id', access.auth.tenantId)
    .order('sort_order')
    .order('code')
    .limit(100)
  if (error) throw new StarPerformerError('STAR_PERFORMER_SKILL_LEVEL_READ_FAILED', 503)
  return data ?? []
}

async function readInsightSkills(
  employeeIds: readonly string[],
  refs: Awaited<ReturnType<typeof readReferenceData>>,
  scopeRows: readonly InsightScopeRow[],
  access: StarPerformersReadAccess,
): Promise<{ state: 'ready' | 'unavailable' | 'no-data'; evaluatedEmployees: number; roles: StarPerformersInsights['skills']['roles']; topGaps: StarPerformersInsights['skills']['topGaps']; skillGapReport: FunctionSkillGapReport }> {
  const asOf = currentDate()
  if (!employeeIds.length) return { state: 'no-data', evaluatedEmployees: 0, roles: [], topGaps: [], skillGapReport: buildFunctionSkillGapReport([], asOf) }
  try {
    const [profiles, records, levels] = await Promise.all([
      listTalentProfilesForWorkforce({ includeRequirements: true }),
      listTalentEmployeeCapabilityRecords({}),
      readTalentLevelRanks(access),
    ])
    const population = new Set(employeeIds)
    const levelRankById = new Map(levels.map((level) => [level.id, level.sort_order]))
    const recordByEmployeeCapability = new Map<string, SkillGapRecord>()
    for (const record of records) {
      if (!population.has(record.employeeId)) continue
      const key = `${record.employeeId}:${record.capabilityId}`
      const current = recordByEmployeeCapability.get(key)
      const priority = skillGapRecordPriority(record, asOf)
      const currentPriority = current ? skillGapRecordPriority(current, asOf) : -1
      if (!current || priority > currentPriority || (priority === currentPriority && (record.validFrom > current.validFrom || (record.validFrom === current.validFrom && record.updatedAt > current.updatedAt)))) recordByEmployeeCapability.set(key, record)
    }

    const profileByJobId = new Map<string, (typeof profiles)[number]>()
    for (const profile of profiles) {
      const jobId = profile.profile.job_id
      if (!jobId || (profile.profile.valid_from !== null && profile.profile.valid_from > asOf) || (profile.profile.valid_until !== null && profile.profile.valid_until <= asOf)) continue
      const current = profileByJobId.get(jobId)
      if (!current || (profile.profile.valid_from ?? '') > (current.profile.valid_from ?? '') || (profile.profile.valid_from === current.profile.valid_from && (profile.profile.version_number ?? 0) > (current.profile.version_number ?? 0))) profileByJobId.set(jobId, profile)
    }

    const comparisons: SkillComparisonInput[] = []
    const detailedComparisons: SkillGapComparisonInput[] = []
    const scopedRowsByEmployee = new Map(scopeRows.map((row) => [row.employee.employeeId, row]))
    for (const employeeId of employeeIds) {
      const scopeRow = scopedRowsByEmployee.get(employeeId)
      if (!scopeRow?.jobId) continue
      const profile = profileByJobId.get(scopeRow.jobId)
      if (!profile?.profile.profile_version_id) continue
      const roleId = profile.profile.job_id ?? profile.profile.job_profile_id
      if (!roleId) continue
      const roleLabel = refs.jobNameById.get(scopeRow.jobId) ?? profile.profile.job_code ?? roleId
      const detailedAxes = profile.requirements.map((requirement) => {
        const record = recordByEmployeeCapability.get(`${employeeId}:${requirement.capability_id}`)
        const status = skillGapStatus(requirement, record, levelRankById, asOf)
        return {
          requirementId: requirement.id,
          capabilityId: requirement.capability_id,
          capabilityName: requirement.capability?.name ?? requirement.capability_id,
          requiredLevelLabel: requirement.targetLevel?.name ?? requirement.targetLevel?.code ?? requirement.language_level,
          currentLevelLabel: record?.talentLevelName ?? record?.talentLevelCode ?? record?.languageLevel ?? null,
          status,
        }
      })
      comparisons.push({ employeeId, roleId, roleLabel, jobGroupName: profile.profile.job_group_name, axes: detailedAxes.map((axis) => ({ capabilityName: axis.capabilityName, status: legacySkillStatus(axis.status) })) })
      detailedComparisons.push({
        employeeId,
        employeeLabel: scopeRow.employee.label,
        employeeNumber: scopeRow.employee.employeeNumber,
        roleId,
        roleLabel,
        jobGroupName: profile.profile.job_group_name,
        departmentId: scopeRow.departmentId,
        departmentName: scopeRow.employee.departmentName,
        profileVersionId: profile.profile.profile_version_id,
        profileVersion: profile.profile.version_number ?? 0,
        profileValidFrom: profile.profile.valid_from,
        profileValidUntil: profile.profile.valid_until,
        axes: detailedAxes,
      })
    }
    const coverage = buildSkillCoverage(comparisons)
    return {
      state: coverage.evaluatedEmployees > 0 ? 'ready' : 'no-data',
      evaluatedEmployees: coverage.evaluatedEmployees,
      roles: coverage.roles,
      topGaps: coverage.topGaps,
      skillGapReport: buildFunctionSkillGapReport(detailedComparisons, asOf),
    }
  } catch {
    return { state: 'unavailable', evaluatedEmployees: 0, roles: [], topGaps: [], skillGapReport: { state: 'unavailable', asOf, relevantEmployees: 0, assessedEmployees: 0, rows: [] } }
  }
}

async function readInsightDevelopment(
  employeeIds: readonly string[],
  employeeLabels: ReadonlyMap<string, string>,
  scopeRows: readonly InsightScopeRow[],
  mode: 'admin' | 'manager',
  asOf: string,
): Promise<StarPerformersInsights['development']> {
  if (!employeeIds.length) return emptyDevelopmentInsight(asOf)

  let goalsAvailable = false
  let goals: Awaited<ReturnType<typeof listTalentGoals>>['goals'] = []
  try {
    const workspace = await listTalentGoals(mode, {}, { includeOptions: false, includeEmployeeOptions: false, includeCapabilityOptions: false })
    goalsAvailable = true
    const scopedEmployeeIds = new Set(employeeIds)
    goals = workspace.goals.filter((goal) => scopedEmployeeIds.has(goal.employee_id))
  } catch {
    goalsAvailable = false
  }

  let appraisalAvailable = false
  let appraisalItems: DevelopmentActionInput[] = []
  try {
    const items = await listContinuousAppraisalItemsForEmployees(employeeIds)
    appraisalAvailable = true
    appraisalItems = items
      .filter((item) => item.item_type === 'ACTION')
      .map((item) => ({ id: item.id, employeeId: item.employee_id, employeeLabel: employeeLabels.get(item.employee_id) ?? item.employee_id, title: item.title, status: item.item_status, dueOn: item.due_on, nextMeetingOn: item.next_meeting_on }))
  } catch {
    appraisalAvailable = false
  }

  const plans: DevelopmentPlanInput[] = goals.map((goal) => ({
    id: goal.id,
    employeeId: goal.employee_id,
    employeeLabel: employeeLabels.get(goal.employee_id) ?? goal.employee_id,
    title: goal.title,
    status: goal.status,
    progressPercent: goal.progress_percent,
    periodStart: goal.period_start,
    periodEnd: goal.period_end,
    completedAt: goal.completed_at,
  }))
  return buildDevelopmentInsight({
    asOf,
    population: scopeRows.map((row) => ({ employeeId: row.employee.employeeId, departmentId: row.departmentId, departmentName: row.employee.departmentName })),
    plans,
    actions: appraisalItems,
    sources: { plans: goalsAvailable, actions: appraisalAvailable },
  })
}

function emptyInsights(query: StarPerformerWorkspaceQuery): StarPerformersInsights {
  return {
    population: { employeesInScope: 0, assessedGrid: 0, assessedKeyEmployees: 0 },
    periods: [],
    selectedPeriodId: query.period ?? null,
    topTalent: { coveragePercent: null, assessedCount: 0, distribution: buildGridDistribution([], []), highHigh: [], movement: { state: 'unavailable', previousCampaignName: null, comparableEmployees: 0, up: 0, down: 0, stable: 0 } },
    keyEmployees: { criticalityDistribution: buildCriticalityDistribution([]), highCriticalCount: 0, highCriticalPercent: null, assessedCount: 0, threshold: 4, byDepartment: [], byJobGroup: [], byJob: [], overlap: { highHighCount: 0, highCriticalCount: 0, overlapCount: 0, overlapPercent: null }, employees: [] },
    skills: { state: 'no-data', evaluatedEmployees: 0, roles: [], topGaps: [] },
    skillGaps: { state: 'no-data', asOf: currentDate(), relevantEmployees: 0, assessedEmployees: 0, rows: [] },
    development: emptyDevelopmentInsight(currentDate()),
  }
}

type StarPerformersInsightsOptions = {
  readonly includeSkills?: boolean
  readonly includeDevelopment?: boolean
}

async function readStarPerformersInsights(
  query: StarPerformerWorkspaceQuery,
  access: StarPerformersReadAccess,
  options: StarPerformersInsightsOptions = {},
): Promise<StarPerformersInsights> {
  const auth = access.auth
  if (!auth.administrationId) throw new StarPerformerError('ADMINISTRATION_REQUIRED', 400)
  const supabase = access.supabase
  const today = currentDate()
  const refs = await readReferenceData(supabase, auth.tenantId, today, access.isAdmin)
  const searchIds = restrictStarPerformersEmployeeIds(await searchEmployeeIds(supabase, auth.tenantId, query.q), access.employeeIds)
  if (searchIds?.length === 0) return emptyInsights(query)

  const jobIdsForGroup = query.jobGroupId
    ? [...refs.jobById.values()].filter((job) => job.job_group_id === query.jobGroupId).map((job) => job.id)
    : null
  const placements = await readPlacements(supabase, auth.administrationId, { ...query, status: 'all' }, today, jobIdsForGroup, searchIds)
  const placementByEmployee = new Map<string, PlacementRow>()
  for (const placement of placements) if (!placementByEmployee.has(placement.employee_id)) placementByEmployee.set(placement.employee_id, placement)
  const baseEmployeeIds = [...placementByEmployee.keys()]
  if (!baseEmployeeIds.length) return emptyInsights(query)
  const { data: activeEmployees, error: activeEmployeesError } = await supabase
    .from('employees')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .in('id', baseEmployeeIds)
    .eq('is_active', true)
    .eq('is_archived', false)
    .is('deleted_at', null)
  if (activeEmployeesError) databaseError(activeEmployeesError.message)
  const activeIds = new Set((activeEmployees ?? []).map((employee) => employee.id))
  const scopeEmployeeIds = baseEmployeeIds.filter((employeeId) => activeIds.has(employeeId))
  if (!scopeEmployeeIds.length) return emptyInsights(query)

  const [assessmentRows, gridHistory, employees] = await Promise.all([
    readAssessments(supabase, auth.administrationId),
    readGridHistory(supabase, auth.tenantId, auth.administrationId, scopeEmployeeIds),
    readPageEmployees(supabase, auth.tenantId, scopeEmployeeIds),
  ])
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]))
  const gridSelection = selectedGridSignals(gridHistory.campaigns, gridHistory.scores, query, scopeEmployeeIds)
  const assessmentByEmployee = new Map<string, StarPerformerAssessment>()
  for (const employeeId of scopeEmployeeIds) {
    const placement = placementByEmployee.get(employeeId)
    if (!placement) continue
    const assessment = assessmentForPlacement(employeeId, placement, assessmentRows, refs.jobGroupByJobId, new Map())
    if (assessment) assessmentByEmployee.set(employeeId, assessment)
  }
  const highHighIds = new Set([...gridSelection.signals.entries()].filter(([, signal]) => signal.isHighHigh).map(([employeeId]) => employeeId))
  const filteredEmployeeIds = scopeEmployeeIds.filter((employeeId) => {
    if (query.perspective === 'top-talent' && query.status === 'assessed') return gridSelection.signals.has(employeeId)
    if (query.perspective === 'top-talent' && query.status === 'not-assessed') return !gridSelection.signals.has(employeeId)
    if (query.perspective === 'top-talent' && query.status === 'high-high') return highHighIds.has(employeeId)
    if (query.perspective === 'key-employees' && query.status === 'assessed') return assessmentByEmployee.has(employeeId)
    if (query.perspective === 'key-employees' && query.status === 'not-assessed') return !assessmentByEmployee.has(employeeId)
    return true
  })

  const scopeRows: InsightScopeRow[] = filteredEmployeeIds.flatMap((employeeId) => {
    const employee = employeeById.get(employeeId)
    const placement = placementByEmployee.get(employeeId)
    if (!employee || !placement) return []
    const workspaceRow = toWorkspaceRow(employee, placement, refs, assessmentRows, new Map(), gridSelection.signals.get(employeeId) ?? null)
    const assessment = assessmentByEmployee.get(employeeId)
    return [{
      employee: insightEmployeeFromRow(workspaceRow, gridSelection.signals.get(employeeId) ?? null, assessment?.criticalityLevel ?? null),
      departmentId: placement.department_id,
      jobId: placement.job_id,
      jobGroupId: workspaceRow.jobGroupId,
    }]
  })
  const filteredIds = scopeRows.map((row) => row.employee.employeeId)
  const selectedGridInputs = filteredIds.map((employeeId) => ({ employeeId, gridCell: gridCell(gridSelection.signals.get(employeeId)?.gridCell ?? null) }))
  const gridDistribution = buildGridDistribution(selectedGridInputs, filteredIds)
  const assessedGridCount = filteredIds.filter((employeeId) => gridSelection.signals.has(employeeId)).length
  const highHighEmployees = scopeRows.filter((row) => highHighIds.has(row.employee.employeeId)).map((row) => row.employee)
  const movement = buildMovementSummary(filteredIds.map((employeeId) => gridSelection.movements.get(employeeId) ?? null))
  const assessmentInputs = scopeRows.flatMap((row) => row.employee.criticalityLevel === null || row.employee.criticalityLevel === undefined ? [] : [{ employeeId: row.employee.employeeId, criticalityLevel: row.employee.criticalityLevel }])
  const criticalityDistribution = buildCriticalityDistribution(assessmentInputs)
  const highCriticalIds = new Set(assessmentInputs.filter((input) => input.criticalityLevel >= 4).map((input) => input.employeeId))
  const assessedKeyCount = assessmentInputs.length
  const highCriticalCount = highCriticalIds.size
  const overlapCount = [...highHighIds].filter((employeeId) => highCriticalIds.has(employeeId) && filteredIds.includes(employeeId)).length
  const keyEmployees = scopeRows.filter((row) => row.employee.criticalityLevel !== null && row.employee.criticalityLevel !== undefined).sort((left, right) => (right.employee.criticalityLevel ?? 0) - (left.employee.criticalityLevel ?? 0) || left.employee.label.localeCompare(right.employee.label, 'nl')).map((row) => row.employee)
  const employeeLabels = new Map(scopeRows.map((row) => [row.employee.employeeId, row.employee.label]))
  const includeSkills = options.includeSkills ?? (query.insight === 'skills' || query.insight === 'skill-gaps')
  const skillsRead = includeSkills
    ? await readInsightSkills(filteredIds, refs, scopeRows, access)
    : null
  const skills = skillsRead
    ? { state: skillsRead.state, evaluatedEmployees: skillsRead.evaluatedEmployees, roles: skillsRead.roles, topGaps: skillsRead.topGaps }
    : { state: 'no-data' as const, evaluatedEmployees: 0, roles: [], topGaps: [] }
  const development = (options.includeDevelopment ?? query.insight === 'development')
    ? await readInsightDevelopment(filteredIds, employeeLabels, scopeRows, access.isManager ? 'manager' : 'admin', today)
    : emptyDevelopmentInsight(today)
  const periods = [...gridHistory.campaigns].sort((left, right) => (right.closed_at ?? right.starts_on).localeCompare(left.closed_at ?? left.starts_on)).map((campaign) => ({ id: campaign.id, name: campaign.name, closedAt: campaign.closed_at, startsOn: campaign.starts_on }))

  return {
    population: { employeesInScope: filteredIds.length, assessedGrid: assessedGridCount, assessedKeyEmployees: assessedKeyCount },
    periods,
    selectedPeriodId: gridSelection.selectedPeriodId,
    topTalent: {
      coveragePercent: percentageOf(assessedGridCount, filteredIds.length),
      assessedCount: assessedGridCount,
      distribution: gridDistribution,
      highHigh: highHighEmployees,
      movement: { ...movement, previousCampaignName: gridSelection.previousCampaignName },
    },
    keyEmployees: {
      criticalityDistribution,
      highCriticalCount,
      highCriticalPercent: percentageOf(highCriticalCount, filteredIds.length),
      assessedCount: assessedKeyCount,
      threshold: 4,
      byDepartment: buildInsightBreakdowns(scopeRows, 'department', query),
      byJobGroup: buildInsightBreakdowns(scopeRows, 'job-group', query),
      byJob: buildInsightBreakdowns(scopeRows, 'job', query),
      overlap: { highHighCount: [...highHighIds].filter((employeeId) => filteredIds.includes(employeeId)).length, highCriticalCount, overlapCount, overlapPercent: percentageOf(overlapCount, highHighEmployees.length) },
      employees: keyEmployees,
    },
    skills,
    skillGaps: skillsRead?.skillGapReport ?? { state: 'no-data', asOf: today, relevantEmployees: 0, assessedEmployees: 0, rows: [] },
    development,
  }
}

export async function getStarPerformersInsights(
  query: StarPerformerWorkspaceQuery,
  dependencies?: StarPerformersReadDependencies,
): Promise<StarPerformersInsights> {
  const access = await resolveStarPerformersReadAccess(dependencies)
  return readStarPerformersInsights(query, access)
}

export type StarPerformersDashboardSummary = {
  scope: 'company' | 'team'
  employeesInScope: number
  assessedGrid: number
  gridCoveragePercent: number | null
  highHighCount: number
  highCriticalCount: number
  highCriticalPercent: number | null
  skillState: StarPerformersInsights['skills']['state']
  skillGapCount: number
  topSkillGap: { label: string; occurrences: number } | null
  developmentState: StarPerformersInsights['development']['state']
  openActionCount: number
  links: {
    topTalent: string
    keyEmployees: string
    skills: string
    development: string
  }
}

export async function getStarPerformersDashboardSummary(
  dependencies?: StarPerformersReadDependencies,
): Promise<StarPerformersDashboardSummary> {
  const access = await resolveStarPerformersReadAccess(dependencies)
  const query: StarPerformerWorkspaceQuery = {
    perspective: 'top-talent',
    area: 'insights',
    insight: 'top-talent',
    q: '',
    departmentId: undefined,
    jobId: undefined,
    jobGroupId: undefined,
    period: undefined,
    status: 'all',
    page: 1,
    pageSize: PAGE_SIZE,
  }
  const insights = await readStarPerformersInsights(query, access, { includeSkills: true, includeDevelopment: true })
  const reportPath = '/workforce/talent/reports/star-performers'
  return {
    scope: access.employeeIds === null ? 'company' : 'team',
    employeesInScope: insights.population.employeesInScope,
    assessedGrid: insights.topTalent.assessedCount,
    gridCoveragePercent: insights.topTalent.coveragePercent,
    highHighCount: insights.topTalent.highHigh.length,
    highCriticalCount: insights.keyEmployees.highCriticalCount,
    highCriticalPercent: insights.keyEmployees.highCriticalPercent,
    skillState: insights.skills.state,
    skillGapCount: insights.skills.topGaps.reduce((total, gap) => total + gap.occurrences, 0),
    topSkillGap: insights.skills.topGaps[0] ? { label: insights.skills.topGaps[0].label, occurrences: insights.skills.topGaps[0].occurrences } : null,
    developmentState: insights.development.state,
    openActionCount: insights.development.openActionCount,
    links: {
      topTalent: `${reportPath}?report=top-talent`,
      keyEmployees: `${reportPath}?report=key-employees`,
      skills: `${reportPath}?report=skills`,
      development: `${reportPath}?report=development`,
    },
  }
}
