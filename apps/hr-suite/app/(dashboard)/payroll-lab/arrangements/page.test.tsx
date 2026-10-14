import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ARRANGEMENT_PACKAGES, SYNTHETIC_ARRANGEMENT_FIXTURES } from '@/lib/payroll/arrangement-foundation'
import PayrollArrangementsPage from './page'

const { loadPage, loadRequestContext } = vi.hoisted(() => ({ loadPage: vi.fn(), loadRequestContext: vi.fn() }))

vi.mock('@/lib/payroll/arrangement-service', () => ({ loadArrangementFoundationPage: loadPage }))
vi.mock('@/lib/auth/permissions', () => ({
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
  getRequestAuthorizationContext: loadRequestContext,
}))
vi.mock('@/lib/i18n/server', () => ({
  getTranslator: async () => (key: string, values?: Record<string, string>) => (
    values ? `${key} ${Object.values(values).join(' ')}` : key
  ),
}))
vi.mock('@/app/(dashboard)/payroll-lab/arrangements/actions', () => ({
  endArrangementPackageAvailabilityAction: vi.fn(),
  extendArrangementPackageAvailabilityStartAction: vi.fn(),
  makeArrangementPackagesAvailableAction: vi.fn(),
}))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))

function pageData(canWrite = true) {
  return {
    administrationName: 'PAYLAB GC-NL-001 — Mars BV',
    today: '2026-10-14',
    packages: ARRANGEMENT_PACKAGES.map((definition) => ({ definition, availability: null, available: false })),
    assignments: SYNTHETIC_ARRANGEMENT_FIXTURES.map((fixture, index) => ({
      id: `assignment-${index}`,
      fixture_code: fixture.code,
      source_employment_id: fixture.sourceEmploymentId,
      package_id: fixture.allowedPackageIds[0]!,
      salary_strategy: fixture.salaryStrategy,
      effective_from: fixture.effectiveFrom,
      is_primary: true,
    })),
    snapshots: [],
    canWrite,
  }
}

describe('Payroll arrangements catalogue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadRequestContext.mockResolvedValue({ activeContext: { activeAdministration: { name: 'Mars BV' } } })
    loadPage.mockResolvedValue(pageData())
  })

  it('shows a compact catalogue with separate catalogue, administration, and payroll validation states', async () => {
    const markup = renderToStaticMarkup(await PayrollArrangementsPage({ searchParams: Promise.resolve({}) }))

    expect(markup).toContain('arrangementsNameKinderopvang')
    expect(markup).toContain('arrangementsNameRetailMode')
    expect(markup).toContain('arrangementsNameOpenSalaryBands')
    expect(markup).toContain('arrangementsInCatalogue')
    expect(markup).toContain('arrangementsNoAvailabilityRecord')
    expect(markup).toContain('arrangementsCalculationNotValidated')
    expect(markup).toContain('arrangementsVersionHistory')
    expect(markup).toContain('arrangementsSourceInformation')
    expect(markup).toContain('2026.09')
    expect(markup).toContain('arrangementsSearchLabel')
    expect(markup).toContain('arrangementsTypeFilter')
    expect(markup).toContain('arrangementsStatusFilter')
    expect(markup).toContain('arrangementsSortLabel')
    expect(markup).toContain('arrangementsCatalogueNotice')
    for (const fixture of SYNTHETIC_ARRANGEMENT_FIXTURES) expect(markup).not.toContain(fixture.code)
    expect(markup).not.toContain('LHR_DEMO_OPEN_BANDS_2026')
    expect(markup).not.toContain('CAO-BENCH02')
    expect(markup).not.toContain('PAYLAB GC-NL-001')
    expect(markup).toContain('/payroll-lab/development/arrangements')
  })

  it('applies search, type, availability, and sorting filters from URL state', async () => {
    const markup = renderToStaticMarkup(await PayrollArrangementsPage({ searchParams: Promise.resolve({
      q: 'open',
      kind: 'COMPANY_POLICY',
      status: 'unavailable',
      sort: 'version',
    }) }))

    expect(markup).toContain('arrangementsNameOpenSalaryBands')
    expect(markup).toContain('name="q"')
    expect(markup).toContain('value="open"')
    const catalogueLinks = [...markup.matchAll(/href="([^"]+)"/g)]
      .map((match) => match[1]!)
      .filter((href) => href.startsWith('/payroll-lab/arrangements?'))
    expect(catalogueLinks).toHaveLength(1)
    expect(catalogueLinks[0]).toContain('package=open-salary-bands')
    expect(catalogueLinks[0]).not.toMatch(/package=(kinderopvang|retail-mode)/)
  })

  it('shows the explicit availability action only to an authorized writer and scopes it to the active administration', async () => {
    const writable = renderToStaticMarkup(await PayrollArrangementsPage({ searchParams: Promise.resolve({}) }))
    expect(writable).toContain('<details>')
    expect(writable).toContain('<summary')
    expect(writable).toContain('arrangementsAdminActionTitle')
    expect(writable).toContain('arrangementsAdminActionScope Mars BV')
    expect(writable).toContain('arrangementsAdminActionPackages')
    expect(writable).toContain('arrangementsNameKinderopvang, arrangementsNameRetailMode, arrangementsNameOpenSalaryBands')
    expect(writable).toContain('arrangementsAdminActionPermission')
    expect(writable).toContain('arrangementsMakeAvailableAction')
    expect(writable).toContain('name="effectiveFrom"')
    expect(writable).toContain('value="2026-10-14"')

    loadPage.mockResolvedValue(pageData(false))
    const readOnly = renderToStaticMarkup(await PayrollArrangementsPage({ searchParams: Promise.resolve({}) }))
    expect(readOnly).not.toContain('arrangementsMakeAvailableAction')
    expect(readOnly).toContain('arrangementsAdminPermissionRequired')
  })

  it('renders a recoverable storage state when the scoped catalogue is unavailable', async () => {
    loadPage.mockRejectedValue(Object.assign(new Error('unavailable'), { code: 'ARRANGEMENT_STORAGE_UNAVAILABLE' }))
    const markup = renderToStaticMarkup(await PayrollArrangementsPage({ searchParams: Promise.resolve({}) }))
    expect(markup).toContain('arrangementsStorageUnavailable')
    expect(markup).toContain('role="status"')
  })
})
