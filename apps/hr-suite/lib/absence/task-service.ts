import 'server-only'

import type { Database } from '@scope/db'
import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { absenceTaskTemplateCreateSchema, absenceTaskTemplateUpdateSchema, type AbsenceTaskTemplateCreateInput, type AbsenceTaskTemplateUpdateInput } from './task-schemas'

export type AbsenceTaskTemplate = Database['public']['Tables']['absence_task_templates']['Row']

export class AbsenceTaskTemplateError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code) }
}

export async function listAbsenceTaskTemplates(): Promise<AbsenceTaskTemplate[]> {
  const context = await requirePermission('absence-settings:read')
  const supabase = await createClient()
  let query = supabase.from('absence_task_templates').select('*').eq('tenant_id', context.tenantId).order('is_active', { ascending: false }).order('due_after_effective_days').order('title')
  if (context.administrationId) query = query.eq('administration_id', context.administrationId)
  const { data, error } = await query.limit(500)
  if (error) throw new AbsenceTaskTemplateError('ABSENCE_TASK_TEMPLATES_READ_FAILED', 500)
  return data
}

export async function createAbsenceTaskTemplate(rawInput: unknown): Promise<string> {
  const context = await requirePermission('absence-settings:write')
  if (!context.administrationId) throw new AbsenceTaskTemplateError('ABSENCE_TASK_ADMINISTRATION_REQUIRED', 400)
  const hrGroupId = requireHrGroupId(context)
  const input: AbsenceTaskTemplateCreateInput = absenceTaskTemplateCreateSchema.parse(rawInput)
  const supabase = await createClient()
  const { data, error } = await supabase.from('absence_task_templates').insert({
    tenant_id: context.tenantId,
    hr_group_id: hrGroupId,
    administration_id: context.administrationId,
    code: input.code,
    title: input.title,
    description: input.description ?? null,
    due_after_effective_days: input.dueAfterEffectiveDays,
    evidence_required: input.evidenceRequired,
    evidence_category: input.evidenceCategory ?? null,
    source: 'CUSTOM',
    is_system: false,
    created_by_user_id: context.userId,
  }).select('id').single()
  if (error?.code === '23505') throw new AbsenceTaskTemplateError('ABSENCE_TASK_CODE_CONFLICT', 409)
  if (error || !data) throw new AbsenceTaskTemplateError('ABSENCE_TASK_TEMPLATE_CREATE_FAILED', 500)
  return data.id
}

export async function updateAbsenceTaskTemplate(rawInput: unknown): Promise<void> {
  const context = await requirePermission('absence-settings:write')
  if (!context.administrationId) throw new AbsenceTaskTemplateError('ABSENCE_TASK_ADMINISTRATION_REQUIRED', 400)
  const input: AbsenceTaskTemplateUpdateInput = absenceTaskTemplateUpdateSchema.parse(rawInput)
  const supabase = await createClient()
  const { error } = await supabase.from('absence_task_templates').update({
    title: input.title,
    description: input.description,
    due_after_effective_days: input.dueAfterEffectiveDays,
    evidence_required: input.evidenceRequired,
    evidence_category: input.evidenceCategory,
    is_active: input.isActive,
  }).eq('id', input.id).eq('tenant_id', context.tenantId).eq('administration_id', context.administrationId).eq('source', 'CUSTOM').eq('is_system', false)
  if (error) throw new AbsenceTaskTemplateError('ABSENCE_TASK_TEMPLATE_UPDATE_FAILED', 500)
}
