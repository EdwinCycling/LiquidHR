import {
  createMcpHandler,
  McpServer,
  type McpHttpHandler,
  type McpRequestContext,
  type StandardSchemaV1,
  type StandardSchemaWithJSON,
} from '@modelcontextprotocol/server'
import { z } from 'zod'
import { getLocale } from '@/lib/i18n/server'
import {
  CHATGPT_MCP_SERVER_INFO,
  CHATGPT_MCP_TOOL_METADATA,
  chatGptDevelopmentPlansInputSchema,
  chatGptDevelopmentPlansOutputSchema,
  type ChatGptMcpToolMetadata,
} from './mcp/chatgpt-metadata'
import { dispatchWorkforceTool, WorkforceToolDispatchError } from './registry'
import { WORKFORCE_TOOL_CATALOG } from './catalog'
import type { WorkforceToolDefinition } from './contracts'
import { requireAuthContext } from '@/lib/auth/permissions'
import {
  controlledActions,
  ControlledActionError,
  getOrCreateLocalMcpConversation,
} from '@/lib/controlled-actions/service'

export const WORKFORCE_MCP_SERVER_NAME = CHATGPT_MCP_SERVER_INFO.name
export const WORKFORCE_MCP_SERVER_VERSION = CHATGPT_MCP_SERVER_INFO.version
export const WORKFORCE_MCP_ENABLED_ENV = 'LIQUIDHR_INTERNAL_MCP_ENABLED'
export const WORKFORCE_MCP_LOCAL_INSTRUCTIONS =
  'LiquidHR Workforce biedt gegevens en gecontroleerde Talent-acties binnen de actuele, door de server bepaalde autorisatiecontext. Acties volgen altijd prepare, preview, confirm, execute en readback. Bevestig alleen nadat de gebruiker de serverpreview expliciet heeft goedgekeurd. Geef geen tenant-, administratie- of rolselectie mee. Iedere toolcall wordt opnieuw server-side geautoriseerd.'

const mcpEnvironmentSchema = z.object({
  NODE_ENV: z.string().optional(),
  LIQUIDHR_INTERNAL_MCP_ENABLED: z.string().optional(),
  VERCEL: z.string().optional(),
  VERCEL_ENV: z.string().optional(),
})

export function isWorkforceMcpEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  const parsed = mcpEnvironmentSchema.parse(environment)
  const nodeEnvironment = parsed.NODE_ENV?.trim().toLowerCase()
  return (nodeEnvironment === 'development' || nodeEnvironment === 'test')
    && parsed.LIQUIDHR_INTERNAL_MCP_ENABLED?.trim().toLowerCase() === 'true'
    && !parsed.VERCEL?.trim()
    && !parsed.VERCEL_ENV?.trim()
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const LOOPBACK_HOST_AUTHORITY = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i

function isLoopbackHostAuthority(value: string): boolean {
  const host = value.trim()
  if (!LOOPBACK_HOST_AUTHORITY.test(host)) return false

  try {
    const parsed = new URL(`http://${host}`)
    return LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())
      && parsed.pathname === '/'
      && !parsed.username
      && !parsed.password
      && !parsed.search
      && !parsed.hash
  } catch {
    return false
  }
}

export function isLoopbackMcpRequest(request: Request): boolean {
  let requestUrl: URL
  try {
    requestUrl = new URL(request.url)
  } catch {
    return false
  }

  if (requestUrl.protocol !== 'http:' || !LOOPBACK_HOSTS.has(requestUrl.hostname.toLowerCase())) return false

  const hostHeader = request.headers.get('host')?.trim()
  if (!hostHeader) return false
  return isLoopbackHostAuthority(hostHeader)
}

