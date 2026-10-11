import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthenticationError, AuthorizationError } from '@/lib/auth/permissions'
import { ModuleError } from '@/lib/modules/module-service'
import PayrollLabOverview from './page'

const { access, arrangementStorageReady, requirePayrollPermission, requireTenantModule } = vi.hoisted(() => ({ access: vi.fn(), arrangementStorageReady: vi.fn(), requirePayrollPermission: vi.fn(), requireTenantModule: vi.fn() }))
vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess: access }))
vi.mock('@/lib/payroll/arrangement-service', () => ({ isArrangementFoundationStorageReady: arrangementStorageReady }))
vi.mock('@/lib/auth/permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/permissions')>()),
  requirePermission: requirePayrollPermission,
}))
vi.mock('@/lib/modules/module-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/modules/module-service')>()),
  requireTenantModule,
}))
vi.mock('@/lib/i18n/server', () => ({ getTranslator: async () => (key: string) => key }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))

describe('single Payroll Lab overview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    access.mockResolvedValue({})
    arrangementStorageReady.mockResolvedValue(false)
    requirePayrollPermission.mockRejectedValue(new AuthorizationError())
    requireTenantModule.mockResolvedValue(undefined)
  })
  it('contains the calculation, individual payroll, and component windows without empty modules', async () => {
    const markup = renderToStaticMarkup(await PayrollLabOverview({}))
    expect(markup.match(/href=/g)).toHaveLength(4)
    expect(markup).toContain('href="/payroll"')
    expect(markup).toContain('href="/payroll-lab/calculations"')
    expect(markup).toContain('href="/payroll-lab/salarisverwerking"')
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
    expect(markup.match(/href=/g)).toHaveLength(5)
    expect(markup).toContain('href="/payroll-lab/arrangements"')
    expect(access).toHaveBeenCalledOnce()
    expect(arrangementStorageReady).toHaveBeenCalledWith(await access.mock.results[0]?.value)
  })
  it('shows integration settings only when payroll permission and module gates pass', async () => {
    requirePayrollPermission.mockResolvedValue({ permissions: ['payroll:read'] })
    requireTenantModule.mockRejectedValueOnce(new ModuleError('MODULE_NOT_ACTIVE', 404))
    const markup = renderToStaticMarkup(await PayrollLabOverview({}))
    expect(markup).not.toContain('href="/payroll-lab/integrations"')
    expect(requireTenantModule).toHaveBeenCalledWith('PAYROLL')

    requireTenantModule.mockResolvedValue(undefined)
    const enabledMarkup = renderToStaticMarkup(await PayrollLabOverview({}))
    expect(enabledMarkup).toContain('href="/payroll-lab/integrations"')
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
