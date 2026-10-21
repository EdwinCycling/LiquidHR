import type { ArrangementSalaryStrategy } from './arrangement-foundation'
import type { PayrollCalendarPeriodicity } from './payroll-calendar'

export type PayrollJson =
  | string
  | number
  | boolean
  | null
  | { readonly [key: string]: PayrollJson | undefined }
  | readonly PayrollJson[]

export type PayrollAdministrationStatus = 'ACTIVE' | 'SUSPENDED'
export type PayrollPeriodStatus = 'DRAFT' | 'OPEN' | 'CLOSED'
export type PayrollCalendarStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED'
export type PayrollPeriodKind = 'REGULAR' | 'ADDITIONAL' | 'CORRECTION'
export type PayrollDeclarationPeriodStatus = 'DRAFT' | 'OPEN' | 'CLOSED'
export type PayrollCalculationRunType = 'PREVIEW' | 'RECALCULATION' | 'GOLDEN_CASE' | 'INDIVIDUAL_PAYROLL'
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
  /** New calendar fields are optional until the additive Payroll Lab migration is released. */
  calendar_id?: string | null
  period_number?: number | null
  periodicity?: PayrollCalendarPeriodicity | 'AD_HOC'
  period_kind?: PayrollPeriodKind
  period_version?: number
  planned_payment_date?: string | null
  processing_deadline?: string | null
  correction_of_period_id?: string | null
  supersedes_period_id?: string | null
  calendar_snapshot?: PayrollJson | null
  calendar_hash?: string | null
  starts_on: string
  ends_on: string
  status: PayrollPeriodStatus
  updated_at: string
  updated_by_user_id: string | null
}

/** Full stored shape. Non-monthly periods have no legacy month locator. */
export type PayrollPeriodRecordRow = Omit<PayrollPeriodRow, 'period_month'> & {
  period_month: number | null
}

export type PayrollCalendarPeriodListRow = {
  period_year: number
  period_month: number | null
  period_number: number | null
  periodicity: PayrollCalendarPeriodicity | 'AD_HOC'
  period_kind: PayrollPeriodKind
  starts_on: string
  ends_on: string
  planned_payment_date: string | null
  status: PayrollPeriodStatus
}

export type PayrollCalendarRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  processing_group_code: string | null
  calendar_code: string
  display_name: string
  periodicity: PayrollCalendarPeriodicity
  calendar_year: number
  version: number
  effective_from: string
  effective_to: string
  anchor_date: string | null
  year_assignment: 'PERIOD_START' | 'PERIOD_END' | null
  generation_rules: PayrollJson
  payment_date_rule: PayrollJson | null
  processing_deadline_rule: PayrollJson | null
  status: PayrollCalendarStatus
  updated_at: string
  updated_by_user_id: string | null
}

export type PayrollCalendarEventRow = {
  id: string
  payroll_calendar_id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  event_type: 'CREATED' | 'UPDATED' | 'ACTIVATED' | 'RETIRED'
  event_payload: PayrollJson
  actor_user_id: string | null
  created_at: string
}

export type PayrollDeclarationPeriodRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  tax_registration_reference: string
  filing_frequency: PayrollCalendarPeriodicity
  starts_on: string
  ends_on: string
  statutory_period_code: string
  filing_deadline: string | null
  payment_deadline: string | null
  status: PayrollDeclarationPeriodStatus
  updated_at: string
  updated_by_user_id: string | null
}

export type PayrollDeclarationPeriodPayrollPeriodRow = {
  declaration_period_id: string
  payroll_period_id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  created_at: string
  created_by_user_id: string | null
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

export type PayrollArrangementAvailabilityRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  package_id: string
  effective_from: string
  effective_to: string | null
  updated_at: string | null
  updated_by_user_id: string | null
}

export type PayrollArrangementAvailabilityHistoryRow = {
  id: string
  availability_id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  package_id: string
  previous_effective_from: string
  previous_effective_to: string | null
  new_effective_from: string
  new_effective_to: string | null
  changed_at: string
  changed_by_user_id: string
  change_kind: 'START_EXTENDED' | 'END_SHORTENED' | 'START_EXTENDED_AND_END_SHORTENED'
}

export type PayrollArrangementAssignmentRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  source_employment_id: string
  fixture_code: string
  package_id: string
  salary_strategy: ArrangementSalaryStrategy
  effective_from: string
  effective_to: string | null
  is_primary: true
}

export type PayrollArrangementCompositionSnapshotRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  source_employment_id: string
  assignment_id: string
  as_of_date: string
  snapshot_json: PayrollJson
  snapshot_hash: string
}

