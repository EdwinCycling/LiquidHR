import { describe, expect, it, vi } from 'vitest'
import { AuthorizationError } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import PayrollLabPage from './page'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string): never => { throw new Error(`redirect:${path}`) }),
}))

vi.mock('@/lib/auth/permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/permissions')>()),
  requirePermission: vi.fn(),
}))

vi.mock('@/lib/payroll/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/payroll/access')>()),
  resolvePayrollLabAdministration: vi.fn(),
}))

import { requirePermission } from '@/lib/auth/permissions'
import { resolvePayrollLabAdministration } from '@/lib/payroll/access'

describe('Payroll Lab protected shell route', () => {
  it('rejects direct visits without salary:read', async () => {
    vi.mocked(requirePermission).mockRejectedValue(new AuthorizationError('forbidden'))

    await expect(PayrollLabPage()).rejects.toThrow('redirect:/geen-toegang')
    expect(requirePermission).toHaveBeenCalledWith('salary:read')
    expect(resolvePayrollLabAdministration).not.toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith('/geen-toegang')
  })

  it('rejects direct visits when the global flag or administration capability denies access', async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      tenantId: '11111111-1111-4111-8111-111111111111',
      hrGroupId: '22222222-2222-4222-8222-222222222222',
      administrationId: '33333333-3333-4333-8333-333333333333',
      userId: '44444444-4444-4444-8444-444444444444',
      employeeId: null,
      activeRoles: ['HR_ADMIN'],
      permissions: ['salary:read'],
    })
    vi.mocked(resolvePayrollLabAdministration).mockResolvedValue(null)

    await expect(PayrollLabPage()).rejects.toThrow('redirect:/geen-toegang')
    expect(resolvePayrollLabAdministration).toHaveBeenCalled()
    expect(redirect).toHaveBeenCalledWith('/geen-toegang')
  })
})
