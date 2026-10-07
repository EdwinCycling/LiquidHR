import type { Tool } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { APP_VERSION } from '@/lib/app-version'
import {
  employeeDevelopmentPlansOutputSchema,
  employeeCompetenciesOutputSchema,
  employeeDevelopmentGapsOutputSchema,
  employeeRemoteDevelopmentPlansOutputSchema,
  employeeSkillsOutputSchema,
} from '../employee-tools'
import {
  selfDevelopmentPlanStatusSchema,
} from '@/lib/api-v1/resources/projections'
import { getWorkforceTool } from '../catalog'

const EXTERNAL_WORKFORCE_TOOL_IDS = [
  'employee.talent.development-plans.read',
  'employee.talent.development-gaps.read',
  'employee.talent.skills.read',
  'employee.talent.competencies.read',
] as const

const plansToolId = EXTERNAL_WORKFORCE_TOOL_IDS[0]

export const CHATGPT_MCP_TOOL_SECURITY_SCHEMES = Object.freeze([
  Object.freeze({ type: 'oauth2' as const, scopes: Object.freeze(['openid'] as const) }),
])

type ChatGptMcpSecuredTool = Tool & {
  readonly securitySchemes: typeof CHATGPT_MCP_TOOL_SECURITY_SCHEMES
}

/** Shared metadata for local contract tests and the gated Remote MCP server. */
export const CHATGPT_MCP_SERVER_METADATA = Object.freeze({
  name: 'liquid-hr-workforce',
  version: APP_VERSION,
  instructions:
    'LiquidHR Workforce biedt uitsluitend read-only informatie over je eigen ontwikkelplannen, ontwikkelgaps, skills en competenties. De server bepaalt je medewerkercontext en weigert iedere poging om medewerker-, tenant-, administratie- of rolcontext te kiezen. Deze MCP biedt geen schrijfacties.',
} as const)

export const CHATGPT_MCP_SERVER_INFO = CHATGPT_MCP_SERVER_METADATA

const emptyInputSchema = z.object({}).strict()
export const chatGptDevelopmentPlansInputSchema = emptyInputSchema

export const chatGptDevelopmentPlansOutputSchema = employeeRemoteDevelopmentPlansOutputSchema

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

export type ChatGptMcpToolExposure = 'REMOTE_TEST_ONLY'

export interface ChatGptMcpToolMetadata {
  readonly workforceToolId: (typeof EXTERNAL_WORKFORCE_TOOL_IDS)[number]
  readonly exposure: ChatGptMcpToolExposure
  readonly audience: 'EMPLOYEE'
  readonly scope: 'SELF'
  readonly operation: 'READ'
  readonly permission: string
  readonly outputSchemaSchema: z.ZodType
  readonly projectResult: (rawResult: unknown) => unknown
  readonly tool: ChatGptMcpSecuredTool
}

type ExternalToolDefinition = {
  readonly id: (typeof EXTERNAL_WORKFORCE_TOOL_IDS)[number]
  readonly title: string
  readonly description: string
  readonly permission: string
  readonly outputSchema: z.ZodType
  readonly projectResult: (rawResult: unknown) => unknown
}

