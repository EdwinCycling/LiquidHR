import { requireAuthContext, requirePermission } from '@/lib/auth/permissions'
import { getEnabledTenantModules, ModuleError, requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { asResearchClient, type EnpsQuestionRow, type SurveyMatrixRow, type SurveyOptionRow, type SurveyQuestionRow } from './database'
import { ResearchError } from './errors'
import { researchSubmissionSchema, type ResearchSubmission } from './schemas'
import type { ResearchKind } from './admin-service'

export interface ResearchInvitationCard {
  id: string
  kind: ResearchKind
  title: string
  startsAt: string
  endsAt: string
  anonymous: boolean
  submitted: boolean
  reminderCount: number
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
}

export interface SurveyResponseForm {
  kind: 'survey'
  invitationId: string
  title: string
  description: string
  anonymous: boolean
  startsAt: string
  endsAt: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  submitted: boolean
  available: boolean
  questions: SurveyQuestionRow[]
  options: SurveyOptionRow[]
  rows: SurveyMatrixRow[]
}

export interface EnpsResponseForm {
  kind: 'enps'
  invitationId: string
  title: string
  anonymous: true
  startsAt: string
  endsAt: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  submitted: boolean
  available: boolean
  questions: EnpsQuestionRow[]
}

export type ResearchResponseForm = SurveyResponseForm | EnpsResponseForm

export async function listMyResearchInvitations(): Promise<ResearchInvitationCard[]> {
  const supabase = await createClient()
  const context = await requireAuthContext(supabase)
  if (!context.employeeId || !context.hrGroupId) return []
  const enabled = await getEnabledTenantModules({ auth: context, supabase })
  const research = asResearchClient(supabase)
  const [surveyInvitations, enpsInvitations] = await Promise.all([
    enabled.includes('SURVEYS')
      ? research.from('survey_invitations').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('employee_id', context.employeeId).order('created_at', { ascending: false }).limit(250)
      : Promise.resolve({ data: [], error: null }),
    enabled.includes('ENPS')
      ? research.from('enps_invitations').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).eq('employee_id', context.employeeId).order('created_at', { ascending: false }).limit(250)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (surveyInvitations.error || enpsInvitations.error) throw new ResearchError('RESEARCH_INVITATIONS_READ_FAILED', 500)
  const surveyIds = [...new Set((surveyInvitations.data ?? []).map((invitation) => invitation.survey_id))]
  const enpsIds = [...new Set((enpsInvitations.data ?? []).map((invitation) => invitation.campaign_id))]
  const [surveys, campaigns] = await Promise.all([
    surveyIds.length > 0 ? research.from('surveys').select('*').in('id', surveyIds).limit(250) : Promise.resolve({ data: [], error: null }),
    enpsIds.length > 0 ? research.from('enps_campaigns').select('*').in('id', enpsIds).limit(250) : Promise.resolve({ data: [], error: null }),
  ])
  if (surveys.error || campaigns.error) throw new ResearchError('RESEARCH_CAMPAIGNS_READ_FAILED', 500)
  const surveyById = new Map((surveys.data ?? []).map((survey) => [survey.id, survey]))
  const campaignById = new Map((campaigns.data ?? []).map((campaign) => [campaign.id, campaign]))
  return [
    ...(surveyInvitations.data ?? []).flatMap((invitation): ResearchInvitationCard[] => {
      const survey = surveyById.get(invitation.survey_id)
      return survey ? [{ id: invitation.id, kind: 'survey', title: survey.title, startsAt: survey.starts_at, endsAt: survey.ends_at, anonymous: survey.is_anonymous, submitted: invitation.has_submitted, reminderCount: invitation.reminder_count, status: survey.status }] : []
    }),
    ...(enpsInvitations.data ?? []).flatMap((invitation): ResearchInvitationCard[] => {
      const campaign = campaignById.get(invitation.campaign_id)
      return campaign ? [{ id: invitation.id, kind: 'enps', title: campaign.title, startsAt: campaign.starts_at, endsAt: campaign.ends_at, anonymous: true, submitted: invitation.has_submitted, reminderCount: invitation.reminder_count, status: campaign.status }] : []
    }),
  ].sort((left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt))
}

export async function getOpenResearchCount(): Promise<number> {
  const invitations = await listMyResearchInvitations()
  const now = Date.now()
  return invitations.filter((invitation) => !invitation.submitted && invitation.status === 'ACTIVE' && Date.parse(invitation.startsAt) <= now && Date.parse(invitation.endsAt) >= now).length
}

async function requireResearchModule(kind: ResearchKind): Promise<void> {
  try { await requireTenantModule(kind === 'survey' ? 'SURVEYS' : 'ENPS') }
  catch (error) { if (error instanceof ModuleError) throw new ResearchError('RESEARCH_MODULE_NOT_ACTIVE', 404); throw error }
}

export async function getResearchResponseForm(kind: ResearchKind, invitationId: string): Promise<ResearchResponseForm> {
  await requireResearchModule(kind)
  const supabase = await createClient()
  const context = await requireAuthContext(supabase)
  if (!context.employeeId || !context.hrGroupId) throw new ResearchError('RESEARCH_EMPLOYEE_CONTEXT_REQUIRED', 403)
  await requirePermission('research:respond', context.employeeId)
  const research = asResearchClient(supabase)
  if (kind === 'survey') {
    const invitation = await research.from('survey_invitations').select('*').eq('id', invitationId).eq('employee_id', context.employeeId).maybeSingle()
    if (invitation.error) throw new ResearchError('RESEARCH_INVITATION_READ_FAILED', 500)
    if (!invitation.data) throw new ResearchError('RESEARCH_INVITATION_NOT_FOUND', 404)
    const [survey, questions, options, rows] = await Promise.all([
      research.from('surveys').select('*').eq('id', invitation.data.survey_id).single(),
      research.from('survey_questions').select('*').eq('survey_id', invitation.data.survey_id).order('order_index').limit(100),
      research.from('survey_question_options').select('*').eq('survey_id', invitation.data.survey_id).order('order_index').limit(2000),
      research.from('survey_matrix_rows').select('*').eq('survey_id', invitation.data.survey_id).order('order_index').limit(3000),
    ])
    if (survey.error || questions.error || options.error || rows.error) throw new ResearchError('RESEARCH_FORM_READ_FAILED', 500)
    const available = isResponseAvailable(survey.data.status, survey.data.starts_at, survey.data.ends_at, invitation.data.has_submitted)
    return {
      kind,
      invitationId,
      title: survey.data.title,
      description: survey.data.description,
      anonymous: survey.data.is_anonymous,
      startsAt: survey.data.starts_at,
      endsAt: survey.data.ends_at,
      status: survey.data.status,
      submitted: invitation.data.has_submitted,
      available,
      questions: questions.data ?? [],
      options: options.data ?? [],
      rows: rows.data ?? [],
    }
  }

  const invitation = await research.from('enps_invitations').select('*').eq('id', invitationId).eq('employee_id', context.employeeId).maybeSingle()
  if (invitation.error) throw new ResearchError('RESEARCH_INVITATION_READ_FAILED', 500)
  if (!invitation.data) throw new ResearchError('RESEARCH_INVITATION_NOT_FOUND', 404)
  const [campaign, questions] = await Promise.all([
    research.from('enps_campaigns').select('*').eq('id', invitation.data.campaign_id).single(),
    research.from('enps_questions').select('*').eq('campaign_id', invitation.data.campaign_id).eq('is_enabled', true).order('order_index').limit(150),
  ])
  if (campaign.error || questions.error) throw new ResearchError('RESEARCH_FORM_READ_FAILED', 500)
  const available = isResponseAvailable(campaign.data.status, campaign.data.starts_at, campaign.data.ends_at, invitation.data.has_submitted)
  return {
    kind,
    invitationId,
    title: campaign.data.title,
    anonymous: true,
    startsAt: campaign.data.starts_at,
    endsAt: campaign.data.ends_at,
    status: campaign.data.status,
    submitted: invitation.data.has_submitted,
    available,
    questions: questions.data ?? [],
  }
}

function isResponseAvailable(status: ResearchResponseForm['status'], startsAt: string, endsAt: string, submitted: boolean): boolean {
  const now = Date.now()
  return status === 'ACTIVE' && Date.parse(startsAt) <= now && Date.parse(endsAt) >= now && !submitted
}

export async function submitResearchResponse(kind: ResearchKind, invitationId: string, input: ResearchSubmission): Promise<string> {
  await requireResearchModule(kind)
  const parsed = researchSubmissionSchema.parse(input)
  const context = await requireAuthContext()
  if (!context.employeeId) throw new ResearchError('RESEARCH_EMPLOYEE_CONTEXT_REQUIRED', 403)
  await requirePermission('research:respond', context.employeeId)
  const research = asResearchClient(await createClient())
  const result = kind === 'survey'
    ? await research.rpc('submit_survey_response', { p_invitation_id: invitationId, p_answers: parsed.answers })
    : await research.rpc('submit_enps_response', { p_invitation_id: invitationId, p_answers: parsed.answers })
  if (result.error) {
    const code = result.error.message.match(/RESEARCH_[A-Z_]+|ENPS_[A-Z_]+/)?.[0] ?? 'RESEARCH_SUBMIT_FAILED'
    const status = code === 'RESEARCH_ALREADY_SUBMITTED' ? 409 : code.endsWith('FORBIDDEN') ? 403 : 400
    throw new ResearchError(code, status)
  }
  return result.data
}
