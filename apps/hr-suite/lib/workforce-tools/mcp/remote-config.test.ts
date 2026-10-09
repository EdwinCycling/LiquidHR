import { describe, expect, it } from 'vitest'
import {
  isRemoteMcpEnabled,
  isRemoteMcpRequestHostAllowed,
  REMOTE_MCP_ALLOWED_HOST,
  REMOTE_MCP_ENABLED_ENV,
  REMOTE_MCP_RESOURCE_METADATA_URL,
  REMOTE_MCP_URL,
  REMOTE_MCP_TEST_SUPABASE_URL,
} from './remote-config'

describe('remote MCP TEST configuration', () => {
  it('requires the explicit Production TEST flag and exact Supabase TEST URL', () => {
    expect(isRemoteMcpEnabled({
      NODE_ENV: 'production',
      VERCEL: '1',
      VERCEL_ENV: 'production',
      LIQUIDHR_REMOTE_MCP_ENABLED: 'true',
      NEXT_PUBLIC_SUPABASE_URL: REMOTE_MCP_TEST_SUPABASE_URL,
    })).toBe(true)
    expect(isRemoteMcpEnabled({
      NODE_ENV: 'production',
      VERCEL: '1',
      VERCEL_ENV: 'production',
      LIQUIDHR_REMOTE_MCP_ENABLED: 'true',
      NEXT_PUBLIC_SUPABASE_URL: 'https://other-project.supabase.co',
    })).toBe(false)
    expect(isRemoteMcpEnabled({
      NODE_ENV: 'production',
      VERCEL: '1',
      VERCEL_ENV: 'production',
      LIQUIDHR_REMOTE_MCP_ENABLED: 'false',
      NEXT_PUBLIC_SUPABASE_URL: REMOTE_MCP_TEST_SUPABASE_URL,
    })).toBe(false)
    expect(REMOTE_MCP_ENABLED_ENV).toBe('LIQUIDHR_REMOTE_MCP_ENABLED')
  })

  it('binds the resource and Host header to the existing shared TEST alias only', () => {
    expect(REMOTE_MCP_URL).toBe(`https://${REMOTE_MCP_ALLOWED_HOST}/mcp`)
    expect(REMOTE_MCP_RESOURCE_METADATA_URL).toBe(`https://${REMOTE_MCP_ALLOWED_HOST}/.well-known/oauth-protected-resource/mcp`)
    expect(isRemoteMcpRequestHostAllowed(new Request(REMOTE_MCP_URL, {
      headers: { host: REMOTE_MCP_ALLOWED_HOST },
    }))).toBe(true)
    expect(isRemoteMcpRequestHostAllowed(new Request('https://other.vercel.app/mcp', {
      headers: { host: 'other.vercel.app' },
    }))).toBe(false)
    expect(isRemoteMcpRequestHostAllowed(new Request(`https://${REMOTE_MCP_ALLOWED_HOST}:444/mcp`, {
      headers: { host: `${REMOTE_MCP_ALLOWED_HOST}:444` },
    }))).toBe(false)
  })
})
