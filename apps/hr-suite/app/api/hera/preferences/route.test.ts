import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requireHeRaContext } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireHeRaContext: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/hera/request-context', () => ({ requireHeRaContext }))

import { PATCH } from './route'

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/hera/preferences', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/hera/preferences', () => {
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

  it('weigert lege of onbekende instellingen', async () => {
    const response = await PATCH(patchRequest({ tenantId: 'tenant-2' }))

    expect(response.status).toBe(400)
    expect(requireHeRaContext).not.toHaveBeenCalled()
  })

  it('leidt tenant en eigenaar uitsluitend af uit de serversessie', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { tone: 'DIRECT', detail_level: 'COMPACT', seniority_level: 'EXPERT' },
      error: null,
    })
    const builder = { upsert: vi.fn(), select: vi.fn(), single }
    builder.upsert.mockReturnValue(builder)
    builder.select.mockReturnValue(builder)
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) })

    const response = await PATCH(patchRequest({
      tone: 'DIRECT',
      detailLevel: 'COMPACT',
      seniorityLevel: 'EXPERT',
    }))

    expect(response.status).toBe(200)
    expect(builder.upsert).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      owner_user_id: 'user-1',
      tone: 'DIRECT',
      detail_level: 'COMPACT',
      seniority_level: 'EXPERT',
    }, { onConflict: 'tenant_id,owner_user_id' })
  })
})
