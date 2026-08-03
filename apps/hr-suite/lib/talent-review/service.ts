import type { Database, Json } from '@scope/db'
import { requireAuthContext, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { employeeAvatarHref } from '@/lib/employees/employee-service'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import type {
  TalentReviewCampaignCreateInput,
  TalentReviewCampaignUpdateInput,
  TalentReviewListQuery,
  TalentReviewReminderInput,
  TalentReviewScoreSaveInput,
} from './schemas'
import { canManagerAccessReviewSubject, deriveGridCell, type GridValue } from './rules'

type CampaignRow = Database['public']['Tables']['talent_review_campaigns']['Row']
type AssignmentRow = Database['public']['Tables']['talent_review_assignments']['Row']
type MemberRow = Database['public']['Tables']['talent_review_assignment_members']['Row']
type ScoreRow = Database['public']['Tables']['talent_review_scores']['Row']

export type TalentReviewErrorCode =
  | 'TALENT_REVIEW_CAMPAIGN_NOT_FOUND'
  | 'TALENT_REVIEW_ASSIGNMENT_NOT_FOUND'
  | 'TALENT_REVIEW_MEMBER_NOT_FOUND'
  | 'TALENT_REVIEW_SCORE_NOT_FOUND'
  | 'TALENT_REVIEW_CAMPAIGN_LOCKED'
  | 'TALENT_REVIEW_CAMPAIGN_ALREADY_STARTED'
  | 'TALENT_REVIEW_VERSION_CONFLICT'
  | 'TALENT_REVIEW_ASSIGNMENT_INCOMPLETE'
  | 'TALENT_REVIEW_SCORE_INCOMPLETE'
  | 'TALENT_REVIEW_REMINDER_TARGET_INVALID'
  | 'TALENT_REVIEW_SELF_SCOPE_INVALID'
  | 'TALENT_REVIEW_READ_FAILED'
  | 'TALENT_REVIEW_WRITE_FAILED'

export class TalentReviewError extends Error {
  constructor(public readonly code: TalentReviewErrorCode | string, public readonly status = 500) {
    super(code)
    this.name = 'TalentReviewError'
  }
}

export type TalentReviewCampaign = Pick<CampaignRow, 'id' | 'name' | 'description' | 'starts_on' | 'ends_on' | 'status' | 'previous_campaign_id' | 'version' | 'started_at' | 'closed_at' | 'reopened_at'>

export type TalentReviewEmployee = {
  id: string
  label: string
  employeeNumber: string
  jobTitle: string | null
  avatarUrl: string | null
  snapshot: Json
}

export type TalentReviewAssignment = Pick<AssignmentRow, 'id' | 'campaign_id' | 'manager_employee_id' | 'status' | 'employee_count' | 'scored_count' | 'submitted_at' | 'last_reminded_at' | 'version'> & {
  managerLabel: string
}

export type TalentReviewScore = Pick<ScoreRow, 'id' | 'campaign_id' | 'assignment_id' | 'employee_id' | 'manager_employee_id' | 'performance_score' | 'potential_score' | 'grid_cell' | 'note' | 'status' | 'version' | 'updated_at'>

export type TalentReviewWorkspace = {
  campaigns: TalentReviewCampaign[]
  selectedCampaignId: string | null
  assignments: TalentReviewAssignment[]
  members: TalentReviewEmployee[]
  scores: TalentReviewScore[]
  previousScores: TalentReviewScore[]
}

type SnapshotObject = { [key: string]: Json | undefined }

function snapshotValue(snapshot: Json, key: string): Json | undefined {
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) return undefined
  return (snapshot as SnapshotObject)[key]
}

function snapshotText(snapshot: Json, key: string): string | null {
  const value = snapshotValue(snapshot, key)
  return typeof value === 'string' && value.trim() ? value : null
}

