import 'server-only'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { AiExecutionError } from './contracts'
import { defaultAiGroupSettings, type AiGroupSettings } from './settings-contracts'
import { SupabaseAiSettingsPort } from './settings-service'
import { finalizeAiVoiceSession, type AiVoiceTerminationReason } from './voice-credits'
import { OPENAI_EFFICIENT_MODEL } from './openai-config'
import { parsePersonalReminderToolArguments, personalReminderToolParameters, type PersonalReminderToolArguments } from './personal-reminders'
import { requireHrGroupId, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

// PostgreSQL accepteert alle 128-bit UUID-waarden; deterministic TEST-fixtures
// hoeven daarom niet per se de RFC 4122 version/variant-bits te bevatten.
const postgresUuidSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

export const realtimeVoiceSessionRequestSchema = z.object({
  locale: z.enum(['nl', 'en']),
  // Behoud de door de browser gegenereerde SDP ongewijzigd, inclusief CRLF.
  sdpOffer: z.string().min(1).max(250_000).refine((value) => value.trim().length > 0),
}).strict()

export const realtimeVoiceToolRequestSchema = z.object({
  locale: z.enum(['nl', 'en']),
  name: z.enum(['employee_summary', 'conversation_preparation', 'development_goal_smart', 'create_personal_reminder']),
  arguments: z.unknown(),
}).strict()

export const realtimeVoiceUsageRequestSchema = z.object({
  sessionId: z.string().uuid(),
  toolCallCount: z.number().int().min(0).max(1000),
  terminationReason: z.enum(['NORMAL', 'EXPLICIT', 'TIMEOUT', 'DISCONNECT', 'FAILURE', 'CANCELLED']).optional(),
}).strict()

export const teamRealtimeVoiceSessionRequestSchema = z.object({
  locale: z.enum(['nl', 'en']),
  departmentId: postgresUuidSchema.optional(),
  sdpOffer: z.string().min(1).max(250_000).refine((value) => value.trim().length > 0),
}).strict()

export const teamRealtimeVoiceToolRequestSchema = z.object({
  locale: z.enum(['nl', 'en']),
  sessionId: z.string().uuid(),
  name: z.enum(['team_overview', 'team_employee_summary', 'team_conversation_preparation', 'team_summary_proposal', 'create_personal_reminder']),
  arguments: z.unknown(),
}).strict()

export type RealtimeVoiceLocale = z.infer<typeof realtimeVoiceSessionRequestSchema>['locale']
export type RealtimeVoiceToolName = z.infer<typeof realtimeVoiceToolRequestSchema>['name']
export type TeamRealtimeVoiceLocale = z.infer<typeof teamRealtimeVoiceSessionRequestSchema>['locale']
export type TeamRealtimeVoiceToolName = z.infer<typeof teamRealtimeVoiceToolRequestSchema>['name']
export type RealtimeVoiceTerminationReason = z.infer<typeof realtimeVoiceUsageRequestSchema>['terminationReason'] extends infer T
  ? Exclude<T, undefined>
  : never

const managerVoiceRoles = new Set(['DIRECT_MANAGER', 'HR_ADVISOR', 'HR_ADMIN', 'TENANT_ADMIN'])

export const GPT_LIVE_MODEL = 'gpt-live-1'
export const REALTIME_VOICE_MODEL = GPT_LIVE_MODEL
export const REALTIME_VOICE_CONFIG_VERSION = 'gpt-live-employee-v1.20260913.1'
export const TEAM_REALTIME_VOICE_CONFIG_VERSION = 'gpt-live-team-v2.20260914.1'
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
  await new SupabaseAiSettingsPort().assertVoiceAllowed({
    scope: { tenantId: context.tenantId, hrGroupId: requireHrGroupId(context), administrationId: context.administrationId },
    authContext: context,
    contextType: 'EMPLOYEE',
  })
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

const teamEmployeeParameters = {
  type: 'object',
  properties: {
    employeeName: { type: 'string', minLength: 1, maxLength: 200 },
  },
  required: ['employeeName'],
  additionalProperties: false,
} as const

const teamSummaryParameters = {
  type: 'object',
  properties: {
    summaryText: { type: 'string', minLength: 1, maxLength: 4_000 },
  },
  required: ['summaryText'],
  additionalProperties: false,
} as const

type ParsedRealtimeVoiceToolArguments = {
  sourceText?: string
  title?: string
  description?: string
  remindAt?: string
  confirmation?: PersonalReminderToolArguments['confirmation']
}

const liveClientEvents = ['response.item.create', 'response.create', 'session.close'] as const

function voiceInstructions(settings: AiGroupSettings): string {
  const style = settings.conversationStyle === 'BUSINESS'
    ? 'Use a businesslike tone.'
    : settings.conversationStyle === 'COACHING'
      ? 'Use a supportive coaching tone without making judgements.'
      : 'Use a neutral professional tone.'
  const length = settings.answerLength === 'SHORT'
    ? 'Keep answers short.'
    : settings.answerLength === 'DETAILED'
      ? 'Give detailed answers when the user asks for detail.'
      : 'Keep answers concise but complete.'
  return `${style} ${length}`
}

function createLiveSessionConfiguration(input: { instructions: string; delegation: Record<string, unknown>; settings?: AiGroupSettings }): Record<string, unknown> {
  const settings = input.settings ?? defaultAiGroupSettings({ tenantId: '', hrGroupId: '' })
  return {
    model: resolveRealtimeVoiceModel(),
    instructions: input.instructions,
    audio: { output: { voice: settings.voiceId } },
    client: {
      data_channel: {
        allowed_client_events: liveClientEvents,
      },
    },
    delegation: input.delegation,
  }
}

export function createRealtimeVoiceSessionConfiguration(locale: RealtimeVoiceLocale, settings?: AiGroupSettings): Record<string, unknown> {
  const language = locale === 'nl' ? 'Dutch' : 'English'
  return createLiveSessionConfiguration({
    instructions: [
      `You are the LiquidHR voice interface. Speak in ${language}.`,
      voiceInstructions(settings ?? defaultAiGroupSettings({ tenantId: '', hrGroupId: '' })),
      'This session is bound to one employee by the LiquidHR application. Never ask for or accept an employee ID. Delegate employee questions to the backend.',
      'Keep the spoken conversation concise and handle interruptions naturally.',
      'Never claim that HR data was saved, changed, published, or approved. A human must review and confirm proposals in the application.',
    ].join(' '),
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
          {
            type: 'function',
            name: 'create_personal_reminder',
            description: 'Create a reminder only for the authenticated manager or HR actor. Call this only after an explicit request or accepted proposal and a resolved absolute date and time. Never create reminders for another person, employee, team, department, or HR group.',
            parameters: personalReminderToolParameters,
            strict: true,
          },
        ],
        tool_choice: 'auto',
        parallel_tool_calls: false,
      },
    },
  })
}

