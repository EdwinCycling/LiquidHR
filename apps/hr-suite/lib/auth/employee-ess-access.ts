import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type EmployeeEssAccessStatus = 'ACTIVE' | 'BLOCKED'

export interface EmployeeEssAccessRecord {
  status: EmployeeEssAccessStatus
  blockedAt: string | null
  blockedByUserId: string | null
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function readEmployeeEssAccess(
  supabase: SupabaseServerClient,
  employeeId: string,
): Promise<EmployeeEssAccessRecord> {
  const { data, error } = await supabase
    .from('employee_ess_access')
    .select('status,blocked_at,blocked_by_user_id')
    .eq('employee_id', employeeId)
    .maybeSingle()

  if (error) throw error
  const status: EmployeeEssAccessStatus = data?.status === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE'
  return {
    status,
    blockedAt: data?.blocked_at ?? null,
    blockedByUserId: data?.blocked_by_user_id ?? null,
  }
}

export async function setEmployeeEssAccess(
  employeeId: string,
  status: EmployeeEssAccessStatus,
): Promise<EmployeeEssAccessStatus> {
  await requirePermission('user:invite')
  const supabase = await createClient()
  const result = await setEmployeeEssAccessForContext(supabase, employeeId, status)
  if (result.error) throw result.error
  if (result.data !== 'ACTIVE' && result.data !== 'BLOCKED') throw new Error('EMPLOYEE_ESS_ACCESS_STATUS_INVALID')
  return result.data
}

async function setEmployeeEssAccessForContext(
  supabase: SupabaseServerClient,
  employeeId: string,
  status: EmployeeEssAccessStatus,
) {
  return supabase.rpc('set_employee_ess_access', {
    target_employee_id: employeeId,
    requested_status: status,
  })
}
