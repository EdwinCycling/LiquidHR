import type { Database, Json } from '@scope/db'
import type { SupabaseClient } from '@supabase/supabase-js'

type TableDefinition<Row, Insert = Row, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

type PayrollImportBatchRow = {
  id: string
  tenant_id: string
  hr_group_id: string
  administration_id: string
  // Alleen voor historische readback; nieuwe requests accepteren uitsluitend INTERNAL_REPRESENTATIVE.
  source_type: 'LOONAANGIFTE_XML' | 'INTERNAL_REPRESENTATIVE'
  source_filename: string
  source_hash: string
  tax_year: number
  period_start: string | null
  period_end: string | null
  payroll_tax_number: string | null
  status: string
  idempotency_key: string
  created_by_user_id: string
  preview_confirmed_at: string | null
  finalized_at: string | null
  source_deleted_at: string | null
  created_at: string
  updated_at: string
}

type PayrollImportPersonRow = {
  id: string
  tenant_id: string
  hr_group_id: string
  batch_id: string
  source_row_number: number
  external_employee_number: string | null
  bsn_fingerprint: string | null
  initials: string | null
  prefix: string | null
  first_name: string | null
  birth_name: string | null
  birth_date: string | null
  gender: string | null
  nationality: string | null
  address: Json | null
  status: string
  match_status: string
  matched_employee_id: string | null
  validation_codes: Json
  source_metadata: Json
  created_at: string
  updated_at: string
}

type PayrollImportIncomeRelationshipRow = {
  id: string
  tenant_id: string
  hr_group_id: string
  batch_id: string
  import_person_id: string
  administration_id: string
  payroll_tax_number: string
  ikv_number: number
  income_code: string | null
  employment_relation_code: string | null
  cao_code: string | null
  flags: Json
  hours_per_week: number | null
  salary_amount: number | null
  starts_on: string | null
  ends_on: string | null
  status: string
  matched_income_relationship_id: string | null
  validation_codes: Json
  source_metadata: Json
  created_at: string
  updated_at: string
}

type PayrollImportTables = Database['public']['Tables'] & {
  administration_payroll_tax_numbers: TableDefinition<{
    id: string
    tenant_id: string
    hr_group_id: string
    administration_id: string
    payroll_tax_number: string
    is_primary: boolean
    valid_from: string
    valid_until: string | null
    created_by_user_id: string | null
    created_at: string
    updated_at: string
  }, Partial<{
    id: string
    tenant_id: string
    hr_group_id: string
    administration_id: string
    payroll_tax_number: string
    is_primary: boolean
    valid_from: string
    valid_until: string | null
    created_by_user_id: string | null
    created_at: string
    updated_at: string
  }>, Partial<{
    id: string
    tenant_id: string
    hr_group_id: string
    administration_id: string
    payroll_tax_number: string
    is_primary: boolean
    valid_from: string
    valid_until: string | null
    created_by_user_id: string | null
    created_at: string
    updated_at: string
  }>>
  payroll_import_batches: TableDefinition<PayrollImportBatchRow, Partial<PayrollImportBatchRow>, Partial<PayrollImportBatchRow>>
  payroll_import_persons: TableDefinition<PayrollImportPersonRow, Partial<PayrollImportPersonRow>, Partial<PayrollImportPersonRow>>
  payroll_import_income_relationships: TableDefinition<PayrollImportIncomeRelationshipRow, Partial<PayrollImportIncomeRelationshipRow>, Partial<PayrollImportIncomeRelationshipRow>>
}

export type PayrollImportDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Functions'> & {
    Tables: PayrollImportTables
    Functions: Database['public']['Functions'] & {
      match_payroll_import_employee_bsn_fingerprint: {
        Args: {
          requested_bsn_fingerprint: string
          requested_hr_group_id: string
          requested_tenant_id: string
        }
        Returns: { employee_id: string }[]
      }
    }
  }
}

export type PayrollImportClient = SupabaseClient<PayrollImportDatabase>
