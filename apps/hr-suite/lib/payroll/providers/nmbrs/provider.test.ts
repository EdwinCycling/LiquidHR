import { afterEach, describe, expect, it, vi } from 'vitest'
import { nmbrsPayrollProvider } from './provider'
import { NmbrsClient } from './client'

const clientConfig = {
  clientId: 'fixture-client-id',
  clientSecret: 'fixture-client-secret',
  subscriptionKey: 'fixture-subscription-key',
  secondarySubscriptionKey: null,
  redirectUri: 'https://example.test/callback',
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('Nmbrs Payroll adapter P1 boundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses the provider-neutral P1 capability boundary and official OAuth scopes', async () => {
    vi.stubEnv('NMBRS_CLIENT_ID', 'fixture-client-id')
    vi.stubEnv('NMBRS_CLIENT_SECRET', 'fixture-client-secret')
    vi.stubEnv('NMBRS_SUBSCRIPTION_KEY', 'fixture-subscription-key')
    expect(nmbrsPayrollProvider.code).toBe('NMBRS')
    expect(nmbrsPayrollProvider.capabilities).toEqual(['AUTH_OAUTH', 'COMPANY_DISCOVERY', 'CONNECTION_HEALTH'])
    const result = await nmbrsPayrollProvider.createAuthorizationRequest?.({ redirectUri: 'https://example.test/callback', state: 'state-value' })
    expect(result?.authorizationUrl).toContain('https://identityservice.nmbrs.com/connect/authorize')
    const url = new URL(result?.authorizationUrl ?? '')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe('offline_access company.info.read')
    expect(url.searchParams.get('audience')).toBeNull()
    expect(url.searchParams.get('resource')).toBeNull()
    expect(url.searchParams.get('code_challenge')).toBeNull()
    expect(url.searchParams.get('code_challenge_method')).toBeNull()
  })

  it('discovers only company metadata through the official endpoint', async () => {
    vi.stubEnv('NMBRS_CLIENT_ID', 'fixture-client-id')
    vi.stubEnv('NMBRS_CLIENT_SECRET', 'fixture-client-secret')
    vi.stubEnv('NMBRS_SUBSCRIPTION_KEY', 'fixture-subscription-key')
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ pageNumber: 1, pageSize: 100, totalPages: 1, data: [{ companyId: 'company-1', number: '1001', name: 'Demo BV', debtorId: 'debtor-1' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    const companies = await nmbrsPayrollProvider.listCompanies?.({ accessToken: 'access-token' })
    expect(companies).toEqual([{ externalCompanyId: 'company-1', externalCompanyNumber: '1001', externalCompanyDisplayName: 'Demo BV', externalDebtorId: 'debtor-1' }])
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ href: 'https://api.nmbrsapp.com/api/companies?pageNumber=1&pageSize=100' }), expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/json', Authorization: 'Bearer access-token', 'X-Subscription-Key': 'fixture-subscription-key' }) }))
  })

  it('exchanges authorization codes and rotates refresh credentials server-side', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 900, scope: 'offline_access company.info.read' }))
      .mockResolvedValueOnce(response({ access_token: 'access-2', refresh_token: 'refresh-2', expires_in: 900, scope: 'offline_access company.info.read' }))
    const client = new NmbrsClient({ config: clientConfig, fetcher, now: () => 1_700_000_000_000 })

    const exchanged = await client.exchangeAuthorizationCode({ code: 'authorization-code', redirectUri: clientConfig.redirectUri })
    const refreshed = await client.refreshCredentials('refresh-1')

    expect(exchanged).toMatchObject({ accessToken: 'access-1', refreshToken: 'refresh-1', scope: 'offline_access company.info.read' })
    expect(refreshed).toMatchObject({ accessToken: 'access-2', refreshToken: 'refresh-2' })
    expect(fetcher).toHaveBeenCalledTimes(2)
    const exchangeInit = fetcher.mock.calls[0]?.[1]
    const exchangeHeaders = new Headers(exchangeInit?.headers)
    const exchangeBody = new URLSearchParams(String(exchangeInit?.body))
    expect(exchangeHeaders.get('Authorization')).toBe(`Basic ${Buffer.from('fixture-client-id:fixture-client-secret').toString('base64')}`)
    expect(exchangeBody.get('grant_type')).toBe('authorization_code')
    expect(exchangeBody.get('code')).toBe('authorization-code')
    const refreshBody = new URLSearchParams(String(fetcher.mock.calls[1]?.[1]?.body))
    expect(refreshBody.get('grant_type')).toBe('refresh_token')
    expect(refreshBody.get('refresh_token')).toBe('refresh-1')
  })

  it('paginates company metadata without calling employee or employment endpoints', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ pageNumber: 1, pageSize: 1, totalPages: 2, data: [{ companyId: 'company-1', name: 'Demo BV' }] }))
      .mockResolvedValueOnce(response({ pageNumber: 2, pageSize: 1, totalPages: 2, data: [{ companyId: 'company-2', name: 'Other BV' }] }))
    const client = new NmbrsClient({ config: clientConfig, fetcher })

    const companies = await client.listCompanies('access-token')

    expect(companies.map((company) => company.externalCompanyId)).toEqual(['company-1', 'company-2'])
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      'https://api.nmbrsapp.com/api/companies?pageNumber=1&pageSize=100',
      'https://api.nmbrsapp.com/api/companies?pageNumber=2&pageSize=100',
    ])
    expect(fetcher.mock.calls.every(([input]) => !String(input).includes('/employees') && !String(input).includes('/employments'))).toBe(true)
  })

  it('uses the secondary subscription key only after a primary 401', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ error: 'unauthorized' }, 401))
      .mockResolvedValueOnce(response({ data: [] }))
    const client = new NmbrsClient({ config: { ...clientConfig, secondarySubscriptionKey: 'fixture-secondary-key' }, fetcher })

    const health = await client.getConnectionHealth('access-token')

    expect(health.status).toBe('CONNECTED')
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('X-Subscription-Key')).toBe('fixture-subscription-key')
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('X-Subscription-Key')).toBe('fixture-secondary-key')
  })

  it('maps unauthorized and forbidden provider responses to safe error codes', async () => {
    const unauthorized = new NmbrsClient({ config: clientConfig, fetcher: vi.fn<typeof fetch>().mockResolvedValue(response({ error: 'unauthorized' }, 401)) })
    await expect(unauthorized.getConnectionHealth('access-token')).rejects.toMatchObject({ code: 'NMBRS_UNAUTHORIZED', status: 401 })

    const forbidden = new NmbrsClient({ config: clientConfig, fetcher: vi.fn<typeof fetch>().mockResolvedValue(response({ error: 'forbidden' }, 403)) })
    await expect(forbidden.getConnectionHealth('access-token')).rejects.toMatchObject({ code: 'NMBRS_FORBIDDEN', status: 403 })
  })

  it('revokes access and refresh credentials using confidential client authentication', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({}, 200))
    const client = new NmbrsClient({ config: clientConfig, fetcher })

    await client.revokeCredentials({ accessToken: 'access-token', refreshToken: 'refresh-token' })

    expect(fetcher).toHaveBeenCalledTimes(2)
    for (const [, init] of fetcher.mock.calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Basic ${Buffer.from('fixture-client-id:fixture-client-secret').toString('base64')}`)
    }
    expect(new URLSearchParams(String(fetcher.mock.calls[0]?.[1]?.body)).get('token_type_hint')).toBe('access_token')
    expect(new URLSearchParams(String(fetcher.mock.calls[1]?.[1]?.body)).get('token_type_hint')).toBe('refresh_token')
  })
})
