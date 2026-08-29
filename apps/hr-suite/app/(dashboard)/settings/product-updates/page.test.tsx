import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirect, getTranslator, listManagedProductUpdates } = vi.hoisted(() => ({
  redirect: vi.fn(),
  getTranslator: vi.fn(),
  listManagedProductUpdates: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/components/layout/page-shell', () => ({ PageShell: ({ children }: { children: unknown }) => children }))
vi.mock('@/components/patterns/page-header', () => ({ PageHeader: () => null }))
vi.mock('@/components/product-updates/product-update-manager', () => ({ ProductUpdateManager: () => null }))
vi.mock('@/lib/i18n/server', () => ({ getTranslator }))
vi.mock('@/lib/product-updates/service', () => ({ listManagedProductUpdates }))

import { AuthorizationError } from '@/lib/auth/permissions'
import ProductUpdatesSettingsPage from './page'

const translator = (key: string): string => key

describe('ProductUpdatesSettingsPage', () => {
  beforeEach(() => {
    redirect.mockReset()
    getTranslator.mockReset()
    listManagedProductUpdates.mockReset()
    getTranslator.mockResolvedValue(translator)
  })

  it('redirects unauthorized actors to the access-denied page before loading labels', async () => {
    listManagedProductUpdates.mockRejectedValue(new AuthorizationError('Onvoldoende rechten.'))
    redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`)
    })

    await expect(ProductUpdatesSettingsPage()).rejects.toThrow('redirect:/geen-toegang')
    expect(redirect).toHaveBeenCalledWith('/geen-toegang')
    expect(getTranslator).not.toHaveBeenCalled()
  })

  it('keeps authorized management data available', async () => {
    listManagedProductUpdates.mockResolvedValue({ updates: [], canManageGlobal: true, canManageTenant: true })

    await expect(ProductUpdatesSettingsPage()).resolves.toBeDefined()
    expect(listManagedProductUpdates).toHaveBeenCalledTimes(1)
    expect(getTranslator).toHaveBeenCalledWith('productUpdates')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('rethrows non-authorization failures', async () => {
    const error = new Error('PRODUCT_UPDATES_READ_FAILED')
    listManagedProductUpdates.mockRejectedValue(error)

    await expect(ProductUpdatesSettingsPage()).rejects.toBe(error)
    expect(redirect).not.toHaveBeenCalled()
  })
})
