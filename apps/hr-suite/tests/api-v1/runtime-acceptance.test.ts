import { describe, expect, it } from 'vitest'

const API_V1_PATHS = [
  '/api/v1/workforce/summary',
  '/api/v1/team-skills',
  '/api/v1/development-plans',
] as const

function localAcceptanceBaseUrl(): URL | null {
  if (process.env.LIQUIDHR_API_V1_ACCEPTANCE !== 'true') return null

  const configured = process.env.LIQUIDHR_ACCEPTANCE_BASE_URL?.trim()
  if (!configured) {
    throw new Error('Local APIAI-01 acceptance requires LIQUIDHR_ACCEPTANCE_BASE_URL when explicitly enabled.')
  }

  let parsed: URL
  try {
    parsed = new URL(configured)
  } catch {
    throw new Error('Local APIAI-01 acceptance requires an HTTP loopback URL on an explicit port >= 3000.')
  }

  const loopbackHost = parsed.hostname === '127.0.0.1'
    || parsed.hostname === 'localhost'
    || parsed.hostname === '[::1]'
  const port = Number(parsed.port)
  if (
    parsed.protocol !== 'http:'
    || !loopbackHost
    || !Number.isInteger(port)
    || port < 3000
    || parsed.username !== ''
    || parsed.password !== ''
  ) {
    throw new Error('Local APIAI-01 acceptance requires an HTTP loopback URL on an explicit port >= 3000.')
  }

  return new URL(`${parsed.origin}/`)
}

const baseUrl = localAcceptanceBaseUrl()

async function get(pathname: string): Promise<Response> {
  if (!baseUrl) throw new Error('Local APIAI-01 acceptance runtime is not configured.')
  return fetch(new URL(pathname, baseUrl), { redirect: 'manual' })
}

const localRuntime = baseUrl !== null
const acceptanceSuite = localRuntime ? describe : describe.skip

/**
 * These are real HTTP probes against the explicitly configured local runtime.
 * The suite stays skipped without that opt-in so an ordinary unit-test run can
 * never be mistaken for runtime acceptance. No credentials or bearer tokens
 * are read by this file.
 */
acceptanceSuite('APIAI-01 local HTTP acceptance boundary', () => {
  it('serves the normal login surface', async () => {
    const response = await get('/login')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')?.toLowerCase()).toContain('text/html')

    const body = await response.text()
    expect(body).toContain('name="email"')
    expect(body).toContain('name="password"')
    expect(body).toContain('Google')
  })

  it('redirects an unauthenticated dashboard request to login', async () => {
    const response = await get('/dashboard/start')

    expect([301, 302, 303, 307, 308]).toContain(response.status)
    const location = response.headers.get('location')
    expect(location).not.toBeNull()
    const runtimeBaseUrl = baseUrl
    if (!runtimeBaseUrl) throw new Error('Local APIAI-01 acceptance runtime is not configured.')
    expect(new URL(location!, runtimeBaseUrl).pathname).toBe('/login')
  })

  it.each(API_V1_PATHS)('does not expose %s without a bearer token', async (pathname) => {
    const response = await get(pathname)

    // A route that is not mounted yet is intentionally 404. Once mounted, the
    // same unauthenticated probe must fail closed with 401.
    expect([401, 404]).toContain(response.status)
    if (response.status === 401) {
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
      expect(response.headers.get('x-correlation-id')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    }
  })
})