function employeeLabel(snapshot: Json, fallbackId: string): string {
  const name = [snapshotText(snapshot, 'first_name'), snapshotText(snapshot, 'birth_name')].filter((value): value is string => Boolean(value)).join(' ').trim()
  return name || snapshotText(snapshot, 'employee_number') || fallbackId
}

function toCampaign(row: CampaignRow): TalentReviewCampaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    starts_on: row.starts_on,
    ends_on: row.ends_on,
    status: row.status,
    previous_campaign_id: row.previous_campaign_id,
    version: row.version,
    started_at: row.started_at,
    closed_at: row.closed_at,
    reopened_at: row.reopened_at,
  }
}

function toScore(row: ScoreRow): TalentReviewScore {
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    assignment_id: row.assignment_id,
    employee_id: row.employee_id,
    manager_employee_id: row.manager_employee_id,
    performance_score: row.performance_score,
    potential_score: row.potential_score,
    grid_cell: row.grid_cell,
    note: row.note,
    status: row.status,
    version: row.version,
    updated_at: row.updated_at,
  }
}

function databaseError(message: string, fallback: TalentReviewErrorCode): never {
  const normalized = message.toLocaleUpperCase('en-US')
  const explicitCode = normalized.match(/TALENT_REVIEW_[A-Z0-9_]+/)?.[0]
  if (explicitCode) {
    const status = explicitCode.includes('FORBIDDEN') ? 403 : explicitCode.includes('NOT_FOUND') ? 404 : explicitCode.includes('CONFLICT') || explicitCode.includes('LOCKED') || explicitCode.includes('ALREADY') ? 409 : 400
    throw new TalentReviewError(explicitCode, status)
  }
  if (normalized.includes('DUPLICATE') || normalized.includes('UNIQUE')) throw new TalentReviewError('TALENT_REVIEW_DUPLICATE', 409)
  throw new TalentReviewError(fallback)
}

async function reviewContext(mode: 'hr' | 'manager'): Promise<AuthContext> {
  return mode === 'hr' ? requirePermission('talent-review:manage') : requirePermission('talent-review:read')
}

