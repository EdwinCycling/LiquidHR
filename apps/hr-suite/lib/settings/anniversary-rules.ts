import { z } from 'zod'
import { requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export const anniversaryRuleSchema = z.object({ years: z.number().int().min(1).max(80) }).strict()

export async function listAnniversaryRules() {
  const context = await requirePermission('settings:read')
  const supabase = await createClient()
  const { data, error } = await supabase.from('tenant_anniversary_rules').select('id,years,is_active').eq('tenant_id', context.tenantId).order('years').limit(100)
  if (error) throw new Error('ANNIVERSARY_RULES_READ_FAILED')
  return data
}

export async function createAnniversaryRule(input: z.infer<typeof anniversaryRuleSchema>): Promise<void> {
  const context = await requirePermission('settings:write')
  const parsed = anniversaryRuleSchema.parse(input)
  const supabase = await createClient()
  const { error } = await supabase.from('tenant_anniversary_rules').insert({ tenant_id: context.tenantId, years: parsed.years })
  if (error) throw new Error(error.code === '23505' ? 'ANNIVERSARY_RULE_EXISTS' : 'ANNIVERSARY_RULE_CREATE_FAILED')
}

export async function deleteAnniversaryRule(id: string): Promise<void> {
  const context = await requirePermission('settings:write')
  const supabase = await createClient()
  const { error } = await supabase.from('tenant_anniversary_rules').delete().eq('tenant_id', context.tenantId).eq('id', id)
  if (error) throw new Error('ANNIVERSARY_RULE_DELETE_FAILED')
}
