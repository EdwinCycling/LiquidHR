import { describe, expect, it, vi } from 'vitest'
import { requestJson } from './hera-request'

describe('requestJson', () => {
  it('geeft een herstelbare timeoutfout wanneer een HeRa-request blijft hangen', async () => {
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined))

    await expect(requestJson('/api/hera/conversations', {}, 5, fetcher)).rejects.toThrow('HERA_REQUEST_TIMEOUT')
  })
})
