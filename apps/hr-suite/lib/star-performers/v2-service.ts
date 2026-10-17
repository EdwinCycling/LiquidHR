import 'server-only'

import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { listContinuousAppraisalWorkspace } from '@/lib/continuous-appraisal/service'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { listTalentEmployeeCapabilityRecords } from '@/lib/talent/employee-capability-service'
import { listTalentGoals } from '@/lib/talent/goal-service'
import { listTalentRoleExplorerWorkspace, type TalentRoleExplorerComparison } from '@/lib/talent/role-explorer-service'
import { movementDirection, type GridCell } from '@/lib/talent-review/rules'
import { createClient } from '@/lib/supabase/server'
import type { StarPerformerAssessment, StarPerformerTag } from './service'
import type { StarPerformerWorkspaceQuery } from './schemas'
import { StarPerformerError } from './service'

const MAX_SCOPE_EMPLOYEES = 5000
const MAX_ASSESSMENTS = 5000
const MAX_GRID_CAMPAIGNS = 100
const PAGE_SIZE = 20

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

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

async function readReferenceData(supabase: SupabaseServerClient, tenantId: string, today: string) {
  const [departmentsResult, jobsResult, jobGroupsResult, revisionsResult, tagsResult] = await Promise.all([
    supabase.from('departments').select('id, name').eq('tenant_id', tenantId).eq('is_active', true).order('name').limit(500),
    supabase.from('jobs').select('id, code, job_group_id').eq('tenant_id', tenantId).eq('is_active', true).order('code').limit(2000),
    supabase.from('job_groups').select('id, name').eq('tenant_id', tenantId).eq('is_active', true).order('name').limit(500),
    supabase.from('job_revisions').select('job_id, name, valid_from').eq('tenant_id', tenantId).lte('valid_from', today).or(`valid_until.is.null,valid_until.gt.${today}`).order('valid_from', { ascending: false }).limit(4000),
    supabase.from('star_performer_tags').select('id, name, is_active').eq('tenant_id', tenantId).order('name').limit(500),
  ])
  const failed = [departmentsResult, jobsResult, jobGroupsResult, revisionsResult, tagsResult].find((result) => result.error)
  if (failed?.error) databaseError(failed.error.message)

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
  if (!employeeIds.length) return new Map()
  const { data: campaigns, error: campaignsError } = await supabase
    .from('talent_review_campaigns')
    .select('id, name, status, closed_at, starts_on, previous_campaign_id')
    .eq('tenant_id', tenantId)
    .eq('administration_id', administrationId)
    .in('status', ['CLOSED', 'ARCHIVED'])
    .order('closed_at', { ascending: false })
    .limit(MAX_GRID_CAMPAIGNS)
  if (campaignsError) databaseError(campaignsError.message)

  const campaignRows = campaigns ?? []
  const campaignIds = campaignRows.map((campaign) => campaign.id)
  if (!campaignIds.length) return new Map()
  const { data: scores, error: scoresError } = await supabase
    .from('talent_review_scores')
    .select('employee_id, campaign_id, performance_score, potential_score, grid_cell, status, updated_at')
    .eq('tenant_id', tenantId)
    .in('campaign_id', campaignIds)
    .in('employee_id', employeeIds)
    .eq('status', 'CLOSED')
    .limit(MAX_ASSESSMENTS)
  if (scoresError) databaseError(scoresError.message)
  return selectLatestApprovedGridSignals(campaignRows, scores ?? [])
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
): Promise<StarPerformersWorkspacePage> {
  const auth = await requirePermission('star-performer:read')
  if (!auth.administrationId) throw new StarPerformerError('ADMINISTRATION_REQUIRED', 400)
  const supabase = await createClient()
  const today = currentDate()
  const refs = await readReferenceData(supabase, auth.tenantId, today)
  const searchIds = await searchEmployeeIds(supabase, auth.tenantId, query.q)
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
  const { data: tagLinks, error: tagLinksError } = assessmentIds.length
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
): Promise<{ assessments: AssessmentRow[]; tagIdsByAssessmentId: Map<string, string[]> }> {
  const assessments = (await readAssessments(supabase, administrationId)).filter((assessment) => assessment.employee_id === employeeId)
  const { data, error } = assessments.length
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
  const auth = await requirePermission('star-performer:read', employeeId)
  if (!auth.administrationId) throw new StarPerformerError('ADMINISTRATION_REQUIRED', 400)
  const supabase = await createClient()
  const base = await readDetailEmployee(supabase, auth.tenantId, auth.administrationId, employeeId)
  const refs = await readDetailReferences(supabase, auth.tenantId, base.placement, currentDate())
  const detailAssessment = await readDetailAssessment(supabase, auth.administrationId, employeeId)
  const tags = await readDetailTags(supabase, auth.tenantId)
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
    const initial = await listTalentRoleExplorerWorkspace('admin', { employeeId })
    const selectedEmployee = initial.employees.find((employee) => employee.employeeId === employeeId)
    const profile = selectedEmployee?.currentProfileVersionId
      ? initial.profiles.find((candidate) => candidate.profileVersionId === selectedEmployee.currentProfileVersionId) ?? null
      : null
    if (!profile) return { profile: null, gaps: [] as StarPerformersDetail['jobProfile']['gaps'] }
    const comparison: TalentRoleExplorerComparison | null = initial.comparison ?? (await listTalentRoleExplorerWorkspace('admin', { employeeId, profileVersionId: profile.profileVersionId })).comparison
    return {
      profile: { id: profile.profileVersionId, jobCode: profile.jobCode, jobGroupName: profile.jobGroupName, version: profile.profileVersion },
      gaps: (comparison?.axes ?? []).filter((axis) => axis.status !== 'MATCH').slice(0, 12).map((axis) => ({ name: axis.capabilityName, status: axis.status, currentLevel: axis.currentLevelCode, targetLevel: axis.targetLevelCode, rationale: axis.rationale })),
    }
  })
  const development = await optionalRead(async () => {
    const workspace = await listTalentGoals('admin', { employeeId }, { includeOptions: false, includeEmployeeOptions: false, includeCapabilityOptions: false })
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
