import { AuthorizationError, requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { calculateEnps, enforceAnonymityThreshold, summarizeNumericAnswers } from './calculations'
import { asResearchClient, type SurveyAnswerRow } from './database'
import { ResearchError } from './errors'
import type { ResearchCampaignSummary, ResearchKind } from './admin-service'

export interface ResearchParticipant {
  employeeId: string
  name: string
  employeeNumber: string
  department: string
  jobTitle: string
  submitted: boolean
  submittedAt: string | null
  reminderCount: number
  lastRemindedAt: string | null
}

export interface SurveyQuestionResult {
  questionId: string
  text: string
  type: string
  totalAnswers: number
  options: Array<{ label: string; count: number; percentage: number }>
  comments: string[]
  numeric: ReturnType<typeof summarizeNumericAnswers> | null
  matrix: Array<{ row: string; options: Array<{ label: string; count: number; percentage: number }> }>
}

export interface EnpsQuestionResult {
  questionId: string
  text: string
  category: string
  type: string
  totalAnswers: number
  average: number | null
  maximum: number | null
  distribution: Array<{ label: string; count: number; percentage: number }>
}

export interface ResearchMonitorDetail {
  campaign: ResearchCampaignSummary
  participants: ResearchParticipant[]
  canReadResults: boolean
  surveyResults: SurveyQuestionResult[]
  enps: ReturnType<typeof calculateEnps> | null
  enpsVisible: boolean
  driverScores: Array<{ category: string; average: number; responseCount: number; maximum: number }>
  enpsQuestionResults: EnpsQuestionResult[]
  comments: Array<{ question: string; value: string }>
}

function effectiveCampaignStatus(status: 'DRAFT' | 'ACTIVE' | 'CLOSED', endsAt: string): 'DRAFT' | 'ACTIVE' | 'CLOSED' {
  return status === 'ACTIVE' && Date.parse(endsAt) < Date.now() ? 'CLOSED' : status
}

async function hasResultsPermission(): Promise<boolean> {
  try {
    await requirePermission('research-result:read')
    return true
  } catch (error) {
    if (error instanceof AuthorizationError) return false
    throw error
  }
}

export async function listResearchMonitor(): Promise<ResearchCampaignSummary[]> {
  const context = await requirePermission('research:read')
  const hrGroupId = requireHrGroupId(context)
  const research = asResearchClient(await createClient())
  const [surveys, campaigns, surveyInvitations, enpsInvitations] = await Promise.all([
    research.from('surveys').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('created_at', { ascending: false }).limit(250),
    research.from('enps_campaigns').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('created_at', { ascending: false }).limit(250),
    research.from('survey_invitations').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).limit(10000),
    research.from('enps_invitations').select('*').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).limit(10000),
  ])
  if (surveys.error || campaigns.error || surveyInvitations.error || enpsInvitations.error) throw new ResearchError('RESEARCH_MONITOR_READ_FAILED', 500)

  return [
    ...(surveys.data ?? []).map((survey): ResearchCampaignSummary => {
      const invitations = (surveyInvitations.data ?? []).filter((invitation) => invitation.survey_id === survey.id)
      return { id: survey.id, kind: 'survey', title: survey.title, status: effectiveCampaignStatus(survey.status, survey.ends_at), startsAt: survey.starts_at, endsAt: survey.ends_at, anonymous: survey.is_anonymous, invited: invitations.length, submitted: invitations.filter((invitation) => invitation.has_submitted).length }
    }),
    ...(campaigns.data ?? []).map((campaign): ResearchCampaignSummary => {
      const invitations = (enpsInvitations.data ?? []).filter((invitation) => invitation.campaign_id === campaign.id)
      return { id: campaign.id, kind: 'enps', title: campaign.title, status: effectiveCampaignStatus(campaign.status, campaign.ends_at), startsAt: campaign.starts_at, endsAt: campaign.ends_at, anonymous: true, invited: invitations.length, submitted: invitations.filter((invitation) => invitation.has_submitted).length }
    }),
  ].sort((left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt))
}

export async function getResearchMonitorCount(): Promise<number> {
  const campaigns = await listResearchMonitor()
  return campaigns.filter((campaign) => campaign.status === 'ACTIVE').length
}

