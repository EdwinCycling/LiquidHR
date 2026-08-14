import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listSalaryStructureCatalog, redirect } = vi.hoisted(() => ({
  listSalaryStructureCatalog: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/lib/salary-structures/service', () => ({ listSalaryStructureCatalog }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/settings/administration-selection', () => ({
  requireAdministrationSettingsContext: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/lib/i18n/server', () => ({
  getLocale: vi.fn().mockResolvedValue('nl'),
  getTranslator: vi.fn().mockResolvedValue((key: string) => key),
}))
vi.mock('@/components/master-data/salary-structures-manager', () => ({
  SalaryStructuresManager: () => null,
}))
vi.mock('@/components/settings/admin-settings-page-header', () => ({
  AdminSettingsPageHeader: () => null,
}))
vi.mock('@/components/settings/administration-settings-context-bar', () => ({
  AdministrationSettingsContextBar: () => null,
}))

import { AuthorizationError } from '@/lib/auth/permissions'
import SalaryScalesPage from './page'

describe('SalaryScalesPage', () => {
  beforeEach(() => {
    listSalaryStructureCatalog.mockReset()
    redirect.mockReset()
  })

  it('redirects unauthorized actors instead of rendering a server error', async () => {
    listSalaryStructureCatalog.mockRejectedValue(new AuthorizationError('Onvoldoende rechten.'))
    redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`)
    })

    await expect(SalaryScalesPage()).rejects.toThrow('redirect:/geen-toegang')
    expect(redirect).toHaveBeenCalledWith('/geen-toegang')
  })
})
