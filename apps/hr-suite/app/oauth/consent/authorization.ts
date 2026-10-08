export const CHATGPT_MCP_RESOURCE = 'https://liquid-hr-hr-suite.vercel.app/mcp'
export const OAUTH_DECISION_ERROR_PATH = '/oauth/decision-error'

const AUTHORIZATION_ID_PATTERN = /^[A-Za-z0-9._~-]{1,256}$/
const CHATGPT_CALLBACK_PATTERN = /^\/connector\/oauth\/[a-zA-Z0-9_-]{1,128}$/
const ALLOWED_OAUTH_SCOPES = new Set(['openid', 'email', 'offline_access'])
const ALLOWED_CALLBACK_QUERY_KEYS = new Set(['code', 'state', 'error', 'error_description', 'error_uri', 'iss'])

export interface ChatGptConsentAuthorization {
  readonly authorizationId: string
  readonly clientId: string
  readonly clientName: string
  readonly redirectUri: string
  readonly scope: string
  readonly resource: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isChatGptCallback(value: string, allowQuery: boolean): URL | null {
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:'
      || url.hostname !== 'chatgpt.com'
      || url.port
      || url.username
      || url.password
      || url.hash
      || (url.pathname !== '/connector_platform_oauth_redirect' && !CHATGPT_CALLBACK_PATTERN.test(url.pathname))
    ) return null

    if (!allowQuery && url.search) return null
    if (allowQuery) {
      const queryKeys = [...url.searchParams.keys()]
      if (
        new Set(queryKeys).size !== queryKeys.length
        || queryKeys.some((key) => !ALLOWED_CALLBACK_QUERY_KEYS.has(key))
        || url.searchParams.has('code') === url.searchParams.has('error')
        || (url.searchParams.has('code') && !url.searchParams.get('code'))
        || (url.searchParams.has('error') && !url.searchParams.get('error'))
        || (url.searchParams.has('error_description') && !url.searchParams.has('error'))
        || (url.searchParams.has('error_uri') && !url.searchParams.has('error'))
      ) return null
    }
    return url
  } catch {
    return null
  }
}

export function isAuthorizationId(value: unknown): value is string {
  return typeof value === 'string' && AUTHORIZATION_ID_PATTERN.test(value)
}

export function buildConsentPath(authorizationId: string): string {
  const query = new URLSearchParams({ authorization_id: authorizationId })
  return `/oauth/consent?${query.toString()}`
}

export function buildConsentLoginHref(authorizationId: string): string {
  return `/login?next=${encodeURIComponent(buildConsentPath(authorizationId))}`
}

export function parseConsentAuthorization(data: unknown, expectedAuthorizationId: string): ChatGptConsentAuthorization | null {
  if (!isRecord(data) || 'redirect_url' in data || data.authorization_id !== expectedAuthorizationId) return null

  const client = data.client
  if (
    !isRecord(client)
    || typeof client.id !== 'string'
    || !client.id.trim()
    || typeof client.name !== 'string'
    || !client.name.trim()
    || typeof data.redirect_uri !== 'string'
    || typeof data.scope !== 'string'
  ) return null

  const resource = data.resource
  if (resource !== undefined && (typeof resource !== 'string' || resource !== CHATGPT_MCP_RESOURCE)) return null

  return {
    authorizationId: expectedAuthorizationId,
    clientId: client.id,
    clientName: client.name,
    redirectUri: data.redirect_uri,
    scope: data.scope.trim(),
    resource: typeof resource === 'string' ? resource : null,
  }
}

export function parseSupabaseAuthorizationRedirect(data: unknown): string | null {
  if (
    !isRecord(data)
    || Object.keys(data).length !== 1
    || !Object.prototype.hasOwnProperty.call(data, 'redirect_url')
    || typeof data.redirect_url !== 'string'
    || !isAllowedChatGptRedirectUrl(data.redirect_url)
  ) return null

  return data.redirect_url
}

export function isAllowedChatGptRedirectUri(value: string): boolean {
  return isChatGptCallback(value, false) !== null
}

export function isAllowedChatGptRedirectUrl(value: string): boolean {
  return isChatGptCallback(value, true) !== null
}

export function isSupabaseAuthorizationRedirectUrl(value: unknown, redirectUri: string): value is string {
  if (typeof value !== 'string' || value.length === 0) return false

  const registeredCallback = isChatGptCallback(redirectUri, false)
  if (!registeredCallback) return false

  try {
    const returnedUrl = new URL(value)
    if (
      returnedUrl.protocol !== 'https:'
      || returnedUrl.origin !== registeredCallback.origin
      || returnedUrl.pathname !== registeredCallback.pathname
      || returnedUrl.username
      || returnedUrl.password
      || returnedUrl.port
      || returnedUrl.hash
    ) return false

    const codes = returnedUrl.searchParams.getAll('code')
    const errors = returnedUrl.searchParams.getAll('error')
    const hasCode = codes.length === 1 && codes[0].length > 0
    const hasError = errors.length === 1 && errors[0].length > 0
    return hasCode !== hasError && !returnedUrl.searchParams.has('redirect_uri')
  } catch {
    return false
  }
}

export function isSupportedChatGptScope(scope: string): boolean {
  const scopes = scope.split(/\s+/u).filter(Boolean)
  return scopes.length > 0
    && scopes.includes('openid')
    && new Set(scopes).size === scopes.length
    && scopes.every((item) => ALLOWED_OAUTH_SCOPES.has(item))
}
