import { beforeEach, describe, expect, it, vi } from 'vitest'

const { openPayrollCycle, revalidatePath, redirect, requireComponentLibraryAccess, createPayslipArtifact, calculateEmployee, reviewEmployee, finalizeEmployee } = vi.hoisted(() => ({
  openPayrollCycle: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }),
  requireComponentLibraryAccess: vi.fn(),
  createPayslipArtifact: vi.fn(),
  calculateEmployee: vi.fn(),
  reviewEmployee: vi.fn(),
  finalizeEmployee: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/payroll/payroll-cycle-service', () => ({ openPayrollCycle }))
vi.mock('@/lib/payroll/component-library-access', () => ({ requireComponentLibraryAccess }))
vi.mock('@/lib/payroll/payroll-professional-service', () => ({ createPayrollProfessionalPayslipPdfArtifactForRun: createPayslipArtifact }))
vi.mock('@/lib/payroll/employee-payroll-calculation-service', () => ({
  calculateEmployeePayroll: calculateEmployee,
  reviewEmployeePayroll: reviewEmployee,
  finalizeEmployeePayroll: finalizeEmployee,
}))

import { generatePayrollPayslipPdfArtifact, openSelectedPayrollPeriod, recalculatePayrollEmployee } from './actions'

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

function employeeFormData(periodKey = '2026-10'): FormData {
  const form = new FormData()
  form.set('periodKey', periodKey)
  form.set('employeeRef', '10000000-0000-4000-8000-000000000011|10000000-0000-4000-8000-000000000021')
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

describe('Payroll Professional employee recalculation action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    calculateEmployee.mockResolvedValue({ status: 'CALCULATED' })
  })

  it('rejects an invalid employee reference before calling the calculation service', async () => {
    const form = employeeFormData()
    form.set('employeeRef', 'not-a-reference')

    await expect(recalculatePayrollEmployee(form)).rejects.toThrow('REDIRECT:/payroll/runs?period=2026-10&recalculation=invalid')
    expect(calculateEmployee).not.toHaveBeenCalled()
  })

  it('recalculates one scoped employee and reports the persisted concept outcome', async () => {
    await expect(recalculatePayrollEmployee(employeeFormData()))
      .rejects.toThrow('REDIRECT:/payroll/runs?period=2026-10&recalculation=calculated')

    expect(calculateEmployee).toHaveBeenCalledWith({
      employeeId: '10000000-0000-4000-8000-000000000011',
      employmentId: '10000000-0000-4000-8000-000000000021',
      period: { year: 2026, month: 10 },
    })
    expect(revalidatePath).toHaveBeenNthCalledWith(1, '/payroll/runs')
    expect(revalidatePath).toHaveBeenNthCalledWith(2, '/payroll')
  })

  it('accepts the separate employee and employment fields used by the per-row form', async () => {
    const form = new FormData()
    form.set('periodKey', '2026-10')
    form.set('employeeId', '10000000-0000-4000-8000-000000000011')
    form.set('employmentId', '10000000-0000-4000-8000-000000000021')

    await expect(recalculatePayrollEmployee(form))
      .rejects.toThrow('REDIRECT:/payroll/runs?period=2026-10&recalculation=calculated')
    expect(calculateEmployee).toHaveBeenCalledTimes(1)
  })

  it('reports a correction requirement without mutating the finalized run in the action layer', async () => {
    calculateEmployee.mockResolvedValue({ status: 'CORRECTION_REQUIRED' })

    await expect(recalculatePayrollEmployee(employeeFormData()))
      .rejects.toThrow('REDIRECT:/payroll/runs?period=2026-10&recalculation=correctionRequired')

    expect(calculateEmployee).toHaveBeenCalledTimes(1)
  })
})
