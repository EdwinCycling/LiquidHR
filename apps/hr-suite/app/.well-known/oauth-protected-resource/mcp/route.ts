import {
  isRemoteMcpEnabled,
  isRemoteMcpRequestHostAllowed,
  REMOTE_MCP_TEST_ISSUER,
  REMOTE_MCP_URL,
} from '@/lib/workforce-tools/mcp/remote-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(request: Request): Response {
  if (!isRemoteMcpEnabled() || !isRemoteMcpRequestHostAllowed(request)) {
    return Response.json({ error: 'MCP_UNAVAILABLE' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  return Response.json({
    resource: REMOTE_MCP_URL,
    authorization_servers: [REMOTE_MCP_TEST_ISSUER],
    bearer_methods_supported: ['header'],
    scopes_supported: ['openid'],
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
    },
  })
}