async function participantDirectory(employeeIds: string[]) {
  if (employeeIds.length === 0) return new Map<string, { name: string; employeeNumber: string; department: string; jobTitle: string }>()
  const context = await requirePermission('research:read')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [employees, organizations, departments] = await Promise.all([
    supabase.from('employees').select('id, first_name, birth_name_prefix, birth_name, employee_number').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('id', employeeIds).limit(10000),
    supabase.from('employee_organizations').select('employee_id, department_id, job_title, effective_from').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).in('employee_id', employeeIds).lte('effective_from', today).or(`effective_to.is.null,effective_to.gte.${today}`).order('effective_from', { ascending: false }).limit(10000),
    supabase.from('departments').select('id, name').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).limit(1000),
  ])
  if (employees.error || organizations.error || departments.error) throw new ResearchError('RESEARCH_PARTICIPANTS_READ_FAILED', 500)
  const departmentById = new Map((departments.data ?? []).map((department) => [department.id, department.name]))
  const organizationByEmployee = new Map<string, { department_id: string; job_title: string | null }>()
  for (const organization of organizations.data ?? []) {
    if (!organizationByEmployee.has(organization.employee_id)) organizationByEmployee.set(organization.employee_id, organization)
  }
  return new Map((employees.data ?? []).map((employee) => {
    const organization = organizationByEmployee.get(employee.id)
    return [employee.id, {
      name: [employee.first_name, employee.birth_name_prefix, employee.birth_name].filter(Boolean).join(' '),
      employeeNumber: employee.employee_number,
      department: organization ? departmentById.get(organization.department_id) ?? '—' : '—',
      jobTitle: organization?.job_title ?? '—',
    }]
  }))
}

function campaignSummary(kind: ResearchKind, campaign: { id: string; title: string; status: 'DRAFT' | 'ACTIVE' | 'CLOSED'; starts_at: string; ends_at: string }, anonymous: boolean, invited: number, submitted: number): ResearchCampaignSummary {
  return { id: campaign.id, kind, title: campaign.title, status: effectiveCampaignStatus(campaign.status, campaign.ends_at), startsAt: campaign.starts_at, endsAt: campaign.ends_at, anonymous, invited, submitted }
}