export type PayrollIndividualArrangementAssignmentVersionRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  assignment_id: string
  assignment_version: number
  source_employment_id: string
  effective_from: string
  effective_to: string | null
  assignment_json: PayrollJson
  assignment_hash: string
  provenance_status: 'TEST_ONLY' | 'PAYROLL_OWNED'
  provenance_source: string
}

export type PayrollIndividualCalculationConfigVersionRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  source_employment_id: string
  config_version: number
  effective_from: string
  effective_to: string | null
  config_json: PayrollJson
  config_hash: string
  provenance_status: 'TEST_ONLY' | 'PAYROLL_OWNED'
  provenance_source: string
}

export type PayrollIndividualArrangementCompositionSnapshotRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  assignment_version_id: string
  source_employment_id: string
  as_of_date: string
  snapshot_json: PayrollJson
  snapshot_hash: string
}

export type PayrollOpeningCumulativeSnapshotRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  source_employment_id: string
  snapshot_version: number
  as_of_date: string
  opening_balance_json: PayrollJson
  snapshot_hash: string
  provenance_status: 'TEST_OPENING_BALANCE' | 'RECONSTRUCTED_PAYROLL' | 'CUSTOMER_OPENING_BALANCE'
  provenance_source: string
}

export type PayrollEmployerConfigurationVersionRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  configuration_version: number
  effective_from: string
  effective_to: string | null
  configuration_json: PayrollJson
  configuration_hash: string
  status: 'DRAFT' | 'ACTIVE'
  source_reference: string
}

export type IndividualPayrollInputReferenceRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  calculation_input_set_id: string
  source_employment_id: string
  assignment_version_id: string
  arrangement_snapshot_id: string
  config_version_id: string
  opening_cumulative_snapshot_id: string
  input_provenance_json: PayrollJson
}

export type GenericPayrollInputReferenceRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  calculation_input_set_id: string
  source_employee_id: string
  source_employment_id: string
  source_income_relationship_id: string
  employment_income_relationship_id: string
  tax_profile_id: string
  tax_profile_version: number
  core_source_contract_version: 'payroll-source-v4'
  core_validated_at: string
  source_version_vector: PayrollJson
  source_hash: string
  input_hash: string
  input_reference_json: PayrollJson
}

export type IndividualPayrollLifecycleEventRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  payroll_period_id: string
  source_employment_id: string
  calculation_run_id: string
  revision: number
  event_sequence: number
  event_type: 'BLOCKED' | 'CONCEPT' | 'REVIEWED' | 'FINALIZED'
  event_payload: PayrollJson
}

