import 'server-only'

import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { requireAuthContext } from '@/lib/auth/permissions'
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
  employeeSelfReportEnabled: boolean
  caseManagers: AbsenceCaseManagerOption[]
}

async function listCaseManagers(context: Awaited<ReturnType<typeof requirePermission>>): Promise<AbsenceCaseManagerOption[]> {
  const supabase = await createClient()
  const hrGroupId = requireHrGroupId(context)

  const query = supabase
    .from('employees')
    .select('id,employee_number,first_name,birth_name')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', hrGroupId)
    .eq('is_active', true)
    .eq('is_archived', false)
    .is('deleted_at', null)
    .not('auth_user_id', 'is', null)
    .order('birth_name')
    .order('first_name')
    .limit(500)

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
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const [settings, caseManagers] = await Promise.all([
    supabase
      .from('absence_settings')
      .select('*')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', hrGroupId)
      .maybeSingle(),
    listCaseManagers(context),
  ])
  if (settings.error) throw new Error('ABSENCE_SETTINGS_READ_FAILED')
  const settingsRow = settings.data
  return {
    frequentAbsenceThreshold: settingsRow?.frequent_absence_threshold ?? 3,
    defaultCaseManagerEmployeeId: settingsRow?.default_case_manager_employee_id ?? null,
    employeeSelfReportEnabled: settingsRow?.employee_self_report_enabled ?? false,
    caseManagers,
  }
}

export async function updateAbsenceSettings(rawInput: unknown): Promise<void> {
  const context = await requirePermission('absence-settings:write')
  const hrGroupId = requireHrGroupId(context)
  const input: AbsenceSettingsInput = absenceSettingsSchema.parse(rawInput)
  const caseManagers = await listCaseManagers(context)
  if (input.defaultCaseManagerEmployeeId && !caseManagers.some((manager) => manager.id === input.defaultCaseManagerEmployeeId)) {
    throw new Error('ABSENCE_SETTINGS_CASE_MANAGER_INVALID')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('absence_settings').upsert({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    administration_id: null,
    frequent_absence_threshold: input.frequentAbsenceThreshold,
    default_case_manager_employee_id: input.defaultCaseManagerEmployeeId ?? null,
    employee_self_report_enabled: input.employeeSelfReportEnabled,
  }, { onConflict: 'tenant_id,hr_group_id' })
  if (error) throw new Error('ABSENCE_SETTINGS_WRITE_FAILED')
}

export async function canEmployeeSelfReportAbsence(employeeId: string): Promise<boolean> {
  const context = await requireAuthContext()
  if (context.employeeId !== employeeId || !context.hrGroupId) return false
  const supabase = await createClient()
  const { data } = await supabase.from('absence_settings').select('employee_self_report_enabled').eq('tenant_id', context.tenantId).eq('hr_group_id', context.hrGroupId).maybeSingle()
  return data?.employee_self_report_enabled ?? false
}
