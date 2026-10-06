import type { Tool } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { APP_VERSION } from '@/lib/app-version'
import {
  selfDevelopmentPlansProjectionSchema,
  selfDevelopmentPlanStatusSchema,
} from '@/lib/api-v1/resources/projections'
import { getWorkforceTool } from '../catalog'

const EXTERNAL_WORKFORCE_TOOL_ID = 'employee.talent.development-plans.read' as const

/**
 * Server metadata shared by the local MCP transport and ChatGPT-compatible
 * hosts. This is protocol metadata, not a public publication or auth grant.
 */
export const CHATGPT_MCP_SERVER_METADATA = Object.freeze({
  name: 'liquid-hr-workforce',
  version: APP_VERSION,
  instructions:
    'LiquidHR Workforce levert uitsluitend read-only workforce-informatie binnen de actuele, door de server bepaalde autorisatiecontext. Gebruik de tool voor de eigen ontwikkelplannen; geef geen employee-, tenant-, administratie- of rolselectie mee. De server bepaalt de actuele medewerkercontext en weigert requests die de self-scope proberen te verbreden.',
} as const)

/** Alias that matches the MCP server constructor terminology. */
export const CHATGPT_MCP_SERVER_INFO = CHATGPT_MCP_SERVER_METADATA

function requireWorkforceTool(): NonNullable<ReturnType<typeof getWorkforceTool>> {
  const tool = getWorkforceTool(EXTERNAL_WORKFORCE_TOOL_ID)
  if (!tool) throw new Error('CHATGPT_MCP_WORKFORCE_TOOL_NOT_FOUND')
  return tool
}

const workforceTool = requireWorkforceTool()

if (
  workforceTool.id !== EXTERNAL_WORKFORCE_TOOL_ID
  ||
  workforceTool.audience.length !== 1
  || workforceTool.audience[0] !== 'EMPLOYEE'
  || workforceTool.scope !== 'SELF'
  || workforceTool.operation !== 'READ'
  || workforceTool.permission !== 'self:talent-goal:read'
  || workforceTool.additionalPermissions?.length
  || workforceTool.module !== 'TALENT'
) {
  throw new Error('CHATGPT_MCP_WORKFORCE_TOOL_SCOPE_CHANGED')
}

const emptyInputSchema = workforceTool.inputSchema
if (
  !emptyInputSchema.safeParse({}).success
  || emptyInputSchema.safeParse({ employeeId: 'caller-selected' }).success
  || emptyInputSchema.safeParse({ tenantId: 'caller-selected' }).success
  || emptyInputSchema.safeParse({ administrationId: 'caller-selected' }).success
) {
  throw new Error('CHATGPT_MCP_WORKFORCE_TOOL_INPUT_CHANGED')
}

function toMcpInputSchema(schema: z.ZodType): Tool['inputSchema'] {
  const jsonSchema = z.toJSONSchema(schema)
  if (
    typeof jsonSchema !== 'object'
    || jsonSchema === null
    || Array.isArray(jsonSchema)
    || jsonSchema.type !== 'object'
  ) {
    throw new TypeError('MCP tool input schema must be a JSON object schema.')
  }
  return jsonSchema as Tool['inputSchema']
}

/**
 * The external projection is deliberately narrower than the internal
 * APIAI-02 employee tool result. It must remain aligned with APIAI-01's
 * approved self-only Development Plans projection.
 */
export const chatGptDevelopmentPlansOutputSchema = z.object({
  plans: selfDevelopmentPlansProjectionSchema,
}).strict()

export const chatGptDevelopmentPlansInputSchema = emptyInputSchema

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Projects the internal Workforce-tool result before it becomes MCP
 * structuredContent. The internal catalog result contains fields that are
 * useful inside LiquidHR but are not part of the approved external contract.
 */
export function projectChatGptDevelopmentPlansResult(
  rawResult: unknown,
): z.output<typeof chatGptDevelopmentPlansOutputSchema> {
  const parsedSource = workforceTool.outputSchema.safeParse(rawResult)
  if (!parsedSource.success) throw new Error('CHATGPT_MCP_RESULT_INVALID')

  const sourceRecord = asRecord(parsedSource.data)
  const sourcePlans = sourceRecord?.plans
  if (!Array.isArray(sourcePlans)) throw new Error('CHATGPT_MCP_RESULT_INVALID')

  const plans = sourcePlans.map((sourcePlan) => {
    const plan = asRecord(sourcePlan)
    if (!plan) throw new Error('CHATGPT_MCP_RESULT_INVALID')
    return {
      periodStart: plan.periodStart,
      periodEnd: plan.periodEnd,
      progressPercent: plan.progressPercent,
      status: plan.status,
      completedAt: plan.completedAt,
    }
  })

  return chatGptDevelopmentPlansOutputSchema.parse({ plans })
}

export type ChatGptMcpToolExposure = 'LOCAL_TEST_ONLY'

export interface ChatGptMcpToolMetadata {
  readonly workforceToolId: typeof EXTERNAL_WORKFORCE_TOOL_ID
  readonly exposure: ChatGptMcpToolExposure
  readonly audience: 'EMPLOYEE'
  readonly scope: 'SELF'
  readonly operation: 'READ'
  readonly permission: 'self:talent-goal:read'
  readonly projectResult: typeof projectChatGptDevelopmentPlansResult
  readonly tool: Tool
}

const developmentPlansTool: ChatGptMcpToolMetadata = {
  workforceToolId: EXTERNAL_WORKFORCE_TOOL_ID,
  exposure: 'LOCAL_TEST_ONLY',
  audience: 'EMPLOYEE',
  scope: 'SELF',
  operation: 'READ',
  permission: 'self:talent-goal:read',
  projectResult: projectChatGptDevelopmentPlansResult,
  tool: {
    name: EXTERNAL_WORKFORCE_TOOL_ID,
    title: 'Eigen ontwikkelplannen lezen',
    description:
      `${workforceTool.description} De server bepaalt de actuele medewerkercontext; stuur geen employee-, tenant-, administratie- of rolselector mee. De response bevat uitsluitend periodStart, periodEnd, progressPercent, status en completedAt.`,
    inputSchema: toMcpInputSchema(chatGptDevelopmentPlansInputSchema),
    outputSchema: z.toJSONSchema(chatGptDevelopmentPlansOutputSchema),
    annotations: {
      title: 'Eigen ontwikkelplannen lezen',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
}

/**
 * Only the approved self-only resource is advertised. The broader APIAI-02
 * catalog remains an internal capability set and is not exported here.
 */
export const CHATGPT_MCP_TOOL_METADATA: readonly ChatGptMcpToolMetadata[] = Object.freeze([
  Object.freeze(developmentPlansTool),
])

/** Standard MCP `tools/list` payload derived from the single source above. */
export const CHATGPT_MCP_TOOLS: readonly Tool[] = Object.freeze(
  CHATGPT_MCP_TOOL_METADATA.map(({ tool }) => tool),
)

export const CHATGPT_MCP_ALLOWED_STATUSES = Object.freeze(
  selfDevelopmentPlanStatusSchema.options,
)
