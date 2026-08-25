import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { RecruitmentError } from '@/lib/recruitment/errors'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getRecruitmentVacancy: vi.fn(),
  getRequestAuthorizationContext: vi.fn(),
  permissionErrorResponse: vi.fn(() => null),
  requireAnyPermission: vi.fn(),
  requirePermission: vi.fn(),
  requireTenantModule: vi.fn(),
  saveRecruitmentVacancy: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  getRequestAuthorizationContext: mocks.getRequestAuthorizationContext,
  permissionErrorResponse: mocks.permissionErrorResponse,
  requireAnyPermission: mocks.requireAnyPermission,
  requirePermission: mocks.requirePermission,
}))
vi.mock('@/lib/modules/module-service', () => ({ requireTenantModule: mocks.requireTenantModule }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/recruitment/vacancy-service', async () => {
  const actual = await vi.importActual<typeof import('@/lib/recruitment/vacancy-service')>('@/lib/recruitment/vacancy-service')
  return { ...actual, getRecruitmentVacancy: mocks.getRecruitmentVacancy, saveRecruitmentVacancy: mocks.saveRecruitmentVacancy }
})

import { GET, PATCH } from './route'

const vacancy = {
  activeApplicationCount: 0,
  applicationCount: 0,
  id: '11111111-1111-4111-8111-111111111111',
  jobId: null,
  locationLabel: 'Nootdorp',
  maxHours: 40,
  minHours: 32,
  publication: null,
  salaryMax: null,
  salaryMin: null,
  salaryVisible: false,
  sections: [],
  status: 'DRAFT' as const,
  title: 'TEST-RECRUITMENT-VACANCY',
  updatedAt: '2026-08-24T10:00:00.000Z',
  version: 1,
  workMode: 'HYBRID' as const,
}

describe('vacancy detail API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRequestAuthorizationContext.mockResolvedValue({ context: { tenantId: 'tenant', hrGroupId: 'group' }, supabase: {} })
    mocks.requireTenantModule.mockResolvedValue(undefined)
    mocks.requireAnyPermission.mockResolvedValue(undefined)
    mocks.permissionErrorResponse.mockReturnValue(null)
    mocks.requirePermission.mockResolvedValue({ tenantId: 'tenant', hrGroupId: 'group' })
    mocks.createClient.mockResolvedValue({})
  })

  it('levert een detail-readback met no-store', async () => {
    mocks.getRecruitmentVacancy.mockResolvedValue(vacancy)
    const response = await GET(new Request('https://example.test/api/recruitment/vacancies/11111111-1111-4111-8111-111111111111'), { params: Promise.resolve({ vacancyId: vacancy.id }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ data: vacancy })
  })

  it('geeft read-only zonder vacancy-read permission exact 403', async () => {
    mocks.requireAnyPermission.mockRejectedValue(new Error('forbidden'))
    mocks.permissionErrorResponse.mockReturnValue(NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 }))

    const response = await GET(new Request('https://example.test/api/recruitment/vacancies/11111111-1111-4111-8111-111111111111'), { params: Promise.resolve({ vacancyId: vacancy.id }) })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ code: 'FORBIDDEN' })
    expect(mocks.getRecruitmentVacancy).not.toHaveBeenCalled()
  })

  it('geeft 400 voor onvolledige edit-input zonder de service aan te roepen', async () => {
    const response = await PATCH(new Request('https://example.test/api/recruitment/vacancies/11111111-1111-4111-8111-111111111111', { body: JSON.stringify({ expectedVersion: 1, input: { title: '' } }), method: 'PATCH' }), { params: Promise.resolve({ vacancyId: vacancy.id }) })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ code: 'RECRUITMENT_VACANCY_INPUT_INVALID' })
    expect(mocks.saveRecruitmentVacancy).not.toHaveBeenCalled()
  })

  it('behoudt de 409 stale-version response van het bestaande contract', async () => {
    mocks.saveRecruitmentVacancy.mockRejectedValue(new RecruitmentError('RECRUITMENT_VERSION_CONFLICT', 409))
    const input = {
      title: vacancy.title,
      jobId: null,
      locationLabel: vacancy.locationLabel,
      workMode: vacancy.workMode,
      minHours: 32,
      maxHours: 40,
      salaryMin: null,
      salaryMax: null,
      salaryVisible: false,
      sections: ['INTRODUCTION', 'ROLE', 'PROFILE', 'OFFER', 'PROCESS', 'CONTACT'].map((sectionType, sortOrder) => ({ sectionType, title: sectionType, content: '', sortOrder, isVisible: true })),
    }
    const response = await PATCH(new Request('https://example.test/api/recruitment/vacancies/11111111-1111-4111-8111-111111111111', { body: JSON.stringify({ expectedVersion: 1, input }), method: 'PATCH' }), { params: Promise.resolve({ vacancyId: vacancy.id }) })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ code: 'RECRUITMENT_VERSION_CONFLICT' })
  })
})
