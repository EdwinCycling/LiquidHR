import { beforeEach, describe, expect, it, vi } from 'vitest'

const { redirect, requireAnyPermission } = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireAnyPermission: vi.fn(),
}))

vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/auth/permissions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/permissions')>('@/lib/auth/permissions')
  return { ...actual, requireAnyPermission }
})
vi.mock('@/components/absence/absence-quick-form', () => ({ AbsenceQuickForm: () => null }))
vi.mock('@/components/layout/page-shell', () => ({ PageShell: ({ children }: { children: unknown }) => children }))
vi.mock('@/components/patterns/page-header', () => ({ PageHeader: () => null }))
vi.mock('@/components/patterns/section-header', () => ({ SectionHeader: () => null }))
vi.mock('@/components/patterns/form-field', () => ({ FormField: () => null }))
vi.mock('@/components/ui/button', () => ({ Button: () => null }))
vi.mock('@/components/ui/dropdown-select', () => ({ DropdownSelect: () => null }))
vi.mock('@/components/ui/surface', () => ({ Surface: ({ children }: { children: unknown }) => children }))
vi.mock('@/lib/absence/service', () => ({ listEmployeeAbsenceEmploymentOptions: vi.fn() }))
vi.mock('@/lib/employment/employment-service', () => ({ getEmployeeEmploymentDetail: vi.fn(), listEmployeesOverview: vi.fn() }))
vi.mock('@/lib/i18n/server', () => ({ getTranslator: vi.fn() }))

import { AuthorizationError } from '@/lib/auth/permissions'
import NewAbsencePage from './page'

describe('NewAbsencePage', () => {
  beforeEach(() => {
    redirect.mockReset()
    requireAnyPermission.mockReset()
  })

  it('redirects unauthorized actors to the access-denied page', async () => {
    requireAnyPermission.mockRejectedValue(new AuthorizationError('Onvoldoende rechten.'))
    redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`)
    })

    await expect(NewAbsencePage({ searchParams: Promise.resolve({}) })).rejects.toThrow('redirect:/geen-toegang')
    expect(redirect).toHaveBeenCalledWith('/geen-toegang')
  })
})
