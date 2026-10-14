import { describe, expect, it } from 'vitest'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import {
  CHATGPT_FOCUS_OPEN_TOOL_ID,
  CHATGPT_FOCUS_PLANS_TOOL_ID,
  CHATGPT_FOCUS_RESOURCE_URI,
  registerChatGptFocusApp,
} from './focus-app'

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text()
  const payload = body.split('\n').find((line) => line.startsWith('data:'))?.slice('data:'.length).trim() ?? body
  return JSON.parse(payload) as Record<string, unknown>
}

describe('ChatGPT Focus MCP App registration', () => {
  it('registers the UI resource with a data-free entrypoint and an app-only reader', async () => {
    const errors: unknown[] = []
    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: 'focus-test', version: '1.0.0' }, { instructions: 'read-only' })
      server.registerTool('existing.read', {
        title: 'Existing read',
        description: 'Existing read tool',
        inputSchema: z.object({}).strict(),
      }, async () => ({ content: [] }))
      registerChatGptFocusApp(server, async () => ({ plans: [] }), true, 'nl')
      return server
    }, {
      legacy: 'stateless',
      responseMode: 'json',
      onerror: (error) => errors.push(error),
    })

    const listed = await handler.fetch(new Request('http://127.0.0.1:3010/api/internal/mcp', {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    }))
    const listedPayload = await readResponse(listed)
    const listedResult = listedPayload.result as { tools?: unknown[] }
    expect(listedResult.tools).toHaveLength(3)
    expect(listedResult.tools?.[0]).toMatchObject({ name: 'existing.read' })
    expect(listedResult.tools?.[1]).toMatchObject({
      name: CHATGPT_FOCUS_OPEN_TOOL_ID,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      _meta: {
        ui: { resourceUri: CHATGPT_FOCUS_RESOURCE_URI, visibility: ['model'] },
        'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] },
      },
    })
    expect(listedResult.tools?.[2]).toMatchObject({
      name: CHATGPT_FOCUS_PLANS_TOOL_ID,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { resourceUri: CHATGPT_FOCUS_RESOURCE_URI, visibility: ['app'] } },
    })

    const opened = await handler.fetch(new Request('http://127.0.0.1:3010/api/internal/mcp', {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: CHATGPT_FOCUS_OPEN_TOOL_ID, arguments: {} },
      }),
    }))
    const openedPayload = await readResponse(opened)
    expect(openedPayload.result).toMatchObject({
      content: [{ type: 'text', text: 'LiquidHR Focus is geopend. Kies één eigen ontwikkelplan om de toegestane statuscontext te delen.' }],
    })

    const response = await handler.fetch(new Request('http://127.0.0.1:3010/api/internal/mcp', {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/read',
        params: { uri: CHATGPT_FOCUS_RESOURCE_URI },
      }),
    }))
    const payload = await readResponse(response)

    expect(errors).toEqual([])
    expect(response.status, JSON.stringify(payload)).toBe(200)
    expect(payload.result).toMatchObject({
      contents: [{
        uri: CHATGPT_FOCUS_RESOURCE_URI,
        mimeType: 'text/html;profile=mcp-app',
        _meta: { ui: { csp: { connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] } } },
      }],
    })
    expect(JSON.stringify(payload.result)).toContain('LiquidHR Focus')
  })
})