function boundedToolError(error: unknown): string {
  if (error instanceof WorkforceToolDispatchError) return error.code
  return 'MCP_TOOL_EXECUTION_FAILED'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asStructuredContent(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('MCP_RESULT_INVALID')
  return value
}

type WorkforceInputSchema<TInput extends z.ZodType> = StandardSchemaWithJSON<
  z.input<TInput>,
  z.output<TInput>
>

/**
 * Keep the SDK's advertised JSON Schema while bounding validation diagnostics.
 * Zod's default issue text includes unknown input keys, which are caller-controlled
 * data and should not be reflected by the MCP transport.
 */
function boundedInputSchema<TInput extends z.ZodType>(
  schema: TInput,
): WorkforceInputSchema<TInput> {
  const standardSchema = schema as unknown as WorkforceInputSchema<TInput>
  const standard = standardSchema['~standard']
  const normalize = (
    result: StandardSchemaV1.Result<z.output<TInput>>,
  ): StandardSchemaV1.Result<z.output<TInput>> => (
    result.issues === undefined
      ? result
      : { issues: [{ message: 'MCP_INPUT_INVALID' }] }
  )

  return {
    '~standard': {
      ...standard,
      validate: (value, options) => {
        const result = standard.validate(value, options)
        return result instanceof Promise ? result.then(normalize) : normalize(result)
      },
    },
  }
}

function registerWorkforceTool(
  server: McpServer,
  tool: WorkforceToolDefinition,
  chatGptMetadata?: ChatGptMcpToolMetadata,
): void {
  server.registerTool(
    tool.id,
    {
      title: chatGptMetadata?.tool.title,
      description: chatGptMetadata?.tool.description ?? tool.description,
      inputSchema: boundedInputSchema(chatGptMetadata ? chatGptDevelopmentPlansInputSchema : tool.inputSchema),
      outputSchema: chatGptMetadata ? chatGptDevelopmentPlansOutputSchema : tool.outputSchema,
      annotations: chatGptMetadata?.tool.annotations ?? {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => {
      try {
        const internalOutput = await dispatchWorkforceTool(tool.id, input)
        const output = chatGptMetadata
          ? chatGptMetadata.projectResult(internalOutput)
          : internalOutput
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: asStructuredContent(output),
        }
      } catch (error) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: boundedToolError(error) }],
        }
      }
    },
  )
}

export function createWorkforceMcpServer(): McpServer {
  const server = createMcpServer(WORKFORCE_MCP_LOCAL_INSTRUCTIONS)
  for (const tool of WORKFORCE_TOOL_CATALOG) {
    const chatGptMetadata = CHATGPT_MCP_TOOL_METADATA.find((entry) => entry.workforceToolId === tool.id)
    registerWorkforceTool(server, tool, chatGptMetadata)
  }
  registerControlledActionTools(server)
  return server
}

function boundedControlledActionError(error: unknown): string {
  return error instanceof ControlledActionError ? error.code : 'CONTROLLED_ACTION_FAILED'
}

