export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type ControlDatabase = {
  public: {
    Tables: Record<never, never>
    Views: Record<never, never>
    Functions: {
      get_platform_control_snapshot: {
        Args: { requested_tenant_id?: string | null }
        Returns: Json
      }
      get_platform_hr_groups: {
        Args: { requested_tenant_id: string }
        Returns: Json
      }
      create_platform_hr_group: {
        Args: {
          requested_tenant_id: string
          requested_code: string
          requested_name: string
          requested_description?: string | null
        }
        Returns: string
      }
      onboard_platform_tenant: {
        Args: {
          requested_name: string
          requested_slug: string
          requested_administration_mode: 'SEPARATE' | 'COMBINED'
          requested_primary_contact_email: string
          requested_administrations: Json
        }
        Returns: string
      }
      change_tenant_lifecycle: {
        Args: {
          requested_tenant_id: string
          requested_status: 'PROVISIONING' | 'ACTIVE' | 'PAUSED' | 'TERMINATING' | 'TERMINATED'
          requested_reason: string
        }
        Returns: Json
      }
      capture_tenant_usage_snapshot: {
        Args: { requested_tenant_id: string }
        Returns: string
      }
      start_platform_support_session: {
        Args: {
          requested_tenant_id: string
          requested_reason: string
          requested_duration_minutes: number
        }
        Returns: string
      }
    }
    Enums: {
      administration_mode: 'SEPARATE' | 'COMBINED'
      platform_operator_role: 'OWNER' | 'OPERATOR' | 'AUDITOR'
      tenant_lifecycle_status: 'PROVISIONING' | 'ACTIVE' | 'PAUSED' | 'TERMINATING' | 'TERMINATED'
    }
    CompositeTypes: Record<never, never>
  }
}
