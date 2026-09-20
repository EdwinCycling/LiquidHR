// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTranslator } from '@/lib/i18n/translator'
import { focusData } from '@/components/focus/test-fixtures'
import type { Locale } from '@/lib/i18n/config'
import nl from '@/messages/nl/focus.json'
import en from '@/messages/en/focus.json'
import FocusSectionPage from './page'

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  context: vi.fn(),
  sectionContext: vi.fn(),
  profile: vi.fn(),
  documents: vi.fn(),
  leave: vi.fn(),
  hours: vi.fn(),
  directory: vi.fn(),
  team: vi.fn(),
  process: vi.fn(),
  absenceWork: vi.fn(),
  absenceState: vi.fn(),
}))

vi.mock('@/components/focus/load-focus-page', () => ({ loadFocusPage: mocks.load }))
vi.mock('@/lib/focus/section-service', () => ({
  loadFocusSectionContext: mocks.sectionContext,
  getFocusProfileProjection: mocks.profile,
  getFocusDocuments: mocks.documents,
  getFocusLeaveOverview: mocks.leave,
  getFocusHoursOverview: mocks.hours,
  getFocusDirectory: mocks.directory,
  getFocusAbsenceWork: mocks.absenceWork,
  getFocusAbsenceState: mocks.absenceState,
}))
vi.mock('@/lib/focus/team-service', () => ({ loadFocusTeamCalendarForContext: mocks.team }))
vi.mock('@/lib/process-automation/work-service', () => ({ listProcessWork: mocks.process }))
vi.mock('@/lib/auth/permissions', () => ({ getRequestAuthorizationContext: mocks.context }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') } }))

function setup(experience: 'EMPLOYEE' | 'PREBOARDING' = 'EMPLOYEE', locale: Locale = 'nl') {
  const data = focusData({ experience, isPreboarding: experience === 'PREBOARDING' })
  mocks.load.mockResolvedValue({ data, locale, t: createTranslator(locale === 'nl' ? nl : en), today: '2026-09-17', journeyTitle: 'Onboarding', journeyActionHref: null })
  mocks.sectionContext.mockResolvedValue({
    context: { tenantId: 'tenant-a', hrGroupId: 'group-a', administrationId: 'administration-a', userId: 'user-a', employeeId: data.employee?.id ?? null, activeRoles: [], permissions: ['self:employee:read'] },
    supabase: {}, employeeId: data.employee?.id ?? 'employee-a', permissions: ['self:employee:read'], actAs: null,
  })
  mocks.profile.mockResolvedValue({ name: 'Noah Test', avatarUrl: null, personal: [], contact: [], relations: [], address: [], work: [], bank: null })
  mocks.documents.mockResolvedValue([])
  mocks.leave.mockResolvedValue({ employmentId: null, balances: [], upcoming: [] })
  mocks.hours.mockResolvedValue({ employeeName: 'Noah Test', employmentId: 'employment-a', days: [], canEdit: false, projection: {} })
  mocks.directory.mockResolvedValue({ enabled: true, entries: [] })
  mocks.team.mockResolvedValue({ month: '2026-09', dates: ['2026-09-17'], selectedDate: '2026-09-17', members: [], viewerMode: 'EMPLOYEE', canReportAbsence: false, canRecoverAbsence: false, canActAs: false })
  mocks.process.mockResolvedValue({ items: [], total: 0, hasMore: false })
  mocks.absenceWork.mockResolvedValue([])
  mocks.absenceState.mockResolvedValue(null)
  return data
}

async function render(section: string, query: Record<string, string> = {}) {
  return renderToStaticMarkup(await FocusSectionPage({ params: Promise.resolve({ section }), searchParams: Promise.resolve(query) }))
}

beforeEach(() => {
  vi.clearAllMocks()
  setup()
})

describe('Focus section route boundaries', () => {
  it.each(['aanvragen', 'werk', 'team'])('refuses direct preboarding navigation to %s', async (section) => {
    setup('PREBOARDING')
    await expect(render(section)).rejects.toThrow('NOT_FOUND')
  })

  it.each(['unknown', 'constructor', 'toString'])('refuses unknown section %s', async (section) => {
    await expect(render(section)).rejects.toThrow('NOT_FOUND')
    expect(mocks.load).not.toHaveBeenCalled()
  })

  it('refuses a section without the corresponding server action', async () => {
    const data = setup()
    data.actions = []
    await expect(render('profiel')).rejects.toThrow('NOT_FOUND')
  })

  it('shows only the limited profile and assigned onboarding for preboarding', async () => {
    setup('PREBOARDING')
    const markup = await render('profiel')
    expect(markup).toContain('Noah Test')
    expect(markup).toContain('href="/focus/onboarding"')
    expect(markup).not.toContain('/employees/')
  })

  it('keeps preboarding documents inside Focus', async () => {
    setup('PREBOARDING')
    const markup = await render('documenten')
    expect(markup).toContain('Mijn documenten')
    expect(markup).not.toContain('/employees/')
    expect(markup).not.toContain('/company-documents')
  })

  it.each(['nl', 'en'] as const)('resolves every native section with real %s translations', async (locale) => {
    setup('EMPLOYEE', locale)
    for (const section of ['onboarding', 'profiel', 'documenten', 'verlof', 'uren', 'aanvragen', 'werk', 'team', 'wie-is-wie', 'meer']) {
      const markup = await render(section)
      expect(markup).toContain('href="/focus"')
      expect(markup).not.toMatch(/\{\w+\}/)
    }
  })

  it('keeps the employee sections native and does not link back to the Full portal', async () => {
    expect(await render('profiel')).toContain('Mijn profiel')
    expect(await render('documenten')).toContain('Mijn documenten')
    expect(await render('verlof')).toContain('Verlof aanvragen')
    expect(await render('uren')).toContain('Mijn uren')
    expect(await render('team')).toContain('Mijn team')
    expect(await render('aanvragen')).not.toContain('href="/work"')
    expect(await render('werk')).not.toContain('href="/work"')
  })

  it('does not restrict the manager work queue to the manager employee', async () => {
    const data = setup()
    data.experience = 'MANAGER'
    const workMarkup = await render('werk')

    expect(workMarkup).toContain('Mijn werk')
    expect(mocks.process).toHaveBeenCalledWith(
      expect.objectContaining({ view: 'WORK', tab: 'TODO', subjectEmployeeId: undefined }),
      expect.anything(),
    )
  })
})
