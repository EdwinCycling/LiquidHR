import { z } from 'zod'
import type { AuthContext } from '@/lib/auth/permissions'
import { buildHeRaSystemInstruction, type HeRaEvidenceEnvelope } from './data-contract'
import {
  generateHeRaResponse,
  type GenerateHeRaResponseInput,
  type HeRaGeneration,
  type HeRaToolCall,
} from './gemini'
import { dispatchHeRaTool } from './tool-registry'
import { executeHeRaTool } from './tools'
import type { HeRaUserContext } from './types'

interface RunHeRaTurnInput {
  context: AuthContext
  userContext: HeRaUserContext
  latestUserMessage: string
  modelContext: string
  personaInstruction: string
  now: Date
}

interface HeRaDraftProposal {
  actionType: 'PERSONAL_REMINDER' | 'EMPLOYEE_ADDRESS_CHANGE' | 'EMPLOYMENT_SALARY_CHANGE' | 'EMPLOYMENT_SCHEDULE_CHANGE' | 'ORGANIZATION_PLACEMENT_CHANGE'
  toolName: 'draft_personal_reminder' | 'draft_employee_address_change' | 'draft_employment_salary_change' | 'draft_employment_schedule_change' | 'draft_organization_placement_change'
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
  ].includes(call.name)) {
    return dispatchHeRaTool(context, call)
  }
  return executeHeRaTool(context, call)
}

function draftFromToolResult(toolResult: Record<string, unknown>): HeRaDraftProposal | null {
  if (toolResult.kind !== 'DRAFT' || typeof toolResult.toolName !== 'string') return null
  const actionTypes = {
    draft_personal_reminder: 'PERSONAL_REMINDER',
    draft_employee_address_change: 'EMPLOYEE_ADDRESS_CHANGE',
    draft_employment_salary_change: 'EMPLOYMENT_SALARY_CHANGE',
    draft_employment_schedule_change: 'EMPLOYMENT_SCHEDULE_CHANGE',
    draft_organization_placement_change: 'ORGANIZATION_PLACEMENT_CHANGE',
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
        ? input.userContext.locale === 'nl'
          ? 'Ik kan dit alleen beantwoorden met geautoriseerde Liquid HR-data. Geef de ontbrekende scope aan of vraag iemand met de juiste toegang.'
          : 'I can only answer this with authorised Liquid HR data. Provide the missing scope or ask someone with the required access.'
        : first.text,
      model: first.model,
      evidence: null,
      draft: null,
    }
  }

  const rawToolResult = await (dependencies.dispatchTool ?? dispatchTool)(input.context, first.toolCall)
  const toolResult = asRecord(rawToolResult)
  const draft = draftFromToolResult(toolResult)
  if (draft) {
    return {
      content: first.text || draft.summary,
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
  return {
    content: second.text,
    model: second.model,
    evidence: parsedEvidence.success ? parsedEvidence.data : null,
    draft: null,
  }
}
