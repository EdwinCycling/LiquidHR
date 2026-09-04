export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      absence_capacity_changes: {
        Row: {
          absence_hours_per_week: number | null
          absence_percentage: number
          case_id: string
          created_at: string
          created_by_user_id: string | null
          effective_on: string
          expected_next_review_on: string | null
          hr_group_id: string
          id: string
          input_mode: string | null
          scheduled_hours_per_week_snapshot: number | null
          spell_id: string
          tenant_id: string
        }
        Insert: {
          absence_hours_per_week?: number | null
          absence_percentage: number
          case_id: string
          created_at?: string
          created_by_user_id?: string | null
          effective_on: string
          expected_next_review_on?: string | null
          hr_group_id: string
          id?: string
          input_mode?: string | null
          scheduled_hours_per_week_snapshot?: number | null
          spell_id: string
          tenant_id: string
        }
        Update: {
          absence_hours_per_week?: number | null
          absence_percentage?: number
          case_id?: string
          created_at?: string
          created_by_user_id?: string | null
          effective_on?: string
          expected_next_review_on?: string | null
          hr_group_id?: string
          id?: string
          input_mode?: string | null
          scheduled_hours_per_week_snapshot?: number | null
          spell_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_capacity_case_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "case_id"]
            isOneToOne: false
            referencedRelation: "absence_cases"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "absence_capacity_case_spell_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "case_id", "spell_id"]
            isOneToOne: false
            referencedRelation: "absence_spells"
            referencedColumns: ["tenant_id", "hr_group_id", "case_id", "id"]
          },
          {
            foreignKeyName: "absence_capacity_changes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "absence_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_capacity_changes_case_tenant_fkey"
            columns: ["tenant_id", "case_id"]
            isOneToOne: false
            referencedRelation: "absence_cases"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_capacity_changes_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_capacity_changes_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "absence_spells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_capacity_changes_spell_tenant_fkey"
            columns: ["tenant_id", "spell_id"]
            isOneToOne: false
            referencedRelation: "absence_spells"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_capacity_changes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_capacity_spell_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "spell_id"]
            isOneToOne: false
            referencedRelation: "absence_spells"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      absence_cases: {
        Row: {
          administration_id: string
          archived_at: string | null
          case_manager_employee_id: string | null
          closed_at: string | null
          created_at: string
          created_by_user_id: string | null
          effective_clock_start_on: string
          employee_id: string
          employment_id: string
          first_absence_on: string
          frequent_absence_threshold: number
          has_sickness_benefit_safety_net: boolean | null
          hr_group_id: string
          id: string
          is_frequent_absence: boolean
          is_third_party_traffic_accident: boolean | null
          is_work_accident: boolean | null
          prior_case_count_12_months: number
          recovery_window_ends_on: string | null
          status: Database["public"]["Enums"]["absence_case_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          archived_at?: string | null
          case_manager_employee_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          effective_clock_start_on: string
          employee_id: string
          employment_id: string
          first_absence_on: string
          frequent_absence_threshold?: number
          has_sickness_benefit_safety_net?: boolean | null
          hr_group_id: string
          id?: string
          is_frequent_absence?: boolean
          is_third_party_traffic_accident?: boolean | null
          is_work_accident?: boolean | null
          prior_case_count_12_months?: number
          recovery_window_ends_on?: string | null
          status?: Database["public"]["Enums"]["absence_case_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          archived_at?: string | null
          case_manager_employee_id?: string | null
          closed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          effective_clock_start_on?: string
          employee_id?: string
          employment_id?: string
          first_absence_on?: string
          frequent_absence_threshold?: number
          has_sickness_benefit_safety_net?: boolean | null
          hr_group_id?: string
          id?: string
          is_frequent_absence?: boolean
          is_third_party_traffic_accident?: boolean | null
          is_work_accident?: boolean | null
          prior_case_count_12_months?: number
          recovery_window_ends_on?: string | null
          status?: Database["public"]["Enums"]["absence_case_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_cases_administration_scope_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_cases_employee_scope_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_cases_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "absence_cases_employment_scope_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "absence_cases_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_cases_manager_scope_fkey"
            columns: ["tenant_id", "case_manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_cases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      absence_mutations: {
        Row: {
          created_at: string
          hr_group_id: string
          id: string
          operation_key: string
          operation_type: string
          result_case_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          id?: string
          operation_key: string
          operation_type: string
          result_case_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          id?: string
          operation_key?: string
          operation_type?: string
          result_case_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_mutations_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_mutations_result_case_id_fkey"
            columns: ["result_case_id"]
            isOneToOne: false
            referencedRelation: "absence_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_mutations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      absence_settings: {
        Row: {
          administration_id: string | null
          created_at: string
          default_case_manager_employee_id: string | null
          employee_self_report_enabled: boolean
          frequent_absence_threshold: number
          hr_group_id: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          default_case_manager_employee_id?: string | null
          employee_self_report_enabled?: boolean
          frequent_absence_threshold?: number
          hr_group_id: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          default_case_manager_employee_id?: string | null
          employee_self_report_enabled?: boolean
          frequent_absence_threshold?: number
          hr_group_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_settings_default_manager_fkey"
            columns: ["tenant_id", "default_case_manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_settings_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      absence_spells: {
        Row: {
          case_id: string
          created_at: string
          employment_id: string
          expected_recovery_on: string | null
          hr_group_id: string
          id: string
          recovered_at: string | null
          recovered_by_user_id: string | null
          recovered_on: string | null
          reported_at: string
          reported_by_user_id: string | null
          started_on: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          employment_id: string
          expected_recovery_on?: string | null
          hr_group_id: string
          id?: string
          recovered_at?: string | null
          recovered_by_user_id?: string | null
          recovered_on?: string | null
          reported_at?: string
          reported_by_user_id?: string | null
          started_on: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          employment_id?: string
          expected_recovery_on?: string | null
          hr_group_id?: string
          id?: string
          recovered_at?: string | null
          recovered_by_user_id?: string | null
          recovered_on?: string | null
          reported_at?: string
          reported_by_user_id?: string | null
          started_on?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_spells_case_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "case_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "absence_cases"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "id",
              "employment_id",
            ]
          },
          {
            foreignKeyName: "absence_spells_case_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "case_id"]
            isOneToOne: false
            referencedRelation: "absence_cases"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "absence_spells_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "absence_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_spells_case_tenant_fkey"
            columns: ["tenant_id", "case_id"]
            isOneToOne: false
            referencedRelation: "absence_cases"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_spells_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_spells_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      absence_task_templates: {
        Row: {
          administration_id: string
          code: string
          created_at: string
          created_by_user_id: string | null
          description: string | null
          due_after_effective_days: number
          evidence_category: string | null
          evidence_required: boolean
          hr_group_id: string
          id: string
          is_active: boolean
          is_system: boolean
          source: string
          source_version: string | null
          tenant_id: string
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          administration_id: string
          code: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          due_after_effective_days: number
          evidence_category?: string | null
          evidence_required?: boolean
          hr_group_id: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          source?: string
          source_version?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          administration_id?: string
          code?: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          due_after_effective_days?: number
          evidence_category?: string | null
          evidence_required?: boolean
          hr_group_id?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          source?: string
          source_version?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absence_task_templates_administration_id_fkey"
            columns: ["administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_task_templates_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "absence_task_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      administration_branding: {
        Row: {
          accent_color: string
          administration_id: string | null
          created_at: string
          hr_group_id: string
          logo_storage_path: string | null
          primary_color: string
          sidebar_color: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accent_color?: string
          administration_id?: string | null
          created_at?: string
          hr_group_id: string
          logo_storage_path?: string | null
          primary_color?: string
          sidebar_color?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accent_color?: string
          administration_id?: string | null
          created_at?: string
          hr_group_id?: string
          logo_storage_path?: string | null
          primary_color?: string
          sidebar_color?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "administration_branding_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: true
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      administration_company_data: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country_code: string
          created_at: string
          created_by_user_id: string | null
          house_number: string | null
          house_number_addition: string | null
          hr_group_id: string
          id: string
          postal_code: string | null
          region: string | null
          single_location: boolean
          source: string
          source_reference: string | null
          street: string | null
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          created_by_user_id?: string | null
          house_number?: string | null
          house_number_addition?: string | null
          hr_group_id: string
          id?: string
          postal_code?: string | null
          region?: string | null
          single_location?: boolean
          source?: string
          source_reference?: string | null
          street?: string | null
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          created_by_user_id?: string | null
          house_number?: string | null
          house_number_addition?: string | null
          hr_group_id?: string
          id?: string
          postal_code?: string | null
          region?: string | null
          single_location?: boolean
          source?: string
          source_reference?: string | null
          street?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "administration_company_data_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: true
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      administration_hr_settings: {
        Row: {
          administration_id: string
          created_at: string
          default_employment_country_code: string
          employee_directory_enabled: boolean
          employee_directory_show_job_department: boolean
          employee_directory_show_name: boolean
          employee_directory_show_presence: boolean
          employee_directory_show_schedule: boolean
          employee_directory_show_work_email: boolean
          employee_directory_show_work_phone: boolean
          id: string
          salary_routes: Database["public"]["Enums"]["salary_application_route"][]
          salary_structure_ids: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          created_at?: string
          default_employment_country_code?: string
          employee_directory_enabled?: boolean
          employee_directory_show_job_department?: boolean
          employee_directory_show_name?: boolean
          employee_directory_show_presence?: boolean
          employee_directory_show_schedule?: boolean
          employee_directory_show_work_email?: boolean
          employee_directory_show_work_phone?: boolean
          id?: string
          salary_routes?: Database["public"]["Enums"]["salary_application_route"][]
          salary_structure_ids?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          created_at?: string
          default_employment_country_code?: string
          employee_directory_enabled?: boolean
          employee_directory_show_job_department?: boolean
          employee_directory_show_name?: boolean
          employee_directory_show_presence?: boolean
          employee_directory_show_schedule?: boolean
          employee_directory_show_work_email?: boolean
          employee_directory_show_work_phone?: boolean
          id?: string
          salary_routes?: Database["public"]["Enums"]["salary_application_route"][]
          salary_structure_ids?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "administration_hr_settings_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: true
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "administration_hr_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      administration_locations: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country_code: string
          created_at: string
          created_by_user_id: string | null
          house_number: string | null
          house_number_addition: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          name: string
          postal_code: string | null
          region: string | null
          source: string
          source_reference: string | null
          street: string | null
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          created_by_user_id?: string | null
          house_number?: string | null
          house_number_addition?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          name: string
          postal_code?: string | null
          region?: string | null
          source?: string
          source_reference?: string | null
          street?: string | null
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string
          created_at?: string
          created_by_user_id?: string | null
          house_number?: string | null
          house_number_addition?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          postal_code?: string | null
          region?: string | null
          source?: string
          source_reference?: string | null
          street?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "administration_locations_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      administrations: {
        Row: {
          administration_number: string
          coc_number: string | null
          code: string
          created_at: string
          hr_group_id: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          tenant_id: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          administration_number: string
          coc_number?: string | null
          code: string
          created_at?: string
          hr_group_id: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          administration_number?: string
          coc_number?: string | null
          code?: string
          created_at?: string
          hr_group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "administrations_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "administrations_parent_same_tenant_fkey"
            columns: ["tenant_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "administrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_action_drafts: {
        Row: {
          action_type: string
          confirmed_at: string | null
          control_payload: Json
          conversation_id: string
          created_at: string
          executed_at: string | null
          expires_at: string
          failure_code: string | null
          id: string
          idempotency_key: string
          owner_user_id: string
          payload: Json
          status: Database["public"]["Enums"]["ai_draft_status"]
          summary: string
          tenant_id: string
          tool_name: string
          updated_at: string
          version: number
        }
        Insert: {
          action_type?: string
          confirmed_at?: string | null
          control_payload?: Json
          conversation_id: string
          created_at?: string
          executed_at?: string | null
          expires_at: string
          failure_code?: string | null
          id?: string
          idempotency_key?: string
          owner_user_id: string
          payload?: Json
          status?: Database["public"]["Enums"]["ai_draft_status"]
          summary: string
          tenant_id: string
          tool_name: string
          updated_at?: string
          version?: number
        }
        Update: {
          action_type?: string
          confirmed_at?: string | null
          control_payload?: Json
          conversation_id?: string
          created_at?: string
          executed_at?: string | null
          expires_at?: string
          failure_code?: string | null
          id?: string
          idempotency_key?: string
          owner_user_id?: string
          payload?: Json
          status?: Database["public"]["Enums"]["ai_draft_status"]
          summary?: string
          tenant_id?: string
          tool_name?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_action_drafts_conversation_same_tenant_fkey"
            columns: ["tenant_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          administration_id: string | null
          created_at: string
          id: string
          origin_channel: string
          owner_user_id: string
          summary: string | null
          summary_cursor_at: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          id?: string
          origin_channel?: string
          owner_user_id: string
          summary?: string | null
          summary_cursor_at?: string | null
          tenant_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          id?: string
          origin_channel?: string
          owner_user_id?: string
          summary?: string | null
          summary_cursor_at?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_administration_same_tenant_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "ai_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memory_items: {
        Row: {
          category: Database["public"]["Enums"]["ai_memory_category"]
          consented_at: string
          content: string
          created_at: string
          id: string
          owner_user_id: string
          source_conversation_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["ai_memory_category"]
          consented_at?: string
          content: string
          created_at?: string
          id?: string
          owner_user_id: string
          source_conversation_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["ai_memory_category"]
          consented_at?: string
          content?: string
          created_at?: string
          id?: string
          owner_user_id?: string
          source_conversation_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memory_items_source_conversation_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_memory_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          external_message_id: string | null
          id: string
          metadata: Json
          model_id: string | null
          origin_channel: string
          owner_user_id: string
          role: Database["public"]["Enums"]["ai_message_role"]
          tenant_id: string
          visible_tool_name: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          metadata?: Json
          model_id?: string | null
          origin_channel?: string
          owner_user_id: string
          role: Database["public"]["Enums"]["ai_message_role"]
          tenant_id: string
          visible_tool_name?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          metadata?: Json
          model_id?: string | null
          origin_channel?: string
          owner_user_id?: string
          role?: Database["public"]["Enums"]["ai_message_role"]
          tenant_id?: string
          visible_tool_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_same_tenant_fkey"
            columns: ["tenant_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      ai_user_preferences: {
        Row: {
          created_at: string
          detail_level: string
          id: string
          owner_user_id: string
          seniority_level: string
          tenant_id: string
          tone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail_level?: string
          id?: string
          owner_user_id: string
          seniority_level?: string
          tenant_id: string
          tone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail_level?: string
          id?: string
          owner_user_id?: string
          seniority_level?: string
          tenant_id?: string
          tone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_user_preferences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_invocations: {
        Row: {
          actor_employee_id: string | null
          actor_user_id: string
          administration_id: string | null
          business_object_id: string
          business_object_type: string
          business_permission_code: string | null
          charged_credits: number
          config_version: string
          correlation_id: string
          created_at: string
          execution_status: string
          failure_code: string | null
          feature_code: string
          feedback_outcome: string | null
          finished_at: string | null
          hr_group_id: string
          id: string
          idempotency_key: string
          latency_ms: number | null
          model_family: string | null
          prompt_template_version: string
          provider_code: string | null
          provider_input_units: number | null
          provider_output_units: number | null
          provider_request_id: string | null
          quality_profile: string | null
          reasoning_profile: string | null
          request_fingerprint: string
          reserved_credits: number
          result_status: string
          started_at: string | null
          tenant_id: string
          updated_at: string
          writing_style: string | null
        }
        Insert: {
          actor_employee_id?: string | null
          actor_user_id: string
          administration_id?: string | null
          business_object_id: string
          business_object_type: string
          business_permission_code?: string | null
          charged_credits?: number
          config_version: string
          correlation_id: string
          created_at?: string
          execution_status?: string
          failure_code?: string | null
          feature_code: string
          feedback_outcome?: string | null
          finished_at?: string | null
          hr_group_id: string
          id?: string
          idempotency_key: string
          latency_ms?: number | null
          model_family?: string | null
          prompt_template_version: string
          provider_code?: string | null
          provider_input_units?: number | null
          provider_output_units?: number | null
          provider_request_id?: string | null
          quality_profile?: string | null
          reasoning_profile?: string | null
          request_fingerprint: string
          reserved_credits?: number
          result_status?: string
          started_at?: string | null
          tenant_id: string
          updated_at?: string
          writing_style?: string | null
        }
        Update: {
          actor_employee_id?: string | null
          actor_user_id?: string
          administration_id?: string | null
          business_object_id?: string
          business_object_type?: string
          business_permission_code?: string | null
          charged_credits?: number
          config_version?: string
          correlation_id?: string
          created_at?: string
          execution_status?: string
          failure_code?: string | null
          feature_code?: string
          feedback_outcome?: string | null
          finished_at?: string | null
          hr_group_id?: string
          id?: string
          idempotency_key?: string
          latency_ms?: number | null
          model_family?: string | null
          prompt_template_version?: string
          provider_code?: string | null
          provider_input_units?: number | null
          provider_output_units?: number | null
          provider_request_id?: string | null
          quality_profile?: string | null
          reasoning_profile?: string | null
          request_fingerprint?: string
          reserved_credits?: number
          result_status?: string
          started_at?: string | null
          tenant_id?: string
          updated_at?: string
          writing_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_invocations_actor_employee_same_tenant_fkey"
            columns: ["tenant_id", "actor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "ai_invocations_administration_fkey"
            columns: ["tenant_id", "hr_group_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "ai_invocations_tenant_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "ai_invocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_execution_leases: {
        Row: {
          actor_user_id: string
          completed_at: string | null
          environment: string
          expires_at: string
          hr_group_id: string
          id: string
          invocation_id: string
          reserved_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          actor_user_id: string
          completed_at?: string | null
          environment: string
          expires_at: string
          hr_group_id: string
          id?: string
          invocation_id: string
          reserved_at: string
          status?: string
          tenant_id: string
        }
        Update: {
          actor_user_id?: string
          completed_at?: string | null
          environment?: string
          expires_at?: string
          hr_group_id?: string
          id?: string
          invocation_id?: string
          reserved_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_provider_execution_leases_environment_fkey"
            columns: ["environment"]
            isOneToOne: false
            referencedRelation: "ai_provider_safety_environments"
            referencedColumns: ["environment"]
          },
          {
            foreignKeyName: "ai_provider_execution_leases_invocation_scope_fkey"
            columns: ["tenant_id", "hr_group_id", "invocation_id"]
            isOneToOne: false
            referencedRelation: "ai_invocations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "ai_provider_execution_leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_safety_environments: {
        Row: {
          created_at: string
          environment: string
        }
        Insert: {
          created_at?: string
          environment: string
        }
        Update: {
          created_at?: string
          environment?: string
        }
        Relationships: []
      }
      ai_technical_usage: {
        Row: {
          actor_user_id: string
          config_version: string
          correlation_id: string
          feature_code: string
          hr_group_id: string
          id: string
          invocation_id: string
          latency_ms: number
          model_family: string | null
          outcome: string
          prompt_template_version: string
          provider_code: string | null
          provider_input_units: number | null
          provider_output_units: number | null
          provider_request_id: string | null
          quality_profile: string
          reasoning_profile: string | null
          recorded_at: string
          tenant_id: string
        }
        Insert: {
          actor_user_id: string
          config_version: string
          correlation_id: string
          feature_code: string
          hr_group_id: string
          id?: string
          invocation_id: string
          latency_ms: number
          model_family?: string | null
          outcome: string
          prompt_template_version: string
          provider_code?: string | null
          provider_input_units?: number | null
          provider_output_units?: number | null
          provider_request_id?: string | null
          quality_profile: string
          reasoning_profile?: string | null
          recorded_at?: string
          tenant_id: string
        }
        Update: {
          actor_user_id?: string
          config_version?: string
          correlation_id?: string
          feature_code?: string
          hr_group_id?: string
          id?: string
          invocation_id?: string
          latency_ms?: number
          model_family?: string | null
          outcome?: string
          prompt_template_version?: string
          provider_code?: string | null
          provider_input_units?: number | null
          provider_output_units?: number | null
          provider_request_id?: string | null
          quality_profile?: string
          reasoning_profile?: string | null
          recorded_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_technical_usage_invocation_id_fkey"
            columns: ["invocation_id"]
            isOneToOne: true
            referencedRelation: "ai_invocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_technical_usage_invocation_scope_fkey"
            columns: ["tenant_id", "hr_group_id", "invocation_id"]
            isOneToOne: false
            referencedRelation: "ai_invocations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "ai_technical_usage_tenant_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "ai_technical_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_business_audit: {
        Row: {
          action: string
          actor_employee_id: string | null
          actor_user_id: string
          administration_id: string | null
          business_object_id: string
          business_object_type: string
          charged_credits: number
          config_version: string
          correlation_id: string
          failure_code: string | null
          feature_code: string
          hr_group_id: string
          id: string
          invocation_id: string
          prompt_template_version: string
          quality_profile: string | null
          recorded_at: string
          reserved_credits: number
          status: string
          tenant_id: string
          writing_style: string | null
        }
        Insert: {
          action: string
          actor_employee_id?: string | null
          actor_user_id: string
          administration_id?: string | null
          business_object_id: string
          business_object_type: string
          charged_credits?: number
          config_version: string
          correlation_id: string
          failure_code?: string | null
          feature_code: string
          hr_group_id: string
          id?: string
          invocation_id: string
          prompt_template_version: string
          quality_profile?: string | null
          recorded_at?: string
          reserved_credits?: number
          status: string
          tenant_id: string
          writing_style?: string | null
        }
        Update: {
          action?: string
          actor_employee_id?: string | null
          actor_user_id?: string
          administration_id?: string | null
          business_object_id?: string
          business_object_type?: string
          charged_credits?: number
          config_version?: string
          correlation_id?: string
          failure_code?: string | null
          feature_code?: string
          hr_group_id?: string
          id?: string
          invocation_id?: string
          prompt_template_version?: string
          quality_profile?: string | null
          recorded_at?: string
          reserved_credits?: number
          status?: string
          tenant_id?: string
          writing_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_business_audit_actor_employee_same_tenant_fkey"
            columns: ["tenant_id", "actor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "ai_business_audit_administration_fkey"
            columns: ["tenant_id", "hr_group_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "ai_business_audit_invocation_id_fkey"
            columns: ["invocation_id"]
            isOneToOne: true
            referencedRelation: "ai_invocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_business_audit_invocation_scope_fkey"
            columns: ["tenant_id", "hr_group_id", "invocation_id"]
            isOneToOne: false
            referencedRelation: "ai_invocations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "ai_business_audit_tenant_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "ai_business_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_credit_actor_usage: {
        Row: {
          actor_user_id: string
          created_at: string
          hr_group_id: string
          period_month: string
          released_credits: number
          reserved_credits: number
          settled_credits: number
          tenant_id: string
          updated_at: string
          used_credits: number | null
        }
        Insert: {
          actor_user_id: string
          created_at?: string
          hr_group_id: string
          period_month: string
          released_credits?: number
          reserved_credits?: number
          settled_credits?: number
          tenant_id: string
          updated_at?: string
          used_credits?: number | null
        }
        Update: {
          actor_user_id?: string
          created_at?: string
          hr_group_id?: string
          period_month?: string
          released_credits?: number
          reserved_credits?: number
          settled_credits?: number
          tenant_id?: string
          updated_at?: string
          used_credits?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_actor_usage_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      ai_credit_allocations: {
        Row: {
          allocation_type: string
          available_credits: number | null
          created_at: string
          created_by_user_id: string | null
          credit_amount: number
          expired_credits: number
          expires_at: string | null
          granted_at: string
          hr_group_id: string
          id: string
          period_month: string | null
          period_timezone: string
          released_credits: number
          reserved_credits: number
          settled_credits: number
          source: string
          source_reference: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allocation_type: string
          available_credits?: number | null
          created_at?: string
          created_by_user_id?: string | null
          credit_amount: number
          expired_credits?: number
          expires_at?: string | null
          granted_at?: string
          hr_group_id: string
          id?: string
          period_month?: string | null
          period_timezone: string
          released_credits?: number
          reserved_credits?: number
          settled_credits?: number
          source: string
          source_reference: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allocation_type?: string
          available_credits?: number | null
          created_at?: string
          created_by_user_id?: string | null
          credit_amount?: number
          expired_credits?: number
          expires_at?: string | null
          granted_at?: string
          hr_group_id?: string
          id?: string
          period_month?: string | null
          period_timezone?: string
          released_credits?: number
          reserved_credits?: number
          settled_credits?: number
          source?: string
          source_reference?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_allocations_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      ai_credit_charge_catalog: {
        Row: {
          charge_reference: string
          config_version: string
          created_at: string
          credit_amount: number
          feature_code: string
          is_active: boolean
          quality_profile: string
          updated_at: string
        }
        Insert: {
          charge_reference: string
          config_version: string
          created_at?: string
          credit_amount: number
          feature_code: string
          is_active?: boolean
          quality_profile: string
          updated_at?: string
        }
        Update: {
          charge_reference?: string
          config_version?: string
          created_at?: string
          credit_amount?: number
          feature_code?: string
          is_active?: boolean
          quality_profile?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_credit_group_policies: {
        Row: {
          created_at: string
          hr_group_id: string
          is_active: boolean
          monthly_allowance_credits: number
          tenant_id: string
          time_zone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          is_active?: boolean
          monthly_allowance_credits: number
          tenant_id: string
          time_zone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          is_active?: boolean
          monthly_allowance_credits?: number
          tenant_id?: string
          time_zone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_group_policies_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: true
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      ai_credit_reservation_allocations: {
        Row: {
          allocated_credits: number
          allocation_id: string
          created_at: string
          hr_group_id: string
          id: string
          released_credits: number
          reservation_id: string
          reserved_credits: number
          settled_credits: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allocated_credits: number
          allocation_id: string
          created_at?: string
          hr_group_id: string
          id?: string
          released_credits?: number
          reservation_id: string
          reserved_credits: number
          settled_credits?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allocated_credits?: number
          allocation_id?: string
          created_at?: string
          hr_group_id?: string
          id?: string
          released_credits?: number
          reservation_id?: string
          reserved_credits?: number
          settled_credits?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_reservation_allocations_allocation_scope_fkey"
            columns: ["tenant_id", "hr_group_id", "allocation_id"]
            isOneToOne: false
            referencedRelation: "ai_credit_allocations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "ai_credit_reservation_allocations_reservation_scope_fkey"
            columns: ["tenant_id", "hr_group_id", "reservation_id"]
            isOneToOne: false
            referencedRelation: "ai_credit_reservations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      ai_credit_reservations: {
        Row: {
          actor_user_id: string
          charge_reference: string
          created_at: string
          feature_code: string
          hr_group_id: string
          id: string
          idempotency_key: string
          invocation_id: string
          period_month: string
          release_reason: string | null
          released_at: string | null
          released_credits: number
          reserved_at: string
          reserved_credits: number
          settled_at: string | null
          settled_credits: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actor_user_id: string
          charge_reference: string
          created_at?: string
          feature_code: string
          hr_group_id: string
          id?: string
          idempotency_key: string
          invocation_id: string
          period_month: string
          release_reason?: string | null
          released_at?: string | null
          released_credits?: number
          reserved_at?: string
          reserved_credits: number
          settled_at?: string | null
          settled_credits?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string
          charge_reference?: string
          created_at?: string
          feature_code?: string
          hr_group_id?: string
          id?: string
          idempotency_key?: string
          invocation_id?: string
          period_month?: string
          release_reason?: string | null
          released_at?: string | null
          released_credits?: number
          reserved_at?: string
          reserved_credits?: number
          settled_at?: string | null
          settled_credits?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_credit_reservations_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "ai_credit_reservations_invocation_scope_fkey"
            columns: ["tenant_id", "hr_group_id", "invocation_id"]
            isOneToOne: true
            referencedRelation: "ai_invocations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      ai_credit_role_quotas: {
        Row: {
          created_at: string
          is_active: boolean
          monthly_quota_credits: number
          quality_profile: string
          role_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          monthly_quota_credits: number
          quality_profile: string
          role_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          monthly_quota_credits?: number
          quality_profile?: string
          role_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          administration_id: string | null
          change_set_id: string | null
          changes: Json
          correlation_id: string | null
          created_at: string
          employment_id: string | null
          entity_id: string
          entity_name: string
          id: string
          subject_employee_id: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          administration_id?: string | null
          change_set_id?: string | null
          changes?: Json
          correlation_id?: string | null
          created_at?: string
          employment_id?: string | null
          entity_id: string
          entity_name: string
          id?: string
          subject_employee_id?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          administration_id?: string | null
          change_set_id?: string | null
          changes?: Json
          correlation_id?: string | null
          created_at?: string
          employment_id?: string | null
          entity_id?: string
          entity_name?: string
          id?: string
          subject_employee_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_administration_scope_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "audit_logs_change_set_id_fkey"
            columns: ["change_set_id"]
            isOneToOne: false
            referencedRelation: "employment_change_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      // Local compatibility type: this table exists in the application rollout but not in remote dev/test schema introspection.
      company_activities: {
        Row: {
          activity_date: string
          administration_id: string | null
          created_at: string
          created_by: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activity_date: string
          administration_id?: string | null
          created_at?: string
          created_by?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activity_date?: string
          administration_id?: string | null
          created_at?: string
          created_by?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_activities_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      company_documents: {
        Row: {
          administration_id: string | null
          checksum_sha256: string
          content_type: string
          created_at: string
          deleted_at: string | null
          file_size: number
          hr_group_id: string
          id: string
          original_filename: string
          storage_key: string
          tenant_id: string
          title: string
          updated_at: string
          uploaded_by_user_id: string
        }
        Insert: {
          administration_id?: string | null
          checksum_sha256: string
          content_type: string
          created_at?: string
          deleted_at?: string | null
          file_size: number
          hr_group_id: string
          id?: string
          original_filename: string
          storage_key: string
          tenant_id: string
          title: string
          updated_at?: string
          uploaded_by_user_id: string
        }
        Update: {
          administration_id?: string | null
          checksum_sha256?: string
          content_type?: string
          created_at?: string
          deleted_at?: string | null
          file_size?: number
          hr_group_id?: string
          id?: string
          original_filename?: string
          storage_key?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          uploaded_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "company_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      continuous_appraisal_attachments: {
        Row: {
          checksum_sha256: string
          content_type: string
          created_at: string
          file_size: number
          id: string
          item_id: string
          original_filename: string
          storage_key: string
          tenant_id: string
          uploaded_by_employee_id: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          checksum_sha256: string
          content_type: string
          created_at?: string
          file_size: number
          id?: string
          item_id: string
          original_filename: string
          storage_key: string
          tenant_id: string
          uploaded_by_employee_id: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          checksum_sha256?: string
          content_type?: string
          created_at?: string
          file_size?: number
          id?: string
          item_id?: string
          original_filename?: string
          storage_key?: string
          tenant_id?: string
          uploaded_by_employee_id?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "continuous_appraisal_attachme_tenant_id_uploaded_by_employ_fkey"
            columns: ["tenant_id", "uploaded_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "continuous_appraisal_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuous_appraisal_attachments_tenant_id_item_id_fkey"
            columns: ["tenant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "continuous_appraisal_items"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      continuous_appraisal_item_comments: {
        Row: {
          author_avatar_url: string | null
          author_employee_id: string
          author_label: string
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          item_id: string
          tenant_id: string
        }
        Insert: {
          author_avatar_url?: string | null
          author_employee_id: string
          author_label: string
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          item_id: string
          tenant_id: string
        }
        Update: {
          author_avatar_url?: string | null
          author_employee_id?: string
          author_label?: string
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          item_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "continuous_appraisal_item_com_tenant_id_author_employee_id_fkey"
            columns: ["tenant_id", "author_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "continuous_appraisal_item_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuous_appraisal_item_comments_tenant_id_item_id_fkey"
            columns: ["tenant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "continuous_appraisal_items"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      continuous_appraisal_items: {
        Row: {
          body: string
          created_at: string
          created_by_avatar_url: string | null
          created_by_employee_id: string
          created_by_label: string
          created_by_user_id: string | null
          due_on: string | null
          employee_id: string
          feedback_direction: string | null
          goal_kind: string | null
          id: string
          item_status: string
          item_type: string
          manager_employee_id: string | null
          next_meeting_on: string | null
          occurred_on: string
          owner_employee_id: string | null
          owner_label: string | null
          priority: string | null
          tenant_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body: string
          created_at?: string
          created_by_avatar_url?: string | null
          created_by_employee_id: string
          created_by_label: string
          created_by_user_id?: string | null
          due_on?: string | null
          employee_id: string
          feedback_direction?: string | null
          goal_kind?: string | null
          id?: string
          item_status?: string
          item_type: string
          manager_employee_id?: string | null
          next_meeting_on?: string | null
          occurred_on: string
          owner_employee_id?: string | null
          owner_label?: string | null
          priority?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          created_at?: string
          created_by_avatar_url?: string | null
          created_by_employee_id?: string
          created_by_label?: string
          created_by_user_id?: string | null
          due_on?: string | null
          employee_id?: string
          feedback_direction?: string | null
          goal_kind?: string | null
          id?: string
          item_status?: string
          item_type?: string
          manager_employee_id?: string | null
          next_meeting_on?: string | null
          occurred_on?: string
          owner_employee_id?: string | null
          owner_label?: string | null
          priority?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "continuous_appraisal_items_tenant_id_created_by_employee_i_fkey"
            columns: ["tenant_id", "created_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "continuous_appraisal_items_tenant_id_employee_id_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "continuous_appraisal_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "continuous_appraisal_items_tenant_id_manager_employee_id_fkey"
            columns: ["tenant_id", "manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "continuous_appraisal_items_tenant_id_owner_employee_id_fkey"
            columns: ["tenant_id", "owner_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      cost_carriers: {
        Row: {
          administration_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_carriers_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "cost_carriers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          administration_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "cost_centers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_counters: {
        Row: {
          administration_id: string | null
          definition_id: string
          hr_group_id: string
          next_value: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id?: string | null
          definition_id: string
          hr_group_id: string
          next_value?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string | null
          definition_id?: string
          hr_group_id?: string
          next_value?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_counters_definition_group_fkey"
            columns: ["tenant_id", "hr_group_id", "definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "custom_field_counters_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: true
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          administration_id: string | null
          country_code: string
          created_at: string
          deleted_at: string | null
          description_en: string | null
          description_nl: string | null
          employee_self_access: Database["public"]["Enums"]["custom_field_audience_access"]
          entity_type: Database["public"]["Enums"]["custom_field_entity_type"]
          field_type: Database["public"]["Enums"]["custom_field_type"]
          hr_access: Database["public"]["Enums"]["custom_field_audience_access"]
          hr_group_id: string
          id: string
          is_active: boolean
          is_required: boolean
          key: string
          label_en: string
          label_nl: string
          manager_access: Database["public"]["Enums"]["custom_field_audience_access"]
          show_in_organization_chart_filter: boolean
          sort_order: number
          tenant_id: string
          updated_at: string
          validation_rules: Json
        }
        Insert: {
          administration_id?: string | null
          country_code?: string
          created_at?: string
          deleted_at?: string | null
          description_en?: string | null
          description_nl?: string | null
          employee_self_access?: Database["public"]["Enums"]["custom_field_audience_access"]
          entity_type?: Database["public"]["Enums"]["custom_field_entity_type"]
          field_type: Database["public"]["Enums"]["custom_field_type"]
          hr_access?: Database["public"]["Enums"]["custom_field_audience_access"]
          hr_group_id: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          key: string
          label_en: string
          label_nl: string
          manager_access?: Database["public"]["Enums"]["custom_field_audience_access"]
          show_in_organization_chart_filter?: boolean
          sort_order?: number
          tenant_id: string
          updated_at?: string
          validation_rules?: Json
        }
        Update: {
          administration_id?: string | null
          country_code?: string
          created_at?: string
          deleted_at?: string | null
          description_en?: string | null
          description_nl?: string | null
          employee_self_access?: Database["public"]["Enums"]["custom_field_audience_access"]
          entity_type?: Database["public"]["Enums"]["custom_field_entity_type"]
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          hr_access?: Database["public"]["Enums"]["custom_field_audience_access"]
          hr_group_id?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          key?: string
          label_en?: string
          label_nl?: string
          manager_access?: Database["public"]["Enums"]["custom_field_audience_access"]
          show_in_organization_chart_filter?: boolean
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          validation_rules?: Json
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "custom_field_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_select_options: {
        Row: {
          administration_id: string | null
          created_at: string
          definition_id: string
          hr_group_id: string
          id: string
          is_active: boolean
          label_en: string
          label_nl: string
          sort_order: number
          tenant_id: string
          updated_at: string
          value: string
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          definition_id: string
          hr_group_id: string
          id?: string
          is_active?: boolean
          label_en: string
          label_nl: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          value: string
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          definition_id?: string
          hr_group_id?: string
          id?: string
          is_active?: boolean
          label_en?: string
          label_nl?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_select_options_definition_group_fkey"
            columns: ["tenant_id", "hr_group_id", "definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "custom_field_select_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widget_configs: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          tenant_id: string
          updated_at: string
          updated_by: string | null
          widget_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          widget_type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          widget_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widget_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widget_role_access: {
        Row: {
          created_at: string
          id: string
          management_role_id: string
          tenant_id: string
          updated_at: string
          widget_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          management_role_id: string
          tenant_id: string
          updated_at?: string
          widget_type: string
        }
        Update: {
          created_at?: string
          id?: string
          management_role_id?: string
          tenant_id?: string
          updated_at?: string
          widget_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widget_role_access_management_role_id_fkey"
            columns: ["management_role_id"]
            isOneToOne: false
            referencedRelation: "management_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_widget_role_access_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      department_management: {
        Row: {
          created_at: string
          department_id: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          hr_group_id: string
          id: string
          management_role_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id: string
          hr_group_id: string
          id?: string
          management_role_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          hr_group_id?: string
          id?: string
          management_role_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_management_department_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "department_management_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_management_employee_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "department_management_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_management_employee_same_tenant_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "department_management_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "department_management_management_role_id_fkey"
            columns: ["management_role_id"]
            isOneToOne: false
            referencedRelation: "management_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_management_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "departments_parent_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "departments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      document_audiences: {
        Row: {
          administration_id: string
          created_at: string
          document_id: string
          id: string
          target_department_id: string | null
          target_employee_id: string | null
          target_management_role_id: string | null
          target_type: Database["public"]["Enums"]["document_target_type"]
          tenant_id: string
        }
        Insert: {
          administration_id: string
          created_at?: string
          document_id: string
          id?: string
          target_department_id?: string | null
          target_employee_id?: string | null
          target_management_role_id?: string | null
          target_type: Database["public"]["Enums"]["document_target_type"]
          tenant_id: string
        }
        Update: {
          administration_id?: string
          created_at?: string
          document_id?: string
          id?: string
          target_department_id?: string | null
          target_employee_id?: string | null
          target_management_role_id?: string | null
          target_type?: Database["public"]["Enums"]["document_target_type"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_audiences_target_management_role_id_fkey"
            columns: ["target_management_role_id"]
            isOneToOne: false
            referencedRelation: "management_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_audiences_tenant_id_administration_id_document_id_fkey"
            columns: ["tenant_id", "administration_id", "document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "document_audiences_tenant_id_target_department_id_fkey"
            columns: ["tenant_id", "target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "document_audiences_tenant_id_target_employee_id_fkey"
            columns: ["tenant_id", "target_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      document_categories: {
        Row: {
          administration_id: string
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          requires_salary_permission: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          requires_salary_permission?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          requires_salary_permission?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_categories_tenant_id_administration_id_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      employee_activity_entries: {
        Row: {
          administration_id: string | null
          created_at: string
          created_by_user_id: string
          employee_id: string
          id: string
          message: string
          tenant_id: string
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          created_by_user_id: string
          employee_id: string
          id?: string
          message: string
          tenant_id: string
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          created_by_user_id?: string
          employee_id?: string
          id?: string
          message?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_activity_entries_administration_scope_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_activity_entries_employee_scope_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_activity_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_addresses: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          address_type: string
          city: string
          country_code: string
          created_at: string
          deleted_at: string | null
          description: string | null
          employee_id: string
          house_number: string | null
          house_number_addition: string | null
          id: string
          postal_code: string | null
          postal_code_normalized: string | null
          region: string | null
          source: string
          source_reference: string | null
          street: string | null
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          address_type?: string
          city: string
          country_code?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          employee_id: string
          house_number?: string | null
          house_number_addition?: string | null
          id?: string
          postal_code?: string | null
          postal_code_normalized?: string | null
          region?: string | null
          source?: string
          source_reference?: string | null
          street?: string | null
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          address_type?: string
          city?: string
          country_code?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          employee_id?: string
          house_number?: string | null
          house_number_addition?: string | null
          id?: string
          postal_code?: string | null
          postal_code_normalized?: string | null
          region?: string | null
          source?: string
          source_reference?: string | null
          street?: string | null
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_addresses_employee_scope_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_addresses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_administration_assignments: {
        Row: {
          administration_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          employee_id: string
          hr_group_id: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          employee_id: string
          hr_group_id: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          hr_group_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_administration_assignments_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_administration_assignments_employee_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_administration_assignments_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      employee_bank_accounts: {
        Row: {
          account_holder: string
          bic: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          employee_id: string
          iban_ciphertext: string
          iban_last_four: string
          id: string
          is_primary: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_holder: string
          bic?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          employee_id: string
          iban_ciphertext: string
          iban_last_four: string
          id?: string
          is_primary?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_holder?: string
          bic?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          employee_id?: string
          iban_ciphertext?: string
          iban_last_four?: string
          id?: string
          is_primary?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_bank_accounts_employee_scope_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_custom_field_values: {
        Row: {
          administration_id: string | null
          created_at: string
          definition_id: string
          employee_id: string
          field_key: string
          hr_group_id: string
          id: string
          tenant_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          definition_id: string
          employee_id: string
          field_key: string
          hr_group_id: string
          id?: string
          tenant_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          definition_id?: string
          employee_id?: string
          field_key?: string
          hr_group_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "employee_custom_field_values_definition_group_fkey"
            columns: ["tenant_id", "hr_group_id", "definition_id", "field_key"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["tenant_id", "hr_group_id", "id", "key"]
          },
          {
            foreignKeyName: "employee_custom_field_values_employee_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_custom_field_values_employee_scope_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_custom_field_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_document_acknowledgements: {
        Row: {
          acknowledged_at: string
          acknowledged_by_user_id: string
          administration_id: string
          created_at: string
          document_checksum_sha256: string
          document_id: string
          employee_id: string
          hr_group_id: string
          id: string
          process_instance_id: string
          tenant_id: string
          work_item_id: string
        }
        Insert: {
          acknowledged_at?: string
          acknowledged_by_user_id?: string
          administration_id: string
          created_at?: string
          document_checksum_sha256: string
          document_id: string
          employee_id: string
          hr_group_id: string
          id?: string
          process_instance_id: string
          tenant_id: string
          work_item_id: string
        }
        Update: {
          acknowledged_at?: string
          acknowledged_by_user_id?: string
          administration_id?: string
          created_at?: string
          document_checksum_sha256?: string
          document_id?: string
          employee_id?: string
          hr_group_id?: string
          id?: string
          process_instance_id?: string
          tenant_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_document_ack_administration_fkey"
            columns: ["tenant_id", "hr_group_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_document_ack_document_fkey"
            columns: ["tenant_id", "administration_id", "document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "employee_document_ack_employee_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_document_ack_instance_fkey"
            columns: ["tenant_id", "hr_group_id", "process_instance_id"]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_document_ack_scope_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_document_ack_work_item_fkey"
            columns: ["tenant_id", "hr_group_id", "work_item_id"]
            isOneToOne: false
            referencedRelation: "process_work_items"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          added_by_user_id: string
          administration_id: string
          category_id: string
          checksum_sha256: string
          content_type: string
          created_at: string
          custom_fields: Json
          delete_reason: string | null
          deleted_at: string | null
          deleted_by_user_id: string | null
          description: string | null
          employee_id: string
          expires_on: string | null
          expiry_reminder_id: string | null
          file_size: number
          id: string
          original_filename: string
          storage_key: string
          tags: string[]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          added_by_user_id?: string
          administration_id: string
          category_id: string
          checksum_sha256: string
          content_type: string
          created_at?: string
          custom_fields?: Json
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          description?: string | null
          employee_id: string
          expires_on?: string | null
          expiry_reminder_id?: string | null
          file_size: number
          id?: string
          original_filename: string
          storage_key: string
          tags?: string[]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          added_by_user_id?: string
          administration_id?: string
          category_id?: string
          checksum_sha256?: string
          content_type?: string
          created_at?: string
          custom_fields?: Json
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by_user_id?: string | null
          description?: string | null
          employee_id?: string
          expires_on?: string | null
          expiry_reminder_id?: string | null
          file_size?: number
          id?: string
          original_filename?: string
          storage_key?: string
          tags?: string[]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_expiry_reminder_fkey"
            columns: ["tenant_id", "expiry_reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_documents_tenant_id_administration_id_category_id_fkey"
            columns: ["tenant_id", "administration_id", "category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "employee_documents_tenant_id_administration_id_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_documents_tenant_id_employee_id_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      employee_notes: {
        Row: {
          administration_id: string
          created_at: string
          created_by_user_id: string
          description: string
          employee_id: string
          id: string
          tenant_id: string
          title: string
          updated_at: string
          updated_by_user_id: string
        }
        Insert: {
          administration_id: string
          created_at?: string
          created_by_user_id?: string
          description?: string
          employee_id: string
          id?: string
          tenant_id: string
          title: string
          updated_at?: string
          updated_by_user_id?: string
        }
        Update: {
          administration_id?: string
          created_at?: string
          created_by_user_id?: string
          description?: string
          employee_id?: string
          id?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          updated_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_notes_administration_id_fkey"
            columns: ["administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_notes_employee_scope_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_number_sequences: {
        Row: {
          next_value: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          next_value?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          next_value?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_number_sequences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_organizations: {
        Row: {
          administration_id: string
          cost_bearer: string | null
          created_at: string
          department_id: string
          direct_manager_deputy_id: string | null
          direct_manager_id: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          employment_id: string | null
          hr_group_id: string
          id: string
          job_id: string | null
          job_title: string | null
          location_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          cost_bearer?: string | null
          created_at?: string
          department_id: string
          direct_manager_deputy_id?: string | null
          direct_manager_id?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id: string
          employment_id?: string | null
          hr_group_id: string
          id?: string
          job_id?: string | null
          job_title?: string | null
          location_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          cost_bearer?: string | null
          created_at?: string
          department_id?: string
          direct_manager_deputy_id?: string | null
          direct_manager_id?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          employment_id?: string | null
          hr_group_id?: string
          id?: string
          job_id?: string | null
          job_title?: string | null
          location_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_organizations_administration_same_tenant_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_department_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_organizations_department_tenant_fkey"
            columns: ["tenant_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_deputy_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "direct_manager_deputy_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_deputy_same_tenant_fkey"
            columns: ["tenant_id", "direct_manager_deputy_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_direct_manager_deputy_id_fkey"
            columns: ["direct_manager_deputy_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_organizations_employee_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_organizations_employee_same_tenant_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_employment_scope_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employee_organizations_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_job_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_job_tenant_fkey"
            columns: ["tenant_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_location_hr_group_scope_fkey"
            columns: ["tenant_id", "hr_group_id", "location_id"]
            isOneToOne: false
            referencedRelation: "administration_locations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_manager_employee_id_fkey"
            columns: ["direct_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_organizations_manager_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "direct_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_manager_same_tenant_fkey"
            columns: ["tenant_id", "direct_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_organizations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_profile_links: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          is_featured: boolean
          label: string
          link_type: string
          sort_order: number
          tenant_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          is_featured?: boolean
          label: string
          link_type: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          is_featured?: boolean
          label?: string
          link_type?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_profile_links_employee_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_profile_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_relations: {
        Row: {
          birth_date: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          employee_id: string
          first_name: string | null
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          initials: string | null
          is_emergency_contact: boolean
          last_name: string
          mobile: string | null
          notes: string | null
          phone: string | null
          prefix: string | null
          relation_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          employee_id: string
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          initials?: string | null
          is_emergency_contact?: boolean
          last_name: string
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          prefix?: string | null
          relation_type: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          employee_id?: string
          first_name?: string | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          initials?: string | null
          is_emergency_contact?: boolean
          last_name?: string
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          prefix?: string | null
          relation_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_relations_employee_scope_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_relations_relation_type_catalog_fkey"
            columns: ["tenant_id", "relation_type"]
            isOneToOne: false
            referencedRelation: "relation_types"
            referencedColumns: ["tenant_id", "code"]
          },
          {
            foreignKeyName: "employee_relations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_secure_identifiers: {
        Row: {
          bsn_ciphertext: string | null
          bsn_fingerprint: string | null
          created_at: string
          employee_id: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bsn_ciphertext?: string | null
          bsn_fingerprint?: string | null
          created_at?: string
          employee_id: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bsn_ciphertext?: string | null
          bsn_fingerprint?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_secure_identifiers_employee_scope_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_secure_identifiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_set_members: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          employee_set_id: string
          hr_group_id: string
          id: string
          tenant_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          employee_set_id: string
          hr_group_id: string
          id?: string
          tenant_id: string
          valid_from?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          employee_set_id?: string
          hr_group_id?: string
          id?: string
          tenant_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_set_members_employee_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_set_members_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_set_members_set_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_set_id"]
            isOneToOne: false
            referencedRelation: "employee_sets"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_set_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_sets: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          leave_profile_id: string
          name: string
          priority: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          leave_profile_id: string
          name: string
          priority?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          leave_profile_id?: string
          name?: string
          priority?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_sets_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employee_sets_profile_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_profile_id"]
            isOneToOne: false
            referencedRelation: "leave_profiles"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employee_sets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          birth_country: string | null
          birth_date: string | null
          birth_name: string
          birth_name_prefix: string | null
          birth_place: string | null
          created_at: string
          custom_fields: Json
          deleted_at: string | null
          education_level: Database["public"]["Enums"]["education_level"] | null
          employee_number: string
          first_name: string
          gender: Database["public"]["Enums"]["gender"]
          hr_group_id: string
          id: string
          initials: string | null
          is_active: boolean
          is_archived: boolean
          marital_status: Database["public"]["Enums"]["marital_status"] | null
          marital_status_date: string | null
          name_usage: Database["public"]["Enums"]["name_usage"]
          nationality: string | null
          original_hire_date: string | null
          partner_name: string | null
          partner_name_prefix: string | null
          preferred_language: string
          private_email: string | null
          private_mobile: string | null
          private_phone: string | null
          pronouns: string | null
          tenant_id: string
          title: string | null
          updated_at: string
          work_email: string | null
          work_mobile: string | null
          work_phone: string | null
          work_phone_ext: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          birth_country?: string | null
          birth_date?: string | null
          birth_name: string
          birth_name_prefix?: string | null
          birth_place?: string | null
          created_at?: string
          custom_fields?: Json
          deleted_at?: string | null
          education_level?:
            | Database["public"]["Enums"]["education_level"]
            | null
          employee_number: string
          first_name: string
          gender: Database["public"]["Enums"]["gender"]
          hr_group_id: string
          id?: string
          initials?: string | null
          is_active?: boolean
          is_archived?: boolean
          marital_status?: Database["public"]["Enums"]["marital_status"] | null
          marital_status_date?: string | null
          name_usage: Database["public"]["Enums"]["name_usage"]
          nationality?: string | null
          original_hire_date?: string | null
          partner_name?: string | null
          partner_name_prefix?: string | null
          preferred_language?: string
          private_email?: string | null
          private_mobile?: string | null
          private_phone?: string | null
          pronouns?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string
          work_email?: string | null
          work_mobile?: string | null
          work_phone?: string | null
          work_phone_ext?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          birth_country?: string | null
          birth_date?: string | null
          birth_name?: string
          birth_name_prefix?: string | null
          birth_place?: string | null
          created_at?: string
          custom_fields?: Json
          deleted_at?: string | null
          education_level?:
            | Database["public"]["Enums"]["education_level"]
            | null
          employee_number?: string
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          hr_group_id?: string
          id?: string
          initials?: string | null
          is_active?: boolean
          is_archived?: boolean
          marital_status?: Database["public"]["Enums"]["marital_status"] | null
          marital_status_date?: string | null
          name_usage?: Database["public"]["Enums"]["name_usage"]
          nationality?: string | null
          original_hire_date?: string | null
          partner_name?: string | null
          partner_name_prefix?: string | null
          preferred_language?: string
          private_email?: string | null
          private_mobile?: string | null
          private_phone?: string | null
          pronouns?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
          work_email?: string | null
          work_mobile?: string | null
          work_phone?: string | null
          work_phone_ext?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_chain_assessments: {
        Row: {
          administration_id: string
          assessed_on: string
          chain_contract_count: number
          chain_starts_on: string
          change_set_id: string | null
          created_by_user_id: string | null
          employee_id: string
          employment_id: string
          history_complete: boolean
          id: string
          outcome: string
          override_explanation: string | null
          override_reason: string | null
          proposed_ends_on: string | null
          proposed_starts_on: string
          reason_codes: string[]
          rule_version: string
          tenant_id: string
        }
        Insert: {
          administration_id: string
          assessed_on?: string
          chain_contract_count: number
          chain_starts_on: string
          change_set_id?: string | null
          created_by_user_id?: string | null
          employee_id: string
          employment_id: string
          history_complete: boolean
          id?: string
          outcome: string
          override_explanation?: string | null
          override_reason?: string | null
          proposed_ends_on?: string | null
          proposed_starts_on: string
          reason_codes?: string[]
          rule_version: string
          tenant_id: string
        }
        Update: {
          administration_id?: string
          assessed_on?: string
          chain_contract_count?: number
          chain_starts_on?: string
          change_set_id?: string | null
          created_by_user_id?: string | null
          employee_id?: string
          employment_id?: string
          history_complete?: boolean
          id?: string
          outcome?: string
          override_explanation?: string | null
          override_reason?: string | null
          proposed_ends_on?: string | null
          proposed_starts_on?: string
          reason_codes?: string[]
          rule_version?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_chain_assessments_change_set_fkey"
            columns: ["tenant_id", "administration_id", "change_set_id"]
            isOneToOne: false
            referencedRelation: "employment_change_sets"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "employment_chain_assessments_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_chain_assessments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_chain_history: {
        Row: {
          administration_id: string
          created_at: string
          employee_id: string
          employer_name: string
          employer_reference: string | null
          employment_id: string
          ends_on: string
          exception_code: string | null
          id: string
          is_successive_employer: boolean
          notes: string | null
          source: string
          starts_on: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          created_at?: string
          employee_id: string
          employer_name: string
          employer_reference?: string | null
          employment_id: string
          ends_on: string
          exception_code?: string | null
          id?: string
          is_successive_employer?: boolean
          notes?: string | null
          source?: string
          starts_on: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          created_at?: string
          employee_id?: string
          employer_name?: string
          employer_reference?: string | null
          employment_id?: string
          ends_on?: string
          exception_code?: string | null
          id?: string
          is_successive_employer?: boolean
          notes?: string | null
          source?: string
          starts_on?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_chain_history_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_chain_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_change_follow_ups: {
        Row: {
          administration_id: string
          change_set_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          due_on: string | null
          employee_id: string
          employment_id: string
          id: string
          priority: string
          responsible_role_code: string | null
          responsible_user_id: string | null
          status: string
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          change_set_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_on?: string | null
          employee_id: string
          employment_id: string
          id?: string
          priority?: string
          responsible_role_code?: string | null
          responsible_user_id?: string | null
          status?: string
          subject: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          change_set_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_on?: string | null
          employee_id?: string
          employment_id?: string
          id?: string
          priority?: string
          responsible_role_code?: string | null
          responsible_user_id?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_change_follow_ups_change_set_fkey"
            columns: ["tenant_id", "administration_id", "change_set_id"]
            isOneToOne: false
            referencedRelation: "employment_change_sets"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "employment_change_follow_ups_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_change_follow_ups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_change_sets: {
        Row: {
          acknowledgements: Json
          administration_id: string
          applied_at: string | null
          created_at: string
          created_by_user_id: string | null
          domains: string[]
          effective_on: string
          employee_id: string
          employment_id: string
          id: string
          reason: string
          rule_version: string | null
          status: string
          tenant_id: string
          warning_codes: string[]
        }
        Insert: {
          acknowledgements?: Json
          administration_id: string
          applied_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          domains?: string[]
          effective_on: string
          employee_id: string
          employment_id: string
          id?: string
          reason: string
          rule_version?: string | null
          status?: string
          tenant_id: string
          warning_codes?: string[]
        }
        Update: {
          acknowledgements?: Json
          administration_id?: string
          applied_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          domains?: string[]
          effective_on?: string
          employee_id?: string
          employment_id?: string
          id?: string
          reason?: string
          rule_version?: string | null
          status?: string
          tenant_id?: string
          warning_codes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "employment_change_sets_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_change_sets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_contracts: {
        Row: {
          administration_id: string
          created_at: string
          duration_type: Database["public"]["Enums"]["contract_duration_type"]
          employee_id: string
          employment_id: string
          ends_on: string | null
          flex_phase_id: string | null
          fulltime_hours_per_week: number
          hr_group_id: string
          id: string
          labor_condition_set_id: string
          probation_applies: boolean
          probation_ends_on: string | null
          sequence_number: number
          starts_on: string
          tenant_id: string
          updated_at: string
          worker_type: Database["public"]["Enums"]["employment_worker_type"]
        }
        Insert: {
          administration_id: string
          created_at?: string
          duration_type: Database["public"]["Enums"]["contract_duration_type"]
          employee_id: string
          employment_id: string
          ends_on?: string | null
          flex_phase_id?: string | null
          fulltime_hours_per_week?: number
          hr_group_id: string
          id?: string
          labor_condition_set_id: string
          probation_applies?: boolean
          probation_ends_on?: string | null
          sequence_number: number
          starts_on: string
          tenant_id: string
          updated_at?: string
          worker_type: Database["public"]["Enums"]["employment_worker_type"]
        }
        Update: {
          administration_id?: string
          created_at?: string
          duration_type?: Database["public"]["Enums"]["contract_duration_type"]
          employee_id?: string
          employment_id?: string
          ends_on?: string | null
          flex_phase_id?: string | null
          fulltime_hours_per_week?: number
          hr_group_id?: string
          id?: string
          labor_condition_set_id?: string
          probation_applies?: boolean
          probation_ends_on?: string | null
          sequence_number?: number
          starts_on?: string
          tenant_id?: string
          updated_at?: string
          worker_type?: Database["public"]["Enums"]["employment_worker_type"]
        }
        Relationships: [
          {
            foreignKeyName: "employment_contracts_administration_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employment_contracts_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_contracts_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employment_contracts_flex_phase_fkey"
            columns: ["tenant_id", "administration_id", "flex_phase_id"]
            isOneToOne: false
            referencedRelation: "flex_phases"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "employment_contracts_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employment_contracts_labor_condition_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "labor_condition_set_id"]
            isOneToOne: false
            referencedRelation: "labor_condition_sets"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employment_contracts_labor_condition_set_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "labor_condition_set_id",
            ]
            isOneToOne: false
            referencedRelation: "labor_condition_sets"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      employment_cost_allocations: {
        Row: {
          administration_id: string
          change_set_id: string | null
          cost_carrier_id: string
          cost_center_id: string
          created_at: string
          employee_id: string
          employment_id: string
          id: string
          percentage: number
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          administration_id: string
          change_set_id?: string | null
          cost_carrier_id: string
          cost_center_id: string
          created_at?: string
          employee_id: string
          employment_id: string
          id?: string
          percentage: number
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          administration_id?: string
          change_set_id?: string | null
          cost_carrier_id?: string
          cost_center_id?: string
          created_at?: string
          employee_id?: string
          employment_id?: string
          id?: string
          percentage?: number
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_cost_allocations_change_set_id_fkey"
            columns: ["change_set_id"]
            isOneToOne: false
            referencedRelation: "employment_change_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_cost_allocations_cost_carrier_fkey"
            columns: ["tenant_id", "administration_id", "cost_carrier_id"]
            isOneToOne: false
            referencedRelation: "cost_carriers"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "employment_cost_allocations_cost_center_fkey"
            columns: ["tenant_id", "administration_id", "cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "employment_cost_allocations_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
        ]
      }
      employment_end_reasons: {
        Row: {
          administration_id: string | null
          code: string
          country_code: string
          created_at: string
          hr_group_id: string
          id: string
          is_active: boolean
          name_en: string
          name_nl: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id?: string | null
          code: string
          country_code?: string
          created_at?: string
          hr_group_id: string
          id?: string
          is_active?: boolean
          name_en: string
          name_nl: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string | null
          code?: string
          country_code?: string
          created_at?: string
          hr_group_id?: string
          id?: string
          is_active?: boolean
          name_en?: string
          name_nl?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_end_reasons_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employment_end_reasons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_income_relationships: {
        Row: {
          administration_id: string
          created_at: string
          employee_id: string
          employment_id: string
          id: string
          income_relationship_id: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          administration_id: string
          created_at?: string
          employee_id: string
          employment_id: string
          id?: string
          income_relationship_id: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          administration_id?: string
          created_at?: string
          employee_id?: string
          employment_id?: string
          id?: string
          income_relationship_id?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_income_relationships_employment_scope_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_income_relationships_income_scope_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "income_relationship_id",
            ]
            isOneToOne: false
            referencedRelation: "income_relationships"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_income_relationships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_labor_conditions: {
        Row: {
          administration_id: string
          change_set_id: string | null
          condition_group: string
          created_at: string
          employee_id: string
          employment_contract_id: string
          employment_id: string
          hr_group_id: string
          id: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          administration_id: string
          change_set_id?: string | null
          condition_group: string
          created_at?: string
          employee_id: string
          employment_contract_id: string
          employment_id: string
          hr_group_id: string
          id?: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          administration_id?: string
          change_set_id?: string | null
          condition_group?: string
          created_at?: string
          employee_id?: string
          employment_contract_id?: string
          employment_id?: string
          hr_group_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_labor_conditions_change_set_id_fkey"
            columns: ["change_set_id"]
            isOneToOne: false
            referencedRelation: "employment_change_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_labor_conditions_contract_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
              "employment_contract_id",
            ]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_labor_conditions_contract_hr_group_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "employment_id",
              "employment_contract_id",
            ]
            isOneToOne: false
            referencedRelation: "employment_contracts"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "employment_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_labor_conditions_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_labor_conditions_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employment_labor_conditions_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      employment_leave_profiles: {
        Row: {
          administration_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          employment_id: string
          hr_group_id: string
          id: string
          leave_profile_id: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          administration_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          employment_id: string
          hr_group_id: string
          id?: string
          leave_profile_id: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          administration_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          employment_id?: string
          hr_group_id?: string
          id?: string
          leave_profile_id?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_leave_profiles_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_leave_profiles_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employment_leave_profiles_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employment_leave_profiles_profile_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_profile_id"]
            isOneToOne: false
            referencedRelation: "leave_profiles"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      employment_salaries: {
        Row: {
          administration_id: string
          cao_scale_name: string | null
          cao_step_name: string | null
          change_set_id: string | null
          created_at: string
          currency_code: string
          employee_id: string
          employment_id: string
          fulltime_amount: number | null
          hourly_rate: number | null
          hr_group_id: string
          id: string
          minimum_wage_scheme:
            | Database["public"]["Enums"]["minimum_wage_scheme"]
            | null
          parttime_amount: number | null
          payment_frequency: Database["public"]["Enums"]["salary_frequency"]
          payment_type: Database["public"]["Enums"]["salary_payment_type"]
          salary_band_id: string | null
          salary_basis: Database["public"]["Enums"]["salary_basis"]
          salary_frequency_id: string
          salary_route: Database["public"]["Enums"]["salary_application_route"]
          salary_scale_id: string | null
          salary_scale_step_id: string | null
          salary_step_code: string | null
          salary_structure_id: string | null
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          administration_id: string
          cao_scale_name?: string | null
          cao_step_name?: string | null
          change_set_id?: string | null
          created_at?: string
          currency_code?: string
          employee_id: string
          employment_id: string
          fulltime_amount?: number | null
          hourly_rate?: number | null
          hr_group_id?: string
          id?: string
          minimum_wage_scheme?:
            | Database["public"]["Enums"]["minimum_wage_scheme"]
            | null
          parttime_amount?: number | null
          payment_frequency: Database["public"]["Enums"]["salary_frequency"]
          payment_type: Database["public"]["Enums"]["salary_payment_type"]
          salary_band_id?: string | null
          salary_basis: Database["public"]["Enums"]["salary_basis"]
          salary_frequency_id: string
          salary_route?: Database["public"]["Enums"]["salary_application_route"]
          salary_scale_id?: string | null
          salary_scale_step_id?: string | null
          salary_step_code?: string | null
          salary_structure_id?: string | null
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          administration_id?: string
          cao_scale_name?: string | null
          cao_step_name?: string | null
          change_set_id?: string | null
          created_at?: string
          currency_code?: string
          employee_id?: string
          employment_id?: string
          fulltime_amount?: number | null
          hourly_rate?: number | null
          hr_group_id?: string
          id?: string
          minimum_wage_scheme?:
            | Database["public"]["Enums"]["minimum_wage_scheme"]
            | null
          parttime_amount?: number | null
          payment_frequency?: Database["public"]["Enums"]["salary_frequency"]
          payment_type?: Database["public"]["Enums"]["salary_payment_type"]
          salary_band_id?: string | null
          salary_basis?: Database["public"]["Enums"]["salary_basis"]
          salary_frequency_id?: string
          salary_route?: Database["public"]["Enums"]["salary_application_route"]
          salary_scale_id?: string | null
          salary_scale_step_id?: string | null
          salary_step_code?: string | null
          salary_structure_id?: string | null
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_salaries_band_fkey"
            columns: ["tenant_id", "hr_group_id", "salary_band_id"]
            isOneToOne: false
            referencedRelation: "salary_bands"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employment_salaries_change_set_id_fkey"
            columns: ["change_set_id"]
            isOneToOne: false
            referencedRelation: "employment_change_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_salaries_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_salaries_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employment_salaries_frequency_fkey"
            columns: ["tenant_id", "administration_id", "salary_frequency_id"]
            isOneToOne: false
            referencedRelation: "salary_frequencies"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "employment_salaries_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employment_salaries_scale_fkey"
            columns: ["tenant_id", "hr_group_id", "salary_scale_id"]
            isOneToOne: false
            referencedRelation: "salary_scales"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employment_salaries_scale_step_fkey"
            columns: ["tenant_id", "hr_group_id", "salary_scale_step_id"]
            isOneToOne: false
            referencedRelation: "salary_scale_steps"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employment_salaries_structure_fkey"
            columns: ["tenant_id", "hr_group_id", "salary_structure_id"]
            isOneToOne: false
            referencedRelation: "salary_structures"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      employment_schedules: {
        Row: {
          administration_id: string
          average_days_per_week: number
          average_hours_per_week: number
          change_set_id: string | null
          created_at: string
          employee_id: string
          employment_id: string
          friday_hours: number | null
          fulltime_hours_per_week: number
          id: string
          is_on_call: boolean
          monday_hours: number | null
          on_call_obligation: boolean | null
          part_time_factor: number
          saturday_hours: number | null
          schedule_type: Database["public"]["Enums"]["schedule_type"]
          start_week: number
          sunday_hours: number | null
          tenant_id: string
          thursday_hours: number | null
          time_for_time_accrual: number
          tuesday_hours: number | null
          updated_at: string
          valid_from: string
          valid_until: string | null
          wednesday_hours: number | null
          work_scope:
            | Database["public"]["Enums"]["employment_work_scope"]
            | null
        }
        Insert: {
          administration_id: string
          average_days_per_week: number
          average_hours_per_week: number
          change_set_id?: string | null
          created_at?: string
          employee_id: string
          employment_id: string
          friday_hours?: number | null
          fulltime_hours_per_week?: number
          id?: string
          is_on_call?: boolean
          monday_hours?: number | null
          on_call_obligation?: boolean | null
          part_time_factor: number
          saturday_hours?: number | null
          schedule_type: Database["public"]["Enums"]["schedule_type"]
          start_week?: number
          sunday_hours?: number | null
          tenant_id: string
          thursday_hours?: number | null
          time_for_time_accrual?: number
          tuesday_hours?: number | null
          updated_at?: string
          valid_from: string
          valid_until?: string | null
          wednesday_hours?: number | null
          work_scope?:
            | Database["public"]["Enums"]["employment_work_scope"]
            | null
        }
        Update: {
          administration_id?: string
          average_days_per_week?: number
          average_hours_per_week?: number
          change_set_id?: string | null
          created_at?: string
          employee_id?: string
          employment_id?: string
          friday_hours?: number | null
          fulltime_hours_per_week?: number
          id?: string
          is_on_call?: boolean
          monday_hours?: number | null
          on_call_obligation?: boolean | null
          part_time_factor?: number
          saturday_hours?: number | null
          schedule_type?: Database["public"]["Enums"]["schedule_type"]
          start_week?: number
          sunday_hours?: number | null
          tenant_id?: string
          thursday_hours?: number | null
          time_for_time_accrual?: number
          tuesday_hours?: number | null
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          wednesday_hours?: number | null
          work_scope?:
            | Database["public"]["Enums"]["employment_work_scope"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_schedules_change_set_id_fkey"
            columns: ["change_set_id"]
            isOneToOne: false
            referencedRelation: "employment_change_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_schedules_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
        ]
      }
      employment_terminations: {
        Row: {
          administration_id: string
          confirmed_at: string | null
          confirmed_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          employee_id: string
          employment_id: string
          explanation: string | null
          final_settlement_status: Database["public"]["Enums"]["final_settlement_status"]
          hr_group_id: string
          id: string
          initiator: Database["public"]["Enums"]["termination_initiator"]
          internal_reason_id: string | null
          last_working_day: string
          reported_at: string | null
          statutory_reason_id: string | null
          tenant_id: string
          updated_at: string
          workflow_status: Database["public"]["Enums"]["termination_workflow_status"]
        }
        Insert: {
          administration_id: string
          confirmed_at?: string | null
          confirmed_by_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          employee_id: string
          employment_id: string
          explanation?: string | null
          final_settlement_status?: Database["public"]["Enums"]["final_settlement_status"]
          hr_group_id: string
          id?: string
          initiator: Database["public"]["Enums"]["termination_initiator"]
          internal_reason_id?: string | null
          last_working_day: string
          reported_at?: string | null
          statutory_reason_id?: string | null
          tenant_id: string
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["termination_workflow_status"]
        }
        Update: {
          administration_id?: string
          confirmed_at?: string | null
          confirmed_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          employee_id?: string
          employment_id?: string
          explanation?: string | null
          final_settlement_status?: Database["public"]["Enums"]["final_settlement_status"]
          hr_group_id?: string
          id?: string
          initiator?: Database["public"]["Enums"]["termination_initiator"]
          internal_reason_id?: string | null
          last_working_day?: string
          reported_at?: string | null
          statutory_reason_id?: string | null
          tenant_id?: string
          updated_at?: string
          workflow_status?: Database["public"]["Enums"]["termination_workflow_status"]
        }
        Relationships: [
          {
            foreignKeyName: "employment_terminations_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_terminations_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employment_terminations_internal_reason_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "internal_reason_id"]
            isOneToOne: false
            referencedRelation: "employment_end_reasons"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employment_terminations_statutory_reason_id_fkey"
            columns: ["statutory_reason_id"]
            isOneToOne: false
            referencedRelation: "statutory_termination_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      employment_work_hour_entries: {
        Row: {
          administration_id: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          employment_id: string
          hours: number
          hr_group_id: string
          id: string
          note: string | null
          source_key: string | null
          source_type: string
          status: Database["public"]["Enums"]["leave_work_hour_entry_status"]
          tenant_id: string
          updated_at: string
          work_date: string
          work_hour_type_id: string
        }
        Insert: {
          administration_id: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          employment_id: string
          hours: number
          hr_group_id: string
          id?: string
          note?: string | null
          source_key?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["leave_work_hour_entry_status"]
          tenant_id: string
          updated_at?: string
          work_date: string
          work_hour_type_id: string
        }
        Update: {
          administration_id?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          employment_id?: string
          hours?: number
          hr_group_id?: string
          id?: string
          note?: string | null
          source_key?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["leave_work_hour_entry_status"]
          tenant_id?: string
          updated_at?: string
          work_date?: string
          work_hour_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_work_hour_entries_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "employment_work_hour_entries_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employment_work_hour_entries_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employment_work_hour_entries_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "work_hour_type_id"]
            isOneToOne: false
            referencedRelation: "work_hour_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      employment_work_pattern_days: {
        Row: {
          administration_id: string
          break_minutes: number
          created_at: string
          ends_at: string | null
          id: string
          is_working_day: boolean
          iso_weekday: number
          note: string | null
          scheduled_minutes: number
          starts_at: string | null
          tenant_id: string
          updated_at: string
          week_index: number
          work_pattern_id: string
        }
        Insert: {
          administration_id: string
          break_minutes?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          is_working_day: boolean
          iso_weekday: number
          note?: string | null
          scheduled_minutes: number
          starts_at?: string | null
          tenant_id: string
          updated_at?: string
          week_index: number
          work_pattern_id: string
        }
        Update: {
          administration_id?: string
          break_minutes?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          is_working_day?: boolean
          iso_weekday?: number
          note?: string | null
          scheduled_minutes?: number
          starts_at?: string | null
          tenant_id?: string
          updated_at?: string
          week_index?: number
          work_pattern_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_work_pattern_days_pattern_fkey"
            columns: ["tenant_id", "administration_id", "work_pattern_id"]
            isOneToOne: false
            referencedRelation: "employment_work_patterns"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      employment_work_patterns: {
        Row: {
          administration_id: string
          anchor_date: string
          average_minutes_per_week: number
          change_set_id: string | null
          created_at: string
          created_by: string | null
          cycle_weeks: number
          employee_id: string
          employment_id: string
          id: string
          name: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          administration_id: string
          anchor_date: string
          average_minutes_per_week: number
          change_set_id?: string | null
          created_at?: string
          created_by?: string | null
          cycle_weeks: number
          employee_id: string
          employment_id: string
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          administration_id?: string
          anchor_date?: string
          average_minutes_per_week?: number
          change_set_id?: string | null
          created_at?: string
          created_by?: string | null
          cycle_weeks?: number
          employee_id?: string
          employment_id?: string
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_work_patterns_change_set_id_fkey"
            columns: ["change_set_id"]
            isOneToOne: false
            referencedRelation: "employment_change_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employment_work_patterns_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
        ]
      }
      employments: {
        Row: {
          administration_id: string
          contract_document_url: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          country_code: string
          created_at: string
          deleted_at: string | null
          employee_id: string
          employment_number: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          ends_on: string | null
          hr_group_id: string
          id: string
          is_primary: boolean
          original_hire_date: string
          probation_ends_on: string | null
          reason_started: string | null
          record_status: Database["public"]["Enums"]["employment_record_status"]
          seniority_date: string
          starts_on: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          contract_document_url?: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          country_code?: string
          created_at?: string
          deleted_at?: string | null
          employee_id: string
          employment_number: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          ends_on?: string | null
          hr_group_id: string
          id?: string
          is_primary?: boolean
          original_hire_date: string
          probation_ends_on?: string | null
          reason_started?: string | null
          record_status?: Database["public"]["Enums"]["employment_record_status"]
          seniority_date: string
          starts_on: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          contract_document_url?: string | null
          contract_type?: Database["public"]["Enums"]["contract_type"]
          country_code?: string
          created_at?: string
          deleted_at?: string | null
          employee_id?: string
          employment_number?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          ends_on?: string | null
          hr_group_id?: string
          id?: string
          is_primary?: boolean
          original_hire_date?: string
          probation_ends_on?: string | null
          reason_started?: string | null
          record_status?: Database["public"]["Enums"]["employment_record_status"]
          seniority_date?: string
          starts_on?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employments_administration_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employments_administration_same_tenant_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employments_employee_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "employments_employee_same_tenant_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employments_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enps_answers: {
        Row: {
          answer_value: string
          campaign_id: string
          hr_group_id: string
          id: string
          question_id: string
          response_id: string
          tenant_id: string
        }
        Insert: {
          answer_value: string
          campaign_id: string
          hr_group_id: string
          id?: string
          question_id: string
          response_id: string
          tenant_id: string
        }
        Update: {
          answer_value?: string
          campaign_id?: string
          hr_group_id?: string
          id?: string
          question_id?: string
          response_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enps_answers_question_fkey"
            columns: ["tenant_id", "hr_group_id", "campaign_id", "question_id"]
            isOneToOne: false
            referencedRelation: "enps_questions"
            referencedColumns: ["tenant_id", "hr_group_id", "campaign_id", "id"]
          },
          {
            foreignKeyName: "enps_answers_response_fkey"
            columns: ["tenant_id", "hr_group_id", "campaign_id", "response_id"]
            isOneToOne: false
            referencedRelation: "enps_responses"
            referencedColumns: ["tenant_id", "hr_group_id", "campaign_id", "id"]
          },
        ]
      }
      enps_campaigns: {
        Row: {
          activated_at: string | null
          closed_at: string | null
          created_at: string
          created_by: string
          ends_at: string
          hr_group_id: string
          id: string
          reminder_interval_days: number
          scale_type: string
          starts_at: string
          status: string
          target_ids: string[]
          target_mode: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by: string
          ends_at: string
          hr_group_id: string
          id?: string
          reminder_interval_days?: number
          scale_type?: string
          starts_at: string
          status?: string
          target_ids?: string[]
          target_mode: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string
          ends_at?: string
          hr_group_id?: string
          id?: string
          reminder_interval_days?: number
          scale_type?: string
          starts_at?: string
          status?: string
          target_ids?: string[]
          target_mode?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enps_campaigns_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "enps_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enps_invitations: {
        Row: {
          campaign_id: string
          created_at: string
          employee_id: string
          has_submitted: boolean
          hr_group_id: string
          id: string
          last_reminded_at: string | null
          reminder_count: number
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          employee_id: string
          has_submitted?: boolean
          hr_group_id: string
          id?: string
          last_reminded_at?: string | null
          reminder_count?: number
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          employee_id?: string
          has_submitted?: boolean
          hr_group_id?: string
          id?: string
          last_reminded_at?: string | null
          reminder_count?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enps_invitations_campaign_fkey"
            columns: ["tenant_id", "hr_group_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "enps_campaigns"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "enps_invitations_employee_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      enps_question_bank: {
        Row: {
          category_id: string
          default_type: string
          hr_group_id: string | null
          id: string
          is_mandatory_enps: boolean
          is_system: boolean
          question_number: number | null
          question_text: string
          tenant_id: string | null
        }
        Insert: {
          category_id: string
          default_type: string
          hr_group_id?: string | null
          id?: string
          is_mandatory_enps?: boolean
          is_system?: boolean
          question_number?: number | null
          question_text: string
          tenant_id?: string | null
        }
        Update: {
          category_id?: string
          default_type?: string
          hr_group_id?: string | null
          id?: string
          is_mandatory_enps?: boolean
          is_system?: boolean
          question_number?: number | null
          question_text?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enps_question_bank_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "enps_question_bank_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enps_question_bank_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "enps_question_bank_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enps_question_bank_categories: {
        Row: {
          hr_group_id: string | null
          id: string
          is_system: boolean
          name: string
          order_index: number
          tenant_id: string | null
        }
        Insert: {
          hr_group_id?: string | null
          id?: string
          is_system?: boolean
          name: string
          order_index: number
          tenant_id?: string | null
        }
        Update: {
          hr_group_id?: string | null
          id?: string
          is_system?: boolean
          name?: string
          order_index?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enps_question_bank_categories_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "enps_question_bank_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enps_questions: {
        Row: {
          bank_question_id: string | null
          campaign_id: string
          category_name: string
          hr_group_id: string
          id: string
          is_enabled: boolean
          is_mandatory: boolean
          order_index: number
          question_text: string
          question_type: string
          tenant_id: string
        }
        Insert: {
          bank_question_id?: string | null
          campaign_id: string
          category_name: string
          hr_group_id: string
          id?: string
          is_enabled?: boolean
          is_mandatory?: boolean
          order_index: number
          question_text: string
          question_type: string
          tenant_id: string
        }
        Update: {
          bank_question_id?: string | null
          campaign_id?: string
          category_name?: string
          hr_group_id?: string
          id?: string
          is_enabled?: boolean
          is_mandatory?: boolean
          order_index?: number
          question_text?: string
          question_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enps_questions_bank_question_id_fkey"
            columns: ["bank_question_id"]
            isOneToOne: false
            referencedRelation: "enps_question_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enps_questions_campaign_fkey"
            columns: ["tenant_id", "hr_group_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "enps_campaigns"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      enps_responses: {
        Row: {
          campaign_id: string
          hr_group_id: string
          id: string
          submitted_at: string
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          hr_group_id: string
          id?: string
          submitted_at?: string
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          hr_group_id?: string
          id?: string
          submitted_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enps_responses_campaign_fkey"
            columns: ["tenant_id", "hr_group_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "enps_campaigns"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      flex_phases: {
        Row: {
          administration_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flex_phases_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "flex_phases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      form_definition_drafts: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          definition_json: Json
          form_definition_id: string
          hr_group_id: string
          id: string
          revision: number
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          validation_report: Json
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          definition_json: Json
          form_definition_id: string
          hr_group_id: string
          id?: string
          revision: number
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          validation_report?: Json
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          definition_json?: Json
          form_definition_id?: string
          hr_group_id?: string
          id?: string
          revision?: number
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          validation_report?: Json
        }
        Relationships: [
          {
            foreignKeyName: "form_definition_drafts_definition_fkey"
            columns: ["tenant_id", "hr_group_id", "form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      form_definitions: {
        Row: {
          administration_id: string | null
          created_at: string
          created_by_user_id: string | null
          description: Json | null
          hr_group_id: string
          id: string
          key: string
          scope_type: Database["public"]["Enums"]["access_scope_type"]
          status: Database["public"]["Enums"]["process_definition_status"]
          tenant_id: string
          title: Json
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: Json | null
          hr_group_id: string
          id?: string
          key: string
          scope_type?: Database["public"]["Enums"]["access_scope_type"]
          status?: Database["public"]["Enums"]["process_definition_status"]
          tenant_id: string
          title: Json
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: Json | null
          hr_group_id?: string
          id?: string
          key?: string
          scope_type?: Database["public"]["Enums"]["access_scope_type"]
          status?: Database["public"]["Enums"]["process_definition_status"]
          tenant_id?: string
          title?: Json
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_definitions_administration_fkey"
            columns: ["tenant_id", "hr_group_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "form_definitions_tenant_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      form_versions: {
        Row: {
          compiler_version: string
          created_at: string
          definition_hash: string
          definition_json: Json
          form_definition_id: string
          hr_group_id: string
          id: string
          published_at: string
          published_by_user_id: string | null
          schema_version: number
          tenant_id: string
          version_number: number
        }
        Insert: {
          compiler_version: string
          created_at?: string
          definition_hash: string
          definition_json: Json
          form_definition_id: string
          hr_group_id: string
          id?: string
          published_at?: string
          published_by_user_id?: string | null
          schema_version: number
          tenant_id: string
          version_number: number
        }
        Update: {
          compiler_version?: string
          created_at?: string
          definition_hash?: string
          definition_json?: Json
          form_definition_id?: string
          hr_group_id?: string
          id?: string
          published_at?: string
          published_by_user_id?: string | null
          schema_version?: number
          tenant_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "form_versions_definition_fkey"
            columns: ["tenant_id", "hr_group_id", "form_definition_id"]
            isOneToOne: false
            referencedRelation: "form_definitions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      holiday_calendars: {
        Row: {
          administration_id: string | null
          calendar_year: number
          country_code: string
          created_at: string
          hr_group_id: string
          id: string
          imported_at: string | null
          imported_by: string | null
          provider: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id?: string | null
          calendar_year: number
          country_code: string
          created_at?: string
          hr_group_id: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          provider?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string | null
          calendar_year?: number
          country_code?: string
          created_at?: string
          hr_group_id?: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          provider?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holiday_calendars_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      holidays: {
        Row: {
          administration_id: string | null
          created_at: string
          created_by: string | null
          display_name: string | null
          external_key: string | null
          holiday_calendar_id: string
          holiday_date: string
          holiday_types: string[]
          hr_group_id: string
          id: string
          is_active: boolean
          provider_name: string
          source: string
          subdivision_codes: string[]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          external_key?: string | null
          holiday_calendar_id: string
          holiday_date: string
          holiday_types?: string[]
          hr_group_id: string
          id?: string
          is_active?: boolean
          provider_name: string
          source: string
          subdivision_codes?: string[]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          external_key?: string | null
          holiday_calendar_id?: string
          holiday_date?: string
          holiday_types?: string[]
          hr_group_id?: string
          id?: string
          is_active?: boolean
          provider_name?: string
          source?: string
          subdivision_codes?: string[]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holidays_calendar_group_fkey"
            columns: ["tenant_id", "hr_group_id", "holiday_calendar_id"]
            isOneToOne: false
            referencedRelation: "holiday_calendars"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "holidays_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      hr_groups: {
        Row: {
          code: string
          created_at: string
          created_by_user_id: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_match_decisions: {
        Row: {
          candidate_employee_id: string | null
          created_at: string
          decided_at: string
          decided_by_user_id: string
          decision: Database["public"]["Enums"]["identity_match_decision"]
          id: string
          justification: string | null
          match_request_id: string
          rule_summary: Json
          selected_employee_id: string | null
          tenant_id: string
        }
        Insert: {
          candidate_employee_id?: string | null
          created_at?: string
          decided_at?: string
          decided_by_user_id: string
          decision: Database["public"]["Enums"]["identity_match_decision"]
          id?: string
          justification?: string | null
          match_request_id: string
          rule_summary?: Json
          selected_employee_id?: string | null
          tenant_id: string
        }
        Update: {
          candidate_employee_id?: string | null
          created_at?: string
          decided_at?: string
          decided_by_user_id?: string
          decision?: Database["public"]["Enums"]["identity_match_decision"]
          id?: string
          justification?: string | null
          match_request_id?: string
          rule_summary?: Json
          selected_employee_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_match_decisions_candidate_same_tenant_fkey"
            columns: ["tenant_id", "candidate_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "identity_match_decisions_selected_same_tenant_fkey"
            columns: ["tenant_id", "selected_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "identity_match_decisions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      income_relationships: {
        Row: {
          administration_id: string
          created_at: string
          deleted_at: string | null
          employee_id: string
          ends_on: string | null
          id: string
          ikv_number: number
          payroll_tax_subnumber: string
          relationship_type: Database["public"]["Enums"]["income_relationship_type"]
          reporting_status: Database["public"]["Enums"]["payroll_reporting_status"]
          starts_on: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          created_at?: string
          deleted_at?: string | null
          employee_id: string
          ends_on?: string | null
          id?: string
          ikv_number: number
          payroll_tax_subnumber: string
          relationship_type?: Database["public"]["Enums"]["income_relationship_type"]
          reporting_status?: Database["public"]["Enums"]["payroll_reporting_status"]
          starts_on: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          created_at?: string
          deleted_at?: string | null
          employee_id?: string
          ends_on?: string | null
          id?: string
          ikv_number?: number
          payroll_tax_subnumber?: string
          relationship_type?: Database["public"]["Enums"]["income_relationship_type"]
          reporting_status?: Database["public"]["Enums"]["payroll_reporting_status"]
          starts_on?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_relationships_administration_same_tenant_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "income_relationships_employee_same_tenant_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "income_relationships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_families: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_families_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_group_jobs: {
        Row: {
          created_at: string
          hr_group_id: string
          job_group_id: string
          job_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          job_group_id: string
          job_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          job_group_id?: string
          job_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_group_jobs_group_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "job_group_id"]
            isOneToOne: false
            referencedRelation: "job_groups"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "job_group_jobs_group_tenant_fkey"
            columns: ["tenant_id", "job_group_id"]
            isOneToOne: false
            referencedRelation: "job_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "job_group_jobs_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "job_group_jobs_job_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "job_group_jobs_job_tenant_fkey"
            columns: ["tenant_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "job_group_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_groups: {
        Row: {
          code: string
          created_at: string
          description: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          job_family_id: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          job_family_id?: string | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          job_family_id?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_groups_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "job_groups_job_family_tenant_fkey"
            columns: ["tenant_id", "job_family_id"]
            isOneToOne: false
            referencedRelation: "job_families"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      job_profile_capability_requirements: {
        Row: {
          capability_id: string
          certificate_details: Json | null
          created_at: string
          id: string
          language_level: string | null
          profile_version_id: string
          rationale: string | null
          requirement_type: string
          sort_order: number
          target_level_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          capability_id: string
          certificate_details?: Json | null
          created_at?: string
          id?: string
          language_level?: string | null
          profile_version_id: string
          rationale?: string | null
          requirement_type?: string
          sort_order?: number
          target_level_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          capability_id?: string
          certificate_details?: Json | null
          created_at?: string
          id?: string
          language_level?: string | null
          profile_version_id?: string
          rationale?: string | null
          requirement_type?: string
          sort_order?: number
          target_level_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_profile_capability_requir_tenant_id_profile_version_id_fkey"
            columns: ["tenant_id", "profile_version_id"]
            isOneToOne: false
            referencedRelation: "job_profile_versions"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "job_profile_capability_requireme_tenant_id_target_level_id_fkey"
            columns: ["tenant_id", "target_level_id"]
            isOneToOne: false
            referencedRelation: "talent_levels"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "job_profile_capability_requirement_tenant_id_capability_id_fkey"
            columns: ["tenant_id", "capability_id"]
            isOneToOne: false
            referencedRelation: "talent_capabilities"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "job_profile_capability_requirements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_profile_versions: {
        Row: {
          activated_at: string | null
          activated_by_user_id: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          job_profile_id: string
          organizational_context: string | null
          purpose: string | null
          responsibilities: Json
          result_areas: Json
          status: string
          summary: string | null
          tasks: Json
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          valid_from: string | null
          valid_until: string | null
          version_number: number
        }
        Insert: {
          activated_at?: string | null
          activated_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          job_profile_id: string
          organizational_context?: string | null
          purpose?: string | null
          responsibilities?: Json
          result_areas?: Json
          status?: string
          summary?: string | null
          tasks?: Json
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version_number: number
        }
        Update: {
          activated_at?: string | null
          activated_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          job_profile_id?: string
          organizational_context?: string | null
          purpose?: string | null
          responsibilities?: Json
          result_areas?: Json
          status?: string
          summary?: string | null
          tasks?: Json
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_profile_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profile_versions_tenant_id_job_profile_id_fkey"
            columns: ["tenant_id", "job_profile_id"]
            isOneToOne: false
            referencedRelation: "job_profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "job_profile_versions_tenant_id_job_profile_id_fkey"
            columns: ["tenant_id", "job_profile_id"]
            isOneToOne: false
            referencedRelation: "talent_job_profile_readmodel"
            referencedColumns: ["tenant_id", "job_profile_id"]
          },
        ]
      }
      job_profiles: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          job_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          job_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          job_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profiles_tenant_id_job_id_fkey"
            columns: ["tenant_id", "job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      job_revisions: {
        Row: {
          created_at: string
          description: string | null
          hr_group_id: string
          id: string
          job_id: string
          name: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          hr_group_id: string
          id?: string
          job_id: string
          name: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          hr_group_id?: string
          id?: string
          job_id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_revisions_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "job_revisions_job_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "job_revisions_job_tenant_fkey"
            columns: ["tenant_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      jobs: {
        Row: {
          code: string
          created_at: string
          hr_group_id: string
          id: string
          is_active: boolean
          job_group_id: string
          seniority_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          hr_group_id: string
          id?: string
          is_active?: boolean
          job_group_id: string
          seniority_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          hr_group_id?: string
          id?: string
          is_active?: boolean
          job_group_id?: string
          seniority_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "jobs_job_group_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "job_group_id"]
            isOneToOne: false
            referencedRelation: "job_groups"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "jobs_job_group_tenant_fkey"
            columns: ["tenant_id", "job_group_id"]
            isOneToOne: false
            referencedRelation: "job_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "jobs_seniority_tenant_fkey"
            columns: ["tenant_id", "seniority_id"]
            isOneToOne: false
            referencedRelation: "talent_seniorities"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      journey_moments: {
        Row: {
          availability_offset_days: number
          available_on: string
          date_offset_days: number
          hr_group_id: string
          id: string
          journey_id: string
          key: string
          name: Json
          phase_id: string
          scheduled_on: string
          sort_order: number
          template_moment_id: string
          tenant_id: string
        }
        Insert: {
          availability_offset_days: number
          available_on: string
          date_offset_days: number
          hr_group_id: string
          id?: string
          journey_id: string
          key: string
          name: Json
          phase_id: string
          scheduled_on: string
          sort_order: number
          template_moment_id: string
          tenant_id: string
        }
        Update: {
          availability_offset_days?: number
          available_on?: string
          date_offset_days?: number
          hr_group_id?: string
          id?: string
          journey_id?: string
          key?: string
          name?: Json
          phase_id?: string
          scheduled_on?: string
          sort_order?: number
          template_moment_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_moments_template_moment_id_fkey"
            columns: ["template_moment_id"]
            isOneToOne: false
            referencedRelation: "journey_template_moments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_moments_tenant_id_hr_group_id_journey_id_fkey"
            columns: ["tenant_id", "hr_group_id", "journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "journey_moments_tenant_id_hr_group_id_journey_id_phase_id_fkey"
            columns: ["tenant_id", "hr_group_id", "journey_id", "phase_id"]
            isOneToOne: false
            referencedRelation: "journey_phases"
            referencedColumns: ["tenant_id", "hr_group_id", "journey_id", "id"]
          },
        ]
      }
      journey_participant_changes: {
        Row: {
          changed_at: string
          changed_by_user_id: string
          hr_group_id: string
          id: string
          journey_id: string
          previous_participant_id: string
          reason: string
          replacement_participant_id: string
          tenant_id: string
        }
        Insert: {
          changed_at?: string
          changed_by_user_id: string
          hr_group_id: string
          id?: string
          journey_id: string
          previous_participant_id: string
          reason: string
          replacement_participant_id: string
          tenant_id: string
        }
        Update: {
          changed_at?: string
          changed_by_user_id?: string
          hr_group_id?: string
          id?: string
          journey_id?: string
          previous_participant_id?: string
          reason?: string
          replacement_participant_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_participant_changes_previous_participant_id_fkey"
            columns: ["previous_participant_id"]
            isOneToOne: false
            referencedRelation: "journey_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_participant_changes_replacement_participant_id_fkey"
            columns: ["replacement_participant_id"]
            isOneToOne: false
            referencedRelation: "journey_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_participant_changes_tenant_id_hr_group_id_journey__fkey"
            columns: ["tenant_id", "hr_group_id", "journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      journey_participants: {
        Row: {
          assigned_at: string
          created_at: string
          employee_id: string
          ended_at: string | null
          hr_group_id: string
          id: string
          journey_id: string
          replaced_by_participant_id: string | null
          resolution_note: string | null
          resolver_role_code: string | null
          role_key: string
          role_name: Json
          source: Database["public"]["Enums"]["journey_participant_source"]
          status: Database["public"]["Enums"]["journey_participant_status"]
          template_role_id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          employee_id: string
          ended_at?: string | null
          hr_group_id: string
          id?: string
          journey_id: string
          replaced_by_participant_id?: string | null
          resolution_note?: string | null
          resolver_role_code?: string | null
          role_key: string
          role_name: Json
          source: Database["public"]["Enums"]["journey_participant_source"]
          status?: Database["public"]["Enums"]["journey_participant_status"]
          template_role_id: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          employee_id?: string
          ended_at?: string | null
          hr_group_id?: string
          id?: string
          journey_id?: string
          replaced_by_participant_id?: string | null
          resolution_note?: string | null
          resolver_role_code?: string | null
          role_key?: string
          role_name?: Json
          source?: Database["public"]["Enums"]["journey_participant_source"]
          status?: Database["public"]["Enums"]["journey_participant_status"]
          template_role_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_participants_replaced_by_participant_id_fkey"
            columns: ["replaced_by_participant_id"]
            isOneToOne: false
            referencedRelation: "journey_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_participants_template_role_id_fkey"
            columns: ["template_role_id"]
            isOneToOne: false
            referencedRelation: "journey_template_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_participants_tenant_id_hr_group_id_employee_id_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "journey_participants_tenant_id_hr_group_id_journey_id_fkey"
            columns: ["tenant_id", "hr_group_id", "journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      journey_phases: {
        Row: {
          hr_group_id: string
          id: string
          journey_id: string
          key: string
          name: Json
          sort_order: number
          template_phase_id: string
          tenant_id: string
        }
        Insert: {
          hr_group_id: string
          id?: string
          journey_id: string
          key: string
          name: Json
          sort_order: number
          template_phase_id: string
          tenant_id: string
        }
        Update: {
          hr_group_id?: string
          id?: string
          journey_id?: string
          key?: string
          name?: Json
          sort_order?: number
          template_phase_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_phases_template_phase_id_fkey"
            columns: ["template_phase_id"]
            isOneToOne: false
            referencedRelation: "journey_template_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_phases_tenant_id_hr_group_id_journey_id_fkey"
            columns: ["tenant_id", "hr_group_id", "journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      journey_reminder_links: {
        Row: {
          created_at: string
          hr_group_id: string
          id: string
          journey_id: string
          moment_id: string
          participant_id: string
          reminder_id: string
          status: Database["public"]["Enums"]["journey_reminder_link_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          id?: string
          journey_id: string
          moment_id: string
          participant_id: string
          reminder_id: string
          status?: Database["public"]["Enums"]["journey_reminder_link_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          id?: string
          journey_id?: string
          moment_id?: string
          participant_id?: string
          reminder_id?: string
          status?: Database["public"]["Enums"]["journey_reminder_link_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_reminder_links_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: true
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_reminder_links_tenant_id_hr_group_id_journey_id_fkey"
            columns: ["tenant_id", "hr_group_id", "journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "journey_reminder_links_tenant_id_hr_group_id_journey_id_mo_fkey"
            columns: ["tenant_id", "hr_group_id", "journey_id", "moment_id"]
            isOneToOne: false
            referencedRelation: "journey_moments"
            referencedColumns: ["tenant_id", "hr_group_id", "journey_id", "id"]
          },
          {
            foreignKeyName: "journey_reminder_links_tenant_id_hr_group_id_journey_id_pa_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "journey_id",
              "participant_id",
            ]
            isOneToOne: false
            referencedRelation: "journey_participants"
            referencedColumns: ["tenant_id", "hr_group_id", "journey_id", "id"]
          },
        ]
      }
      journey_template_moments: {
        Row: {
          availability_offset_days: number
          date_offset_days: number
          hr_group_id: string
          id: string
          key: string
          name: Json
          phase_id: string
          sort_order: number
          template_version_id: string
          tenant_id: string
        }
        Insert: {
          availability_offset_days: number
          date_offset_days: number
          hr_group_id: string
          id?: string
          key: string
          name: Json
          phase_id: string
          sort_order: number
          template_version_id: string
          tenant_id: string
        }
        Update: {
          availability_offset_days?: number
          date_offset_days?: number
          hr_group_id?: string
          id?: string
          key?: string
          name?: Json
          phase_id?: string
          sort_order?: number
          template_version_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_template_moments_tenant_id_hr_group_id_template_v_fkey1"
            columns: [
              "tenant_id",
              "hr_group_id",
              "template_version_id",
              "phase_id",
            ]
            isOneToOne: false
            referencedRelation: "journey_template_phases"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "template_version_id",
              "id",
            ]
          },
          {
            foreignKeyName: "journey_template_moments_tenant_id_hr_group_id_template_ve_fkey"
            columns: ["tenant_id", "hr_group_id", "template_version_id"]
            isOneToOne: false
            referencedRelation: "journey_template_versions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      journey_template_phases: {
        Row: {
          hr_group_id: string
          id: string
          key: string
          name: Json
          sort_order: number
          template_version_id: string
          tenant_id: string
        }
        Insert: {
          hr_group_id: string
          id?: string
          key: string
          name: Json
          sort_order: number
          template_version_id: string
          tenant_id: string
        }
        Update: {
          hr_group_id?: string
          id?: string
          key?: string
          name?: Json
          sort_order?: number
          template_version_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_template_phases_tenant_id_hr_group_id_template_ver_fkey"
            columns: ["tenant_id", "hr_group_id", "template_version_id"]
            isOneToOne: false
            referencedRelation: "journey_template_versions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      journey_template_roles: {
        Row: {
          cardinality: Database["public"]["Enums"]["journey_role_cardinality"]
          hr_group_id: string
          id: string
          is_required: boolean
          key: string
          name: Json
          resolver_employee_id: string | null
          resolver_role_code: string | null
          resolver_type: Database["public"]["Enums"]["journey_role_resolver_type"]
          sort_order: number
          template_version_id: string
          tenant_id: string
        }
        Insert: {
          cardinality: Database["public"]["Enums"]["journey_role_cardinality"]
          hr_group_id: string
          id?: string
          is_required?: boolean
          key: string
          name: Json
          resolver_employee_id?: string | null
          resolver_role_code?: string | null
          resolver_type: Database["public"]["Enums"]["journey_role_resolver_type"]
          sort_order: number
          template_version_id: string
          tenant_id: string
        }
        Update: {
          cardinality?: Database["public"]["Enums"]["journey_role_cardinality"]
          hr_group_id?: string
          id?: string
          is_required?: boolean
          key?: string
          name?: Json
          resolver_employee_id?: string | null
          resolver_role_code?: string | null
          resolver_type?: Database["public"]["Enums"]["journey_role_resolver_type"]
          sort_order?: number
          template_version_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_template_roles_tenant_id_hr_group_id_resolver_empl_fkey"
            columns: ["tenant_id", "hr_group_id", "resolver_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "journey_template_roles_tenant_id_hr_group_id_template_vers_fkey"
            columns: ["tenant_id", "hr_group_id", "template_version_id"]
            isOneToOne: false
            referencedRelation: "journey_template_versions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      journey_template_topic_audiences: {
        Row: {
          hr_group_id: string
          role_id: string
          template_version_id: string
          tenant_id: string
          topic_id: string
        }
        Insert: {
          hr_group_id: string
          role_id: string
          template_version_id: string
          tenant_id: string
          topic_id: string
        }
        Update: {
          hr_group_id?: string
          role_id?: string
          template_version_id?: string
          tenant_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_template_topic_audie_tenant_id_hr_group_id_templa_fkey1"
            columns: [
              "tenant_id",
              "hr_group_id",
              "template_version_id",
              "topic_id",
            ]
            isOneToOne: false
            referencedRelation: "journey_template_topics"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "template_version_id",
              "id",
            ]
          },
          {
            foreignKeyName: "journey_template_topic_audie_tenant_id_hr_group_id_templa_fkey2"
            columns: [
              "tenant_id",
              "hr_group_id",
              "template_version_id",
              "role_id",
            ]
            isOneToOne: false
            referencedRelation: "journey_template_roles"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "template_version_id",
              "id",
            ]
          },
          {
            foreignKeyName: "journey_template_topic_audien_tenant_id_hr_group_id_templa_fkey"
            columns: ["tenant_id", "hr_group_id", "template_version_id"]
            isOneToOne: false
            referencedRelation: "journey_template_versions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      journey_template_topics: {
        Row: {
          action_url: string | null
          body: Json
          hr_group_id: string
          id: string
          is_required: boolean
          key: string
          moment_id: string
          owner_role_id: string
          sort_order: number
          template_version_id: string
          tenant_id: string
          title: Json
          topic_type: Database["public"]["Enums"]["journey_topic_type"]
        }
        Insert: {
          action_url?: string | null
          body: Json
          hr_group_id: string
          id?: string
          is_required?: boolean
          key: string
          moment_id: string
          owner_role_id: string
          sort_order: number
          template_version_id: string
          tenant_id: string
          title: Json
          topic_type: Database["public"]["Enums"]["journey_topic_type"]
        }
        Update: {
          action_url?: string | null
          body?: Json
          hr_group_id?: string
          id?: string
          is_required?: boolean
          key?: string
          moment_id?: string
          owner_role_id?: string
          sort_order?: number
          template_version_id?: string
          tenant_id?: string
          title?: Json
          topic_type?: Database["public"]["Enums"]["journey_topic_type"]
        }
        Relationships: [
          {
            foreignKeyName: "journey_template_topics_tenant_id_hr_group_id_template_ve_fkey1"
            columns: [
              "tenant_id",
              "hr_group_id",
              "template_version_id",
              "moment_id",
            ]
            isOneToOne: false
            referencedRelation: "journey_template_moments"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "template_version_id",
              "id",
            ]
          },
          {
            foreignKeyName: "journey_template_topics_tenant_id_hr_group_id_template_ve_fkey2"
            columns: [
              "tenant_id",
              "hr_group_id",
              "template_version_id",
              "owner_role_id",
            ]
            isOneToOne: false
            referencedRelation: "journey_template_roles"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "template_version_id",
              "id",
            ]
          },
          {
            foreignKeyName: "journey_template_topics_tenant_id_hr_group_id_template_ver_fkey"
            columns: ["tenant_id", "hr_group_id", "template_version_id"]
            isOneToOne: false
            referencedRelation: "journey_template_versions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      journey_template_versions: {
        Row: {
          anchor_rule: Database["public"]["Enums"]["journey_anchor_rule"]
          created_at: string
          created_by_user_id: string
          hr_group_id: string
          id: string
          published_at: string | null
          published_by_user_id: string | null
          revision: number
          status: Database["public"]["Enums"]["journey_template_version_status"]
          template_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string
          version_number: number | null
        }
        Insert: {
          anchor_rule: Database["public"]["Enums"]["journey_anchor_rule"]
          created_at?: string
          created_by_user_id: string
          hr_group_id: string
          id?: string
          published_at?: string | null
          published_by_user_id?: string | null
          revision?: number
          status?: Database["public"]["Enums"]["journey_template_version_status"]
          template_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id: string
          version_number?: number | null
        }
        Update: {
          anchor_rule?: Database["public"]["Enums"]["journey_anchor_rule"]
          created_at?: string
          created_by_user_id?: string
          hr_group_id?: string
          id?: string
          published_at?: string | null
          published_by_user_id?: string | null
          revision?: number
          status?: Database["public"]["Enums"]["journey_template_version_status"]
          template_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_template_versions_tenant_id_hr_group_id_template_i_fkey"
            columns: ["tenant_id", "hr_group_id", "template_id"]
            isOneToOne: false
            referencedRelation: "journey_templates"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      journey_templates: {
        Row: {
          created_at: string
          created_by_user_id: string
          current_published_version_id: string | null
          description: Json
          hr_group_id: string
          id: string
          journey_type: Database["public"]["Enums"]["journey_type"]
          key: string
          lifecycle: Database["public"]["Enums"]["journey_template_lifecycle"]
          name: Json
          tenant_id: string
          updated_at: string
          updated_by_user_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          current_published_version_id?: string | null
          description: Json
          hr_group_id: string
          id?: string
          journey_type: Database["public"]["Enums"]["journey_type"]
          key: string
          lifecycle?: Database["public"]["Enums"]["journey_template_lifecycle"]
          name: Json
          tenant_id: string
          updated_at?: string
          updated_by_user_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          current_published_version_id?: string | null
          description?: Json
          hr_group_id?: string
          id?: string
          journey_type?: Database["public"]["Enums"]["journey_type"]
          key?: string
          lifecycle?: Database["public"]["Enums"]["journey_template_lifecycle"]
          name?: Json
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_templates_current_version_fk"
            columns: [
              "tenant_id",
              "hr_group_id",
              "current_published_version_id",
            ]
            isOneToOne: false
            referencedRelation: "journey_template_versions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "journey_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_templates_tenant_id_hr_group_id_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      journey_topic_assignments: {
        Row: {
          created_at: string
          hr_group_id: string
          id: string
          is_owner: boolean
          is_visible: boolean
          journey_id: string
          participant_id: string
          tenant_id: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          id?: string
          is_owner?: boolean
          is_visible?: boolean
          journey_id: string
          participant_id: string
          tenant_id: string
          topic_id: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          id?: string
          is_owner?: boolean
          is_visible?: boolean
          journey_id?: string
          participant_id?: string
          tenant_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_topic_assignments_tenant_id_hr_group_id_journey_i_fkey1"
            columns: ["tenant_id", "hr_group_id", "journey_id", "topic_id"]
            isOneToOne: false
            referencedRelation: "journey_topics"
            referencedColumns: ["tenant_id", "hr_group_id", "journey_id", "id"]
          },
          {
            foreignKeyName: "journey_topic_assignments_tenant_id_hr_group_id_journey_i_fkey2"
            columns: [
              "tenant_id",
              "hr_group_id",
              "journey_id",
              "participant_id",
            ]
            isOneToOne: false
            referencedRelation: "journey_participants"
            referencedColumns: ["tenant_id", "hr_group_id", "journey_id", "id"]
          },
          {
            foreignKeyName: "journey_topic_assignments_tenant_id_hr_group_id_journey_id_fkey"
            columns: ["tenant_id", "hr_group_id", "journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      journey_topic_outcomes: {
        Row: {
          actor_employee_id: string | null
          actor_user_id: string
          created_at: string
          hr_group_id: string
          id: string
          journey_id: string
          note: string | null
          outcome_type: Database["public"]["Enums"]["journey_topic_outcome_type"]
          participant_id: string | null
          tenant_id: string
          topic_id: string
        }
        Insert: {
          actor_employee_id?: string | null
          actor_user_id: string
          created_at?: string
          hr_group_id: string
          id?: string
          journey_id: string
          note?: string | null
          outcome_type: Database["public"]["Enums"]["journey_topic_outcome_type"]
          participant_id?: string | null
          tenant_id: string
          topic_id: string
        }
        Update: {
          actor_employee_id?: string | null
          actor_user_id?: string
          created_at?: string
          hr_group_id?: string
          id?: string
          journey_id?: string
          note?: string | null
          outcome_type?: Database["public"]["Enums"]["journey_topic_outcome_type"]
          participant_id?: string | null
          tenant_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_topic_outcomes_actor_employee_id_fkey"
            columns: ["actor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_topic_outcomes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "journey_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_topic_outcomes_tenant_id_hr_group_id_journey_id_fkey"
            columns: ["tenant_id", "hr_group_id", "journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "journey_topic_outcomes_tenant_id_hr_group_id_journey_id_to_fkey"
            columns: ["tenant_id", "hr_group_id", "journey_id", "topic_id"]
            isOneToOne: false
            referencedRelation: "journey_topics"
            referencedColumns: ["tenant_id", "hr_group_id", "journey_id", "id"]
          },
        ]
      }
      journey_topics: {
        Row: {
          action_url: string | null
          body: Json
          completed_at: string | null
          hr_group_id: string
          id: string
          is_required: boolean
          journey_id: string
          key: string
          moment_id: string
          owner_role_key: string
          sort_order: number
          status: Database["public"]["Enums"]["journey_topic_status"]
          template_topic_id: string
          tenant_id: string
          title: Json
          topic_type: Database["public"]["Enums"]["journey_topic_type"]
        }
        Insert: {
          action_url?: string | null
          body: Json
          completed_at?: string | null
          hr_group_id: string
          id?: string
          is_required: boolean
          journey_id: string
          key: string
          moment_id: string
          owner_role_key: string
          sort_order: number
          status?: Database["public"]["Enums"]["journey_topic_status"]
          template_topic_id: string
          tenant_id: string
          title: Json
          topic_type: Database["public"]["Enums"]["journey_topic_type"]
        }
        Update: {
          action_url?: string | null
          body?: Json
          completed_at?: string | null
          hr_group_id?: string
          id?: string
          is_required?: boolean
          journey_id?: string
          key?: string
          moment_id?: string
          owner_role_key?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["journey_topic_status"]
          template_topic_id?: string
          tenant_id?: string
          title?: Json
          topic_type?: Database["public"]["Enums"]["journey_topic_type"]
        }
        Relationships: [
          {
            foreignKeyName: "journey_topics_template_topic_id_fkey"
            columns: ["template_topic_id"]
            isOneToOne: false
            referencedRelation: "journey_template_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_topics_tenant_id_hr_group_id_journey_id_fkey"
            columns: ["tenant_id", "hr_group_id", "journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "journey_topics_tenant_id_hr_group_id_journey_id_moment_id_fkey"
            columns: ["tenant_id", "hr_group_id", "journey_id", "moment_id"]
            isOneToOne: false
            referencedRelation: "journey_moments"
            referencedColumns: ["tenant_id", "hr_group_id", "journey_id", "id"]
          },
        ]
      }
      journeys: {
        Row: {
          activated_at: string
          anchor_date: string
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string
          employment_id: string | null
          hr_group_id: string
          id: string
          idempotency_key: string
          paused_at: string | null
          status: Database["public"]["Enums"]["journey_status"]
          target_employee_id: string
          template_id: string
          template_name: Json
          template_version_id: string
          template_version_number: number
          tenant_id: string
          updated_at: string
          updated_by_user_id: string
          version: number
        }
        Insert: {
          activated_at?: string
          anchor_date: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id: string
          employment_id?: string | null
          hr_group_id: string
          id?: string
          idempotency_key: string
          paused_at?: string | null
          status: Database["public"]["Enums"]["journey_status"]
          target_employee_id: string
          template_id: string
          template_name: Json
          template_version_id: string
          template_version_number: number
          tenant_id: string
          updated_at?: string
          updated_by_user_id: string
          version?: number
        }
        Update: {
          activated_at?: string
          anchor_date?: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string
          employment_id?: string | null
          hr_group_id?: string
          id?: string
          idempotency_key?: string
          paused_at?: string | null
          status?: Database["public"]["Enums"]["journey_status"]
          target_employee_id?: string
          template_id?: string
          template_name?: Json
          template_version_id?: string
          template_version_number?: number
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "journeys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_tenant_id_hr_group_id_employment_id_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "journeys_tenant_id_hr_group_id_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "journeys_tenant_id_hr_group_id_target_employee_id_fkey"
            columns: ["tenant_id", "hr_group_id", "target_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "journeys_tenant_id_hr_group_id_template_id_fkey"
            columns: ["tenant_id", "hr_group_id", "template_id"]
            isOneToOne: false
            referencedRelation: "journey_templates"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "journeys_tenant_id_hr_group_id_template_version_id_fkey"
            columns: ["tenant_id", "hr_group_id", "template_version_id"]
            isOneToOne: false
            referencedRelation: "journey_template_versions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      labor_condition_salary_structures: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          hr_group_id: string
          id: string
          labor_condition_set_id: string
          salary_structure_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          hr_group_id: string
          id?: string
          labor_condition_set_id: string
          salary_structure_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          hr_group_id?: string
          id?: string
          labor_condition_set_id?: string
          salary_structure_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_condition_salary_structures_condition_fkey"
            columns: ["tenant_id", "hr_group_id", "labor_condition_set_id"]
            isOneToOne: false
            referencedRelation: "labor_condition_sets"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "labor_condition_salary_structures_structure_fkey"
            columns: ["tenant_id", "hr_group_id", "salary_structure_id"]
            isOneToOne: false
            referencedRelation: "salary_structures"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      labor_condition_sets: {
        Row: {
          administration_id: string
          code: string
          created_at: string
          hr_group_id: string
          id: string
          is_active: boolean
          name: string
          predecessor_id: string | null
          probation_maximum_months: number
          standard_hours_per_week: number
          tenant_id: string
          updated_at: string
          valid_from: string
        }
        Insert: {
          administration_id: string
          code: string
          created_at?: string
          hr_group_id: string
          id?: string
          is_active?: boolean
          name: string
          predecessor_id?: string | null
          probation_maximum_months?: number
          standard_hours_per_week?: number
          tenant_id: string
          updated_at?: string
          valid_from?: string
        }
        Update: {
          administration_id?: string
          code?: string
          created_at?: string
          hr_group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          predecessor_id?: string | null
          probation_maximum_months?: number
          standard_hours_per_week?: number
          tenant_id?: string
          updated_at?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "labor_condition_sets_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "labor_condition_sets_administration_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "labor_condition_sets_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "labor_condition_sets_predecessor_fkey"
            columns: ["tenant_id", "administration_id", "predecessor_id"]
            isOneToOne: false
            referencedRelation: "labor_condition_sets"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "labor_condition_sets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_accrual_exceptions: {
        Row: {
          accrual_amount: number | null
          administration_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          employment_id: string
          expiration_months: number | null
          hr_group_id: string
          id: string
          leave_type_id: string
          no_accrual: boolean
          reason: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          accrual_amount?: number | null
          administration_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          employment_id: string
          expiration_months?: number | null
          hr_group_id: string
          id?: string
          leave_type_id: string
          no_accrual?: boolean
          reason: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          accrual_amount?: number | null
          administration_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          employment_id?: string
          expiration_months?: number | null
          hr_group_id?: string
          id?: string
          leave_type_id?: string
          no_accrual?: boolean
          reason?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_accrual_exceptions_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "leave_accrual_exceptions_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_accrual_exceptions_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_accrual_exceptions_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_accrual_rule_pause_types: {
        Row: {
          accrual_rule_id: string
          administration_id: string | null
          created_at: string
          hr_group_id: string
          pause_leave_type_id: string
          tenant_id: string
        }
        Insert: {
          accrual_rule_id: string
          administration_id?: string | null
          created_at?: string
          hr_group_id: string
          pause_leave_type_id: string
          tenant_id: string
        }
        Update: {
          accrual_rule_id?: string
          administration_id?: string | null
          created_at?: string
          hr_group_id?: string
          pause_leave_type_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_accrual_rule_pause_types_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_accrual_rule_pause_types_rule_group_fkey"
            columns: ["tenant_id", "hr_group_id", "accrual_rule_id"]
            isOneToOne: false
            referencedRelation: "leave_accrual_rules"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_accrual_rule_pause_types_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "pause_leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_accrual_rule_work_hour_types: {
        Row: {
          accrual_rule_id: string
          administration_id: string | null
          created_at: string
          hr_group_id: string
          tenant_id: string
          work_hour_type_id: string
        }
        Insert: {
          accrual_rule_id: string
          administration_id?: string | null
          created_at?: string
          hr_group_id: string
          tenant_id: string
          work_hour_type_id: string
        }
        Update: {
          accrual_rule_id?: string
          administration_id?: string | null
          created_at?: string
          hr_group_id?: string
          tenant_id?: string
          work_hour_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_accrual_rule_work_hour_types_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_accrual_rule_work_hour_types_rule_group_fkey"
            columns: ["tenant_id", "hr_group_id", "accrual_rule_id"]
            isOneToOne: false
            referencedRelation: "leave_accrual_rules"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_accrual_rule_work_hour_types_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "work_hour_type_id"]
            isOneToOne: false
            referencedRelation: "work_hour_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_accrual_rules: {
        Row: {
          accrual_amount: number | null
          accrual_basis: Database["public"]["Enums"]["leave_accrual_basis"]
          accrual_frequency: Database["public"]["Enums"]["leave_accrual_frequency"]
          accrual_rate: number | null
          accrual_timing: Database["public"]["Enums"]["leave_accrual_timing"]
          administration_id: string | null
          created_at: string
          created_by: string | null
          expiration_months: number
          hr_group_id: string
          id: string
          leave_profile_id: string
          leave_type_id: string
          predecessor_rule_id: string | null
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          accrual_amount?: number | null
          accrual_basis: Database["public"]["Enums"]["leave_accrual_basis"]
          accrual_frequency: Database["public"]["Enums"]["leave_accrual_frequency"]
          accrual_rate?: number | null
          accrual_timing: Database["public"]["Enums"]["leave_accrual_timing"]
          administration_id?: string | null
          created_at?: string
          created_by?: string | null
          expiration_months: number
          hr_group_id: string
          id?: string
          leave_profile_id: string
          leave_type_id: string
          predecessor_rule_id?: string | null
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          accrual_amount?: number | null
          accrual_basis?: Database["public"]["Enums"]["leave_accrual_basis"]
          accrual_frequency?: Database["public"]["Enums"]["leave_accrual_frequency"]
          accrual_rate?: number | null
          accrual_timing?: Database["public"]["Enums"]["leave_accrual_timing"]
          administration_id?: string | null
          created_at?: string
          created_by?: string | null
          expiration_months?: number
          hr_group_id?: string
          id?: string
          leave_profile_id?: string
          leave_type_id?: string
          predecessor_rule_id?: string | null
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_accrual_rules_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_accrual_rules_predecessor_rule_id_fkey"
            columns: ["predecessor_rule_id"]
            isOneToOne: false
            referencedRelation: "leave_accrual_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_accrual_rules_profile_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_profile_id"]
            isOneToOne: false
            referencedRelation: "leave_profiles"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_accrual_rules_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_accrual_transactions: {
        Row: {
          actor_user_id: string | null
          administration_id: string
          amount: number
          bucket_id: string
          created_at: string
          employee_id: string
          employment_id: string
          hr_group_id: string
          id: string
          leave_type_id: string
          reason: string | null
          source_id: string | null
          source_key: string | null
          source_type: string
          tenant_id: string
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["leave_transaction_type"]
        }
        Insert: {
          actor_user_id?: string | null
          administration_id: string
          amount: number
          bucket_id: string
          created_at?: string
          employee_id: string
          employment_id: string
          hr_group_id: string
          id?: string
          leave_type_id: string
          reason?: string | null
          source_id?: string | null
          source_key?: string | null
          source_type: string
          tenant_id: string
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["leave_transaction_type"]
        }
        Update: {
          actor_user_id?: string | null
          administration_id?: string
          amount?: number
          bucket_id?: string
          created_at?: string
          employee_id?: string
          employment_id?: string
          hr_group_id?: string
          id?: string
          leave_type_id?: string
          reason?: string | null
          source_id?: string | null
          source_key?: string | null
          source_type?: string
          tenant_id?: string
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["leave_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "leave_accrual_transactions_bucket_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
              "leave_type_id",
              "bucket_id",
            ]
            isOneToOne: false
            referencedRelation: "leave_balance_buckets"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
              "leave_type_id",
              "id",
            ]
          },
          {
            foreignKeyName: "leave_accrual_transactions_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_accrual_transactions_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      leave_balance_buckets: {
        Row: {
          accrual_reference_date: string
          accrual_year: number
          administration_id: string
          created_at: string
          employee_id: string
          employment_id: string
          expiration_date: string
          hr_group_id: string
          id: string
          leave_type_id: string
          tenant_id: string
          total_accrued: number
          total_expired: number
          total_taken: number
          updated_at: string
        }
        Insert: {
          accrual_reference_date: string
          accrual_year: number
          administration_id: string
          created_at?: string
          employee_id: string
          employment_id: string
          expiration_date: string
          hr_group_id: string
          id?: string
          leave_type_id: string
          tenant_id: string
          total_accrued?: number
          total_expired?: number
          total_taken?: number
          updated_at?: string
        }
        Update: {
          accrual_reference_date?: string
          accrual_year?: number
          administration_id?: string
          created_at?: string
          employee_id?: string
          employment_id?: string
          expiration_date?: string
          hr_group_id?: string
          id?: string
          leave_type_id?: string
          tenant_id?: string
          total_accrued?: number
          total_expired?: number
          total_taken?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_balance_buckets_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "leave_balance_buckets_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_balance_buckets_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_balance_buckets_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_bonus_rules: {
        Row: {
          administration_id: string | null
          award_timing: Database["public"]["Enums"]["leave_bonus_award_timing"]
          created_at: string
          created_by: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          leave_profile_id: string
          leave_type_id: string
          name: string
          pro_rate_first_year: boolean
          tenant_id: string
          trigger_type: Database["public"]["Enums"]["leave_bonus_trigger_type"]
          updated_at: string
        }
        Insert: {
          administration_id?: string | null
          award_timing: Database["public"]["Enums"]["leave_bonus_award_timing"]
          created_at?: string
          created_by?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          leave_profile_id: string
          leave_type_id: string
          name: string
          pro_rate_first_year?: boolean
          tenant_id: string
          trigger_type: Database["public"]["Enums"]["leave_bonus_trigger_type"]
          updated_at?: string
        }
        Update: {
          administration_id?: string | null
          award_timing?: Database["public"]["Enums"]["leave_bonus_award_timing"]
          created_at?: string
          created_by?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          leave_profile_id?: string
          leave_type_id?: string
          name?: string
          pro_rate_first_year?: boolean
          tenant_id?: string
          trigger_type?: Database["public"]["Enums"]["leave_bonus_trigger_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_bonus_rules_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_bonus_rules_profile_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_profile_id"]
            isOneToOne: false
            referencedRelation: "leave_profiles"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_bonus_rules_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_bonus_tiers: {
        Row: {
          administration_id: string | null
          bonus_amount: number
          bonus_rule_id: string
          created_at: string
          hr_group_id: string
          id: string
          tenant_id: string
          threshold_years: number
          updated_at: string
        }
        Insert: {
          administration_id?: string | null
          bonus_amount: number
          bonus_rule_id: string
          created_at?: string
          hr_group_id: string
          id?: string
          tenant_id: string
          threshold_years: number
          updated_at?: string
        }
        Update: {
          administration_id?: string | null
          bonus_amount?: number
          bonus_rule_id?: string
          created_at?: string
          hr_group_id?: string
          id?: string
          tenant_id?: string
          threshold_years?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_bonus_tiers_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_bonus_tiers_rule_group_fkey"
            columns: ["tenant_id", "hr_group_id", "bonus_rule_id"]
            isOneToOne: false
            referencedRelation: "leave_bonus_rules"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_priority_rule_items: {
        Row: {
          administration_id: string | null
          created_at: string
          hr_group_id: string
          leave_type_id: string
          priority_rule_id: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          hr_group_id: string
          leave_type_id: string
          priority_rule_id: string
          sort_order: number
          tenant_id: string
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          hr_group_id?: string
          leave_type_id?: string
          priority_rule_id?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_priority_rule_items_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_priority_rule_items_rule_group_fkey"
            columns: ["tenant_id", "hr_group_id", "priority_rule_id"]
            isOneToOne: false
            referencedRelation: "leave_priority_rules"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_priority_rule_items_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_priority_rules: {
        Row: {
          administration_id: string | null
          created_at: string
          created_by: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          leave_profile_id: string
          name: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          created_by?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          leave_profile_id: string
          name: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          created_by?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          leave_profile_id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_priority_rules_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_priority_rules_profile_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_profile_id"]
            isOneToOne: false
            referencedRelation: "leave_profiles"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_profiles: {
        Row: {
          administration_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          is_group_default: boolean
          name: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          is_group_default?: boolean
          name: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          is_group_default?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_profiles_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_allocations: {
        Row: {
          administration_id: string
          allocated_hours: number
          bucket_id: string | null
          created_at: string
          employee_id: string
          employment_id: string
          hr_group_id: string
          id: string
          leave_type_id: string
          request_id: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          administration_id: string
          allocated_hours: number
          bucket_id?: string | null
          created_at?: string
          employee_id: string
          employment_id: string
          hr_group_id: string
          id?: string
          leave_type_id: string
          request_id: string
          sort_order: number
          tenant_id: string
        }
        Update: {
          administration_id?: string
          allocated_hours?: number
          bucket_id?: string | null
          created_at?: string
          employee_id?: string
          employment_id?: string
          hr_group_id?: string
          id?: string
          leave_type_id?: string
          request_id?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_request_allocations_bucket_group_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "employment_id",
              "leave_type_id",
              "bucket_id",
            ]
            isOneToOne: false
            referencedRelation: "leave_balance_buckets"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "employment_id",
              "leave_type_id",
              "id",
            ]
          },
          {
            foreignKeyName: "leave_request_allocations_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "leave_request_allocations_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_request_allocations_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_request_allocations_request_group_fkey"
            columns: ["tenant_id", "hr_group_id", "request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_request_allocations_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          actor_user_id: string
          administration_id: string
          created_at: string
          employee_id: string
          employment_id: string
          end_date: string
          hr_group_id: string
          id: string
          idempotency_key: string
          leave_type_id: string | null
          priority_rule_id: string | null
          request_mode: Database["public"]["Enums"]["leave_request_mode"]
          requested_minutes: number
          source: string
          specific_end: string | null
          specific_start: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_request_status"]
          tenant_id: string
          time_mode: Database["public"]["Enums"]["leave_request_time_mode"]
          updated_at: string
        }
        Insert: {
          actor_user_id: string
          administration_id: string
          created_at?: string
          employee_id: string
          employment_id: string
          end_date: string
          hr_group_id: string
          id?: string
          idempotency_key: string
          leave_type_id?: string | null
          priority_rule_id?: string | null
          request_mode: Database["public"]["Enums"]["leave_request_mode"]
          requested_minutes: number
          source?: string
          specific_end?: string | null
          specific_start?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          tenant_id: string
          time_mode: Database["public"]["Enums"]["leave_request_time_mode"]
          updated_at?: string
        }
        Update: {
          actor_user_id?: string
          administration_id?: string
          created_at?: string
          employee_id?: string
          employment_id?: string
          end_date?: string
          hr_group_id?: string
          id?: string
          idempotency_key?: string
          leave_type_id?: string | null
          priority_rule_id?: string | null
          request_mode?: Database["public"]["Enums"]["leave_request_mode"]
          requested_minutes?: number
          source?: string
          specific_end?: string | null
          specific_start?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          tenant_id?: string
          time_mode?: Database["public"]["Enums"]["leave_request_time_mode"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "leave_requests_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_requests_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_requests_priority_rule_group_fkey"
            columns: ["tenant_id", "hr_group_id", "priority_rule_id"]
            isOneToOne: false
            referencedRelation: "leave_priority_rules"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_settings: {
        Row: {
          administration_id: string | null
          created_at: string
          half_day_minutes: number
          hr_group_id: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          half_day_minutes?: number
          hr_group_id: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          half_day_minutes?: number
          hr_group_id?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_settings_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_type_overtime_work_hours: {
        Row: {
          administration_id: string | null
          created_at: string
          created_by: string | null
          hr_group_id: string
          leave_type_id: string
          tenant_id: string
          work_hour_type_id: string
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          created_by?: string | null
          hr_group_id: string
          leave_type_id: string
          tenant_id: string
          work_hour_type_id: string
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          created_by?: string | null
          hr_group_id?: string
          leave_type_id?: string
          tenant_id?: string
          work_hour_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_type_overtime_work_hours_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_type_overtime_work_hours_leave_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_type_overtime_work_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_type_overtime_work_hours_work_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "work_hour_type_id"]
            isOneToOne: false
            referencedRelation: "work_hour_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_types: {
        Row: {
          administration_id: string | null
          allow_limit_overrun: boolean
          annual_hours_cap: number | null
          annual_hours_fte_cap: number | null
          color_code: string
          created_at: string
          created_by: string | null
          entitlement_mode: Database["public"]["Enums"]["leave_type_entitlement_mode"]
          hr_group_id: string
          id: string
          is_active: boolean
          is_self_service: boolean
          is_system: boolean
          name: string
          notify_manager_on_request: boolean
          pin_in_calendar: boolean
          requires_manager_approval: boolean
          requires_manager_approval_on_cancellation: boolean
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          administration_id?: string | null
          allow_limit_overrun?: boolean
          annual_hours_cap?: number | null
          annual_hours_fte_cap?: number | null
          color_code?: string
          created_at?: string
          created_by?: string | null
          entitlement_mode?: Database["public"]["Enums"]["leave_type_entitlement_mode"]
          hr_group_id: string
          id?: string
          is_active?: boolean
          is_self_service?: boolean
          is_system?: boolean
          name: string
          notify_manager_on_request?: boolean
          pin_in_calendar?: boolean
          requires_manager_approval?: boolean
          requires_manager_approval_on_cancellation?: boolean
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          administration_id?: string | null
          allow_limit_overrun?: boolean
          annual_hours_cap?: number | null
          annual_hours_fte_cap?: number | null
          color_code?: string
          created_at?: string
          created_by?: string | null
          entitlement_mode?: Database["public"]["Enums"]["leave_type_entitlement_mode"]
          hr_group_id?: string
          id?: string
          is_active?: boolean
          is_self_service?: boolean
          is_system?: boolean
          name?: string
          notify_manager_on_request?: boolean
          pin_in_calendar?: boolean
          requires_manager_approval?: boolean
          requires_manager_approval_on_cancellation?: boolean
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_types_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_year_controls: {
        Row: {
          administration_id: string | null
          created_at: string
          hr_group_id: string
          id: string
          locked_at: string | null
          locked_by: string | null
          status: Database["public"]["Enums"]["leave_year_control_status"]
          tenant_id: string
          updated_at: string
          year: number
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          hr_group_id: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          status?: Database["public"]["Enums"]["leave_year_control_status"]
          tenant_id: string
          updated_at?: string
          year: number
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          hr_group_id?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          status?: Database["public"]["Enums"]["leave_year_control_status"]
          tenant_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_year_controls_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_year_controls_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_year_rollover_items: {
        Row: {
          administration_id: string | null
          carried_hours: number
          created_at: string
          employment_id: string
          hr_group_id: string
          id: string
          leave_type_id: string
          original_expiration_date: string
          rollover_id: string
          source_bucket_id: string
          tenant_id: string
        }
        Insert: {
          administration_id?: string | null
          carried_hours: number
          created_at?: string
          employment_id: string
          hr_group_id: string
          id?: string
          leave_type_id: string
          original_expiration_date: string
          rollover_id: string
          source_bucket_id: string
          tenant_id: string
        }
        Update: {
          administration_id?: string | null
          carried_hours?: number
          created_at?: string
          employment_id?: string
          hr_group_id?: string
          id?: string
          leave_type_id?: string
          original_expiration_date?: string
          rollover_id?: string
          source_bucket_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_year_rollover_items_bucket_group_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "employment_id",
              "leave_type_id",
              "source_bucket_id",
            ]
            isOneToOne: false
            referencedRelation: "leave_balance_buckets"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "employment_id",
              "leave_type_id",
              "id",
            ]
          },
          {
            foreignKeyName: "leave_year_rollover_items_employment_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_year_rollover_items_employment_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_year_rollover_items_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "leave_year_rollover_items_rollover_group_fkey"
            columns: ["tenant_id", "hr_group_id", "rollover_id"]
            isOneToOne: false
            referencedRelation: "leave_year_rollovers"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "leave_year_rollover_items_type_group_fkey"
            columns: ["tenant_id", "hr_group_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      leave_year_rollovers: {
        Row: {
          administration_id: string | null
          completed_at: string
          completed_by: string | null
          created_at: string
          from_year: number
          hr_group_id: string
          id: string
          tenant_id: string
          to_year: number
        }
        Insert: {
          administration_id?: string | null
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          from_year: number
          hr_group_id: string
          id?: string
          tenant_id: string
          to_year: number
        }
        Update: {
          administration_id?: string | null
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          from_year?: number
          hr_group_id?: string
          id?: string
          tenant_id?: string
          to_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_year_rollovers_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      management_roles: {
        Row: {
          code: string
          created_at: string
          deleted_at: string | null
          deputy_role_id: string | null
          description: string | null
          id: string
          is_active: boolean
          is_organization_scoped: boolean
          is_system: boolean
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          deleted_at?: string | null
          deputy_role_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_organization_scoped?: boolean
          is_system?: boolean
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          deleted_at?: string | null
          deputy_role_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_organization_scoped?: boolean
          is_system?: boolean
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_roles_deputy_role_id_fkey"
            columns: ["deputy_role_id"]
            isOneToOne: false
            referencedRelation: "management_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      overtime_type_exceptions: {
        Row: {
          administration_id: string | null
          allow_overtime_entry: boolean
          contract_hours_factor: number | null
          created_at: string
          created_by: string | null
          employee_id: string
          hr_group_id: string
          id: string
          is_self_service: boolean
          limit_hours: number | null
          limit_mode: Database["public"]["Enums"]["overtime_limit_mode"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
          work_hour_type_id: string
        }
        Insert: {
          administration_id?: string | null
          allow_overtime_entry?: boolean
          contract_hours_factor?: number | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          hr_group_id: string
          id?: string
          is_self_service?: boolean
          limit_hours?: number | null
          limit_mode?: Database["public"]["Enums"]["overtime_limit_mode"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          work_hour_type_id: string
        }
        Update: {
          administration_id?: string | null
          allow_overtime_entry?: boolean
          contract_hours_factor?: number | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          hr_group_id?: string
          id?: string
          is_self_service?: boolean
          limit_hours?: number | null
          limit_mode?: Database["public"]["Enums"]["overtime_limit_mode"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          work_hour_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_type_exceptions_employee_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "overtime_type_exceptions_scope_group_fkey"
            columns: ["tenant_id", "hr_group_id", "work_hour_type_id"]
            isOneToOne: false
            referencedRelation: "work_hour_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      overtime_type_settings: {
        Row: {
          administration_id: string | null
          contract_hours_factor: number | null
          created_at: string
          created_by: string | null
          hr_group_id: string
          id: string
          is_self_service: boolean
          limit_hours: number | null
          limit_mode: Database["public"]["Enums"]["overtime_limit_mode"]
          notify_manager_on_entry: boolean
          requires_manager_approval: boolean
          tenant_id: string
          updated_at: string
          updated_by: string | null
          work_hour_type_id: string
        }
        Insert: {
          administration_id?: string | null
          contract_hours_factor?: number | null
          created_at?: string
          created_by?: string | null
          hr_group_id: string
          id?: string
          is_self_service?: boolean
          limit_hours?: number | null
          limit_mode?: Database["public"]["Enums"]["overtime_limit_mode"]
          notify_manager_on_entry?: boolean
          requires_manager_approval?: boolean
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          work_hour_type_id: string
        }
        Update: {
          administration_id?: string | null
          contract_hours_factor?: number | null
          created_at?: string
          created_by?: string | null
          hr_group_id?: string
          id?: string
          is_self_service?: boolean
          limit_hours?: number | null
          limit_mode?: Database["public"]["Enums"]["overtime_limit_mode"]
          notify_manager_on_entry?: boolean
          requires_manager_approval?: boolean
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          work_hour_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "overtime_type_settings_scope_group_fkey"
            columns: ["tenant_id", "hr_group_id", "work_hour_type_id"]
            isOneToOne: false
            referencedRelation: "work_hour_types"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      payslips: {
        Row: {
          administration_id: string
          calendar_year: number
          checksum_sha256: string
          content_type: string
          employee_id: string
          employment_id: string
          file_size: number
          id: string
          import_source: string
          imported_at: string
          imported_by_user_id: string | null
          original_filename: string
          period_label: string
          storage_key: string
          tenant_id: string
        }
        Insert: {
          administration_id: string
          calendar_year: number
          checksum_sha256: string
          content_type: string
          employee_id: string
          employment_id: string
          file_size: number
          id?: string
          import_source: string
          imported_at?: string
          imported_by_user_id?: string | null
          original_filename: string
          period_label: string
          storage_key: string
          tenant_id: string
        }
        Update: {
          administration_id?: string
          calendar_year?: number
          checksum_sha256?: string
          content_type?: string
          employee_id?: string
          employment_id?: string
          file_size?: number
          id?: string
          import_source?: string
          imported_at?: string
          imported_by_user_id?: string | null
          original_filename?: string
          period_label?: string
          storage_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "payslips_employee_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "payslips_employment_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "payslips_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      personal_dashboard_widgets: {
        Row: {
          created_at: string
          dashboard_id: string
          id: string
          position: number
          settings: Json
          tenant_id: string
          updated_at: string
          widget_type: string
        }
        Insert: {
          created_at?: string
          dashboard_id: string
          id?: string
          position: number
          settings?: Json
          tenant_id: string
          updated_at?: string
          widget_type: string
        }
        Update: {
          created_at?: string
          dashboard_id?: string
          id?: string
          position?: number
          settings?: Json
          tenant_id?: string
          updated_at?: string
          widget_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_dashboard_widgets_dashboard_same_tenant_fkey"
            columns: ["tenant_id", "dashboard_id"]
            isOneToOne: false
            referencedRelation: "personal_dashboards"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      personal_dashboards: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          owner_user_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          owner_user_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_user_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_dashboards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          reason: string | null
          request_id: string
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          request_id?: string
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          request_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_operators: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          is_active: boolean
          role: Database["public"]["Enums"]["platform_operator_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["platform_operator_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["platform_operator_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_support_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          expires_at: string
          id: string
          mode: string
          operator_user_id: string
          reason: string
          started_at: string
          status: Database["public"]["Enums"]["platform_support_session_status"]
          tenant_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          expires_at: string
          id?: string
          mode?: string
          operator_user_id: string
          reason: string
          started_at?: string
          status?: Database["public"]["Enums"]["platform_support_session_status"]
          tenant_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          expires_at?: string
          id?: string
          mode?: string
          operator_user_id?: string
          reason?: string
          started_at?: string
          status?: Database["public"]["Enums"]["platform_support_session_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_support_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      process_definition_drafts: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          definition_json: Json
          hr_group_id: string
          id: string
          process_definition_id: string
          revision: number
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          validation_report: Json
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          definition_json: Json
          hr_group_id: string
          id?: string
          process_definition_id: string
          revision: number
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          validation_report?: Json
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          definition_json?: Json
          hr_group_id?: string
          id?: string
          process_definition_id?: string
          revision?: number
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          validation_report?: Json
        }
        Relationships: [
          {
            foreignKeyName: "process_definition_drafts_definition_fkey"
            columns: ["tenant_id", "hr_group_id", "process_definition_id"]
            isOneToOne: false
            referencedRelation: "process_definitions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      process_definitions: {
        Row: {
          administration_id: string | null
          created_at: string
          created_by_user_id: string | null
          description: Json | null
          hr_group_id: string
          id: string
          key: string
          scope_type: Database["public"]["Enums"]["access_scope_type"]
          status: Database["public"]["Enums"]["process_definition_status"]
          tenant_id: string
          title: Json
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: Json | null
          hr_group_id: string
          id?: string
          key: string
          scope_type?: Database["public"]["Enums"]["access_scope_type"]
          status?: Database["public"]["Enums"]["process_definition_status"]
          tenant_id: string
          title: Json
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: Json | null
          hr_group_id?: string
          id?: string
          key?: string
          scope_type?: Database["public"]["Enums"]["access_scope_type"]
          status?: Database["public"]["Enums"]["process_definition_status"]
          tenant_id?: string
          title?: Json
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_definitions_administration_fkey"
            columns: ["tenant_id", "hr_group_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_definitions_tenant_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      process_domain_commits: {
        Row: {
          adapter_key: string
          correlation_id: string | null
          created_at: string
          created_by_user_id: string
          hr_group_id: string
          id: string
          idempotency_key: string
          organization_placement_id: string | null
          process_instance_id: string
          result: Json
          tenant_id: string
          work_item_id: string
        }
        Insert: {
          adapter_key: string
          correlation_id?: string | null
          created_at?: string
          created_by_user_id?: string
          hr_group_id: string
          id?: string
          idempotency_key: string
          organization_placement_id?: string | null
          process_instance_id: string
          result: Json
          tenant_id: string
          work_item_id: string
        }
        Update: {
          adapter_key?: string
          correlation_id?: string | null
          created_at?: string
          created_by_user_id?: string
          hr_group_id?: string
          id?: string
          idempotency_key?: string
          organization_placement_id?: string | null
          process_instance_id?: string
          result?: Json
          tenant_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_domain_commits_process_instance_id_fkey"
            columns: ["process_instance_id"]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_domain_commits_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "process_work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      process_employee_subjects: {
        Row: {
          created_at: string
          employee_id: string
          hr_group_id: string
          process_instance_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          hr_group_id: string
          process_instance_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          hr_group_id?: string
          process_instance_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_employee_subjects_employee_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_employee_subjects_instance_fkey"
            columns: ["tenant_id", "hr_group_id", "process_instance_id"]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      process_employment_subjects: {
        Row: {
          administration_id: string
          created_at: string
          employment_id: string
          hr_group_id: string
          process_instance_id: string
          tenant_id: string
        }
        Insert: {
          administration_id: string
          created_at?: string
          employment_id: string
          hr_group_id: string
          process_instance_id: string
          tenant_id: string
        }
        Update: {
          administration_id?: string
          created_at?: string
          employment_id?: string
          hr_group_id?: string
          process_instance_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_employment_subjects_employment_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "administration_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "administration_id",
              "id",
            ]
          },
          {
            foreignKeyName: "process_employment_subjects_instance_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "administration_id",
              "process_instance_id",
            ]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "administration_id",
              "id",
            ]
          },
        ]
      }
      process_events: {
        Row: {
          actor_employee_id: string | null
          actor_user_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          hr_group_id: string
          id: string
          idempotency_key: string | null
          payload: Json
          process_instance_id: string
          sequence_number: number
          tenant_id: string
          work_item_id: string | null
        }
        Insert: {
          actor_employee_id?: string | null
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          hr_group_id: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          process_instance_id: string
          sequence_number: number
          tenant_id: string
          work_item_id?: string | null
        }
        Update: {
          actor_employee_id?: string | null
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          hr_group_id?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          process_instance_id?: string
          sequence_number?: number
          tenant_id?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "process_events_actor_employee_fkey"
            columns: ["tenant_id", "hr_group_id", "actor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_events_instance_fkey"
            columns: ["tenant_id", "hr_group_id", "process_instance_id"]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_events_work_item_fkey"
            columns: ["tenant_id", "hr_group_id", "work_item_id"]
            isOneToOne: false
            referencedRelation: "process_work_items"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      process_form_response_revisions: {
        Row: {
          changed_by_user_id: string | null
          correlation_id: string | null
          created_at: string
          current_values: Json
          expected_version: number
          hr_group_id: string
          id: string
          idempotency_key: string
          new_values: Json
          response_id: string
          revision: number
          tenant_id: string
        }
        Insert: {
          changed_by_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          current_values?: Json
          expected_version: number
          hr_group_id: string
          id?: string
          idempotency_key: string
          new_values?: Json
          response_id: string
          revision: number
          tenant_id: string
        }
        Update: {
          changed_by_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          current_values?: Json
          expected_version?: number
          hr_group_id?: string
          id?: string
          idempotency_key?: string
          new_values?: Json
          response_id?: string
          revision?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_form_response_revisions_response_fkey"
            columns: ["tenant_id", "hr_group_id", "response_id"]
            isOneToOne: false
            referencedRelation: "process_form_responses"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      process_form_responses: {
        Row: {
          correlation_id: string | null
          created_at: string
          current_values: Json
          expected_version: number
          form_key: string
          form_version_id: string | null
          hr_group_id: string
          id: string
          last_saved_by_user_id: string | null
          new_values: Json
          participant_key: string
          process_instance_id: string
          process_version_id: string
          revision: number
          status: string
          step_instance_id: string
          tenant_id: string
          updated_at: string
          work_item_id: string
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          current_values?: Json
          expected_version?: number
          form_key: string
          form_version_id?: string | null
          hr_group_id: string
          id?: string
          last_saved_by_user_id?: string | null
          new_values?: Json
          participant_key: string
          process_instance_id: string
          process_version_id: string
          revision?: number
          status?: string
          step_instance_id: string
          tenant_id: string
          updated_at?: string
          work_item_id: string
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          current_values?: Json
          expected_version?: number
          form_key?: string
          form_version_id?: string | null
          hr_group_id?: string
          id?: string
          last_saved_by_user_id?: string | null
          new_values?: Json
          participant_key?: string
          process_instance_id?: string
          process_version_id?: string
          revision?: number
          status?: string
          step_instance_id?: string
          tenant_id?: string
          updated_at?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_form_responses_form_version_fkey"
            columns: ["tenant_id", "hr_group_id", "form_version_id"]
            isOneToOne: false
            referencedRelation: "form_versions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_form_responses_instance_fkey"
            columns: ["tenant_id", "hr_group_id", "process_instance_id"]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_form_responses_step_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "process_instance_id",
              "step_instance_id",
            ]
            isOneToOne: false
            referencedRelation: "process_step_instances"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "process_instance_id",
              "id",
            ]
          },
          {
            foreignKeyName: "process_form_responses_version_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "process_instance_id",
              "process_version_id",
            ]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "id",
              "process_version_id",
            ]
          },
          {
            foreignKeyName: "process_form_responses_work_item_fkey"
            columns: ["tenant_id", "hr_group_id", "work_item_id"]
            isOneToOne: true
            referencedRelation: "process_work_items"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      process_instances: {
        Row: {
          administration_id: string | null
          business_effective_date: string | null
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          current_step_key: string | null
          hr_group_id: string
          id: string
          idempotency_key: string | null
          initiator_employee_id: string | null
          initiator_user_id: string
          instance_version: number
          metadata: Json
          process_definition_id: string
          process_version_id: string
          scope_type: Database["public"]["Enums"]["access_scope_type"]
          started_at: string | null
          status: Database["public"]["Enums"]["process_instance_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id?: string | null
          business_effective_date?: string | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          current_step_key?: string | null
          hr_group_id: string
          id?: string
          idempotency_key?: string | null
          initiator_employee_id?: string | null
          initiator_user_id: string
          instance_version?: number
          metadata?: Json
          process_definition_id: string
          process_version_id: string
          scope_type: Database["public"]["Enums"]["access_scope_type"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["process_instance_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string | null
          business_effective_date?: string | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          current_step_key?: string | null
          hr_group_id?: string
          id?: string
          idempotency_key?: string | null
          initiator_employee_id?: string | null
          initiator_user_id?: string
          instance_version?: number
          metadata?: Json
          process_definition_id?: string
          process_version_id?: string
          scope_type?: Database["public"]["Enums"]["access_scope_type"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["process_instance_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_instances_administration_fkey"
            columns: ["tenant_id", "hr_group_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_instances_definition_fkey"
            columns: ["tenant_id", "hr_group_id", "process_definition_id"]
            isOneToOne: false
            referencedRelation: "process_definitions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_instances_initiator_employee_fkey"
            columns: ["tenant_id", "hr_group_id", "initiator_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_instances_pinned_version_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "process_definition_id",
              "process_version_id",
            ]
            isOneToOne: false
            referencedRelation: "process_versions"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "process_definition_id",
              "id",
            ]
          },
          {
            foreignKeyName: "process_instances_tenant_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      process_outputs: {
        Row: {
          administration_id: string | null
          created_at: string
          document_id: string | null
          generated_at: string | null
          hr_group_id: string
          html_summary: string | null
          id: string
          last_error_code: string | null
          output_format: string
          output_key: string
          process_instance_id: string
          process_version_id: string
          status: Database["public"]["Enums"]["process_output_status"]
          subject_employee_id: string
          tenant_id: string
          title: Json
          updated_at: string
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          document_id?: string | null
          generated_at?: string | null
          hr_group_id: string
          html_summary?: string | null
          id?: string
          last_error_code?: string | null
          output_format: string
          output_key: string
          process_instance_id: string
          process_version_id: string
          status?: Database["public"]["Enums"]["process_output_status"]
          subject_employee_id: string
          tenant_id: string
          title: Json
          updated_at?: string
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          document_id?: string | null
          generated_at?: string | null
          hr_group_id?: string
          html_summary?: string | null
          id?: string
          last_error_code?: string | null
          output_format?: string
          output_key?: string
          process_instance_id?: string
          process_version_id?: string
          status?: Database["public"]["Enums"]["process_output_status"]
          subject_employee_id?: string
          tenant_id?: string
          title?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_outputs_tenant_id_hr_group_id_administration_id_fkey"
            columns: ["tenant_id", "hr_group_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_outputs_tenant_id_hr_group_id_process_instance_id__fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "process_instance_id",
              "process_version_id",
            ]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "id",
              "process_version_id",
            ]
          },
          {
            foreignKeyName: "process_outputs_tenant_id_hr_group_id_process_instance_id_fkey"
            columns: ["tenant_id", "hr_group_id", "process_instance_id"]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_outputs_tenant_id_hr_group_id_subject_employee_id_fkey"
            columns: ["tenant_id", "hr_group_id", "subject_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      process_recipe_activations: {
        Row: {
          activated_at: string
          activated_by_user_id: string
          hr_group_id: string
          id: string
          process_definition_id: string
          process_recipe_id: string
          tenant_id: string
        }
        Insert: {
          activated_at?: string
          activated_by_user_id?: string
          hr_group_id: string
          id?: string
          process_definition_id: string
          process_recipe_id: string
          tenant_id: string
        }
        Update: {
          activated_at?: string
          activated_by_user_id?: string
          hr_group_id?: string
          id?: string
          process_definition_id?: string
          process_recipe_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_recipe_activations_process_definition_id_fkey"
            columns: ["process_definition_id"]
            isOneToOne: true
            referencedRelation: "process_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_recipe_activations_process_recipe_id_fkey"
            columns: ["process_recipe_id"]
            isOneToOne: false
            referencedRelation: "process_recipe_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      process_recipe_catalog: {
        Row: {
          adapter_key: string
          created_at: string
          definition_json: Json
          description: Json
          id: string
          recipe_key: string
          recipe_version: number
          status: string
          title: Json
        }
        Insert: {
          adapter_key: string
          created_at?: string
          definition_json: Json
          description: Json
          id?: string
          recipe_key: string
          recipe_version: number
          status?: string
          title: Json
        }
        Update: {
          adapter_key?: string
          created_at?: string
          definition_json?: Json
          description?: Json
          id?: string
          recipe_key?: string
          recipe_version?: number
          status?: string
          title?: Json
        }
        Relationships: []
      }
      process_reminder_deliveries: {
        Row: {
          created_at: string
          hr_group_id: string
          id: string
          process_instance_id: string
          reminder_id: string
          step_instance_id: string
          tenant_id: string
          workflow_job_id: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          id?: string
          process_instance_id: string
          reminder_id: string
          step_instance_id: string
          tenant_id: string
          workflow_job_id: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          id?: string
          process_instance_id?: string
          reminder_id?: string
          step_instance_id?: string
          tenant_id?: string
          workflow_job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_reminder_deliveries_tenant_id_hr_group_id_process__fkey"
            columns: ["tenant_id", "hr_group_id", "process_instance_id"]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_reminder_deliveries_tenant_id_hr_group_id_process_fkey1"
            columns: [
              "tenant_id",
              "hr_group_id",
              "process_instance_id",
              "step_instance_id",
            ]
            isOneToOne: false
            referencedRelation: "process_step_instances"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "process_instance_id",
              "id",
            ]
          },
          {
            foreignKeyName: "process_reminder_deliveries_tenant_id_hr_group_id_workflow_fkey"
            columns: ["tenant_id", "hr_group_id", "workflow_job_id"]
            isOneToOne: true
            referencedRelation: "workflow_jobs"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_reminder_deliveries_tenant_id_reminder_id_fkey"
            columns: ["tenant_id", "reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      process_step_instances: {
        Row: {
          activated_at: string | null
          activation_number: number
          blocked_code: string | null
          completed_at: string | null
          created_at: string
          deadline_at: string | null
          expected_version: number
          hr_group_id: string
          id: string
          process_instance_id: string
          process_version_id: string
          status: Database["public"]["Enums"]["process_step_instance_status"]
          step_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activation_number?: number
          blocked_code?: string | null
          completed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          expected_version?: number
          hr_group_id: string
          id?: string
          process_instance_id: string
          process_version_id: string
          status?: Database["public"]["Enums"]["process_step_instance_status"]
          step_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activation_number?: number
          blocked_code?: string | null
          completed_at?: string | null
          created_at?: string
          deadline_at?: string | null
          expected_version?: number
          hr_group_id?: string
          id?: string
          process_instance_id?: string
          process_version_id?: string
          status?: Database["public"]["Enums"]["process_step_instance_status"]
          step_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_step_instances_instance_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "process_instance_id",
              "process_version_id",
            ]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "id",
              "process_version_id",
            ]
          },
        ]
      }
      process_versions: {
        Row: {
          compiler_version: string
          created_at: string
          definition_hash: string
          definition_json: Json
          hr_group_id: string
          id: string
          process_definition_id: string
          published_at: string
          published_by_user_id: string | null
          schema_version: number
          tenant_id: string
          version_number: number
        }
        Insert: {
          compiler_version: string
          created_at?: string
          definition_hash: string
          definition_json: Json
          hr_group_id: string
          id?: string
          process_definition_id: string
          published_at?: string
          published_by_user_id?: string | null
          schema_version: number
          tenant_id: string
          version_number: number
        }
        Update: {
          compiler_version?: string
          created_at?: string
          definition_hash?: string
          definition_json?: Json
          hr_group_id?: string
          id?: string
          process_definition_id?: string
          published_at?: string
          published_by_user_id?: string | null
          schema_version?: number
          tenant_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "process_versions_definition_fkey"
            columns: ["tenant_id", "hr_group_id", "process_definition_id"]
            isOneToOne: false
            referencedRelation: "process_definitions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      process_work_item_candidates: {
        Row: {
          ancestor_path: Json
          candidate_user_id: string | null
          created_at: string
          employee_id: string
          evidence: Json
          hr_group_id: string
          id: string
          ineligible_reason: string | null
          is_eligible: boolean
          management_role_code: string | null
          management_role_id: string | null
          resolution_date: string
          resolution_policy: string
          resolution_revision: number
          resolution_source: string
          source_department_id: string | null
          tenant_id: string
          work_item_id: string
        }
        Insert: {
          ancestor_path?: Json
          candidate_user_id?: string | null
          created_at?: string
          employee_id: string
          evidence?: Json
          hr_group_id: string
          id?: string
          ineligible_reason?: string | null
          is_eligible: boolean
          management_role_code?: string | null
          management_role_id?: string | null
          resolution_date: string
          resolution_policy: string
          resolution_revision?: number
          resolution_source: string
          source_department_id?: string | null
          tenant_id: string
          work_item_id: string
        }
        Update: {
          ancestor_path?: Json
          candidate_user_id?: string | null
          created_at?: string
          employee_id?: string
          evidence?: Json
          hr_group_id?: string
          id?: string
          ineligible_reason?: string | null
          is_eligible?: boolean
          management_role_code?: string | null
          management_role_id?: string | null
          resolution_date?: string
          resolution_policy?: string
          resolution_revision?: number
          resolution_source?: string
          source_department_id?: string | null
          tenant_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_work_item_candidates_employee_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_work_item_candidates_management_role_id_fkey"
            columns: ["management_role_id"]
            isOneToOne: false
            referencedRelation: "management_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_work_item_candidates_role_fkey"
            columns: ["management_role_id"]
            isOneToOne: false
            referencedRelation: "management_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_work_item_candidates_work_item_fkey"
            columns: ["tenant_id", "hr_group_id", "work_item_id"]
            isOneToOne: false
            referencedRelation: "process_work_items"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      process_work_item_notes: {
        Row: {
          action: string
          actor_user_id: string
          body: string
          correlation_id: string | null
          created_at: string
          hr_group_id: string
          id: string
          process_instance_id: string
          tenant_id: string
          work_item_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string
          body: string
          correlation_id?: string | null
          created_at?: string
          hr_group_id: string
          id?: string
          process_instance_id: string
          tenant_id: string
          work_item_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          body?: string
          correlation_id?: string | null
          created_at?: string
          hr_group_id?: string
          id?: string
          process_instance_id?: string
          tenant_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_work_item_notes_process_instance_id_fkey"
            columns: ["process_instance_id"]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "process_work_item_notes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "process_work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      process_work_items: {
        Row: {
          allow_self_assignment: boolean
          assignee_employee_id: string | null
          assignment_mode: Database["public"]["Enums"]["process_assignment_mode"]
          assignment_snapshot: Json
          available_at: string
          blocked_code: string | null
          claimed_at: string | null
          claimed_by_user_id: string | null
          created_at: string
          deadline_at: string | null
          expected_version: number
          hr_group_id: string
          id: string
          participant_key: string
          process_instance_id: string
          process_version_id: string
          status: Database["public"]["Enums"]["process_work_item_status"]
          step_instance_id: string
          step_key: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_self_assignment?: boolean
          assignee_employee_id?: string | null
          assignment_mode: Database["public"]["Enums"]["process_assignment_mode"]
          assignment_snapshot?: Json
          available_at?: string
          blocked_code?: string | null
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          deadline_at?: string | null
          expected_version?: number
          hr_group_id: string
          id?: string
          participant_key: string
          process_instance_id: string
          process_version_id: string
          status?: Database["public"]["Enums"]["process_work_item_status"]
          step_instance_id: string
          step_key: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_self_assignment?: boolean
          assignee_employee_id?: string | null
          assignment_mode?: Database["public"]["Enums"]["process_assignment_mode"]
          assignment_snapshot?: Json
          available_at?: string
          blocked_code?: string | null
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          created_at?: string
          deadline_at?: string | null
          expected_version?: number
          hr_group_id?: string
          id?: string
          participant_key?: string
          process_instance_id?: string
          process_version_id?: string
          status?: Database["public"]["Enums"]["process_work_item_status"]
          step_instance_id?: string
          step_key?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_work_items_assignee_employee_fkey"
            columns: ["tenant_id", "hr_group_id", "assignee_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_work_items_instance_fkey"
            columns: ["tenant_id", "hr_group_id", "process_instance_id"]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "process_work_items_step_instance_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "process_instance_id",
              "step_instance_id",
            ]
            isOneToOne: false
            referencedRelation: "process_step_instances"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "process_instance_id",
              "id",
            ]
          },
          {
            foreignKeyName: "process_work_items_version_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "process_instance_id",
              "process_version_id",
            ]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "id",
              "process_version_id",
            ]
          },
        ]
      }
      product_update_surface_dismissals: {
        Row: {
          channel: string
          created_at: string
          product_update_id: string
          seen_at: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          product_update_id: string
          seen_at?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          product_update_id?: string
          seen_at?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_update_surface_dismissals_product_update_id_fkey"
            columns: ["product_update_id"]
            isOneToOne: false
            referencedRelation: "product_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_update_surface_dismissals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_update_user_state: {
        Row: {
          created_at: string
          last_seen_at: string | null
          last_seen_update_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_seen_at?: string | null
          last_seen_update_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_seen_at?: string | null
          last_seen_update_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_update_user_state_last_seen_update_id_fkey"
            columns: ["last_seen_update_id"]
            isOneToOne: false
            referencedRelation: "product_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_update_user_state_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_updates: {
        Row: {
          audience_roles: string[]
          content: string
          created_at: string
          created_by_user_id: string | null
          display_channels: string[]
          ends_at: string | null
          id: string
          is_active: boolean
          kind: string
          starts_at: string | null
          summary: string
          tenant_id: string | null
          title: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          audience_roles?: string[]
          content: string
          created_at?: string
          created_by_user_id?: string | null
          display_channels?: string[]
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          starts_at?: string | null
          summary: string
          tenant_id?: string | null
          title: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          audience_roles?: string[]
          content?: string
          created_at?: string
          created_by_user_id?: string | null
          display_channels?: string[]
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          starts_at?: string | null
          summary?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_updates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_application_answers: {
        Row: {
          application_id: string
          created_at: string
          hr_group_id: string
          id: string
          label_snapshot: string
          options_snapshot: Json
          tenant_id: string
          type_snapshot: Database["public"]["Enums"]["custom_field_type"]
          vacancy_question_id: string
          validation_snapshot: Json
          value: Json
        }
        Insert: {
          application_id: string
          created_at?: string
          hr_group_id: string
          id?: string
          label_snapshot: string
          options_snapshot?: Json
          tenant_id: string
          type_snapshot: Database["public"]["Enums"]["custom_field_type"]
          vacancy_question_id: string
          validation_snapshot?: Json
          value: Json
        }
        Update: {
          application_id?: string
          created_at?: string
          hr_group_id?: string
          id?: string
          label_snapshot?: string
          options_snapshot?: Json
          tenant_id?: string
          type_snapshot?: Database["public"]["Enums"]["custom_field_type"]
          vacancy_question_id?: string
          validation_snapshot?: Json
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_application_answe_tenant_id_hr_group_id_applic_fkey"
            columns: ["tenant_id", "hr_group_id", "application_id"]
            isOneToOne: false
            referencedRelation: "recruitment_applications"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_application_answe_tenant_id_hr_group_id_vacanc_fkey"
            columns: ["tenant_id", "hr_group_id", "vacancy_question_id"]
            isOneToOne: false
            referencedRelation: "recruitment_vacancy_questions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_applications: {
        Row: {
          active_stage_id: string | null
          administration_id: string | null
          anonymized_at: string | null
          candidate_id: string
          converted_at: string | null
          converted_by_user_id: string | null
          created_at: string
          created_by_user_id: string | null
          employee_id: string | null
          employment_id: string | null
          hr_group_id: string
          id: string
          motivation: string | null
          retention_due_at: string | null
          source: string
          tenant_id: string
          terminal_at: string | null
          terminal_note: string | null
          terminal_outcome: string | null
          terminal_reason: string | null
          updated_at: string
          updated_by_user_id: string | null
          vacancy_id: string
          version: number
        }
        Insert: {
          active_stage_id?: string | null
          administration_id?: string | null
          anonymized_at?: string | null
          candidate_id: string
          converted_at?: string | null
          converted_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          employee_id?: string | null
          employment_id?: string | null
          hr_group_id: string
          id?: string
          motivation?: string | null
          retention_due_at?: string | null
          source?: string
          tenant_id: string
          terminal_at?: string | null
          terminal_note?: string | null
          terminal_outcome?: string | null
          terminal_reason?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          vacancy_id: string
          version?: number
        }
        Update: {
          active_stage_id?: string | null
          administration_id?: string | null
          anonymized_at?: string | null
          candidate_id?: string
          converted_at?: string | null
          converted_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          employee_id?: string | null
          employment_id?: string | null
          hr_group_id?: string
          id?: string
          motivation?: string | null
          retention_due_at?: string | null
          source?: string
          tenant_id?: string
          terminal_at?: string | null
          terminal_note?: string | null
          terminal_outcome?: string | null
          terminal_reason?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          vacancy_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_applications_tenant_id_administration_id_emplo_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "employment_id",
            ]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employee_id",
              "id",
            ]
          },
          {
            foreignKeyName: "recruitment_applications_tenant_id_administration_id_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "recruitment_applications_tenant_id_employee_id_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "recruitment_applications_tenant_id_hr_group_id_active_stag_fkey"
            columns: ["tenant_id", "hr_group_id", "active_stage_id"]
            isOneToOne: false
            referencedRelation: "recruitment_pipeline_stages"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_applications_tenant_id_hr_group_id_candidate_i_fkey"
            columns: ["tenant_id", "hr_group_id", "candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_applications_tenant_id_hr_group_id_vacancy_id_fkey"
            columns: ["tenant_id", "hr_group_id", "vacancy_id"]
            isOneToOne: false
            referencedRelation: "recruitment_vacancies"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_assessment_scores: {
        Row: {
          anchor_snapshot: Json
          assessment_id: string
          characteristic_id: string
          created_at: string
          hr_group_id: string
          id: string
          note: string | null
          score: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          anchor_snapshot?: Json
          assessment_id: string
          characteristic_id: string
          created_at?: string
          hr_group_id: string
          id?: string
          note?: string | null
          score: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          anchor_snapshot?: Json
          assessment_id?: string
          characteristic_id?: string
          created_at?: string
          hr_group_id?: string
          id?: string
          note?: string | null
          score?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_assessment_scores_tenant_id_hr_group_id_assess_fkey"
            columns: ["tenant_id", "hr_group_id", "assessment_id"]
            isOneToOne: false
            referencedRelation: "recruitment_assessments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_assessment_scores_tenant_id_hr_group_id_charac_fkey"
            columns: ["tenant_id", "hr_group_id", "characteristic_id"]
            isOneToOne: false
            referencedRelation: "recruitment_characteristics"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_assessments: {
        Row: {
          application_id: string
          corrected_from_assessment_id: string | null
          correction_reason: string | null
          created_at: string
          hr_group_id: string
          id: string
          interview_id: string
          participation_id: string
          reviewer_employee_id: string
          revision: number
          status: string
          submitted_at: string | null
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          application_id: string
          corrected_from_assessment_id?: string | null
          correction_reason?: string | null
          created_at?: string
          hr_group_id: string
          id?: string
          interview_id: string
          participation_id: string
          reviewer_employee_id: string
          revision?: number
          status?: string
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          application_id?: string
          corrected_from_assessment_id?: string | null
          correction_reason?: string | null
          created_at?: string
          hr_group_id?: string
          id?: string
          interview_id?: string
          participation_id?: string
          reviewer_employee_id?: string
          revision?: number
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_assessments_tenant_id_hr_group_id_application__fkey"
            columns: ["tenant_id", "hr_group_id", "application_id"]
            isOneToOne: false
            referencedRelation: "recruitment_applications"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_assessments_tenant_id_hr_group_id_corrected_fr_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "corrected_from_assessment_id",
            ]
            isOneToOne: false
            referencedRelation: "recruitment_assessments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_assessments_tenant_id_hr_group_id_interview_id_fkey"
            columns: ["tenant_id", "hr_group_id", "interview_id"]
            isOneToOne: false
            referencedRelation: "recruitment_interviews"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_assessments_tenant_id_hr_group_id_participatio_fkey"
            columns: ["tenant_id", "hr_group_id", "participation_id"]
            isOneToOne: false
            referencedRelation: "recruitment_participations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_assessments_tenant_id_reviewer_employee_id_fkey"
            columns: ["tenant_id", "reviewer_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      recruitment_candidates: {
        Row: {
          anonymized_at: string | null
          created_at: string
          first_name: string
          hr_group_id: string
          id: string
          last_name: string
          normalized_email: string | null
          phone: string | null
          possible_duplicate: boolean
          private_email: string | null
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          anonymized_at?: string | null
          created_at?: string
          first_name: string
          hr_group_id: string
          id?: string
          last_name: string
          normalized_email?: string | null
          phone?: string | null
          possible_duplicate?: boolean
          private_email?: string | null
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          anonymized_at?: string | null
          created_at?: string
          first_name?: string
          hr_group_id?: string
          id?: string
          last_name?: string
          normalized_email?: string | null
          phone?: string | null
          possible_duplicate?: boolean
          private_email?: string | null
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_candidates_tenant_id_hr_group_id_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      recruitment_characteristics: {
        Row: {
          created_at: string
          description: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          name: string
          stable_code: string
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          name: string
          stable_code: string
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          stable_code?: string
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_characteristics_tenant_id_hr_group_id_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      recruitment_documents: {
        Row: {
          application_id: string
          checksum_sha256: string
          created_at: string
          deleted_at: string | null
          file_size: number
          hr_group_id: string
          id: string
          mime_type: string
          original_filename: string
          scan_status: string
          scanned_at: string | null
          scanner_reference: string | null
          scanner_result: Json
          storage_key: string
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          application_id: string
          checksum_sha256: string
          created_at?: string
          deleted_at?: string | null
          file_size: number
          hr_group_id: string
          id?: string
          mime_type: string
          original_filename: string
          scan_status?: string
          scanned_at?: string | null
          scanner_reference?: string | null
          scanner_result?: Json
          storage_key: string
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          application_id?: string
          checksum_sha256?: string
          created_at?: string
          deleted_at?: string | null
          file_size?: number
          hr_group_id?: string
          id?: string
          mime_type?: string
          original_filename?: string
          scan_status?: string
          scanned_at?: string | null
          scanner_reference?: string | null
          scanner_result?: Json
          storage_key?: string
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_documents_tenant_id_hr_group_id_application_id_fkey"
            columns: ["tenant_id", "hr_group_id", "application_id"]
            isOneToOne: false
            referencedRelation: "recruitment_applications"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_events: {
        Row: {
          actor_user_id: string | null
          application_id: string | null
          created_at: string
          event_type: string
          hr_group_id: string
          id: string
          idempotency_key: string | null
          payload: Json
          tenant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          application_id?: string | null
          created_at?: string
          event_type: string
          hr_group_id: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          tenant_id: string
        }
        Update: {
          actor_user_id?: string | null
          application_id?: string | null
          created_at?: string
          event_type?: string
          hr_group_id?: string
          id?: string
          idempotency_key?: string | null
          payload?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_events_tenant_id_hr_group_id_application_id_fkey"
            columns: ["tenant_id", "hr_group_id", "application_id"]
            isOneToOne: false
            referencedRelation: "recruitment_applications"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_interview_participants: {
        Row: {
          created_at: string
          hr_group_id: string
          id: string
          interview_id: string
          participation_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          id?: string
          interview_id: string
          participation_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          id?: string
          interview_id?: string
          participation_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_interview_partici_tenant_id_hr_group_id_interv_fkey"
            columns: ["tenant_id", "hr_group_id", "interview_id"]
            isOneToOne: false
            referencedRelation: "recruitment_interviews"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_interview_partici_tenant_id_hr_group_id_partic_fkey"
            columns: ["tenant_id", "hr_group_id", "participation_id"]
            isOneToOne: false
            referencedRelation: "recruitment_participations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_interviews: {
        Row: {
          application_id: string
          created_at: string
          criteria_snapshot: Json
          hr_group_id: string
          id: string
          preparation_snapshot: Json
          questions_snapshot: Json
          scheduled_at: string | null
          set_id: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          application_id: string
          created_at?: string
          criteria_snapshot?: Json
          hr_group_id: string
          id?: string
          preparation_snapshot?: Json
          questions_snapshot?: Json
          scheduled_at?: string | null
          set_id?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          application_id?: string
          created_at?: string
          criteria_snapshot?: Json
          hr_group_id?: string
          id?: string
          preparation_snapshot?: Json
          questions_snapshot?: Json
          scheduled_at?: string | null
          set_id?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_interviews_tenant_id_hr_group_id_application_i_fkey"
            columns: ["tenant_id", "hr_group_id", "application_id"]
            isOneToOne: false
            referencedRelation: "recruitment_applications"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_interviews_tenant_id_hr_group_id_set_id_fkey"
            columns: ["tenant_id", "hr_group_id", "set_id"]
            isOneToOne: false
            referencedRelation: "recruitment_sets"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_library_item_states: {
        Row: {
          created_at: string
          hr_group_id: string
          id: string
          is_enabled: boolean
          library_item_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          id?: string
          is_enabled?: boolean
          library_item_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          id?: string
          is_enabled?: boolean
          library_item_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_library_item_stat_tenant_id_hr_group_id_librar_fkey"
            columns: ["tenant_id", "hr_group_id", "library_item_id"]
            isOneToOne: true
            referencedRelation: "recruitment_library_items"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_library_items: {
        Row: {
          content: Json
          created_at: string
          created_by_user_id: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          item_type: string
          owner_type: string
          stable_code: string
          tenant_id: string
          title: string
          updated_at: string
          updated_by_user_id: string | null
          version: number
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by_user_id?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          item_type: string
          owner_type?: string
          stable_code: string
          tenant_id: string
          title: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Update: {
          content?: Json
          created_at?: string
          created_by_user_id?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          item_type?: string
          owner_type?: string
          stable_code?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_library_items_tenant_id_hr_group_id_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      recruitment_participations: {
        Row: {
          activated_at: string | null
          application_id: string
          assigned_at: string
          capabilities: string[]
          created_at: string
          employee_id: string
          hr_group_id: string
          id: string
          interview_id: string | null
          revoked_at: string | null
          status: string
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          activated_at?: string | null
          application_id: string
          assigned_at?: string
          capabilities?: string[]
          created_at?: string
          employee_id: string
          hr_group_id: string
          id?: string
          interview_id?: string | null
          revoked_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          activated_at?: string | null
          application_id?: string
          assigned_at?: string
          capabilities?: string[]
          created_at?: string
          employee_id?: string
          hr_group_id?: string
          id?: string
          interview_id?: string | null
          revoked_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_participations_tenant_id_employee_id_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "recruitment_participations_tenant_id_hr_group_id_applicati_fkey"
            columns: ["tenant_id", "hr_group_id", "application_id"]
            isOneToOne: false
            referencedRelation: "recruitment_applications"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_participations_tenant_id_hr_group_id_interview_fkey"
            columns: ["tenant_id", "hr_group_id", "interview_id"]
            isOneToOne: false
            referencedRelation: "recruitment_interviews"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_pipeline_stages: {
        Row: {
          code: string
          created_at: string
          created_by_user_id: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by_user_id?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by_user_id?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_pipeline_stages_tenant_id_hr_group_id_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      recruitment_public_intake_limits: {
        Row: {
          bucket_key_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          hr_group_id: string
          id: string
          proof_hash: string | null
          publication_id: string
          request_count: number
          tenant_id: string
          verified_at: string | null
          window_started_at: string
        }
        Insert: {
          bucket_key_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          hr_group_id: string
          id?: string
          proof_hash?: string | null
          publication_id: string
          request_count?: number
          tenant_id: string
          verified_at?: string | null
          window_started_at: string
        }
        Update: {
          bucket_key_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          hr_group_id?: string
          id?: string
          proof_hash?: string | null
          publication_id?: string
          request_count?: number
          tenant_id?: string
          verified_at?: string | null
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_public_intake_lim_tenant_id_hr_group_id_public_fkey"
            columns: ["tenant_id", "hr_group_id", "publication_id"]
            isOneToOne: false
            referencedRelation: "recruitment_publications"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_publications: {
        Row: {
          archived_at: string | null
          closed_at: string | null
          created_at: string
          hr_group_id: string
          id: string
          opened_at: string | null
          published_location: string | null
          published_payload: Json
          published_title: string
          slug: string
          status: string
          tenant_id: string
          updated_at: string
          vacancy_id: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          closed_at?: string | null
          created_at?: string
          hr_group_id: string
          id?: string
          opened_at?: string | null
          published_location?: string | null
          published_payload?: Json
          published_title: string
          slug: string
          status?: string
          tenant_id: string
          updated_at?: string
          vacancy_id: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          closed_at?: string | null
          created_at?: string
          hr_group_id?: string
          id?: string
          opened_at?: string | null
          published_location?: string | null
          published_payload?: Json
          published_title?: string
          slug?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          vacancy_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_publications_tenant_id_hr_group_id_vacancy_id_fkey"
            columns: ["tenant_id", "hr_group_id", "vacancy_id"]
            isOneToOne: false
            referencedRelation: "recruitment_vacancies"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_set_items: {
        Row: {
          created_at: string
          hr_group_id: string
          id: string
          library_item_id: string
          set_id: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          id?: string
          library_item_id: string
          set_id: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          id?: string
          library_item_id?: string
          set_id?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_set_items_tenant_id_hr_group_id_library_item_i_fkey"
            columns: ["tenant_id", "hr_group_id", "library_item_id"]
            isOneToOne: false
            referencedRelation: "recruitment_library_items"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_set_items_tenant_id_hr_group_id_set_id_fkey"
            columns: ["tenant_id", "hr_group_id", "set_id"]
            isOneToOne: false
            referencedRelation: "recruitment_sets"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_sets: {
        Row: {
          created_at: string
          description: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          name: string
          owner_type: string
          stable_code: string
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          name: string
          owner_type?: string
          stable_code: string
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_type?: string
          stable_code?: string
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_sets_tenant_id_hr_group_id_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      recruitment_settings: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          hr_group_id: string
          id: string
          public_branding: Json
          publication_defaults: Json
          retention_days: number
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          version: number
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          hr_group_id: string
          id?: string
          public_branding?: Json
          publication_defaults?: Json
          retention_days?: number
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          hr_group_id?: string
          id?: string
          public_branding?: Json
          publication_defaults?: Json
          retention_days?: number
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_settings_tenant_id_hr_group_id_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: true
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      recruitment_vacancies: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          hr_group_id: string
          id: string
          job_id: string | null
          location_label: string | null
          max_hours: number | null
          min_hours: number | null
          salary_max: number | null
          salary_min: number | null
          salary_visible: boolean
          status: string
          tenant_id: string
          title: string
          updated_at: string
          updated_by_user_id: string | null
          version: number
          work_mode: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          hr_group_id: string
          id?: string
          job_id?: string | null
          location_label?: string | null
          max_hours?: number | null
          min_hours?: number | null
          salary_max?: number | null
          salary_min?: number | null
          salary_visible?: boolean
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
          work_mode?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          hr_group_id?: string
          id?: string
          job_id?: string | null
          location_label?: string | null
          max_hours?: number | null
          min_hours?: number | null
          salary_max?: number | null
          salary_min?: number | null
          salary_visible?: boolean
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_vacancies_tenant_id_hr_group_id_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "recruitment_vacancies_tenant_id_hr_group_id_job_id_fkey"
            columns: ["tenant_id", "hr_group_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_vacancy_questions: {
        Row: {
          created_at: string
          definition_id: string
          hr_group_id: string
          id: string
          is_required: boolean
          label_snapshot: string
          options_snapshot: Json
          sort_order: number
          tenant_id: string
          type_snapshot: Database["public"]["Enums"]["custom_field_type"]
          updated_at: string
          vacancy_id: string
          validation_snapshot: Json
        }
        Insert: {
          created_at?: string
          definition_id: string
          hr_group_id: string
          id?: string
          is_required?: boolean
          label_snapshot: string
          options_snapshot?: Json
          sort_order?: number
          tenant_id: string
          type_snapshot: Database["public"]["Enums"]["custom_field_type"]
          updated_at?: string
          vacancy_id: string
          validation_snapshot?: Json
        }
        Update: {
          created_at?: string
          definition_id?: string
          hr_group_id?: string
          id?: string
          is_required?: boolean
          label_snapshot?: string
          options_snapshot?: Json
          sort_order?: number
          tenant_id?: string
          type_snapshot?: Database["public"]["Enums"]["custom_field_type"]
          updated_at?: string
          vacancy_id?: string
          validation_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_vacancy_questions_tenant_id_hr_group_id_defini_fkey"
            columns: ["tenant_id", "hr_group_id", "definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "recruitment_vacancy_questions_tenant_id_hr_group_id_vacanc_fkey"
            columns: ["tenant_id", "hr_group_id", "vacancy_id"]
            isOneToOne: false
            referencedRelation: "recruitment_vacancies"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      recruitment_vacancy_sections: {
        Row: {
          content: string
          created_at: string
          hr_group_id: string
          id: string
          is_visible: boolean
          section_type: string
          sort_order: number
          tenant_id: string
          title: string
          updated_at: string
          vacancy_id: string
          version: number
        }
        Insert: {
          content?: string
          created_at?: string
          hr_group_id: string
          id?: string
          is_visible?: boolean
          section_type: string
          sort_order: number
          tenant_id: string
          title?: string
          updated_at?: string
          vacancy_id: string
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          hr_group_id?: string
          id?: string
          is_visible?: boolean
          section_type?: string
          sort_order?: number
          tenant_id?: string
          title?: string
          updated_at?: string
          vacancy_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_vacancy_sections_tenant_id_hr_group_id_vacancy_fkey"
            columns: ["tenant_id", "hr_group_id", "vacancy_id"]
            isOneToOne: false
            referencedRelation: "recruitment_vacancies"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      relation_types: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name_en: string
          name_nl: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_en: string
          name_nl: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_en?: string
          name_nl?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relation_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_recipients: {
        Row: {
          completed_at: string | null
          created_at: string
          dismissed_at: string | null
          effective_remind_at: string
          employee_id: string | null
          id: string
          last_popup_at: string | null
          reminder_id: string
          snoozed_from: string | null
          status: Database["public"]["Enums"]["reminder_recipient_status"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          effective_remind_at: string
          employee_id?: string | null
          id?: string
          last_popup_at?: string | null
          reminder_id: string
          snoozed_from?: string | null
          status?: Database["public"]["Enums"]["reminder_recipient_status"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          effective_remind_at?: string
          employee_id?: string | null
          id?: string
          last_popup_at?: string | null
          reminder_id?: string
          snoozed_from?: string | null
          status?: Database["public"]["Enums"]["reminder_recipient_status"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_recipients_employee_same_tenant_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "reminder_recipients_reminder_same_tenant_fkey"
            columns: ["tenant_id", "reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      reminder_target_rules: {
        Row: {
          administration_id: string | null
          created_at: string
          id: string
          reminder_id: string
          target_department_id: string | null
          target_employee_id: string | null
          target_management_role_id: string | null
          target_type: Database["public"]["Enums"]["document_target_type"]
          tenant_id: string
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          id?: string
          reminder_id: string
          target_department_id?: string | null
          target_employee_id?: string | null
          target_management_role_id?: string | null
          target_type: Database["public"]["Enums"]["document_target_type"]
          tenant_id: string
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          id?: string
          reminder_id?: string
          target_department_id?: string | null
          target_employee_id?: string | null
          target_management_role_id?: string | null
          target_type?: Database["public"]["Enums"]["document_target_type"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_target_rules_target_management_role_id_fkey"
            columns: ["target_management_role_id"]
            isOneToOne: false
            referencedRelation: "management_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_target_rules_tenant_id_reminder_id_fkey"
            columns: ["tenant_id", "reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "reminder_target_rules_tenant_id_target_department_id_fkey"
            columns: ["tenant_id", "target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "reminder_target_rules_tenant_id_target_employee_id_fkey"
            columns: ["tenant_id", "target_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      reminder_targets: {
        Row: {
          administration_id: string | null
          created_at: string
          department_id: string | null
          employee_id: string | null
          id: string
          reminder_id: string
          tenant_id: string
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          department_id?: string | null
          employee_id?: string | null
          id?: string
          reminder_id: string
          tenant_id: string
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          department_id?: string | null
          employee_id?: string | null
          id?: string
          reminder_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_targets_department_same_tenant_fkey"
            columns: ["tenant_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "reminder_targets_employee_same_tenant_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "reminder_targets_reminder_same_tenant_fkey"
            columns: ["tenant_id", "reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      reminders: {
        Row: {
          administration_id: string | null
          cancelled_at: string | null
          created_at: string
          created_by_user_id: string
          description: string | null
          id: string
          published_at: string | null
          remind_at: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          status: Database["public"]["Enums"]["reminder_status"]
          target_type: Database["public"]["Enums"]["reminder_target_type"]
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          administration_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          published_at?: string | null
          remind_at: string
          reminder_type: Database["public"]["Enums"]["reminder_type"]
          status?: Database["public"]["Enums"]["reminder_status"]
          target_type: Database["public"]["Enums"]["reminder_target_type"]
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          administration_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string | null
          id?: string
          published_at?: string | null
          remind_at?: string
          reminder_type?: Database["public"]["Enums"]["reminder_type"]
          status?: Database["public"]["Enums"]["reminder_status"]
          target_type?: Database["public"]["Enums"]["reminder_target_type"]
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_administration_same_tenant_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "reminders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          management_role_id: string
          permission_id: string
        }
        Insert: {
          created_at?: string
          management_role_id: string
          permission_id: string
        }
        Update: {
          created_at?: string
          management_role_id?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_management_role_id_fkey"
            columns: ["management_role_id"]
            isOneToOne: false
            referencedRelation: "management_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_band_values: {
        Row: {
          code: string
          created_at: string
          hr_group_id: string
          id: string
          input_method: Database["public"]["Enums"]["salary_band_input_method"]
          input_spread_percentage: number | null
          maximum_amount: number | null
          midpoint_amount: number
          minimum_amount: number
          name: string
          salary_band_id: string
          salary_structure_revision_id: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          hr_group_id: string
          id?: string
          input_method: Database["public"]["Enums"]["salary_band_input_method"]
          input_spread_percentage?: number | null
          maximum_amount?: number | null
          midpoint_amount: number
          minimum_amount: number
          name: string
          salary_band_id: string
          salary_structure_revision_id: string
          sort_order: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          hr_group_id?: string
          id?: string
          input_method?: Database["public"]["Enums"]["salary_band_input_method"]
          input_spread_percentage?: number | null
          maximum_amount?: number | null
          midpoint_amount?: number
          minimum_amount?: number
          name?: string
          salary_band_id?: string
          salary_structure_revision_id?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_band_values_band_fkey"
            columns: ["tenant_id", "hr_group_id", "salary_band_id"]
            isOneToOne: false
            referencedRelation: "salary_bands"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "salary_band_values_revision_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "salary_structure_revision_id",
            ]
            isOneToOne: false
            referencedRelation: "salary_structure_revisions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      salary_bands: {
        Row: {
          created_at: string
          hr_group_id: string
          id: string
          identity_key: string
          salary_structure_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          id?: string
          identity_key: string
          salary_structure_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          id?: string
          identity_key?: string
          salary_structure_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_bands_structure_fkey"
            columns: ["tenant_id", "hr_group_id", "salary_structure_id"]
            isOneToOne: false
            referencedRelation: "salary_structures"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      salary_frequencies: {
        Row: {
          administration_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          periods_per_year: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          periods_per_year: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          periods_per_year?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_frequencies_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "salary_frequencies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_scale_revision_values: {
        Row: {
          code: string
          created_at: string
          default_months_to_next_step: number | null
          description: string | null
          hr_group_id: string
          id: string
          name: string
          progression_type: Database["public"]["Enums"]["salary_progression_type"]
          salary_scale_id: string
          salary_structure_revision_id: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_months_to_next_step?: number | null
          description?: string | null
          hr_group_id: string
          id?: string
          name: string
          progression_type?: Database["public"]["Enums"]["salary_progression_type"]
          salary_scale_id: string
          salary_structure_revision_id: string
          sort_order: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_months_to_next_step?: number | null
          description?: string | null
          hr_group_id?: string
          id?: string
          name?: string
          progression_type?: Database["public"]["Enums"]["salary_progression_type"]
          salary_scale_id?: string
          salary_structure_revision_id?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_scale_revision_values_revision_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "salary_structure_revision_id",
            ]
            isOneToOne: false
            referencedRelation: "salary_structure_revisions"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "salary_scale_revision_values_scale_fkey"
            columns: ["tenant_id", "hr_group_id", "salary_scale_id"]
            isOneToOne: false
            referencedRelation: "salary_scales"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      salary_scale_steps: {
        Row: {
          created_at: string
          currency_code: string
          fulltime_amount: number
          hourly_amount: number | null
          hr_group_id: string
          id: string
          months_to_next_step: number | null
          progression_type: Database["public"]["Enums"]["salary_progression_type"]
          salary_scale_id: string
          salary_structure_revision_id: string
          sequence_number: number
          step_code: string
          step_kind: Database["public"]["Enums"]["salary_step_kind"]
          step_name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          fulltime_amount: number
          hourly_amount?: number | null
          hr_group_id: string
          id?: string
          months_to_next_step?: number | null
          progression_type?: Database["public"]["Enums"]["salary_progression_type"]
          salary_scale_id: string
          salary_structure_revision_id: string
          sequence_number: number
          step_code: string
          step_kind?: Database["public"]["Enums"]["salary_step_kind"]
          step_name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          fulltime_amount?: number
          hourly_amount?: number | null
          hr_group_id?: string
          id?: string
          months_to_next_step?: number | null
          progression_type?: Database["public"]["Enums"]["salary_progression_type"]
          salary_scale_id?: string
          salary_structure_revision_id?: string
          sequence_number?: number
          step_code?: string
          step_kind?: Database["public"]["Enums"]["salary_step_kind"]
          step_name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_scale_steps_revision_membership_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "salary_structure_revision_id",
              "salary_scale_id",
            ]
            isOneToOne: false
            referencedRelation: "salary_scale_revision_values"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "salary_structure_revision_id",
              "salary_scale_id",
            ]
          },
        ]
      }
      salary_scales: {
        Row: {
          code: string
          created_at: string
          description: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          name: string
          salary_structure_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          name: string
          salary_structure_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          salary_structure_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_scales_structure_fkey"
            columns: ["tenant_id", "hr_group_id", "salary_structure_id"]
            isOneToOne: false
            referencedRelation: "salary_structures"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "salary_scales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_structure_migration_conflicts: {
        Row: {
          created_at: string
          hr_group_id: string
          id: string
          legacy_scale_code: string
          reason: string
          resolution: Json | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          salary_structure_ids: string[]
          source_administration_ids: string[]
          status: Database["public"]["Enums"]["salary_structure_migration_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          id?: string
          legacy_scale_code: string
          reason: string
          resolution?: Json | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          salary_structure_ids: string[]
          source_administration_ids: string[]
          status?: Database["public"]["Enums"]["salary_structure_migration_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          id?: string
          legacy_scale_code?: string
          reason?: string
          resolution?: Json | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          salary_structure_ids?: string[]
          source_administration_ids?: string[]
          status?: Database["public"]["Enums"]["salary_structure_migration_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_structure_migration_conflicts_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      salary_structure_revisions: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          currency_code: string
          description: string | null
          effective_from: string
          hr_group_id: string
          id: string
          lock_version: number
          published_at: string | null
          published_by_user_id: string | null
          revision_number: number
          salary_basis: Database["public"]["Enums"]["salary_structure_basis"]
          salary_structure_id: string
          status: Database["public"]["Enums"]["salary_revision_status"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string
          description?: string | null
          effective_from: string
          hr_group_id: string
          id?: string
          lock_version?: number
          published_at?: string | null
          published_by_user_id?: string | null
          revision_number: number
          salary_basis: Database["public"]["Enums"]["salary_structure_basis"]
          salary_structure_id: string
          status?: Database["public"]["Enums"]["salary_revision_status"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          currency_code?: string
          description?: string | null
          effective_from?: string
          hr_group_id?: string
          id?: string
          lock_version?: number
          published_at?: string | null
          published_by_user_id?: string | null
          revision_number?: number
          salary_basis?: Database["public"]["Enums"]["salary_structure_basis"]
          salary_structure_id?: string
          status?: Database["public"]["Enums"]["salary_revision_status"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_structure_revisions_structure_fkey"
            columns: ["tenant_id", "hr_group_id", "salary_structure_id"]
            isOneToOne: false
            referencedRelation: "salary_structures"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      salary_structures: {
        Row: {
          code: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          name: string
          structure_type: Database["public"]["Enums"]["salary_structure_type"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          name: string
          structure_type: Database["public"]["Enums"]["salary_structure_type"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          structure_type?: Database["public"]["Enums"]["salary_structure_type"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_structures_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      saved_analysis_definitions: {
        Row: {
          analysis_spec: Json
          created_at: string
          definition_version: number
          hr_group_id: string
          id: string
          name: string
          owner_user_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          analysis_spec: Json
          created_at?: string
          definition_version?: number
          hr_group_id: string
          id?: string
          name: string
          owner_user_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          analysis_spec?: Json
          created_at?: string
          definition_version?: number
          hr_group_id?: string
          id?: string
          name?: string
          owner_user_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_analysis_definitions_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "saved_analysis_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_guide_settings: {
        Row: {
          created_at: string
          created_by: string | null
          guide_code: string
          hr_group_id: string
          is_enabled: boolean
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          guide_code: string
          hr_group_id: string
          is_enabled?: boolean
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          guide_code?: string
          hr_group_id?: string
          is_enabled?: boolean
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setup_guide_settings_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "setup_guide_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_step_completion: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          guide_code: string
          hr_group_id: string
          is_completed: boolean
          step_key: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          guide_code: string
          hr_group_id: string
          is_completed?: boolean
          step_key: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          guide_code?: string
          hr_group_id?: string
          is_completed?: boolean
          step_key?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setup_step_completion_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "setup_step_completion_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      star_performer_assessment_tags: {
        Row: {
          assessment_id: string
          created_at: string
          tag_id: string
          tenant_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          tag_id: string
          tenant_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          tag_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "star_performer_assessment_tags_tenant_id_assessment_id_fkey"
            columns: ["tenant_id", "assessment_id"]
            isOneToOne: false
            referencedRelation: "star_performer_assessments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "star_performer_assessment_tags_tenant_id_tag_id_fkey"
            columns: ["tenant_id", "tag_id"]
            isOneToOne: false
            referencedRelation: "star_performer_tags"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      star_performer_assessments: {
        Row: {
          administration_id: string
          created_at: string
          criticality_level: number
          employee_id: string
          id: string
          job_group_id: string | null
          job_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          created_at?: string
          criticality_level: number
          employee_id: string
          id?: string
          job_group_id?: string | null
          job_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          created_at?: string
          criticality_level?: number
          employee_id?: string
          id?: string
          job_group_id?: string | null
          job_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "star_performer_assessments_group_tenant_fkey"
            columns: ["tenant_id", "job_group_id"]
            isOneToOne: false
            referencedRelation: "job_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "star_performer_assessments_job_tenant_fkey"
            columns: ["tenant_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "star_performer_assessments_tenant_id_administration_id_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "star_performer_assessments_tenant_id_employee_id_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      star_performer_tags: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "star_performer_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      statutory_minimum_wages: {
        Row: {
          administration_id: string
          country_code: string
          created_at: string
          currency_code: string
          hourly_amount: number
          id: string
          minimum_age: number
          source_url: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          administration_id: string
          country_code: string
          created_at?: string
          currency_code?: string
          hourly_amount: number
          id?: string
          minimum_age: number
          source_url: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          administration_id?: string
          country_code?: string
          created_at?: string
          currency_code?: string
          hourly_amount?: number
          id?: string
          minimum_age?: number
          source_url?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "statutory_minimum_wages_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "statutory_minimum_wages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      statutory_termination_reasons: {
        Row: {
          code: string
          created_at: string
          id: string
          label_en: string
          label_nl: string
          source_url: string
          source_year: number
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          label_en: string
          label_nl: string
          source_url: string
          source_year: number
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          label_en?: string
          label_nl?: string
          source_url?: string
          source_year?: number
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      survey_answers: {
        Row: {
          answer_text: string | null
          hr_group_id: string
          id: string
          matrix_row_id: string | null
          option_id: string | null
          question_id: string
          response_id: string
          survey_id: string
          tenant_id: string
        }
        Insert: {
          answer_text?: string | null
          hr_group_id: string
          id?: string
          matrix_row_id?: string | null
          option_id?: string | null
          question_id: string
          response_id: string
          survey_id: string
          tenant_id: string
        }
        Update: {
          answer_text?: string | null
          hr_group_id?: string
          id?: string
          matrix_row_id?: string | null
          option_id?: string | null
          question_id?: string
          response_id?: string
          survey_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_answers_matrix_row_fkey"
            columns: ["question_id", "matrix_row_id"]
            isOneToOne: false
            referencedRelation: "survey_matrix_rows"
            referencedColumns: ["question_id", "id"]
          },
          {
            foreignKeyName: "survey_answers_option_fkey"
            columns: ["question_id", "option_id"]
            isOneToOne: false
            referencedRelation: "survey_question_options"
            referencedColumns: ["question_id", "id"]
          },
          {
            foreignKeyName: "survey_answers_question_fkey"
            columns: ["tenant_id", "hr_group_id", "survey_id", "question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["tenant_id", "hr_group_id", "survey_id", "id"]
          },
          {
            foreignKeyName: "survey_answers_response_fkey"
            columns: ["tenant_id", "hr_group_id", "survey_id", "response_id"]
            isOneToOne: false
            referencedRelation: "survey_responses"
            referencedColumns: ["tenant_id", "hr_group_id", "survey_id", "id"]
          },
        ]
      }
      survey_invitations: {
        Row: {
          created_at: string
          employee_id: string
          has_submitted: boolean
          hr_group_id: string
          id: string
          last_reminded_at: string | null
          reminder_count: number
          submitted_at: string | null
          survey_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          has_submitted?: boolean
          hr_group_id: string
          id?: string
          last_reminded_at?: string | null
          reminder_count?: number
          submitted_at?: string | null
          survey_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          has_submitted?: boolean
          hr_group_id?: string
          id?: string
          last_reminded_at?: string | null
          reminder_count?: number
          submitted_at?: string | null
          survey_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_invitations_employee_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "survey_invitations_survey_fkey"
            columns: ["tenant_id", "hr_group_id", "survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      survey_matrix_rows: {
        Row: {
          hr_group_id: string
          id: string
          is_required: boolean
          order_index: number
          question_id: string
          row_label: string
          survey_id: string
          tenant_id: string
        }
        Insert: {
          hr_group_id: string
          id?: string
          is_required?: boolean
          order_index: number
          question_id: string
          row_label: string
          survey_id: string
          tenant_id: string
        }
        Update: {
          hr_group_id?: string
          id?: string
          is_required?: boolean
          order_index?: number
          question_id?: string
          row_label?: string
          survey_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_matrix_rows_question_fkey"
            columns: ["tenant_id", "hr_group_id", "survey_id", "question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["tenant_id", "hr_group_id", "survey_id", "id"]
          },
        ]
      }
      survey_question_options: {
        Row: {
          hr_group_id: string
          id: string
          option_label: string
          order_index: number
          question_id: string
          survey_id: string
          tenant_id: string
        }
        Insert: {
          hr_group_id: string
          id?: string
          option_label: string
          order_index: number
          question_id: string
          survey_id: string
          tenant_id: string
        }
        Update: {
          hr_group_id?: string
          id?: string
          option_label?: string
          order_index?: number
          question_id?: string
          survey_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_question_options_question_fkey"
            columns: ["tenant_id", "hr_group_id", "survey_id", "question_id"]
            isOneToOne: false
            referencedRelation: "survey_questions"
            referencedColumns: ["tenant_id", "hr_group_id", "survey_id", "id"]
          },
        ]
      }
      survey_questions: {
        Row: {
          created_at: string
          hr_group_id: string
          id: string
          is_required: boolean
          order_index: number
          question_text: string
          question_type: string
          survey_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          id?: string
          is_required?: boolean
          order_index: number
          question_text: string
          question_type: string
          survey_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          id?: string
          is_required?: boolean
          order_index?: number
          question_text?: string
          question_type?: string
          survey_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_fkey"
            columns: ["tenant_id", "hr_group_id", "survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          hr_group_id: string
          id: string
          respondent_employee_id: string | null
          submitted_at: string
          survey_id: string
          tenant_id: string
        }
        Insert: {
          hr_group_id: string
          id?: string
          respondent_employee_id?: string | null
          submitted_at?: string
          survey_id: string
          tenant_id: string
        }
        Update: {
          hr_group_id?: string
          id?: string
          respondent_employee_id?: string | null
          submitted_at?: string
          survey_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_employee_fkey"
            columns: ["tenant_id", "hr_group_id", "respondent_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "survey_responses_survey_fkey"
            columns: ["tenant_id", "hr_group_id", "survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      surveys: {
        Row: {
          activated_at: string | null
          closed_at: string | null
          created_at: string
          created_by: string
          description: string
          ends_at: string
          hr_group_id: string
          id: string
          is_anonymous: boolean
          starts_at: string
          status: string
          target_ids: string[]
          target_mode: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by: string
          description?: string
          ends_at: string
          hr_group_id: string
          id?: string
          is_anonymous?: boolean
          starts_at: string
          status?: string
          target_ids?: string[]
          target_mode: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          ends_at?: string
          hr_group_id?: string
          id?: string
          is_anonymous?: boolean
          starts_at?: string
          status?: string
          target_ids?: string[]
          target_mode?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "surveys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_assessment_answers: {
        Row: {
          answer_text: string | null
          created_at: string
          id: string
          item_id: string
          response_id: string
          score: number | null
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          answer_text?: string | null
          created_at?: string
          id?: string
          item_id: string
          response_id: string
          score?: number | null
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          answer_text?: string | null
          created_at?: string
          id?: string
          item_id?: string
          response_id?: string
          score?: number | null
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "talent_assessment_answers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_assessment_answers_tenant_id_item_id_fkey"
            columns: ["tenant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "talent_assessment_items"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_assessment_answers_tenant_id_response_id_fkey"
            columns: ["tenant_id", "response_id"]
            isOneToOne: false
            referencedRelation: "talent_assessment_responses"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      talent_assessment_cycles: {
        Row: {
          closes_on: string
          code: string
          created_at: string
          created_by_user_id: string | null
          description: string | null
          id: string
          name: string
          opens_on: string
          result_release_policy: string
          status: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          version: number
        }
        Insert: {
          closes_on: string
          code: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          name: string
          opens_on: string
          result_release_policy?: string
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Update: {
          closes_on?: string
          code?: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          name?: string
          opens_on?: string
          result_release_policy?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "talent_assessment_cycles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_assessment_items: {
        Row: {
          capability_id: string | null
          created_at: string
          created_by_user_id: string | null
          cycle_id: string
          id: string
          is_required: boolean
          max_score: number
          prompt: string
          sort_order: number
          tenant_id: string
          title: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          capability_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          cycle_id: string
          id?: string
          is_required?: boolean
          max_score?: number
          prompt: string
          sort_order?: number
          tenant_id: string
          title: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          capability_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          cycle_id?: string
          id?: string
          is_required?: boolean
          max_score?: number
          prompt?: string
          sort_order?: number
          tenant_id?: string
          title?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_assessment_items_tenant_id_capability_id_fkey"
            columns: ["tenant_id", "capability_id"]
            isOneToOne: false
            referencedRelation: "talent_capabilities"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_assessment_items_tenant_id_cycle_id_fkey"
            columns: ["tenant_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "talent_assessment_cycles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_assessment_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_assessment_private_notes: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          note_text: string
          response_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          note_text: string
          response_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          note_text?: string
          response_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_assessment_private_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_assessment_private_notes_tenant_id_response_id_fkey"
            columns: ["tenant_id", "response_id"]
            isOneToOne: true
            referencedRelation: "talent_assessment_responses"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      talent_assessment_responses: {
        Row: {
          assessor_employee_id: string
          created_at: string
          created_by_user_id: string | null
          cycle_id: string
          finalized_at: string | null
          id: string
          locked_at: string | null
          reopened_at: string | null
          response_type: string
          status: string
          subject_employee_id: string
          submitted_at: string | null
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          version: number
        }
        Insert: {
          assessor_employee_id: string
          created_at?: string
          created_by_user_id?: string | null
          cycle_id: string
          finalized_at?: string | null
          id?: string
          locked_at?: string | null
          reopened_at?: string | null
          response_type: string
          status?: string
          subject_employee_id: string
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Update: {
          assessor_employee_id?: string
          created_at?: string
          created_by_user_id?: string | null
          cycle_id?: string
          finalized_at?: string | null
          id?: string
          locked_at?: string | null
          reopened_at?: string | null
          response_type?: string
          status?: string
          subject_employee_id?: string
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "talent_assessment_responses_tenant_id_assessor_employee_id_fkey"
            columns: ["tenant_id", "assessor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_assessment_responses_tenant_id_cycle_id_fkey"
            columns: ["tenant_id", "cycle_id"]
            isOneToOne: false
            referencedRelation: "talent_assessment_cycles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_assessment_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_assessment_responses_tenant_id_subject_employee_id_fkey"
            columns: ["tenant_id", "subject_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      talent_capabilities: {
        Row: {
          capability_type: string
          category_id: string | null
          certificate_code: string | null
          certificate_is_permanent: boolean
          certificate_issuing_body: string | null
          certificate_renewal_required: boolean
          certificate_validity_months: number | null
          code: string
          created_at: string
          description: string | null
          id: string
          language_cefr: string | null
          language_code: string | null
          language_is_native: boolean
          name: string
          normalized_name: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          capability_type: string
          category_id?: string | null
          certificate_code?: string | null
          certificate_is_permanent?: boolean
          certificate_issuing_body?: string | null
          certificate_renewal_required?: boolean
          certificate_validity_months?: number | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          language_cefr?: string | null
          language_code?: string | null
          language_is_native?: boolean
          name: string
          normalized_name: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          capability_type?: string
          category_id?: string | null
          certificate_code?: string | null
          certificate_is_permanent?: boolean
          certificate_issuing_body?: string | null
          certificate_renewal_required?: boolean
          certificate_validity_months?: number | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          language_cefr?: string | null
          language_code?: string | null
          language_is_native?: boolean
          name?: string
          normalized_name?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_capabilities_tenant_id_category_id_fkey"
            columns: ["tenant_id", "category_id"]
            isOneToOne: false
            referencedRelation: "talent_categories"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_capabilities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_capability_level_content: {
        Row: {
          capability_id: string
          coaching_notes: string | null
          created_at: string
          examples: string | null
          id: string
          indicator_text: string
          talent_level_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          capability_id: string
          coaching_notes?: string | null
          created_at?: string
          examples?: string | null
          id?: string
          indicator_text: string
          talent_level_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          capability_id?: string
          coaching_notes?: string | null
          created_at?: string
          examples?: string | null
          id?: string
          indicator_text?: string
          talent_level_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_capability_level_content_tenant_id_capability_id_fkey"
            columns: ["tenant_id", "capability_id"]
            isOneToOne: false
            referencedRelation: "talent_capabilities"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_capability_level_content_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_capability_level_content_tenant_id_talent_level_id_fkey"
            columns: ["tenant_id", "talent_level_id"]
            isOneToOne: false
            referencedRelation: "talent_levels"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      talent_capability_tags: {
        Row: {
          capability_id: string
          created_at: string
          tag_id: string
          tenant_id: string
        }
        Insert: {
          capability_id: string
          created_at?: string
          tag_id: string
          tenant_id: string
        }
        Update: {
          capability_id?: string
          created_at?: string
          tag_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_capability_tags_tenant_id_capability_id_fkey"
            columns: ["tenant_id", "capability_id"]
            isOneToOne: false
            referencedRelation: "talent_capabilities"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_capability_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_capability_tags_tenant_id_tag_id_fkey"
            columns: ["tenant_id", "tag_id"]
            isOneToOne: false
            referencedRelation: "star_performer_tags"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      talent_categories: {
        Row: {
          capability_types: string[]
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          capability_types?: string[]
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          capability_types?: string[]
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_development_goals: {
        Row: {
          archived_at: string | null
          capability_id: string | null
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          employee_id: string
          id: string
          period_end: string | null
          period_start: string
          progress_percent: number
          source_type: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
          updated_by_user_id: string | null
          version: number
        }
        Insert: {
          archived_at?: string | null
          capability_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          employee_id: string
          id?: string
          period_end?: string | null
          period_start?: string
          progress_percent?: number
          source_type?: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Update: {
          archived_at?: string | null
          capability_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          employee_id?: string
          id?: string
          period_end?: string | null
          period_start?: string
          progress_percent?: number
          source_type?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "talent_development_goals_tenant_id_capability_id_fkey"
            columns: ["tenant_id", "capability_id"]
            isOneToOne: false
            referencedRelation: "talent_capabilities"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_development_goals_tenant_id_employee_id_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_development_goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_employee_capability_records: {
        Row: {
          archived_at: string | null
          archived_by_user_id: string | null
          capability_id: string
          certificate_code: string | null
          certificate_is_permanent: boolean
          certificate_issuing_body: string | null
          certificate_renewal_required: boolean
          certificate_status: string | null
          certificate_validity_months: number | null
          created_at: string
          created_by_user_id: string | null
          employee_id: string
          evidence_document_id: string | null
          evidence_status: string | null
          id: string
          language_is_native: boolean
          language_level: string | null
          qualification_responsible_user_id: string | null
          source_type: string
          status: string
          talent_level_id: string | null
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          valid_from: string
          valid_until: string | null
          version: number
        }
        Insert: {
          archived_at?: string | null
          archived_by_user_id?: string | null
          capability_id: string
          certificate_code?: string | null
          certificate_is_permanent?: boolean
          certificate_issuing_body?: string | null
          certificate_renewal_required?: boolean
          certificate_status?: string | null
          certificate_validity_months?: number | null
          created_at?: string
          created_by_user_id?: string | null
          employee_id: string
          evidence_document_id?: string | null
          evidence_status?: string | null
          id?: string
          language_is_native?: boolean
          language_level?: string | null
          qualification_responsible_user_id?: string | null
          source_type?: string
          status?: string
          talent_level_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          archived_at?: string | null
          archived_by_user_id?: string | null
          capability_id?: string
          certificate_code?: string | null
          certificate_is_permanent?: boolean
          certificate_issuing_body?: string | null
          certificate_renewal_required?: boolean
          certificate_status?: string | null
          certificate_validity_months?: number | null
          created_at?: string
          created_by_user_id?: string | null
          employee_id?: string
          evidence_document_id?: string | null
          evidence_status?: string | null
          id?: string
          language_is_native?: boolean
          language_level?: string | null
          qualification_responsible_user_id?: string | null
          source_type?: string
          status?: string
          talent_level_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          valid_from?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "talent_employee_capability_recor_tenant_id_talent_level_id_fkey"
            columns: ["tenant_id", "talent_level_id"]
            isOneToOne: false
            referencedRelation: "talent_levels"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_employee_capability_records_evidence_document_id_fkey"
            columns: ["evidence_document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_employee_capability_records_tenant_id_capability_id_fkey"
            columns: ["tenant_id", "capability_id"]
            isOneToOne: false
            referencedRelation: "talent_capabilities"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_employee_capability_records_tenant_id_employee_id_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_employee_capability_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_goal_check_ins: {
        Row: {
          author_employee_id: string | null
          author_user_id: string
          body: string
          completed_at: string | null
          created_at: string
          employee_id: string
          entry_type: string
          follow_up_due_on: string | null
          follow_up_title: string | null
          goal_id: string
          id: string
          status: string
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          author_employee_id?: string | null
          author_user_id: string
          body: string
          completed_at?: string | null
          created_at?: string
          employee_id: string
          entry_type: string
          follow_up_due_on?: string | null
          follow_up_title?: string | null
          goal_id: string
          id?: string
          status?: string
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          author_employee_id?: string | null
          author_user_id?: string
          body?: string
          completed_at?: string | null
          created_at?: string
          employee_id?: string
          entry_type?: string
          follow_up_due_on?: string | null
          follow_up_title?: string | null
          goal_id?: string
          id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "talent_goal_check_ins_tenant_id_employee_id_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_goal_check_ins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_goal_check_ins_tenant_id_goal_id_fkey"
            columns: ["tenant_id", "goal_id"]
            isOneToOne: false
            referencedRelation: "talent_development_goals"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      talent_import_batches: {
        Row: {
          commit_idempotency_key: string | null
          committed_at: string | null
          committed_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          id: string
          rollback_idempotency_key: string | null
          rolled_back_at: string | null
          rolled_back_by_user_id: string | null
          row_count: number
          source_filename: string
          source_hash: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          commit_idempotency_key?: string | null
          committed_at?: string | null
          committed_by_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          id?: string
          rollback_idempotency_key?: string | null
          rolled_back_at?: string | null
          rolled_back_by_user_id?: string | null
          row_count: number
          source_filename: string
          source_hash: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          commit_idempotency_key?: string | null
          committed_at?: string | null
          committed_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          id?: string
          rollback_idempotency_key?: string | null
          rolled_back_at?: string | null
          rolled_back_by_user_id?: string | null
          row_count?: number
          source_filename?: string
          source_hash?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_import_batches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_import_rows: {
        Row: {
          applied_record_id: string | null
          batch_id: string
          capability_code: string
          certificate_code: string | null
          created_at: string
          employee_number: string
          errors: Json
          evidence_status: string | null
          id: string
          language_level: string | null
          parsed_data: Json
          previous_record: Json | null
          row_number: number
          row_status: string
          talent_level_code: string | null
          tenant_id: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applied_record_id?: string | null
          batch_id: string
          capability_code: string
          certificate_code?: string | null
          created_at?: string
          employee_number: string
          errors?: Json
          evidence_status?: string | null
          id?: string
          language_level?: string | null
          parsed_data?: Json
          previous_record?: Json | null
          row_number: number
          row_status?: string
          talent_level_code?: string | null
          tenant_id: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applied_record_id?: string | null
          batch_id?: string
          capability_code?: string
          certificate_code?: string | null
          created_at?: string
          employee_number?: string
          errors?: Json
          evidence_status?: string | null
          id?: string
          language_level?: string | null
          parsed_data?: Json
          previous_record?: Json | null
          row_number?: number
          row_status?: string
          talent_level_code?: string | null
          tenant_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_import_rows_batch_fkey"
            columns: ["tenant_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "talent_import_batches"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      talent_level_models: {
        Row: {
          code: string
          created_at: string
          created_by_user_id: string | null
          description: string | null
          id: string
          locked_at: string | null
          name: string
          status: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          locked_at?: string | null
          name: string
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          locked_at?: string | null
          name?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "talent_level_models_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_levels: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          level_model_id: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          level_model_id: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          level_model_id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_levels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_levels_tenant_id_level_model_id_fkey"
            columns: ["tenant_id", "level_model_id"]
            isOneToOne: false
            referencedRelation: "talent_level_models"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      talent_notifications: {
        Row: {
          created_at: string
          event_type: string
          handled_at: string | null
          id: string
          read_at: string | null
          recipient_employee_id: string
          recipient_user_id: string
          source_entity_id: string | null
          status: string
          summary: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_type: string
          handled_at?: string | null
          id?: string
          read_at?: string | null
          recipient_employee_id: string
          recipient_user_id: string
          source_entity_id?: string | null
          status?: string
          summary: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          handled_at?: string | null
          id?: string
          read_at?: string | null
          recipient_employee_id?: string
          recipient_user_id?: string
          source_entity_id?: string | null
          status?: string
          summary?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_notifications_tenant_id_recipient_employee_id_fkey"
            columns: ["tenant_id", "recipient_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      talent_review_assignment_members: {
        Row: {
          assignment_id: string
          campaign_id: string
          created_at: string
          employee_id: string
          employee_snapshot: Json
          id: string
          manager_employee_id: string
          tenant_id: string
        }
        Insert: {
          assignment_id: string
          campaign_id: string
          created_at?: string
          employee_id: string
          employee_snapshot: Json
          id?: string
          manager_employee_id: string
          tenant_id: string
        }
        Update: {
          assignment_id?: string
          campaign_id?: string
          created_at?: string
          employee_id?: string
          employee_snapshot?: Json
          id?: string
          manager_employee_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_review_assignment_memb_tenant_id_manager_employee_i_fkey"
            columns: ["tenant_id", "manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_review_assignment_members_tenant_id_assignment_id_fkey"
            columns: ["tenant_id", "assignment_id"]
            isOneToOne: false
            referencedRelation: "talent_review_assignments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_review_assignment_members_tenant_id_campaign_id_fkey"
            columns: ["tenant_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "talent_review_campaigns"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_review_assignment_members_tenant_id_employee_id_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_review_assignment_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_review_assignments: {
        Row: {
          campaign_id: string
          created_at: string
          employee_count: number
          id: string
          last_reminded_at: string | null
          manager_employee_id: string
          reminder_id: string | null
          scored_count: number
          status: string
          submitted_at: string | null
          submitted_by_user_id: string | null
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          employee_count?: number
          id?: string
          last_reminded_at?: string | null
          manager_employee_id: string
          reminder_id?: string | null
          scored_count?: number
          status?: string
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          employee_count?: number
          id?: string
          last_reminded_at?: string | null
          manager_employee_id?: string
          reminder_id?: string | null
          scored_count?: number
          status?: string
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "talent_review_assignments_tenant_id_campaign_id_fkey"
            columns: ["tenant_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "talent_review_campaigns"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_review_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_review_assignments_tenant_id_manager_employee_id_fkey"
            columns: ["tenant_id", "manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_review_assignments_tenant_id_reminder_id_fkey"
            columns: ["tenant_id", "reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      talent_review_campaigns: {
        Row: {
          administration_id: string | null
          closed_at: string | null
          closed_by_user_id: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          ends_on: string
          id: string
          name: string
          previous_campaign_id: string | null
          reopened_at: string | null
          started_at: string | null
          starts_on: string
          status: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          version: number
        }
        Insert: {
          administration_id?: string | null
          closed_at?: string | null
          closed_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          ends_on: string
          id?: string
          name: string
          previous_campaign_id?: string | null
          reopened_at?: string | null
          started_at?: string | null
          starts_on: string
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Update: {
          administration_id?: string | null
          closed_at?: string | null
          closed_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          ends_on?: string
          id?: string
          name?: string
          previous_campaign_id?: string | null
          reopened_at?: string | null
          started_at?: string | null
          starts_on?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "talent_review_campaigns_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_review_campaigns_previous_fkey"
            columns: ["tenant_id", "previous_campaign_id"]
            isOneToOne: false
            referencedRelation: "talent_review_campaigns"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_review_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_review_scores: {
        Row: {
          assignment_id: string
          campaign_id: string
          created_at: string
          created_by_user_id: string | null
          employee_id: string
          employee_snapshot: Json
          grid_cell: string | null
          id: string
          manager_employee_id: string
          note: string | null
          performance_score: string | null
          potential_score: string | null
          status: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          version: number
        }
        Insert: {
          assignment_id: string
          campaign_id: string
          created_at?: string
          created_by_user_id?: string | null
          employee_id: string
          employee_snapshot: Json
          grid_cell?: string | null
          id?: string
          manager_employee_id: string
          note?: string | null
          performance_score?: string | null
          potential_score?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Update: {
          assignment_id?: string
          campaign_id?: string
          created_at?: string
          created_by_user_id?: string | null
          employee_id?: string
          employee_snapshot?: Json
          grid_cell?: string | null
          id?: string
          manager_employee_id?: string
          note?: string | null
          performance_score?: string | null
          potential_score?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "talent_review_scores_tenant_id_assignment_id_fkey"
            columns: ["tenant_id", "assignment_id"]
            isOneToOne: false
            referencedRelation: "talent_review_assignments"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_review_scores_tenant_id_campaign_id_fkey"
            columns: ["tenant_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "talent_review_campaigns"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_review_scores_tenant_id_employee_id_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "talent_review_scores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "talent_review_scores_tenant_id_manager_employee_id_fkey"
            columns: ["tenant_id", "manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      talent_seniorities: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          sort_order: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "talent_seniorities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_compass_answers: {
        Row: {
          created_at: string
          hr_group_id: string
          id: string
          inner_score: number
          outer_score: number
          participation_id: string
          question_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          id?: string
          inner_score: number
          outer_score: number
          participation_id: string
          question_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          id?: string
          inner_score?: number
          outer_score?: number
          participation_id?: string
          question_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_compass_answers_participation_fkey"
            columns: ["tenant_id", "hr_group_id", "participation_id"]
            isOneToOne: false
            referencedRelation: "team_compass_participations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "team_compass_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "team_compass_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      team_compass_campaign_targets: {
        Row: {
          campaign_id: string
          created_at: string
          department_id: string
          hr_group_id: string
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          department_id: string
          hr_group_id: string
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          department_id?: string
          hr_group_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_compass_campaign_targets_campaign_fkey"
            columns: ["tenant_id", "hr_group_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "team_compass_campaigns"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "team_compass_campaign_targets_department_fkey"
            columns: ["tenant_id", "hr_group_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      team_compass_campaigns: {
        Row: {
          anonymity_threshold: number
          archived_at: string | null
          closed_at: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          ends_on: string
          hr_group_id: string
          id: string
          name: string
          personal_message: string | null
          questionnaire_version_id: string
          started_at: string | null
          starts_on: string
          status: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          version: number
        }
        Insert: {
          anonymity_threshold?: number
          archived_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          ends_on: string
          hr_group_id: string
          id?: string
          name: string
          personal_message?: string | null
          questionnaire_version_id: string
          started_at?: string | null
          starts_on?: string
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Update: {
          anonymity_threshold?: number
          archived_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          ends_on?: string
          hr_group_id?: string
          id?: string
          name?: string
          personal_message?: string | null
          questionnaire_version_id?: string
          started_at?: string | null
          starts_on?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_compass_campaigns_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "team_compass_campaigns_questionnaire_version_id_fkey"
            columns: ["questionnaire_version_id"]
            isOneToOne: false
            referencedRelation: "team_compass_questionnaire_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_compass_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_compass_participations: {
        Row: {
          campaign_id: string
          completed_at: string | null
          created_at: string
          department_id: string
          employee_id: string
          hr_group_id: string
          id: string
          invited_at: string
          share_inner_profile: boolean
          share_outer_profile: boolean
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          created_at?: string
          department_id: string
          employee_id: string
          hr_group_id: string
          id?: string
          invited_at?: string
          share_inner_profile?: boolean
          share_outer_profile?: boolean
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          created_at?: string
          department_id?: string
          employee_id?: string
          hr_group_id?: string
          id?: string
          invited_at?: string
          share_inner_profile?: boolean
          share_outer_profile?: boolean
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_compass_participations_campaign_fkey"
            columns: ["tenant_id", "hr_group_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "team_compass_campaigns"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "team_compass_participations_department_fkey"
            columns: ["tenant_id", "hr_group_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "team_compass_participations_employee_fkey"
            columns: ["tenant_id", "hr_group_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      team_compass_profiles: {
        Row: {
          calculated_at: string
          hr_group_id: string
          id: string
          inner_action: number
          inner_harmony: number
          inner_logic: number
          inner_vision: number
          inner_x: number
          inner_y: number
          outer_action: number
          outer_harmony: number
          outer_logic: number
          outer_vision: number
          outer_x: number
          outer_y: number
          participation_id: string
          primary_dimension: string
          secondary_dimension: string
          shift_band: string
          shift_distance: number
          tenant_id: string
        }
        Insert: {
          calculated_at?: string
          hr_group_id: string
          id?: string
          inner_action: number
          inner_harmony: number
          inner_logic: number
          inner_vision: number
          inner_x: number
          inner_y: number
          outer_action: number
          outer_harmony: number
          outer_logic: number
          outer_vision: number
          outer_x: number
          outer_y: number
          participation_id: string
          primary_dimension: string
          secondary_dimension: string
          shift_band: string
          shift_distance: number
          tenant_id: string
        }
        Update: {
          calculated_at?: string
          hr_group_id?: string
          id?: string
          inner_action?: number
          inner_harmony?: number
          inner_logic?: number
          inner_vision?: number
          inner_x?: number
          inner_y?: number
          outer_action?: number
          outer_harmony?: number
          outer_logic?: number
          outer_vision?: number
          outer_x?: number
          outer_y?: number
          participation_id?: string
          primary_dimension?: string
          secondary_dimension?: string
          shift_band?: string
          shift_distance?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_compass_profiles_participation_fkey"
            columns: ["tenant_id", "hr_group_id", "participation_id"]
            isOneToOne: false
            referencedRelation: "team_compass_participations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
      team_compass_questionnaire_versions: {
        Row: {
          code: string
          created_at: string
          id: string
          name_en: string
          name_nl: string
          status: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name_en: string
          name_nl: string
          status?: string
          version: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name_en?: string
          name_nl?: string
          status?: string
          version?: number
        }
        Relationships: []
      }
      team_compass_questions: {
        Row: {
          code: string
          created_at: string
          dimension: string
          id: string
          prompt_en: string
          prompt_nl: string
          questionnaire_version_id: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          dimension: string
          id?: string
          prompt_en: string
          prompt_nl: string
          questionnaire_version_id: string
          sort_order: number
        }
        Update: {
          code?: string
          created_at?: string
          dimension?: string
          id?: string
          prompt_en?: string
          prompt_nl?: string
          questionnaire_version_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_compass_questions_questionnaire_version_id_fkey"
            columns: ["questionnaire_version_id"]
            isOneToOne: false
            referencedRelation: "team_compass_questionnaire_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_anniversary_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          tenant_id: string
          updated_at: string
          years: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_id: string
          updated_at?: string
          years: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_id?: string
          updated_at?: string
          years?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_anniversary_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_lifecycle: {
        Row: {
          activated_at: string | null
          changed_by: string | null
          created_at: string
          paused_at: string | null
          status: Database["public"]["Enums"]["tenant_lifecycle_status"]
          status_reason: string | null
          tenant_id: string
          terminated_at: string | null
          termination_requested_at: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          changed_by?: string | null
          created_at?: string
          paused_at?: string | null
          status?: Database["public"]["Enums"]["tenant_lifecycle_status"]
          status_reason?: string | null
          tenant_id: string
          terminated_at?: string | null
          termination_requested_at?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          changed_by?: string | null
          created_at?: string
          paused_at?: string | null
          status?: Database["public"]["Enums"]["tenant_lifecycle_status"]
          status_reason?: string | null
          tenant_id?: string
          terminated_at?: string | null
          termination_requested_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_lifecycle_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          created_at: string
          disabled_at: string | null
          disabled_by: string | null
          enabled_at: string | null
          enabled_by: string | null
          is_enabled: boolean
          module_code: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          enabled_at?: string | null
          enabled_by?: string | null
          is_enabled?: boolean
          module_code: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          enabled_at?: string | null
          enabled_by?: string | null
          is_enabled?: boolean
          module_code?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_onboarding_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          primary_contact_email: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          primary_contact_email: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          primary_contact_email?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_onboarding_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_usage_snapshots: {
        Row: {
          active_employment_count: number
          administration_count: number
          created_at: string
          created_by: string | null
          employee_count: number
          id: string
          measured_on: string
          storage_bytes: number
          tenant_id: string
          user_count: number
        }
        Insert: {
          active_employment_count?: number
          administration_count?: number
          created_at?: string
          created_by?: string | null
          employee_count?: number
          id?: string
          measured_on?: string
          storage_bytes?: number
          tenant_id: string
          user_count?: number
        }
        Update: {
          active_employment_count?: number
          administration_count?: number
          created_at?: string
          created_by?: string | null
          employee_count?: number
          id?: string
          measured_on?: string
          storage_bytes?: number
          tenant_id?: string
          user_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_usage_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          administration_mode: Database["public"]["Enums"]["administration_mode"]
          combined_at: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sharing_mode: Database["public"]["Enums"]["sharing_mode"]
          slug: string
          updated_at: string
        }
        Insert: {
          administration_mode?: Database["public"]["Enums"]["administration_mode"]
          combined_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sharing_mode?: Database["public"]["Enums"]["sharing_mode"]
          slug: string
          updated_at?: string
        }
        Update: {
          administration_mode?: Database["public"]["Enums"]["administration_mode"]
          combined_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sharing_mode?: Database["public"]["Enums"]["sharing_mode"]
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_access: {
        Row: {
          administration_id: string | null
          created_at: string
          hr_group_id: string | null
          id: string
          is_active: boolean
          management_role_id: string
          scope_type: Database["public"]["Enums"]["access_scope_type"]
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          administration_id?: string | null
          created_at?: string
          hr_group_id?: string | null
          id?: string
          is_active?: boolean
          management_role_id: string
          scope_type: Database["public"]["Enums"]["access_scope_type"]
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          administration_id?: string | null
          created_at?: string
          hr_group_id?: string | null
          id?: string
          is_active?: boolean
          management_role_id?: string
          scope_type?: Database["public"]["Enums"]["access_scope_type"]
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_administration_same_tenant_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "user_access_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "user_access_management_role_id_fkey"
            columns: ["management_role_id"]
            isOneToOne: false
            referencedRelation: "management_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_access_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_hr_group_access: {
        Row: {
          created_at: string
          hr_group_id: string
          id: string
          is_active: boolean
          management_role_id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hr_group_id: string
          id?: string
          is_active?: boolean
          management_role_id: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hr_group_id?: string
          id?: string
          is_active?: boolean
          management_role_id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_hr_group_access_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "user_hr_group_access_management_role_id_fkey"
            columns: ["management_role_id"]
            isOneToOne: false
            referencedRelation: "management_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          administration_id: string | null
          created_at: string
          email: string
          email_kind: Database["public"]["Enums"]["invitation_email_kind"]
          employee_id: string | null
          expires_at: string
          id: string
          invited_by_user_id: string
          management_role_id: string
          purpose: Database["public"]["Enums"]["invitation_purpose"]
          scope_type: Database["public"]["Enums"]["access_scope_type"]
          status: Database["public"]["Enums"]["invitation_status"]
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          administration_id?: string | null
          created_at?: string
          email: string
          email_kind: Database["public"]["Enums"]["invitation_email_kind"]
          employee_id?: string | null
          expires_at: string
          id?: string
          invited_by_user_id: string
          management_role_id: string
          purpose: Database["public"]["Enums"]["invitation_purpose"]
          scope_type: Database["public"]["Enums"]["access_scope_type"]
          status?: Database["public"]["Enums"]["invitation_status"]
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          administration_id?: string | null
          created_at?: string
          email?: string
          email_kind?: Database["public"]["Enums"]["invitation_email_kind"]
          employee_id?: string | null
          expires_at?: string
          id?: string
          invited_by_user_id?: string
          management_role_id?: string
          purpose?: Database["public"]["Enums"]["invitation_purpose"]
          scope_type?: Database["public"]["Enums"]["access_scope_type"]
          status?: Database["public"]["Enums"]["invitation_status"]
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_administration_same_tenant_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "user_invitations_employee_same_tenant_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "user_invitations_management_role_id_fkey"
            columns: ["management_role_id"]
            isOneToOne: false
            referencedRelation: "management_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          analog_clock_style: Database["public"]["Enums"]["analog_clock_style"]
          auth_user_id: string
          clock_mode: Database["public"]["Enums"]["clock_mode"]
          created_at: string
          date_format: Database["public"]["Enums"]["date_format"]
          locale: Database["public"]["Enums"]["ui_locale"]
          theme: Database["public"]["Enums"]["ui_theme"]
          time_format: Database["public"]["Enums"]["time_format"]
          ui_state: Json
          updated_at: string
          use_company_theme: boolean
          week_numbering_system: Database["public"]["Enums"]["week_numbering_system"]
        }
        Insert: {
          analog_clock_style?: Database["public"]["Enums"]["analog_clock_style"]
          auth_user_id: string
          clock_mode?: Database["public"]["Enums"]["clock_mode"]
          created_at?: string
          date_format?: Database["public"]["Enums"]["date_format"]
          locale?: Database["public"]["Enums"]["ui_locale"]
          theme?: Database["public"]["Enums"]["ui_theme"]
          time_format?: Database["public"]["Enums"]["time_format"]
          ui_state?: Json
          updated_at?: string
          use_company_theme?: boolean
          week_numbering_system?: Database["public"]["Enums"]["week_numbering_system"]
        }
        Update: {
          analog_clock_style?: Database["public"]["Enums"]["analog_clock_style"]
          auth_user_id?: string
          clock_mode?: Database["public"]["Enums"]["clock_mode"]
          created_at?: string
          date_format?: Database["public"]["Enums"]["date_format"]
          locale?: Database["public"]["Enums"]["ui_locale"]
          theme?: Database["public"]["Enums"]["ui_theme"]
          time_format?: Database["public"]["Enums"]["time_format"]
          ui_state?: Json
          updated_at?: string
          use_company_theme?: boolean
          week_numbering_system?: Database["public"]["Enums"]["week_numbering_system"]
        }
        Relationships: []
      }
      work_hour_types: {
        Row: {
          administration_id: string | null
          category: Database["public"]["Enums"]["work_hour_type_category"]
          color_code: string
          created_at: string
          created_by: string | null
          hr_group_id: string
          id: string
          is_active: boolean
          is_self_service: boolean
          name: string
          pin_in_calendar: boolean
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          administration_id?: string | null
          category: Database["public"]["Enums"]["work_hour_type_category"]
          color_code?: string
          created_at?: string
          created_by?: string | null
          hr_group_id: string
          id?: string
          is_active?: boolean
          is_self_service?: boolean
          name: string
          pin_in_calendar?: boolean
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          administration_id?: string | null
          category?: Database["public"]["Enums"]["work_hour_type_category"]
          color_code?: string
          created_at?: string
          created_by?: string | null
          hr_group_id?: string
          id?: string
          is_active?: boolean
          is_self_service?: boolean
          name?: string
          pin_in_calendar?: boolean
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_hour_types_hr_group_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "work_hour_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_jobs: {
        Row: {
          administration_id: string | null
          attempts: number
          available_at: string
          correlation_id: string | null
          created_at: string
          hr_group_id: string
          id: string
          idempotency_key: string
          job_type: Database["public"]["Enums"]["workflow_job_type"]
          last_attempt_at: string | null
          last_error_at: string | null
          last_error_code: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          process_instance_id: string
          result_reference_id: string | null
          status: Database["public"]["Enums"]["workflow_job_status"]
          step_instance_id: string | null
          tenant_id: string
          updated_at: string
          work_item_id: string | null
        }
        Insert: {
          administration_id?: string | null
          attempts?: number
          available_at?: string
          correlation_id?: string | null
          created_at?: string
          hr_group_id: string
          id?: string
          idempotency_key: string
          job_type: Database["public"]["Enums"]["workflow_job_type"]
          last_attempt_at?: string | null
          last_error_at?: string | null
          last_error_code?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          process_instance_id: string
          result_reference_id?: string | null
          status?: Database["public"]["Enums"]["workflow_job_status"]
          step_instance_id?: string | null
          tenant_id: string
          updated_at?: string
          work_item_id?: string | null
        }
        Update: {
          administration_id?: string | null
          attempts?: number
          available_at?: string
          correlation_id?: string | null
          created_at?: string
          hr_group_id?: string
          id?: string
          idempotency_key?: string
          job_type?: Database["public"]["Enums"]["workflow_job_type"]
          last_attempt_at?: string | null
          last_error_at?: string | null
          last_error_code?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          process_instance_id?: string
          result_reference_id?: string | null
          status?: Database["public"]["Enums"]["workflow_job_status"]
          step_instance_id?: string | null
          tenant_id?: string
          updated_at?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_jobs_tenant_id_hr_group_id_administration_id_fkey"
            columns: ["tenant_id", "hr_group_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "workflow_jobs_tenant_id_hr_group_id_fkey"
            columns: ["tenant_id", "hr_group_id"]
            isOneToOne: false
            referencedRelation: "hr_groups"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "workflow_jobs_tenant_id_hr_group_id_process_instance_id_fkey"
            columns: ["tenant_id", "hr_group_id", "process_instance_id"]
            isOneToOne: false
            referencedRelation: "process_instances"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
          {
            foreignKeyName: "workflow_jobs_tenant_id_hr_group_id_process_instance_id_st_fkey"
            columns: [
              "tenant_id",
              "hr_group_id",
              "process_instance_id",
              "step_instance_id",
            ]
            isOneToOne: false
            referencedRelation: "process_step_instances"
            referencedColumns: [
              "tenant_id",
              "hr_group_id",
              "process_instance_id",
              "id",
            ]
          },
          {
            foreignKeyName: "workflow_jobs_tenant_id_hr_group_id_work_item_id_fkey"
            columns: ["tenant_id", "hr_group_id", "work_item_id"]
            isOneToOne: false
            referencedRelation: "process_work_items"
            referencedColumns: ["tenant_id", "hr_group_id", "id"]
          },
        ]
      }
    }
    Views: {
      hr_change_events: {
        Row: {
          administration_id: string | null
          employee_id: string | null
          employment_id: string | null
          event_date: string | null
          event_id: string | null
          event_type: string | null
          severity: string | null
          source_href: string | null
          tenant_id: string | null
          title_key: string | null
          title_values: Json | null
        }
        Relationships: []
      }
      talent_job_profile_readmodel: {
        Row: {
          job_code: string | null
          job_family_code: string | null
          job_family_id: string | null
          job_family_name: string | null
          job_group_code: string | null
          job_group_id: string | null
          job_group_name: string | null
          job_id: string | null
          job_is_active: boolean | null
          job_profile_id: string | null
          organizational_context: string | null
          profile_version_id: string | null
          purpose: string | null
          responsibilities: Json | null
          result_areas: Json | null
          seniority_code: string | null
          seniority_id: string | null
          seniority_name: string | null
          status: string | null
          summary: string | null
          tasks: Json | null
          tenant_id: string | null
          valid_from: string | null
          valid_until: string | null
          version_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_profiles_tenant_id_job_id_fkey"
            columns: ["tenant_id", "job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
    }
    Functions: {
      accept_user_invitation: {
        Args: {
          accepted_email: string
          accepted_user_id: string
          invitation_token: string
        }
        Returns: {
          employee_id: string
          tenant_id: string
        }[]
      }
      acknowledge_document_process_work_item: {
        Args: {
          requested_correlation_id: string
          requested_expected_version: number
          requested_idempotency_key: string
          requested_step_expected_version: number
          requested_work_item_id: string
        }
        Returns: Json
      }
      activate_due_talent_review_campaigns: {
        Args: { requested_tenant_id: string }
        Returns: number
      }
      activate_job_profile_version: {
        Args: { requested_tenant_id: string; requested_version_id: string }
        Returns: string
      }
      activate_journey: {
        Args: {
          requested_anchor_date: string
          requested_employment_id: string
          requested_hr_group_id: string
          requested_idempotency_key: string
          requested_participants: Json
          requested_target_employee_id: string
          requested_template_version_id: string
          requested_tenant_id: string
        }
        Returns: Json
      }
      activate_process_recipe: {
        Args: {
          requested_administration_id: string
          requested_hr_group_id: string
          requested_key: string
          requested_recipe_id: string
          requested_scope_type: Database["public"]["Enums"]["access_scope_type"]
          requested_tenant_id: string
        }
        Returns: Json
      }
      add_process_output_document_audiences: {
        Args: { requested_output_id: string }
        Returns: Json
      }
      apply_combined_employment_timeline_mutation: {
        Args: {
          requested_acknowledgements?: Json
          requested_effective_on: string
          requested_employment_id: string
          requested_mutations: Json
          requested_reason: string
          requested_warning_codes?: string[]
        }
        Returns: string
      }
      apply_combined_salary_application_change: {
        Args: {
          requested_acknowledgements?: Json
          requested_effective_on: string
          requested_employment_id: string
          requested_mutations: Json
          requested_reason: string
          requested_warning_codes?: string[]
        }
        Returns: string
      }
      apply_employment_cost_allocation: {
        Args: {
          requested_acknowledgements?: Json
          requested_effective_on: string
          requested_employment_id: string
          requested_payload: Json
          requested_reason: string
          requested_warning_codes?: string[]
        }
        Returns: string
      }
      apply_employment_timeline_mutation: {
        Args: {
          requested_acknowledgements?: Json
          requested_effective_on: string
          requested_employment_id: string
          requested_payload: Json
          requested_reason: string
          requested_timeline: string
          requested_warning_codes?: string[]
        }
        Returns: string
      }
      apply_group_leave_manual_adjustment: {
        Args: {
          requested_accrual_year: number
          requested_amount: number
          requested_employee_id: string
          requested_employment_id: string
          requested_hr_group_id: string
          requested_leave_type_id: string
          requested_reason: string
          requested_source_key: string
          requested_tenant_id: string
        }
        Returns: string
      }
      apply_leave_manual_adjustment: {
        Args: {
          requested_accrual_year: number
          requested_administration_id: string
          requested_amount: number
          requested_employee_id: string
          requested_employment_id: string
          requested_leave_type_id: string
          requested_reason: string
          requested_source_key: string
          requested_tenant_id: string
        }
        Returns: string
      }
      apply_salary_application_change: {
        Args: {
          requested_acknowledgements?: Json
          requested_effective_on: string
          requested_employment_id: string
          requested_payload: Json
          requested_reason: string
          requested_warning_codes?: string[]
        }
        Returns: Json
      }
      attach_process_output_document: {
        Args: {
          requested_category_key: string
          requested_checksum_sha256: string
          requested_content_type: string
          requested_file_size: number
          requested_original_filename: string
          requested_output_id: string
          requested_storage_key: string
          requested_title: string
        }
        Returns: Json
      }
      begin_process_output: {
        Args: { requested_job_id: string; requested_language?: string }
        Returns: Json
      }
      capture_tenant_usage_snapshot: {
        Args: { requested_tenant_id: string }
        Returns: string
      }
      change_absence_capacity: {
        Args: {
          requested_absence_percentage: number
          requested_case_id: string
          requested_effective_on: string
          requested_expected_next_review_on?: string
          requested_idempotency_key?: string
        }
        Returns: string
      }
      change_absence_capacity_v2: {
        Args: {
          requested_absence_hours_per_week?: number
          requested_absence_percentage?: number
          requested_case_id: string
          requested_effective_on: string
          requested_expected_next_review_on?: string
          requested_idempotency_key?: string
          requested_input_mode?: string
        }
        Returns: string
      }
      change_tenant_lifecycle: {
        Args: {
          requested_reason: string
          requested_status: Database["public"]["Enums"]["tenant_lifecycle_status"]
          requested_tenant_id: string
        }
        Returns: Json
      }
      claim_process_work_item: {
        Args: {
          requested_expected_version: number
          requested_work_item_id: string
        }
        Returns: Json
      }
      claim_workflow_job: {
        Args: { requested_worker_id: string }
        Returns: Json
      }
      clone_process_definition_draft: {
        Args: {
          requested_description?: Json
          requested_key: string
          requested_source_definition_id: string
          requested_title?: Json
        }
        Returns: Json
      }
      close_group_leave_year: {
        Args: {
          requested_hr_group_id: string
          requested_tenant_id: string
          requested_year: number
        }
        Returns: string
      }
      close_leave_year: {
        Args: {
          requested_administration_id: string
          requested_tenant_id: string
          requested_year: number
        }
        Returns: string
      }
      close_talent_review_campaign: {
        Args: { requested_campaign_id: string }
        Returns: string
      }
      commit_internal_transfer: {
        Args: {
          requested_correlation_id: string
          requested_expected_version: number
          requested_idempotency_key: string
          requested_step_expected_version: number
          requested_work_item_id: string
        }
        Returns: Json
      }
      commit_talent_import_batch: {
        Args: {
          requested_batch_id: string
          requested_idempotency_key: string
          requested_tenant_id: string
        }
        Returns: Json
      }
      complete_process_output: {
        Args: {
          requested_document_id: string
          requested_html_summary: string
          requested_output_id: string
        }
        Returns: Json
      }
      confirm_employment_termination: {
        Args: { requested_termination_id: string }
        Returns: undefined
      }
      confirm_group_leave_request: {
        Args: {
          requested_employee_id: string
          requested_employment_id: string
          requested_end_date: string
          requested_hr_group_id: string
          requested_idempotency_key: string
          requested_leave_type_id: string
          requested_mode: Database["public"]["Enums"]["leave_request_mode"]
          requested_priority_rule_id: string
          requested_specific_end: string
          requested_specific_start: string
          requested_start_date: string
          requested_tenant_id: string
          requested_time_mode: Database["public"]["Enums"]["leave_request_time_mode"]
        }
        Returns: string
      }
      confirm_leave_request: {
        Args: {
          requested_administration_id: string
          requested_employee_id: string
          requested_employment_id: string
          requested_end_date: string
          requested_idempotency_key: string
          requested_leave_type_id: string
          requested_mode: Database["public"]["Enums"]["leave_request_mode"]
          requested_priority_rule_id: string
          requested_specific_end: string
          requested_specific_start: string
          requested_start_date: string
          requested_tenant_id: string
          requested_time_mode: Database["public"]["Enums"]["leave_request_time_mode"]
        }
        Returns: string
      }
      copy_job_profile_version_to_draft: {
        Args: {
          requested_profile_id: string
          requested_source_version_id?: string
          requested_tenant_id: string
        }
        Returns: string
      }
      correct_recruitment_assessment: {
        Args: {
          requested_assessment_id: string
          requested_reason: string
          requested_scores: Json
        }
        Returns: Json
      }
      create_employee_address_change_reminders: {
        Args: {
          requested_action: string
          requested_administration_id: string
          requested_after: Json
          requested_before: Json
          requested_employee_id: string
          requested_tenant_id: string
        }
        Returns: number
      }
      create_employee_address_with_reminders: {
        Args: {
          requested_address_line_1: string
          requested_address_line_2: string
          requested_address_type?: string
          requested_administration_id: string
          requested_city: string
          requested_country_code: string
          requested_description?: string
          requested_employee_id: string
          requested_house_number: string
          requested_house_number_addition: string
          requested_postal_code: string
          requested_region: string
          requested_reminder_roles?: string[]
          requested_source: string
          requested_source_reference: string
          requested_street: string
          requested_tenant_id: string
          requested_valid_from: string
          requested_valid_until: string
        }
        Returns: string
      }
      create_employee_document_metadata: {
        Args: {
          requested_administration_id: string
          requested_employee_id: string
          requested_payload: Json
        }
        Returns: string
      }
      create_group_leave_accrual_rule: {
        Args: {
          requested_accrual_amount: number
          requested_accrual_basis: Database["public"]["Enums"]["leave_accrual_basis"]
          requested_accrual_frequency: Database["public"]["Enums"]["leave_accrual_frequency"]
          requested_accrual_rate: number
          requested_accrual_timing: Database["public"]["Enums"]["leave_accrual_timing"]
          requested_expiration_months: number
          requested_hr_group_id: string
          requested_leave_profile_id: string
          requested_leave_type_id: string
          requested_pause_leave_type_ids: string[]
          requested_predecessor_rule_id: string
          requested_tenant_id: string
          requested_valid_from: string
          requested_valid_until: string
          requested_work_hour_type_ids: string[]
        }
        Returns: string
      }
      create_group_leave_bonus_rule: {
        Args: {
          requested_award_timing: Database["public"]["Enums"]["leave_bonus_award_timing"]
          requested_hr_group_id: string
          requested_is_active: boolean
          requested_leave_profile_id: string
          requested_leave_type_id: string
          requested_name: string
          requested_pro_rate_first_year: boolean
          requested_tenant_id: string
          requested_tiers: Json
          requested_trigger_type: Database["public"]["Enums"]["leave_bonus_trigger_type"]
        }
        Returns: string
      }
      create_group_leave_opening_balance: {
        Args: {
          requested_amount: number
          requested_employee_id: string
          requested_employment_id: string
          requested_hr_group_id: string
          requested_leave_type_id: string
          requested_reason: string
          requested_source_key: string
          requested_start_date: string
          requested_tenant_id: string
        }
        Returns: string
      }
      create_hr_reminder: {
        Args: {
          requested_administration_id: string
          requested_description: string
          requested_remind_at: string
          requested_target_ids?: string[]
          requested_target_type: Database["public"]["Enums"]["reminder_target_type"]
          requested_tenant_id: string
          requested_title: string
        }
        Returns: string
      }
      create_job_with_revision: {
        Args: {
          requested_hr_group_id: string
          requested_payload: Json
          requested_tenant_id: string
        }
        Returns: string
      }
      create_journey_template_draft: {
        Args: {
          requested_draft: Json
          requested_hr_group_id: string
          requested_key: string
          requested_tenant_id: string
        }
        Returns: Json
      }
      create_labor_condition_successor: {
        Args: {
          requested_administration_id: string
          requested_name: string
          requested_predecessor_id: string
          requested_standard_hours_per_week: number
          requested_tenant_id: string
          requested_valid_from: string
        }
        Returns: {
          administration_id: string
          code: string
          created_at: string
          hr_group_id: string
          id: string
          is_active: boolean
          name: string
          predecessor_id: string | null
          probation_maximum_months: number
          standard_hours_per_week: number
          tenant_id: string
          updated_at: string
          valid_from: string
        }
        SetofOptions: {
          from: "*"
          to: "labor_condition_sets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_leave_accrual_rule: {
        Args: {
          requested_accrual_amount: number
          requested_accrual_basis: Database["public"]["Enums"]["leave_accrual_basis"]
          requested_accrual_frequency: Database["public"]["Enums"]["leave_accrual_frequency"]
          requested_accrual_rate: number
          requested_accrual_timing: Database["public"]["Enums"]["leave_accrual_timing"]
          requested_administration_id: string
          requested_expiration_months: number
          requested_leave_profile_id: string
          requested_leave_type_id: string
          requested_pause_leave_type_ids: string[]
          requested_predecessor_rule_id: string
          requested_tenant_id: string
          requested_valid_from: string
          requested_valid_until: string
          requested_work_hour_type_ids: string[]
        }
        Returns: string
      }
      create_leave_bonus_rule: {
        Args: {
          requested_administration_id: string
          requested_award_timing: Database["public"]["Enums"]["leave_bonus_award_timing"]
          requested_is_active: boolean
          requested_leave_profile_id: string
          requested_leave_type_id: string
          requested_name: string
          requested_pro_rate_first_year: boolean
          requested_tenant_id: string
          requested_tiers: Json
          requested_trigger_type: Database["public"]["Enums"]["leave_bonus_trigger_type"]
        }
        Returns: string
      }
      create_leave_opening_balance: {
        Args: {
          requested_administration_id: string
          requested_amount: number
          requested_employee_id: string
          requested_employment_id: string
          requested_leave_type_id: string
          requested_reason: string
          requested_source_key: string
          requested_start_date: string
          requested_tenant_id: string
        }
        Returns: string
      }
      create_personal_reminder: {
        Args: {
          requested_administration_id: string
          requested_description: string
          requested_remind_at: string
          requested_tenant_id: string
          requested_title: string
        }
        Returns: string
      }
      create_platform_hr_group: {
        Args: {
          requested_code: string
          requested_description?: string
          requested_name: string
          requested_tenant_id: string
        }
        Returns: string
      }
      create_process_deadline_reminder: {
        Args: { requested_job_id: string; requested_language?: string }
        Returns: Json
      }
      create_process_definition_draft: {
        Args: {
          requested_administration_id: string
          requested_definition: Json
          requested_description: Json
          requested_hr_group_id: string
          requested_key: string
          requested_scope_type: Database["public"]["Enums"]["access_scope_type"]
          requested_tenant_id: string
          requested_title: Json
          requested_validation_report?: Json
        }
        Returns: Json
      }
      create_recruitment_application: {
        Args: {
          requested_first_name: string
          requested_last_name: string
          requested_motivation: string
          requested_phone: string
          requested_private_email: string
          requested_source: string
          requested_vacancy_id: string
        }
        Returns: Json
      }
      create_recruitment_interview: {
        Args: {
          requested_application_id: string
          requested_participant_employee_ids: Json
          requested_scheduled_at: string
          requested_set_id: string
          requested_title: string
        }
        Returns: Json
      }
      create_recruitment_library_item: {
        Args: {
          requested_content: Json
          requested_hr_group_id: string
          requested_item_type: string
          requested_stable_code: string
          requested_tenant_id: string
          requested_title: string
        }
        Returns: Json
      }
      create_recruitment_pipeline_stage: {
        Args: {
          requested_code: string
          requested_hr_group_id: string
          requested_name: string
          requested_sort_order: number
          requested_tenant_id: string
        }
        Returns: Json
      }
      create_recruitment_set: {
        Args: {
          requested_description: string
          requested_hr_group_id: string
          requested_item_ids: Json
          requested_name: string
          requested_stable_code: string
          requested_tenant_id: string
        }
        Returns: Json
      }
      create_recruitment_vacancy: {
        Args: {
          requested_hr_group_id: string
          requested_job_id: string
          requested_location_label: string
          requested_max_hours: number
          requested_min_hours: number
          requested_salary_max: number
          requested_salary_min: number
          requested_salary_visible: boolean
          requested_sections: Json
          requested_tenant_id: string
          requested_title: string
          requested_work_mode: string
        }
        Returns: Json
      }
      create_salary_structure: {
        Args: { requested_hr_group_id: string; requested_payload: Json }
        Returns: Json
      }
      create_salary_structure_draft: {
        Args: { requested_payload: Json; requested_structure_id: string }
        Returns: Json
      }
      create_talent_notification: {
        Args: {
          requested_event_type: string
          requested_recipient_employee_id: string
          requested_source_entity_id?: string
          requested_summary: string
          requested_tenant_id: string
          requested_title: string
        }
        Returns: string
      }
      end_platform_support_session: {
        Args: { requested_session_id: string }
        Returns: boolean
      }
      expire_leave_buckets: {
        Args: { requested_as_of_date: string }
        Returns: number
      }
      finish_workflow_job: {
        Args: {
          requested_error_code?: string
          requested_job_id: string
          requested_outcome: string
          requested_result_reference_id?: string
          requested_worker_id: string
        }
        Returns: Json
      }
      get_document_acknowledgement_document: {
        Args: { requested_work_item_id: string }
        Returns: Json
      }
      get_employee_directory_access: {
        Args: {
          requested_administration_id: string
          requested_tenant_id: string
        }
        Returns: boolean
      }
      get_employee_directory_detail: {
        Args: {
          requested_administration_id: string
          requested_employee_id: string
          requested_tenant_id: string
          requested_week_start?: string
        }
        Returns: Json
      }
      get_employee_directory_visibility: {
        Args: {
          requested_administration_id: string
          requested_tenant_id: string
        }
        Returns: Json
      }
      get_employee_document_acknowledgements: {
        Args: { requested_employee_id: string }
        Returns: Json
      }
      get_employee_journey_projection: {
        Args: {
          requested_employee_id: string
          requested_hr_group_id: string
          requested_tenant_id: string
        }
        Returns: Json
      }
      get_internal_transfer_preview: {
        Args: { requested_work_item_id: string }
        Returns: Json
      }
      get_journey_projection: {
        Args: { requested_journey_id: string }
        Returns: Json
      }
      get_my_talent_profile: {
        Args: { requested_tenant_id: string }
        Returns: {
          job_code: string
          job_family_code: string
          job_family_id: string
          job_family_name: string
          job_group_code: string
          job_group_id: string
          job_group_name: string
          job_id: string
          job_is_active: boolean
          job_profile_id: string
          organizational_context: string
          profile_version_id: string
          purpose: string
          responsibilities: Json
          result_areas: Json
          seniority_code: string
          seniority_id: string
          seniority_name: string
          status: string
          summary: string
          tasks: Json
          tenant_id: string
          valid_from: string
          valid_until: string
          version_number: number
        }[]
      }
      get_my_talent_profile_requirements: {
        Args: {
          requested_profile_version_id: string
          requested_tenant_id: string
        }
        Returns: {
          capability_code: string
          capability_id: string
          capability_name: string
          capability_type: string
          certificate_details: Json
          id: string
          language_level: string
          profile_version_id: string
          rationale: string
          requirement_type: string
          sort_order: number
          target_level_code: string
          target_level_id: string
          target_level_name: string
        }[]
      }
      get_platform_control_snapshot: {
        Args: { requested_tenant_id?: string }
        Returns: Json
      }
      get_platform_hr_groups: {
        Args: { requested_tenant_id: string }
        Returns: Json
      }
      get_platform_support_read_model: {
        Args: { requested_session_id: string }
        Returns: Json
      }
      get_process_automation_operations: {
        Args: { requested_process_instance_id: string }
        Returns: Json
      }
      get_process_form_projection: {
        Args: { requested_language?: string; requested_work_item_id: string }
        Returns: Json
      }
      get_process_form_projection_with_bindings: {
        Args: { requested_language?: string; requested_work_item_id: string }
        Returns: Json
      }
      get_process_instance_projection: {
        Args: { requested_process_instance_id: string }
        Returns: Json
      }
      get_process_output_download_context: {
        Args: {
          requested_output_id: string
          requested_process_instance_id: string
        }
        Returns: Json
      }
      get_process_output_projection: {
        Args: {
          requested_language?: string
          requested_process_instance_id: string
        }
        Returns: Json
      }
      get_process_recipe_catalog: { Args: never; Returns: Json }
      get_process_recipe_start_context: {
        Args: {
          requested_hr_group_id: string
          requested_recipe_key: string
          requested_tenant_id: string
        }
        Returns: Json
      }
      get_process_work_item_detail: {
        Args: { requested_language?: string; requested_work_item_id: string }
        Returns: Json
      }
      get_process_work_projection: {
        Args: {
          requested_hr_group_id: string
          requested_language?: string
          requested_limit?: number
          requested_offset?: number
          requested_process_definition_id?: string
          requested_search?: string
          requested_sort?: string
          requested_status?: string
          requested_subject_employee_id?: string
          requested_tab?: string
        }
        Returns: Json
      }
      get_process_work_projection_for_employment: {
        Args: {
          requested_administration_id?: string
          requested_employment_id: string
          requested_hr_group_id: string
          requested_language?: string
          requested_limit?: number
          requested_offset?: number
          requested_process_definition_id?: string
          requested_search?: string
          requested_sort?: string
          requested_status?: string
          requested_tab?: string
        }
        Returns: Json
      }
      get_process_work_projection_with_administration: {
        Args: {
          requested_administration_id?: string
          requested_hr_group_id: string
          requested_language?: string
          requested_limit?: number
          requested_offset?: number
          requested_process_definition_id?: string
          requested_search?: string
          requested_sort?: string
          requested_status?: string
          requested_subject_employee_id?: string
          requested_tab?: string
        }
        Returns: Json
      }
      get_salary_insights_projection: {
        Args: {
          requested_as_of: string
          requested_hr_group_id: string
          requested_tenant_id: string
        }
        Returns: Json
      }
      get_team_compass_team_projection: {
        Args: {
          requested_campaign_id: string
          requested_department_id?: string
        }
        Returns: Json
      }
      hire_recruitment_application: {
        Args: {
          requested_administration_id: string
          requested_application_id: string
          requested_employee_id: string
          requested_employment_id: string
          requested_expected_version: number
          requested_idempotency_key: string
        }
        Returns: Json
      }
      import_holiday_snapshot: {
        Args: {
          requested_calendar_year: number
          requested_country_code: string
          requested_holidays: Json
          requested_hr_group_id: string
        }
        Returns: string
      }
      list_employee_overviews: {
        Args: {
          requested_archive_filter?: string
          requested_as_of?: string
          requested_hr_group_id: string
          requested_tenant_id: string
        }
        Returns: {
          avatar_url: string
          birth_name: string
          birth_name_prefix: string
          department_name: string
          employee_number: string
          employment_history: Json
          first_name: string
          id: string
          is_archived: boolean
          job_title: string
          work_email: string
        }[]
      }
      list_journey_projections: {
        Args: { requested_hr_group_id: string; requested_tenant_id: string }
        Returns: Json
      }
      manage_employment_company_location: {
        Args: {
          requested_effective_on: string
          requested_employment_id: string
          requested_location_id: string
          requested_placement_id: string
        }
        Returns: string
      }
      manage_employment_contract: {
        Args: {
          requested_contract_id: string
          requested_employment_id: string
          requested_payload: Json
        }
        Returns: string
      }
      manage_employment_organization_timeline: {
        Args: {
          requested_department_id: string
          requested_effective_on: string
          requested_employment_id: string
          requested_job_id: string
          requested_placement_id: string
        }
        Returns: string
      }
      next_custom_field_value: {
        Args: { p_definition_id: string }
        Returns: number
      }
      onboard_platform_tenant: {
        Args: {
          requested_administration_mode: Database["public"]["Enums"]["administration_mode"]
          requested_administrations: Json
          requested_name: string
          requested_primary_contact_email: string
          requested_slug: string
        }
        Returns: string
      }
      perform_process_work_item_action: {
        Args: {
          requested_action: string
          requested_correlation_id: string
          requested_expected_version: number
          requested_idempotency_key: string
          requested_step_expected_version: number
          requested_work_item_id: string
        }
        Returns: Json
      }
      publish_complete_employment: {
        Args: {
          requested_administration_id: string
          requested_employee_id: string
          requested_payload: Json
        }
        Returns: string
      }
      publish_complete_salary_application_employment: {
        Args: {
          requested_administration_id: string
          requested_employee_id: string
          requested_payload: Json
        }
        Returns: string
      }
      publish_employment_work_pattern: {
        Args: { requested_employment_id: string; requested_payload: Json }
        Returns: string
      }
      publish_journey_template: {
        Args: {
          requested_draft_id: string
          requested_expected_revision: number
        }
        Returns: Json
      }
      publish_process_definition_draft: {
        Args: {
          requested_changelog: string
          requested_compiled_definition: Json
          requested_compiler_version: string
          requested_definition_hash: string
          requested_definition_id: string
          requested_expected_revision: number
          requested_schema_version: number
        }
        Returns: Json
      }
      publish_recruitment_vacancy: {
        Args: {
          requested_payload: Json
          requested_slug: string
          requested_status: string
          requested_vacancy_id: string
        }
        Returns: Json
      }
      publish_reminder: {
        Args: { requested_reminder_id: string }
        Returns: number
      }
      publish_salary_structure_revision: {
        Args: {
          requested_expected_lock_version: number
          requested_revision_id: string
        }
        Returns: Json
      }
      re_resolve_process_work_item: {
        Args: {
          requested_expected_version: number
          requested_work_item_id: string
        }
        Returns: Json
      }
      reassign_process_work_item: {
        Args: {
          requested_employee_id: string
          requested_expected_version: number
          requested_work_item_id: string
        }
        Returns: Json
      }
      record_journey_topic_outcome: {
        Args: {
          requested_journey_id: string
          requested_note?: string
          requested_outcome_type: string
          requested_topic_id: string
        }
        Returns: Json
      }
      recover_absence: {
        Args: {
          requested_case_id: string
          requested_idempotency_key?: string
          requested_recovered_on: string
        }
        Returns: string
      }
      recruitment_analytics_projection: {
        Args: { requested_hr_group_id: string; requested_tenant_id: string }
        Returns: Json
      }
      recruitment_anonymize_application: {
        Args: { requested_application_id: string }
        Returns: Json
      }
      recruitment_document_download_claim: {
        Args: { requested_document_id: string }
        Returns: {
          document_id: string
        }[]
      }
      recruitment_participant_application_projection: {
        Args: { requested_application_id: string }
        Returns: {
          application_id: string
          candidate_first_name: string
          candidate_last_name: string
          capabilities: string[]
          interview_id: string
          interview_scheduled_at: string
          interview_title: string
          stage_id: string
          stage_name: string
          vacancy_title: string
          version: number
        }[]
      }
      recruitment_participant_assigned_applications: {
        Args: never
        Returns: Json[]
      }
      recruitment_participant_detail_projection: {
        Args: { requested_application_id: string }
        Returns: Json[]
      }
      recruitment_public_vacancy: {
        Args: { requested_publication_id: string; requested_slug: string }
        Returns: {
          content: Json
          location: string
          publication_id: string
          slug: string
          title: string
        }[]
      }
      recruitment_public_vacancy_state: {
        Args: { requested_publication_id: string; requested_slug: string }
        Returns: {
          location: string
          publication_id: string
          slug: string
          status: string
          title: string
        }[]
      }
      recruitment_run_retention: {
        Args: { requested_limit?: number }
        Returns: Json
      }
      recruitment_submit_public_application: {
        Args: {
          requested_intake_proof: string
          requested_payload: Json
          requested_publication_id: string
          requested_slug: string
        }
        Returns: string
      }
      release_process_work_item: {
        Args: {
          requested_expected_version: number
          requested_work_item_id: string
        }
        Returns: Json
      }
      reopen_recruitment_application: {
        Args: {
          expected_version: number
          requested_application_id: string
          requested_idempotency_key: string
          requested_stage_id: string
        }
        Returns: Json
      }
      reopen_talent_review_campaign: {
        Args: { requested_campaign_id: string }
        Returns: string
      }
      replace_journey_participant: {
        Args: {
          requested_expected_version: number
          requested_journey_id: string
          requested_participant_id: string
          requested_reason: string
          requested_replacement_employee_id: string
        }
        Returns: Json
      }
      replace_labor_condition_salary_structures: {
        Args: {
          requested_labor_condition_set_id: string
          requested_salary_structure_ids: string[]
        }
        Returns: Json
      }
      report_absence: {
        Args: {
          requested_absence_percentage: number
          requested_employee_id: string
          requested_employment_id: string
          requested_expected_recovery_on?: string
          requested_has_sickness_benefit_safety_net?: boolean
          requested_hr_group_id: string
          requested_idempotency_key?: string
          requested_is_third_party_traffic_accident?: boolean
          requested_is_work_accident?: boolean
          requested_start_date: string
          requested_tenant_id: string
        }
        Returns: string
      }
      request_process_work_item_changes: {
        Args: {
          requested_body: string
          requested_correlation_id: string
          requested_expected_version: number
          requested_idempotency_key: string
          requested_step_expected_version: number
          requested_work_item_id: string
        }
        Returns: Json
      }
      requeue_workflow_job: {
        Args: { requested_job_id: string }
        Returns: Json
      }
      reserve_employee_number: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      resolve_leave_accrual_rule_for_employment: {
        Args: {
          requested_as_of_date: string
          requested_employment_id: string
          requested_hr_group_id: string
          requested_leave_type_id: string
          requested_tenant_id: string
        }
        Returns: {
          accrual_amount: number
          accrual_rate: number
          expiration_months: number
          leave_profile_id: string
          leave_type_id: string
          no_accrual: boolean
          resolution_source: string
          rule_id: string
        }[]
      }
      resolve_leave_profile_for_employment: {
        Args: {
          requested_as_of_date: string
          requested_employment_id: string
          requested_hr_group_id: string
          requested_tenant_id: string
        }
        Returns: string
      }
      retire_journey_template: {
        Args: { requested_template_id: string }
        Returns: Json
      }
      retire_process_definition: {
        Args: { requested_definition_id: string; requested_reason: string }
        Returns: Json
      }
      rollback_latest_employment_timeline: {
        Args: {
          requested_effective_on: string
          requested_employment_id: string
          requested_reason: string
          requested_timeline: string
        }
        Returns: string
      }
      rollback_talent_import_batch: {
        Args: {
          requested_batch_id: string
          requested_idempotency_key: string
          requested_tenant_id: string
        }
        Returns: Json
      }
      save_administration_salary_settings: {
        Args: {
          requested_administration_id: string
          requested_routes: Database["public"]["Enums"]["salary_application_route"][]
          requested_structure_ids: string[]
        }
        Returns: Json
      }
      save_group_leave_type: {
        Args: {
          requested_allow_limit_overrun: boolean
          requested_annual_hours_cap: number
          requested_annual_hours_fte_cap: number
          requested_color_code: string
          requested_entitlement_mode: Database["public"]["Enums"]["leave_type_entitlement_mode"]
          requested_hr_group_id: string
          requested_is_active: boolean
          requested_is_self_service: boolean
          requested_leave_type_id: string
          requested_name: string
          requested_notify_manager_on_request: boolean
          requested_overtime_work_hour_type_ids: string[]
          requested_pin_in_calendar: boolean
          requested_requires_manager_approval: boolean
          requested_requires_manager_approval_on_cancellation: boolean
          requested_tenant_id: string
        }
        Returns: string
      }
      save_journey_template_draft: {
        Args: {
          requested_draft: Json
          requested_draft_id: string
          requested_expected_revision: number
        }
        Returns: Json
      }
      save_process_definition_draft: {
        Args: {
          requested_definition: Json
          requested_definition_id: string
          requested_expected_revision: number
          requested_validation_report?: Json
        }
        Returns: Json
      }
      save_process_form_response: {
        Args: {
          requested_correlation_id: string
          requested_expected_revision: number
          requested_expected_version: number
          requested_idempotency_key: string
          requested_language?: string
          requested_values: Json
          requested_work_item_id: string
        }
        Returns: Json
      }
      save_process_form_response_with_bindings: {
        Args: {
          requested_correlation_id: string
          requested_expected_revision: number
          requested_expected_version: number
          requested_idempotency_key: string
          requested_language?: string
          requested_values: Json
          requested_work_item_id: string
        }
        Returns: Json
      }
      save_salary_structure_draft: {
        Args: {
          requested_draft_id: string
          requested_expected_lock_version: number
          requested_payload: Json
          requested_structure_id: string
        }
        Returns: Json
      }
      save_team_compass_campaign: {
        Args: {
          requested_campaign_id?: string
          requested_expected_version?: number
          requested_hr_group_id: string
          requested_payload: Json
          requested_tenant_id: string
        }
        Returns: Json
      }
      save_team_compass_response: {
        Args: {
          requested_answers: Json
          requested_expected_version: number
          requested_participation_id: string
          requested_share_inner?: boolean
          requested_share_outer?: boolean
          requested_submit: boolean
        }
        Returns: Json
      }
      set_recruitment_library_item_enabled: {
        Args: { requested_is_enabled: boolean; requested_item_id: string }
        Returns: Json
      }
      set_recruitment_pipeline_stage_active: {
        Args: {
          expected_version: number
          requested_is_active: boolean
          requested_stage_id: string
        }
        Returns: Json
      }
      soft_delete_company_document: {
        Args: { requested_document_id: string }
        Returns: undefined
      }
      start_document_acknowledgement: {
        Args: {
          requested_correlation_id: string
          requested_document_id: string
          requested_idempotency_key: string
          requested_process_definition_id: string
          requested_subject_employee_id: string
        }
        Returns: Json
      }
      start_platform_support_session: {
        Args: {
          requested_duration_minutes: number
          requested_reason: string
          requested_tenant_id: string
        }
        Returns: string
      }
      start_process: {
        Args: {
          requested_business_effective_date: string
          requested_correlation_id: string
          requested_employment_id: string
          requested_idempotency_key: string
          requested_process_definition_id: string
          requested_subject_employee_id: string
        }
        Returns: Json
      }
      start_talent_review_campaign: {
        Args: { requested_campaign_id: string }
        Returns: string
      }
      start_team_compass_campaign: {
        Args: {
          requested_campaign_id: string
          requested_expected_version: number
        }
        Returns: Json
      }
      submit_enps_response: {
        Args: { p_answers: Json; p_invitation_id: string }
        Returns: string
      }
      submit_recruitment_assessment: {
        Args: {
          requested_assessment_id: string
          requested_expected_version: number
        }
        Returns: Json
      }
      submit_survey_response: {
        Args: { p_answers: Json; p_invitation_id: string }
        Returns: string
      }
      terminal_transition_recruitment_application: {
        Args: {
          expected_version: number
          requested_application_id: string
          requested_idempotency_key: string
          requested_outcome: string
          requested_reason: string
        }
        Returns: Json
      }
      transition_journey: {
        Args: {
          requested_action: string
          requested_expected_version: number
          requested_journey_id: string
        }
        Returns: Json
      }
      transition_recruitment_application: {
        Args: {
          expected_version: number
          requested_application_id: string
          requested_idempotency_key: string
          requested_stage_id: string
        }
        Returns: Json
      }
      transition_team_compass_campaign: {
        Args: {
          requested_campaign_id: string
          requested_expected_version: number
          requested_status: string
        }
        Returns: string
      }
      update_enps_draft: {
        Args: { p_campaign_id: string; p_payload: Json }
        Returns: string
      }
      update_group_leave_accrual_rule: {
        Args: {
          requested_accrual_amount: number
          requested_accrual_basis: Database["public"]["Enums"]["leave_accrual_basis"]
          requested_accrual_frequency: Database["public"]["Enums"]["leave_accrual_frequency"]
          requested_accrual_rate: number
          requested_accrual_timing: Database["public"]["Enums"]["leave_accrual_timing"]
          requested_expiration_months: number
          requested_hr_group_id: string
          requested_leave_profile_id: string
          requested_leave_type_id: string
          requested_pause_leave_type_ids: string[]
          requested_rule_id: string
          requested_tenant_id: string
          requested_work_hour_type_ids: string[]
        }
        Returns: string
      }
      update_personal_reminder: {
        Args: {
          requested_description: string
          requested_remind_at: string
          requested_reminder_id: string
          requested_title: string
        }
        Returns: undefined
      }
      update_recruitment_library_item: {
        Args: {
          requested_content: Json
          requested_expected_version: number
          requested_is_active: boolean
          requested_item_id: string
          requested_title: string
        }
        Returns: Json
      }
      update_recruitment_pipeline_stage: {
        Args: {
          requested_expected_version: number
          requested_is_active: boolean
          requested_name: string
          requested_sort_order: number
          requested_stage_id: string
        }
        Returns: Json
      }
      update_recruitment_retention_settings: {
        Args: {
          expected_version: number
          requested_hr_group_id: string
          requested_retention_days: number
          requested_tenant_id: string
        }
        Returns: Json
      }
      update_recruitment_set: {
        Args: {
          requested_description: string
          requested_expected_version: number
          requested_is_active: boolean
          requested_item_ids: Json
          requested_name: string
          requested_set_id: string
        }
        Returns: Json
      }
      update_recruitment_settings: {
        Args: {
          requested_expected_version: number
          requested_hr_group_id: string
          requested_public_branding: Json
          requested_publication_defaults: Json
          requested_retention_days: number
          requested_tenant_id: string
        }
        Returns: Json
      }
      update_recruitment_vacancy: {
        Args: {
          requested_expected_version: number
          requested_job_id: string
          requested_location_label: string
          requested_max_hours: number
          requested_min_hours: number
          requested_salary_max: number
          requested_salary_min: number
          requested_salary_visible: boolean
          requested_sections: Json
          requested_title: string
          requested_vacancy_id: string
          requested_work_mode: string
        }
        Returns: Json
      }
      update_reminder_recipient: {
        Args: {
          requested_action: string
          requested_recipient_id: string
          requested_remind_at?: string
        }
        Returns: undefined
      }
      complete_ai_provider_execution: {
        Args: { requested_invocation_id: string; requested_lease_id: string }
        Returns: undefined
      }
      ensure_ai_monthly_allowance: {
        Args: {
          requested_hr_group_id: string
          requested_month: string
          requested_tenant_id: string
        }
        Returns: undefined
      }
      get_ai_actor_quota: {
        Args: {
          requested_actor_user_id: string
          requested_hr_group_id: string
          requested_month: string
          requested_tenant_id: string
        }
        Returns: {
          monthly_quota_credits: number
          period_month: string
          quality_profile: string
          released_credits: number
          remaining_credits: number
          reserved_credits: number
          role_codes: string[]
          settled_credits: number
          used_credits: number
        }[]
      }
      get_ai_group_credit_balance: {
        Args: { requested_hr_group_id: string; requested_tenant_id: string }
        Returns: {
          as_of: string
          available_credits: number
          expired_credits: number
          monthly_allowance_credits: number
          purchased_extra_credits: number
          reserved_credits: number
          settled_credits: number
          test_grant_credits: number
          total_credits: number
        }[]
      }
      get_ai_reservation_allocations: {
        Args: {
          requested_invocation_id: string
          requested_reservation_id: string
        }
        Returns: {
          allocated_credits: number
          allocation_id: string
          allocation_type: string
          created_at: string
          expires_at: string
          period_month: string
          released_credits: number
          reservation_id: string
          reserved_credits: number
          settled_credits: number
        }[]
      }
      grant_ai_controlled_test_credits: {
        Args: {
          requested_credit_amount: number
          requested_hr_group_id: string
          requested_source_reference: string
          requested_tenant_id: string
        }
        Returns: string
      }
      reserve_ai_provider_execution: {
        Args: {
          requested_actor_user_id: string
          requested_enabled: boolean
          requested_environment: string
          requested_feature_max_input_characters: number
          requested_global_max_input_characters: number
          requested_global_max_output_tokens: number
          requested_hr_group_id: string
          requested_input_size_characters: number
          requested_invocation_id: string
          requested_lease_seconds: number
          requested_max_calls_per_day: number
          requested_max_calls_per_hour: number
          requested_max_concurrent: number
          requested_output_tokens: number
          requested_tenant_id: string
        }
        Returns: {
          allowed: boolean
          block_reason: string
          counted_at: string
          environment: string
          expires_at: string
          invocation_id: string
          lease_id: string
        }[]
      }
      release_ai_credits: {
        Args: {
          requested_invocation_id: string
          requested_reason: string
          requested_reservation_id: string
        }
        Returns: undefined
      }
      reserve_ai_credits: {
        Args: {
          requested_actor_user_id: string
          requested_charge_reference: string
          requested_feature_code: string
          requested_hr_group_id: string
          requested_idempotency_key: string
          requested_invocation_id: string
          requested_month: string
          requested_tenant_id: string
        }
        Returns: {
          charge_reference: string
          invocation_id: string
          reservation_id: string
          units: number
        }[]
      }
      settle_ai_credits: {
        Args: {
          requested_invocation_id: string
          requested_reservation_id: string
        }
        Returns: undefined
      }
      update_survey_draft: {
        Args: { p_campaign_id: string; p_payload: Json }
        Returns: string
      }
      upsert_recruitment_assessment_draft: {
        Args: { requested_interview_id: string; requested_scores: Json }
        Returns: Json
      }
      upsert_star_performer_assessment: {
        Args: { requested_administration_id: string; requested_payload: Json }
        Returns: string
      }
    }
    Enums: {
      absence_case_status: "ACTIVE" | "RECOVERY_WINDOW" | "CLOSED"
      access_scope_type: "TENANT" | "ADMINISTRATION"
      administration_mode: "SEPARATE" | "COMBINED"
      ai_draft_status:
        | "PENDING"
        | "CONFIRMED"
        | "CANCELLED"
        | "EXPIRED"
        | "EXECUTED"
        | "FAILED"
        | "AWAITING_CONFIRMATION"
        | "EXECUTING"
        | "SUCCEEDED"
      ai_memory_category: "PREFERENCE" | "WORKING_CONTEXT"
      ai_message_role: "USER" | "ASSISTANT" | "TOOL"
      analog_clock_style: "CLASSIC" | "MINIMAL" | "LIQUID"
      clock_mode: "ANALOG" | "DIGITAL" | "HIDDEN"
      contract_duration_type: "INDEFINITE" | "DEFINITE" | "TEMPORARY_NO_END"
      contract_type:
        | "INDEFINITE"
        | "DEFINITE"
        | "ON_CALL"
        | "TEMPORARY_AGENCY"
        | "EXTERNAL"
        | "TEMPORARY_NO_END"
      custom_field_audience_access: "HIDDEN" | "READ" | "WRITE"
      custom_field_entity_type:
        | "EMPLOYEE"
        | "DOCUMENT"
        | "RECRUITMENT_APPLICATION"
      custom_field_type:
        | "TEXT"
        | "TEXTAREA"
        | "NUMBER"
        | "DATE"
        | "BOOLEAN"
        | "SELECT"
        | "MULTI_SELECT"
        | "AUTO_INCREMENT"
      date_format: "DMY" | "MDY" | "YMD"
      document_target_type: "EMPLOYEE" | "MANAGEMENT_ROLE" | "DEPARTMENT_BRANCH"
      education_level: "MBO" | "HBO" | "WO" | "HIGHSCHOOL" | "OTHER" | "UNKNOWN"
      employment_record_status: "DRAFT" | "CONFIRMED" | "CANCELLED"
      employment_type:
        | "EMPLOYEE"
        | "INTERN"
        | "APPRENTICE"
        | "CONTRACTOR"
        | "TEMPORARY_AGENCY"
        | "FREELANCER"
        | "VOLUNTEER"
        | "NO_PAYROLL"
      employment_work_scope: "FULL_TIME" | "PART_TIME"
      employment_worker_type:
        | "EMPLOYEE"
        | "STUDENT_INTERN"
        | "TEMPORARY_AGENCY"
        | "EXTERNAL_NO_PAYROLL"
      final_settlement_status:
        | "NOT_STARTED"
        | "IN_PROGRESS"
        | "READY"
        | "COMPLETED"
      gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY"
      identity_match_decision:
        | "EXISTING_EMPLOYEE"
        | "DIFFERENT_PERSON"
        | "UNRESOLVED"
      income_relationship_type: "EMPLOYMENT" | "SOCIAL_BENEFIT" | "OTHER"
      invitation_email_kind: "PRIVATE" | "BUSINESS"
      invitation_purpose: "PREBOARDING_EMPLOYEE" | "BUSINESS_USER"
      invitation_status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"
      journey_anchor_rule: "EMPLOYMENT_START_DATE" | "MANUAL_DATE"
      journey_participant_source:
        | "TARGET_EMPLOYEE"
        | "DIRECT_MANAGER"
        | "DEPARTMENT_MANAGER"
        | "SPECIFIC_EMPLOYEE"
        | "MANUAL"
      journey_participant_status: "ASSIGNED" | "ACTIVE" | "REPLACED" | "REMOVED"
      journey_reminder_link_status: "ACTIVE" | "SUSPENDED" | "CANCELLED"
      journey_role_cardinality: "ONE" | "MANY"
      journey_role_resolver_type:
        | "TARGET_EMPLOYEE"
        | "DIRECT_MANAGER"
        | "DEPARTMENT_MANAGER"
        | "SPECIFIC_EMPLOYEE"
        | "MANUAL"
      journey_status:
        | "PLANNED"
        | "ACTIVE"
        | "PAUSED"
        | "COMPLETED"
        | "CANCELLED"
      journey_template_lifecycle: "DRAFT" | "PUBLISHED" | "RETIRED"
      journey_template_version_status: "DRAFT" | "PUBLISHED"
      journey_topic_outcome_type: "COMPLETE" | "SKIP" | "CHECK_IN"
      journey_topic_status: "PENDING" | "COMPLETED" | "SKIPPED"
      journey_topic_type: "INFORMATION" | "ACTION" | "CHECK_IN" | "DOCUMENT"
      journey_type:
        | "PREBOARDING"
        | "ONBOARDING"
        | "REBOARDING"
        | "INTERNAL_TRANSFER"
        | "PROMOTION"
        | "RETURN"
        | "OFFBOARDING"
        | "CUSTOM"
      leave_accrual_basis: "CONTRACT_HOURS" | "WORKED_HOURS" | "AGE_SENIORITY"
      leave_accrual_frequency:
        | "PAYROLL_PERIOD"
        | "YEARLY"
        | "FOUR_WEEKLY"
        | "MONTHLY"
      leave_accrual_timing: "UPFRONT" | "ARREARS"
      leave_bonus_award_timing: "START_OF_YEAR" | "ON_TRIGGER_DATE"
      leave_bonus_trigger_type: "AGE" | "SENIORITY"
      leave_request_mode: "PRIORITY" | "DIRECT"
      leave_request_status: "APPROVED" | "REJECTED" | "CANCELLED"
      leave_request_time_mode:
        | "FULL_DAY"
        | "MORNING"
        | "AFTERNOON"
        | "SPECIFIC_HOURS"
      leave_transaction_type:
        | "ACCRUAL"
        | "OPENING_BALANCE"
        | "MANUAL_ADJUSTMENT"
        | "TAKEN"
        | "EXPIRED_DEDUCTION"
      leave_type_entitlement_mode:
        | "ACCRUAL"
        | "UNLIMITED"
        | "ANNUAL_HOURS_CAP"
        | "WEEKLY_HOURS_FACTOR_CAP"
        | "ANNUAL_HOURS_FTE_CAP"
        | "OVERTIME_HOURS"
      leave_work_hour_entry_status:
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "REVOKED"
      leave_year_control_status:
        | "LOCKED"
        | "ACTIVE"
        | "OPEN_FOR_FUTURE_REQUESTS"
      marital_status:
        | "SINGLE"
        | "MARRIED"
        | "REGISTERED_PARTNERSHIP"
        | "DIVORCED"
        | "WIDOWED"
      minimum_wage_scheme: "REGULAR" | "BBL"
      name_usage:
        | "BIRTH_NAME"
        | "PARTNER_NAME"
        | "PARTNER_BEFORE_BIRTH_NAME"
        | "BIRTH_NAME_BEFORE_PARTNER_NAME"
      overtime_limit_mode:
        | "UNLIMITED"
        | "MONTHLY_HOURS"
        | "YEARLY_HOURS"
        | "CONTRACT_HOURS_FACTOR"
      payroll_reporting_status: "DRAFT" | "READY" | "REPORTED" | "CLOSED"
      platform_operator_role: "OWNER" | "OPERATOR" | "AUDITOR"
      platform_support_session_status: "ACTIVE" | "ENDED"
      process_assignment_mode: "EXACTLY_ONE" | "ANY_ONE" | "ALL"
      process_definition_status: "DRAFT" | "PUBLISHED" | "RETIRED"
      process_instance_status:
        | "DRAFT"
        | "RUNNING"
        | "WAITING"
        | "BLOCKED"
        | "COMPLETED"
        | "REJECTED"
        | "CANCELLED"
        | "FAILED"
      process_output_status: "PENDING" | "AVAILABLE" | "FAILED"
      process_step_instance_status:
        | "PENDING"
        | "ACTIVE"
        | "BLOCKED"
        | "COMPLETED"
        | "REJECTED"
        | "CANCELLED"
      process_work_item_status:
        | "OPEN"
        | "CLAIMED"
        | "COMPLETED"
        | "CANCELLED"
        | "EXPIRED"
        | "BLOCKED"
      relation_type:
        | "PARTNER"
        | "CHILD"
        | "PARENT"
        | "SIBLING"
        | "DOCTOR"
        | "DENTIST"
        | "OTHER"
      reminder_recipient_status: "PENDING" | "COMPLETED" | "DISMISSED"
      reminder_status: "DRAFT" | "PUBLISHED" | "CANCELLED"
      reminder_target_type: "SELF" | "EVERYONE" | "DEPARTMENTS" | "EMPLOYEES"
      reminder_type: "PERSONAL" | "HR"
      salary_application_route:
        | "MANUAL"
        | "MINIMUM_WAGE"
        | "SCALE_WITH_STEPS"
        | "SALARY_BAND"
      salary_band_input_method: "MIDPOINT_SPREAD" | "MIN_MAX" | "MANUAL_ANCHORS"
      salary_basis:
        | "MANUAL"
        | "MINIMUM_WAGE"
        | "CUSTOM_SCALE"
        | "CAO_SCALE"
        | "SALARY_BAND"
      salary_frequency: "MONTHLY" | "FOUR_WEEKLY"
      salary_payment_type: "PERIODIC_FIXED" | "HOURLY_VARIABLE"
      salary_progression_type: "MANUAL" | "TIME_IN_STEP" | "FIXED_DATE"
      salary_revision_status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
      salary_step_kind: "REGULAR" | "START" | "MAXIMUM" | "SPECIAL"
      salary_structure_basis:
        | "MONTHLY_BASE"
        | "FOUR_WEEKLY_BASE"
        | "ANNUAL_BASE"
        | "HOURLY"
      salary_structure_migration_status: "OPEN" | "RESOLVED" | "IGNORED"
      salary_structure_type: "SCALE_WITH_STEPS" | "SALARY_BAND"
      schedule_type:
        | "HOURS_PER_DAY"
        | "HOURS_AND_AVG_DAYS"
        | "HOURS_AND_SPECIFIC_DAYS"
        | "TIMES_PER_DAY"
      sharing_mode: "FULLY_ISOLATED" | "SHARED_COLLEAGUES"
      tenant_lifecycle_status:
        | "PROVISIONING"
        | "ACTIVE"
        | "PAUSED"
        | "TERMINATING"
        | "TERMINATED"
      termination_initiator:
        | "EMPLOYER"
        | "EMPLOYEE"
        | "MUTUAL"
        | "BY_LAW"
        | "OTHER"
      termination_workflow_status:
        | "DRAFT"
        | "CONFIRMED"
        | "PAYROLL_READY"
        | "REPORTED"
        | "CANCELLED"
      time_format: "24H" | "12H"
      ui_locale: "nl" | "en"
      ui_theme:
        | "liquid-navy"
        | "noordzee"
        | "bos"
        | "warm-zand"
        | "aubergine"
        | "nacht"
        | "linkedhr"
      week_numbering_system: "JANUARY_FIRST" | "ISO"
      work_hour_type_category: "REGULAR_WORK" | "OVERTIME" | "INFORMATIONAL"
      workflow_job_status:
        | "READY"
        | "RUNNING"
        | "RETRY"
        | "SUCCEEDED"
        | "DEAD_LETTER"
      workflow_job_type: "PROCESS_REMINDER" | "PROCESS_DOCUMENT_OUTPUT"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      absence_case_status: ["ACTIVE", "RECOVERY_WINDOW", "CLOSED"],
      access_scope_type: ["TENANT", "ADMINISTRATION"],
      administration_mode: ["SEPARATE", "COMBINED"],
      ai_draft_status: [
        "PENDING",
        "CONFIRMED",
        "CANCELLED",
        "EXPIRED",
        "EXECUTED",
        "FAILED",
        "AWAITING_CONFIRMATION",
        "EXECUTING",
        "SUCCEEDED",
      ],
      ai_memory_category: ["PREFERENCE", "WORKING_CONTEXT"],
      ai_message_role: ["USER", "ASSISTANT", "TOOL"],
      analog_clock_style: ["CLASSIC", "MINIMAL", "LIQUID"],
      clock_mode: ["ANALOG", "DIGITAL", "HIDDEN"],
      contract_duration_type: ["INDEFINITE", "DEFINITE", "TEMPORARY_NO_END"],
      contract_type: [
        "INDEFINITE",
        "DEFINITE",
        "ON_CALL",
        "TEMPORARY_AGENCY",
        "EXTERNAL",
        "TEMPORARY_NO_END",
      ],
      custom_field_audience_access: ["HIDDEN", "READ", "WRITE"],
      custom_field_entity_type: [
        "EMPLOYEE",
        "DOCUMENT",
        "RECRUITMENT_APPLICATION",
      ],
      custom_field_type: [
        "TEXT",
        "TEXTAREA",
        "NUMBER",
        "DATE",
        "BOOLEAN",
        "SELECT",
        "MULTI_SELECT",
        "AUTO_INCREMENT",
      ],
      date_format: ["DMY", "MDY", "YMD"],
      document_target_type: [
        "EMPLOYEE",
        "MANAGEMENT_ROLE",
        "DEPARTMENT_BRANCH",
      ],
      education_level: ["MBO", "HBO", "WO", "HIGHSCHOOL", "OTHER", "UNKNOWN"],
      employment_record_status: ["DRAFT", "CONFIRMED", "CANCELLED"],
      employment_type: [
        "EMPLOYEE",
        "INTERN",
        "APPRENTICE",
        "CONTRACTOR",
        "TEMPORARY_AGENCY",
        "FREELANCER",
        "VOLUNTEER",
        "NO_PAYROLL",
      ],
      employment_work_scope: ["FULL_TIME", "PART_TIME"],
      employment_worker_type: [
        "EMPLOYEE",
        "STUDENT_INTERN",
        "TEMPORARY_AGENCY",
        "EXTERNAL_NO_PAYROLL",
      ],
      final_settlement_status: [
        "NOT_STARTED",
        "IN_PROGRESS",
        "READY",
        "COMPLETED",
      ],
      gender: ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"],
      identity_match_decision: [
        "EXISTING_EMPLOYEE",
        "DIFFERENT_PERSON",
        "UNRESOLVED",
      ],
      income_relationship_type: ["EMPLOYMENT", "SOCIAL_BENEFIT", "OTHER"],
      invitation_email_kind: ["PRIVATE", "BUSINESS"],
      invitation_purpose: ["PREBOARDING_EMPLOYEE", "BUSINESS_USER"],
      invitation_status: ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"],
      journey_anchor_rule: ["EMPLOYMENT_START_DATE", "MANUAL_DATE"],
      journey_participant_source: [
        "TARGET_EMPLOYEE",
        "DIRECT_MANAGER",
        "DEPARTMENT_MANAGER",
        "SPECIFIC_EMPLOYEE",
        "MANUAL",
      ],
      journey_participant_status: ["ASSIGNED", "ACTIVE", "REPLACED", "REMOVED"],
      journey_reminder_link_status: ["ACTIVE", "SUSPENDED", "CANCELLED"],
      journey_role_cardinality: ["ONE", "MANY"],
      journey_role_resolver_type: [
        "TARGET_EMPLOYEE",
        "DIRECT_MANAGER",
        "DEPARTMENT_MANAGER",
        "SPECIFIC_EMPLOYEE",
        "MANUAL",
      ],
      journey_status: ["PLANNED", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"],
      journey_template_lifecycle: ["DRAFT", "PUBLISHED", "RETIRED"],
      journey_template_version_status: ["DRAFT", "PUBLISHED"],
      journey_topic_outcome_type: ["COMPLETE", "SKIP", "CHECK_IN"],
      journey_topic_status: ["PENDING", "COMPLETED", "SKIPPED"],
      journey_topic_type: ["INFORMATION", "ACTION", "CHECK_IN", "DOCUMENT"],
      journey_type: [
        "PREBOARDING",
        "ONBOARDING",
        "REBOARDING",
        "INTERNAL_TRANSFER",
        "PROMOTION",
        "RETURN",
        "OFFBOARDING",
        "CUSTOM",
      ],
      leave_accrual_basis: ["CONTRACT_HOURS", "WORKED_HOURS", "AGE_SENIORITY"],
      leave_accrual_frequency: [
        "PAYROLL_PERIOD",
        "YEARLY",
        "FOUR_WEEKLY",
        "MONTHLY",
      ],
      leave_accrual_timing: ["UPFRONT", "ARREARS"],
      leave_bonus_award_timing: ["START_OF_YEAR", "ON_TRIGGER_DATE"],
      leave_bonus_trigger_type: ["AGE", "SENIORITY"],
      leave_request_mode: ["PRIORITY", "DIRECT"],
      leave_request_status: ["APPROVED", "REJECTED", "CANCELLED"],
      leave_request_time_mode: [
        "FULL_DAY",
        "MORNING",
        "AFTERNOON",
        "SPECIFIC_HOURS",
      ],
      leave_transaction_type: [
        "ACCRUAL",
        "OPENING_BALANCE",
        "MANUAL_ADJUSTMENT",
        "TAKEN",
        "EXPIRED_DEDUCTION",
      ],
      leave_type_entitlement_mode: [
        "ACCRUAL",
        "UNLIMITED",
        "ANNUAL_HOURS_CAP",
        "WEEKLY_HOURS_FACTOR_CAP",
        "ANNUAL_HOURS_FTE_CAP",
        "OVERTIME_HOURS",
      ],
      leave_work_hour_entry_status: [
        "PENDING",
        "APPROVED",
        "REJECTED",
        "REVOKED",
      ],
      leave_year_control_status: [
        "LOCKED",
        "ACTIVE",
        "OPEN_FOR_FUTURE_REQUESTS",
      ],
      marital_status: [
        "SINGLE",
        "MARRIED",
        "REGISTERED_PARTNERSHIP",
        "DIVORCED",
        "WIDOWED",
      ],
      minimum_wage_scheme: ["REGULAR", "BBL"],
      name_usage: [
        "BIRTH_NAME",
        "PARTNER_NAME",
        "PARTNER_BEFORE_BIRTH_NAME",
        "BIRTH_NAME_BEFORE_PARTNER_NAME",
      ],
      overtime_limit_mode: [
        "UNLIMITED",
        "MONTHLY_HOURS",
        "YEARLY_HOURS",
        "CONTRACT_HOURS_FACTOR",
      ],
      payroll_reporting_status: ["DRAFT", "READY", "REPORTED", "CLOSED"],
      platform_operator_role: ["OWNER", "OPERATOR", "AUDITOR"],
      platform_support_session_status: ["ACTIVE", "ENDED"],
      process_assignment_mode: ["EXACTLY_ONE", "ANY_ONE", "ALL"],
      process_definition_status: ["DRAFT", "PUBLISHED", "RETIRED"],
      process_instance_status: [
        "DRAFT",
        "RUNNING",
        "WAITING",
        "BLOCKED",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
        "FAILED",
      ],
      process_output_status: ["PENDING", "AVAILABLE", "FAILED"],
      process_step_instance_status: [
        "PENDING",
        "ACTIVE",
        "BLOCKED",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
      ],
      process_work_item_status: [
        "OPEN",
        "CLAIMED",
        "COMPLETED",
        "CANCELLED",
        "EXPIRED",
        "BLOCKED",
      ],
      relation_type: [
        "PARTNER",
        "CHILD",
        "PARENT",
        "SIBLING",
        "DOCTOR",
        "DENTIST",
        "OTHER",
      ],
      reminder_recipient_status: ["PENDING", "COMPLETED", "DISMISSED"],
      reminder_status: ["DRAFT", "PUBLISHED", "CANCELLED"],
      reminder_target_type: ["SELF", "EVERYONE", "DEPARTMENTS", "EMPLOYEES"],
      reminder_type: ["PERSONAL", "HR"],
      salary_application_route: [
        "MANUAL",
        "MINIMUM_WAGE",
        "SCALE_WITH_STEPS",
        "SALARY_BAND",
      ],
      salary_band_input_method: [
        "MIDPOINT_SPREAD",
        "MIN_MAX",
        "MANUAL_ANCHORS",
      ],
      salary_basis: [
        "MANUAL",
        "MINIMUM_WAGE",
        "CUSTOM_SCALE",
        "CAO_SCALE",
        "SALARY_BAND",
      ],
      salary_frequency: ["MONTHLY", "FOUR_WEEKLY"],
      salary_payment_type: ["PERIODIC_FIXED", "HOURLY_VARIABLE"],
      salary_progression_type: ["MANUAL", "TIME_IN_STEP", "FIXED_DATE"],
      salary_revision_status: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      salary_step_kind: ["REGULAR", "START", "MAXIMUM", "SPECIAL"],
      salary_structure_basis: [
        "MONTHLY_BASE",
        "FOUR_WEEKLY_BASE",
        "ANNUAL_BASE",
        "HOURLY",
      ],
      salary_structure_migration_status: ["OPEN", "RESOLVED", "IGNORED"],
      salary_structure_type: ["SCALE_WITH_STEPS", "SALARY_BAND"],
      schedule_type: [
        "HOURS_PER_DAY",
        "HOURS_AND_AVG_DAYS",
        "HOURS_AND_SPECIFIC_DAYS",
        "TIMES_PER_DAY",
      ],
      sharing_mode: ["FULLY_ISOLATED", "SHARED_COLLEAGUES"],
      tenant_lifecycle_status: [
        "PROVISIONING",
        "ACTIVE",
        "PAUSED",
        "TERMINATING",
        "TERMINATED",
      ],
      termination_initiator: [
        "EMPLOYER",
        "EMPLOYEE",
        "MUTUAL",
        "BY_LAW",
        "OTHER",
      ],
      termination_workflow_status: [
        "DRAFT",
        "CONFIRMED",
        "PAYROLL_READY",
        "REPORTED",
        "CANCELLED",
      ],
      time_format: ["24H", "12H"],
      ui_locale: ["nl", "en"],
      ui_theme: [
        "liquid-navy",
        "noordzee",
        "bos",
        "warm-zand",
        "aubergine",
        "nacht",
        "linkedhr",
      ],
      week_numbering_system: ["JANUARY_FIRST", "ISO"],
      work_hour_type_category: ["REGULAR_WORK", "OVERTIME", "INFORMATIONAL"],
      workflow_job_status: [
        "READY",
        "RUNNING",
        "RETRY",
        "SUCCEEDED",
        "DEAD_LETTER",
      ],
      workflow_job_type: ["PROCESS_REMINDER", "PROCESS_DOCUMENT_OUTPUT"],
    },
  },
} as const