export async function getResearchMonitorDetail(kind: ResearchKind, id: string): Promise<ResearchMonitorDetail> {
  const context = await requirePermission('research:read')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const research = asResearchClient(supabase)
  const canReadResults = await hasResultsPermission()

  if (kind === 'survey') {
    const [campaign, invitations] = await Promise.all([
      research.from('surveys').select('*').eq('id', id).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).maybeSingle(),
      research.from('survey_invitations').select('*').eq('survey_id', id).order('has_submitted', { ascending: true }).limit(10000),
    ])
    if (campaign.error || invitations.error) throw new ResearchError('RESEARCH_MONITOR_READ_FAILED', 500)
    if (!campaign.data) throw new ResearchError('RESEARCH_CAMPAIGN_NOT_FOUND', 404)
    const directory = await participantDirectory((invitations.data ?? []).map((invitation) => invitation.employee_id))
    const participants = (invitations.data ?? []).flatMap((invitation): ResearchParticipant[] => {
      const employee = directory.get(invitation.employee_id)
      return employee ? [{ employeeId: invitation.employee_id, ...employee, submitted: invitation.has_submitted, submittedAt: invitation.submitted_at, reminderCount: invitation.reminder_count, lastRemindedAt: invitation.last_reminded_at }] : []
    })
    const submitted = participants.filter((participant) => participant.submitted).length
    let surveyResults: SurveyQuestionResult[] = []
    if (canReadResults) {
      const [questions, options, rows, responses, answers] = await Promise.all([
        research.from('survey_questions').select('*').eq('survey_id', id).order('order_index').limit(100),
        research.from('survey_question_options').select('*').eq('survey_id', id).order('order_index').limit(2000),
        research.from('survey_matrix_rows').select('*').eq('survey_id', id).order('order_index').limit(3000),
        research.from('survey_responses').select('*').eq('survey_id', id).limit(10000),
        research.from('survey_answers').select('*').eq('survey_id', id).limit(50000),
      ])
      if (questions.error || options.error || rows.error || responses.error || answers.error) throw new ResearchError('RESEARCH_RESULTS_READ_FAILED', 500)
      const responseCount = responses.data?.length ?? 0
      surveyResults = (questions.data ?? []).map((question) => {
        const questionAnswers = (answers.data ?? []).filter((answer) => answer.question_id === question.id)
        const questionOptions = (options.data ?? []).filter((option) => option.question_id === question.id)
        const optionResults = questionOptions.map((option) => {
          const count = questionAnswers.filter((answer) => answer.option_id === option.id).length
          return { label: option.option_label, count, percentage: responseCount ? Math.round((count / responseCount) * 100) : 0 }
        })
        const matrix = (rows.data ?? []).filter((row) => row.question_id === question.id).map((row) => {
          const rowAnswers = questionAnswers.filter((answer) => answer.matrix_row_id === row.id)
          return {
            row: row.row_label,
            options: questionOptions.map((option) => {
              const count = rowAnswers.filter((answer) => answer.option_id === option.id).length
              return { label: option.option_label, count, percentage: rowAnswers.length ? Math.round((count / rowAnswers.length) * 100) : 0 }
            }),
          }
        })
        const textValues = questionAnswers.flatMap((answer) => answer.answer_text?.trim() ? [answer.answer_text.trim()] : [])
        return {
          questionId: question.id,
          text: question.question_text,
          type: question.question_type,
          totalAnswers: new Set(questionAnswers.map((answer) => answer.response_id)).size,
          options: optionResults,
          comments: question.question_type.startsWith('TEXT_') ? textValues : [],
          numeric: question.question_type === 'NUMBER' ? summarizeNumericAnswers(textValues.map(Number)) : null,
          matrix,
        }
      })
    }
    return {
      campaign: campaignSummary(kind, campaign.data, campaign.data.is_anonymous, participants.length, submitted),
      participants,
      canReadResults,
      surveyResults,
      enps: null,
      enpsVisible: false,
      driverScores: [],
      enpsQuestionResults: [],
      comments: [],
    }
  }

  const [campaign, invitations] = await Promise.all([
    research.from('enps_campaigns').select('*').eq('id', id).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).maybeSingle(),
    research.from('enps_invitations').select('*').eq('campaign_id', id).order('has_submitted', { ascending: true }).limit(10000),
  ])
  if (campaign.error || invitations.error) throw new ResearchError('RESEARCH_MONITOR_READ_FAILED', 500)
  if (!campaign.data) throw new ResearchError('RESEARCH_CAMPAIGN_NOT_FOUND', 404)
  const directory = await participantDirectory((invitations.data ?? []).map((invitation) => invitation.employee_id))
  const participants = (invitations.data ?? []).flatMap((invitation): ResearchParticipant[] => {
    const employee = directory.get(invitation.employee_id)
    return employee ? [{ employeeId: invitation.employee_id, ...employee, submitted: invitation.has_submitted, submittedAt: null, reminderCount: invitation.reminder_count, lastRemindedAt: invitation.last_reminded_at }] : []
  })
  const submitted = participants.filter((participant) => participant.submitted).length
  let enps: ReturnType<typeof calculateEnps> | null = null
  let enpsVisible = false
  let driverScores: Array<{ category: string; average: number; responseCount: number; maximum: number }> = []
  let enpsQuestionResults: EnpsQuestionResult[] = []
  let comments: Array<{ question: string; value: string }> = []
  if (canReadResults) {
    const [questions, responses, answers] = await Promise.all([
      research.from('enps_questions').select('*').eq('campaign_id', id).eq('is_enabled', true).order('order_index').limit(150),
      research.from('enps_responses').select('*').eq('campaign_id', id).limit(10000),
      research.from('enps_answers').select('*').eq('campaign_id', id).limit(50000),
    ])
    if (questions.error || responses.error || answers.error) throw new ResearchError('RESEARCH_RESULTS_READ_FAILED', 500)
    const threshold = enforceAnonymityThreshold(responses.data ?? [])
    enpsVisible = threshold.visible
    if (enpsVisible) {
      const mandatory = (questions.data ?? []).find((question) => question.is_mandatory)
      const scores = mandatory ? (answers.data ?? []).filter((answer) => answer.question_id === mandatory.id).map((answer) => Number(answer.answer_value)) : []
      enps = calculateEnps(scores)
      const categoryMap = new Map<string, { values: number[]; maximum: number }>()
      for (const question of questions.data ?? []) {
        if (question.is_mandatory || question.question_type === 'OPEN_TEXT' || question.question_type === 'YES_NO') continue
        const values = (answers.data ?? []).filter((answer) => answer.question_id === question.id).map((answer) => Number(answer.answer_value)).filter(Number.isFinite)
        const maximum = question.question_type === 'LIKERT_4' ? 4 : question.question_type === 'LIKERT_5' ? 5 : 10
        const category = categoryMap.get(question.category_name)
        categoryMap.set(question.category_name, { values: [...(category?.values ?? []), ...values], maximum: Math.max(category?.maximum ?? 0, maximum) })
      }
      driverScores = [...categoryMap.entries()].filter(([, result]) => result.values.length > 0).map(([category, result]) => ({ category, average: result.values.reduce((sum, value) => sum + value, 0) / result.values.length, responseCount: result.values.length, maximum: result.maximum })).sort((left, right) => (right.average / right.maximum) - (left.average / left.maximum))
      enpsQuestionResults = (questions.data ?? []).filter((question) => !question.is_mandatory && question.question_type !== 'OPEN_TEXT').map((question) => {
        const answerValues = (answers.data ?? []).filter((answer) => answer.question_id === question.id).map((answer) => answer.answer_value)
        const numericValues = answerValues.map(Number).filter(Number.isFinite)
        const maximum = question.question_type === 'LIKERT_4' ? 4 : question.question_type === 'LIKERT_5' ? 5 : question.question_type === 'SCALE_10' ? 10 : null
        const labels = question.question_type === 'YES_NO'
          ? ['YES', 'NO']
          : Array.from({ length: (maximum ?? 0) + (question.question_type === 'SCALE_10' ? 1 : 0) }, (_, index) => String(question.question_type === 'SCALE_10' ? index : index + 1))
        return {
          questionId: question.id,
          text: question.question_text,
          category: question.category_name,
          type: question.question_type,
          totalAnswers: answerValues.length,
          average: maximum !== null && numericValues.length ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length : null,
          maximum,
          distribution: labels.map((label) => {
            const count = answerValues.filter((value) => value === label).length
            return { label, count, percentage: answerValues.length ? Math.round((count / answerValues.length) * 100) : 0 }
          }),
        }
      })
      comments = (questions.data ?? []).filter((question) => question.question_type === 'OPEN_TEXT').flatMap((question) => (answers.data ?? []).filter((answer) => answer.question_id === question.id && answer.answer_value.trim()).map((answer) => ({ question: question.question_text, value: answer.answer_value.trim() })))
    }
  }
  return {
    campaign: campaignSummary(kind, campaign.data, true, participants.length, submitted),
    participants,
    canReadResults,
    surveyResults: [],
    enps,
    enpsVisible,
    driverScores,
    enpsQuestionResults,
    comments,
  }
}

function csvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value)
  return /[";,\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function answerDisplay(answer: SurveyAnswerRow, optionById: Map<string, string>): string {
  return answer.option_id ? optionById.get(answer.option_id) ?? '' : answer.answer_text ?? ''
}

export async function exportSurveyCsv(id: string): Promise<{ filename: string; csv: string }> {
  await requirePermission('research-result:read')
  const detail = await getResearchMonitorDetail('survey', id)
  const context = await requirePermission('research-result:read')
  const research = asResearchClient(await createClient())
  const [campaign, questions, rows, options, responses, answers] = await Promise.all([
    research.from('surveys').select('*').eq('id', id).eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).single(),
    research.from('survey_questions').select('*').eq('survey_id', id).order('order_index').limit(100),
    research.from('survey_matrix_rows').select('*').eq('survey_id', id).order('order_index').limit(3000),
    research.from('survey_question_options').select('*').eq('survey_id', id).limit(2000),
    research.from('survey_responses').select('*').eq('survey_id', id).order('submitted_at').limit(10000),
    research.from('survey_answers').select('*').eq('survey_id', id).limit(50000),
  ])
  if (campaign.error || questions.error || rows.error || options.error || responses.error || answers.error) throw new ResearchError('RESEARCH_EXPORT_FAILED', 500)
  const optionById = new Map((options.data ?? []).map((option) => [option.id, option.option_label]))
  const employeeById = new Map(detail.participants.map((participant) => [participant.employeeId, participant]))
  type ExportColumn = { key: string; label: string; questionId: string; rowId: string | null }
  const columns = (questions.data ?? []).flatMap<ExportColumn>((question) => {
    const matrixRows = (rows.data ?? []).filter((row) => row.question_id === question.id)
    return matrixRows.length > 0
      ? matrixRows.map((row) => ({ key: `${question.id}:${row.id}`, label: `${question.question_text} — ${row.row_label}`, questionId: question.id, rowId: row.id }))
      : [{ key: question.id, label: question.question_text, questionId: question.id, rowId: null }]
  })
  const identityHeaders = campaign.data.is_anonymous ? [] : ['Medewerkersnummer', 'Naam', 'Afdeling', 'Functie']
  const header = ['Respons_ID', 'Datum', ...identityHeaders, ...columns.map((column) => column.label)]
  const lines = [header.map(csvCell).join(';')]
  for (const response of responses.data ?? []) {
    const participant = response.respondent_employee_id ? employeeById.get(response.respondent_employee_id) : undefined
    const identity = campaign.data.is_anonymous ? [] : [participant?.employeeNumber ?? '', participant?.name ?? '', participant?.department ?? '', participant?.jobTitle ?? '']
    const values = columns.map((column) => (answers.data ?? []).filter((answer) => answer.response_id === response.id && answer.question_id === column.questionId && answer.matrix_row_id === column.rowId).map((answer) => answerDisplay(answer, optionById)).join(', '))
    lines.push([response.id, response.submitted_at, ...identity, ...values].map(csvCell).join(';'))
  }
  const safeName = campaign.data.title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'survey'
  return { filename: `${safeName}.csv`, csv: `\uFEFF${lines.join('\r\n')}` }
}
