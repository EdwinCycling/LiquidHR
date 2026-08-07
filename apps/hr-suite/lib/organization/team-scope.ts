import 'server-only'

import { requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type EmployeeScope = 'all' | 'team'
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function listDirectTeamEmployeeIds(auth: AuthContext, existingClient?: SupabaseServerClient): Promise<string[]> {
  if (!auth.employeeId || !auth.administrationId || !auth.activeRoles.includes('DIRECT_MANAGER')) return []
  const groupId = requireHrGroupId(auth)

  const supabase = existingClient ?? await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('employee_organizations')
    .select('employee_id')
    .eq('tenant_id', auth.tenantId)
    .eq('hr_group_id', groupId)
    .eq('administration_id', auth.administrationId)
    .eq('direct_manager_id', auth.employeeId)
    .neq('employee_id', auth.employeeId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .limit(500)

  if (error) throw error
  return [...new Set(data.map((row) => row.employee_id))]
}
