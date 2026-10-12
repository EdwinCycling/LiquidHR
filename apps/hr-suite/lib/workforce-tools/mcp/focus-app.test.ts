import { describe, expect, it } from 'vitest'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { registerChatGptFocusApp } from './focus-app'

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const body = await response.text()
  const payload = body.split('\n').find((line) => line.startsWith('data:'))?.slice('data:'.length).trim() ?? body
  return JSON.parse(payload) as Record<string, unknown>
}

describe('ChatGPT Focus MCP App registration', () => {
  it('registers a readable resource and app-only helper with valid MCP metadata', async () => {
    const errors: unknown[] = []
    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: 'focus-test', version: '1.0.0' }, { instructions: 'read-only' })
      registerChatGptFocusApp(server, async () => ({ plans: [] }), true, 'nl')
      return server
    }, {
      legacy: 'stateless',
      responseMode: 'json',
      onerror: (error) => errors.push(error),
    })

    const response = await handler.fetch(new Request('http://127.0.0.1:3010/api/internal/mcp', {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    }))
    const payload = await readResponse(response) as { result?: { tools?: unknown[] } }

    expect(errors).toEqual([])
    expect(response.status, JSON.stringify(payload)).toBe(200)
    expect(payload.result?.tools).toHaveLength(2)
  })
})
