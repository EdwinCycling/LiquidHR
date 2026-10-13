import { describe, expect, it } from 'vitest'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { CHATGPT_FOCUS_RESOURCE_URI, registerChatGptFocusAppResource } from './focus-app'

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text()
  const payload = body.split('\n').find((line) => line.startsWith('data:'))?.slice('data:'.length).trim() ?? body
  return JSON.parse(payload) as Record<string, unknown>
}

describe('ChatGPT Focus MCP App resource', () => {
  it('registers a readable UI resource without registering additional MCP tools', async () => {
    const errors: unknown[] = []
    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: 'focus-test', version: '1.0.0' }, { instructions: 'read-only' })
      server.registerTool('existing.read', {
        title: 'Existing read',
        description: 'Existing read tool',
        inputSchema: z.object({}).strict(),
      }, async () => ({ content: [] }))
      registerChatGptFocusAppResource(server, 'nl')
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
    expect(listedResult.tools).toHaveLength(1)
    expect(listedResult.tools?.[0]).toMatchObject({ name: 'existing.read' })

    const response = await handler.fetch(new Request('http://127.0.0.1:3010/api/internal/mcp', {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
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
