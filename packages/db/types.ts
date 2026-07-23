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
          show_in_organization_chart_filter: boolean
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
          show_in_organization_chart_filter?: boolean
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
          show_in_organization_chart_filter?: boolean
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
            foreignKeyName: "document_audiences_tenant_id_administration_id_target_depa_fkey"
            columns: ["tenant_id", "administration_id", "target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
      employee_documents: {
        Row: {
          added_by_user_id: string
          administration_id: string
          category_id: string
          checksum_sha256: string
          content_type: string
          created_at: string
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
          job_id: string | null
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
          job_id?: string | null
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
          job_id?: string | null
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
            foreignKeyName: "employee_organizations_job_fkey"
            columns: ["tenant_id", "administration_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
      employment_leave_profiles: {
        Row: {
          administration_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          employment_id: string
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
            foreignKeyName: "employment_leave_profiles_profile_fkey"
            columns: ["tenant_id", "administration_id", "leave_profile_id"]
            isOneToOne: false
            referencedRelation: "leave_profiles"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
            foreignKeyName: "employment_work_hour_entries_type_fkey"
            columns: ["tenant_id", "administration_id", "work_hour_type_id"]
            isOneToOne: false
            referencedRelation: "work_hour_types"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
      holiday_calendars: {
        Row: {
          administration_id: string
          calendar_year: number
          country_code: string
          created_at: string
          id: string
          imported_at: string | null
          imported_by: string | null
          provider: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          calendar_year: number
          country_code: string
          created_at?: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          provider?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          calendar_year?: number
          country_code?: string
          created_at?: string
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          provider?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holiday_calendars_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      holidays: {
        Row: {
          administration_id: string
          created_at: string
          created_by: string | null
          display_name: string | null
          external_key: string | null
          holiday_calendar_id: string
          holiday_date: string
          holiday_types: string[]
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
          administration_id: string
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          external_key?: string | null
          holiday_calendar_id: string
          holiday_date: string
          holiday_types?: string[]
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
          administration_id?: string
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          external_key?: string | null
          holiday_calendar_id?: string
          holiday_date?: string
          holiday_types?: string[]
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
            foreignKeyName: "holidays_calendar_fkey"
            columns: ["tenant_id", "administration_id", "holiday_calendar_id"]
            isOneToOne: false
            referencedRelation: "holiday_calendars"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
      job_groups: {
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
            foreignKeyName: "job_groups_tenant_id_administration_id_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      job_revisions: {
        Row: {
          administration_id: string
          created_at: string
          description: string | null
          id: string
          job_id: string
          name: string
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          administration_id: string
          created_at?: string
          description?: string | null
          id?: string
          job_id: string
          name: string
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          administration_id?: string
          created_at?: string
          description?: string | null
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
            foreignKeyName: "job_revisions_tenant_id_administration_id_job_id_fkey"
            columns: ["tenant_id", "administration_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      jobs: {
        Row: {
          administration_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          job_group_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          job_group_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          job_group_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_tenant_id_administration_id_job_group_id_fkey"
            columns: ["tenant_id", "administration_id", "job_group_id"]
            isOneToOne: false
            referencedRelation: "job_groups"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
            foreignKeyName: "leave_accrual_exceptions_type_fkey"
            columns: ["tenant_id", "administration_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      leave_accrual_rule_pause_types: {
        Row: {
          accrual_rule_id: string
          administration_id: string
          created_at: string
          pause_leave_type_id: string
          tenant_id: string
        }
        Insert: {
          accrual_rule_id: string
          administration_id: string
          created_at?: string
          pause_leave_type_id: string
          tenant_id: string
        }
        Update: {
          accrual_rule_id?: string
          administration_id?: string
          created_at?: string
          pause_leave_type_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_accrual_rule_pause_types_rule_fkey"
            columns: ["tenant_id", "administration_id", "accrual_rule_id"]
            isOneToOne: false
            referencedRelation: "leave_accrual_rules"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "leave_accrual_rule_pause_types_type_fkey"
            columns: ["tenant_id", "administration_id", "pause_leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      leave_accrual_rule_work_hour_types: {
        Row: {
          accrual_rule_id: string
          administration_id: string
          created_at: string
          tenant_id: string
          work_hour_type_id: string
        }
        Insert: {
          accrual_rule_id: string
          administration_id: string
          created_at?: string
          tenant_id: string
          work_hour_type_id: string
        }
        Update: {
          accrual_rule_id?: string
          administration_id?: string
          created_at?: string
          tenant_id?: string
          work_hour_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_accrual_rule_work_hour_types_rule_fkey"
            columns: ["tenant_id", "administration_id", "accrual_rule_id"]
            isOneToOne: false
            referencedRelation: "leave_accrual_rules"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "leave_accrual_rule_work_hour_types_type_fkey"
            columns: ["tenant_id", "administration_id", "work_hour_type_id"]
            isOneToOne: false
            referencedRelation: "work_hour_types"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
          administration_id: string
          created_at: string
          created_by: string | null
          expiration_months: number
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
          administration_id: string
          created_at?: string
          created_by?: string | null
          expiration_months: number
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
          administration_id?: string
          created_at?: string
          created_by?: string | null
          expiration_months?: number
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
            foreignKeyName: "leave_accrual_rules_predecessor_rule_id_fkey"
            columns: ["predecessor_rule_id"]
            isOneToOne: false
            referencedRelation: "leave_accrual_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_accrual_rules_profile_fkey"
            columns: ["tenant_id", "administration_id", "leave_profile_id"]
            isOneToOne: false
            referencedRelation: "leave_profiles"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "leave_accrual_rules_type_fkey"
            columns: ["tenant_id", "administration_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
            foreignKeyName: "leave_balance_buckets_type_fkey"
            columns: ["tenant_id", "administration_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      leave_bonus_rules: {
        Row: {
          administration_id: string
          award_timing: Database["public"]["Enums"]["leave_bonus_award_timing"]
          created_at: string
          created_by: string | null
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
          administration_id: string
          award_timing: Database["public"]["Enums"]["leave_bonus_award_timing"]
          created_at?: string
          created_by?: string | null
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
          administration_id?: string
          award_timing?: Database["public"]["Enums"]["leave_bonus_award_timing"]
          created_at?: string
          created_by?: string | null
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
            foreignKeyName: "leave_bonus_rules_profile_fkey"
            columns: ["tenant_id", "administration_id", "leave_profile_id"]
            isOneToOne: false
            referencedRelation: "leave_profiles"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "leave_bonus_rules_type_fkey"
            columns: ["tenant_id", "administration_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      leave_bonus_tiers: {
        Row: {
          administration_id: string
          bonus_amount: number
          bonus_rule_id: string
          created_at: string
          id: string
          tenant_id: string
          threshold_years: number
          updated_at: string
        }
        Insert: {
          administration_id: string
          bonus_amount: number
          bonus_rule_id: string
          created_at?: string
          id?: string
          tenant_id: string
          threshold_years: number
          updated_at?: string
        }
        Update: {
          administration_id?: string
          bonus_amount?: number
          bonus_rule_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
          threshold_years?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_bonus_tiers_rule_fkey"
            columns: ["tenant_id", "administration_id", "bonus_rule_id"]
            isOneToOne: false
            referencedRelation: "leave_bonus_rules"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      leave_priority_rule_items: {
        Row: {
          administration_id: string
          created_at: string
          leave_type_id: string
          priority_rule_id: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          administration_id: string
          created_at?: string
          leave_type_id: string
          priority_rule_id: string
          sort_order: number
          tenant_id: string
        }
        Update: {
          administration_id?: string
          created_at?: string
          leave_type_id?: string
          priority_rule_id?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_priority_rule_items_rule_fkey"
            columns: ["tenant_id", "administration_id", "priority_rule_id"]
            isOneToOne: false
            referencedRelation: "leave_priority_rules"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "leave_priority_rule_items_type_fkey"
            columns: ["tenant_id", "administration_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      leave_priority_rules: {
        Row: {
          administration_id: string
          created_at: string
          created_by: string | null
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
          administration_id: string
          created_at?: string
          created_by?: string | null
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
          administration_id?: string
          created_at?: string
          created_by?: string | null
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
            foreignKeyName: "leave_priority_rules_profile_fkey"
            columns: ["tenant_id", "administration_id", "leave_profile_id"]
            isOneToOne: false
            referencedRelation: "leave_profiles"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      leave_profiles: {
        Row: {
          administration_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          administration_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          administration_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_profiles_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
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
      leave_types: {
        Row: {
          administration_id: string
          annual_hours_cap: number | null
          color_code: string
          created_at: string
          created_by: string | null
          entitlement_mode: Database["public"]["Enums"]["leave_type_entitlement_mode"]
          id: string
          is_active: boolean
          is_self_service: boolean
          is_system: boolean
          name: string
          scope: Database["public"]["Enums"]["leave_type_scope"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
          weekly_hours_cap_factor: number | null
        }
        Insert: {
          administration_id: string
          annual_hours_cap?: number | null
          color_code?: string
          created_at?: string
          created_by?: string | null
          entitlement_mode?: Database["public"]["Enums"]["leave_type_entitlement_mode"]
          id?: string
          is_active?: boolean
          is_self_service?: boolean
          is_system?: boolean
          name: string
          scope: Database["public"]["Enums"]["leave_type_scope"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          weekly_hours_cap_factor?: number | null
        }
        Update: {
          administration_id?: string
          annual_hours_cap?: number | null
          color_code?: string
          created_at?: string
          created_by?: string | null
          entitlement_mode?: Database["public"]["Enums"]["leave_type_entitlement_mode"]
          id?: string
          is_active?: boolean
          is_self_service?: boolean
          is_system?: boolean
          name?: string
          scope?: Database["public"]["Enums"]["leave_type_scope"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          weekly_hours_cap_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_types_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
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
          administration_id: string
          created_at: string
          id: string
          locked_at: string | null
          locked_by: string | null
          status: Database["public"]["Enums"]["leave_year_control_status"]
          tenant_id: string
          updated_at: string
          year: number
        }
        Insert: {
          administration_id: string
          created_at?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          status?: Database["public"]["Enums"]["leave_year_control_status"]
          tenant_id: string
          updated_at?: string
          year: number
        }
        Update: {
          administration_id?: string
          created_at?: string
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
            foreignKeyName: "leave_year_controls_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
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
          administration_id: string
          carried_hours: number
          created_at: string
          employment_id: string
          id: string
          leave_type_id: string
          original_expiration_date: string
          rollover_id: string
          source_bucket_id: string
          tenant_id: string
        }
        Insert: {
          administration_id: string
          carried_hours: number
          created_at?: string
          employment_id: string
          id?: string
          leave_type_id: string
          original_expiration_date: string
          rollover_id: string
          source_bucket_id: string
          tenant_id: string
        }
        Update: {
          administration_id?: string
          carried_hours?: number
          created_at?: string
          employment_id?: string
          id?: string
          leave_type_id?: string
          original_expiration_date?: string
          rollover_id?: string
          source_bucket_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_year_rollover_items_bucket_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "employment_id",
              "leave_type_id",
              "source_bucket_id",
            ]
            isOneToOne: false
            referencedRelation: "leave_balance_buckets"
            referencedColumns: [
              "tenant_id",
              "administration_id",
              "employment_id",
              "leave_type_id",
              "id",
            ]
          },
          {
            foreignKeyName: "leave_year_rollover_items_employment_fkey"
            columns: ["tenant_id", "administration_id", "employment_id"]
            isOneToOne: false
            referencedRelation: "employments"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "leave_year_rollover_items_rollover_fkey"
            columns: ["tenant_id", "administration_id", "rollover_id"]
            isOneToOne: false
            referencedRelation: "leave_year_rollovers"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "leave_year_rollover_items_type_fkey"
            columns: ["tenant_id", "administration_id", "leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      leave_year_rollovers: {
        Row: {
          administration_id: string
          completed_at: string
          completed_by: string | null
          created_at: string
          from_year: number
          id: string
          tenant_id: string
          to_year: number
        }
        Insert: {
          administration_id: string
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          from_year: number
          id?: string
          tenant_id: string
          to_year: number
        }
        Update: {
          administration_id?: string
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          from_year?: number
          id?: string
          tenant_id?: string
          to_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_year_rollovers_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
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
            foreignKeyName: "reminder_target_rules_tenant_id_administration_id_target_d_fkey"
            columns: ["tenant_id", "administration_id", "target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "reminder_target_rules_tenant_id_reminder_id_fkey"
            columns: ["tenant_id", "reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
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
            foreignKeyName: "reminder_targets_department_same_scope_fkey"
            columns: ["tenant_id", "administration_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
      salary_scale_revisions: {
        Row: {
          administration_id: string
          created_at: string
          description: string | null
          id: string
          published_at: string | null
          published_by_user_id: string | null
          revision_number: number
          salary_scale_id: string
          status: Database["public"]["Enums"]["salary_revision_status"]
          tenant_id: string
          updated_at: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          administration_id: string
          created_at?: string
          description?: string | null
          id?: string
          published_at?: string | null
          published_by_user_id?: string | null
          revision_number: number
          salary_scale_id: string
          status?: Database["public"]["Enums"]["salary_revision_status"]
          tenant_id: string
          updated_at?: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          administration_id?: string
          created_at?: string
          description?: string | null
          id?: string
          published_at?: string | null
          published_by_user_id?: string | null
          revision_number?: number
          salary_scale_id?: string
          status?: Database["public"]["Enums"]["salary_revision_status"]
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_scale_revisions_tenant_id_administration_id_salary__fkey"
            columns: ["tenant_id", "administration_id", "salary_scale_id"]
            isOneToOne: false
            referencedRelation: "salary_scales"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
        ]
      }
      salary_scale_steps: {
        Row: {
          administration_id: string
          created_at: string
          currency_code: string
          fulltime_amount: number
          hourly_amount: number | null
          id: string
          salary_scale_id: string
          salary_scale_revision_id: string
          sequence_number: number
          step_code: string
          step_kind: Database["public"]["Enums"]["salary_step_kind"]
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
          hourly_amount?: number | null
          id?: string
          salary_scale_id: string
          salary_scale_revision_id: string
          sequence_number: number
          step_code: string
          step_kind?: Database["public"]["Enums"]["salary_step_kind"]
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
          hourly_amount?: number | null
          id?: string
          salary_scale_id?: string
          salary_scale_revision_id?: string
          sequence_number?: number
          step_code?: string
          step_kind?: Database["public"]["Enums"]["salary_step_kind"]
          step_name?: string
          tenant_id?: string
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_scale_steps_revision_fkey"
            columns: [
              "tenant_id",
              "administration_id",
              "salary_scale_revision_id",
            ]
            isOneToOne: false
            referencedRelation: "salary_scale_revisions"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
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
            foreignKeyName: "star_performer_assessments_tenant_id_administration_id_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "star_performer_assessments_tenant_id_administration_id_jo_fkey1"
            columns: ["tenant_id", "administration_id", "job_group_id"]
            isOneToOne: false
            referencedRelation: "job_groups"
            referencedColumns: ["tenant_id", "administration_id", "id"]
          },
          {
            foreignKeyName: "star_performer_assessments_tenant_id_administration_id_job_fkey"
            columns: ["tenant_id", "administration_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["tenant_id", "administration_id", "id"]
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
          date_format: Database["public"]["Enums"]["date_format"]
          locale: Database["public"]["Enums"]["ui_locale"]
          theme: Database["public"]["Enums"]["ui_theme"]
          time_format: Database["public"]["Enums"]["time_format"]
          ui_state: Json
          updated_at: string
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
          week_numbering_system?: Database["public"]["Enums"]["week_numbering_system"]
        }
        Relationships: []
      }
      work_hour_types: {
        Row: {
          administration_id: string
          category: Database["public"]["Enums"]["work_hour_type_category"]
          color_code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          administration_id: string
          category: Database["public"]["Enums"]["work_hour_type_category"]
          color_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          administration_id?: string
          category?: Database["public"]["Enums"]["work_hour_type_category"]
          color_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_hour_types_administration_fkey"
            columns: ["tenant_id", "administration_id"]
            isOneToOne: false
            referencedRelation: "administrations"
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
      },
      leave_request_allocations: {
        Row: {
          administration_id: string
          allocated_hours: number
          bucket_id: string | null
          created_at: string
          employee_id: string
          employment_id: string
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
          id?: string
          leave_type_id?: string
          request_id?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          actor_user_id: string
          administration_id: string
          created_at: string
          employee_id: string
          employment_id: string
          end_date: string
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
          time_mode: Database["public"]["Enums"]["leave_request_time_mode"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actor_user_id: string
          administration_id: string
          created_at?: string
          employee_id: string
          employment_id: string
          end_date: string
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
          time_mode: Database["public"]["Enums"]["leave_request_time_mode"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actor_user_id?: string
          administration_id?: string
          created_at?: string
          employee_id?: string
          employment_id?: string
          end_date?: string
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
          time_mode?: Database["public"]["Enums"]["leave_request_time_mode"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_settings: {
        Row: {
          administration_id: string
          created_at: string
          half_day_minutes: number
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          administration_id: string
          created_at?: string
          half_day_minutes?: number
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          administration_id?: string
          created_at?: string
          half_day_minutes?: number
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      },
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
    }
    Functions: {
      list_employee_overviews: {
        Args: {
          requested_administration_id: string
          requested_archive_filter?: string
          requested_as_of?: string
          requested_tenant_id: string
        }
        Returns: {
          avatar_url: string | null
          birth_name: string
          birth_name_prefix: string | null
          department_name: string | null
          employee_number: string
          employment_history: Json
          first_name: string
          id: string
          is_archived: boolean
          job_title: string | null
          work_email: string | null
        }[]
      }
      create_leave_accrual_rule: {
        Args: {
          requested_accrual_amount: number | null
          requested_accrual_basis: Database["public"]["Enums"]["leave_accrual_basis"]
          requested_accrual_frequency: Database["public"]["Enums"]["leave_accrual_frequency"]
          requested_accrual_rate: number | null
          requested_accrual_timing: Database["public"]["Enums"]["leave_accrual_timing"]
          requested_administration_id: string
          requested_expiration_months: number
          requested_leave_profile_id: string
          requested_leave_type_id: string
          requested_pause_leave_type_ids: string[]
          requested_predecessor_rule_id: string | null
          requested_tenant_id: string
          requested_valid_from: string
          requested_valid_until: string | null
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
      confirm_leave_request: {
        Args: {
          requested_administration_id: string
          requested_employee_id: string
          requested_employment_id: string
          requested_end_date: string
          requested_idempotency_key: string
          requested_leave_type_id: string | null
          requested_mode: Database["public"]["Enums"]["leave_request_mode"]
          requested_priority_rule_id: string | null
          requested_start_date: string
          requested_tenant_id: string
          requested_time_mode: Database["public"]["Enums"]["leave_request_time_mode"]
          requested_specific_end: string | null
          requested_specific_start: string | null
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
      apply_leave_manual_adjustment: {
        Args: {
          requested_administration_id: string
          requested_accrual_year: number
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
      close_leave_year: {
        Args: {
          requested_administration_id: string
          requested_tenant_id: string
          requested_year: number
        }
        Returns: string
      }
      expire_leave_buckets: {
        Args: {
          requested_as_of_date: string
        }
        Returns: number
      }
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
      create_employee_document_metadata: {
        Args: {
          requested_administration_id: string
          requested_employee_id: string
          requested_payload: Json
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
        Args: { requested_administration_id: string; requested_payload: Json }
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
      import_holiday_snapshot: {
        Args: {
          requested_administration_id: string
          requested_calendar_year: number
          requested_country_code: string
          requested_holidays: Json
        }
        Returns: string
      }
      next_custom_field_value: {
        Args: { p_definition_id: string }
        Returns: number
      }
      publish_complete_employment: {
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
      publish_reminder: {
        Args: { requested_reminder_id: string }
        Returns: number
      }
      publish_salary_scale_revision: {
        Args: { requested_administration_id: string; requested_payload: Json }
        Returns: string
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
      update_personal_reminder: {
        Args: {
          requested_description: string
          requested_remind_at: string
          requested_reminder_id: string
          requested_title: string
        }
        Returns: undefined
      }
      update_reminder_recipient: {
        Args: {
          requested_action: string
          requested_recipient_id: string
          requested_remind_at?: string
        }
        Returns: undefined
      }
      upsert_star_performer_assessment: {
        Args: { requested_administration_id: string; requested_payload: Json }
        Returns: string
      }
    }
    Enums: {
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
      date_format: "DMY" | "MDY" | "YMD"
      document_target_type: "EMPLOYEE" | "MANAGEMENT_ROLE" | "DEPARTMENT_BRANCH"
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
      leave_accrual_basis: "CONTRACT_HOURS" | "WORKED_HOURS"
      leave_accrual_frequency: "PAYROLL_PERIOD" | "YEARLY"
      leave_accrual_timing: "UPFRONT" | "ARREARS"
      leave_bonus_award_timing: "START_OF_YEAR" | "ON_TRIGGER_DATE"
      leave_bonus_trigger_type: "AGE" | "SENIORITY"
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
      leave_type_scope: "STATUTORY" | "NON_STATUTORY" | "ADV" | "OTHER"
      leave_request_mode: "PRIORITY" | "DIRECT"
      leave_request_status: "APPROVED" | "REJECTED" | "CANCELLED"
      leave_request_time_mode: "FULL_DAY" | "MORNING" | "AFTERNOON" | "SPECIFIC_HOURS"
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
      name_usage:
        | "BIRTH_NAME"
        | "PARTNER_NAME"
        | "PARTNER_BEFORE_BIRTH_NAME"
        | "BIRTH_NAME_BEFORE_PARTNER_NAME"
      payroll_reporting_status: "DRAFT" | "READY" | "REPORTED" | "CLOSED"
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
      salary_basis: "MANUAL" | "MINIMUM_WAGE" | "CUSTOM_SCALE" | "CAO_SCALE"
      salary_frequency: "MONTHLY" | "FOUR_WEEKLY"
      salary_payment_type: "PERIODIC_FIXED" | "HOURLY_VARIABLE"
      salary_revision_status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
      salary_step_kind: "REGULAR" | "START" | "MAXIMUM" | "SPECIAL"
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
      time_format: "24H" | "12H"
      ui_locale: "nl" | "en"
      ui_theme:
        | "liquid-navy"
        | "noordzee"
        | "bos"
        | "warm-zand"
        | "aubergine"
        | "nacht"
      week_numbering_system: "JANUARY_FIRST" | "ISO"
      work_hour_type_category: "REGULAR_WORK" | "OVERTIME" | "INFORMATIONAL"
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
      date_format: ["DMY", "MDY", "YMD"],
      document_target_type: [
        "EMPLOYEE",
        "MANAGEMENT_ROLE",
        "DEPARTMENT_BRANCH",
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
      leave_accrual_basis: ["CONTRACT_HOURS", "WORKED_HOURS"],
      leave_accrual_frequency: ["PAYROLL_PERIOD", "YEARLY"],
      leave_accrual_timing: ["UPFRONT", "ARREARS"],
      leave_bonus_award_timing: ["START_OF_YEAR", "ON_TRIGGER_DATE"],
      leave_bonus_trigger_type: ["AGE", "SENIORITY"],
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
      ],
      leave_type_scope: ["STATUTORY", "NON_STATUTORY", "ADV", "OTHER"],
      leave_request_mode: ["PRIORITY", "DIRECT"],
      leave_request_status: ["APPROVED", "REJECTED", "CANCELLED"],
      leave_request_time_mode: ["FULL_DAY", "MORNING", "AFTERNOON", "SPECIFIC_HOURS"],
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
      reminder_recipient_status: ["PENDING", "COMPLETED", "DISMISSED"],
      reminder_status: ["DRAFT", "PUBLISHED", "CANCELLED"],
      reminder_target_type: ["SELF", "EVERYONE", "DEPARTMENTS", "EMPLOYEES"],
      reminder_type: ["PERSONAL", "HR"],
      salary_basis: ["MANUAL", "MINIMUM_WAGE", "CUSTOM_SCALE", "CAO_SCALE"],
      salary_frequency: ["MONTHLY", "FOUR_WEEKLY"],
      salary_payment_type: ["PERIODIC_FIXED", "HOURLY_VARIABLE"],
      salary_revision_status: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      salary_step_kind: ["REGULAR", "START", "MAXIMUM", "SPECIAL"],
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
      time_format: ["24H", "12H"],
      ui_locale: ["nl", "en"],
      ui_theme: [
        "liquid-navy",
        "noordzee",
        "bos",
        "warm-zand",
        "aubergine",
        "nacht",
      ],
      week_numbering_system: ["JANUARY_FIRST", "ISO"],
      work_hour_type_category: ["REGULAR_WORK", "OVERTIME", "INFORMATIONAL"],
    },
  },
} as const
