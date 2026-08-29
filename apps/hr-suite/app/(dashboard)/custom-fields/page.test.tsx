import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirect, getTranslator, listCustomFieldDefinitions } = vi.hoisted(() => ({
  redirect: vi.fn(),
  getTranslator: vi.fn(),
  listCustomFieldDefinitions: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/components/custom-fields/custom-field-manager', () => ({ CustomFieldManager: () => null }))
vi.mock('@/components/settings/admin-settings-page-header', () => ({ AdminSettingsPageHeader: () => null }))
vi.mock('@/lib/i18n/server', () => ({ getTranslator }))
vi.mock('@/lib/custom-fields/service', () => ({ listCustomFieldDefinitions }))

import { AuthorizationError } from '@/lib/auth/permissions'
import CustomFieldsPage from './page'

const translator = (key: string): string => key

describe('CustomFieldsPage', () => {
  beforeEach(() => {
    redirect.mockReset()
    getTranslator.mockReset()
    listCustomFieldDefinitions.mockReset()
    getTranslator.mockResolvedValue(translator)
  })

  it('redirects unauthorized actors to the access-denied page before loading labels', async () => {
    listCustomFieldDefinitions.mockRejectedValue(new AuthorizationError('Onvoldoende rechten.'))
    redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`)
    })

    await expect(CustomFieldsPage({ searchParams: Promise.resolve({ entity: 'EMPLOYEE' }) })).rejects.toThrow('redirect:/geen-toegang')
    expect(redirect).toHaveBeenCalledWith('/geen-toegang')
    expect(getTranslator).not.toHaveBeenCalled()
  })

  it('keeps the existing definition-loader contract for authorized actors', async () => {
    listCustomFieldDefinitions.mockResolvedValue([])

    await expect(CustomFieldsPage({ searchParams: Promise.resolve({ entity: 'DOCUMENT' }) })).resolves.toBeDefined()
    expect(listCustomFieldDefinitions).toHaveBeenCalledWith('DOCUMENT')
    expect(getTranslator).toHaveBeenNthCalledWith(1, 'customFields')
    expect(getTranslator).toHaveBeenNthCalledWith(2, 'settings')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('rethrows non-authorization failures', async () => {
    const error = new Error('CUSTOM_FIELDS_READ_FAILED')
    listCustomFieldDefinitions.mockRejectedValue(error)

    await expect(CustomFieldsPage({ searchParams: Promise.resolve({}) })).rejects.toBe(error)
    expect(redirect).not.toHaveBeenCalled()
  })
})
