import { beforeEach, describe, expect, it, vi } from 'vitest'

const mcpActionMocks = vi.hoisted(() => ({
  dispatchWorkforceTool: vi.fn(),
  requireAuthContext: vi.fn(),
  getOrCreateLocalMcpConversation: vi.fn(),
  prepare: vi.fn(),
  preview: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  execute: vi.fn(),
  readback: vi.fn(),
}))

vi.mock('./registry', async (importOriginal) => {
  const original = await importOriginal<typeof import('./registry')>()
  return { ...original, dispatchWorkforceTool: mcpActionMocks.dispatchWorkforceTool }
})
vi.mock('@/lib/auth/permissions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/auth/permissions')>()
  return { ...original, requireAuthContext: mcpActionMocks.requireAuthContext }
})
vi.mock('@/lib/controlled-actions/service', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/controlled-actions/service')>()
  return {
    ...original,
    controlledActions: {
      ...original.controlledActions,
      prepare: mcpActionMocks.prepare,
      preview: mcpActionMocks.preview,
      confirm: mcpActionMocks.confirm,
      cancel: mcpActionMocks.cancel,
      execute: mcpActionMocks.execute,
      readback: mcpActionMocks.readback,
    },
    getOrCreateLocalMcpConversation: mcpActionMocks.getOrCreateLocalMcpConversation,
  }
})

import {
  createChatGptMcpHandler,
  createRemoteChatGptMcpHandler,
  createWorkforceMcpHandler,
  createWorkforceMcpServer,
  isLoopbackMcpRequest,
  isWorkforceMcpEnabled,
  WORKFORCE_MCP_SERVER_NAME,
  WORKFORCE_MCP_SERVER_VERSION,
  WORKFORCE_MCP_LOCAL_INSTRUCTIONS,
} from './mcp-server'
import { WORKFORCE_TOOL_CATALOG } from './catalog'
import { WorkforceToolDispatchError } from './registry'
import {
  CHATGPT_MCP_SERVER_INFO,
  CHATGPT_MCP_TOOLS,
} from './mcp/chatgpt-metadata'

const ENDPOINT = 'http://127.0.0.1:3010/api/internal/mcp'

function rpcRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text()
  const payload = body.split('\n').find((line) => line.startsWith('data:'))?.slice('data:'.length).trim() ?? body
  return JSON.parse(payload) as Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