function createExternalTool(definition: ExternalToolDefinition): ChatGptMcpToolMetadata {
  const workforceTool = getWorkforceTool(definition.id)
  if (!workforceTool) throw new Error('CHATGPT_MCP_WORKFORCE_TOOL_NOT_FOUND')
  if (
    workforceTool.id !== definition.id
    || workforceTool.audience.length !== 1
    || workforceTool.audience[0] !== 'EMPLOYEE'
    || workforceTool.scope !== 'SELF'
    || workforceTool.operation !== 'READ'
    || workforceTool.permission !== definition.permission
    || workforceTool.additionalPermissions?.length
    || workforceTool.module !== 'TALENT'
    || !workforceTool.delegatedHandler
  ) {
    throw new Error('CHATGPT_MCP_WORKFORCE_TOOL_SCOPE_CHANGED')
  }

  if (
    !workforceTool.inputSchema.safeParse({}).success
    || workforceTool.inputSchema.safeParse({ employeeId: 'caller-selected' }).success
    || workforceTool.inputSchema.safeParse({ tenantId: 'caller-selected' }).success
    || workforceTool.inputSchema.safeParse({ administrationId: 'caller-selected' }).success
  ) {
    throw new Error('CHATGPT_MCP_WORKFORCE_TOOL_INPUT_CHANGED')
  }

  return Object.freeze({
    workforceToolId: definition.id,
    exposure: 'REMOTE_TEST_ONLY',
    audience: 'EMPLOYEE',
    scope: 'SELF',
    operation: 'READ',
    permission: definition.permission,
    outputSchemaSchema: definition.outputSchema,
    projectResult: definition.projectResult,
    tool: Object.freeze({
      name: definition.id,
      securitySchemes: CHATGPT_MCP_TOOL_SECURITY_SCHEMES,
      title: definition.title,
      description:
        `${definition.description} De server bepaalt de actuele medewerkercontext; stuur geen employee-, tenant-, administratie- of rolselector mee.`,
      inputSchema: toMcpInputSchema(workforceTool.inputSchema),
      outputSchema: z.toJSONSchema(definition.outputSchema),
      annotations: {
        title: definition.title,
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    }),
  })
}

const plansWorkforceTool = getWorkforceTool(plansToolId)
if (!plansWorkforceTool) throw new Error('CHATGPT_MCP_WORKFORCE_TOOL_NOT_FOUND')

/**
 * Existing local Workforce handlers return richer workspace records. Remote
 * delegation instead uses APIAI-01's exact minimal query and this projector
 * accepts only that minimal result or projects the local result to it.
 */
export function projectChatGptDevelopmentPlansResult(rawResult: unknown): z.output<typeof chatGptDevelopmentPlansOutputSchema> {
  const alreadyProjected = chatGptDevelopmentPlansOutputSchema.safeParse(rawResult)
  if (alreadyProjected.success) return alreadyProjected.data

  const source = employeeDevelopmentPlansOutputSchema.safeParse(rawResult)
  if (!source.success) throw new Error('CHATGPT_MCP_RESULT_INVALID')

  const plans = source.data.plans
  return chatGptDevelopmentPlansOutputSchema.parse({
    plans: plans.map((plan) => ({
      periodStart: plan.periodStart,
      periodEnd: plan.periodEnd,
      progressPercent: plan.progressPercent,
      status: plan.status,
      completedAt: plan.completedAt,
    })),
  })
}

const externalToolDefinitions: readonly ExternalToolDefinition[] = [
  {
    id: plansToolId,
    title: 'Eigen ontwikkelplannen lezen',
    description: 'Lees de status en voortgang van je eigen ontwikkelplannen.',
    permission: 'self:talent-goal:read',
    outputSchema: employeeRemoteDevelopmentPlansOutputSchema,
    projectResult: projectChatGptDevelopmentPlansResult,
  },
  {
    id: EXTERNAL_WORKFORCE_TOOL_IDS[1],
    title: 'Eigen ontwikkelgaps lezen',
    description: 'Lees je eigen ontwikkelpunten uit het actuele functieprofiel.',
    permission: 'self:talent-comparison:read',
    outputSchema: employeeDevelopmentGapsOutputSchema,
    projectResult: (result) => employeeDevelopmentGapsOutputSchema.parse(result),
  },
  {
    id: EXTERNAL_WORKFORCE_TOOL_IDS[2],
    title: 'Eigen skills lezen',
    description: 'Lees je eigen geregistreerde vaardigheden.',
    permission: 'self:talent-record:read',
    outputSchema: employeeSkillsOutputSchema,
    projectResult: (result) => employeeSkillsOutputSchema.parse(result),
  },
  {
    id: EXTERNAL_WORKFORCE_TOOL_IDS[3],
    title: 'Eigen competenties lezen',
    description: 'Lees je eigen geregistreerde competenties.',
    permission: 'self:talent-record:read',
    outputSchema: employeeCompetenciesOutputSchema,
    projectResult: (result) => employeeCompetenciesOutputSchema.parse(result),
  },
]

export const CHATGPT_MCP_TOOL_METADATA: readonly ChatGptMcpToolMetadata[] = Object.freeze(
  externalToolDefinitions.map(createExternalTool),
)

export const CHATGPT_MCP_TOOLS: readonly Tool[] = Object.freeze(
  CHATGPT_MCP_TOOL_METADATA.map(({ tool }) => tool),
)

export const CHATGPT_MCP_ALLOWED_STATUSES = Object.freeze(
  selfDevelopmentPlanStatusSchema.options,
)
