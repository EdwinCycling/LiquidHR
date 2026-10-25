import { describe, expect, it, vi } from 'vitest'

const { getLocale, getProcessOperationsInbox } = vi.hoisted(() => ({
  getLocale: vi.fn(),
  getProcessOperationsInbox: vi.fn(),
}))

vi.mock('@/lib/i18n/server', () => ({ getLocale }))
vi.mock('@/lib/process-automation/operations-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/process-automation/operations-service')>()
  return { ...actual, getProcessOperationsInbox }
})

import { AuthenticationError } from '@/lib/auth/permissions'
import { ProcessOperationsServiceError } from '@/lib/process-automation/operations-service'
import { GET } from './route'

describe('process operations API route', () => {
  it('rejects invalid pagination before calling the operations service', async () => {
    const response = await GET(new Request('https://liquidhr.test/api/process-automation/operations?page=0'))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ code: 'PROCESS_OPERATIONS_FILTER_INVALID' })
    expect(getProcessOperationsInbox).not.toHaveBeenCalled()
  })

  it('returns the typed scoped operations page using the active locale', async () => {
    getLocale.mockResolvedValue('en')
    getProcessOperationsInbox.mockResolvedValue({ total: 0, items: [] })

    const response = await GET(new Request('https://liquidhr.test/api/process-automation/operations?search=%20Onboarding%20&filter=RETRY&page=2'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: { total: 0, items: [] } })
    expect(getProcessOperationsInbox).toHaveBeenCalledWith({ search: 'Onboarding', filter: 'RETRY', page: 2, pageSize: 25 }, 'en')
  })

  it('preserves the existing forbidden response without leaking technical details', async () => {
    getLocale.mockResolvedValue('nl')
    getProcessOperationsInbox.mockRejectedValue(new ProcessOperationsServiceError('FORBIDDEN', 403))

    const response = await GET(new Request('https://liquidhr.test/api/process-automation/operations'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ code: 'FORBIDDEN' })
  })

  it('returns the standard unauthenticated response before reading operations', async () => {
    getLocale.mockResolvedValue('nl')
    getProcessOperationsInbox.mockRejectedValue(new AuthenticationError('Je bent niet ingelogd.'))

    const response = await GET(new Request('https://liquidhr.test/api/process-automation/operations'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Je bent niet ingelogd.' })
  })
})
