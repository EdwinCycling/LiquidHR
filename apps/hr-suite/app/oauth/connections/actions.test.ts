import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, getClaims, listGrants, redirect, revalidatePath, revokeGrant } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  listGrants: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  revokeGrant: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { revokeChatGptOAuthGrant } from './actions'
import { initialOAuthGrantActionState } from './grant-state'

const CHATGPT_CLIENT_ID = 'chatgpt-client-id'

function formData(clientId: string): FormData {
  const form = new FormData()
  form.set('clientId', clientId)
  return form
}

const chatGptGrant = {
  client: { id: CHATGPT_CLIENT_ID, name: 'ChatGPT' },
  scopes: ['openid', 'email', 'offline_access'],
  granted_at: '2026-10-08T09:00:00.000Z',
}

describe('OAuth TEST connection revocation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getClaims.mockResolvedValue({ data: { claims: { sub: 'synthetic-employee-user' } }, error: null })
    listGrants.mockResolvedValue({ data: [chatGptGrant], error: null })
    revokeGrant.mockResolvedValue({ data: {}, error: null })
    createClient.mockResolvedValue({
      auth: {
        getClaims,
        oauth: { listGrants, revokeGrant },
      },
    })
    redirect.mockImplementation((destination: string) => {
      throw new Error(`NEXT_REDIRECT:${destination}`)
    })
  })

  it('requires the authenticated LiquidHR session before reading grants', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('session missing') })

    await expect(revokeChatGptOAuthGrant(initialOAuthGrantActionState, formData(CHATGPT_CLIENT_ID)))
      .rejects.toThrow('NEXT_REDIRECT:/login?next=%2Foauth%2Fconnections')

    expect(listGrants).not.toHaveBeenCalled()
    expect(revokeGrant).not.toHaveBeenCalled()
  })

  it('rejects a browser-supplied client ID that is absent from the current user grant list', async () => {
    const result = await revokeChatGptOAuthGrant(initialOAuthGrantActionState, formData('attacker-client-id'))

    expect(result).toEqual({ status: 'error' })
    expect(revokeGrant).not.toHaveBeenCalled()
  })

  it('does not allow revoking a non-ChatGPT application from this TEST utility', async () => {
    listGrants.mockResolvedValue({
      data: [{
        client: { id: CHATGPT_CLIENT_ID, name: 'Example App' },
        scopes: ['email'],
        granted_at: '2026-10-08T09:00:00.000Z',
      }],
      error: null,
    })

    const result = await revokeChatGptOAuthGrant(initialOAuthGrantActionState, formData(CHATGPT_CLIENT_ID))

    expect(result).toEqual({ status: 'error' })
    expect(revokeGrant).not.toHaveBeenCalled()
  })

  it('revokes only the live ChatGPT grant and confirms it disappeared from the user grant list', async () => {
    listGrants
      .mockResolvedValueOnce({ data: [chatGptGrant], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    const result = await revokeChatGptOAuthGrant(initialOAuthGrantActionState, formData(CHATGPT_CLIENT_ID))

    expect(result).toEqual({ status: 'revoked', clientId: CHATGPT_CLIENT_ID })
    expect(revokeGrant).toHaveBeenCalledWith({ clientId: CHATGPT_CLIENT_ID })
    expect(listGrants).toHaveBeenCalledTimes(2)
    expect(revalidatePath).toHaveBeenCalledWith('/oauth/connections')
  })

  it('reports failure if the grant remains after Supabase reports a successful revoke', async () => {
    listGrants.mockResolvedValue({ data: [chatGptGrant], error: null })

    const result = await revokeChatGptOAuthGrant(initialOAuthGrantActionState, formData(CHATGPT_CLIENT_ID))

    expect(result).toEqual({ status: 'error' })
    expect(revokeGrant).toHaveBeenCalledOnce()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('keeps failures closed when Supabase rejects the revoke', async () => {
    revokeGrant.mockResolvedValue({ data: null, error: new Error('provider error') })

    const result = await revokeChatGptOAuthGrant(initialOAuthGrantActionState, formData(CHATGPT_CLIENT_ID))

    expect(result).toEqual({ status: 'error' })
    expect(listGrants).toHaveBeenCalledOnce()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
