import { beforeEach, describe, expect, it, vi } from 'vitest'

const { openPayrollCycle, revalidatePath, redirect, requireComponentLibraryAccess, createPayslipArtifact } = vi.hoisted(() => ({
  openPayrollCycle: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }),
  requireComponentLibraryAccess: vi.fn(),
  createPayslipArtifact: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/payroll/payroll-cycle-service', () => ({ openPayrollCycle }))
vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess }))
vi.mock('@/lib/payroll/payroll-professional-service', () => ({ createPayrollProfessionalPayslipPdfArtifactForRun: createPayslipArtifact }))

import { generatePayrollPayslipPdfArtifact, openSelectedPayrollPeriod } from './actions'

function formData(period: string): FormData {
  const form = new FormData()
  form.set('period', period)
  return form
}

function runFormData(runId: string): FormData {
  const form = new FormData()
  form.set('runId', runId)
  return form
}

describe('Payroll Professional period action', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(['', '2026-00', '2026-13', '1999-12', '2201-01'])('rejects invalid period %s before the write service', async (period) => {
    await expect(openSelectedPayrollPeriod({ message: null }, formData(period))).resolves.toEqual({ message: 'invalid' })
    expect(openPayrollCycle).not.toHaveBeenCalled()
  })

  it('opens the selected period and redirects to the scoped run page', async () => {
    await expect(openSelectedPayrollPeriod({ message: null }, formData('2026-10')))
      .rejects.toThrow('REDIRECT:/payroll/runs?period=2026-10')

    expect(openPayrollCycle).toHaveBeenCalledWith({ year: 2026, month: 10 })
    expect(revalidatePath).toHaveBeenNthCalledWith(1, '/payroll/runs')
    expect(revalidatePath).toHaveBeenNthCalledWith(2, '/payroll')
    expect(redirect).toHaveBeenCalledWith('/payroll/runs?period=2026-10')
  })

  it('maps closed periods, authorization errors, and unexpected failures to business messages', async () => {
    openPayrollCycle.mockRejectedValueOnce(Object.assign(new Error('closed'), { code: 'PAYROLL_CYCLE_CLOSED' }))
    await expect(openSelectedPayrollPeriod({ message: null }, formData('2026-10'))).resolves.toEqual({ message: 'closed' })

    openPayrollCycle.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'AuthorizationError' }))
    await expect(openSelectedPayrollPeriod({ message: null }, formData('2026-10'))).resolves.toEqual({ message: 'accessDenied' })

    openPayrollCycle.mockRejectedValueOnce(new Error('unavailable'))
    await expect(openSelectedPayrollPeriod({ message: null }, formData('2026-10'))).resolves.toEqual({ message: 'failed' })
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe('Payroll Professional saved payslip action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireComponentLibraryAccess.mockResolvedValue({ scope: { tenantId: 'tenant' }, administration: { id: 'admin' }, actorUserId: 'actor' })
    createPayslipArtifact.mockResolvedValue({ artifact_type: 'PAYSLIP_PDF' })
  })

  it('rejects an invalid run id before accessing the payroll artifact service', async () => {
    await expect(generatePayrollPayslipPdfArtifact(runFormData('not-a-run')))
      .rejects.toThrow('REDIRECT:/payroll/runs?artifact=invalid')
    expect(requireComponentLibraryAccess).not.toHaveBeenCalled()
    expect(createPayslipArtifact).not.toHaveBeenCalled()
  })

  it('creates the PDF through HR Admin write scope and redirects for persisted readback', async () => {
    const runId = 'c0851b89-5f92-5bd4-95b6-b5d8520cf5dc'
    await expect(generatePayrollPayslipPdfArtifact(runFormData(runId)))
      .rejects.toThrow(`REDIRECT:/payroll/runs/${runId}?artifact=created`)

    expect(requireComponentLibraryAccess).toHaveBeenCalledWith(true)
    expect(createPayslipArtifact).toHaveBeenCalledWith({
      scope: { tenantId: 'tenant' },
      payrollAdministrationId: 'admin',
      actorUserId: 'actor',
      runId,
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/payroll/runs/${runId}`)
  })

  it('reports an authorization or artifact failure without claiming persistence', async () => {
    requireComponentLibraryAccess.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'AuthorizationError' }))
    await expect(generatePayrollPayslipPdfArtifact(runFormData('c0851b89-5f92-5bd4-95b6-b5d8520cf5dc')))
      .rejects.toThrow('REDIRECT:/payroll/runs/c0851b89-5f92-5bd4-95b6-b5d8520cf5dc?artifact=failed')
    expect(createPayslipArtifact).not.toHaveBeenCalled()
  })
})
