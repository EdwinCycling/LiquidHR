import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { asResearchClient } from './database'
import { ResearchError } from './errors'
import { enpsBankCategoryInputSchema, enpsBankQuestionInputSchema, type EnpsBankCategoryInput, type EnpsBankQuestionInput } from './schemas'

export async function createEnpsBankCategory(input: EnpsBankCategoryInput): Promise<string> {
  const parsed = enpsBankCategoryInputSchema.parse(input)
  const context = await requirePermission('research:write')
  const hrGroupId = requireHrGroupId(context)
  const research = asResearchClient(await createClient())
  const current = await research.from('enps_question_bank_categories').select('order_index').order('order_index', { ascending: false }).limit(1)
  if (current.error) throw new ResearchError('ENPS_BANK_CATEGORY_READ_FAILED', 500)
  const created = await research.from('enps_question_bank_categories').insert({ tenant_id: context.tenantId, hr_group_id: hrGroupId, name: parsed.name, order_index: (current.data[0]?.order_index ?? 0) + 1, is_system: false }).select('id').single()
  if (created.error) throw new ResearchError('ENPS_BANK_CATEGORY_CREATE_FAILED', created.error.code === '23505' ? 409 : 500)
  return created.data.id
}

export async function updateEnpsBankCategory(id: string, input: EnpsBankCategoryInput): Promise<void> {
  const parsed = enpsBankCategoryInputSchema.parse(input)
  const context = await requirePermission('research:write')
  const research = asResearchClient(await createClient())
  const result = await research.from('enps_question_bank_categories').update({ name: parsed.name }).eq('id', id).eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('is_system', false).select('id').maybeSingle()
  if (result.error) throw new ResearchError('ENPS_BANK_CATEGORY_UPDATE_FAILED', result.error.code === '23505' ? 409 : 500)
  if (!result.data) throw new ResearchError('ENPS_BANK_CATEGORY_NOT_FOUND', 404)
}

export async function deleteEnpsBankCategory(id: string): Promise<void> {
  const context = await requirePermission('research:write')
  const research = asResearchClient(await createClient())
  const result = await research.from('enps_question_bank_categories').delete().eq('id', id).eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('is_system', false).select('id').maybeSingle()
  if (result.error) throw new ResearchError('ENPS_BANK_CATEGORY_DELETE_FAILED', result.error.code === '23503' ? 409 : 500)
  if (!result.data) throw new ResearchError('ENPS_BANK_CATEGORY_NOT_FOUND', 404)
}

export async function createEnpsBankQuestion(input: EnpsBankQuestionInput): Promise<string> {
  const parsed = enpsBankQuestionInputSchema.parse(input)
  const context = await requirePermission('research:write')
  const hrGroupId = requireHrGroupId(context)
  const research = asResearchClient(await createClient())
  const category = await research.from('enps_question_bank_categories').select('id').eq('id', parsed.categoryId).maybeSingle()
  if (category.error) throw new ResearchError('ENPS_BANK_CATEGORY_READ_FAILED', 500)
  if (!category.data) throw new ResearchError('ENPS_BANK_CATEGORY_NOT_FOUND', 404)
  const created = await research.from('enps_question_bank').insert({ tenant_id: context.tenantId, hr_group_id: hrGroupId, category_id: parsed.categoryId, question_number: null, question_text: parsed.text, default_type: parsed.type, is_mandatory_enps: false, is_system: false }).select('id').single()
  if (created.error) throw new ResearchError('ENPS_BANK_QUESTION_CREATE_FAILED', created.error.code === '23505' ? 409 : 500)
  return created.data.id
}

export async function updateEnpsBankQuestion(id: string, input: EnpsBankQuestionInput): Promise<void> {
  const parsed = enpsBankQuestionInputSchema.parse(input)
  const context = await requirePermission('research:write')
  const research = asResearchClient(await createClient())
  const category = await research.from('enps_question_bank_categories').select('id').eq('id', parsed.categoryId).maybeSingle()
  if (category.error) throw new ResearchError('ENPS_BANK_CATEGORY_READ_FAILED', 500)
  if (!category.data) throw new ResearchError('ENPS_BANK_CATEGORY_NOT_FOUND', 404)
  const result = await research.from('enps_question_bank').update({ category_id: parsed.categoryId, question_text: parsed.text, default_type: parsed.type }).eq('id', id).eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('is_system', false).select('id').maybeSingle()
  if (result.error) throw new ResearchError('ENPS_BANK_QUESTION_UPDATE_FAILED', result.error.code === '23505' ? 409 : 500)
  if (!result.data) throw new ResearchError('ENPS_BANK_QUESTION_NOT_FOUND', 404)
}

export async function deleteEnpsBankQuestion(id: string): Promise<void> {
  const context = await requirePermission('research:write')
  const research = asResearchClient(await createClient())
  const result = await research.from('enps_question_bank').delete().eq('id', id).eq('tenant_id', context.tenantId).eq('hr_group_id', requireHrGroupId(context)).eq('is_system', false).select('id').maybeSingle()
  if (result.error) throw new ResearchError('ENPS_BANK_QUESTION_DELETE_FAILED', result.error.code === '23503' ? 409 : 500)
  if (!result.data) throw new ResearchError('ENPS_BANK_QUESTION_NOT_FOUND', 404)
}
