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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      administrations: {
        Row: {
          coc_number: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          tenant_id: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          coc_number?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          coc_number?: string | null
          code?: string
          created_at?: string
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
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          administration_id: string | null
          change_set_id: string | null
          changes: Json
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
          administration_id: string
          definition_id: string
          next_value: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          definition_id: string
          next_value?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          definition_id?: string
          next_value?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_counters_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: true
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_counters_definition_scope_fkey"
            columns: ["tenant_id", "administration_id", "definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
          administration_id: string
          created_at: string
          deleted_at: string | null
          description_en: string | null
          description_nl: string | null
          employee_self_access: Database["public"]["Enums"]["custom_field_audience_access"]
          entity_type: Database["public"]["Enums"]["custom_field_entity_type"]
          field_type: Database["public"]["Enums"]["custom_field_type"]
          hr_access: Database["public"]["Enums"]["custom_field_audience_access"]
          id: string
          is_active: boolean
          is_required: boolean
          key: string
          label_en: string
          label_nl: string
          manager_access: Database["public"]["Enums"]["custom_field_audience_access"]
          sort_order: number
          tenant_id: string
          updated_at: string
          validation_rules: Json
        }
        Insert: {
          administration_id: string
          created_at?: string
          deleted_at?: string | null
          description_en?: string | null
          description_nl?: string | null
          employee_self_access?: Database["public"]["Enums"]["custom_field_audience_access"]
          entity_type?: Database["public"]["Enums"]["custom_field_entity_type"]
          field_type: Database["public"]["Enums"]["custom_field_type"]
          hr_access?: Database["public"]["Enums"]["custom_field_audience_access"]
          id?: string
          is_active?: boolean
          is_required?: boolean
          key: string
          label_en: string
          label_nl: string
          manager_access?: Database["public"]["Enums"]["custom_field_audience_access"]
          sort_order?: number
          tenant_id: string
          updated_at?: string
          validation_rules?: Json
        }
        Update: {
          administration_id?: string
          created_at?: string
          deleted_at?: string | null
          description_en?: string | null
          description_nl?: string | null
          employee_self_access?: Database["public"]["Enums"]["custom_field_audience_access"]
          entity_type?: Database["public"]["Enums"]["custom_field_entity_type"]
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          hr_access?: Database["public"]["Enums"]["custom_field_audience_access"]
          id?: string
          is_active?: boolean
          is_required?: boolean
          key?: string
          label_en?: string
          label_nl?: string
          manager_access?: Database["public"]["Enums"]["custom_field_audience_access"]
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          validation_rules?: Json
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_administration_scope_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
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
          administration_id: string
          created_at: string
          definition_id: string
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
          administration_id: string
          created_at?: string
          definition_id: string
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
          administration_id?: string
          created_at?: string
          definition_id?: string
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
            foreignKeyName: "custom_field_select_options_definition_scope_fkey"
            columns: ["tenant_id", "administration_id", "definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
      department_management: {
        Row: {
          administration_id: string
          created_at: string
          department_id: string
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          management_role_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          created_at?: string
          department_id: string
          effective_from?: string
          effective_to?: string | null
          employee_id: string
          id?: string
          management_role_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          created_at?: string
          department_id?: string
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          management_role_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_management_administration_same_tenant_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "department_management_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_management_department_scope_fkey"
            columns: ["tenant_id", "administration_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
          administration_id: string
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
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
          parent_id?: string | null
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
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_administration_same_tenant_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "departments_parent_same_administration_fkey"
            columns: ["tenant_id", "administration_id", "parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
      employee_addresses: {
        Row: {
          addition: string | null
          city: string
          country_code: string
          created_at: string
          deleted_at: string | null
          employee_id: string
          house_number: string
          id: string
          postal_code: string
          province: string | null
          street: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          addition?: string | null
          city: string
          country_code?: string
          created_at?: string
          deleted_at?: string | null
          employee_id: string
          house_number: string
          id?: string
          postal_code: string
          province?: string | null
          street: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          addition?: string | null
          city?: string
          country_code?: string
          created_at?: string
          deleted_at?: string | null
          employee_id?: string
          house_number?: string
          id?: string
          postal_code?: string
          province?: string | null
          street?: string
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
          administration_id: string
          created_at: string
          definition_id: string
          employee_id: string
          field_key: string
          id: string
          tenant_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          administration_id: string
          created_at?: string
          definition_id: string
          employee_id: string
          field_key: string
          id?: string
          tenant_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          administration_id?: string
          created_at?: string
          definition_id?: string
          employee_id?: string
          field_key?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "employee_custom_field_values_definition_scope_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "definition_id",
              "field_key",
            ]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["tenant_id", "administration_id", "id", "key"]
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
          id: string
          job_title: string | null
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
          id?: string
          job_title?: string | null
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
          id?: string
          job_title?: string | null
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
            foreignKeyName: "employee_organizations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_organizations_department_scope_fkey"
            columns: ["tenant_id", "administration_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
            foreignKeyName: "employee_organizations_manager_employee_id_fkey"
            columns: ["direct_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
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
          relation_type: Database["public"]["Enums"]["relation_type"]
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
          relation_type: Database["public"]["Enums"]["relation_type"]
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
          relation_type?: Database["public"]["Enums"]["relation_type"]
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
          id: string
          initials: string | null
          is_active: boolean
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
          id?: string
          initials?: string | null
          is_active?: boolean
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
          id?: string
          initials?: string | null
          is_active?: boolean
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
      employment_cost_allocations: {
        Row: {
          administration_id: string
          change_set_id: string | null
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
          administration_id: string
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
          administration_id: string
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
          administration_id?: string
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
            foreignKeyName: "employment_end_reasons_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
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
          employment_id: string
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
          employment_id: string
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
          employment_id?: string
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
          id: string
          payment_frequency: Database["public"]["Enums"]["salary_frequency"]
          payment_type: Database["public"]["Enums"]["salary_payment_type"]
          salary_basis: Database["public"]["Enums"]["salary_basis"]
          salary_scale_step_id: string | null
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
          id?: string
          payment_frequency: Database["public"]["Enums"]["salary_frequency"]
          payment_type: Database["public"]["Enums"]["salary_payment_type"]
          salary_basis: Database["public"]["Enums"]["salary_basis"]
          salary_scale_step_id?: string | null
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
          id?: string
          payment_frequency?: Database["public"]["Enums"]["salary_frequency"]
          payment_type?: Database["public"]["Enums"]["salary_payment_type"]
          salary_basis?: Database["public"]["Enums"]["salary_basis"]
          salary_scale_step_id?: string | null
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
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
            foreignKeyName: "employment_salaries_scale_step_fkey"
            columns: ["tenant_id", "administration_id", "salary_scale_step_id"]
            isOneToOne: false
            referencedRelation: "salary_scale_steps"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
          id: string
          monday_hours: number | null
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
          id?: string
          monday_hours?: number | null
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
          id?: string
          monday_hours?: number | null
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
            foreignKeyName: "employment_terminations_internal_reason_fkey"
            columns: ["tenant_id", "administration_id", "internal_reason_id"]
            isOneToOne: false
            referencedRelation: "employment_end_reasons"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
      employments: {
        Row: {
          administration_id: string
          contract_document_url: string | null
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          deleted_at: string | null
          employee_id: string
          employment_number: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          ends_on: string | null
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
          created_at?: string
          deleted_at?: string | null
          employee_id: string
          employment_number: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          ends_on?: string | null
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
          created_at?: string
          deleted_at?: string | null
          employee_id?: string
          employment_number?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          ends_on?: string | null
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
            foreignKeyName: "employments_administration_same_tenant_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "employments_employee_same_tenant_fkey"
            columns: ["tenant_id", "employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      management_roles: {
        Row: {
          code: string
          created_at: string
          deleted_at: string | null
          deputy_role_id: string | null
          description: string | null
          id: string
          is_active: boolean
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
      salary_scale_steps: {
        Row: {
          administration_id: string
          created_at: string
          currency_code: string
          fulltime_amount: number
          id: string
          salary_scale_id: string
          step_code: string
          step_name: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          administration_id: string
          created_at?: string
          currency_code?: string
          fulltime_amount: number
          id?: string
          salary_scale_id: string
          step_code: string
          step_name: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          administration_id?: string
          created_at?: string
          currency_code?: string
          fulltime_amount?: number
          id?: string
          salary_scale_id?: string
          step_code?: string
          step_name?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_scale_steps_scale_fkey"
            columns: ["tenant_id", "administration_id", "salary_scale_id"]
            isOneToOne: false
            referencedRelation: "salary_scales"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      salary_scales: {
        Row: {
          administration_id: string
          code: string
          created_at: string
          description: string | null
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
          description?: string | null
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
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_scales_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
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
          locale: Database["public"]["Enums"]["ui_locale"]
          theme: Database["public"]["Enums"]["ui_theme"]
          updated_at: string
        }
        Insert: {
          analog_clock_style?: Database["public"]["Enums"]["analog_clock_style"]
          auth_user_id: string
          clock_mode?: Database["public"]["Enums"]["clock_mode"]
          created_at?: string
          locale?: Database["public"]["Enums"]["ui_locale"]
          theme?: Database["public"]["Enums"]["ui_theme"]
          updated_at?: string
        }
        Update: {
          analog_clock_style?: Database["public"]["Enums"]["analog_clock_style"]
          auth_user_id?: string
          clock_mode?: Database["public"]["Enums"]["clock_mode"]
          created_at?: string
          locale?: Database["public"]["Enums"]["ui_locale"]
          theme?: Database["public"]["Enums"]["ui_theme"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
      confirm_employment_termination: {
        Args: { requested_termination_id: string }
        Returns: undefined
      }
      next_custom_field_value: {
        Args: { p_definition_id: string }
        Returns: number
      }
      reserve_employee_number: {
        Args: { p_tenant_id: string }
        Returns: string
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
    }
    Enums: {
      analog_clock_style: "CLASSIC" | "MINIMAL" | "LIQUID"
      access_scope_type: "TENANT" | "ADMINISTRATION"
      clock_mode: "ANALOG" | "DIGITAL" | "HIDDEN"
      administration_mode: "SEPARATE" | "COMBINED"
      contract_type:
        | "INDEFINITE"
        | "DEFINITE"
        | "ON_CALL"
        | "TEMPORARY_AGENCY"
        | "EXTERNAL"
      custom_field_audience_access: "HIDDEN" | "READ" | "WRITE"
      custom_field_entity_type: "EMPLOYEE"
      custom_field_type:
        | "TEXT"
        | "TEXTAREA"
        | "NUMBER"
        | "DATE"
        | "BOOLEAN"
        | "SELECT"
        | "MULTI_SELECT"
        | "AUTO_INCREMENT"
      education_level: "MBO" | "HBO" | "WO" | "HIGHSCHOOL" | "OTHER" | "UNKNOWN"
      employment_record_status: "DRAFT" | "CONFIRMED" | "CANCELLED"
      employment_type: "EMPLOYEE" | "INTERN" | "APPRENTICE" | "CONTRACTOR"
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
      marital_status:
        | "SINGLE"
        | "MARRIED"
        | "REGISTERED_PARTNERSHIP"
        | "DIVORCED"
        | "WIDOWED"
      name_usage:
        | "BIRTH_NAME"
        | "PARTNER_NAME"
        | "PARTNER_BEFORE_BIRTH_NAME"
        | "BIRTH_NAME_BEFORE_PARTNER_NAME"
      payroll_reporting_status: "DRAFT" | "READY" | "REPORTED" | "CLOSED"
      reminder_recipient_status: "PENDING" | "COMPLETED" | "DISMISSED"
      reminder_status: "DRAFT" | "PUBLISHED" | "CANCELLED"
      reminder_target_type: "SELF" | "EVERYONE" | "DEPARTMENTS" | "EMPLOYEES"
      reminder_type: "PERSONAL" | "HR"
      relation_type:
        | "PARTNER"
        | "CHILD"
        | "PARENT"
        | "SIBLING"
        | "DOCTOR"
        | "DENTIST"
        | "OTHER"
      salary_basis: "MANUAL" | "MINIMUM_WAGE" | "CUSTOM_SCALE" | "CAO_SCALE"
      salary_frequency: "MONTHLY" | "FOUR_WEEKLY"
      salary_payment_type: "PERIODIC_FIXED" | "HOURLY_VARIABLE"
      schedule_type:
        | "HOURS_PER_DAY"
        | "HOURS_AND_AVG_DAYS"
        | "HOURS_AND_SPECIFIC_DAYS"
        | "TIMES_PER_DAY"
      sharing_mode: "FULLY_ISOLATED" | "SHARED_COLLEAGUES"
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
      ui_locale: "nl" | "en"
      ui_theme:
        | "liquid-navy"
        | "noordzee"
        | "bos"
        | "warm-zand"
        | "aubergine"
        | "nacht"
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
      access_scope_type: ["TENANT", "ADMINISTRATION"],
      administration_mode: ["SEPARATE", "COMBINED"],
      contract_type: [
        "INDEFINITE",
        "DEFINITE",
        "ON_CALL",
        "TEMPORARY_AGENCY",
        "EXTERNAL",
      ],
      custom_field_audience_access: ["HIDDEN", "READ", "WRITE"],
      custom_field_entity_type: ["EMPLOYEE"],
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
      education_level: ["MBO", "HBO", "WO", "HIGHSCHOOL", "OTHER", "UNKNOWN"],
      employment_record_status: ["DRAFT", "CONFIRMED", "CANCELLED"],
      employment_type: ["EMPLOYEE", "INTERN", "APPRENTICE", "CONTRACTOR"],
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
      marital_status: [
        "SINGLE",
        "MARRIED",
        "REGISTERED_PARTNERSHIP",
        "DIVORCED",
        "WIDOWED",
      ],
      name_usage: [
        "BIRTH_NAME",
        "PARTNER_NAME",
        "PARTNER_BEFORE_BIRTH_NAME",
        "BIRTH_NAME_BEFORE_PARTNER_NAME",
      ],
      payroll_reporting_status: ["DRAFT", "READY", "REPORTED", "CLOSED"],
      relation_type: [
        "PARTNER",
        "CHILD",
        "PARENT",
        "SIBLING",
        "DOCTOR",
        "DENTIST",
        "OTHER",
      ],
      salary_basis: ["MANUAL", "MINIMUM_WAGE", "CUSTOM_SCALE", "CAO_SCALE"],
      salary_frequency: ["MONTHLY", "FOUR_WEEKLY"],
      salary_payment_type: ["PERIODIC_FIXED", "HOURLY_VARIABLE"],
      schedule_type: [
        "HOURS_PER_DAY",
        "HOURS_AND_AVG_DAYS",
        "HOURS_AND_SPECIFIC_DAYS",
        "TIMES_PER_DAY",
      ],
      sharing_mode: ["FULLY_ISOLATED", "SHARED_COLLEAGUES"],
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
      ui_locale: ["nl", "en"],
      ui_theme: [
        "liquid-navy",
        "noordzee",
        "bos",
        "warm-zand",
        "aubergine",
        "nacht",
      ],
    },
  },
} as const
