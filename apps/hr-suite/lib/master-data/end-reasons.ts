import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export class EndReasonError extends Error { constructor(readonly code: string, readonly status: number) { super(code) } }

export async function listEndReasons() {
  const context = await requirePermission('settings:read')
  if (!context.administrationId) throw new EndReasonError('ADMINISTRATION_REQUIRED', 400)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employment_end_reasons').select('id, code, name_nl, name_en, is_active').eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).order('name_nl').limit(200)
  if (error) throw new EndReasonError('END_REASON_READ_FAILED', 500)
  return data ?? []
}

export async function updateEndReason(id: string, input: { nameNl?: string; nameEn?: string; isActive?: boolean }) {
  const context = await requirePermission('settings:write')
  if (!context.administrationId) throw new EndReasonError('ADMINISTRATION_REQUIRED', 400)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employment_end_reasons').update({ ...(input.nameNl ? { name_nl: input.nameNl } : {}), ...(input.nameEn ? { name_en: input.nameEn } : {}), ...(input.isActive !== undefined ? { is_active: input.isActive } : {}) }).eq('id', id).eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).select('id').maybeSingle()
  if (error || !data) throw new EndReasonError('END_REASON_UPDATE_FAILED', 400)
}

export async function deleteEndReason(id: string) {
  const context = await requirePermission('settings:write')
  if (!context.administrationId) throw new EndReasonError('ADMINISTRATION_REQUIRED', 400)
  const supabase = await createClient()
  const usage = await supabase.from('employment_terminations').select('id', { count: 'exact', head: true }).eq('internal_reason_id', id).eq('tenant_id', context.tenantId)
  if (usage.error) throw new EndReasonError('END_REASON_DELETE_FAILED', 500)
  if ((usage.count ?? 0) > 0) throw new EndReasonError('END_REASON_IN_USE', 409)
  const { error } = await supabase.from('employment_end_reasons').delete().eq('id', id).eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId)
  if (error) throw new EndReasonError('END_REASON_DELETE_FAILED', 400)
}
