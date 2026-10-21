import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ARRANGEMENT_PACKAGES, SYNTHETIC_ARRANGEMENT_FIXTURES } from '@/lib/payroll/arrangement-foundation'
import DevelopmentArrangementsPage from './page'

const { loadPage, requireAccess } = vi.hoisted(() => ({ loadPage: vi.fn(), requireAccess: vi.fn() }))

vi.mock('@/lib/payroll/arrangement-service', () => ({ loadArrangementFoundationPage: loadPage }))
vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess: requireAccess }))
vi.mock('@/lib/i18n/server', () => ({
  getTranslator: async () => (key: string, values?: Record<string, string>) => (
    values ? `${key} ${Object.values(values).join(' ')}` : key
  ),
}))
vi.mock('@/app/(dashboard)/payroll-lab/arrangements/actions', () => ({
  createSyntheticArrangementAssignmentAction: vi.fn(),
  resolveArrangementCompositionAction: vi.fn(),
}))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))

function pageData(canWrite = true, available = true) {
  return {
    administrationName: 'Jupiter BV',
    today: '2026-10-14',
    packages: ARRANGEMENT_PACKAGES.map((definition) => ({
      definition,
      availability: available ? { effective_from: '2026-07-01', effective_to: '2026-12-31' } : null,
      available,
    })),
    assignments: [],
    snapshots: [],
    canWrite,
  }
}

describe('Internal development arrangements page', () => {
  afterEach(() => vi.unstubAllEnvs())

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    requireAccess.mockResolvedValue({})
    loadPage.mockResolvedValue(pageData())
  })

  it('is clearly marked internal and renders all seven fixture scenarios only in this route', async () => {
    const markup = renderToStaticMarkup(await DevelopmentArrangementsPage({ searchParams: Promise.resolve({}) }))

    expect(markup).toContain('arrangementsDevelopmentTestOnly')
    expect(markup).toContain('arrangementsDevelopmentBannerTitle')
    expect(markup).toContain('arrangementsAdminActionScope Jupiter BV')
    for (const fixture of SYNTHETIC_ARRANGEMENT_FIXTURES) expect(markup).toContain(fixture.code)
    expect(markup).toContain('/payroll-lab/arrangements')

    const loaderOptions = loadPage.mock.calls[0]?.[0]
    expect(loaderOptions).toBeDefined()
    await loaderOptions.requireAccess()
    expect(requireAccess).toHaveBeenCalledWith(true)
  })

  it('shows persisted assignment and snapshot history without exposing it on the ordinary route', async () => {
    const fixture = SYNTHETIC_ARRANGEMENT_FIXTURES[1]!
    const assignment = {
      id: 'a1e00000-0000-4000-8000-000000000010',
      fixture_code: fixture.code,
      source_employment_id: fixture.sourceEmploymentId,
      package_id: 'LHR_DEMO_OPEN_BANDS_2026',
      salary_strategy: 'OPEN_SALARY_BAND',
      effective_from: '2026-09-01',
      is_primary: true,
    }
    const content = {
      employment: { fixtureCode: fixture.code },
      arrangement: { displayName: 'LiquidHR Demo — Open Salarisbanden 2026', version: '2026.07' },
      primaryAssignment: { salaryStrategy: 'OPEN_SALARY_BAND' },
      asOfDate: '2026-09-30',
    }
    loadPage.mockResolvedValue({
      ...pageData(),
      assignments: [assignment],
      snapshots: [{ row: { id: 'a1e00000-0000-4000-8000-000000000011', snapshot_hash: 'a'.repeat(64) }, content }],
    })

    const markup = renderToStaticMarkup(await DevelopmentArrangementsPage({ searchParams: Promise.resolve({}) }))
    expect(markup).toContain('arrangementsCompositionSnapshots')
    expect(markup).toContain('LiquidHR Demo — Open Salarisbanden 2026')
    expect(markup).toContain('2026-09-30')
    expect(markup).toContain('a'.repeat(64))
    const assignmentMarkup = markup.split('<li>').find((section) => section.includes(fixture.code))
    expect(assignmentMarkup).toBeDefined()
    expect(assignmentMarkup).toContain('name="asOfDate"')
    expect(assignmentMarkup).not.toContain('name="packageId"')
  })

  it('hides assignment and snapshot write forms when the active scope is read-only', async () => {
    const fixture = SYNTHETIC_ARRANGEMENT_FIXTURES[1]!
    loadPage.mockResolvedValue({
      ...pageData(false),
      assignments: [{
        id: 'a1e00000-0000-4000-8000-000000000010',
        fixture_code: fixture.code,
        source_employment_id: fixture.sourceEmploymentId,
        package_id: 'LHR_DEMO_OPEN_BANDS_2026',
        salary_strategy: 'OPEN_SALARY_BAND',
        effective_from: '2026-09-01',
        is_primary: true,
      }],
    })
    const markup = renderToStaticMarkup(await DevelopmentArrangementsPage({ searchParams: Promise.resolve({}) }))
    expect(markup).not.toContain('name="asOfDate"')
    expect(markup).toContain('arrangementsWritePermissionRequired')
  })

  it('hides new assignment choices when availability has expired or is missing', async () => {
    loadPage.mockResolvedValue({
      ...pageData(true, false),
      packages: ARRANGEMENT_PACKAGES.map((definition) => ({
        definition,
        availability: { effective_from: '2026-07-01', effective_to: '2026-07-31' },
        available: false,
      })),
    })
    const markup = renderToStaticMarkup(await DevelopmentArrangementsPage({ searchParams: Promise.resolve({}) }))
    expect(markup).not.toContain('name="packageId"')
    expect(markup).toContain('arrangementsNoAvailableAssignmentChoice')
  })

  it('does not expose the internal route in production builds', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(DevelopmentArrangementsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/geen-toegang')
    expect(loadPage).not.toHaveBeenCalled()
  })
})