export async function listTalentReviewWorkspace(mode: 'hr' | 'manager', query: TalentReviewListQuery = {}): Promise<TalentReviewWorkspace> {
  const context = await reviewContext(mode)
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { error: activationError } = await supabase.rpc('activate_due_talent_review_campaigns', { requested_tenant_id: context.tenantId })
  if (activationError) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')

  let campaignRows: CampaignRow[] = []
  if (mode === 'hr') {
    const campaignsQuery = supabase.from('talent_review_campaigns').select('*').eq('tenant_id', context.tenantId).order('starts_on', { ascending: false }).limit(100)
    const { data, error } = await campaignsQuery
    if (error) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
    campaignRows = data ?? []
  } else {
    if (!context.employeeId) return { campaigns: [], selectedCampaignId: null, assignments: [], members: [], scores: [], previousScores: [] }
    const { data: assignments, error: assignmentError } = await supabase.from('talent_review_assignments').select('campaign_id').eq('tenant_id', context.tenantId).eq('manager_employee_id', context.employeeId).limit(100)
    if (assignmentError) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
    const campaignIds = [...new Set((assignments ?? []).map((assignment) => assignment.campaign_id))]
    if (campaignIds.length > 0) {
      const campaignsQuery = supabase.from('talent_review_campaigns').select('*').eq('tenant_id', context.tenantId).in('id', campaignIds).order('starts_on', { ascending: false }).limit(100)
      const { data, error } = await campaignsQuery
      if (error) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
      campaignRows = data ?? []
    }
  }

  const selected = query.campaignId ? campaignRows.find((campaign) => campaign.id === query.campaignId) ?? null : campaignRows[0] ?? null
  if (query.campaignId && !selected) throw new TalentReviewError('TALENT_REVIEW_CAMPAIGN_NOT_FOUND', 404)
  if (!selected) return { campaigns: campaignRows.map(toCampaign), selectedCampaignId: null, assignments: [], members: [], scores: [], previousScores: [] }

  let assignmentsQuery = supabase.from('talent_review_assignments').select('*').eq('tenant_id', context.tenantId).eq('campaign_id', selected.id).order('created_at').limit(500)
  if (mode === 'manager') assignmentsQuery = assignmentsQuery.eq('manager_employee_id', context.employeeId ?? '')
  const { data: assignmentRows, error: assignmentError } = await assignmentsQuery
  if (assignmentError) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
  const resolvedAssignments = assignmentRows ?? []
  const assignmentIds = resolvedAssignments.map((assignment) => assignment.id)
  const membersQuery = assignmentIds.length > 0 ? supabase.from('talent_review_assignment_members').select('*').eq('tenant_id', context.tenantId).in('assignment_id', assignmentIds).order('created_at').limit(5000) : null
  const scopedMembersQuery = membersQuery && mode === 'manager' ? membersQuery.neq('employee_id', context.employeeId ?? '') : membersQuery
  const scoresQuery = supabase.from('talent_review_scores').select('*').eq('tenant_id', context.tenantId).eq('campaign_id', selected.id).order('updated_at', { ascending: false }).limit(5000)
  const scopedScoresQuery = mode === 'manager' ? scoresQuery.neq('employee_id', context.employeeId ?? '') : scoresQuery
  const [membersResult, scoresResult, managerResult] = await Promise.all([
    scopedMembersQuery ?? Promise.resolve({ data: [] as MemberRow[], error: null }),
    scopedScoresQuery,
    resolvedAssignments.length > 0 ? supabase.from('employees').select('id,first_name,birth_name,employee_number').eq('tenant_id', context.tenantId).in('id', resolvedAssignments.map((assignment) => assignment.manager_employee_id)).is('deleted_at', null) : Promise.resolve({ data: [] as Array<{ id: string; first_name: string; birth_name: string; employee_number: string }>, error: null }),
  ])
  if (membersResult.error || scoresResult.error || managerResult.error) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
  const memberRows = membersResult.data ?? []
  const scoreRows = scoresResult.data ?? []
  const managerLabels = new Map((managerResult.data ?? []).map((employee) => [employee.id, [employee.first_name, employee.birth_name].filter(Boolean).join(' ').trim() || employee.employee_number]))
  const memberIds = memberRows.map((member) => member.employee_id)

  let previousScoreRows: ScoreRow[] = []
  if (selected.previous_campaign_id && memberIds.length > 0) {
    let previousScoresQuery = supabase.from('talent_review_scores').select('*').eq('tenant_id', context.tenantId).eq('campaign_id', selected.previous_campaign_id).in('employee_id', memberIds).limit(5000)
    if (mode === 'manager') previousScoresQuery = previousScoresQuery.neq('employee_id', context.employeeId ?? '')
    const { data, error } = await previousScoresQuery
    if (error) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
    previousScoreRows = data ?? []
  }

  return {
    campaigns: campaignRows.map(toCampaign),
    selectedCampaignId: selected.id,
    assignments: resolvedAssignments.map((assignment) => ({
      id: assignment.id,
      campaign_id: assignment.campaign_id,
      manager_employee_id: assignment.manager_employee_id,
      status: assignment.status,
      employee_count: assignment.employee_count,
      scored_count: assignment.scored_count,
      submitted_at: assignment.submitted_at,
      last_reminded_at: assignment.last_reminded_at,
      version: assignment.version,
      managerLabel: managerLabels.get(assignment.manager_employee_id) ?? assignment.manager_employee_id,
    })),
    members: memberRows.map((member) => ({
      id: member.employee_id,
      label: employeeLabel(member.employee_snapshot, member.employee_id),
      employeeNumber: snapshotText(member.employee_snapshot, 'employee_number') ?? member.employee_id,
      jobTitle: snapshotText(member.employee_snapshot, 'job_title'),
      avatarUrl: employeeAvatarHref(member.employee_id, snapshotText(member.employee_snapshot, 'avatar_url')),
      snapshot: member.employee_snapshot,
    })),
    scores: scoreRows.map(toScore),
    previousScores: previousScoreRows.map(toScore),
  }
}

