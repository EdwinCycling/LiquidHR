import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mcpHandler, isWorkforceMcpEnabled, isLoopbackMcpRequest } = vi.hoisted(() => ({
  mcpHandler: { fetch: vi.fn() },
  isWorkforceMcpEnabled: vi.fn(),
  isLoopbackMcpRequest: vi.fn(),
}))

vi.mock('@/lib/workforce-tools/mcp-server', () => ({
  createWorkforceMcpHandler: () => mcpHandler,
  isWorkforceMcpEnabled,
  isLoopbackMcpRequest,
}))

import { GET, POST } from './route'

const REQUEST_ID = '01890f1e-7c70-7cc2-98c4-dc0c0c07398f'
const CORRELATION_ID = '01890f1e-7c70-7cc2-98c4-dc0c0c073999'

function request(url = 'http://127.0.0.1:3010/api/internal/mcp', headers: Record<string, string> = {}): Request {
  return new Request(url, {
    headers: {
      'x-request-id': REQUEST_ID,
      'x-correlation-id': CORRELATION_ID,
      ...headers,
    },
  })
}

describe('/api/internal/mcp', () => {
  beforeEach(() => {
    mcpHandler.fetch.mockReset()
    isWorkforceMcpEnabled.mockReset().mockReturnValue(true)
    isLoopbackMcpRequest.mockReset().mockReturnValue(true)
  })

  it('remains unavailable when the explicit local TEST gate is disabled', async () => {
    isWorkforceMcpEnabled.mockReturnValue(false)

    const response = await GET(request())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'MCP_UNAVAILABLE' })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID)
    expect(response.headers.get('x-correlation-id')).toBe(CORRELATION_ID)
    expect(mcpHandler.fetch).not.toHaveBeenCalled()
  })

  it('rejects non-loopback and cross-origin requests before invoking MCP', async () => {
    isLoopbackMcpRequest.mockReturnValue(false)
    const nonLoopback = await POST(request('http://192.0.2.10:3010/api/internal/mcp'))

    expect(nonLoopback.status).toBe(404)
    expect(mcpHandler.fetch).not.toHaveBeenCalled()

    isLoopbackMcpRequest.mockReturnValue(true)
    const crossOrigin = await POST(request(undefined, { origin: 'https://attacker.example' }))
    expect(crossOrigin.status).toBe(404)
    expect(mcpHandler.fetch).not.toHaveBeenCalled()
  })

  it('forwards an allowed local request and adds no-store correlation headers', async () => {
    mcpHandler.fetch.mockResolvedValue(new Response('{"jsonrpc":"2.0","id":1,"result":{}}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    const response = await POST(request(undefined, { origin: 'http://127.0.0.1:3010' }))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID)
    expect(response.headers.get('x-correlation-id')).toBe(CORRELATION_ID)
    expect(mcpHandler.fetch).toHaveBeenCalledOnce()
  })
})
