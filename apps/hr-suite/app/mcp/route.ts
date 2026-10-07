import { DelegatedAuthError } from '@/lib/api-v1/auth/delegated'
import { authenticateRemoteMcpRequest } from '@/lib/workforce-tools/mcp/remote-auth'
import { dispatchRemoteMcpWorkforceTool } from '@/lib/workforce-tools/mcp/remote-dispatch'
import {
  isRemoteMcpEnabled,
  isRemoteMcpRequestHostAllowed,
  REMOTE_MCP_RESOURCE_METADATA_URL,
} from '@/lib/workforce-tools/mcp/remote-config'
import { createRemoteChatGptMcpHandler } from '@/lib/workforce-tools/mcp-server'
import { RemoteMcpToolError } from '@/lib/workforce-tools/mcp/remote-errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable(): Response {
  return Response.json({ error: 'MCP_UNAVAILABLE' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
}

function authenticationRequired(error?: DelegatedAuthError): Response {
  const reason = !error || error.code === 'MISSING_AUTHORIZATION'
    ? ''
    : error.code === 'MALFORMED_AUTHORIZATION'
      ? ', error="invalid_request"'
      : ', error="invalid_token"'
  return Response.json(
    { error: 'MCP_AUTHENTICATION_REQUIRED' },
    {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
        'WWW-Authenticate': `Bearer resource_metadata="${REMOTE_MCP_RESOURCE_METADATA_URL}"${reason}`,
      },
    },
  )
}

function authFailure(error: DelegatedAuthError): Response {
  if (error.status === 401) return authenticationRequired(error)
  if (error.status === 409) {
    return Response.json({ error: 'MCP_CONTEXT_SELECTION_REQUIRED' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
  if (error.status === 403) {
    return Response.json({ error: 'MCP_ACCESS_DENIED' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
  }
  return Response.json({ error: 'MCP_AUTHENTICATION_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request): Promise<Response> {
  if (!isRemoteMcpEnabled() || !isRemoteMcpRequestHostAllowed(request)) return unavailable()

  const rpcRequest: unknown = await request.clone().json().catch(() => null)
  const rpcMethod = isRecord(rpcRequest) && typeof rpcRequest.method === 'string' ? rpcRequest.method : null
  const authorization = request.headers.get('authorization')

  let authenticated: Awaited<ReturnType<typeof authenticateRemoteMcpRequest>> | undefined
  if (authorization) {
    try {
      authenticated = await authenticateRemoteMcpRequest(request)
    } catch (error) {
      if (error instanceof DelegatedAuthError) return authFailure(error)
      return Response.json({ error: 'MCP_AUTHENTICATION_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
  } else if (!['initialize', 'notifications/initialized', 'tools/list', 'tools/call'].includes(rpcMethod ?? '')) {
    return authenticationRequired()
  }

  try {
    const handler = createRemoteChatGptMcpHandler(
      authenticated?.execution,
      authenticated ? (toolId, toolInput) => dispatchRemoteMcpWorkforceTool({
        toolId,
        toolInput,
        oauthClientId: authenticated.clientId,
        execution: authenticated.execution,
      }) : undefined,
    )
    return await handler.fetch(request)
  } catch (error) {
    const code = error instanceof RemoteMcpToolError ? error.code : 'MCP_REQUEST_FAILED'
    return Response.json({ error: code }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
