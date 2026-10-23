import { beforeEach, describe, expect, it, vi } from 'vitest'

const { AuthorizationError, getPayrollProfessionalRun, getTranslator, getLocale, notFound } = vi.hoisted(() => {
  class AuthorizationError extends Error {}
  return {
    AuthorizationError,
    getPayrollProfessionalRun: vi.fn(),
    getTranslator: vi.fn(),
    getLocale: vi.fn(),
    notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
  }
})

vi.mock('next/navigation', () => ({ notFound }))
vi.mock('@/lib/auth/permissions', () => ({ AuthorizationError }))
vi.mock('@/lib/i18n/server', () => ({ getTranslator, getLocale }))
vi.mock('@/lib/payroll/payroll-professional-service', () => ({
  getPayrollProfessionalPayslipPdfArtifactStatusForRun: vi.fn(),
  getPayrollProfessionalRun,
}))
vi.mock('../actions', () => ({ finalizePayrollRun: vi.fn(), generatePayrollPayslipPdfArtifact: vi.fn(), reviewPayrollRun: vi.fn() }))

import PayrollRunDetailPage from './page'

describe('Payroll run detail page authorization', () => {
  beforeEach(() => {
    getPayrollProfessionalRun.mockReset()
    getTranslator.mockReset().mockResolvedValue((key: string) => key)
    getLocale.mockReset().mockResolvedValue('nl')
    notFound.mockClear()
  })

  it('returns not found when the authenticated actor lacks payroll access', async () => {
    getPayrollProfessionalRun.mockRejectedValue(new AuthorizationError('PAYROLL_UNAVAILABLE'))

    await expect(PayrollRunDetailPage({
      params: Promise.resolve({ runId: 'run-outside-scope' }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow('NEXT_NOT_FOUND')

    expect(notFound).toHaveBeenCalledOnce()
  })
})
