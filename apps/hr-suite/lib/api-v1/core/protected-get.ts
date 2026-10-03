import type { AuthContext } from '@/lib/auth/permissions'
import {
  DelegatedAuthError,
  type DelegatedRequestAuthentication,
} from '@/lib/api-v1/auth'
import {
  ApiError,
  type ApiErrorCode,
  apiErrorResponse,
} from './errors'
import { apiJsonResponse } from './responses'
import { createApiRequestContext } from './request-context'
import {
  ApiReadAuditConfigurationError,
  ApiReadAuditUnavailableError,
  type ApiReadAuditWriter,
} from '@/lib/api-v1/security/audit'
import {
  ApiRateLimitConfigurationError,
  ApiRateLimitUnavailableError,
  type ApiRateLimitResource,
  type AtomicApiRateLimiter,
} from '@/lib/api-v1/security/rate-limit'
import { apiRateLimitedResponse } from '@/lib/api-v1/security/rate-limit-response'

export interface ApiReadScope {
  readonly tenantId: string
  readonly hrGroupId: string
  readonly administrationId: string | null
  readonly oauthClientId: string
  readonly authContext: AuthContext
}

export interface ApiRuntimeResponseSchema {
  parse(value: unknown): unknown
}

export interface ProtectedApiGetDefinition<T> {
  readonly resource: ApiRateLimitResource
  readonly requiredApiScopes: readonly string[]
  readonly requiredLiquidHrPermission: string
  readonly selfOnly?: boolean
  /**
   * Deze callback moet lezen via een databaseclient die als gedelegeerde
   * gebruiker is geauthenticeerd en onder de actuele LiquidHR-RLS valt.
   * Cookieclients en service-roleclients zijn hiervoor niet toegestaan.
   */
  readonly read: (scope: ApiReadScope) => Promise<T>
  /** Geef alleen goedgekeurde externe velden terug; stuur nooit een service-DTO door. */
  readonly project: (data: T) => unknown
  /** Een strikt runtime-schema voorkomt dat een projector extra interne velden publiceert. */
  readonly responseSchema: ApiRuntimeResponseSchema
}

export interface ProtectedApiGetDependencies {
  readonly authenticate: (request: Request) => Promise<DelegatedRequestAuthentication>
  readonly rateLimiter: AtomicApiRateLimiter
  readonly auditWriter: ApiReadAuditWriter
}

const PERMISSION_PATTERN = /^(?:self:)?[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/
const SCOPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,127}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertDefinition<T>(definition: ProtectedApiGetDefinition<T>): void {
  if (!PERMISSION_PATTERN.test(definition.requiredLiquidHrPermission)
    || definition.requiredApiScopes.length === 0
    || definition.requiredApiScopes.some((scope) => !SCOPE_PATTERN.test(scope))) {
    throw new TypeError('De autorisatieconfiguratie voor API GET is ongeldig.')
  }
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

function apiErrorForServiceStatus(status: unknown): ApiError | null {
  if (!Number.isInteger(status)) return null

  const codesByStatus: Readonly<Record<number, ApiErrorCode>> = {
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    413: 'REQUEST_TOO_LARGE',
    429: 'RATE_LIMITED',
    503: 'SERVICE_UNAVAILABLE',
  }
  const code = codesByStatus[status as number]
  return code ? new ApiError(code) : null
}

function serviceStatus(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) return undefined
  try {
    return 'status' in error ? (error as { readonly status?: unknown }).status : undefined
  } catch {
    return undefined
  }
}

function toSafeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof DelegatedAuthError) {
    return apiErrorForServiceStatus(error.status) ?? new ApiError('INTERNAL_ERROR')
  }
  if (error instanceof ApiRateLimitUnavailableError || error instanceof ApiReadAuditUnavailableError) {
    return new ApiError('SERVICE_UNAVAILABLE')
  }
  return apiErrorForServiceStatus(serviceStatus(error)) ?? new ApiError('INTERNAL_ERROR')
}

function scopeFromAuthentication(authentication: DelegatedRequestAuthentication): ApiReadScope {
  const authContext = authentication.authContext
  if (authentication.account.userId !== authContext.userId) throw new DelegatedAuthError('AUTH_CONTEXT_MISMATCH')
  const hrGroupId = authContext.hrGroupId
  if (!isUuid(authContext.tenantId) || !hrGroupId || !isUuid(hrGroupId)) {
    throw new ApiError('INTERNAL_ERROR')
  }

  return {
    tenantId: authContext.tenantId,
    hrGroupId,
    administrationId: authContext.administrationId,
    oauthClientId: authentication.verifiedToken.clientId,
    authContext,
  }
}

