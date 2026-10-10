import { z } from 'zod'
import type { AuthContext } from '@/lib/auth/permissions'
import { buildHeRaSystemInstruction, type HeRaEvidenceEnvelope } from './data-contract'
import { HeRaDateTimeError, resolveHeRaDate, resolveHeRaDateTime } from './date-time'
import {
  generateHeRaResponse,
  type GenerateHeRaResponseInput,
  type HeRaGeneration,
  type HeRaToolCall,
} from './gemini'
import { dispatchHeRaTool, HeRaToolRegistryError } from './tool-registry'
import { isHeRaWorkforceToolName } from '@/lib/workforce-tools/registry'
import { executeHeRaTool } from './tools'
import type { HeRaUserContext } from './types'
import { getTranslator } from '@/lib/i18n/server'

interface RunHeRaTurnInput {
  context: AuthContext
  userContext: HeRaUserContext
  latestUserMessage: string
  modelContext: string
  personaInstruction: string
  groundingRequiredMessage: string
  now: Date
}

interface HeRaDraftProposal {
  actionType: 'EMPLOYEE_PERSONAL_REMINDER_CREATE' | 'EMPLOYEE_LEAVE_REQUEST_CREATE' | 'EMPLOYEE_ADDRESS_CHANGE' | 'EMPLOYMENT_SALARY_CHANGE' | 'EMPLOYMENT_SCHEDULE_CHANGE' | 'ORGANIZATION_PLACEMENT_CHANGE' | 'TALENT_DEVELOPMENT_GOAL_CREATE' | 'TALENT_GOAL_CHECK_IN_CREATE'
  toolName: 'draft_personal_reminder' | 'draft_leave_request' | 'draft_employee_address_change' | 'draft_employment_salary_change' | 'draft_employment_schedule_change' | 'draft_organization_placement_change' | 'draft_talent_development_goal' | 'draft_talent_goal_check_in'
  payload: Record<string, unknown>
  summary: string
  controlPayload: Record<string, unknown>
}

interface HeRaTurnResult {
  content: string
  model: string
  evidence: HeRaEvidenceEnvelope<unknown> | null
  draft: HeRaDraftProposal | null
}

interface RunHeRaTurnDependencies {
  generate?: (input: GenerateHeRaResponseInput) => Promise<HeRaGeneration>
  dispatchTool?: (context: AuthContext, call: HeRaToolCall) => Promise<unknown>
}

class HeRaClarificationRequired extends Error {
  constructor(readonly messageKey: 'reminderClarifyDateTime' | 'leaveClarifyDate') {
    super(messageKey)
  }
}

const evidenceSchema = z.object({
  source: z.literal('LIQUID_HR'),
  data: z.unknown(),
  scope: z.object({
    population: z.string(),
    visibleCount: z.number().int().nonnegative(),
  }).strict(),
  filters: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.string(),
  }).strict()),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  uncertainties: z.array(z.string()),
}).strict()

function currentDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${read('year')}-${read('month')}-${read('day')}`
}

function requiresInternalEvidence(message: string): boolean {
  return /\b(medewerker(?:s)?|salaris(?:sen)?|dienstverband(?:en)?|contract(?:en)?|afdeling(?:en)?|organisatie|employee(?:s)?|salary|employment|department(?:s)?|organization)\b/i
    .test(message)
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('HERA_TOOL_RESULT_INVALID')
  }
  return Object.fromEntries(Object.entries(value))
}

async function dispatchTool(context: AuthContext, call: HeRaToolCall): Promise<unknown> {
  if ([
    'analyze_salary_threshold',
    'search_visible_employees',
    'get_visible_employment',
    'get_visible_organization',
  ].includes(call.name) || isHeRaWorkforceToolName(call.name)) {
    return dispatchHeRaTool(context, call)
  }
  return executeHeRaTool(context, call)
}

function draftFromToolResult(toolResult: Record<string, unknown>): HeRaDraftProposal | null {
  if (toolResult.kind !== 'DRAFT' || typeof toolResult.toolName !== 'string') return null
  const actionTypes = {
    draft_personal_reminder: 'EMPLOYEE_PERSONAL_REMINDER_CREATE',
    draft_leave_request: 'EMPLOYEE_LEAVE_REQUEST_CREATE',
    draft_employee_address_change: 'EMPLOYEE_ADDRESS_CHANGE',
    draft_employment_salary_change: 'EMPLOYMENT_SALARY_CHANGE',
    draft_employment_schedule_change: 'EMPLOYMENT_SCHEDULE_CHANGE',
    draft_organization_placement_change: 'ORGANIZATION_PLACEMENT_CHANGE',
    draft_talent_development_goal: 'TALENT_DEVELOPMENT_GOAL_CREATE',
    draft_talent_goal_check_in: 'TALENT_GOAL_CHECK_IN_CREATE',
  } as const
  const toolName = toolResult.toolName as keyof typeof actionTypes
  const actionType = actionTypes[toolName]
  if (!actionType) return null
  const payload = asRecord(toolResult.payload)
  const controlPayload = asRecord(toolResult.controlPayload)
  if (typeof toolResult.summary !== 'string') throw new Error('HERA_TOOL_RESULT_INVALID')
  return {
    actionType,
    toolName,
    payload,
    summary: toolResult.summary,
    controlPayload,
  }
}

function normalizeToolCall(
  call: HeRaToolCall,
  input: Pick<RunHeRaTurnInput, 'now' | 'userContext'>,
): HeRaToolCall {
  if (call.name === 'draft_personal_reminder') {
    const title = call.args.title
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new HeRaClarificationRequired('reminderClarifyDateTime')
    }
    const when = call.args.when
    if (typeof when !== 'string') throw new HeRaDateTimeError('HERA_DATE_INPUT_INVALID')
    const resolved = resolveHeRaDateTime(when, input.now, input.userContext.timeZone, input.userContext.locale)
    const { when: _when, ...args } = call.args
    void _when
    return { ...call, args: { ...args, remindAt: resolved.iso, displayAt: resolved.display } }
  }
  if (call.name === 'draft_leave_request') {
    const leaveTypeName = call.args.leaveTypeName
    if (typeof leaveTypeName !== 'string' || leaveTypeName.trim().length === 0) {
      throw new HeRaClarificationRequired('leaveClarifyDate')
    }
    const when = call.args.when
    if (typeof when !== 'string') throw new HeRaDateTimeError('HERA_DATE_INPUT_INVALID')
    const resolved = resolveHeRaDate(when, input.now, input.userContext.timeZone, input.userContext.locale)
    const { when: _when, ...args } = call.args
    void _when
    return { ...call, args: { ...args, startDate: resolved.date, displayDate: resolved.display } }
  }
  return call
}

function isUnsupportedToolSelection(error: unknown): boolean {
  if (error instanceof HeRaToolRegistryError) return true
  return error instanceof Error && [
    'HERA_TOOL_NOT_ALLOWED',
    'HERA_TOOL_INPUT_INVALID',
    'HERA_DATE_INPUT_INVALID',
    'HERA_DATE_TIME_AMBIGUOUS',
  ].includes(error.message)
}

export async function runHeRaTurn(
  input: RunHeRaTurnInput,
  dependencies: RunHeRaTurnDependencies = {},
): Promise<HeRaTurnResult> {
  const generate = dependencies.generate ?? generateHeRaResponse
  const instruction = buildHeRaSystemInstruction({
    locale: input.userContext.locale,
    personaInstruction: input.personaInstruction,
    tone: input.userContext.tone,
    detailLevel: input.userContext.detailLevel,
    seniorityLevel: input.userContext.seniorityLevel,
    currentDate: currentDate(input.now, input.userContext.timeZone),
    timeZone: input.userContext.timeZone,
    memory: input.userContext.memory.map((item) => item.content),
  })
  const first = await generate({
    systemInstruction: instruction,
    context: input.modelContext,
  })

  if (!first.toolCall) {
    const blocked = requiresInternalEvidence(input.latestUserMessage)
    return {
      content: blocked
        ? input.groundingRequiredMessage
        : first.text,
      model: first.model,
      evidence: null,
      draft: null,
    }
  }

  let rawToolResult: unknown
  try {
    const normalizedToolCall = normalizeToolCall(first.toolCall, input)
    rawToolResult = await (dependencies.dispatchTool ?? dispatchTool)(input.context, normalizedToolCall)
  } catch (error) {
    if (error instanceof HeRaDateTimeError || error instanceof HeRaClarificationRequired) {
      const translate = await getTranslator('hera', input.userContext.locale)
      const messageKey = error instanceof HeRaClarificationRequired
        ? error.messageKey
        : first.toolCall.name === 'draft_personal_reminder'
          ? 'reminderClarifyDateTime'
          : 'leaveClarifyDate'
      return {
        content: translate(messageKey),
        model: first.model,
        evidence: null,
        draft: null,
      }
    }
    if (!isUnsupportedToolSelection(error)) throw error
    console.warn('HERA_TOOL_SELECTION_REJECTED', {
      toolName: first.toolCall.name,
      code: error instanceof HeRaToolRegistryError
        ? error.code
        : error instanceof Error
          ? error.message
          : 'UNKNOWN',
    })
    return {
      content: input.groundingRequiredMessage,
      model: first.model,
      evidence: null,
      draft: null,
    }
  }
  const toolResult = asRecord(rawToolResult)
  const draft = draftFromToolResult(toolResult)
  if (draft) {
    return {
      // Never surface model prose that could claim a write happened before the
      // user reviewed and confirmed the controlled action.
      content: draft.actionType === 'TALENT_DEVELOPMENT_GOAL_CREATE'
        || draft.actionType === 'TALENT_GOAL_CHECK_IN_CREATE'
        || draft.actionType === 'EMPLOYEE_PERSONAL_REMINDER_CREATE'
        || draft.actionType === 'EMPLOYEE_LEAVE_REQUEST_CREATE'
        ? draft.summary
        : first.text || draft.summary,
      model: first.model,
      evidence: null,
      draft,
    }
  }

  const parsedEvidence = evidenceSchema.safeParse(toolResult)
  const second = await generate({
    systemInstruction: instruction,
    context: input.modelContext,
    toolResponse: { call: first.toolCall, result: toolResult },
  })
  if (!second.text.trim()) {
    return {
      content: input.groundingRequiredMessage,
      model: second.model,
      evidence: null,
      draft: null,
    }
  }
  return {
    content: second.text,
    model: second.model,
    evidence: parsedEvidence.success ? parsedEvidence.data : null,
    draft: null,
  }
}
