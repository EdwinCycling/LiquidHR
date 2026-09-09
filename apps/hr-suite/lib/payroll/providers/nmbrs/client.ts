import 'server-only'

import { z } from 'zod'
import { PayrollProviderError, type PayrollConnectionHealth, type PayrollProviderCompanyMetadata, type PayrollTokenSet } from '@/lib/payroll/providers/payroll-provider'

export const NMBRS_API_BASE_URL = 'https://api.nmbrsapp.com'
export const NMBRS_AUTHORIZATION_ENDPOINT = 'https://identityservice.nmbrs.com/connect/authorize'
export const NMBRS_TOKEN_ENDPOINT = 'https://identityservice.nmbrs.com/connect/token'
export const NMBRS_REVOCATION_ENDPOINT = 'https://identityservice.nmbrs.com/connect/revocation'
export const NMBRS_DEFAULT_REDIRECT_URI = 'https://liquid-hr-hr-suite.vercel.app/api/payroll/providers/nmbrs/callback'
export const NMBRS_P1_SCOPES = ['nmbrs', 'offline_access', 'company.info.read'] as const

const REQUEST_TIMEOUT_MS = 15_000
const MAX_COMPANY_PAGES = 20

type NmbrsConfig = {
  clientId: string
  clientSecret: string
  subscriptionKey: string
  secondarySubscriptionKey: string | null
  redirectUri: string
}

type NmbrsClientOptions = {
  fetcher?: typeof fetch
  now?: () => number
  config?: Partial<NmbrsConfig>
}

const scalarValue = z.union([z.string(), z.number()]).transform(String)
const optionalScalarValue = scalarValue.nullable().optional()
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).nullable().optional(),
  expires_in: z.coerce.number().int().positive(),
  scope: z.string().min(1).nullable().optional(),
}).passthrough()
const companySchema = z.object({
  companyId: scalarValue,
  number: optionalScalarValue,
  name: z.string().trim().min(1).max(240),
  debtorId: optionalScalarValue,
}).passthrough()
const companyPageSchema = z.object({
  data: z.array(companySchema),
  pageNumber: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  totalPages: z.coerce.number().int().positive().optional(),
  totalCount: z.coerce.number().int().nonnegative().optional(),
}).passthrough()

function configuredValue(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new PayrollProviderError(`NMBRS_CONFIGURATION_MISSING_${name}`, 500)
  return value.trim()
}

function configuredRedirectUri(value: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new PayrollProviderError('NMBRS_REDIRECT_URI_INVALID', 500)
  }
  if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new PayrollProviderError('NMBRS_REDIRECT_URI_INVALID', 500)
  return parsed.toString()
}

function config(overrides: Partial<NmbrsConfig> = {}): NmbrsConfig {
  return {
    clientId: overrides.clientId ?? configuredValue(process.env.NMBRS_CLIENT_ID, 'CLIENT_ID'),
    clientSecret: overrides.clientSecret ?? configuredValue(process.env.NMBRS_CLIENT_SECRET, 'CLIENT_SECRET'),
    subscriptionKey: overrides.subscriptionKey ?? configuredValue(process.env.NMBRS_SUBSCRIPTION_KEY, 'SUBSCRIPTION_KEY'),
    secondarySubscriptionKey: overrides.secondarySubscriptionKey === undefined
      ? process.env.NMBRS_SUBSCRIPTION_KEY_SECONDARY?.trim() || null
      : overrides.secondarySubscriptionKey,
    redirectUri: configuredRedirectUri(overrides.redirectUri ?? process.env.NMBRS_REDIRECT_URI ?? NMBRS_DEFAULT_REDIRECT_URI),
  }
}

function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined
}

function basicAuthorization(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown
  } catch {
    throw new PayrollProviderError('NMBRS_RESPONSE_INVALID', 502)
  }
}

export class NmbrsClient {
  private readonly fetcher: typeof fetch
  private readonly now: () => number
  private readonly configured: Partial<NmbrsConfig>

  constructor(options: NmbrsClientOptions = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch
    this.now = options.now ?? Date.now
    this.configured = options.config ?? {}
  }

  get redirectUri(): string {
    return config(this.configured).redirectUri
  }

  buildAuthorizationUrl(input: { state: string; redirectUri?: string }): string {
    const currentConfig = config(this.configured)
    const redirectUri = configuredRedirectUri(input.redirectUri ?? currentConfig.redirectUri)
    const url = new URL(NMBRS_AUTHORIZATION_ENDPOINT)
    url.searchParams.set('client_id', currentConfig.clientId)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', NMBRS_P1_SCOPES.join(' '))
    url.searchParams.set('state', input.state)
    return url.toString()
  }

