import { NextResponse } from 'next/server'
import type { Database, Json } from '@scope/db'
import { permissionErrorResponse, requireAuthContext, requireHrGroupId } from '@/lib/auth/permissions'
import { requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import type { TeamCompassCampaignInput, TeamCompassResponseInput, TeamCompassTransitionInput } from './schemas'

type Campaign = Database['public']['Tables']['team_compass_campaigns']['Row']
type Participation = Database['public']['Tables']['team_compass_participations']['Row']
type Profile = Database['public']['Tables']['team_compass_profiles']['Row']
type Question = Database['public']['Tables']['team_compass_questions']['Row']
type Answer = Database['public']['Tables']['team_compass_answers']['Row']

export type TeamCompassMode = 'admin' | 'manager' | 'employee'

export type TeamCompassProjection = {
  available: boolean
  invitedCount: number
  completedCount: number
  threshold: number
  outerPercentages?: Record<'ACTION' | 'VISION' | 'HARMONY' | 'LOGIC', number>
  namedProfiles?: Array<{
    employeeId: string
    label: string
    outer: { x: number; y: number }
    inner: { x: number; y: number } | null
    primaryDimension: string
  }>
}

export class TeamCompassServiceError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code)
    this.name = 'TeamCompassServiceError'
  }
}

function modeForPermissions(permissions: readonly string[]): TeamCompassMode {
  if (permissions.includes('team-compass:manage')) return 'admin'
  if (permissions.includes('team-compass:read')) return 'manager'
  if (permissions.includes('self:team-compass:read')) return 'employee'
  throw new TeamCompassServiceError('TEAM_COMPASS_FORBIDDEN', 403)
}

function ensureDatabaseResult(error: { message: string; code?: string } | null, fallback: string): void {
  if (!error) return
  const conflict = error.code === '40001' || error.message.includes('VERSION_CONFLICT')
  const forbidden = error.code === '42501' || error.message.includes('FORBIDDEN')
  const invalid = error.code === '22023' || error.message.includes('INVALID') || error.message.includes('INCOMPLETE')
  throw new TeamCompassServiceError(
    error.message.match(/TEAM_COMPASS_[A-Z_]+/)?.[0] ?? fallback,
    conflict ? 409 : forbidden ? 403 : invalid ? 400 : 500,
  )
}

function projectionFromJson(value: Json | null): TeamCompassProjection | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null
  const invitedCount = value.invitedCount
  const completedCount = value.completedCount
  const threshold = value.threshold
  if (typeof value.available !== 'boolean' || typeof invitedCount !== 'number' || typeof completedCount !== 'number' || typeof threshold !== 'number') return null
  return value as TeamCompassProjection
}

export async function getTeamCompassWorkspace(selectedCampaignId?: string) {
  await requireTenantModule('TEAM_COMPASS')
  const auth = await requireAuthContext()
  const hrGroupId = requireHrGroupId(auth)
  const mode = modeForPermissions(auth.permissions)
  const supabase = await createClient()

  const [campaignResult, targetResult, departmentResult, versionResult, participationResult] = await Promise.all([
    supabase.from('team_compass_campaigns').select('*').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).order('created_at', { ascending: false }),
    supabase.from('team_compass_campaign_targets').select('*').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId),
    supabase.from('departments').select('id,name').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).order('name'),
    supabase.from('team_compass_questionnaire_versions').select('*').eq('status', 'ACTIVE').order('version', { ascending: false }),
    supabase.from('team_compass_participations').select('*').eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).order('updated_at', { ascending: false }),
  ])
  ensureDatabaseResult(campaignResult.error, 'TEAM_COMPASS_CAMPAIGNS_READ_FAILED')
  ensureDatabaseResult(targetResult.error, 'TEAM_COMPASS_TARGETS_READ_FAILED')
  ensureDatabaseResult(departmentResult.error, 'TEAM_COMPASS_DEPARTMENTS_READ_FAILED')
  ensureDatabaseResult(versionResult.error, 'TEAM_COMPASS_QUESTIONNAIRE_READ_FAILED')
  ensureDatabaseResult(participationResult.error, 'TEAM_COMPASS_PARTICIPATIONS_READ_FAILED')

  const participations = participationResult.data ?? []
  const participantIds = participations.map((participation) => participation.id)
  const employeeIds = [...new Set(participations.map((participation) => participation.employee_id))]
  const [profileResult, employeeResult] = await Promise.all([
    participantIds.length > 0
      ? supabase.from('team_compass_profiles').select('*').in('participation_id', participantIds)
      : Promise.resolve({ data: [] as Profile[], error: null }),
    employeeIds.length > 0
      ? supabase.from('employees').select('id,first_name,birth_name,employee_number').in('id', employeeIds)
      : Promise.resolve({ data: [] as Array<{ id: string; first_name: string | null; birth_name: string | null; employee_number: string }>, error: null }),
  ])
  ensureDatabaseResult(profileResult.error, 'TEAM_COMPASS_PROFILES_READ_FAILED')
  ensureDatabaseResult(employeeResult.error, 'TEAM_COMPASS_EMPLOYEES_READ_FAILED')

  let projection: TeamCompassProjection | null = null
  if (selectedCampaignId && mode !== 'employee') {
    const { data, error } = await supabase.rpc('get_team_compass_team_projection', {
      requested_campaign_id: selectedCampaignId,
      requested_department_id: undefined,
    })
    ensureDatabaseResult(error, 'TEAM_COMPASS_PROJECTION_READ_FAILED')
    projection = projectionFromJson(data)
  }

  return {
    mode,
    campaigns: (campaignResult.data ?? []) as Campaign[],
    targets: targetResult.data ?? [],
    departments: departmentResult.data ?? [],
    questionnaireVersions: versionResult.data ?? [],
    participations: participations as Participation[],
    profiles: (profileResult.data ?? []) as Profile[],
    employees: employeeResult.data ?? [],
    projection,
  }
}

