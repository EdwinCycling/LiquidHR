import { listEmployeeEmployments } from '@/lib/employment/employment-service'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { loadQueriesInBatches } from '@/lib/supabase/bounded-query-loader'
import type { Database } from '@scope/db'
import type { PayrollScope } from '../scope'

type EmploymentRow = Database['public']['Tables']['employments']['Row']

/**
 * Reads one already-authorized target through the caller's authenticated Supabase
 * session. RLS still decides visibility; every filter is pinned to the verified
 * employee and active Payroll scope.
 */
export async function listPayrollEmploymentForAuthorizedTarget(
  employeeId: string,
  scope: PayrollScope,
  employmentId?: string,
): Promise<readonly EmploymentRow[]> {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  let query = supabase.from('employments').select('*')
    .eq('tenant_id', scope.tenantId)
    .eq('hr_group_id', scope.hrGroupId)
    .eq('administration_id', scope.administrationId)
    .eq('employee_id', employeeId)
    .is('deleted_at', null)
  if (employmentId) {
    query = query.eq('id', employmentId).eq('record_status', 'CONFIRMED')
      .lte('starts_on', today).or(`ends_on.is.null,ends_on.gte.${today}`)
  }
  const { data, error } = await query.order('starts_on', { ascending: false })
    .order('is_primary', { ascending: false }).limit(employmentId ? 2 : 100)
  if (error) throw error
  const rows = data ?? []
  if (rows.some((row) => row.employee_id !== employeeId
    || row.tenant_id !== scope.tenantId
    || row.hr_group_id !== scope.hrGroupId
    || row.administration_id !== scope.administrationId
    || row.deleted_at !== null)) {
    throw new Error('PAYROLL_DIRECTORY_SCOPE_MISMATCH')
  }
  if (employmentId && (rows.length !== 1 || rows[0]?.id !== employmentId)) {
    throw new Error('PAYROLL_DIRECTORY_TARGET_EMPLOYMENT_MISMATCH')
  }
  return rows
}

export async function listPayrollEmploymentDirectories(
  employeeIds: readonly string[],
  scope: PayrollScope,
): Promise<readonly PromiseSettledResult<EmploymentRow[]>[]> {
  const uniqueIds = [...new Set(employeeIds)]
  const permissions = await loadQueriesInBatches(uniqueIds.map((id) => async (): Promise<PromiseSettledResult<string>> => {
    try {
      const context = await requirePermission('contract:read', id)
      if (context.tenantId !== scope.tenantId || context.hrGroupId !== scope.hrGroupId || context.administrationId !== scope.administrationId) {
        throw new Error('PAYROLL_DIRECTORY_SCOPE_MISMATCH')
      }
      return { status: 'fulfilled', value: id }
    } catch (reason) {
      return { status: 'rejected', reason }
    }
  }), 4)
  const byEmployee = new Map<string, PromiseSettledResult<EmploymentRow[]>>()
  const authorizedIds: string[] = []
  permissions.forEach((permission, index) => {
    const id = uniqueIds[index]!
    if (permission.status === 'fulfilled') authorizedIds.push(id)
    else byEmployee.set(id, permission)
  })

  const batches: string[][] = []
  for (let index = 0; index < authorizedIds.length; index += 10) batches.push(authorizedIds.slice(index, index + 10))
  await loadQueriesInBatches(batches.map((batch) => async () => {
    const fallback = async (ids: readonly string[]) => {
      const results = await loadQueriesInBatches(ids.map((id) => async (): Promise<PromiseSettledResult<EmploymentRow[]>> => {
        try { return { status: 'fulfilled', value: await listEmployeeEmployments(id) } }
        catch (reason) { return { status: 'rejected', reason } }
      }), 4)
      ids.forEach((id, index) => byEmployee.set(id, results[index]!))
    }
    try {
      const supabase = await createClient()
      const { data, error, count } = await supabase.from('employments').select('*', { count: 'exact' })
        .eq('tenant_id', scope.tenantId)
        .eq('hr_group_id', scope.hrGroupId)
        .in('employee_id', batch)
        .is('deleted_at', null)
        .order('starts_on', { ascending: false })
        .order('is_primary', { ascending: false })
      const rows = data ?? []
      if (error || count === null || count !== rows.length || rows.some((row) =>
        row.tenant_id !== scope.tenantId || row.hr_group_id !== scope.hrGroupId || !batch.includes(row.employee_id) || row.deleted_at !== null,
      )) {
        await fallback(batch)
        return
      }
      const fullEmployees: string[] = []
      for (const id of batch) {
        const employeeRows = rows.filter((row) => row.employee_id === id)
        if (employeeRows.length >= 100) fullEmployees.push(id)
        else byEmployee.set(id, { status: 'fulfilled', value: employeeRows })
      }
      if (fullEmployees.length) await fallback(fullEmployees)
    } catch {
      await fallback(batch)
    }
  }), 3)
  return employeeIds.map((id) => byEmployee.get(id)!)
}
