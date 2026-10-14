import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { cookies, loadActiveContext, validateAdministrationSelection } = vi.hoisted(() => ({
  cookies: vi.fn(),
  loadActiveContext: vi.fn(),
  validateAdministrationSelection: vi.fn(),
}))

vi.mock('next/headers', () => ({ cookies }))
vi.mock('@/lib/context/server-context', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/context/server-context')>(),
  loadActiveContext,
}))
vi.mock('@/lib/context/context-response', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/context/context-response')>(),
  validateAdministrationSelection,
}))

import { POST } from './route'
import { ACTIVE_ADMINISTRATION_COOKIE } from '@/lib/context/context-cookies'

const administrationId = '2057f6ec-cd3e-3c28-9126-c41235d4ffae'

function request(origin: string, target = 'http://localhost:3010'): Request {
  return new Request(`${target}/api/context/administration`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ administrationId }),
  })
}

describe('POST /api/context/administration form fallback', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    loadActiveContext.mockResolvedValue({ tenant: { id: 'tenant-1' }, activeHrGroup: { id: 'group-1' } })
    validateAdministrationSelection.mockReturnValue({ id: administrationId })
    cookies.mockResolvedValue({ set: vi.fn() })
  })

  afterEach(() => vi.unstubAllEnvs())

  it('preserves the browser loopback host and sets only the validated administration', async () => {
    const response = await POST(request('http://127.0.0.1:3010'))

    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('http://127.0.0.1:3010/dashboard/start')
    expect(validateAdministrationSelection).toHaveBeenCalledWith(expect.anything(), administrationId)
    expect(response.cookies.get(ACTIVE_ADMINISTRATION_COOKIE)?.value).toBe(administrationId)
  })

  it('rejects a foreign origin before loading context', async () => {
    loadActiveContext.mockClear()
    const response = await POST(request('https://outside.example'))

    expect(response.status).toBe(403)
    expect(loadActiveContext).not.toHaveBeenCalled()
  })
})