function registerControlledActionTools(server: McpServer): void {
  const prepareSchema = z.object({
    actionId: z.enum(['talent.development-goal.create', 'talent.goal-check-in.create']),
    payload: z.record(z.string(), z.unknown()),
    idempotencyKey: z.string().uuid(),
    locale: z.enum(['nl', 'en']).optional(),
  }).strict()
  const draftSchema = z.object({ draftId: z.string().uuid() }).strict()
  const transitionSchema = z.object({
    draftId: z.string().uuid(),
    expectedVersion: z.number().int().positive(),
    expectedPreviewHash: z.string().regex(/^[0-9a-f]{64}$/i),
  }).strict()
  const actionResultSchema = z.object({
    draft: z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid(),
      conversationId: z.string().uuid(),
      ownerUserId: z.string().uuid(),
      actionId: z.enum(['talent.development-goal.create', 'talent.goal-check-in.create']),
      actionType: z.enum(['TALENT_DEVELOPMENT_GOAL_CREATE', 'TALENT_GOAL_CHECK_IN_CREATE']),
      toolName: z.string(),
      payload: z.record(z.string(), z.unknown()),
      summary: z.string(),
      status: z.enum(['AWAITING_CONFIRMATION', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'CANCELLED']),
      idempotencyKey: z.string().uuid(),
      expiresAt: z.string().datetime({ offset: true }),
      confirmedAt: z.string().datetime({ offset: true }).nullable(),
      executedAt: z.string().datetime({ offset: true }).nullable(),
      failureCode: z.string().nullable(),
      version: z.number().int().positive(),
      controlPayload: z.record(z.string(), z.unknown()),
    }).strict(),
    preview: z.object({
      actionId: z.enum(['talent.development-goal.create', 'talent.goal-check-in.create']),
      summary: z.string(),
      subject: z.enum(['self', 'authorized-employee']),
      changes: z.record(z.string(), z.unknown()),
    }).strict().nullable(),
    readback: z.record(z.string(), z.unknown()).nullable(),
  }).strict()
  const actionResultOutputSchema = actionResultSchema as StandardSchemaWithJSON<
    z.input<typeof actionResultSchema>,
    z.output<typeof actionResultSchema>
  >

  server.registerTool('controlled_action_prepare', {
    title: 'Prepare controlled Talent action',
    description: 'Prepare one supported Talent action. Returns a server-authorized preview; this does not write HR data.',
    inputSchema: boundedInputSchema(prepareSchema),
    outputSchema: actionResultOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async (input) => {
    try {
      const context = await requireAuthContext()
      const conversationId = await getOrCreateLocalMcpConversation(context)
      const result = await controlledActions.prepare(context, {
        conversationId,
        actionId: input.actionId,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
        channel: 'LOCAL_MCP',
        locale: input.locale ?? await getLocale(),
      })
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result }
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: boundedControlledActionError(error) }] }
    }
  })

  server.registerTool('controlled_action_preview', {
    title: 'Preview controlled Talent action',
    description: 'Re-authorize and return the current preview for an owned action draft.',
    inputSchema: boundedInputSchema(draftSchema),
    outputSchema: actionResultOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ draftId }) => {
    try {
      const result = await controlledActions.preview(await requireAuthContext(), draftId)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result }
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: boundedControlledActionError(error) }] }
    }
  })

  server.registerTool('controlled_action_confirm', {
    title: 'Confirm controlled Talent action',
    description: 'Record explicit confirmation for the exact current preview. This does not execute the action.',
    inputSchema: boundedInputSchema(transitionSchema),
    outputSchema: actionResultOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async (input) => {
    try {
      const result = await controlledActions.confirm(await requireAuthContext(), input)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result }
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: boundedControlledActionError(error) }] }
    }
  })

  server.registerTool('controlled_action_cancel', {
    title: 'Cancel controlled Talent action',
    description: 'Cancel an owned action draft before its one-time execution claim.',
    inputSchema: boundedInputSchema(draftSchema),
    outputSchema: actionResultOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async ({ draftId }) => {
    try {
      const result = await controlledActions.cancel(await requireAuthContext(), draftId)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result }
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: boundedControlledActionError(error) }] }
    }
  })

  server.registerTool('controlled_action_execute', {
    title: 'Execute controlled Talent action',
    description: 'Execute a previously confirmed, current preview once, then return domain readback.',
    inputSchema: boundedInputSchema(transitionSchema),
    outputSchema: actionResultOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, async (input) => {
    try {
      const result = await controlledActions.execute(await requireAuthContext(), input)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result }
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: boundedControlledActionError(error) }] }
    }
  })

  server.registerTool('controlled_action_readback', {
    title: 'Read back controlled Talent action',
    description: 'Re-authorize and read the minimal resulting Talent record metadata.',
    inputSchema: boundedInputSchema(draftSchema),
    outputSchema: actionResultOutputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async ({ draftId }) => {
    try {
      const result = await controlledActions.readback(await requireAuthContext(), draftId)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result }
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: boundedControlledActionError(error) }] }
    }
  })
}

/**
 * Builds the single-tool profile approved for a future ChatGPT host. It is
 * intentionally not mounted by the local Inspector route or any public route.
 */
export function createChatGptMcpServer(): McpServer {
  const server = createMcpServer(CHATGPT_MCP_SERVER_INFO.instructions)
  for (const metadata of CHATGPT_MCP_TOOL_METADATA) {
    const tool = WORKFORCE_TOOL_CATALOG.find((entry) => entry.id === metadata.workforceToolId)
    if (!tool) throw new Error('CHATGPT_MCP_WORKFORCE_TOOL_NOT_FOUND')
    registerWorkforceTool(server, tool, metadata)
  }
  return server
}

function createMcpServer(instructions: string): McpServer {
  return new McpServer(
    {
      name: WORKFORCE_MCP_SERVER_NAME,
      version: WORKFORCE_MCP_SERVER_VERSION,
    },
    {
      instructions,
    },
  )
}

/**
 * Creates a stateless handler. A fresh McpServer is built for every request
 * so authentication and tenant context are resolved by the shared dispatcher
 * for that request only.
 */
export function createWorkforceMcpHandler(): McpHttpHandler {
  return createStatelessMcpHandler(createWorkforceMcpServer)
}

/** No route exposes this handler; it supports local protocol tests only. */
export function createChatGptMcpHandler(): McpHttpHandler {
  return createStatelessMcpHandler(createChatGptMcpServer)
}

function createStatelessMcpHandler(
  serverFactory: (context: McpRequestContext) => McpServer,
): McpHttpHandler {
  return createMcpHandler(serverFactory, {
    legacy: 'stateless',
    responseMode: 'json',
    maxRequestBodySize: 16_384,
    onerror: () => undefined,
  })
}
