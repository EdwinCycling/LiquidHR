import { requireAnyPermission, requireHrGroupId } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { getProcessRecipeStartContext, type ProcessRecipeStartContext } from './recipe-service'

export interface InternalTransferStartEmployee {
  readonly id: string
  readonly employeeNumber: string
  readonly name: string
}

export interface InternalTransferStartEmployment {
  readonly id: string
  readonly employeeId: string
  readonly employmentNumber: string
  readonly startsOn: string
  readonly endsOn: string | null
}

export interface InternalTransferStartData {
  readonly recipe: ProcessRecipeStartContext
  readonly employees: readonly InternalTransferStartEmployee[]
  readonly employments: readonly InternalTransferStartEmployment[]
}

export async function getInternalTransferStartData(departmentId?: string): Promise<InternalTransferStartData> {
  const context = await requireAnyPermission(['process-instance:start', 'self:process-instance:start'])
  const supabase = await createClient()
  const groupId = requireHrGroupId(context)
  const today = new Date().toISOString().slice(0, 10)
  let scopedEmployeeIds: string[] | null = null
  if (departmentId) {
    const query = supabase.from('employee_organizations').select('employee_id')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', groupId)
      .eq('department_id', departmentId)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
    if (context.administrationId) query.eq('administration_id', context.administrationId)
    const { data, error } = await query.limit(2000)
    if (error) throw new Error('INTERNAL_TRANSFER_START_DATA_FAILED')
    scopedEmployeeIds = [...new Set((data ?? []).map((row) => row.employee_id))]
  }
  const employeeQuery = supabase.from('employees')
    .select('id, employee_number, first_name, birth_name')
    .eq('tenant_id', context.tenantId)
    .eq('hr_group_id', groupId)
    .eq('is_active', true)
    .eq('is_archived', false)
    .is('deleted_at', null)
    .order('employee_number')
    .limit(context.permissions.includes('process-instance:start') ? 500 : 1)
  if (!context.permissions.includes('process-instance:start') && context.employeeId) employeeQuery.eq('id', context.employeeId)
  if (scopedEmployeeIds) employeeQuery.in('id', scopedEmployeeIds.length > 0 ? scopedEmployeeIds : ['00000000-0000-0000-0000-000000000000'])

  const [recipe, employeesResult, employmentsResult] = await Promise.all([
    getProcessRecipeStartContext(),
    employeeQuery,
    supabase.from('employments')
      .select('id, employee_id, employment_number, starts_on, ends_on')
      .eq('tenant_id', context.tenantId)
      .eq('hr_group_id', groupId)
      .is('deleted_at', null)
      .order('starts_on', { ascending: false })
      .limit(1000),
  ])
  if (employeesResult.error || employmentsResult.error) throw new Error('INTERNAL_TRANSFER_START_DATA_FAILED')

  const allowedEmployeeIds = new Set((employeesResult.data ?? []).map((employee) => employee.id))
  return {
    recipe,
    employees: (employeesResult.data ?? []).map((employee) => ({
      id: employee.id,
      employeeNumber: employee.employee_number,
      name: `${employee.first_name} ${employee.birth_name}`.trim(),
    })),
    employments: (employmentsResult.data ?? [])
      .filter((employment) => allowedEmployeeIds.has(employment.employee_id))
      .map((employment) => ({
        id: employment.id,
        employeeId: employment.employee_id,
        employmentNumber: employment.employment_number,
        startsOn: employment.starts_on,
        endsOn: employment.ends_on,
      })),
  }
}
