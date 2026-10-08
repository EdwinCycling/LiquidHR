import { describe, expect, it } from 'vitest'
import {
  CHATGPT_MCP_RESOURCE,
  buildConsentLoginHref,
  buildConsentPath,
  isAllowedChatGptRedirectUri,
  isAllowedChatGptRedirectUrl,
  isAuthorizationId,
  isSupabaseAuthorizationRedirectUrl,
  isSupportedChatGptScope,
  parseConsentAuthorization,
} from './authorization'

const AUTHORIZATION_ID = 'f6a4c2e8b1d3a5f70918273645546321'
const CHATGPT_REDIRECT = 'https://chatgpt.com/connector/oauth/callback'
const CHATGPT_CLIENT_ID = 'b7e6b5ae-33be-493f-8456-02fa41e307e8'

function details(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    authorization_id: AUTHORIZATION_ID,
    client: { id: CHATGPT_CLIENT_ID, name: 'ChatGPT' },
    redirect_uri: CHATGPT_REDIRECT,
    scope: 'openid email offline_access',
    resource: CHATGPT_MCP_RESOURCE,
    user: { id: null, email: null },
    ...overrides,
  }
}

describe('OAuth consent authorization parsing', () => {
  it('accepts pending details with no pre-consent user binding and reads metadata only from the Supabase response', () => {
    expect(parseConsentAuthorization(details(), AUTHORIZATION_ID)).toEqual({
      authorizationId: AUTHORIZATION_ID,
      clientId: CHATGPT_CLIENT_ID,
      clientName: 'ChatGPT',
      redirectUri: CHATGPT_REDIRECT,
      scope: 'openid email offline_access',
      resource: CHATGPT_MCP_RESOURCE,
    })
  })

  it.each([
    ['missing OAuth client ID', details({ client: { name: 'ChatGPT' } })],
    ['malformed OAuth client ID', details({ client: { id: 'not-a-uuid', name: 'ChatGPT' } })],
    ['empty OAuth client ID', details({ client: { id: '', name: 'ChatGPT' } })],
  ])('rejects %s', (_label, response) => {
    expect(parseConsentAuthorization(response, AUTHORIZATION_ID)).toBeNull()
  })

  it.each([
    ['different authorization ID', details({ authorization_id: 'b75c81269c6c4697a18359a2a6d9d08c' })],
    ['already-resolved authorization', { redirect_url: `${CHATGPT_REDIRECT}?code=used&state=old` }],
    ['wrong resource', details({ resource: 'https://attacker.example/mcp' })],
  ])('rejects %s', (_label, response) => {
    expect(parseConsentAuthorization(response, AUTHORIZATION_ID)).toBeNull()
  })

  it('accepts bounded opaque Supabase authorization IDs and rejects unsafe values', () => {
    expect(isAuthorizationId(AUTHORIZATION_ID)).toBe(true)
    expect(isAuthorizationId('supabase-auth_id.v1~opaque')).toBe(true)
    expect(isAuthorizationId('')).toBe(false)
    expect(isAuthorizationId('bad/id?query=swap')).toBe(false)
    expect(isAuthorizationId('x'.repeat(257))).toBe(false)
    expect(isAuthorizationId(['one', 'two'])).toBe(false)
  })
})

describe('OAuth consent return path', () => {
  it('preserves the exact authorization_id through the local login returnTo', () => {
    const consentPath = buildConsentPath(AUTHORIZATION_ID)
    const loginUrl = new URL(buildConsentLoginHref(AUTHORIZATION_ID), 'https://liquidhr.test')

    expect(loginUrl.pathname).toBe('/login')
    expect(loginUrl.searchParams.get('next')).toBe(consentPath)
    expect(new URLSearchParams(consentPath.split('?')[1]).get('authorization_id')).toBe(AUTHORIZATION_ID)
  })
})

describe('OAuth consent callback validation', () => {
  it('keeps the registered redirect URI free of query data', () => {
    expect(isAllowedChatGptRedirectUri(CHATGPT_REDIRECT)).toBe(true)
    expect(isAllowedChatGptRedirectUri(`${CHATGPT_REDIRECT}?code=attacker`)).toBe(false)
    expect(isAllowedChatGptRedirectUri('https://chatgpt.com.attacker.example/connector/oauth/callback')).toBe(false)
  })

  it('allows only Supabase callback result parameters on the exact ChatGPT callback', () => {
    expect(isAllowedChatGptRedirectUrl(`${CHATGPT_REDIRECT}?code=issued&state=client-state`)).toBe(true)
    expect(isAllowedChatGptRedirectUrl(`${CHATGPT_REDIRECT}?code=issued&state=client-state&iss=https%3A%2F%2Fwnpfloqpjvaacobppbpk.supabase.co%2Fauth%2Fv1`)).toBe(true)
    expect(isAllowedChatGptRedirectUrl(`${CHATGPT_REDIRECT}?error=access_denied&state=client-state`)).toBe(true)
    expect(isAllowedChatGptRedirectUrl(`${CHATGPT_REDIRECT}?code=&state=client-state`)).toBe(false)
    expect(isAllowedChatGptRedirectUrl(`${CHATGPT_REDIRECT}?code=issued&redirect_uri=https%3A%2F%2Fattacker.example`)).toBe(false)
    expect(isAllowedChatGptRedirectUrl(`${CHATGPT_REDIRECT}?code=one&code=two`)).toBe(false)
    expect(isAllowedChatGptRedirectUrl('https://attacker.example/callback?code=issued')).toBe(false)
  })

  it('keeps the complete Supabase result URL exact while binding its destination to the registered ChatGPT callback', () => {
    const returnedUrl = `${CHATGPT_REDIRECT}?code=issued&state=client-state&iss=https%3A%2F%2Fwnpfloqpjvaacobppbpk.supabase.co%2Fauth%2Fv1&future_oauth_param=from-supabase`

    expect(isSupabaseAuthorizationRedirectUrl(returnedUrl, CHATGPT_REDIRECT)).toBe(true)
    expect(isSupabaseAuthorizationRedirectUrl(`${CHATGPT_REDIRECT}?error=access_denied&state=client-state`, CHATGPT_REDIRECT)).toBe(true)
    expect(isSupabaseAuthorizationRedirectUrl('https://attacker.example/callback?code=issued', CHATGPT_REDIRECT)).toBe(false)
    expect(isSupabaseAuthorizationRedirectUrl('https://chatgpt.com/connector/oauth/other?code=issued', CHATGPT_REDIRECT)).toBe(false)
    expect(isSupabaseAuthorizationRedirectUrl(CHATGPT_REDIRECT, CHATGPT_REDIRECT)).toBe(false)
    expect(isSupabaseAuthorizationRedirectUrl(null, CHATGPT_REDIRECT)).toBe(false)
  })
})

describe('ChatGPT OAuth scopes', () => {
  it.each(['openid', 'openid email offline_access', 'offline_access openid email'])('allows the supported scope set %s', (scope) => {
    expect(isSupportedChatGptScope(scope)).toBe(true)
  })

  it.each(['', 'email', 'openid profile', 'openid email email', 'openid api:write'])('rejects unsupported scopes %s', (scope) => {
    expect(isSupportedChatGptScope(scope)).toBe(false)
  })
})
