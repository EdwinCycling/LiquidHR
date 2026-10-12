import 'server-only'

import type { Database } from '@scope/db'
import { requireHrGroupId, type AuthContext } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type EmployeeScope = 'all' | 'team'
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type DirectTeamPlacement = Pick<
  Database['public']['Tables']['employee_organizations']['Row'],
  'employee_id' | 'job_title' | 'department_id' | 'job_id' | 'effective_from'
>

export interface DirectTeamEmployeeScope {
  readonly members: readonly DirectTeamPlacement[]
  readonly employeeIds: readonly string[]
  readonly sourceTruncated: boolean
}

export function isEmployeeOutsideDirectManagerScope(
  auth: Pick<AuthContext, 'employeeId' | 'activeRoles'>,
  targetEmployeeId: string,
  teamEmployeeIds: readonly string[],
): boolean {
  return auth.employeeId !== targetEmployeeId
    && auth.activeRoles.includes('DIRECT_MANAGER')
    && !auth.activeRoles.includes('TENANT_ADMIN')
    && !teamEmployeeIds.includes(targetEmployeeId)
}

export async function listDirectTeamEmployeeScope(
  auth: AuthContext,
  existingClient?: SupabaseServerClient,
  rowLimit = 500,
  today = new Date().toISOString().slice(0, 10),
): Promise<DirectTeamEmployeeScope> {
  if (!auth.employeeId || !auth.administrationId || !auth.activeRoles.includes('DIRECT_MANAGER')) {
    return { members: [], employeeIds: [], sourceTruncated: false }
  }
  const groupId = requireHrGroupId(auth)

  const supabase = existingClient ?? await createClient()
  const { data, error, count } = await supabase
    .from('employee_organizations')
    .select('employee_id,job_title,department_id,job_id,effective_from', { count: 'exact' })
    .eq('tenant_id', auth.tenantId)
    .eq('hr_group_id', groupId)
    .eq('administration_id', auth.administrationId)
    .eq('direct_manager_id', auth.employeeId)
    .neq('employee_id', auth.employeeId)
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('effective_from', { ascending: false })
    .order('employee_id', { ascending: true })
    .limit(rowLimit)

  if (error) throw error
  if (count === null) throw new Error('DIRECT_TEAM_SCOPE_COUNT_UNAVAILABLE')

  const members = new Map<string, DirectTeamPlacement>()
  for (const row of data ?? []) {
    if (!members.has(row.employee_id)) members.set(row.employee_id, row)
  }
  const uniqueMembers = [...members.values()]
  return {
    members: uniqueMembers,
    employeeIds: uniqueMembers.map((member) => member.employee_id),
    sourceTruncated: count > (data?.length ?? 0),
  }
}

export async function listDirectTeamEmployeeIds(auth: AuthContext, existingClient?: SupabaseServerClient): Promise<string[]> {
  const scope = await listDirectTeamEmployeeScope(auth, existingClient)
  return [...scope.employeeIds]
}