  async exchangeAuthorizationCode(input: { code: string; redirectUri: string }): Promise<PayrollTokenSet> {
    const currentConfig = config(this.configured)
    return this.exchangeToken(new URL(NMBRS_TOKEN_ENDPOINT), new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: configuredRedirectUri(input.redirectUri),
    }), currentConfig)
  }

  async refreshCredentials(refreshToken: string): Promise<PayrollTokenSet> {
    if (!refreshToken.trim()) throw new PayrollProviderError('NMBRS_REFRESH_TOKEN_MISSING', 409)
    const currentConfig = config(this.configured)
    return this.exchangeToken(new URL(NMBRS_TOKEN_ENDPOINT), new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }), currentConfig)
  }

  async getConnectionHealth(accessToken: string): Promise<PayrollConnectionHealth> {
    await this.requestApi('/api/user/info?pageNumber=1&pageSize=100', accessToken)
    return { status: 'CONNECTED', resultCode: 'NMBRS_USER_INFO_OK', checkedAt: new Date(this.now()).toISOString() }
  }

  async listCompanies(accessToken: string): Promise<PayrollProviderCompanyMetadata[]> {
    const companies: PayrollProviderCompanyMetadata[] = []
    for (let pageNumber = 1; pageNumber <= MAX_COMPANY_PAGES; pageNumber += 1) {
      const body = await this.requestApi(`/api/companies?pageNumber=${pageNumber}&pageSize=100`, accessToken)
      const page = companyPageSchema.safeParse(body)
      if (!page.success) throw new PayrollProviderError('NMBRS_COMPANY_RESPONSE_INVALID', 502)
      companies.push(...page.data.data.map((company) => ({
        externalCompanyId: company.companyId,
        externalCompanyNumber: company.number ?? null,
        externalCompanyDisplayName: company.name,
        externalDebtorId: company.debtorId ?? null,
      })))
      const reachedTotalPages = page.data.totalPages !== undefined && pageNumber >= page.data.totalPages
      const reachedShortPage = page.data.data.length < (page.data.pageSize ?? 100)
      if (reachedTotalPages || reachedShortPage) return companies
    }
    throw new PayrollProviderError('NMBRS_COMPANY_PAGE_LIMIT', 502)
  }

  async revokeCredentials(input: { accessToken: string; refreshToken: string | null }): Promise<void> {
    const currentConfig = config(this.configured)
    const tokens = [
      { value: input.accessToken, hint: 'access_token' },
      ...(input.refreshToken ? [{ value: input.refreshToken, hint: 'refresh_token' }] : []),
    ]
    let failed = false
    for (const token of tokens) {
      try {
        await this.revokeToken(token.value, token.hint, currentConfig)
      } catch {
        failed = true
      }
    }
    if (failed) throw new PayrollProviderError('NMBRS_REVOCATION_FAILED', 502)
  }

  private async exchangeToken(url: URL, body: URLSearchParams, currentConfig: NmbrsConfig): Promise<PayrollTokenSet> {
    let response: Response
    try {
      response = await this.fetcher(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: basicAuthorization(currentConfig.clientId, currentConfig.clientSecret),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: timeoutSignal(),
      })
    } catch {
      throw new PayrollProviderError('NMBRS_TOKEN_ENDPOINT_UNAVAILABLE', 502)
    }
    if (!response.ok) throw new PayrollProviderError('NMBRS_TOKEN_EXCHANGE_FAILED', response.status === 401 ? 401 : 502)
    const parsed = tokenResponseSchema.safeParse(await responseJson(response))
    if (!parsed.success) throw new PayrollProviderError('NMBRS_TOKEN_RESPONSE_INVALID', 502)
    return {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token ?? null,
      expiresAt: new Date(this.now() + parsed.data.expires_in * 1000).toISOString(),
      scope: parsed.data.scope ?? null,
    }
  }

  private async requestApi(path: string, accessToken: string): Promise<unknown> {
    const currentConfig = config(this.configured)
    const primary = await this.requestApiWithKey(path, accessToken, currentConfig.subscriptionKey)
    if (primary.response.status === 401 && currentConfig.secondarySubscriptionKey) {
      const secondary = await this.requestApiWithKey(path, accessToken, currentConfig.secondarySubscriptionKey)
      return this.finishApiResponse(secondary.response, secondary.body)
    }
    return this.finishApiResponse(primary.response, primary.body)
  }

  private async requestApiWithKey(path: string, accessToken: string, subscriptionKey: string): Promise<{ response: Response; body: unknown }> {
    let response: Response
    try {
      response = await this.fetcher(new URL(path, NMBRS_API_BASE_URL), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Subscription-Key': subscriptionKey,
        },
        signal: timeoutSignal(),
      })
    } catch {
      throw new PayrollProviderError('NMBRS_API_UNAVAILABLE', 502)
    }
    let body: unknown = null
    if (response.status !== 204) body = await responseJson(response)
    return { response, body }
  }

  private finishApiResponse(response: Response, body: unknown): unknown {
    if (!response.ok) {
      if (response.status === 401) throw new PayrollProviderError('NMBRS_UNAUTHORIZED', 401)
      if (response.status === 403) throw new PayrollProviderError('NMBRS_FORBIDDEN', 403)
      throw new PayrollProviderError('NMBRS_API_REQUEST_FAILED', response.status >= 500 ? 502 : 422)
    }
    if (!isRecord(body) && !Array.isArray(body)) throw new PayrollProviderError('NMBRS_RESPONSE_INVALID', 502)
    return body
  }

  private async revokeToken(token: string, hint: string, currentConfig: NmbrsConfig): Promise<void> {
    let response: Response
    try {
      response = await this.fetcher(new URL(NMBRS_REVOCATION_ENDPOINT), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: basicAuthorization(currentConfig.clientId, currentConfig.clientSecret),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token, token_type_hint: hint }).toString(),
        signal: timeoutSignal(),
      })
    } catch {
      throw new PayrollProviderError('NMBRS_REVOCATION_UNAVAILABLE', 502)
    }
    if (!response.ok) throw new PayrollProviderError('NMBRS_REVOCATION_FAILED', 502)
  }
}

export function isNmbrsUnauthorized(error: unknown): boolean {
  return error instanceof PayrollProviderError && error.code === 'NMBRS_UNAUTHORIZED'
}

export function createNmbrsClient(options?: NmbrsClientOptions): NmbrsClient {
  return new NmbrsClient(options)
}