describe('local Workforce MCP server', () => {
  beforeEach(() => {
    mcpActionMocks.dispatchWorkforceTool.mockReset()
    mcpActionMocks.requireAuthContext.mockReset()
    mcpActionMocks.getOrCreateLocalMcpConversation.mockReset()
    mcpActionMocks.prepare.mockReset()
    mcpActionMocks.preview.mockReset()
    mcpActionMocks.confirm.mockReset()
    mcpActionMocks.cancel.mockReset()
    mcpActionMocks.execute.mockReset()
    mcpActionMocks.readback.mockReset()
  })

  it('is explicitly opt-in and rejects production or Vercel environments', () => {
    expect(isWorkforceMcpEnabled({ NODE_ENV: 'development', LIQUIDHR_INTERNAL_MCP_ENABLED: 'true' })).toBe(true)
    expect(isWorkforceMcpEnabled({ NODE_ENV: 'test', LIQUIDHR_INTERNAL_MCP_ENABLED: 'true' })).toBe(true)
    expect(isWorkforceMcpEnabled({ NODE_ENV: 'development' })).toBe(false)
    expect(isWorkforceMcpEnabled({ NODE_ENV: 'production', LIQUIDHR_INTERNAL_MCP_ENABLED: 'true' })).toBe(false)
    expect(isWorkforceMcpEnabled({ NODE_ENV: 'development', LIQUIDHR_INTERNAL_MCP_ENABLED: 'true', VERCEL: '1' })).toBe(false)
  })

  it('accepts only loopback HTTP requests and rejects cross-origin requests at the route boundary', () => {
    expect(isLoopbackMcpRequest(new Request(ENDPOINT, { headers: { host: '127.0.0.1:3010' } }))).toBe(true)
    expect(isLoopbackMcpRequest(new Request('http://localhost:3010/api/internal/mcp', { headers: { host: 'localhost:3010' } }))).toBe(true)
    expect(isLoopbackMcpRequest(new Request('http://[::1]:3010/api/internal/mcp', { headers: { host: '[::1]:3010' } }))).toBe(true)
    expect(isLoopbackMcpRequest(new Request('https://127.0.0.1:3010/api/internal/mcp'))).toBe(false)
    expect(isLoopbackMcpRequest(new Request('http://192.0.2.10:3010/api/internal/mcp'))).toBe(false)
    for (const malformedHost of [
      '127.0.0.1/evil',
      '127.0.0.1\\\\evil',
      'localhost?x',
      '127.0.0.1#fragment',
      '127.0.0.1@attacker.example',
      '127.0.0.1,attacker.example',
      '127.0.0.1:65536',
    ]) {
      expect(isLoopbackMcpRequest(new Request(ENDPOINT, { headers: { host: malformedHost } }))).toBe(false)
    }
  })

  it('registers the read-only Workforce catalog and separate local controlled-action tools', () => {
    const server = createWorkforceMcpServer()
    expect(server).toBeDefined()
    expect(WORKFORCE_TOOL_CATALOG.length).toBeGreaterThan(1)
    expect(WORKFORCE_MCP_SERVER_NAME).toBe(CHATGPT_MCP_SERVER_INFO.name)
    expect(WORKFORCE_MCP_SERVER_VERSION).toBe(CHATGPT_MCP_SERVER_INFO.version)
  })

  it('serves MCP initialize and tools/list through the official Streamable HTTP handler', async () => {
    const handler = createWorkforceMcpHandler()
    const response = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'liquidhr-contract-test', version: '1.0.0' },
      },
    }))

    expect(response.status).toBe(200)
    const payload = await readResponse(response)
    expect(payload.result).toMatchObject({
      serverInfo: { name: WORKFORCE_MCP_SERVER_NAME, version: WORKFORCE_MCP_SERVER_VERSION },
      instructions: WORKFORCE_MCP_LOCAL_INSTRUCTIONS,
    })

    const listResponse = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }))
    expect(listResponse.status).toBe(200)
    const listPayload = await readResponse(listResponse)
    const listResult = listPayload.result
    expect(listResult).toBeDefined()
    if (!isRecord(listResult)) {
      throw new Error('MCP tools/list returned a non-object result')
    }

    const listedTools = listResult.tools
    expect(Array.isArray(listedTools)).toBe(true)
    if (!Array.isArray(listedTools)) throw new Error('MCP tools/list returned no tools')
    expect(listedTools).toHaveLength(WORKFORCE_TOOL_CATALOG.length + 6)
    expect(listedTools.map((tool) => (tool as Record<string, unknown>).name)).toEqual(expect.arrayContaining([
      'controlled_action_prepare',
      'controlled_action_preview',
      'controlled_action_confirm',
      'controlled_action_cancel',
      'controlled_action_execute',
      'controlled_action_readback',
    ]))

    const skillsTool = listedTools.find((tool): tool is Record<string, unknown> => (
      typeof tool === 'object'
      && tool !== null
      && !Array.isArray(tool)
      && tool.name === 'employee.talent.skills.read'
    ))
    expect(skillsTool).toMatchObject({
      name: 'employee.talent.skills.read',
      inputSchema: expect.objectContaining({ type: 'object' }),
      outputSchema: expect.objectContaining({ type: 'object' }),
    })
  })

  it('executes local MCP prepare and cancel calls through the shared controlled-action service', async () => {
    const context = {
      tenantId: 'tenant-1',
      administrationId: null,
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['EMPLOYEE'],
      permissions: ['self:talent-goal:write'],
    }
    mcpActionMocks.requireAuthContext.mockResolvedValue(context)
    mcpActionMocks.getOrCreateLocalMcpConversation.mockResolvedValue('10000000-0000-4000-8000-000000000004')
    const draftResult = {
      draft: {
        id: '10000000-0000-4000-8000-000000000007',
        tenantId: '10000000-0000-4000-8000-000000000001',
        conversationId: '10000000-0000-4000-8000-000000000004',
        ownerUserId: '10000000-0000-4000-8000-000000000002',
        actionId: 'talent.development-goal.create',
        actionType: 'TALENT_DEVELOPMENT_GOAL_CREATE',
        toolName: 'draft_talent_development_goal',
        payload: { title: 'Klantgesprekken verbeteren', periodStart: '2026-10-01' },
        summary: 'Controleer en bevestig het ontwikkeldoel.',
        status: 'AWAITING_CONFIRMATION',
        idempotencyKey: '10000000-0000-4000-8000-000000000005',
        expiresAt: '2026-10-06T10:15:00.000Z',
        confirmedAt: null,
        executedAt: null,
        failureCode: null,
        version: 1,
        controlPayload: {},
      },
      preview: {
        actionId: 'talent.development-goal.create',
        summary: 'Controleer en bevestig het ontwikkeldoel.',
        subject: 'self',
        changes: { title: 'Klantgesprekken verbeteren' },
      },
      readback: null,
    }
    mcpActionMocks.prepare.mockResolvedValue(draftResult)
    mcpActionMocks.cancel.mockResolvedValue({ ...draftResult, draft: { ...draftResult.draft, status: 'CANCELLED', version: 2 }, preview: null })
    const handler = createWorkforceMcpHandler()

    const preparedResponse = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 20,
      method: 'tools/call',
      params: {
        name: 'controlled_action_prepare',
        arguments: {
          actionId: 'talent.development-goal.create',
          payload: { title: 'Klantgesprekken verbeteren', periodStart: '2026-10-01' },
          idempotencyKey: '10000000-0000-4000-8000-000000000005',
          locale: 'nl',
        },
      },
    }))
    const preparedPayload = await readResponse(preparedResponse)
    expect(preparedPayload.result).toMatchObject({ structuredContent: draftResult })
    expect(mcpActionMocks.prepare).toHaveBeenCalledWith(context, {
      conversationId: '10000000-0000-4000-8000-000000000004',
      actionId: 'talent.development-goal.create',
      payload: { title: 'Klantgesprekken verbeteren', periodStart: '2026-10-01' },
      idempotencyKey: '10000000-0000-4000-8000-000000000005',
      channel: 'LOCAL_MCP',
      locale: 'nl',
    })

    const cancelledResponse = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 21,
      method: 'tools/call',
      params: { name: 'controlled_action_cancel', arguments: { draftId: '10000000-0000-4000-8000-000000000007' } },
    }))
    expect((await readResponse(cancelledResponse)).result).toMatchObject({
      structuredContent: { draft: { id: '10000000-0000-4000-8000-000000000007', status: 'CANCELLED', version: 2 } },
    })
    expect(mcpActionMocks.cancel).toHaveBeenCalledWith(context, '10000000-0000-4000-8000-000000000007')
  })

  it('rejects client-supplied tenant, HR-group, and administration fields before controlled-action authorization', async () => {
    const handler = createWorkforceMcpHandler()
    const response = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 22,
      method: 'tools/call',
      params: {
        name: 'controlled_action_prepare',
        arguments: {
          actionId: 'talent.development-goal.create',
          payload: { title: 'Klantgesprekken verbeteren', periodStart: '2026-10-01' },
          idempotencyKey: '10000000-0000-4000-8000-000000000005',
          tenantId: '10000000-0000-4000-8000-000000000001',
          hrGroupId: '10000000-0000-4000-8000-000000000006',
          administrationId: '10000000-0000-4000-8000-000000000007',
        },
      },
    }))

    const payload = await readResponse(response)
    expect(payload.result).toMatchObject({ isError: true })
    expect(JSON.stringify(payload)).toContain('MCP_INPUT_INVALID')
    expect(JSON.stringify(payload)).not.toContain('10000000-0000-4000-8000-000000000007')
    expect(mcpActionMocks.requireAuthContext).not.toHaveBeenCalled()
    expect(mcpActionMocks.prepare).not.toHaveBeenCalled()
  })

  it('serves the ChatGPT profile with one approved tool and projects its output', async () => {
    const handler = createChatGptMcpHandler()
    const initializeResponse = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'liquidhr-chatgpt-contract-test', version: '1.0.0' },
      },
    }))
    const initializePayload = await readResponse(initializeResponse)
    expect(initializePayload.result).toMatchObject({
      instructions: CHATGPT_MCP_SERVER_INFO.instructions,
    })

    const listResponse = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    }))
    const listPayload = await readResponse(listResponse)
    const listResult = listPayload.result
    expect(isRecord(listResult)).toBe(true)
    if (!isRecord(listResult) || !Array.isArray(listResult.tools)) {
      throw new Error('ChatGPT MCP tools/list returned no tools')
    }
    expect(listResult.tools).toHaveLength(4)
    expect(listResult.tools.map((tool) => (tool as Record<string, unknown>).name)).toEqual([
      'employee.talent.development-plans.read',
      'employee.talent.development-gaps.read',
      'employee.talent.skills.read',
      'employee.talent.competencies.read',
    ])
    expect(listResult.tools[0]).toMatchObject({
      name: CHATGPT_MCP_TOOLS[0]?.name,
      description: CHATGPT_MCP_TOOLS[0]?.description,
      inputSchema: CHATGPT_MCP_TOOLS[0]?.inputSchema,
      outputSchema: CHATGPT_MCP_TOOLS[0]?.outputSchema,
    })
    expect(JSON.stringify(listResult.tools)).not.toContain('manager.talent.team-capability-matrix.read')
    expect(JSON.stringify(listResult.tools)).not.toContain('hr.talent.tenant-capability-matrix.read')

    mcpActionMocks.dispatchWorkforceTool.mockResolvedValue({
      plans: [{
        goalId: '00000000-0000-0000-0000-000000000001',
        title: 'Private development plan',
        capability: 'Private capability',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
        progressPercent: 40,
        status: 'ACTIVE',
        sourceType: 'SELF_ENTERED',
        completedAt: null,
        archivedAt: null,
      }],
    })
    const callResponse = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: CHATGPT_MCP_TOOLS[0]?.name, arguments: {} },
    }))
    const callPayload = await readResponse(callResponse)
    expect(callPayload.result).toMatchObject({
      structuredContent: {
        plans: [{
          periodStart: '2026-01-01',
          periodEnd: '2026-12-31',
          progressPercent: 40,
          status: 'ACTIVE',
          completedAt: null,
        }],
      },
    })
    expect(JSON.stringify(callPayload)).not.toContain('00000000-0000-0000-0000-000000000001')
    expect(JSON.stringify(callPayload)).not.toContain('Private development plan')
    expect(JSON.stringify(callPayload)).not.toContain('Private capability')
    expect(mcpActionMocks.dispatchWorkforceTool).toHaveBeenCalledWith('employee.talent.development-plans.read', {}, undefined)
  })

  it('exposes OAuth tool metadata and challenges unauthenticated remote calls without dispatch', async () => {
    const handler = createRemoteChatGptMcpHandler()
    const listed = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/list',
      params: {},
    }))
    const listedPayload = await readResponse(listed)
    const listedResult = listedPayload.result
    expect(isRecord(listedResult) && Array.isArray(listedResult.tools)).toBe(true)
    if (!isRecord(listedResult) || !Array.isArray(listedResult.tools)) throw new Error('Remote tools/list returned no tools')
    expect(listedResult.tools).toHaveLength(4)
    for (const tool of listedResult.tools) {
      expect(tool).toMatchObject({ securitySchemes: [{ type: 'oauth2', scopes: ['openid'] }] })
    }

    const unauthenticated = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: { name: 'employee.talent.development-plans.read', arguments: {} },
    }))
    const unauthorizedPayload = await readResponse(unauthenticated)
    expect(unauthorizedPayload.result).toMatchObject({
      isError: true,
      _meta: { 'mcp/www_authenticate': [expect.stringContaining('resource_metadata=')] },
    })
    expect(JSON.stringify(unauthorizedPayload)).toContain('insufficient_scope')
    expect(mcpActionMocks.dispatchWorkforceTool).not.toHaveBeenCalled()
  })

  it('calls a catalog tool through the shared dispatcher and returns bounded errors', async () => {
    const handler = createWorkforceMcpHandler()
    const toolId = 'employee.talent.skills.read'
    mcpActionMocks.dispatchWorkforceTool.mockResolvedValue({ skills: [] })

    const response = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: toolId, arguments: {} },
    }))

    expect(response.status).toBe(200)
    const payload = await readResponse(response)
    expect(payload.result).toMatchObject({ structuredContent: { skills: [] } })
    expect(mcpActionMocks.dispatchWorkforceTool).toHaveBeenCalledWith(toolId, {}, undefined)

    mcpActionMocks.dispatchWorkforceTool.mockRejectedValue(new Error('private database detail'))
    const failure = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: toolId, arguments: {} },
    }))
    const failurePayload = await readResponse(failure)
    expect(failurePayload.result).toMatchObject({ isError: true, content: [{ text: 'MCP_TOOL_EXECUTION_FAILED' }] })
    expect(JSON.stringify(failurePayload)).not.toContain('private database detail')
  })

  it('keeps unknown tools, permission failures and module failures bounded', async () => {
    const handler = createWorkforceMcpHandler()

    const unknown = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'workforce.unknown.read', arguments: {} },
    }))
    const unknownPayload = await readResponse(unknown)
    expect(unknownPayload.error).toBeDefined()
    expect(JSON.stringify(unknownPayload)).not.toContain('tenant')

    mcpActionMocks.dispatchWorkforceTool.mockRejectedValueOnce(new WorkforceToolDispatchError('ACCESS_DENIED'))
    const denied = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'employee.talent.skills.read', arguments: {} },
    }))
    expect((await readResponse(denied)).result).toMatchObject({
      isError: true,
      content: [{ text: 'ACCESS_DENIED' }],
    })

    mcpActionMocks.dispatchWorkforceTool.mockRejectedValueOnce(new WorkforceToolDispatchError('MODULE_INACTIVE'))
    const inactive = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'employee.talent.skills.read', arguments: {} },
    }))
    expect((await readResponse(inactive)).result).toMatchObject({
      isError: true,
      content: [{ text: 'MODULE_INACTIVE' }],
    })
  })

  it('preserves shared context-selection errors as a bounded MCP tool error', async () => {
    const handler = createWorkforceMcpHandler()
    mcpActionMocks.dispatchWorkforceTool.mockRejectedValueOnce(new WorkforceToolDispatchError('CONTEXT_SELECTION_REQUIRED'))

    const response = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'employee.talent.skills.read', arguments: {} },
    }))

    expect((await readResponse(response)).result).toMatchObject({
      isError: true,
      content: [{ text: 'CONTEXT_SELECTION_REQUIRED' }],
    })
  })

  it('rejects malformed arguments and oversized bodies before dispatch', async () => {
    const handler = createWorkforceMcpHandler()
    const malformed = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'employee.talent.skills.read', arguments: { employeeId: 'caller-selected' } },
    }))
    const malformedPayload = await readResponse(malformed)
    expect(malformedPayload.result).toMatchObject({
      isError: true,
      content: [{ text: expect.stringContaining('MCP_INPUT_INVALID') }],
    })
    expect(JSON.stringify(malformedPayload)).not.toContain('caller-selected')
    expect(mcpActionMocks.dispatchWorkforceTool).not.toHaveBeenCalled()

    const oversized = await handler.fetch(rpcRequest({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'employee.talent.skills.read', arguments: { value: 'x'.repeat(20_000) } },
    }))
    expect(oversized.status).toBe(413)
    expect(mcpActionMocks.dispatchWorkforceTool).not.toHaveBeenCalled()
  })
})
