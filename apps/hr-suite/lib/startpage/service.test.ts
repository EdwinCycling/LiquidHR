import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthContext } from '@/lib/auth/permissions'
import type { ActiveContext } from '@/lib/context/administration-context'
import type { Locale } from '@/lib/i18n/config'
import { createClient } from '@/lib/supabase/server'
import { getStartPageData } from './service'

const mocks = vi.hoisted(() => ({
  listMyReminders: vi.fn(),
  listDirectTeamEmployeeIds: vi.fn(),
  getContinuousAppraisalSummary: vi.fn(),
  listProcessWork: vi.fn(),
  loadTeamAvailability: vi.fn(),
  getUpcomingCalendarItems: vi.fn(),
  listJourneyProjectionsForContext: vi.fn(),
  resolveStoredImageUrl: vi.fn(),
  canUseTeamAi: vi.fn(),
  getPersonalLogbookSummary: vi.fn(),
}))

vi.mock('@/lib/reminders/reminder-service', () => ({ listMyReminders: mocks.listMyReminders }))
vi.mock('@/lib/organization/team-scope', () => ({ listDirectTeamEmployeeIds: mocks.listDirectTeamEmployeeIds }))
vi.mock('@/lib/continuous-appraisal/service', () => ({ getContinuousAppraisalSummary: mocks.getContinuousAppraisalSummary }))
vi.mock('@/lib/process-automation/work-service', () => ({ listProcessWork: mocks.listProcessWork }))
vi.mock('./team-availability-service', () => ({ loadTeamAvailability: mocks.loadTeamAvailability }))
vi.mock('@/lib/company-activities/service', () => ({ getUpcomingCalendarItems: mocks.getUpcomingCalendarItems }))
vi.mock('@/lib/journeys/projection-service', () => ({ listJourneyProjectionsForContext: mocks.listJourneyProjectionsForContext }))
vi.mock('@/lib/storage/image-url', () => ({ resolveStoredImageUrl: mocks.resolveStoredImageUrl }))
vi.mock('@/lib/ai/team-scope', () => ({ canUseTeamAi: mocks.canUseTeamAi }))
vi.mock('@/lib/logbook/service', () => ({ getPersonalLogbookSummary: mocks.getPersonalLogbookSummary }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const queryResponse = { data: [] as unknown[], error: null, count: 0 }
type QueryBuilder = Promise<typeof queryResponse> & Record<string, unknown>

function createQueryBuilder(): QueryBuilder {
  const promise = Promise.resolve(queryResponse)
  const builder = new Proxy(promise as QueryBuilder, {
    get(target, property) {
      if (property === 'then') return target.then.bind(target)
      if (property === 'maybeSingle' || property === 'single') {
        return () => Promise.resolve({ data: null, error: null })
      }
      return () => builder
    },
  })
  return builder
}

describe('getStartPageData locale loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listMyReminders.mockResolvedValue([])
    mocks.listDirectTeamEmployeeIds.mockResolvedValue(null)
    mocks.getContinuousAppraisalSummary.mockResolvedValue(null)
    mocks.listProcessWork.mockResolvedValue({ total: 0, items: [] })
    mocks.loadTeamAvailability.mockResolvedValue(null)
    mocks.getUpcomingCalendarItems.mockResolvedValue([])
    mocks.listJourneyProjectionsForContext.mockResolvedValue([])
    mocks.resolveStoredImageUrl.mockResolvedValue(null)
    mocks.canUseTeamAi.mockReturnValue(false)
    mocks.getPersonalLogbookSummary.mockResolvedValue({ totalCount: 0, latestCreatedAt: null, manualCount: 0, aiCount: 0 })
  })

  it('starts independent Core reads while process work waits for the shared request locale', async () => {
    let resolveLocale: (locale: Locale) => void = () => undefined
    const localePromise = new Promise<Locale>((resolve) => {
      resolveLocale = resolve
    })
    const from = vi.fn(() => createQueryBuilder())
    const supabase = { from } as unknown as Awaited<ReturnType<typeof createClient>>
    const auth = {
      userId: 'synthetic-user',
      tenantId: 'synthetic-tenant',
      hrGroupId: 'synthetic-hr-group',
      administrationId: 'synthetic-administration',
      employeeId: null,
      permissions: ['start-page:read', 'process-task:read', 'workforce:read'],
      activeRoles: ['TENANT_ADMIN'],
    } as unknown as AuthContext
    const activeContext = {
      tenant: { id: 'synthetic-tenant', name: 'Synthetic tenant' },
      activeHrGroup: { id: 'synthetic-hr-group' },
      activeAdministration: null,
      hrGroups: [],
    } as unknown as ActiveContext

    const dataPromise = getStartPageData(undefined, {
      supabase,
      auth,
      activeContext,
      localePromise,
    })

    expect(from).toHaveBeenCalled()
    expect(mocks.listProcessWork).not.toHaveBeenCalled()

    resolveLocale('en')
    const data = await dataPromise

    expect(mocks.listProcessWork).toHaveBeenCalledTimes(2)
    expect(mocks.listProcessWork).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ administrationId: 'synthetic-administration', language: 'en', tab: 'TODO' }),
      expect.objectContaining({ context: auth, supabase }),
    )
    expect(data).toMatchObject({ isHrAdmin: true, isManager: false, scope: 'company', journeyOnly: false })
  })
})
