import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requireHeRaContext } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireHeRaContext: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/hera/request-context', () => ({ requireHeRaContext }))

import { PATCH } from './route'

const memoryId = '10000000-0000-4000-8000-000000000001'

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/hera/memory', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/hera/memory', () => {
  beforeEach(() => {
    createClient.mockReset()
    requireHeRaContext.mockReset()
    requireHeRaContext.mockResolvedValue({
      tenantId: 'tenant-1',
      administrationId: null,
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: [],
      permissions: [],
    })
  })

  it('weigert wijzigen zonder expliciete toestemming', async () => {
    const response = await PATCH(patchRequest({
      id: memoryId,
      content: 'Antwoord voortaan direct.',
      explicitConsent: false,
    }))

    expect(response.status).toBe(400)
    expect(requireHeRaContext).not.toHaveBeenCalled()
  })

  it('geeft dezelfde 404 voor een vreemd of ontbrekend item', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const builder = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle,
    }
    builder.update.mockReturnValue(builder)
    builder.eq.mockReturnValue(builder)
    builder.select.mockReturnValue(builder)
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) })

    const response = await PATCH(patchRequest({
      id: memoryId,
      content: 'Antwoord voortaan direct.',
      explicitConsent: true,
    }))

    expect(response.status).toBe(404)
    expect(builder.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1')
    expect(builder.eq).toHaveBeenCalledWith('owner_user_id', 'user-1')
    await expect(response.json()).resolves.toEqual({ error: 'HERA_MEMORY_NOT_FOUND' })
  })
})