export async function createTalentReviewCampaign(input: TalentReviewCampaignCreateInput): Promise<string> {
  const context = await requirePermission('talent-review:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.from('talent_review_campaigns').insert({
    tenant_id: context.tenantId,
    administration_id: context.administrationId,
    name: input.name,
    description: input.description ?? null,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    previous_campaign_id: input.previousCampaignId ?? null,
    created_by_user_id: context.userId,
    updated_by_user_id: context.userId,
  }).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'TALENT_REVIEW_WRITE_FAILED', 'TALENT_REVIEW_WRITE_FAILED')
  return data.id
}

export async function updateTalentReviewCampaign(campaignId: string, input: TalentReviewCampaignUpdateInput): Promise<string> {
  const context = await requirePermission('talent-review:manage')
  const supabase = await createClient()
  const { data, error } = await supabase.from('talent_review_campaigns').update({
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.startsOn !== undefined ? { starts_on: input.startsOn } : {}),
    ...(input.endsOn !== undefined ? { ends_on: input.endsOn } : {}),
    ...(input.previousCampaignId !== undefined ? { previous_campaign_id: input.previousCampaignId } : {}),
    version: input.version + 1,
    updated_by_user_id: context.userId,
  }).eq('tenant_id', context.tenantId).eq('id', campaignId).eq('status', 'DRAFT').eq('version', input.version).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_REVIEW_WRITE_FAILED')
  if (!data) throw new TalentReviewError('TALENT_REVIEW_VERSION_CONFLICT', 409)
  return data.id
}

async function commandCampaign(campaignId: string, command: 'start_talent_review_campaign' | 'close_talent_review_campaign' | 'reopen_talent_review_campaign'): Promise<string> {
  await requirePermission('talent-review:manage')
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(command, { requested_campaign_id: campaignId })
  if (error || !data) databaseError(error?.message ?? 'TALENT_REVIEW_WRITE_FAILED', 'TALENT_REVIEW_WRITE_FAILED')
  return data
}

export function startTalentReviewCampaign(campaignId: string): Promise<string> { return commandCampaign(campaignId, 'start_talent_review_campaign') }
export function closeTalentReviewCampaign(campaignId: string): Promise<string> { return commandCampaign(campaignId, 'close_talent_review_campaign') }
export function reopenTalentReviewCampaign(campaignId: string): Promise<string> { return commandCampaign(campaignId, 'reopen_talent_review_campaign') }

async function scoreMutationContext(employeeId: string): Promise<AuthContext> {
  const context = await requireAuthContext()
  if (!context.permissions.includes('talent-review:manage') && context.employeeId && !canManagerAccessReviewSubject(context.employeeId, employeeId)) {
    throw new TalentReviewError('TALENT_REVIEW_SELF_SCOPE_INVALID', 403)
  }
  if (!context.permissions.includes('talent-review:manage')) await requirePermission('talent-review:write', employeeId)
  return context
}

