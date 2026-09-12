import 'server-only'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { AiExecutionError } from './contracts'
import { requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

export const realtimeVoiceSessionRequestSchema = z.object({
  locale: z.enum(['nl', 'en']),
  sdpOffer: z.string().trim().min(1).max(250_000),
}).strict()

export const realtimeVoiceToolRequestSchema = z.object({
  locale: z.enum(['nl', 'en']),
  name: z.enum(['employee_summary', 'conversation_preparation', 'development_goal_smart']),
  arguments: z.unknown(),
}).strict()

export const realtimeVoiceUsageRequestSchema = z.object({
  sessionId: z.string().uuid(),
  toolCallCount: z.number().int().min(0).max(1000),
}).strict()

export type RealtimeVoiceLocale = z.infer<typeof realtimeVoiceSessionRequestSchema>['locale']
export type RealtimeVoiceToolName = z.infer<typeof realtimeVoiceToolRequestSchema>['name']

const managerVoiceRoles = new Set(['DIRECT_MANAGER', 'HR_ADVISOR', 'HR_ADMIN', 'TENANT_ADMIN'])

export const REALTIME_VOICE_MODEL = 'gpt-realtime-2.1-mini'
export const REALTIME_VOICE_CONFIG_VERSION = 'gpt-live-employee-v1.20260911.1'

function requiredApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return key
}

export function isRealtimeVoiceEnabled(environment: Record<string, string | undefined> = process.env): boolean {
  const configured = environment.AI_REALTIME_VOICE_ENABLED
  if (configured === 'true') return true
  return configured === undefined && (environment.NODE_ENV === 'development' || environment.NODE_ENV === 'test')
}

export async function requireEmployeeVoiceContext(employeeId: string): Promise<AuthContext> {
  const context = await requirePermission('employee:read', employeeId)
  if (!context.activeRoles.some((role) => managerVoiceRoles.has(role))) {
    throw new AiExecutionError('UNAUTHORIZED')
  }
  await requirePermission('ai:use')
  if (!isRealtimeVoiceEnabled()) throw new AiExecutionError('FEATURE_UNAVAILABLE')
  return context
}

const emptyParameters = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const

const smartGoalParameters = {
  type: 'object',
  properties: {
    sourceText: { type: 'string', minLength: 1, maxLength: 4_000 },
  },
  required: ['sourceText'],
  additionalProperties: false,
} as const

export function createRealtimeVoiceSessionConfiguration(locale: RealtimeVoiceLocale): Record<string, unknown> {
  const language = locale === 'nl' ? 'Dutch' : 'English'
  return {
    type: 'realtime',
    model: process.env.OPENAI_REALTIME_MODEL?.trim() || REALTIME_VOICE_MODEL,
    output_modalities: ['audio'],
    instructions: [
      `You are the LiquidHR voice interface. Speak in ${language}.`,
      'This session is bound to one employee by the LiquidHR application. Never ask for or accept an employee ID.',
      'Use only the supplied LiquidHR tools for employee information or proposals. Do not invent HR facts.',
      'Employee Summary and Conversation Preparation are read proposals. SMART Goal returns a proposal only.',
      'Never claim that HR data was saved, changed, published, or approved. A human must review and confirm proposals in the application.',
      'Keep spoken answers concise and say when a capability is unavailable or a proposal needs review.',
    ].join(' '),
    tools: [
      {
        type: 'function',
        name: 'employee_summary',
        description: 'Request the authorized employee summary for the employee bound to this session.',
        parameters: emptyParameters,
      },
      {
        type: 'function',
        name: 'conversation_preparation',
        description: 'Request authorized preparation for a manager conversation about the employee bound to this session.',
        parameters: emptyParameters,
      },
      {
        type: 'function',
        name: 'development_goal_smart',
        description: 'Create a proposal to formulate supplied development-goal text as SMART. This never saves the goal.',
        parameters: smartGoalParameters,
      },
    ],
    tool_choice: 'auto',
  }
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new AiExecutionError('INVALID_RESULT')
  return Object.fromEntries(Object.entries(value))
}

export function parseRealtimeVoiceToolArguments(name: RealtimeVoiceToolName, value: unknown): { sourceText?: string } {
  const record = safeRecord(value)
  if (name === 'development_goal_smart') {
    const parsed = z.object({ sourceText: z.string().trim().min(1).max(4_000) }).strict().safeParse(record)
    if (!parsed.success) throw new AiExecutionError('INVALID_RESULT')
    return parsed.data
  }
  if (Object.keys(record).length !== 0) throw new AiExecutionError('INVALID_RESULT')
  return {}
}

export async function createRealtimeVoiceSession(input: {
  context: AuthContext
  employeeId: string
  model: string
}): Promise<string> {
  const id = randomUUID()
  const hrGroupId = requireHrGroupId(input.context)
  const { error } = await createAdminClient().from('ai_voice_sessions').insert({
    id,
    tenant_id: input.context.tenantId,
    hr_group_id: hrGroupId,
    actor_user_id: input.context.userId,
    actor_employee_id: input.context.employeeId,
    employee_id: input.employeeId,
    model_id: input.model,
    status: 'ACTIVE',
  })
  if (error) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return id
}

export async function markRealtimeVoiceSessionFailed(sessionId: string, context: AuthContext): Promise<void> {
  const hrGroupId = requireHrGroupId(context)
  await createAdminClient().from('ai_voice_sessions').update({ status: 'FAILED', ended_at: new Date().toISOString() })
    .eq('id', sessionId).eq('tenant_id', context.tenantId).eq('hr_group_id', hrGroupId).eq('actor_user_id', context.userId)
}

export async function finishRealtimeVoiceSession(input: {
  sessionId: string
  context: AuthContext
  toolCallCount: number
}): Promise<void> {
  const admin = createAdminClient()
  const hrGroupId = requireHrGroupId(input.context)
  const endedAt = new Date()
  const existing = await admin.from('ai_voice_sessions').select('started_at').eq('id', input.sessionId)
    .eq('tenant_id', input.context.tenantId).eq('hr_group_id', hrGroupId).eq('actor_user_id', input.context.userId).is('ended_at', null).maybeSingle()
  if (existing.error || !existing.data) return
  const startedAt = new Date(existing.data.started_at)
  const durationSeconds = Number.isFinite(startedAt.valueOf()) ? Math.max(0, Math.ceil((endedAt.valueOf() - startedAt.valueOf()) / 1000)) : 0
  await admin.from('ai_voice_sessions').update({
    status: 'ENDED',
    ended_at: endedAt.toISOString(),
    duration_seconds: durationSeconds,
    tool_call_count: input.toolCallCount,
  }).eq('id', input.sessionId).eq('tenant_id', input.context.tenantId).eq('hr_group_id', hrGroupId).eq('actor_user_id', input.context.userId).is('ended_at', null)
}

export async function createOpenAiRealtimeCall(input: { sdpOffer: string; session: Record<string, unknown> }): Promise<string> {
  const form = new FormData()
  form.append('sdp', input.sdpOffer)
  form.append('session', new Blob([JSON.stringify(input.session)], { type: 'application/json' }))
  const response = await fetch('https://api.openai.com/v1/realtime/calls', {
    method: 'POST',
    headers: { Authorization: `Bearer ${requiredApiKey()}` },
    body: form,
    cache: 'no-store',
  })
  const answer = await response.text()
  if (!response.ok || !answer.trim()) throw new AiExecutionError('PROVIDER_FAILED')
  return answer
}
