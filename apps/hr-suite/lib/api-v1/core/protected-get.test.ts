import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { AuthContext } from '@/lib/auth/permissions'
import { DelegatedAuthError, type DelegatedRequestAuthentication } from '@/lib/api-v1/auth'
import type { ApiReadAuditInput, ApiReadAuditWriter } from '@/lib/api-v1/security/audit'
import type { ApiRateLimitDecision, AtomicApiRateLimiter } from '@/lib/api-v1/security/rate-limit'
import { createProtectedApiGetHandler } from './protected-get'

const tenantId = '11111111-1111-4111-8111-111111111111'
const hrGroupId = '22222222-2222-4222-8222-222222222222'
const administrationId = '33333333-3333-4333-8333-333333333333'
const requestId = '44444444-4444-4444-8444-444444444444'
const correlationId = '55555555-5555-4555-8555-555555555555'

const authContext: AuthContext = {
  tenantId,
  hrGroupId,
  administrationId,
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: ['EMPLOYEE'],
  permissions: ['self:talent-goal:read'],
}

const authentication: DelegatedRequestAuthentication = {
  verifiedToken: {
    issuer: 'https://issuer.synthetic.invalid',
    subject: 'subject-1',
    audience: 'liquid-hr-api',
    expiresAtEpochSeconds: 2_000_000_000,
    revocation: 'active',
    scopes: ['development-plans.self.read'],
    clientId: 'synthetic-client',
  },
  account: { userId: authContext.userId },
  authContext,
}

function setup(input?: {
  readonly tokenScopes?: readonly string[]
  readonly permissions?: readonly string[]
  readonly employeeId?: string | null
  readonly rateLimit?: ApiRateLimitDecision
  readonly rateLimitError?: Error
  readonly auditError?: Error
  readonly readError?: Error
  readonly authenticateError?: Error
  readonly project?: (data: { readonly id: string; readonly title: string; readonly progressPercent: number }) => unknown
}) {
  const auditCalls: ApiReadAuditInput[] = []
  const events: string[] = []
  const currentAuthentication: DelegatedRequestAuthentication = {
    ...authentication,
    verifiedToken: {
      ...authentication.verifiedToken,
      scopes: input?.tokenScopes ?? authentication.verifiedToken.scopes,
    },
    authContext: {
      ...authContext,
      permissions: [...(input?.permissions ?? authContext.permissions)],
      employeeId: input?.employeeId === undefined ? authContext.employeeId : input.employeeId,
    },
  }
  const authenticate = vi.fn(async (): Promise<DelegatedRequestAuthentication> => {
    events.push('authenticate')
    if (input?.authenticateError) throw input.authenticateError
    return currentAuthentication
  })
  const rateLimiter: AtomicApiRateLimiter = {
    consume: vi.fn(async (): Promise<ApiRateLimitDecision> => {
      events.push('limit')
      if (input?.rateLimitError) throw input.rateLimitError
      return input?.rateLimit ?? { allowed: true, remaining: 4 }
    }),
  }
  const auditWriter: ApiReadAuditWriter = {
    record: vi.fn(async (value: ApiReadAuditInput): Promise<void> => {
      events.push(`audit:${value.outcome}`)
      auditCalls.push(value)
      if (input?.auditError) throw input.auditError
    }),
  }
  const read = vi.fn(async () => {
    events.push('read')
    if (input?.readError) throw input.readError
    return { id: 'internal-id', title: 'private title', progressPercent: 40 }
  })
  const handler = createProtectedApiGetHandler({
    resource: 'development-plans',
    requiredApiScopes: ['development-plans.self.read'],
    requiredLiquidHrPermission: 'self:talent-goal:read',
    selfOnly: true,
    read,
    project: input?.project ?? ((data) => ({ progressPercent: data.progressPercent })),
    responseSchema: z.object({
      progressPercent: z.number().int().min(0).max(100),
    }).strict(),
  }, { authenticate, rateLimiter, auditWriter })

  return { handler, authenticate, rateLimiter, auditWriter, auditCalls, read, events }
}

