import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { buildDefaultVacancySections } from '@/lib/recruitment/vacancy-service'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  permissionErrorResponse: vi.fn((): Response | null => null),
  requirePermission: vi.fn(),
  requireTenantModule: vi.fn(),
  updateRecruitmentPublication: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  permissionErrorResponse: mocks.permissionErrorResponse,
  requirePermission: mocks.requirePermission,
}))
vi.mock('@/lib/modules/module-service', () => ({ requireTenantModule: mocks.requireTenantModule }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/recruitment/vacancy-service', () => ({ updateRecruitmentPublication: mocks.updateRecruitmentPublication }))

import { PATCH } from './route'

const routeContext = { params: Promise.resolve({ vacancyId: '93000000-0000-4000-8000-000000000001' }) }
const payload = { companyName: 'LiquidHR', sections: buildDefaultVacancySections(), formConfig: { phone: 'OPTIONAL', cv: 'HIDDEN', motivation: 'REQUIRED' } }

describe('PATCH /api/recruitment/vacancies/[vacancyId]/publication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.permissionErrorResponse.mockReturnValue(null)
    mocks.requireTenantModule.mockResolvedValue(undefined)
    mocks.requirePermission.mockResolvedValue({ tenantId: 'tenant-1', hrGroupId: 'group-1' })
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
    expect(mocks.updateRecruitmentPublication).toHaveBeenCalledWith({ tenantId: 'tenant-1', hrGroupId: 'group-1' }, '11111111-1111-4111-8111-111111111111', status, 'test-recruitment-vacancy', { marker: 'TEST-RECRUITMENT' }, {})
  })

  it('geeft DRAFT zonder publicatie door als succesvolle ARCHIVED-response', async () => {
    const client = { rpc: vi.fn() }
    mocks.createClient.mockResolvedValue(client)
    mocks.updateRecruitmentPublication.mockResolvedValue({ id: 'publication-1', status: 'ARCHIVED', slug: 'vacancy-11111111' })

    const response = await PATCH(new Request('http://localhost/api/recruitment/vacancies/vacancy-1/publication', {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'ARCHIVED' }),
    }), { params: Promise.resolve({ vacancyId: 'vacancy-1' }) })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { id: 'publication-1', status: 'ARCHIVED', slug: 'vacancy-11111111' } })
    expect(mocks.updateRecruitmentPublication).toHaveBeenCalledWith({ tenantId: 'tenant-1', hrGroupId: 'group-1' }, 'vacancy-1', 'ARCHIVED', null, {}, client)
  })

  it('geeft alleen een gevalideerde interne configuratie door aan de service', async () => {
    const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'CLOSED', slug: 'test-vacature', payload }) }), routeContext)

    expect(response.status).toBe(200)
    expect(mocks.updateRecruitmentPublication).toHaveBeenCalledWith({ tenantId: 'tenant-1', hrGroupId: 'group-1' }, '93000000-0000-4000-8000-000000000001', 'CLOSED', 'test-vacature', payload, expect.anything())
  })

  it('weigert ongeldige status, slug of payload zonder mutatie', async () => {
    const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'OPEN', slug: 'Niet veilig', payload }) }), routeContext)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ code: 'RECRUITMENT_PUBLICATION_INPUT_INVALID' })
    expect(mocks.updateRecruitmentPublication).not.toHaveBeenCalled()
  })

  it('behoudt de server-side publish-permissiongrens', async () => {
    mocks.permissionErrorResponse.mockReturnValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
    mocks.requirePermission.mockRejectedValue(new Error('forbidden'))

    const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ status: 'CLOSED', slug: 'test-vacature', payload }) }), routeContext)

    expect(response.status).toBe(403)
    expect(mocks.updateRecruitmentPublication).not.toHaveBeenCalled()
  })
})
