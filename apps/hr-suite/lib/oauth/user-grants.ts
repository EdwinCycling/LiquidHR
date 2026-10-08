type OAuthGrantReadResponse = {
  readonly data: unknown
  readonly error: unknown | null
}

export type UserOAuthGrantReader = {
  readonly getUserGrants?: () => Promise<OAuthGrantReadResponse>
  readonly listGrants?: () => Promise<OAuthGrantReadResponse>
}

export interface UserOAuthGrantSummary {
  readonly clientId: string
  readonly clientName: string
  readonly scopes: readonly string[]
  readonly authorizedAt: string
}

export type UserOAuthGrantReadResult =
  | { readonly status: 'ready'; readonly grants: readonly UserOAuthGrantSummary[] }
  | { readonly status: 'failed' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseGrant(value: unknown): UserOAuthGrantSummary | null {
  if (!isRecord(value)) return null

  const client = isRecord(value.client) ? value.client : null
  const clientId = typeof value.client_id === 'string' ? value.client_id : client?.id
  const clientName = typeof value.client_name === 'string' ? value.client_name : client?.name
  const scopes = value.scopes
  const authorizedAt = value.granted_at ?? value.created_at ?? value.updated_at

  if (
    typeof clientId !== 'string'
    || !clientId.trim()
    || clientId !== clientId.trim()
    || typeof clientName !== 'string'
    || !clientName.trim()
    || !Array.isArray(scopes)
    || scopes.some((scope) => typeof scope !== 'string')
    || typeof authorizedAt !== 'string'
    || !Number.isFinite(Date.parse(authorizedAt))
  ) return null

  return {
    clientId,
    clientName: clientName.trim(),
    scopes,
    authorizedAt,
  }
}

export async function readUserOAuthGrants(
  oauth: UserOAuthGrantReader,
): Promise<UserOAuthGrantReadResult> {
  const getUserGrants = oauth.getUserGrants ?? oauth.listGrants
  if (!getUserGrants) return { status: 'failed' }

  try {
    const response = await getUserGrants.call(oauth)
    if (response.error || !Array.isArray(response.data)) return { status: 'failed' }

    const grants = response.data.map(parseGrant)
    if (grants.some((grant) => grant === null)) return { status: 'failed' }

    return { status: 'ready', grants: grants.filter((grant) => grant !== null) }
  } catch {
    return { status: 'failed' }
  }
}

export function isChatGptOAuthGrant(grant: UserOAuthGrantSummary): boolean {
  return grant.clientName.toLocaleLowerCase('en-US') === 'chatgpt'
}
