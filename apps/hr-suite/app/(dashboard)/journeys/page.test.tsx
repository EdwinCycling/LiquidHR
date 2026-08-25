import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getRequestAuthorizationContext, getJourneyLabels, getLocale, journeyList, listJourneyProjections, requirePermission } = vi.hoisted(() => ({
  getRequestAuthorizationContext: vi.fn(),
  getJourneyLabels: vi.fn(),
  getLocale: vi.fn(),
  journeyList: vi.fn(),
  listJourneyProjections: vi.fn(),
  requirePermission: vi.fn(),
}))

vi.mock('@/components/journeys/journey-live-overview', () => ({
  JourneyLiveOverview: ({ canWrite, mode }: { canWrite?: boolean; mode: string }) => `${mode}:${String(canWrite)}`,
}))
vi.mock('@/lib/journeys', () => ({ journeyRuntime: { list: journeyList }, listJourneyProjections }))
vi.mock('@/lib/journeys/labels', () => ({ getJourneyLabels }))
vi.mock('@/lib/i18n/server', () => ({ getLocale }))
vi.mock('@/lib/auth/permissions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/permissions')>('@/lib/auth/permissions')
  return { ...actual, getRequestAuthorizationContext, requirePermission }
})

import { AuthorizationError } from '@/lib/auth/permissions'
import JourneyLivePage from './page'

describe('JourneyLivePage', () => {
  beforeEach(() => {
    getRequestAuthorizationContext.mockReset()
    getJourneyLabels.mockReset().mockResolvedValue({})
    getLocale.mockReset().mockResolvedValue('nl')
    journeyList.mockReset().mockResolvedValue([])
    listJourneyProjections.mockReset().mockResolvedValue([])
    requirePermission.mockReset()
  })

  it('keeps self and participant actors on the actor-safe projection list', async () => {
    getRequestAuthorizationContext.mockResolvedValue({ context: { permissions: ['self:journey:read'] } })

    const result = await JourneyLivePage({ searchParams: Promise.resolve({ q: 'Noah', status: 'ACTIVE' }) })
    expect(result).toMatchObject({ props: { mode: 'projection', query: { q: 'Noah', status: 'ACTIVE' } } })
    expect(listJourneyProjections).toHaveBeenCalledOnce()
    expect(journeyList).not.toHaveBeenCalled()
    expect(requirePermission).not.toHaveBeenCalled()
  })

  it('keeps HR actors on the management list and derives write visibility separately', async () => {
    getRequestAuthorizationContext.mockResolvedValue({ context: { permissions: ['journey:read'] } })
    requirePermission.mockResolvedValue({ permissions: ['journey:write'] })

    const result = await JourneyLivePage({ searchParams: Promise.resolve({ status: 'ACTIVE' }) })
    expect(result).toMatchObject({ props: { canWrite: true, mode: 'management', query: { status: 'ACTIVE' } } })
    expect(journeyList).toHaveBeenCalledOnce()
    expect(listJourneyProjections).not.toHaveBeenCalled()
  })

  it('does not add management actions when journey write is absent', async () => {
    getRequestAuthorizationContext.mockResolvedValue({ context: { permissions: ['journey:read'] } })
    requirePermission.mockRejectedValue(new AuthorizationError('Onvoldoende rechten.'))

    const result = await JourneyLivePage({ searchParams: Promise.resolve({}) })
    expect(result).toMatchObject({ props: { canWrite: false, mode: 'management' } })
  })
})
