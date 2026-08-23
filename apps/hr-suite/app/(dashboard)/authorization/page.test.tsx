import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirect, requirePermission } = vi.hoisted(() => ({
  redirect: vi.fn(),
  requirePermission: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/auth/permissions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/permissions')>('@/lib/auth/permissions')
  return { ...actual, requirePermission }
})
vi.mock('@/components/organization/authorization-manager', () => ({ AuthorizationManager: () => null }))
vi.mock('@/components/settings/admin-settings-page-header', () => ({ AdminSettingsPageHeader: () => null }))
vi.mock('@/lib/i18n/server', () => ({ getTranslator: vi.fn() }))
vi.mock('@/lib/organization/management-service', () => ({ listAuthorizationMatrix: vi.fn() }))

import { AuthorizationError } from '@/lib/auth/permissions'
import AuthorizationPage from './page'

describe('AuthorizationPage', () => {
  beforeEach(() => {
    redirect.mockReset()
    requirePermission.mockReset()
  })

  it('redirects unauthorized actors to the access-denied page', async () => {
    requirePermission.mockRejectedValue(new AuthorizationError('Onvoldoende rechten.'))
    redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`)
    })

    await expect(AuthorizationPage()).rejects.toThrow('redirect:/geen-toegang')
    expect(redirect).toHaveBeenCalledWith('/geen-toegang')
  })
})