export type PayrollIndividualArtifactRow = AuditColumns & {
  id: string
  payroll_administration_id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  calculation_run_id: string
  artifact_type: 'PAYSLIP_PDF' | 'TECHNICAL_JSON'
  file_name: string
  content_type: string
  artifact_bytes: string
  artifact_hash: string
  provenance_json: PayrollJson
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
        PayrollPeriodRecordRow,
        Omit<PayrollPeriodRecordRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'created_by_user_id'> & {
          id?: string
          created_at?: string
          created_by_user_id?: string | null
          status?: PayrollPeriodStatus
          updated_at?: string
        },
        Partial<PayrollPeriodRecordRow>
      >
      payroll_calendars: PayrollTable<
        PayrollCalendarRow,
        Omit<PayrollCalendarRow, 'id' | 'created_at' | 'updated_at' | 'created_by_user_id' | 'status' | 'version' | 'processing_group_code' | 'anchor_date' | 'year_assignment' | 'payment_date_rule' | 'processing_deadline_rule'> & {
          id?: string
          created_at?: string
          created_by_user_id?: string | null
          updated_at?: string
          status?: PayrollCalendarStatus
          version?: number
          processing_group_code?: string | null
          anchor_date?: string | null
          year_assignment?: PayrollCalendarRow['year_assignment']
          payment_date_rule?: PayrollJson | null
          processing_deadline_rule?: PayrollJson | null
        },
        Partial<PayrollCalendarRow>
      >
      payroll_calendar_events: PayrollTable<
        PayrollCalendarEventRow,
        Omit<PayrollCalendarEventRow, 'id' | 'created_at' | 'event_payload' | 'actor_user_id'> & {
          id?: string
          created_at?: string
          event_payload?: PayrollJson
          actor_user_id?: string | null
        },
        never
      >
      payroll_declaration_periods: PayrollTable<
        PayrollDeclarationPeriodRow,
        Omit<PayrollDeclarationPeriodRow, 'id' | 'created_at' | 'created_by_user_id' | 'updated_at' | 'updated_by_user_id' | 'status' | 'filing_deadline' | 'payment_deadline'> & {
          id?: string
          created_at?: string
          created_by_user_id?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          status?: PayrollDeclarationPeriodStatus
          filing_deadline?: string | null
          payment_deadline?: string | null
        },
        Partial<PayrollDeclarationPeriodRow>
      >
      payroll_declaration_period_payroll_periods: PayrollTable<
        PayrollDeclarationPeriodPayrollPeriodRow,
        Omit<PayrollDeclarationPeriodPayrollPeriodRow, 'created_at' | 'created_by_user_id'> & {
          created_at?: string
          created_by_user_id?: string | null
        },
        never
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
      payroll_arrangement_availability: PayrollTable<
        PayrollArrangementAvailabilityRow,
        Omit<PayrollArrangementAvailabilityRow, 'id' | 'created_at' | 'updated_at' | 'updated_by_user_id'> & {
          id?: string
          created_at?: string
          updated_at?: string | null
          updated_by_user_id?: string | null
        },
        Partial<PayrollArrangementAvailabilityRow>
      >
      payroll_arrangement_availability_history: PayrollTable<
        PayrollArrangementAvailabilityHistoryRow,
        Omit<PayrollArrangementAvailabilityHistoryRow, 'id'> & { id?: string },
        never
      >
      payroll_arrangement_assignments: PayrollTable<
        PayrollArrangementAssignmentRow,
        Omit<PayrollArrangementAssignmentRow, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        },
        never
      >
      payroll_arrangement_composition_snapshots: PayrollTable<
        PayrollArrangementCompositionSnapshotRow,
        Omit<PayrollArrangementCompositionSnapshotRow, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        },
        never
      >
      payroll_individual_arrangement_assignment_versions: PayrollTable<
        PayrollIndividualArrangementAssignmentVersionRow,
        Omit<PayrollIndividualArrangementAssignmentVersionRow, 'id' | 'created_at'> & { id?: string; created_at?: string },
        never
      >
      payroll_individual_calculation_config_versions: PayrollTable<
        PayrollIndividualCalculationConfigVersionRow,
        Omit<PayrollIndividualCalculationConfigVersionRow, 'id' | 'created_at'> & { id?: string; created_at?: string },
        never
      >
      payroll_individual_arrangement_composition_snapshots: PayrollTable<
        PayrollIndividualArrangementCompositionSnapshotRow,
        Omit<PayrollIndividualArrangementCompositionSnapshotRow, 'id' | 'created_at'> & { id?: string; created_at?: string },
        never
      >
      payroll_opening_cumulative_snapshots: PayrollTable<
        PayrollOpeningCumulativeSnapshotRow,
        Omit<PayrollOpeningCumulativeSnapshotRow, 'id' | 'created_at'> & { id?: string; created_at?: string },
        never
      >
      payroll_employer_configuration_versions: PayrollTable<
        PayrollEmployerConfigurationVersionRow,
        Omit<PayrollEmployerConfigurationVersionRow, 'id' | 'created_at'> & { id?: string; created_at?: string },
        never
      >
      individual_payroll_input_references: PayrollTable<
        IndividualPayrollInputReferenceRow,
        Omit<IndividualPayrollInputReferenceRow, 'id' | 'created_at'> & { id?: string; created_at?: string },
        never
      >
      generic_payroll_input_references: PayrollTable<
        GenericPayrollInputReferenceRow,
        Omit<GenericPayrollInputReferenceRow, 'id' | 'created_at'> & { id?: string; created_at?: string },
        never
      >
      individual_payroll_lifecycle_events: PayrollTable<
        IndividualPayrollLifecycleEventRow,
        Omit<IndividualPayrollLifecycleEventRow, 'id' | 'created_at'> & { id?: string; created_at?: string },
        never
      >
      payroll_individual_artifacts: PayrollTable<
        PayrollIndividualArtifactRow,
        Omit<PayrollIndividualArtifactRow, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        },
        never
      >
    }
    Views: { [_ in never]: never }
    Functions: {
      payrun01_mark_succeeded_with_concept: {
        Args: {
          p_payroll_administration_id: string
          p_source_tenant_id: string
          p_source_hr_group_id: string
          p_source_administration_id: string
          p_calculation_run_id: string
          p_payroll_period_id: string
          p_source_employment_id: string
          p_actor_user_id: string
          p_finished_at: string
          p_result_hash: string
          p_event_payload: PayrollJson
        }
        Returns: PayrollCalculationRunRow[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
