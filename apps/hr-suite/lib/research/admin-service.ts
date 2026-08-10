import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { getEnabledTenantModules, requireTenantModule } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { asResearchClient, type EnpsCampaignRow, type SurveyRow } from './database'
import { ResearchError } from './errors'
import { enpsCampaignInputSchema, surveyInputSchema, type EnpsCampaignInput, type ResearchTargetMode, type SurveyInput } from './schemas'
import { listResearchTargetOptions, resolveTargetEmployeeIds } from './target-service'

export type ResearchKind = 'survey' | 'enps'

export interface ResearchCampaignSummary {
  id: string
  kind: ResearchKind
  title: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  startsAt: string
  endsAt: string
  anonymous: boolean
  invited: number
  submitted: number
}

export async function listResearchSettingsData() {
  const context = await requirePermission('research:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const research = asResearchClient(supabase)
  const enabledModules = await getEnabledTenantModules({ auth: context, supabase })
  const [surveys, campaigns, categories, bank, targets] = await Promise.all([
    research.from('surveys').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('created_at', { ascending: false }).limit(250),
    research.from('enps_campaigns').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('created_at', { ascending: false }).limit(250),
    research.from('enps_question_bank_categories').select('*').order('order_index').limit(250),
    research.from('enps_question_bank').select('*').order('question_number', { nullsFirst: false }).limit(1000),
    listResearchTargetOptions(context, supabase),
  ])
  if (surveys.error || campaigns.error || categories.error || bank.error) throw new ResearchError('RESEARCH_SETTINGS_READ_FAILED', 500)
  return {
    surveys: surveys.data ?? [],
    enpsCampaigns: campaigns.data ?? [],
    categories: categories.data ?? [],
    questionBank: bank.data ?? [],
    targets,
    modules: { surveys: enabledModules.includes('SURVEYS'), enps: enabledModules.includes('ENPS') },
  }
}

export async function createSurvey(input: SurveyInput): Promise<string> {
  await requireTenantModule('SURVEYS')
  const parsed = surveyInputSchema.parse(input)
  const context = await requirePermission('research:write')
  const hrGroupId = requireHrGroupId(context)
  const research = asResearchClient(await createClient())
  const created = await research.from('surveys').insert({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    title: parsed.title,
    description: parsed.description,
    starts_at: parsed.startsAt,
    ends_at: parsed.endsAt,
    is_anonymous: parsed.isAnonymous,
    status: 'DRAFT',
    target_mode: parsed.target.mode,
    target_ids: parsed.target.ids,
    created_by: context.userId,
  }).select('id').single()
  if (created.error) throw new ResearchError('SURVEY_CREATE_FAILED', 500)

  try {
    const questions = await research.from('survey_questions').insert(parsed.questions.map((question, orderIndex) => ({
      tenant_id: context.tenantId,
      hr_group_id: hrGroupId,
      survey_id: created.data.id,
      question_text: question.text,
      question_type: question.type,
      is_required: question.required,
      order_index: orderIndex,
    }))).select('id, order_index')
    if (questions.error) throw questions.error
    const idByOrder = new Map((questions.data ?? []).map((question) => [question.order_index, question.id]))
    const options = parsed.questions.flatMap((question, questionIndex) => question.options.map((label, orderIndex) => ({
      tenant_id: context.tenantId,
      hr_group_id: hrGroupId,
      survey_id: created.data.id,
      question_id: idByOrder.get(questionIndex) ?? '',
      option_label: label,
      order_index: orderIndex,
    })))
    const rows = parsed.questions.flatMap((question, questionIndex) => question.rows.map((row, orderIndex) => ({
      tenant_id: context.tenantId,
      hr_group_id: hrGroupId,
      survey_id: created.data.id,
      question_id: idByOrder.get(questionIndex) ?? '',
      row_label: row.label,
      is_required: row.required,
      order_index: orderIndex,
    })))
    if (options.length > 0) {
      const optionResult = await research.from('survey_question_options').insert(options)
      if (optionResult.error) throw optionResult.error
    }
    if (rows.length > 0) {
      const rowResult = await research.from('survey_matrix_rows').insert(rows)
      if (rowResult.error) throw rowResult.error
    }
    return created.data.id
  } catch {
    await research.from('surveys').delete().eq('id', created.data.id).eq('status', 'DRAFT')
    throw new ResearchError('SURVEY_QUESTIONS_CREATE_FAILED', 500)
  }
}

export async function createEnpsCampaign(input: EnpsCampaignInput): Promise<string> {
  await requireTenantModule('ENPS')
  const parsed = enpsCampaignInputSchema.parse(input)
  const context = await requirePermission('research:write')
  const hrGroupId = requireHrGroupId(context)
  const research = asResearchClient(await createClient())
  const bankIds = parsed.questions.map((question) => question.bankQuestionId)
  const bank = await research.from('enps_question_bank').select('*').in('id', bankIds).limit(150)
  const categories = await research.from('enps_question_bank_categories').select('*').limit(250)
  if (bank.error || categories.error || (bank.data?.length ?? 0) !== bankIds.length) throw new ResearchError('ENPS_QUESTION_BANK_INVALID', 400)
  const bankById = new Map((bank.data ?? []).map((question) => [question.id, question]))
  const categoryById = new Map((categories.data ?? []).map((category) => [category.id, category]))

  const created = await research.from('enps_campaigns').insert({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    title: parsed.title,
    starts_at: parsed.startsAt,
    ends_at: parsed.endsAt,
    scale_type: parsed.scaleType,
    status: 'DRAFT',
    target_mode: parsed.target.mode,
    target_ids: parsed.target.ids,
    reminder_interval_days: parsed.reminderIntervalDays,
    created_by: context.userId,
  }).select('id').single()
  if (created.error) throw new ResearchError('ENPS_CREATE_FAILED', 500)

  const questions = parsed.questions.map((selection) => {
    const source = bankById.get(selection.bankQuestionId)
    if (!source) throw new ResearchError('ENPS_QUESTION_BANK_INVALID', 400)
    if (source.is_mandatory_enps !== selection.mandatory) throw new ResearchError('ENPS_MANDATORY_QUESTION_INVALID', 400)
    const category = categoryById.get(source.category_id)
    if (!category) throw new ResearchError('ENPS_QUESTION_BANK_INVALID', 400)
    return {
      tenant_id: context.tenantId,
      hr_group_id: hrGroupId,
      campaign_id: created.data.id,
      bank_question_id: source.id,
      category_name: category.name,
      question_text: source.question_text,
      question_type: selection.mandatory ? 'SCALE_10' : selection.type,
      is_mandatory: selection.mandatory,
      is_enabled: selection.enabled,
      order_index: selection.order,
    }
  })
  const inserted = await research.from('enps_questions').insert(questions)
  if (inserted.error) {
    await research.from('enps_campaigns').delete().eq('id', created.data.id).eq('status', 'DRAFT')
    throw new ResearchError('ENPS_QUESTIONS_CREATE_FAILED', 500)
  }
  return created.data.id
}

async function loadCampaign(kind: ResearchKind, id: string): Promise<{ campaign: SurveyRow | EnpsCampaignRow; context: Awaited<ReturnType<typeof requirePermission>>; supabase: Awaited<ReturnType<typeof createClient>> }> {
  const context = await requirePermission('research:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const research = asResearchClient(supabase)
  const result = kind === 'survey'
    ? await research.from('surveys').select('*').eq('id', id).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).maybeSingle()
    : await research.from('enps_campaigns').select('*').eq('id', id).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).maybeSingle()
  if (result.error) throw new ResearchError('RESEARCH_CAMPAIGN_READ_FAILED', 500)
  if (!result.data) throw new ResearchError('RESEARCH_CAMPAIGN_NOT_FOUND', 404)
  return { campaign: result.data, context, supabase }
}