export async function getTeamCompassAssessment(participationId: string) {
  await requireTenantModule('TEAM_COMPASS')
  const auth = await requireAuthContext()
  const supabase = await createClient()
  const { data: participation, error } = await supabase.from('team_compass_participations').select('*').eq('id', participationId).maybeSingle()
  ensureDatabaseResult(error, 'TEAM_COMPASS_PARTICIPATION_READ_FAILED')
  if (!participation || participation.employee_id !== auth.employeeId) throw new TeamCompassServiceError('TEAM_COMPASS_PARTICIPATION_NOT_FOUND', 404)
  const [{ data: campaign, error: campaignError }, { data: answers, error: answersError }] = await Promise.all([
    supabase.from('team_compass_campaigns').select('*').eq('id', participation.campaign_id).single(),
    supabase.from('team_compass_answers').select('*').eq('participation_id', participation.id),
  ])
  ensureDatabaseResult(campaignError, 'TEAM_COMPASS_CAMPAIGN_READ_FAILED')
  ensureDatabaseResult(answersError, 'TEAM_COMPASS_ANSWERS_READ_FAILED')
  if (!campaign) throw new TeamCompassServiceError('TEAM_COMPASS_CAMPAIGN_NOT_FOUND', 404)
  const { data: questions, error: questionError } = await supabase.from('team_compass_questions').select('*')
    .eq('questionnaire_version_id', campaign.questionnaire_version_id).order('sort_order')
  ensureDatabaseResult(questionError, 'TEAM_COMPASS_QUESTIONS_READ_FAILED')
  const { data: profile, error: profileError } = await supabase.from('team_compass_profiles').select('*').eq('participation_id', participation.id).maybeSingle()
  ensureDatabaseResult(profileError, 'TEAM_COMPASS_PROFILE_READ_FAILED')
  return { participation: participation as Participation, campaign: campaign as Campaign, questions: (questions ?? []) as Question[], answers: (answers ?? []) as Answer[], profile: profile as Profile | null }
}

export async function saveTeamCompassCampaign(input: TeamCompassCampaignInput) {
  await requireTenantModule('TEAM_COMPASS')
  const auth = await requireAuthContext()
  const hrGroupId = requireHrGroupId(auth)
  if (!auth.permissions.includes('team-compass:manage')) throw new TeamCompassServiceError('TEAM_COMPASS_FORBIDDEN', 403)
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_team_compass_campaign', {
    requested_tenant_id: auth.tenantId,
    requested_hr_group_id: hrGroupId,
    requested_payload: input,
    ...(input.campaignId ? { requested_campaign_id: input.campaignId } : {}),
    ...(input.expectedVersion !== null ? { requested_expected_version: input.expectedVersion } : {}),
  })
  ensureDatabaseResult(error, 'TEAM_COMPASS_CAMPAIGN_SAVE_FAILED')
  return data
}

export async function transitionTeamCompassCampaign(campaignId: string, input: TeamCompassTransitionInput) {
  await requireTenantModule('TEAM_COMPASS')
  const auth = await requireAuthContext()
  if (!auth.permissions.includes('team-compass:manage')) throw new TeamCompassServiceError('TEAM_COMPASS_FORBIDDEN', 403)
  const supabase = await createClient()
  const result = input.action === 'START'
    ? await supabase.rpc('start_team_compass_campaign', { requested_campaign_id: campaignId, requested_expected_version: input.expectedVersion })
    : await supabase.rpc('transition_team_compass_campaign', { requested_campaign_id: campaignId, requested_expected_version: input.expectedVersion, requested_status: input.action === 'CLOSE' ? 'CLOSED' : 'ARCHIVED' })
  ensureDatabaseResult(result.error, 'TEAM_COMPASS_CAMPAIGN_TRANSITION_FAILED')
  return result.data
}

export async function saveTeamCompassResponse(participationId: string, input: TeamCompassResponseInput) {
  await requireTenantModule('TEAM_COMPASS')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_team_compass_response', {
    requested_participation_id: participationId,
    requested_expected_version: input.expectedVersion,
    requested_answers: input.answers.map((answer) => ({ question_id: answer.questionId, inner_score: answer.innerScore, outer_score: answer.outerScore })),
    requested_submit: input.submit,
    requested_share_outer: input.shareOuter,
    requested_share_inner: input.shareInner,
  })
  ensureDatabaseResult(error, 'TEAM_COMPASS_RESPONSE_SAVE_FAILED')
  return data
}

export function teamCompassErrorResponse(error: unknown): NextResponse {
  const permission = permissionErrorResponse(error)
  if (permission) return permission
  if (error instanceof TeamCompassServiceError) return NextResponse.json({ error: error.code }, { status: error.status })
  return NextResponse.json({ error: 'TEAM_COMPASS_OPERATION_FAILED' }, { status: 500 })
}
