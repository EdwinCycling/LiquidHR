import 'server-only'

import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { absenceSettingsSchema, type AbsenceSettingsInput } from './settings-schemas'

export interface AbsenceCaseManagerOption {
  id: string
  employeeNumber: string
  name: string
}

export interface AbsenceSettingsPageData {
  frequentAbsenceThreshold: number
  defaultCaseManagerEmployeeId: string | null
  caseManagers: AbsenceCaseManagerOption[]
}

async function listCaseManagers(context: Awaited<ReturnType<typeof requirePermission>>): Promise<AbsenceCaseManagerOption[]> {
  const supabase = await createClient()
  let employeeIds: string[] | null = null

  if (context.administrationId) {
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('employee_administration_assignments')
      .select('employee_id')
      .eq('tenant_id', context.tenantId)
      .eq('administration_id', context.administrationId)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .limit(5000)
    if (error) throw new Error('ABSENCE_SETTINGS_MANAGERS_READ_FAILED')
    employeeIds = [...new Set(data.map((row) => row.employee_id))]
    if (employeeIds.length === 0) return []
  }

  let query = supabase
    .from('employees')
    .select('id,employee_number,first_name,birth_name')
    .eq('tenant_id', context.tenantId)
    .eq('is_active', true)
    .eq('is_archived', false)
    .is('deleted_at', null)
    .not('auth_user_id', 'is', null)
    .order('birth_name')
    .order('first_name')
    .limit(500)
  if (employeeIds) query = query.in('id', employeeIds)

  const { data, error } = await query
  if (error) throw new Error('ABSENCE_SETTINGS_MANAGERS_READ_FAILED')
  return data.map((employee) => ({
    id: employee.id,
    employeeNumber: employee.employee_number,
    name: `${employee.first_name} ${employee.birth_name}`.trim(),
  }))
}

export async function getAbsenceSettingsPageData(): Promise<AbsenceSettingsPageData> {
  const context = await requirePermission('absence-settings:read')
  const supabase = await createClient()
  const [settings, caseManagers] = await Promise.all([
    context.administrationId
      ? supabase
        .from('absence_settings')
        .select('frequent_absence_threshold,default_case_manager_employee_id')
        .eq('tenant_id', context.tenantId)
        .eq('administration_id', context.administrationId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    listCaseManagers(context),
  ])
  if (settings.error) throw new Error('ABSENCE_SETTINGS_READ_FAILED')
  return {
    frequentAbsenceThreshold: settings.data?.frequent_absence_threshold ?? 3,
    defaultCaseManagerEmployeeId: settings.data?.default_case_manager_employee_id ?? null,
    caseManagers,
  }
}

export async function updateAbsenceSettings(rawInput: unknown): Promise<void> {
  const context = await requirePermission('absence-settings:write')
  if (!context.administrationId) throw new Error('ABSENCE_SETTINGS_ADMINISTRATION_REQUIRED')
  const input: AbsenceSettingsInput = absenceSettingsSchema.parse(rawInput)
  const caseManagers = await listCaseManagers(context)
  if (input.defaultCaseManagerEmployeeId && !caseManagers.some((manager) => manager.id === input.defaultCaseManagerEmployeeId)) {
    throw new Error('ABSENCE_SETTINGS_CASE_MANAGER_INVALID')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('absence_settings').upsert({
    tenant_id: context.tenantId,
    administration_id: context.administrationId,
    frequent_absence_threshold: input.frequentAbsenceThreshold,
    default_case_manager_employee_id: input.defaultCaseManagerEmployeeId ?? null,
  }, { onConflict: 'tenant_id,administration_id' })
  if (error) throw new Error('ABSENCE_SETTINGS_WRITE_FAILED')
}
