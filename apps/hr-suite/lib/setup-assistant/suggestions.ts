import 'server-only'

import type { AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { SetupAssistantStep, SetupAssistantSuggestionKey } from './guide'
import type { SetupAssistantSuggestion } from './types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function hasPermission(auth: AuthContext, permission: string): boolean {
  return auth.permissions.includes(permission)
}

function hasAnyPermission(auth: AuthContext, permissions: readonly string[]): boolean {
  return permissions.some((permission) => hasPermission(auth, permission))
}

function addSuggestion(
  tasks: Array<Promise<SetupAssistantSuggestion | null>>,
  requested: ReadonlySet<SetupAssistantSuggestionKey>,
  key: SetupAssistantSuggestionKey,
  stepKey: string,
  loader: () => Promise<number | null>,
): void {
  if (!requested.has(key)) return
  tasks.push(loader().then((count) => count && count > 0 ? { stepKey, suggestionKey: key, count } : null).catch(() => null))
}

export async function getSetupAssistantSuggestions({
  auth,
  supabase,
  visibleSteps,
}: {
  auth: AuthContext
  supabase: SupabaseServerClient
  visibleSteps: readonly SetupAssistantStep[]
}): Promise<SetupAssistantSuggestion[]> {
  const requested = new Set(visibleSteps.flatMap((step) => step.suggestionKey ? [step.suggestionKey] : []))
  const tasks: Array<Promise<SetupAssistantSuggestion | null>> = []
  const hrGroupId = auth.hrGroupId
  if (!hrGroupId) return []

  if (hasPermission(auth, 'department:read')) {
    addSuggestion(tasks, requested, 'departments', 'ORG-001', async () => {
      const { count, error } = await supabase.from('departments').select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).limit(1)
      return error ? null : count ?? 0
    })
  }

  if (hasPermission(auth, 'job-catalog:read')) {
    addSuggestion(tasks, requested, 'jobs', 'ORG-002', async () => {
      const { count, error } = await supabase.from('jobs').select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).limit(1)
      return error ? null : count ?? 0
    })
  }

  if (hasPermission(auth, 'hr-group:read')) {
    addSuggestion(tasks, requested, 'hrStructure', 'BAS-001', async () => {
      const { count, error } = await supabase.from('administrations').select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).limit(1)
      return error ? null : count ?? 0
    })
  }

  if (hasPermission(auth, 'company-data:read')) {
    addSuggestion(tasks, requested, 'companyData', 'BAS-002', async () => {
      const { data, error } = await supabase.from('administration_company_data')
        .select('address_line_1,street,house_number,postal_code,city')
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).maybeSingle()
      if (error || !data) return null
      return [data.address_line_1, data.street, data.house_number, data.postal_code, data.city]
        .some((value) => Boolean(value?.trim())) ? 1 : 0
    })
  }

  if (hasPermission(auth, 'settings:read')) {
    addSuggestion(tasks, requested, 'branding', 'BAS-003', async () => {
      const { data, error } = await supabase.from('administration_branding')
        .select('logo_storage_path,updated_by')
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).maybeSingle()
      if (error || !data) return null
      return data.updated_by || data.logo_storage_path?.trim() ? 1 : 0
    })
  }

  if (hasPermission(auth, 'custom-fields:write')) {
    addSuggestion(tasks, requested, 'customFields', 'SET-003', async () => {
      const { count, error } = await supabase.from('custom_field_definitions').select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).is('deleted_at', null).limit(1)
      return error ? null : count ?? 0
    })
  }

  if (hasAnyPermission(auth, ['employee:read', 'employee-directory:read'])) {
    addSuggestion(tasks, requested, 'employees', 'SET-005', async () => {
      const { count, error } = await supabase.from('employees').select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).eq('is_archived', false).is('deleted_at', null).limit(1)
      return error ? null : count ?? 0
    })
  }

  if (hasPermission(auth, 'holidays:read')) {
    addSuggestion(tasks, requested, 'holidays', 'EMP-004', async () => {
      const { count, error } = await supabase.from('holiday_calendars').select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('calendar_year', new Date().getUTCFullYear()).limit(1)
      return error ? null : count ?? 0
    })
  }

  if (hasPermission(auth, 'leave:read')) {
    addSuggestion(tasks, requested, 'leave', 'EMP-005', async () => {
      const { count, error } = await supabase.from('leave_types').select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).eq('is_active', true).limit(1)
      return error ? null : count ?? 0
    })
  }

  if (hasPermission(auth, 'absence-settings:read')) {
    addSuggestion(tasks, requested, 'absence', 'EMP-006', async () => {
      const { count, error } = await supabase.from('absence_settings').select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId).eq('hr_group_id', hrGroupId).limit(1)
      return error ? null : count ?? 0
    })
  }

  const suggestions = await Promise.all(tasks)
  return suggestions.filter((suggestion): suggestion is SetupAssistantSuggestion => suggestion !== null)
}
