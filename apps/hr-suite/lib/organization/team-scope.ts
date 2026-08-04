import 'server-only'

import type { AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type EmployeeScope = 'all' | 'team'

export async function listDirectTeamEmployeeIds(auth: AuthContext): Promise<string[]> {
  if (!auth.employeeId || !auth.administrationId || !auth.activeRoles.includes('DIRECT_MANAGER')) return []

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('employee_organizations')
    .select('employee_id')
    .eq('tenant_id', auth.tenantId)
    .eq('administration_id', auth.administrationId)
    .eq('direct_manager_id', auth.employeeId)
    .neq('employee_id', auth.employeeId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .limit(500)

  if (error) throw error
  return [...new Set(data.map((row) => row.employee_id))]
}
