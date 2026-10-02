export type PayrollJson =
  | string
  | number
  | boolean
  | null
  | { readonly [key: string]: PayrollJson | undefined }
  | readonly PayrollJson[]

export type PayrollAdministrationStatus = 'ACTIVE' | 'SUSPENDED'
export type PayrollPeriodStatus = 'DRAFT' | 'OPEN' | 'CLOSED'
export type PayrollCalculationRunType = 'PREVIEW' | 'RECALCULATION' | 'GOLDEN_CASE'
export type PayrollCalculationRunStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
export type PayrollControlStatus = 'PASS' | 'WARN' | 'FAIL'

type AuditColumns = {
  created_at: string
  created_by_user_id: string | null
}

export type PayrollAdministrationRow = AuditColumns & {
  id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  display_name: string
  capability_enabled: boolean
  status: PayrollAdministrationStatus
  updated_at: string
  updated_by_user_id: string | null
}

export type PayrollPeriodRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  period_year: number
  period_month: number
  starts_on: string
  ends_on: string
  status: PayrollPeriodStatus
  updated_at: string
  updated_by_user_id: string | null
}

export type PayrollSourceSnapshotRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  source_employee_id: string
  source_employment_id: string
  source_income_relationship_id: string | null
  period_reference: string
  source_payload: PayrollJson
  source_version_vector: PayrollJson
  source_hash: string
}

export type PayrollCalculationInputSetRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  source_snapshot_id: string
  payroll_period_id: string
  rule_package_composition_id: string
  engine_version: string
  input_hash: string
}

export type PayrollCalculationRunRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  calculation_input_set_id: string
  run_type: PayrollCalculationRunType
  status: PayrollCalculationRunStatus
  started_at: string | null
  finished_at: string | null
  result_hash: string | null
  updated_at: string
  updated_by_user_id: string | null
}

export type PayrollComponentResultRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  calculation_run_id: string
  component_key: string
  amount: number | null
  result_payload: PayrollJson
  updated_at: string
  updated_by_user_id: string | null
}

export type PayrollCalculationTraceRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  calculation_run_id: string
  trace_payload: PayrollJson
}

export type PayrollControlRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  calculation_run_id: string
  control_key: string
  status: PayrollControlStatus
  detail_payload: PayrollJson
  updated_at: string
  updated_by_user_id: string | null
}

export type PayrollGoldenCaseRunRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  calculation_run_id: string
  case_key: string
  expected_result_hash: string | null
}

export type PayrollCustomerComponentOwnership = 'CUSTOMER_FORK' | 'CUSTOMER_CUSTOM'

export type PayrollCustomerComponentVersionRow = {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  component_id: string
  component_code: string
  component_version: string
  status: 'DRAFT'
  ownership: PayrollCustomerComponentOwnership
  effective_from: string
  effective_to: string | null
  origin_component_id: string | null
  origin_component_code: string | null
  origin_component_version: string | null
  origin_composition_id: string | null
  origin_package_id: string | null
  origin_package_version: string | null
  origin_package_hash: string | null
  forked_at: string | null
  catalog_metadata_json: PayrollJson
  definition_json: PayrollJson
  definition_hash: string
  created_at: string
  created_by_user_id: string
}

type PayrollTable<Row, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export interface PayrollDatabase {
  __InternalSupabase: { PostgrestVersion: '14.5' }
  public: {
    Tables: {
      payroll_administrations: PayrollTable<
        PayrollAdministrationRow,
        Omit<PayrollAdministrationRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
      >
      payroll_periods: PayrollTable<
        PayrollPeriodRow,
        Omit<PayrollPeriodRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'created_by_user_id'> & {
          id?: string
          created_at?: string
          created_by_user_id?: string | null
          status?: PayrollPeriodStatus
          updated_at?: string
        },
        Partial<PayrollPeriodRow>
      >
      source_snapshots: PayrollTable<
        PayrollSourceSnapshotRow,
        Omit<PayrollSourceSnapshotRow, 'id' | 'created_at' | 'created_by_user_id'> & {
          id?: string
          created_at?: string
          created_by_user_id?: string | null
        },
        Partial<PayrollSourceSnapshotRow>
      >
      calculation_input_sets: PayrollTable<
        PayrollCalculationInputSetRow,
        Omit<PayrollCalculationInputSetRow, 'id' | 'created_at' | 'created_by_user_id'> & {
          id?: string
          created_at?: string
          created_by_user_id?: string | null
        },
        Partial<PayrollCalculationInputSetRow>
      >
      calculation_runs: PayrollTable<
        PayrollCalculationRunRow,
        Omit<PayrollCalculationRunRow, 'id' | 'created_at' | 'status' | 'started_at' | 'finished_at' | 'result_hash' | 'updated_at' | 'updated_by_user_id' | 'created_by_user_id'> & {
          id?: string
          created_at?: string
          created_by_user_id?: string | null
          status?: PayrollCalculationRunStatus
          started_at?: string | null
          finished_at?: string | null
          result_hash?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
        },
        Partial<Pick<PayrollCalculationRunRow, 'status' | 'started_at' | 'finished_at' | 'result_hash' | 'updated_at' | 'updated_by_user_id'>>
      >
      component_results: PayrollTable<
        PayrollComponentResultRow,
        Omit<PayrollComponentResultRow, 'id' | 'created_at' | 'created_by_user_id' | 'amount' | 'result_payload' | 'updated_at' | 'updated_by_user_id'> & {
          id?: string
          amount: string | number | null
          created_at?: string
          created_by_user_id?: string | null
          result_payload?: PayrollJson
          updated_at?: string
          updated_by_user_id?: string | null
        },
        Partial<PayrollComponentResultRow>
      >
      calculation_traces: PayrollTable<
        PayrollCalculationTraceRow,
        Omit<PayrollCalculationTraceRow, 'id' | 'created_at' | 'created_by_user_id'> & {
          id?: string
          created_at?: string
          created_by_user_id?: string | null
        },
        Partial<PayrollCalculationTraceRow>
      >
      payroll_controls: PayrollTable<
        PayrollControlRow,
        Omit<PayrollControlRow, 'id' | 'created_at' | 'created_by_user_id' | 'detail_payload' | 'updated_at' | 'updated_by_user_id'> & {
          id?: string
          created_at?: string
          created_by_user_id?: string | null
          detail_payload?: PayrollJson
          updated_at?: string
          updated_by_user_id?: string | null
        },
        Partial<PayrollControlRow>
      >
      golden_case_runs: PayrollTable<
        PayrollGoldenCaseRunRow,
        Omit<PayrollGoldenCaseRunRow, 'id' | 'created_at' | 'created_by_user_id' | 'expected_result_hash'> & {
          id?: string
          created_at?: string
          created_by_user_id?: string | null
          expected_result_hash?: string | null
        },
        Partial<PayrollGoldenCaseRunRow>
      >
      customer_component_versions: PayrollTable<
        PayrollCustomerComponentVersionRow,
        Omit<PayrollCustomerComponentVersionRow, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        },
        never
      >
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