export function createTeamRealtimeVoiceSessionConfiguration(locale: TeamRealtimeVoiceLocale, settings?: AiGroupSettings): Record<string, unknown> {
  const language = locale === 'nl' ? 'Dutch' : 'English'
  return createLiveSessionConfiguration({
    instructions: [
      `You are the LiquidHR Team AI voice interface. Speak in ${language}.`,
      voiceInstructions(settings ?? defaultAiGroupSettings({ tenantId: '', hrGroupId: '' })),
      'This session is bound to the fixed team scope selected by the LiquidHR application. Never ask for or accept employee IDs or department IDs.',
      'Use the LiquidHR team tools for overview, an individual team member by exact name, conversation preparation, and a reviewed team-summary proposal.',
      'Do not rank people, infer sensitive attributes, expose full employee records, or expand beyond the fixed team scope.',
      'Personal reminders are only for the authenticated manager or HR actor. Never create a reminder for another person, team member, team, department, or HR group. Ask a follow-up when the date or time is ambiguous, and do not call the reminder tool until the user explicitly requests it or accepts a proposal.',
      'Never claim that HR data was saved, changed, published, or approved. A human must review and explicitly save a proposal in Mijn logboek.',
      'Keep the spoken conversation concise and handle interruptions naturally.',
    ].join(' '),
    delegation: {
      type: 'responses',
      responses: {
        model: OPENAI_EFFICIENT_MODEL,
        instructions: [
          'You are the LiquidHR Team AI backend. Use only the supplied LiquidHR team tools and the immutable server scope.',
          'The server resolves employee names to scoped employees and reauthorizes every tool call. Never request or infer an employee ID.',
          'Team Summary is a proposal only. It must be reviewed and explicitly saved by the manager or HR user in Mijn logboek. Never write Employee Notes.',
          'create_personal_reminder is the only reminder capability. It creates a personal reminder for the authenticated actor only, after explicit confirmation and an absolute timestamp. Never target employees, team members, teams, departments, or HR groups, and never use HR reminder or publish capabilities.',
          'Do not rank employees, produce sensitive inference, or claim that anything was saved, changed, published, or approved.',
        ].join(' '),
        tools: [
          {
            type: 'function',
            name: 'team_overview',
            description: 'Return a concise authorized overview of the fixed team scope.',
            parameters: emptyParameters,
            strict: true,
          },
          {
            type: 'function',
            name: 'team_employee_summary',
            description: 'Request an authorized summary for one fixed-scope team member by exact displayed name.',
            parameters: teamEmployeeParameters,
            strict: true,
          },
          {
            type: 'function',
            name: 'team_conversation_preparation',
            description: 'Request authorized conversation preparation for one fixed-scope team member by exact displayed name.',
            parameters: teamEmployeeParameters,
            strict: true,
          },
          {
            type: 'function',
            name: 'team_summary_proposal',
            description: 'Turn reviewed spoken team observations into a proposal for Mijn logboek. This never saves automatically.',
            parameters: teamSummaryParameters,
            strict: true,
          },
          {
            type: 'function',
            name: 'create_personal_reminder',
            description: 'Create a personal reminder only for the authenticated actor after explicit confirmation and a resolved absolute date and time. Never target another person, employee, team, department, or HR group.',
            parameters: personalReminderToolParameters,
            strict: true,
          },
        ],
        tool_choice: 'auto',
        parallel_tool_calls: false,
      },
    },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function providerErrorMetadata(body: string): { openAiErrorType?: string; openAiErrorCode?: string; openAiErrorParam?: string } {
  try {
    const parsed: unknown = JSON.parse(body)
    if (!isRecord(parsed) || !isRecord(parsed.error)) return {}
    const metadata: { openAiErrorType?: string; openAiErrorCode?: string; openAiErrorParam?: string } = {}
    if (typeof parsed.error.type === 'string') metadata.openAiErrorType = parsed.error.type
    if (typeof parsed.error.code === 'string') metadata.openAiErrorCode = parsed.error.code
    if (typeof parsed.error.param === 'string') metadata.openAiErrorParam = parsed.error.param
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
    openAiErrorParam?: string
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

export function parseRealtimeVoiceToolArguments(name: RealtimeVoiceToolName, value: unknown): ParsedRealtimeVoiceToolArguments {
  const record = safeRecord(value)
  if (name === 'development_goal_smart') {
    const parsed = z.object({ sourceText: z.string().trim().min(1).max(4_000) }).strict().safeParse(record)
    if (!parsed.success) throw new AiExecutionError('INVALID_RESULT')
    return parsed.data
  }
  if (name === 'create_personal_reminder') return parsePersonalReminderToolArguments(record)
  if (Object.keys(record).length !== 0) throw new AiExecutionError('INVALID_RESULT')
  return {}
}

export function parseTeamRealtimeVoiceToolArguments(name: TeamRealtimeVoiceToolName, value: unknown): ParsedRealtimeVoiceToolArguments & { employeeName?: string; summaryText?: string } {
  const record = safeRecord(value)
  if (name === 'team_overview') {
    if (Object.keys(record).length !== 0) throw new AiExecutionError('INVALID_RESULT')
    return {}
  }
  if (name === 'team_employee_summary' || name === 'team_conversation_preparation') {
    const parsed = z.object({ employeeName: z.string().trim().min(1).max(200) }).strict().safeParse(record)
    if (!parsed.success) throw new AiExecutionError('INVALID_RESULT')
    return parsed.data
  }
  if (name === 'create_personal_reminder') return parsePersonalReminderToolArguments(record)
  const parsed = z.object({ summaryText: z.string().trim().min(1).max(4_000) }).strict().safeParse(record)
  if (!parsed.success) throw new AiExecutionError('INVALID_RESULT')
  return parsed.data
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
  await finalizeAiVoiceSession({ context, contextType: 'EMPLOYEE', sessionId, status: 'FAILED', toolCallCount: 0, terminationReason: 'FAILURE' })
}

export async function finishRealtimeVoiceSession(input: {
  sessionId: string
  context: AuthContext
  toolCallCount: number
  terminationReason?: AiVoiceTerminationReason
}): Promise<void> {
  await finalizeAiVoiceSession({
    context: input.context,
    contextType: 'EMPLOYEE',
    sessionId: input.sessionId,
    status: 'ENDED',
    toolCallCount: input.toolCallCount,
    terminationReason: input.terminationReason ?? 'EXPLICIT',
  })
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