export async function activateResearchCampaign(kind: ResearchKind, id: string): Promise<number> {
  await requireTenantModule(kind === 'survey' ? 'SURVEYS' : 'ENPS')
  const { campaign, context, supabase } = await loadCampaign(kind, id)
  if (campaign.status !== 'DRAFT') throw new ResearchError('RESEARCH_CAMPAIGN_NOT_DRAFT', 409)
  const employeeIds = await resolveTargetEmployeeIds(context, supabase, campaign.target_mode as ResearchTargetMode, campaign.target_ids)
  if (employeeIds.length === 0) throw new ResearchError('RESEARCH_TARGET_EMPTY', 400)
  const research = asResearchClient(supabase)
  const invitationResult = kind === 'survey'
    ? await research.from('survey_invitations').insert(employeeIds.map((employeeId) => ({ tenant_id: campaign.tenant_id, hr_group_id: campaign.hr_group_id, survey_id: campaign.id, employee_id: employeeId })))
    : await research.from('enps_invitations').insert(employeeIds.map((employeeId) => ({ tenant_id: campaign.tenant_id, hr_group_id: campaign.hr_group_id, campaign_id: campaign.id, employee_id: employeeId })))
  if (invitationResult.error) throw new ResearchError('RESEARCH_INVITATIONS_CREATE_FAILED', 500)
  const activatedAt = new Date().toISOString()
  const updateResult = kind === 'survey'
    ? await research.from('surveys').update({ status: 'ACTIVE', activated_at: activatedAt }).eq('id', campaign.id).eq('status', 'DRAFT')
    : await research.from('enps_campaigns').update({ status: 'ACTIVE', activated_at: activatedAt }).eq('id', campaign.id).eq('status', 'DRAFT')
  if (updateResult.error) throw new ResearchError('RESEARCH_ACTIVATE_FAILED', 500)
  return employeeIds.length
}

