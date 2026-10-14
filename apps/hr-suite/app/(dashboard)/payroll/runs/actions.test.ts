import { beforeEach, describe, expect, it, vi } from 'vitest'

const { openPayrollCycle, revalidatePath, redirect } = vi.hoisted(() => ({
  openPayrollCycle: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`) }),
}))

vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('next/navigation', () => ({ redirect }))
vi.mock('@/lib/payroll/payroll-cycle-service', () => ({ openPayrollCycle }))

import { openSelectedPayrollPeriod } from './actions'

function formData(period: string): FormData {
  const form = new FormData()
  form.set('period', period)
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
