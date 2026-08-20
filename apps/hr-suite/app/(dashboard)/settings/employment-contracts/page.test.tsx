import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getEmploymentSettings, requireAdministrationSettingsContext, redirect } = vi.hoisted(() => ({
  getEmploymentSettings: vi.fn(),
  requireAdministrationSettingsContext: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/lib/settings/administration-selection', () => ({ requireAdministrationSettingsContext }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/employment/employment-settings', () => ({ getEmploymentSettings }))
vi.mock('@/lib/i18n/server', () => ({
  getLocale: vi.fn(),
  getTranslator: vi.fn(),
}))
vi.mock('@/components/settings/admin-settings-page-header', () => ({ AdminSettingsPageHeader: () => null }))
vi.mock('@/components/settings/administration-settings-context-bar', () => ({ AdministrationSettingsContextBar: () => null }))
vi.mock('@/components/settings/settings-accordion', () => ({ SettingsAccordion: () => null }))
vi.mock('@/components/settings/employment-contract-settings', () => ({
  EmploymentCatalogManager: () => null,
  EmploymentGeneralSettings: () => null,
}))
vi.mock('@/components/settings/employment-regulations-manager', () => ({ EmploymentRegulationsManager: () => null }))
vi.mock('@/components/settings/salary-application-settings', () => ({ SalaryApplicationSettings: () => null }))

import { AuthorizationError } from '@/lib/auth/permissions'
import EmploymentContractSettingsPage from './page'

describe('EmploymentContractSettingsPage', () => {
  beforeEach(() => {
    getEmploymentSettings.mockReset()
    requireAdministrationSettingsContext.mockReset()
    redirect.mockReset()
  })

  it('redirects unauthorized actors instead of rendering a server error', async () => {
    requireAdministrationSettingsContext.mockRejectedValue(new AuthorizationError('Onvoldoende rechten.'))
    redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`)
    })

    await expect(EmploymentContractSettingsPage()).rejects.toThrow('redirect:/geen-toegang')
    expect(redirect).toHaveBeenCalledWith('/geen-toegang')
  })

  it('redirects when the settings service rejects an unauthorized actor', async () => {
    requireAdministrationSettingsContext.mockResolvedValue({})
    getEmploymentSettings.mockRejectedValue(new AuthorizationError('Onvoldoende rechten.'))
    redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`)
    })

    await expect(EmploymentContractSettingsPage()).rejects.toThrow('redirect:/geen-toegang')
    expect(redirect).toHaveBeenCalledWith('/geen-toegang')
  })
})
