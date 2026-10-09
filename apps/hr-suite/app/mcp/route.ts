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
  const publicDiscoveryMethod = ['initialize', 'notifications/initialized', 'tools/list'].includes(rpcMethod ?? '')

  let authenticated: Awaited<ReturnType<typeof authenticateRemoteMcpRequest>> | undefined
  if (authorization && !publicDiscoveryMethod) {
    try {
      authenticated = await authenticateRemoteMcpRequest(request)
    } catch (error) {
      if (error instanceof DelegatedAuthError) {
        return reportMcpDiagnostic(request, rpcMethod, authFailure(error))
      }
      return reportMcpDiagnostic(
        request,
        rpcMethod,
        Response.json({ error: 'MCP_AUTHENTICATION_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }),
      )
    }
  } else if (!authorization && !['initialize', 'notifications/initialized', 'tools/list', 'tools/call'].includes(rpcMethod ?? '')) {
    return reportMcpDiagnostic(request, rpcMethod, authenticationRequired())
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
    return reportMcpDiagnostic(request, rpcMethod, await handler.fetch(request))
  } catch (error) {
    const code = error instanceof RemoteMcpToolError ? error.code : 'MCP_REQUEST_FAILED'
    return reportMcpDiagnostic(
      request,
      rpcMethod,
      Response.json({ error: code }, { status: 503, headers: { 'Cache-Control': 'no-store' } }),
    )
  }
}

/** Temporary, allowlisted MCP transport diagnostics; never record request values or credentials. */
export async function GET(request: Request): Promise<Response> {
  if (!isRemoteMcpEnabled() || !isRemoteMcpRequestHostAllowed(request)) return unavailable()
  return reportMcpDiagnostic(
    request,
    null,
    Response.json(
      { error: 'MCP_METHOD_NOT_SUPPORTED' },
      { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } },
    ),
  )
}

const SAFE_MCP_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'tools/list',
  'tools/call',
  'prompts/list',
  'prompts/get',
  'resources/list',
  'resources/read',
  'resources/templates/list',
  'ping',
])

async function reportMcpDiagnostic(request: Request, rpcMethod: string | null, response: Response): Promise<Response> {
  const protocolVersion = request.headers.get('mcp-protocol-version')
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.toLowerCase()
  const acceptHeader = request.headers.get('accept')?.toLowerCase() ?? ''
  const responseShape = await getDiscoveryResponseShape(response, rpcMethod)
  console.info('[DEBUG-APIAI07-MCP-DISCOVERY-20261008]', {
    requestMethod: request.method,
    rpcMethod: rpcMethod && SAFE_MCP_METHODS.has(rpcMethod) ? rpcMethod : 'other',
    requestAcceptsJson: acceptsMediaType(acceptHeader, 'application/json'),
    requestAcceptsEventStream: acceptsMediaType(acceptHeader, 'text/event-stream'),
    protocolVersion: protocolVersion && /^\d{4}-\d{2}-\d{2}$/.test(protocolVersion) ? protocolVersion : 'absent-or-other',
    authorizationPresent: request.headers.has('authorization'),
    responseStatus: response.status,
    responseContentType: contentType === 'application/json' || contentType === 'text/event-stream' ? contentType : 'other',
    ...responseShape,
  })
  return response
}

function acceptsMediaType(acceptHeader: string, mediaType: string): boolean {
  return acceptHeader.split(',').some((value) => value.split(';', 1)[0]?.trim() === mediaType)
}

async function getDiscoveryResponseShape(
  response: Response,
  rpcMethod: string | null,
): Promise<{ rpcResponseShape: 'result' | 'error' | 'unparseable-or-empty' | 'not-inspected'; rpcErrorCode: number | null }> {
  if (!['initialize', 'tools/list', 'prompts/list', 'resources/list'].includes(rpcMethod ?? '')) {
    return { rpcResponseShape: 'not-inspected', rpcErrorCode: null }
  }

  try {
    const responseText = await response.clone().text()
    const dataLine = responseText.split(/\r?\n/).find((line) => line.startsWith('data:'))
    const payloadText = dataLine ? dataLine.slice('data:'.length).trim() : responseText
    const payload: unknown = JSON.parse(payloadText)
    if (!isRecord(payload) || payload.jsonrpc !== '2.0') {
      return { rpcResponseShape: 'unparseable-or-empty', rpcErrorCode: null }
    }
    if (isRecord(payload.error) && typeof payload.error.code === 'number' && Number.isInteger(payload.error.code)) {
      return { rpcResponseShape: 'error', rpcErrorCode: payload.error.code }
    }
    if (isRecord(payload.result)) return { rpcResponseShape: 'result', rpcErrorCode: null }
  } catch {
    // Diagnostic parsing is best-effort and never affects the MCP response.
  }
  return { rpcResponseShape: 'unparseable-or-empty', rpcErrorCode: null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
