export type PayrollJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: PayrollJson | undefined }
  | PayrollJson[]

export type PayrollAdministrationStatus = 'ACTIVE' | 'SUSPENDED'

export type PayrollAdministrationRow = {
  id: string
  source_tenant_id: string
  source_hr_group_id: string
  source_administration_id: string
  display_name: string
  capability_enabled: boolean
  status: PayrollAdministrationStatus
  created_at: string
  created_by_user_id: string | null
  updated_at: string
  updated_by_user_id: string | null
}

type PayrollTable<Row, Insert> = {
  Row: Row
  Insert: Insert
  Update: Partial<Insert>
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
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