export async function closeResearchCampaign(kind: ResearchKind, id: string): Promise<void> {
  const { campaign, supabase } = await loadCampaign(kind, id)
  if (campaign.status !== 'ACTIVE') throw new ResearchError('RESEARCH_CAMPAIGN_NOT_ACTIVE', 409)
  const research = asResearchClient(supabase)
  const closedAt = new Date().toISOString()
  const result = kind === 'survey'
    ? await research.from('surveys').update({ status: 'CLOSED', closed_at: closedAt }).eq('id', id).eq('status', 'ACTIVE')
    : await research.from('enps_campaigns').update({ status: 'CLOSED', closed_at: closedAt }).eq('id', id).eq('status', 'ACTIVE')
  if (result.error) throw new ResearchError('RESEARCH_CLOSE_FAILED', 500)
}

export async function remindResearchParticipants(kind: ResearchKind, id: string, employeeId?: string): Promise<number> {
  const { campaign, supabase } = await loadCampaign(kind, id)
  if (campaign.status !== 'ACTIVE') throw new ResearchError('RESEARCH_CAMPAIGN_NOT_ACTIVE', 409)
  const research = asResearchClient(supabase)
  const remindedAt = new Date().toISOString()
  if (kind === 'survey') {
    let invitationQuery = research.from('survey_invitations').select('*').eq('survey_id', id).eq('has_submitted', false)
    if (employeeId) invitationQuery = invitationQuery.eq('employee_id', employeeId)
    const invitations = await invitationQuery.limit(10000)
    if (invitations.error) throw new ResearchError('RESEARCH_INVITATIONS_READ_FAILED', 500)
    if (!invitations.data.length) return 0
    const updateResult = await research.from('survey_invitations').upsert(invitations.data.map((invitation) => ({ ...invitation, reminder_count: invitation.reminder_count + 1, last_reminded_at: remindedAt })))
    if (updateResult.error) throw new ResearchError('RESEARCH_REMINDER_FAILED', 500)
    return invitations.data.length
  }

  let invitationQuery = research.from('enps_invitations').select('*').eq('campaign_id', id).eq('has_submitted', false)
  if (employeeId) invitationQuery = invitationQuery.eq('employee_id', employeeId)
  const invitations = await invitationQuery.limit(10000)
  if (invitations.error) throw new ResearchError('RESEARCH_INVITATIONS_READ_FAILED', 500)
  if (!invitations.data.length) return 0
  const updateResult = await research.from('enps_invitations').upsert(invitations.data.map((invitation) => ({ ...invitation, reminder_count: invitation.reminder_count + 1, last_reminded_at: remindedAt })))
  if (updateResult.error) throw new ResearchError('RESEARCH_REMINDER_FAILED', 500)
  return invitations.data.length
}
