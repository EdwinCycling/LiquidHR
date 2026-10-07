export const REMOTE_MCP_TEST_SUPABASE_URL = 'https://wnpfloqpjvaacobppbpk.supabase.co' as const
export const REMOTE_MCP_TEST_ISSUER = `${REMOTE_MCP_TEST_SUPABASE_URL}/auth/v1` as const
export const REMOTE_MCP_TEST_AUDIENCE = 'authenticated' as const
export const REMOTE_MCP_ALLOWED_HOST = 'liquid-hr-hr-suite.vercel.app' as const
export const REMOTE_MCP_URL = `https://${REMOTE_MCP_ALLOWED_HOST}/mcp` as const
export const REMOTE_MCP_RESOURCE_METADATA_URL = `https://${REMOTE_MCP_ALLOWED_HOST}/.well-known/oauth-protected-resource/mcp` as const
export const REMOTE_MCP_ENABLED_ENV = 'LIQUIDHR_REMOTE_MCP_ENABLED' as const

type RemoteMcpEnvironment = {
  readonly NODE_ENV?: string
  readonly VERCEL?: string
  readonly VERCEL_ENV?: string
  readonly LIQUIDHR_REMOTE_MCP_ENABLED?: string
  readonly NEXT_PUBLIC_SUPABASE_URL?: string
}

export function isRemoteMcpEnabled(environment: RemoteMcpEnvironment = process.env): boolean {
  return environment.NODE_ENV?.trim().toLowerCase() === 'production'
    && environment.VERCEL?.trim() === '1'
    && environment.VERCEL_ENV?.trim().toLowerCase() === 'production'
    && environment.LIQUIDHR_REMOTE_MCP_ENABLED?.trim().toLowerCase() === 'true'
    && environment.NEXT_PUBLIC_SUPABASE_URL?.trim() === REMOTE_MCP_TEST_SUPABASE_URL
}

export function isRemoteMcpRequestHostAllowed(request: Request): boolean {
  try {
    const url = new URL(request.url)
    const host = request.headers.get('host')?.trim().toLowerCase()
    return url.protocol === 'https:'
      && url.hostname.toLowerCase() === REMOTE_MCP_ALLOWED_HOST
      && !url.port
      && host === REMOTE_MCP_ALLOWED_HOST
  } catch {
    return false
  }
}