export async function saveTalentReviewScore(campaignId: string, input: TalentReviewScoreSaveInput): Promise<string> {
  const context = await scoreMutationContext(input.employeeId)
  await requireTenantModule('TALENT')
  const supabase = await createClient()
  const { data: campaign, error: campaignError } = await supabase.from('talent_review_campaigns').select('status').eq('tenant_id', context.tenantId).eq('id', campaignId).maybeSingle()
  if (campaignError) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
  if (!campaign) throw new TalentReviewError('TALENT_REVIEW_CAMPAIGN_NOT_FOUND', 404)
  if (campaign.status !== 'ACTIVE') throw new TalentReviewError('TALENT_REVIEW_CAMPAIGN_LOCKED', 409)
  const { data: member, error: memberError } = await supabase.from('talent_review_assignment_members').select('assignment_id,manager_employee_id,employee_snapshot').eq('tenant_id', context.tenantId).eq('campaign_id', campaignId).eq('employee_id', input.employeeId).maybeSingle()
  if (memberError) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
  if (!member) throw new TalentReviewError('TALENT_REVIEW_MEMBER_NOT_FOUND', 404)
  const { data: existing, error: existingError } = await supabase.from('talent_review_scores').select('*').eq('tenant_id', context.tenantId).eq('campaign_id', campaignId).eq('employee_id', input.employeeId).maybeSingle()
  if (existingError) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
  const performanceScore = input.performanceScore ?? null
  const potentialScore = input.potentialScore ?? null
  const gridCell = deriveGridCell(performanceScore as GridValue | null, potentialScore as GridValue | null)
  if (existing) {
    if (input.version === undefined || input.version !== existing.version) throw new TalentReviewError('TALENT_REVIEW_VERSION_CONFLICT', 409)
    const { data, error } = await supabase.from('talent_review_scores').update({ performance_score: performanceScore, potential_score: potentialScore, grid_cell: gridCell, note: input.note ?? null, status: input.status, version: existing.version + 1, updated_by_user_id: context.userId }).eq('tenant_id', context.tenantId).eq('id', existing.id).eq('version', existing.version).select('id').maybeSingle()
    if (error) databaseError(error.message, 'TALENT_REVIEW_WRITE_FAILED')
    if (!data) throw new TalentReviewError('TALENT_REVIEW_VERSION_CONFLICT', 409)
    return data.id
  }
  const { data, error } = await supabase.from('talent_review_scores').insert({
    tenant_id: context.tenantId,
    campaign_id: campaignId,
    assignment_id: member.assignment_id,
    employee_id: input.employeeId,
    manager_employee_id: member.manager_employee_id,
    performance_score: performanceScore,
    potential_score: potentialScore,
    grid_cell: gridCell,
    note: input.note ?? null,
    status: input.status,
    employee_snapshot: member.employee_snapshot,
    created_by_user_id: context.userId,
    updated_by_user_id: context.userId,
  }).select('id').single()
  if (error || !data) databaseError(error?.message ?? 'TALENT_REVIEW_WRITE_FAILED', 'TALENT_REVIEW_WRITE_FAILED')
  return data.id
}

export async function submitTalentReviewAssignment(campaignId: string): Promise<string> {
  const context = await requirePermission('talent-review:write')
  if (!context.employeeId) throw new TalentReviewError('TALENT_REVIEW_ASSIGNMENT_NOT_FOUND', 404)
  const supabase = await createClient()
  const { data: campaign, error: campaignError } = await supabase.from('talent_review_campaigns').select('status').eq('tenant_id', context.tenantId).eq('id', campaignId).maybeSingle()
  if (campaignError) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
  if (!campaign) throw new TalentReviewError('TALENT_REVIEW_CAMPAIGN_NOT_FOUND', 404)
  if (campaign.status !== 'ACTIVE') throw new TalentReviewError('TALENT_REVIEW_CAMPAIGN_LOCKED', 409)
  const { data: assignment, error: assignmentError } = await supabase.from('talent_review_assignments').select('*').eq('tenant_id', context.tenantId).eq('campaign_id', campaignId).eq('manager_employee_id', context.employeeId).maybeSingle()
  if (assignmentError) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
  if (!assignment) throw new TalentReviewError('TALENT_REVIEW_ASSIGNMENT_NOT_FOUND', 404)
  const [membersResult, scoresResult] = await Promise.all([
    supabase.from('talent_review_assignment_members').select('employee_id').eq('tenant_id', context.tenantId).eq('assignment_id', assignment.id),
    supabase.from('talent_review_scores').select('employee_id,performance_score,potential_score').eq('tenant_id', context.tenantId).eq('assignment_id', assignment.id),
  ])
  if (membersResult.error || scoresResult.error) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
  const scores = new Map((scoresResult.data ?? []).map((score) => [score.employee_id, score]))
  const incomplete = (membersResult.data ?? []).some((member) => {
    const score = scores.get(member.employee_id)
    return !score || !score.performance_score || !score.potential_score
  })
  if (incomplete) throw new TalentReviewError('TALENT_REVIEW_ASSIGNMENT_INCOMPLETE', 400)
  const { data, error } = await supabase.from('talent_review_assignments').update({ status: 'SUBMITTED', submitted_at: new Date().toISOString(), submitted_by_user_id: context.userId, version: assignment.version + 1 }).eq('tenant_id', context.tenantId).eq('id', assignment.id).eq('version', assignment.version).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_REVIEW_WRITE_FAILED')
  if (!data) throw new TalentReviewError('TALENT_REVIEW_VERSION_CONFLICT', 409)
  return data.id
}

