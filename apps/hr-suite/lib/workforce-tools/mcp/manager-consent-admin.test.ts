import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createAdminClient, updateUserById } = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  updateUserById: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

import { setManagerMcpConsentMarker } from './manager-consent-admin'
import { CURRENT_MANAGER_MCP_CONSENT_VERSION } from './manager-consent'

const userId = '00000000-0000-4000-8000-000000000001'
const clientId = '00000000-0000-4000-8000-000000000002'
const markerKey = `liquidhr_manager_mcp_consent_${clientId}`

describe('trusted Manager MCP consent metadata update', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    createAdminClient.mockReturnValue({ auth: { admin: { updateUserById } } })
  })

  it('sends only this OAuth client marker patch and reads the resulting metadata back', async () => {
    updateUserById.mockResolvedValue({ data: { user: {
      id: userId,
      app_metadata: { provider: 'email', unrelated_flag: true, [markerKey]: CURRENT_MANAGER_MCP_CONSENT_VERSION },
    } }, error: null })

    await expect(setManagerMcpConsentMarker(userId, clientId, true)).resolves.toBe(true)
    expect(updateUserById).toHaveBeenCalledWith(userId, {
      app_metadata: { [markerKey]: CURRENT_MANAGER_MCP_CONSENT_VERSION },
    })
  })

  it('removes and reads back only this OAuth client marker', async () => {
    updateUserById.mockResolvedValue({ data: { user: {
      id: userId,
      app_metadata: { provider: 'email', unrelated_flag: true },
    } }, error: null })

    await expect(setManagerMcpConsentMarker(userId, clientId, false)).resolves.toBe(true)
    expect(updateUserById).toHaveBeenCalledWith(userId, { app_metadata: { [markerKey]: null } })
  })

  it('fails closed for an invalid client ID, Auth error or mismatched user', async () => {
    await expect(setManagerMcpConsentMarker(userId, 'attacker-client', true)).resolves.toBe(false)
    expect(createAdminClient).not.toHaveBeenCalled()

    updateUserById.mockResolvedValueOnce({ data: { user: null }, error: new Error('Auth unavailable') })
    await expect(setManagerMcpConsentMarker(userId, clientId, false)).resolves.toBe(false)

    updateUserById.mockResolvedValueOnce({ data: { user: { id: 'another-user', app_metadata: {} } }, error: null })
    await expect(setManagerMcpConsentMarker(userId, clientId, false)).resolves.toBe(false)
  })
})
