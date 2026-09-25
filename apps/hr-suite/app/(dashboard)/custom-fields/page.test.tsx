import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'

const { redirect, getTranslator, getLocale, listCustomFieldDefinitions, customFieldManager } = vi.hoisted(() => ({
  redirect: vi.fn(),
  getTranslator: vi.fn(),
  getLocale: vi.fn(),
  listCustomFieldDefinitions: vi.fn(),
  customFieldManager: vi.fn(() => null),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/components/custom-fields/custom-field-manager', () => ({ CustomFieldManager: customFieldManager }))
vi.mock('@/components/settings/admin-settings-page-header', () => ({ AdminSettingsPageHeader: () => null }))
vi.mock('@/lib/i18n/server', () => ({ getLocale, getTranslator }))
vi.mock('@/lib/custom-fields/service', () => ({ listCustomFieldDefinitions }))

import { AuthorizationError } from '@/lib/auth/permissions'
import CustomFieldsPage from './page'

const translator = (key: string): string => key

describe('CustomFieldsPage', () => {
  beforeEach(() => {
    redirect.mockReset()
    getTranslator.mockReset()
    getLocale.mockReset()
    listCustomFieldDefinitions.mockReset()
    getTranslator.mockResolvedValue(translator)
    getLocale.mockResolvedValue('en')
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

    const page = await CustomFieldsPage({ searchParams: Promise.resolve({ entity: 'DOCUMENT' }) })
    expect(listCustomFieldDefinitions).toHaveBeenCalledWith('DOCUMENT')
    expect(getTranslator).toHaveBeenNthCalledWith(1, 'customFields')
    expect(getTranslator).toHaveBeenNthCalledWith(2, 'settings')
    expect(getLocale).toHaveBeenCalledOnce()
    const managerElement = Children.toArray((page as ReactElement<{ children: ReactNode }>).props.children).find((element) => isValidElement(element) && element.type === customFieldManager)
    expect((managerElement as ReactElement<{ locale: string }>).props.locale).toBe('en')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('rethrows non-authorization failures', async () => {
    const error = new Error('CUSTOM_FIELDS_READ_FAILED')
    listCustomFieldDefinitions.mockRejectedValue(error)

    await expect(CustomFieldsPage({ searchParams: Promise.resolve({}) })).rejects.toBe(error)
    expect(redirect).not.toHaveBeenCalled()
  })
})
