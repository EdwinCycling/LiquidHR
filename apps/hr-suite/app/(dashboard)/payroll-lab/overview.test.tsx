import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import PayrollLabOverview from './page'

const { access, arrangementStorageReady } = vi.hoisted(() => ({ access: vi.fn(), arrangementStorageReady: vi.fn() }))
vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess: access }))
vi.mock('@/lib/payroll/arrangement-service', () => ({ isArrangementFoundationStorageReady: arrangementStorageReady }))
vi.mock('@/lib/i18n/server', () => ({ getTranslator: async () => (key: string) => key }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))

describe('single Payroll Lab overview', () => {
  beforeEach(() => { vi.clearAllMocks(); access.mockResolvedValue({}); arrangementStorageReady.mockResolvedValue(false) })
  it('contains exactly two functional window links and no future empty modules', async () => {
    const markup = renderToStaticMarkup(await PayrollLabOverview({}))
    expect(markup.match(/href=/g)).toHaveLength(2)
    expect(markup).toContain('href="/payroll-lab/calculations"')
    expect(markup).toContain('href="/payroll-components"')
    expect(markup).toContain('lg:grid-cols-2')
    expect(markup).not.toContain('md:grid-cols-2')
    expect(markup).not.toContain('Cao')
  })
  it('preserves existing run and error deep links without losing the calculation query', async () => {
    await expect(PayrollLabOverview({ searchParams: Promise.resolve({ run: '40000000-0000-4000-8000-000000000001', error: 'PAYROLL_CALCULATION_FAILED' }) })).rejects.toThrow('redirect:/payroll-lab/calculations?run=40000000-0000-4000-8000-000000000001&error=PAYROLL_CALCULATION_FAILED')
  })
  it('forwards supported legacy case selection with an exact run link', async () => {
    await expect(PayrollLabOverview({ searchParams: Promise.resolve({
      run: '40000000-0000-4000-8000-000000000002',
      case: 'GC-NL-001',
    }) })).rejects.toThrow('redirect:/payroll-lab/calculations?run=40000000-0000-4000-8000-000000000002&case=GC-NL-001')
  })
  it('shows the arrangements window only when scoped Payroll storage is available', async () => {
    arrangementStorageReady.mockResolvedValue(true)
    const markup = renderToStaticMarkup(await PayrollLabOverview({}))
    expect(markup.match(/href=/g)).toHaveLength(3)
    expect(markup).toContain('href="/payroll-lab/arrangements"')
    expect(access).toHaveBeenCalledOnce()
    expect(arrangementStorageReady).toHaveBeenCalledWith(await access.mock.results[0]?.value)
  })
  it('ignores untrusted invalid legacy query values', async () => {
    const markup = renderToStaticMarkup(await PayrollLabOverview({ searchParams: Promise.resolve({ run: 'forged', error: '<private>' }) }))
    expect(markup).not.toContain('forged')
    expect(markup).not.toContain('private')
  })
  it.each([[new AuthenticationError(), '/login'], [new AuthorizationError(), '/geen-toegang']])('protects the overview with the existing permissions', async (error, destination) => {
    access.mockRejectedValue(error)
    await expect(PayrollLabOverview({})).rejects.toThrow(`redirect:${destination}`)
  })
})
