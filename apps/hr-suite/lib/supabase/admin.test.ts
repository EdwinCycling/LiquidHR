import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAdminRpcClient, createServiceRoleRpcFetch, getAdminCredentialMode } from './admin'

describe('isolated APIAI-07 admin RPC client', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends the server key only as apikey and strips authorization and cookies', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://wnpfloqpjvaacobppbpk.supabase.co')
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test-only-not-a-real-key')

    const requests: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const fetchImplementation: typeof fetch = async (input, init) => {
      requests.push({ input, init })
      return new Response(JSON.stringify({ registered: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    const client = createAdminRpcClient(fetchImplementation)

    const { data, error } = await client.rpc('register_apiai07_mcp_client', {
      requested_client_id: '00000000-0000-4000-8000-000000000001',
    })

    expect(error).toBeNull()
    expect(data).toEqual({ registered: true })
    expect(requests).toHaveLength(1)
    const headers = new Headers(requests[0]?.init?.headers)
    expect(headers.get('apikey')).toBe('sb_secret_test-only-not-a-real-key')
    expect(headers.has('authorization')).toBe(false)
    expect(headers.has('cookie')).toBe(false)
    expect(String(requests[0]?.input)).toContain('/rest/v1/rpc/register_apiai07_mcp_client')
  })

  it('strips inherited user authorization and cookies from a Request input', async () => {
    const receivedHeaders: Headers[] = []
    const fetchImplementation: typeof fetch = async (_input, init) => {
      receivedHeaders.push(new Headers(init?.headers))
      return new Response(null, { status: 204 })
    }
    const fetcher = createServiceRoleRpcFetch(fetchImplementation)
    const request = new Request('https://wnpfloqpjvaacobppbpk.supabase.co/rest/v1/rpc/register_apiai07_mcp_client', {
      headers: {
        apikey: 'sb_secret_test-only-not-a-real-key',
        authorization: 'Bearer synthetic-user-session',
        cookie: 'synthetic-session=ignored',
      },
    })

    await fetcher(request)

    expect(receivedHeaders[0]?.get('apikey')).toBe('sb_secret_test-only-not-a-real-key')
    expect(receivedHeaders[0]?.has('authorization')).toBe(false)
    expect(receivedHeaders[0]?.has('cookie')).toBe(false)
  })

  it('classifies modern secret keys, legacy service-role JWTs and unknown formats without returning values', () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test-only-not-a-real-key')
    expect(getAdminCredentialMode()).toBe('supabase-secret-key')

    vi.stubEnv('SUPABASE_SECRET_KEY', 'eyJhbGciOiJIUzI1NiJ9.payload.signature')
    expect(getAdminCredentialMode()).toBe('legacy-service-role-jwt')

    vi.stubEnv('SUPABASE_SECRET_KEY', 'unexpected-test-format')
    expect(getAdminCredentialMode()).toBe('unknown-key-format')
  })
})
