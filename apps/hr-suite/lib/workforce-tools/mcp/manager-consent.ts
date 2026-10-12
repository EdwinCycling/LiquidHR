const OAUTH_CLIENT_ID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu
const MANAGER_CONSENT_METADATA_PREFIX = 'liquidhr_manager_mcp_consent_'

/** Bump this value whenever the Manager MCP data disclosure or capability set changes. */
export const CURRENT_MANAGER_MCP_CONSENT_VERSION = 'apiai09-manager-mcp-v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function consentMetadataKey(clientId: unknown): string | null {
  return typeof clientId === 'string' && OAUTH_CLIENT_ID_PATTERN.test(clientId)
    ? `${MANAGER_CONSENT_METADATA_PREFIX}${clientId.toLowerCase()}`
    : null
}

/** Only trusted Auth app_metadata, bound to this OAuth client, satisfies Manager consent. */
export function hasCurrentManagerMcpConsent(appMetadata: unknown, clientId: unknown): boolean {
  const key = consentMetadataKey(clientId)
  return key !== null
    && isRecord(appMetadata)
    && appMetadata[key] === CURRENT_MANAGER_MCP_CONSENT_VERSION
}

/** Auth Admin merges this top-level key and treats null as removal; no user-controlled metadata is used. */
export function managerMcpConsentMetadataPatch(
  clientId: unknown,
  approved: boolean,
): Readonly<Record<string, string | null>> | null {
  const key = consentMetadataKey(clientId)
  if (!key) return null
  return { [key]: approved ? CURRENT_MANAGER_MCP_CONSENT_VERSION : null }
}
