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
vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/recruitment/vacancy-service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/recruitment/vacancy-service')>('@/lib/recruitment/vacancy-service')
  return { ...actual, updateRecruitmentPublication }
})

import { NextResponse } from 'next/server'
import { PATCH } from './route'
import { buildDefaultVacancySections } from '@/lib/recruitment/vacancy-service'

const routeContext = { params: Promise.resolve({ vacancyId: '93000000-0000-4000-8000-000000000001' }) }
const payload = { companyName: 'LiquidHR', sections: buildDefaultVacancySections(), formConfig: { phone: 'OPTIONAL', cv: 'HIDDEN', motivation: 'REQUIRED' } }

describe('PATCH /api/recruitment/vacancies/[vacancyId]/publication', () => {
  beforeEach(() => {
    createClient.mockReset()
    createClient.mockResolvedValue({})
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
    requirePermission.mockReset()
    requirePermission.mockResolvedValue({ tenantId: 'tenant-1', hrGroupId: 'group-1' })
    requireTenantModule.mockReset()
    requireTenantModule.mockResolvedValue(undefined)
    updateRecruitmentPublication.mockReset()
    updateRecruitmentPublication.mockResolvedValue({ id: 'publication-1', status: 'CLOSED', slug: 'test-vacature' })
  })

  it('geeft alleen een gevalideerde interne configuratie door aan de service', async () => {
    const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'CLOSED', slug: 'test-vacature', payload }) }), routeContext)

    expect(response.status).toBe(200)
    expect(updateRecruitmentPublication).toHaveBeenCalledWith({ tenantId: 'tenant-1', hrGroupId: 'group-1' }, '93000000-0000-4000-8000-000000000001', 'CLOSED', 'test-vacature', payload, expect.anything())
  })

  it('weigert ongeldige status, slug of payload zonder mutatie', async () => {
    const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'OPEN', slug: 'Niet veilig', payload }) }), routeContext)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ code: 'RECRUITMENT_PUBLICATION_INPUT_INVALID' })
    expect(updateRecruitmentPublication).not.toHaveBeenCalled()
  })

  it('behoudt de server-side publish-permissiongrens', async () => {
    permissionErrorResponse.mockReturnValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
    requirePermission.mockRejectedValue(new Error('forbidden'))

    const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'CLOSED', slug: 'test-vacature', payload }) }), routeContext)

    expect(response.status).toBe(403)
    expect(updateRecruitmentPublication).not.toHaveBeenCalled()
  })
})