export async function sendTalentReviewReminder(campaignId: string, input: TalentReviewReminderInput): Promise<string> {
  const context = await requirePermission('talent-review:manage')
  const supabase = await createClient()
  const { data: assignment, error: assignmentError } = await supabase.from('talent_review_assignments').select('id, campaign_id, manager_employee_id, status, version').eq('tenant_id', context.tenantId).eq('campaign_id', campaignId).eq('id', input.assignmentId).maybeSingle()
  if (assignmentError) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
  if (!assignment) throw new TalentReviewError('TALENT_REVIEW_ASSIGNMENT_NOT_FOUND', 404)
  if (assignment.status === 'SUBMITTED') throw new TalentReviewError('TALENT_REVIEW_REMINDER_TARGET_INVALID', 400)
  const { data: campaign, error: campaignError } = await supabase.from('talent_review_campaigns').select('name, ends_on, status').eq('tenant_id', context.tenantId).eq('id', assignment.campaign_id).maybeSingle()
  if (campaignError) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
  if (!campaign || !['ACTIVE', 'SCHEDULED', 'HR_REVIEW'].includes(campaign.status)) throw new TalentReviewError('TALENT_REVIEW_REMINDER_TARGET_INVALID', 400)
  const { data: manager, error: managerError } = await supabase.from('employees').select('auth_user_id').eq('tenant_id', context.tenantId).eq('id', assignment.manager_employee_id).is('deleted_at', null).maybeSingle()
  if (managerError) throw new TalentReviewError('TALENT_REVIEW_READ_FAILED')
  if (!manager?.auth_user_id) throw new TalentReviewError('TALENT_REVIEW_REMINDER_TARGET_INVALID', 400)
  const { data: reminderId, error: reminderError } = await supabase.rpc('create_hr_reminder', {
    requested_tenant_id: context.tenantId,
    requested_administration_id: context.administrationId,
    requested_title: `Vlootschouw invullen: ${campaign.name}`,
    requested_description: `Vul de 9-grid voor je team in vóór ${campaign.ends_on}.`,
    requested_remind_at: new Date(Date.now() + 60 * 1000).toISOString(),
    requested_target_type: 'EMPLOYEES',
    requested_target_ids: [assignment.manager_employee_id],
  })
  if (reminderError || !reminderId) databaseError(reminderError?.message ?? 'TALENT_REVIEW_WRITE_FAILED', 'TALENT_REVIEW_WRITE_FAILED')
  const { error: publishError } = await supabase.rpc('publish_reminder', { requested_reminder_id: reminderId })
  if (publishError) databaseError(publishError.message, 'TALENT_REVIEW_WRITE_FAILED')
  const { data, error } = await supabase.from('talent_review_assignments').update({ reminder_id: reminderId, last_reminded_at: new Date().toISOString(), version: assignment.version + 1 }).eq('tenant_id', context.tenantId).eq('id', assignment.id).eq('version', assignment.version).select('id').maybeSingle()
  if (error) databaseError(error.message, 'TALENT_REVIEW_WRITE_FAILED')
  if (!data) throw new TalentReviewError('TALENT_REVIEW_VERSION_CONFLICT', 409)
  return reminderId
}
