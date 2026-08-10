import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database as BaseDatabase } from '@scope/db'

type TableDefinition<Row, Insert, Update = Partial<Insert>> = {
  Row: Row & Record<string, unknown>
  Insert: Insert & Record<string, unknown>
  Update: Update & Record<string, unknown>
  Relationships: []
}

type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED'
type TargetMode = 'ALL' | 'DEPARTMENTS' | 'LOCATIONS' | 'ENTITIES' | 'EMPLOYEES'

export interface SurveyRow {
  id: string
  tenant_id: string
  hr_group_id: string
  title: string
  description: string
  starts_at: string
  ends_at: string
  is_anonymous: boolean
  status: CampaignStatus
  target_mode: TargetMode
  target_ids: string[]
  created_by: string
  activated_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface SurveyQuestionRow {
  id: string
  tenant_id: string
  hr_group_id: string
  survey_id: string
  question_text: string
  question_type: string
  is_required: boolean
  order_index: number
  created_at: string
  updated_at: string
}

export interface SurveyOptionRow {
  id: string
  tenant_id: string
  hr_group_id: string
  survey_id: string
  question_id: string
  option_label: string
  order_index: number
}

export interface SurveyMatrixRow {
  id: string
  tenant_id: string
  hr_group_id: string
  survey_id: string
  question_id: string
  row_label: string
  is_required: boolean
  order_index: number
}

export interface SurveyInvitationRow {
  id: string
  tenant_id: string
  hr_group_id: string
  survey_id: string
  employee_id: string
  has_submitted: boolean
  submitted_at: string | null
  reminder_count: number
  last_reminded_at: string | null
  created_at: string
}

export interface SurveyResponseRow {
  id: string
  tenant_id: string
  hr_group_id: string
  survey_id: string
  respondent_employee_id: string | null
  submitted_at: string
}

export interface SurveyAnswerRow {
  id: string
  tenant_id: string
  hr_group_id: string
  survey_id: string
  response_id: string
  question_id: string
  matrix_row_id: string | null
  option_id: string | null
  answer_text: string | null
}

export interface EnpsCategoryRow { id: string; tenant_id: string | null; hr_group_id: string | null; name: string; order_index: number; is_system: boolean }
export interface EnpsBankQuestionRow {
  id: string
  tenant_id: string | null
  hr_group_id: string | null
  category_id: string
  question_number: number | null
  question_text: string
  default_type: string
  is_mandatory_enps: boolean
  is_system: boolean
}

export interface EnpsCampaignRow {
  id: string
  tenant_id: string
  hr_group_id: string
  title: string
  starts_at: string
  ends_at: string
  scale_type: string
  status: CampaignStatus
  target_mode: TargetMode
  target_ids: string[]
  reminder_interval_days: number
  created_by: string
  activated_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface EnpsQuestionRow {
  id: string
  tenant_id: string
  hr_group_id: string
  campaign_id: string
  bank_question_id: string | null
  category_name: string
  question_text: string
  question_type: string
  is_mandatory: boolean
  is_enabled: boolean
  order_index: number
}

export interface EnpsInvitationRow {
  id: string
  tenant_id: string
  hr_group_id: string
  campaign_id: string
  employee_id: string
  has_submitted: boolean
  reminder_count: number
  last_reminded_at: string | null
  created_at: string
}

export interface EnpsResponseRow {
  id: string
  tenant_id: string
  hr_group_id: string
  campaign_id: string
  submitted_at: string
}

export interface EnpsAnswerRow {
  id: string
  tenant_id: string
  hr_group_id: string
  campaign_id: string
  response_id: string
  question_id: string
  answer_value: string
}

export type ResearchDatabase = Omit<BaseDatabase, 'public'> & {
  public: Omit<BaseDatabase['public'], 'Tables' | 'Functions'> & {
    Tables: BaseDatabase['public']['Tables'] & {
      surveys: TableDefinition<SurveyRow, Omit<SurveyRow, 'id' | 'activated_at' | 'closed_at' | 'created_at' | 'updated_at'> & Partial<Pick<SurveyRow, 'id' | 'activated_at' | 'closed_at' | 'created_at' | 'updated_at'>>>
      survey_questions: TableDefinition<SurveyQuestionRow, Omit<SurveyQuestionRow, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<SurveyQuestionRow, 'id' | 'created_at' | 'updated_at'>>>
      survey_question_options: TableDefinition<SurveyOptionRow, Omit<SurveyOptionRow, 'id'> & Partial<Pick<SurveyOptionRow, 'id'>>>
      survey_matrix_rows: TableDefinition<SurveyMatrixRow, Omit<SurveyMatrixRow, 'id'> & Partial<Pick<SurveyMatrixRow, 'id'>>>
      survey_invitations: TableDefinition<SurveyInvitationRow, Pick<SurveyInvitationRow, 'tenant_id' | 'hr_group_id' | 'survey_id' | 'employee_id'> & Partial<Omit<SurveyInvitationRow, 'tenant_id' | 'hr_group_id' | 'survey_id' | 'employee_id'>>>
      survey_responses: TableDefinition<SurveyResponseRow, Omit<SurveyResponseRow, 'id' | 'submitted_at'> & Partial<Pick<SurveyResponseRow, 'id' | 'submitted_at'>>>
      survey_answers: TableDefinition<SurveyAnswerRow, Omit<SurveyAnswerRow, 'id'> & Partial<Pick<SurveyAnswerRow, 'id'>>>
      enps_question_bank_categories: TableDefinition<EnpsCategoryRow, Omit<EnpsCategoryRow, 'id' | 'is_system'> & Partial<Pick<EnpsCategoryRow, 'id' | 'is_system'>>>
      enps_question_bank: TableDefinition<EnpsBankQuestionRow, Omit<EnpsBankQuestionRow, 'id' | 'is_system'> & Partial<Pick<EnpsBankQuestionRow, 'id' | 'is_system'>>>
      enps_campaigns: TableDefinition<EnpsCampaignRow, Omit<EnpsCampaignRow, 'id' | 'activated_at' | 'closed_at' | 'created_at' | 'updated_at'> & Partial<Pick<EnpsCampaignRow, 'id' | 'activated_at' | 'closed_at' | 'created_at' | 'updated_at'>>>
      enps_questions: TableDefinition<EnpsQuestionRow, Omit<EnpsQuestionRow, 'id'> & Partial<Pick<EnpsQuestionRow, 'id'>>>
      enps_invitations: TableDefinition<EnpsInvitationRow, Pick<EnpsInvitationRow, 'tenant_id' | 'hr_group_id' | 'campaign_id' | 'employee_id'> & Partial<Omit<EnpsInvitationRow, 'tenant_id' | 'hr_group_id' | 'campaign_id' | 'employee_id'>>>
      enps_responses: TableDefinition<EnpsResponseRow, Omit<EnpsResponseRow, 'id' | 'submitted_at'> & Partial<Pick<EnpsResponseRow, 'id' | 'submitted_at'>>>
      enps_answers: TableDefinition<EnpsAnswerRow, Omit<EnpsAnswerRow, 'id'> & Partial<Pick<EnpsAnswerRow, 'id'>>>
    }
    Functions: BaseDatabase['public']['Functions'] & {
      submit_survey_response: { Args: { p_invitation_id: string; p_answers: unknown }; Returns: string }
      submit_enps_response: { Args: { p_invitation_id: string; p_answers: unknown }; Returns: string }
    }
  }
}

export type ResearchClient = SupabaseClient<ResearchDatabase>

export function asResearchClient(client: unknown): ResearchClient {
  return client as ResearchClient
}