async function recordAudit(
  dependencies: ProtectedApiGetDependencies,
  resource: ApiRateLimitResource,
  scope: ApiReadScope,
  correlationId: string,
  outcome: 'ALLOWED' | 'DENIED' | 'RATE_LIMITED',
  statusCode: 200 | 403 | 429,
): Promise<void> {
  try {
    await dependencies.auditWriter.record({
      tenantId: scope.tenantId,
      hrGroupId: scope.hrGroupId,
      administrationId: scope.administrationId,
      resource,
      oauthClientId: scope.oauthClientId,
      correlationId,
      outcome,
      statusCode,
    })
  } catch (error) {
    if (error instanceof ApiReadAuditConfigurationError) throw error
    throw new ApiReadAuditUnavailableError()
  }
}

/**
 * Maakt een herbruikbare GET-handler die nog niet aan een route hangt. Een
 * concrete route vereist een goedgekeurde provider-authenticator en een
 * bearer-gebonden RLS-reader. Queryparameters worden geweigerd zodat de
 * aanroeper de scope niet kan verbreden.
 */
export function createProtectedApiGetHandler<T>(
  definition: ProtectedApiGetDefinition<T>,
  dependencies: ProtectedApiGetDependencies,
): (request: Request) => Promise<Response> {
  assertDefinition(definition)

  return async function protectedApiGet(request: Request): Promise<Response> {
    const requestContext = createApiRequestContext(request)
    if (request.method !== 'GET') {
      return apiErrorResponse(new ApiError('METHOD_NOT_ALLOWED'), {
        context: requestContext,
        headers: { Allow: 'GET' },
      })
    }

    if (new URL(request.url).search !== '') {
      return apiErrorResponse(new ApiError('INVALID_REQUEST'), { context: requestContext })
    }

    let scope: ApiReadScope | null = null
    try {
      const authentication = await dependencies.authenticate(request)
      scope = scopeFromAuthentication(authentication)
      const tokenScopes = new Set(authentication.verifiedToken.scopes)
      const hasApiScopes = definition.requiredApiScopes.every((requiredScope) => tokenScopes.has(requiredScope))
      const hasLiquidHrPermission = scope.authContext.permissions.includes(definition.requiredLiquidHrPermission)
      const employeeId = scope.authContext.employeeId
      const hasSelfContext = definition.selfOnly !== true
        || (typeof employeeId === 'string' && employeeId.trim().length > 0)

      if (!hasApiScopes || !hasLiquidHrPermission || !hasSelfContext) {
        await recordAudit(dependencies, definition.resource, scope, requestContext.correlationId, 'DENIED', 403)
        return apiErrorResponse(new ApiError('FORBIDDEN'), { context: requestContext })
      }

      let limit: Awaited<ReturnType<AtomicApiRateLimiter['consume']>>
      try {
        limit = await dependencies.rateLimiter.consume({
          tenantId: scope.tenantId,
          hrGroupId: scope.hrGroupId,
          resource: definition.resource,
          oauthClientId: scope.oauthClientId,
        })
      } catch (error) {
        if (error instanceof ApiRateLimitConfigurationError) throw error
        throw new ApiRateLimitUnavailableError()
      }
      if (!limit.allowed) {
        await recordAudit(dependencies, definition.resource, scope, requestContext.correlationId, 'RATE_LIMITED', 429)
        return apiRateLimitedResponse(requestContext, limit.retryAfterSeconds ?? 1)
      }

      const data = await definition.read(scope)
      const projected = definition.project(data)
      const validatedProjection = definition.responseSchema.parse(projected)
      await recordAudit(dependencies, definition.resource, scope, requestContext.correlationId, 'ALLOWED', 200)

      return apiJsonResponse({ data: validatedProjection, requestId: requestContext.requestId }, {
        context: requestContext,
        status: 200,
      })
    } catch (error) {
      // Zonder geverifieerde identiteit kan geen betrouwbare auditactor worden
      // toegewezen. Geauthenticeerde reads en autorisatieweigeringen worden
      // hierboven vastgelegd voordat een response wordt verstuurd.
      return apiErrorResponse(toSafeApiError(error), { context: requestContext })
    }
  }
}