describe('createProtectedApiGetHandler', () => {
  it('requires GET and rejects all query parameters before authentication', async () => {
    const nonGet = setup()
    const methodResponse = await nonGet.handler(new Request('https://liquid.example/api/v1/development-plans', {
      method: 'POST',
      headers: { 'X-Request-Id': requestId, 'X-Correlation-Id': correlationId },
    }))

    expect(methodResponse.status).toBe(405)
    expect(methodResponse.headers.get('allow')).toBe('GET')
    expect(methodResponse.headers.get('cache-control')).toBe('no-store')
    expect(nonGet.authenticate).not.toHaveBeenCalled()

    const withQuery = setup()
    const queryResponse = await withQuery.handler(new Request('https://liquid.example/api/v1/development-plans?employeeId=forged'))
    expect(queryResponse.status).toBe(400)
    expect(queryResponse.headers.get('cache-control')).toBe('no-store')
    expect(withQuery.authenticate).not.toHaveBeenCalled()
  })

  it('authorizes both scope systems, limits, projects, audits, then responds', async () => {
    const { handler, rateLimiter, auditWriter, auditCalls, read, events } = setup()
    const response = await handler(new Request('https://liquid.example/api/v1/development-plans', {
      headers: { 'X-Request-Id': requestId, 'X-Correlation-Id': correlationId },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-request-id')).toBe(requestId)
    expect(response.headers.get('x-correlation-id')).toBe(correlationId)
    await expect(response.json()).resolves.toEqual({
      data: { progressPercent: 40 },
      requestId,
    })
    expect(rateLimiter.consume).toHaveBeenCalledWith({
      tenantId,
      hrGroupId,
      resource: 'development-plans',
      oauthClientId: 'synthetic-client',
    })
    expect(auditCalls).toEqual([expect.objectContaining({
      tenantId,
      hrGroupId,
      administrationId,
      resource: 'development-plans',
      oauthClientId: 'synthetic-client',
      correlationId,
      outcome: 'ALLOWED',
      statusCode: 200,
    })])
    expect(read).toHaveBeenCalledTimes(1)
    expect(events).toEqual(['authenticate', 'limit', 'read', 'audit:ALLOWED'])
    expect(auditWriter.record).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['external scope is missing', { tokenScopes: [] }],
    ['LiquidHR permission is missing', { permissions: [] }],
    ['self employee context is missing', { employeeId: null }],
    ['self employee context is blank', { employeeId: '   ' }],
  ] as const)('audits and denies when %s', async (_label, options) => {
    const { handler, rateLimiter, auditCalls, read } = setup(options)
    const response = await handler(new Request('https://liquid.example/api/v1/development-plans'))

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(auditCalls[0]).toMatchObject({ outcome: 'DENIED', statusCode: 403, resource: 'development-plans' })
    expect(rateLimiter.consume).not.toHaveBeenCalled()
    expect(read).not.toHaveBeenCalled()
  })

  it('audits rate limiting and returns bounded Retry-After without reading data', async () => {
    const { handler, auditCalls, read } = setup({ rateLimit: { allowed: false, remaining: 0, retryAfterSeconds: 1200 } })
    const response = await handler(new Request('https://liquid.example/api/v1/development-plans'))

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('900')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(auditCalls[0]).toMatchObject({ outcome: 'RATE_LIMITED', statusCode: 429 })
    expect(read).not.toHaveBeenCalled()
  })

  it('fails closed when the limiter is unavailable', async () => {
    const { handler, auditWriter, read } = setup({ rateLimitError: new Error('database detail') })
    const response = await handler(new Request('https://liquid.example/api/v1/development-plans'))
    const body = await response.text()

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).not.toContain('database detail')
    expect(auditWriter.record).not.toHaveBeenCalled()
    expect(read).not.toHaveBeenCalled()
  })

  it('does not return HR data if its read audit cannot be recorded', async () => {
    const { handler, auditWriter, read } = setup({ auditError: new Error('audit storage details') })
    const response = await handler(new Request('https://liquid.example/api/v1/development-plans'))
    const body = await response.text()

    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).not.toContain('private title')
    expect(body).not.toContain('audit storage details')
    expect(read).toHaveBeenCalledTimes(1)
    expect(auditWriter.record).toHaveBeenCalledTimes(1)
  })

  it('rejects projectors that try to return fields outside the strict runtime schema', async () => {
    const { handler, auditWriter } = setup({ project: (data) => data })
    const response = await handler(new Request('https://liquid.example/api/v1/development-plans'))
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).not.toContain('internal-id')
    expect(body).not.toContain('private title')
    expect(auditWriter.record).not.toHaveBeenCalled()
  })

  it('returns only a redacted error when authentication fails', async () => {
    const { handler, auditWriter, read } = setup({ authenticateError: new Error('invalid token details') })
    const response = await handler(new Request('https://liquid.example/api/v1/development-plans'))
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).not.toContain('invalid token details')
    expect(auditWriter.record).not.toHaveBeenCalled()
    expect(read).not.toHaveBeenCalled()
  })

  it('returns 401 for a typed delegated authentication failure', async () => {
    const { handler, auditWriter } = setup({
      authenticateError: new DelegatedAuthError('INVALID_ACCESS_TOKEN'),
    })
    const response = await handler(new Request('https://liquid.example/api/v1/development-plans'))
    expect(response.status).toBe(401)
    expect(auditWriter.record).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [413, 'REQUEST_TOO_LARGE'],
    [429, 'RATE_LIMITED'],
    [503, 'SERVICE_UNAVAILABLE'],
    [500, 'INTERNAL_ERROR'],
  ] as const)('maps an internal service status %s to a safe external error', async (status, expectedCode) => {
    const serviceError = Object.assign(new Error('internal service detail'), { status, code: 'INTERNAL_ONLY' })
    const { handler } = setup({ readError: serviceError })
    const response = await handler(new Request('https://liquid.example/api/v1/development-plans'))
    const body = await response.text()

    expect(response.status).toBe(status)
    expect(body).toContain(`"code":"${expectedCode}"`)
    expect(body).not.toContain('internal service detail')
    expect(body).not.toContain('INTERNAL_ONLY')
  })
})
