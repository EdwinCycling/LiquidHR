import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, permissionErrorResponse, requirePermission, requireTenantModule, updateRecruitmentPublication } = vi.hoisted(() => ({
  createClient: vi.fn(),
  permissionErrorResponse: vi.fn((): Response | null => null),
  requirePermission: vi.fn(),
  requireTenantModule: vi.fn(),
  updateRecruitmentPublication: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse, requirePermission }))
vi.mock('@/lib/modules/module-service', () => ({ requireTenantModule }))
vi.mock('@/lib/recruitment/vacancy-service', () => ({ updateRecruitmentPublication }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { PATCH } from './route'

describe('PATCH /api/recruitment/vacancies/[vacancyId]/publication', () => {
  beforeEach(() => {
    createClient.mockReset()
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
    requirePermission.mockReset()
    requirePermission.mockResolvedValue({ tenantId: 'tenant-1', hrGroupId: 'hr-group-1' })
    requireTenantModule.mockReset()
    requireTenantModule.mockResolvedValue(undefined)
    updateRecruitmentPublication.mockReset()
  })

  it('geeft DRAFT zonder publicatie door als succesvolle ARCHIVED-response', async () => {
    const client = { rpc: vi.fn() }
    createClient.mockResolvedValue(client)
    updateRecruitmentPublication.mockResolvedValue({ id: 'publication-1', status: 'ARCHIVED', slug: 'vacancy-11111111' })

    const response = await PATCH(new Request('http://localhost/api/recruitment/vacancies/vacancy-1/publication', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'ARCHIVED' }),
    }), { params: Promise.resolve({ vacancyId: 'vacancy-1' }) })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { id: 'publication-1', status: 'ARCHIVED', slug: 'vacancy-11111111' } })
    expect(updateRecruitmentPublication).toHaveBeenCalledWith({ tenantId: 'tenant-1', hrGroupId: 'hr-group-1' }, 'vacancy-1', 'ARCHIVED', null, {}, client)
  })
})
