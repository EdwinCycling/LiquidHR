import type { Database, Json } from '@scope/db'
import type { SupabaseClient } from '@supabase/supabase-js'

type TableDefinition<Row, Insert = Row, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type PayrollImportDecisionRow = {
  id: string
  tenant_id: string
  hr_group_id: string
  administration_id: string
  batch_id: string
  import_person_id: string
  decision_version: number
  decision_payload: Json
  decision_hash: string
  source_hash: string
  analysis_hash: string
  core_state_hash: string
  contract_version: string | null
  schema_version: string | null
  confirmer_user_id: string
  confirmed_at: string
  created_at: string
}

export type PayrollImportFinalizationActionRow = {
  id: string
  tenant_id: string
  hr_group_id: string
  administration_id: string
  batch_id: string
  plan_id: string
  import_person_id: string
  decision_id: string
  sequence_no: number
  action_id: string
  idempotency_key: string
  source_person_ref: string
  source_income_ref: string | null
  target_employee_id: string | null
  target_employee_ref: string | null
  target_employment_id: string | null
  target_employment_ref: string | null
  target_income_relationship_id: string | null
  action_type: string
  source_payroll_tax_number: string | null
  source_ikv_number: number | null
  source_starts_on: string | null
  source_ends_on: string | null
  source_refs: Json
  preconditions: Json
  plan_hash: string
  decision_hash: string
  source_hash: string
  analysis_hash: string
  core_state_hash: string
  contract_version: string | null
  schema_version: string | null
  status: string
  attempt_count: number
  lease_until: string | null
  last_attempt_at: string | null
  completed_at: string | null
  last_error_code: string | null
  checkpoint: Json
  created_at: string
  updated_at: string
}

export type PayrollImportFinalizationPlanRow = {
  id: string
  tenant_id: string
  hr_group_id: string
  administration_id: string
  batch_id: string
  plan_hash: string
  source_hash: string
  analysis_hash: string
  core_state_hash: string
  contract_version: string | null
  schema_version: string | null
  expected_action_count: number
  completed_action_count: number
  status: string
  created_by_user_id: string
  invalidated_by_user_id: string | null
  invalidation_reason: string | null
  invalidated_at: string | null
  created_at: string
  updated_at: string
}

export type PayrollImportFinalizationPlanEventRow = {
  id: string
  tenant_id: string
  hr_group_id: string
  administration_id: string
  batch_id: string
  plan_id: string
  event_key: string
  event_type: string
  actor_user_id: string
  reason: string
  source_hash: string
  analysis_hash: string
  core_state_hash: string
  created_at: string
}

export type PayrollImportFinalizationActionEventRow = {
  id: string
  tenant_id: string
  hr_group_id: string
  batch_id: string
  action_id: string
  event_key: string
  event_type: string
  actor_user_id: string
  attempt_number: number
  checkpoint: Json
  error_code: string | null
  lease_until: string | null
  source_hash: string
  analysis_hash: string
  core_state_hash: string
  created_at: string
}

export type FinalizationEventRpcArgs = {
  requested_tenant_id: string
  requested_hr_group_id: string
  requested_batch_id: string
  requested_action_id: string
  requested_event_key: string
  requested_event_type: string
  requested_actor_user_id: string
  requested_attempt_number: number
  requested_source_hash: string
  requested_analysis_hash: string
  requested_core_state_hash: string
  requested_checkpoint?: Json
  requested_error_code?: string | null
  requested_lease_until?: string | null
}

export type FinalizationEventRpcResult = {
  action_id: string
  status: string
  attempt_count: number
  event_id: string
}

export type FinalizationPlanInvalidationRpcArgs = {
  requested_tenant_id: string
  requested_hr_group_id: string
  requested_batch_id: string
  requested_plan_hash: string
  requested_actor_user_id: string
  requested_reason: string
}

export type FinalizationPlanInvalidationRpcResult = {
  plan_id: string
  status: string
}

type FinalizationTables = Database['public']['Tables'] & {
  payroll_import_decisions: TableDefinition<PayrollImportDecisionRow, Partial<PayrollImportDecisionRow>, Partial<PayrollImportDecisionRow>>
  payroll_import_finalization_plans: TableDefinition<PayrollImportFinalizationPlanRow, Partial<PayrollImportFinalizationPlanRow>, Partial<PayrollImportFinalizationPlanRow>>
  payroll_import_finalization_plan_events: TableDefinition<PayrollImportFinalizationPlanEventRow, Partial<PayrollImportFinalizationPlanEventRow>, Partial<PayrollImportFinalizationPlanEventRow>>
  payroll_import_finalization_actions: TableDefinition<PayrollImportFinalizationActionRow, Partial<PayrollImportFinalizationActionRow>, Partial<PayrollImportFinalizationActionRow>>
  payroll_import_finalization_action_events: TableDefinition<PayrollImportFinalizationActionEventRow, Partial<PayrollImportFinalizationActionEventRow>, Partial<PayrollImportFinalizationActionEventRow>>
}

export type Control02FinalizationDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: FinalizationTables
    Functions: Database['public']['Functions'] & {
      record_payroll_import_finalization_event: {
        Args: FinalizationEventRpcArgs
        Returns: FinalizationEventRpcResult[]
      }
      invalidate_payroll_import_finalization_plan: {
        Args: FinalizationPlanInvalidationRpcArgs
        Returns: FinalizationPlanInvalidationRpcResult[]
      }
    }
  }
}

export type Control02FinalizationClient = SupabaseClient<Control02FinalizationDatabase>
