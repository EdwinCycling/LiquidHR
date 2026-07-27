import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { ProfileLinkInput } from '@/lib/employment/detail-schemas'

export async function createEmployeeProfileLink(employeeId: string, input: ProfileLinkInput) {
  const context = await requirePermission('employee:write', employeeId)
  const supabase = await createClient()
  const { data: employee, error: employeeError } = await supabase.from('employees').select('id').eq('id', employeeId).eq('tenant_id', context.tenantId).is('deleted_at', null).maybeSingle()
  if (employeeError || !employee) throw new Error('EMPLOYEE_NOT_FOUND')
  const { data, error } = await supabase.from('employee_profile_links').insert({ tenant_id: context.tenantId, employee_id: employeeId, link_type: input.linkType, label: input.label, url: input.url, is_featured: input.isFeatured, sort_order: input.sortOrder }).select('id, label, url, link_type').single()
  if (error || !data) throw new Error('PROFILE_LINK_CREATE_FAILED')
  return data
}
