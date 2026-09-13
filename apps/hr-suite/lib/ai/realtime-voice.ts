import 'server-only'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { AiExecutionError } from './contracts'
import { OPENAI_EFFICIENT_MODEL } from './openai-config'
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

export const GPT_LIVE_MODEL = 'gpt-live-1'
export const REALTIME_VOICE_MODEL = GPT_LIVE_MODEL
export const REALTIME_VOICE_CONFIG_VERSION = 'gpt-live-employee-v1.20260913.1'
const GPT_LIVE_SESSION_ENDPOINT = 'https://api.openai.com/v1/live/sessions'

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

export function resolveRealtimeVoiceModel(environment: Record<string, string | undefined> = process.env): string {
  const configured = environment.OPENAI_REALTIME_MODEL?.trim()
  if (configured && configured !== GPT_LIVE_MODEL) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return configured || GPT_LIVE_MODEL
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
    model: resolveRealtimeVoiceModel(),
    instructions: [
      `You are the LiquidHR voice interface. Speak in ${language}.`,
      'This session is bound to one employee by the LiquidHR application. Never ask for or accept an employee ID. Delegate employee questions to the backend.',
      'Keep the spoken conversation concise and handle interruptions naturally.',
      'Never claim that HR data was saved, changed, published, or approved. A human must review and confirm proposals in the application.',
    ].join(' '),
    client: {
      data_channel: {
        allowed_client_events: ['response.item.create', 'response.create', 'session.close'],
      },
    },
    delegation: {
      type: 'responses',
      responses: {
        model: OPENAI_EFFICIENT_MODEL,
        instructions: [
          'You are the LiquidHR employee-context backend. Use only the supplied LiquidHR tools for authorized employee information or proposals. Do not invent HR facts.',
          'Employee Summary and Conversation Preparation are read-only proposals. SMART Goal returns a proposal only and never saves the goal.',
          'The application reauthorizes every tool call and binds it to the employee route. Never request or infer an employee ID from the user.',
          'Return verified facts or proposal text, clearly state when a capability is unavailable, and never claim that anything was saved, changed, published, or approved.',
        ].join(' '),
        tools: [
          {
            type: 'function',
            name: 'employee_summary',
            description: 'Request the authorized employee summary for the employee bound to this session.',
            parameters: emptyParameters,
            strict: true,
          },
          {
            type: 'function',
            name: 'conversation_preparation',
            description: 'Request authorized preparation for a manager conversation about the employee bound to this session.',
            parameters: emptyParameters,
            strict: true,
          },
          {
            type: 'function',
            name: 'development_goal_smart',
            description: 'Create a proposal to formulate supplied development-goal text as SMART. This never saves the goal.',
            parameters: smartGoalParameters,
            strict: true,
          },
        ],
        tool_choice: 'auto',
        parallel_tool_calls: false,
      },
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function providerErrorMetadata(body: string): { openAiErrorType?: string; openAiErrorCode?: string } {
  try {
    const parsed: unknown = JSON.parse(body)
    if (!isRecord(parsed) || !isRecord(parsed.error)) return {}
    const metadata: { openAiErrorType?: string; openAiErrorCode?: string } = {}
    if (typeof parsed.error.type === 'string') metadata.openAiErrorType = parsed.error.type
    if (typeof parsed.error.code === 'string') metadata.openAiErrorCode = parsed.error.code
    return metadata
  } catch {
    return {}
  }
}

function logProviderFailure(input: { response?: Response; body: string; model: string; status: number | string }): void {
  const metadata: {
    apiFamily: 'live'
    endpoint: string
    model: string
    status: number | string
    requestId?: string
    openAiErrorType?: string
    openAiErrorCode?: string
  } = {
    apiFamily: 'live',
    endpoint: GPT_LIVE_SESSION_ENDPOINT,
    model: input.model,
    status: input.status,
  }
  const requestId = input.response?.headers.get('x-request-id') ?? input.response?.headers.get('request-id')
  if (requestId) metadata.requestId = requestId
  Object.assign(metadata, providerErrorMetadata(input.body))
  console.error('[AI_PROVIDER] GPT-Live session failed', metadata)
}

function parseLiveSessionAnswer(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.transport) || typeof value.transport.sdp !== 'string' || !value.transport.sdp.trim()) return null
  if (value.transport.type !== 'webrtc') return null
  return value.transport.sdp
}
function safeRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new AiExecutionError('INVALID_RESULT')
  return value
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
  const model = typeof input.session.model === 'string' && input.session.model.trim() ? input.session.model : GPT_LIVE_MODEL
  let response: Response
  try {
    response = await fetch(GPT_LIVE_SESSION_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requiredApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session: input.session, transport: { type: 'webrtc', sdp: input.sdpOffer } }),
      cache: 'no-store',
    })
  } catch {
    logProviderFailure({ body: '', model, status: 'network_error' })
    throw new AiExecutionError('PROVIDER_FAILED')
  }

  const body = await response.text()
  if (!response.ok) {
    logProviderFailure({ response, body, model, status: response.status })
    throw new AiExecutionError('PROVIDER_FAILED')
  }

  let parsed: unknown
  try { parsed = JSON.parse(body) as unknown } catch {
    logProviderFailure({ response, body: '', model, status: 'invalid_response' })
    throw new AiExecutionError('PROVIDER_FAILED')
  }
  const answer = parseLiveSessionAnswer(parsed)
  if (!answer) {
    logProviderFailure({ response, body: '', model, status: 'invalid_response' })
    throw new AiExecutionError('PROVIDER_FAILED')
  }
  return answer
}
