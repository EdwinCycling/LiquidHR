import { describe, expect, it, vi } from 'vitest'
import { isChatGptOAuthGrant, readUserOAuthGrants } from './user-grants'

describe('user-scoped OAuth grant management', () => {
  it('reads grants with getUserGrants when the SDK exposes it', async () => {
    const getUserGrants = vi.fn().mockResolvedValue({
      data: [{
        client: { id: 'chatgpt-client', name: 'ChatGPT' },
        scopes: ['openid', 'email', 'offline_access'],
        granted_at: '2026-10-08T09:00:00.000Z',
      }],
      error: null,
    })
    const listGrants = vi.fn()

    await expect(readUserOAuthGrants({ getUserGrants, listGrants })).resolves.toEqual({
      status: 'ready',
      grants: [{
        clientId: 'chatgpt-client',
        clientName: 'ChatGPT',
        scopes: ['openid', 'email', 'offline_access'],
        authorizedAt: '2026-10-08T09:00:00.000Z',
      }],
    })
    expect(getUserGrants).toHaveBeenCalledOnce()
    expect(listGrants).not.toHaveBeenCalled()
  })

  it('uses the current Supabase SDK listGrants method when getUserGrants is unavailable', async () => {
    const listGrants = vi.fn().mockResolvedValue({ data: [], error: null })

    await expect(readUserOAuthGrants({ listGrants })).resolves.toEqual({ status: 'ready', grants: [] })
    expect(listGrants).toHaveBeenCalledOnce()
  })

  it('supports the current SDK response and the documented grant response shape', async () => {
    const currentSdk = await readUserOAuthGrants({
      listGrants: async () => ({
        data: [{
          client: { id: 'client-1', name: 'Example App' },
          scopes: ['email'],
          granted_at: '2026-10-08T10:30:00.000Z',
        }],
        error: null,
      }),
    })
    const documentedShape = await readUserOAuthGrants({
      getUserGrants: async () => ({
        data: [{
          client_id: 'client-2',
          client_name: 'ChatGPT',
          scopes: ['email'],
          created_at: '2026-10-08T10:31:00.000Z',
        }],
        error: null,
      }),
    })

    expect(currentSdk.status).toBe('ready')
    expect(documentedShape).toEqual({
      status: 'ready',
      grants: [{
        clientId: 'client-2',
        clientName: 'ChatGPT',
        scopes: ['email'],
        authorizedAt: '2026-10-08T10:31:00.000Z',
      }],
    })
  })

  it('fails closed if the user-scoped grant response is malformed or errors', async () => {
    await expect(readUserOAuthGrants({
      listGrants: async () => ({ data: [{ client: { id: 'client-1' } }], error: null }),
    })).resolves.toEqual({ status: 'failed' })
    await expect(readUserOAuthGrants({
      listGrants: async () => ({ data: null, error: new Error('unauthorized') }),
    })).resolves.toEqual({ status: 'failed' })
  })

  it('only marks the ChatGPT client as the revocable TEST grant', () => {
    expect(isChatGptOAuthGrant({
      clientId: 'chatgpt-client',
      clientName: 'ChatGPT',
      scopes: [],
      authorizedAt: '2026-10-08T09:00:00.000Z',
    })).toBe(true)
    expect(isChatGptOAuthGrant({
      clientId: 'another-client',
      clientName: 'Example ChatGPT Importer',
      scopes: [],
      authorizedAt: '2026-10-08T09:00:00.000Z',
    })).toBe(false)
  })
})
