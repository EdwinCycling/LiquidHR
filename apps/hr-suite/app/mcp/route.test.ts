import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DelegatedAuthError } from '@/lib/api-v1/auth/delegated'
import type { DelegatedWorkforceToolExecutionContext } from '@/lib/workforce-tools/contracts'
import { REMOTE_MCP_ALLOWED_HOST, REMOTE_MCP_RESOURCE_METADATA_URL, REMOTE_MCP_TEST_SUPABASE_URL, REMOTE_MCP_URL } from '@/lib/workforce-tools/mcp/remote-config'
import { GET, POST } from './route'

const routeMocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  dispatch: vi.fn(),
}))

vi.mock('@/lib/workforce-tools/mcp/remote-auth', () => ({
  authenticateRemoteMcpRequest: routeMocks.authenticate,
}))
vi.mock('@/lib/workforce-tools/mcp/remote-dispatch', () => ({
  dispatchRemoteMcpWorkforceTool: routeMocks.dispatch,
}))

function request(body: unknown, authorization?: string, host: string = REMOTE_MCP_ALLOWED_HOST): Request {
  return new Request(REMOTE_MCP_URL, {
    method: 'POST',
    headers: {
      host,
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('remote MCP route gates', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('LIQUIDHR_REMOTE_MCP_ENABLED', 'true')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', REMOTE_MCP_TEST_SUPABASE_URL)
    routeMocks.authenticate.mockReset()
    routeMocks.dispatch.mockReset()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('returns unavailable without contacting Auth when the flag or TEST binding fails', async () => {
    vi.stubEnv('LIQUIDHR_REMOTE_MCP_ENABLED', 'false')
    const disabled = await POST(request({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }))
    expect(disabled.status).toBe(404)
    expect(routeMocks.authenticate).not.toHaveBeenCalled()

    vi.stubEnv('LIQUIDHR_REMOTE_MCP_ENABLED', 'true')
    const wrongHost = await POST(request({ jsonrpc: '2.0', id: 2, method: 'initialize', params: {} }, undefined, 'other.vercel.app'))
    expect(wrongHost.status).toBe(404)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://other-project.supabase.co')
    const wrongProject = await POST(request({ jsonrpc: '2.0', id: 3, method: 'initialize', params: {} }))
    expect(wrongProject.status).toBe(404)
  })

  it('keeps OAuth discovery public even when ChatGPT sends a bearer and challenges unauthenticated calls', async () => {
    const list = await POST(request({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/list',
      params: {},
    }, 'Bearer malformed'))
    expect(list.status).toBe(200)
    expect(routeMocks.authenticate).not.toHaveBeenCalled()
    const listText = await list.text()
    const listPayloadText = listText.split('\n').find((line) => line.startsWith('data:'))?.slice('data:'.length).trim() ?? listText
    const listPayload: unknown = JSON.parse(listPayloadText)
    expect(JSON.stringify(listPayload)).toContain('securitySchemes')

    const call = await POST(request({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: { name: 'employee.talent.skills.read', arguments: {} },
    }))
    expect(call.status).toBe(200)
    const responseText = await call.text()
    const payloadText = responseText.split('\n').find((line) => line.startsWith('data:'))?.slice('data:'.length).trim() ?? responseText
    const body: unknown = JSON.parse(payloadText)
    expect(JSON.stringify(body)).toContain('mcp/www_authenticate')
    expect(JSON.stringify(body)).toContain(REMOTE_MCP_RESOURCE_METADATA_URL)
    expect(routeMocks.dispatch).not.toHaveBeenCalled()
  })

  it('records bounded transport diagnostics for GET probes without logging credentials', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const response = await GET(new Request(REMOTE_MCP_URL, {
      method: 'GET',
      headers: {
        host: REMOTE_MCP_ALLOWED_HOST,
        authorization: 'Bearer synthetic-secret-that-must-not-be-logged',
      },
    }))

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    const diagnostics = JSON.stringify(log.mock.calls)
    expect(diagnostics).toContain('[DEBUG-APIAI07-MCP-DISCOVERY-20261008]')
    expect(diagnostics).toContain('"requestMethod":"GET"')
    expect(diagnostics).toContain('"authorizationPresent":true')
    expect(diagnostics).toContain('"requestAcceptsJson":false')
    expect(diagnostics).toContain('"rpcResponseShape":"not-inspected"')
    expect(diagnostics).not.toContain('synthetic-secret-that-must-not-be-logged')
    log.mockRestore()
    expect(routeMocks.authenticate).not.toHaveBeenCalled()
    expect(routeMocks.dispatch).not.toHaveBeenCalled()
  })

  it('records only bounded response shape and Accept capabilities for public discovery', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const response = await POST(request({
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/list',
      params: {},
    }))

    expect(response.status).toBe(200)
    const diagnostics = JSON.stringify(log.mock.calls)
    expect(diagnostics).toContain('"rpcMethod":"tools/list"')
    expect(diagnostics).toContain('"requestAcceptsJson":true')
    expect(diagnostics).toContain('"requestAcceptsEventStream":true')
    expect(diagnostics).toContain('"rpcResponseShape":"result"')
    expect(diagnostics).toContain('"rpcErrorCode":null')
    expect(diagnostics).not.toContain('employee.talent.')
    expect(diagnostics).not.toContain('periodStart')
    log.mockRestore()
  })

  it('rejects malformed or invalid bearer tokens with a resource metadata challenge', async () => {
    routeMocks.authenticate.mockRejectedValueOnce(new DelegatedAuthError('MALFORMED_AUTHORIZATION'))
    const response = await POST(request({
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: { name: 'employee.talent.skills.read', arguments: {} },
    }, 'bearer malformed'))
    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toContain(`resource_metadata="${REMOTE_MCP_RESOURCE_METADATA_URL}"`)
    expect(response.headers.get('www-authenticate')).toContain('invalid_request')
    expect(routeMocks.dispatch).not.toHaveBeenCalled()
  })

  it('dispatches an authenticated Employee self-read through the request-bound execution context', async () => {
    const execution = {
      authContext: {
        tenantId: '00000000-0000-4000-8000-000000000010',
        hrGroupId: '00000000-0000-4000-8000-000000000011',
        administrationId: null,
        userId: '00000000-0000-4000-8000-000000000001',
        employeeId: '00000000-0000-4000-8000-000000000012',
        activeRoles: ['EMPLOYEE'],
        permissions: ['self:talent-goal:read'],
      },
      rls: {},
    } as unknown as DelegatedWorkforceToolExecutionContext
    routeMocks.authenticate.mockResolvedValueOnce({ clientId: 'synthetic-chatgpt-client', execution })
    routeMocks.dispatch.mockResolvedValueOnce({ plans: [] })

    const response = await POST(request({
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: { name: 'employee.talent.development-plans.read', arguments: {} },
    }, 'Bearer synthetic-test-access-token'))
    expect(response.status).toBe(200)
    const responseText = await response.text()
    const payloadText = responseText.split('\n').find((line) => line.startsWith('data:'))?.slice('data:'.length).trim() ?? responseText
    const payload: unknown = JSON.parse(payloadText)
    expect(JSON.stringify(payload)).toContain('"plans":[]')
    expect(routeMocks.dispatch).toHaveBeenCalledWith({
      toolId: 'employee.talent.development-plans.read',
      toolInput: {},
      oauthClientId: 'synthetic-chatgpt-client',
      execution,
    })
  })
})
