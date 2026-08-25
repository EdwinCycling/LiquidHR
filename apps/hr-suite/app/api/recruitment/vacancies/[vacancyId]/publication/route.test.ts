import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requirePermission: vi.fn(),
  requireTenantModule: vi.fn(),
  updateRecruitmentPublication: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  permissionErrorResponse: vi.fn(() => null),
  requirePermission: mocks.requirePermission,
}))
vi.mock('@/lib/modules/module-service', () => ({ requireTenantModule: mocks.requireTenantModule }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/recruitment/vacancy-service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/recruitment/vacancy-service')>('@/lib/recruitment/vacancy-service')
  return { ...actual, updateRecruitmentPublication: mocks.updateRecruitmentPublication }
})

import { PATCH } from './route'

describe('vacancy publication API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireTenantModule.mockResolvedValue(undefined)
    mocks.requirePermission.mockResolvedValue({ tenantId: 'tenant', hrGroupId: 'group' })
    mocks.createClient.mockResolvedValue({})
    mocks.updateRecruitmentPublication.mockResolvedValue({ id: 'publication', status: 'OPEN', slug: 'test-recruitment-vacancy' })
  })

  it('weigert statusnamen buiten het bestaande OPEN/CLOSED/ARCHIVED-contract', async () => {
    const response = await PATCH(new Request('https://example.test', { body: JSON.stringify({ status: 'ACTIVE' }), method: 'PATCH' }), { params: Promise.resolve({ vacancyId: '11111111-1111-4111-8111-111111111111' }) })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ code: 'RECRUITMENT_PUBLICATION_INPUT_INVALID' })
    expect(mocks.updateRecruitmentPublication).not.toHaveBeenCalled()
  })

  it.each(['OPEN', 'CLOSED', 'ARCHIVED'] as const)('geeft status %s door aan het bestaande publicatie-RPC', async (status) => {
    const response = await PATCH(new Request('https://example.test', { body: JSON.stringify({ payload: { marker: 'TEST-RECRUITMENT' }, slug: 'test-recruitment-vacancy', status }), method: 'PATCH' }), { params: Promise.resolve({ vacancyId: '11111111-1111-4111-8111-111111111111' }) })

    expect(response.status).toBe(200)
    expect(mocks.updateRecruitmentPublication).toHaveBeenCalledWith({ tenantId: 'tenant', hrGroupId: 'group' }, '11111111-1111-4111-8111-111111111111', status, 'test-recruitment-vacancy', { marker: 'TEST-RECRUITMENT' }, {})
  })
})
