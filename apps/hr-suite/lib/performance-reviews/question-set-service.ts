import 'server-only'

import { requireHrGroupId, requirePermission } from '@/lib/auth/permissions'
import { getEnabledTenantModules } from '@/lib/modules/module-service'
import { createClient } from '@/lib/supabase/server'
import { PerformanceReviewError } from './performance-error'
import { performanceReviewQuestionSetSchema, type PerformanceReviewQuestionSet } from './question-set-schema'

type Client = Awaited<ReturnType<typeof createClient>>
export type QuestionSetRole = 'EMPLOYEE' | 'GV' | 'AB'
export type QuestionSetChoice = { mode: 'NONE' } | { mode: 'SET'; questionSetId: string }
export type QuestionSetOverrides = Partial<Record<QuestionSetRole, QuestionSetChoice>>
export type QuestionSetRow = Omit<PerformanceReviewQuestionSet, 'version'> & {
  id: string
  tenant_id: string
  hr_group_id: string
  status: 'DRAFT' | 'AVAILABLE' | 'ARCHIVED'
  version: number
  created_at: string
  updated_at: string
}

async function managerContext() {
  const context = await requirePermission('performance-review:manage')
  const hrGroupId = requireHrGroupId(context)
  const client = await createClient()
  const modules = await getEnabledTenantModules({ auth: context, supabase: client })
  if (!modules.includes('PERFORMANCE_REVIEW_QUESTION_SETS')) throw new PerformanceReviewError('PERFORMANCE_QUESTION_SETS_MODULE_INACTIVE', 404)
  return { context, hrGroupId, client }
}

async function rpc<T>(client: Client, name: string, args: Record<string, unknown>): Promise<T> {
  const result = await client.rpc(name as never, args as never)
  if (result.error) {
    const errorText = result.error.message.toLocaleUpperCase('en-US')
    const status = errorText.includes('FORBIDDEN') ? 403
      : errorText.includes('NOT_FOUND') ? 404
        : errorText.includes('CONFLICT') || errorText.includes('IMMUTABLE') || errorText.includes('NOT_AVAILABLE') ? 409
          : 400
    throw new PerformanceReviewError(errorText.match(/PERFORMANCE_[A-Z0-9_]+/)?.[0] ?? 'PERFORMANCE_QUESTION_SET_COMMAND_FAILED', status)
  }
  return result.data as T
}

export async function requirePerformanceReviewQuestionSetModule(): Promise<void> {
  await managerContext()
}

export async function listPerformanceReviewQuestionSets(): Promise<QuestionSetRow[]> {
  const { context, hrGroupId, client } = await managerContext()
  const { data, error } = await client.from('performance_review_question_sets' as never)
    .select('id,tenant_id,hr_group_id,name,description,status,questions,version,created_at,updated_at')
    .eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).order('updated_at', { ascending: false })
  if (error) throw new PerformanceReviewError('PERFORMANCE_QUESTION_SET_READ_FAILED')
  return (data ?? []) as unknown as QuestionSetRow[]
}

export async function savePerformanceReviewQuestionSet(input: unknown): Promise<QuestionSetRow> {
  const parsed = performanceReviewQuestionSetSchema.parse(input)
  const { hrGroupId, client } = await managerContext()
  return rpc<QuestionSetRow>(client, 'save_performance_review_question_set', {
    requested_hr_group: hrGroupId,
    requested_id: parsed.id ?? null,
    requested_name: parsed.name,
    requested_description: parsed.description,
    requested_status: parsed.status,
    requested_questions: parsed.questions,
    expected_version: parsed.version ?? null,
  })
}

export async function duplicatePerformanceReviewQuestionSet(id: string, name: string): Promise<QuestionSetRow> {
  const { client } = await managerContext()
  return rpc<QuestionSetRow>(client, 'duplicate_performance_review_question_set', { requested_id: id, requested_name: name })
}

export async function archivePerformanceReviewQuestionSet(id: string, version: number): Promise<QuestionSetRow> {
  const { client } = await managerContext()
  return rpc<QuestionSetRow>(client, 'archive_performance_review_question_set', { requested_id: id, expected_version: version })
}

export async function savePerformanceReviewRoundQuestionSets(input: {
  roundId: string
  enabled: boolean
  defaults: Record<QuestionSetRole, string | null>
  overrides?: Record<string, QuestionSetOverrides>
}) {
  const { client } = await managerContext()
  return rpc(client, 'save_performance_review_round_question_sets', {
    requested_round: input.roundId,
    requested_enabled: input.enabled,
    requested_defaults: input.defaults,
    requested_overrides: input.overrides ?? {},
  })
}

export function parseQuestionSetOverrides(input: unknown): QuestionSetOverrides {
  if (input === undefined) return {}
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new PerformanceReviewError('PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID', 400)
  const overrides: QuestionSetOverrides = {}
  for (const [key, value] of Object.entries(input)) {
    if (key !== 'EMPLOYEE' && key !== 'GV' && key !== 'AB') throw new PerformanceReviewError('PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID', 400)
    if (typeof value !== 'object' || value === null || Array.isArray(value) || !('mode' in value)) throw new PerformanceReviewError('PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID', 400)
    const choice = value as { mode?: unknown; questionSetId?: unknown }
    if (choice.mode === 'NONE' && Object.keys(value).length === 1) overrides[key] = { mode: 'NONE' }
    else if (choice.mode === 'SET' && typeof choice.questionSetId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(choice.questionSetId) && Object.keys(value).length === 2) {
      overrides[key] = { mode: 'SET', questionSetId: choice.questionSetId }
    } else throw new PerformanceReviewError('PERFORMANCE_QUESTION_SET_OVERRIDE_INVALID', 400)
  }
  return overrides
}
