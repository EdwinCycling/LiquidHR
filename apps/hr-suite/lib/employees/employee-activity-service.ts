import 'server-only'

import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { employeeActivityMessageSchema } from './employee-activity-schemas'

export interface EmployeeActivityItem {
  id: string
  message: string
  createdAt: string
  createdByUserId: string
}

export async function listEmployeeActivity(employeeId: string, limit = 20): Promise<EmployeeActivityItem[]> {
  try {
    const context = await requirePermission('employee-activity:read', employeeId)
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('employee_activity_entries')
      .select('id, message, created_at, created_by_user_id')
      .eq('tenant_id', context.tenantId)
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100))
    if (error) throw new Error('EMPLOYEE_ACTIVITY_READ_FAILED')
    return data.map((item) => ({ id: item.id, message: item.message, createdAt: item.created_at, createdByUserId: item.created_by_user_id }))
  } catch (error) {
    if (error instanceof AuthorizationError) return []
    throw error
  }
}

export async function createEmployeeActivity(employeeId: string, message: string): Promise<string> {
  const parsed = employeeActivityMessageSchema.safeParse(message)
  if (!parsed.success) throw new Error('EMPLOYEE_ACTIVITY_INPUT_INVALID')
  const context = await requirePermission('employee-activity:write', employeeId)
  const supabase = await createClient()
  const id = crypto.randomUUID()
  const { error } = await supabase
    .from('employee_activity_entries')
    .insert({
      id,
      tenant_id: context.tenantId,
      administration_id: context.administrationId,
      employee_id: employeeId,
      created_by_user_id: context.userId,
      message: parsed.data,
    })
  if (error) throw new Error('EMPLOYEE_ACTIVITY_WRITE_FAILED')
  return id
}
