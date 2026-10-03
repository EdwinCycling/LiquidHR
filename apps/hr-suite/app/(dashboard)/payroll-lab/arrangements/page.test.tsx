import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ARRANGEMENT_PACKAGES, SYNTHETIC_ARRANGEMENT_FIXTURES } from '@/lib/payroll/arrangement-foundation'
import PayrollArrangementsPage from './page'

const { loadPage } = vi.hoisted(() => ({ loadPage: vi.fn() }))

vi.mock('@/lib/payroll/arrangement-service', () => ({ loadArrangementFoundationPage: loadPage }))
vi.mock('@/lib/i18n/server', () => ({
  getTranslator: async () => (key: string, values?: Record<string, string>) => (
    values ? `${key} ${Object.values(values).join(' ')}` : key
  ),
}))
vi.mock('./actions', () => ({
  createSyntheticArrangementAssignmentAction: vi.fn(),
  endArrangementPackageAvailabilityAction: vi.fn(),
  makeArrangementPackagesAvailableAction: vi.fn(),
  resolveArrangementCompositionAction: vi.fn(),
}))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))

function pageData(canWrite = true) {
  return {
    administrationName: 'Synthetic Payroll Lab',
    today: '2026-10-03',
    packages: ARRANGEMENT_PACKAGES.map((definition) => ({
      definition,
      availability: { effective_from: '2026-09-01', effective_to: null },
      available: true,
    })),
    assignments: [],
    snapshots: [],
    canWrite,
  }
}

describe('Payroll arrangements page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadPage.mockResolvedValue(pageData())
  })

  it('shows all three versioned arrangements and the three synthetic salary strategies', async () => {
    const markup = renderToStaticMarkup(await PayrollArrangementsPage({ searchParams: Promise.resolve({}) }))

    expect(markup).toContain('KINDEROPVANG_2025_2026')
    expect(markup).toContain('RETAIL_NON_FOOD_MODE_2026_2027')
    expect(markup).toContain('LHR_DEMO_OPEN_BANDS_2026')
    expect(markup).toContain('2026.01')
    expect(markup).toContain('2026.07')
    for (const fixture of SYNTHETIC_ARRANGEMENT_FIXTURES) expect(markup).toContain(fixture.code)
    expect(markup).toContain('arrangementsStrategy_DISCRETE_SCALE_STEP')
    expect(markup).toContain('arrangementsStrategy_OPEN_SALARY_BAND')
    expect(markup).toContain('arrangementsStrategy_FREELY_NEGOTIATED')
    expect(markup).toContain('arrangementsFoundationNotice')
    expect(markup).not.toContain('Jan Test')
    expect(markup).not.toContain('Frank Test')
    expect(markup).toContain('name="effectiveTo"')
    expect(markup).toContain('name="packageId"')
    expect(markup).toContain('aria-haspopup="listbox"')
  })

  it('shows existing assignments and persisted hash-pinned snapshots', async () => {
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

    const markup = renderToStaticMarkup(await PayrollArrangementsPage({ searchParams: Promise.resolve({}) }))
    expect(markup).toContain('LiquidHR Demo — Open Salarisbanden 2026')
    expect(markup).toContain('2026-09-30')
    expect(markup).toContain('a'.repeat(64))
    const assignedFixture = markup.split(fixture.code)[1]?.split(SYNTHETIC_ARRANGEMENT_FIXTURES[2]!.code)[0] ?? ''
    expect(assignedFixture).not.toContain('name="packageId"')
  })

  it('hides write forms when the active context is read-only', async () => {
    loadPage.mockResolvedValue(pageData(false))
    const markup = renderToStaticMarkup(await PayrollArrangementsPage({ searchParams: Promise.resolve({}) }))
    expect(markup).not.toContain('name="packageId"')
    expect(markup).toContain('arrangementsWritePermissionRequired')
  })

  it('hides expired packages from new assignment choices', async () => {
    loadPage.mockResolvedValue({
      ...pageData(),
      packages: ARRANGEMENT_PACKAGES.map((definition) => ({
        definition,
        availability: { effective_from: '2026-09-01', effective_to: '2026-09-10' },
        available: false,
      })),
    })

    const markup = renderToStaticMarkup(await PayrollArrangementsPage({ searchParams: Promise.resolve({}) }))

    expect(markup).not.toContain('name="packageId"')
    expect(markup).toContain('arrangementsNoAvailableAssignmentChoice')
  })
})
