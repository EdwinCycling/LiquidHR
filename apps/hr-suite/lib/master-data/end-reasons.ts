import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import type { EndReasonCreateInput, EndReasonUpdateInput } from './schemas'

export class EndReasonError extends Error { constructor(readonly code: string, readonly status: number) { super(code) } }

function normalizeCountryCode(countryCode: string): string {
  const normalized = countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalized)) throw new EndReasonError('COUNTRY_CODE_INVALID', 400)
  return normalized
}

export async function listEndReasons(countryCode = 'NL') {
  const context = await requirePermission('settings:read')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employment_end_reasons').select('id, code, country_code, name_nl, name_en, is_active').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('country_code', normalizeCountryCode(countryCode)).order('code').limit(200)
  if (error) throw new EndReasonError('END_REASON_READ_FAILED', 500)
  return data ?? []
}

export async function listEndReasonCountries(): Promise<string[]> {
  const context = await requirePermission('settings:read')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employment_end_reasons').select('country_code').eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('country_code').limit(500)
  if (error) throw new EndReasonError('END_REASON_READ_FAILED', 500)
  return [...new Set((data ?? []).map((item) => item.country_code))]
}

export async function createEndReason(input: EndReasonCreateInput): Promise<string> {
  const context = await requirePermission('settings:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employment_end_reasons').insert({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    administration_id: null,
    country_code: normalizeCountryCode(input.countryCode),
    code: input.code,
    name_nl: input.nameNl,
    name_en: input.nameEn,
  }).select('id').single()
  if (error?.code === '23505') throw new EndReasonError('END_REASON_CONFLICT', 409)
  if (error || !data) throw new EndReasonError('END_REASON_CREATE_FAILED', 500)
  return data.id
}

export async function updateEndReason(id: string, input: EndReasonUpdateInput) {
  const context = await requirePermission('settings:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const { data, error } = await supabase.from('employment_end_reasons').update({ ...(input.code ? { code: input.code } : {}), ...(input.nameNl ? { name_nl: input.nameNl } : {}), ...(input.nameEn ? { name_en: input.nameEn } : {}), ...(input.isActive !== undefined ? { is_active: input.isActive } : {}) }).eq('id', id).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).select('id').maybeSingle()
  if (error?.code === '23505') throw new EndReasonError('END_REASON_CONFLICT', 409)
  if (error || !data) throw new EndReasonError('END_REASON_UPDATE_FAILED', 400)
}

export async function deleteEndReason(id: string) {
  const context = await requirePermission('settings:write')
  const hrGroupId = requireHrGroupId(context)
  const supabase = await createClient()
  const usage = await supabase.from('employment_terminations').select('id', { count: 'exact', head: true }).eq('internal_reason_id', id).eq('tenant_id', context.tenantId)
  if (usage.error) throw new EndReasonError('END_REASON_DELETE_FAILED', 500)
  if ((usage.count ?? 0) > 0) throw new EndReasonError('END_REASON_IN_USE', 409)
  const { error } = await supabase.from('employment_end_reasons').delete().eq('id', id).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId)
  if (error) throw new EndReasonError('END_REASON_DELETE_FAILED', 400)
}
