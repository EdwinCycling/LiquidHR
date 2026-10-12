import { describe, expect, it } from 'vitest'
import {
  CURRENT_MANAGER_MCP_CONSENT_VERSION,
  hasCurrentManagerMcpConsent,
  managerMcpConsentMetadataPatch,
} from './manager-consent'

const CLIENT_ID = 'b7e6b5ae-33be-493f-8456-02fa41e307e8'
const OTHER_CLIENT_ID = 'e7e9199a-a298-4c0e-8d42-003461f33693'

describe('Manager MCP consent version', () => {
  it('requires the current server-managed version for the exact OAuth client', () => {
    const metadata = { [`liquidhr_manager_mcp_consent_${CLIENT_ID}`]: CURRENT_MANAGER_MCP_CONSENT_VERSION }

    expect(hasCurrentManagerMcpConsent(metadata, CLIENT_ID)).toBe(true)
    expect(hasCurrentManagerMcpConsent(metadata, OTHER_CLIENT_ID)).toBe(false)
  })

  it('rejects missing, stale, malformed, and user-controlled consent values', () => {
    expect(hasCurrentManagerMcpConsent({}, CLIENT_ID)).toBe(false)
    expect(hasCurrentManagerMcpConsent({ [`liquidhr_manager_mcp_consent_${CLIENT_ID}`]: 'old-version' }, CLIENT_ID)).toBe(false)
    expect(hasCurrentManagerMcpConsent({ [`liquidhr_manager_mcp_consent_${CLIENT_ID}`]: true }, CLIENT_ID)).toBe(false)
    expect(hasCurrentManagerMcpConsent({ [`liquidhr_manager_mcp_consent_${CLIENT_ID}`]: CURRENT_MANAGER_MCP_CONSENT_VERSION }, 'invalid-client')).toBe(false)
    expect(hasCurrentManagerMcpConsent(null, CLIENT_ID)).toBe(false)
    expect(hasCurrentManagerMcpConsent(['not', 'metadata'], CLIENT_ID)).toBe(false)
  })

  it('sets or removes only the consent key for a well-formed OAuth client ID', () => {
    expect(managerMcpConsentMetadataPatch(CLIENT_ID, true)).toEqual({
      [`liquidhr_manager_mcp_consent_${CLIENT_ID}`]: CURRENT_MANAGER_MCP_CONSENT_VERSION,
    })
    expect(managerMcpConsentMetadataPatch(CLIENT_ID, false)).toEqual({
      [`liquidhr_manager_mcp_consent_${CLIENT_ID}`]: null,
    })
    expect(managerMcpConsentMetadataPatch('invalid-client', true)).toBeNull()
  })
})
