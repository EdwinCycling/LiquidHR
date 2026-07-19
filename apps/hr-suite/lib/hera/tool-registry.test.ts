import { describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { dispatchHeRaTool } from './tool-registry'

const context: AuthContext = {
  tenantId: 'tenant-1',
  administrationId: 'administration-1',
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: ['HR_MANAGER'],
  permissions: ['salary:read'],
}

describe('dispatchHeRaTool', () => {
  it('weigert tenant- en gebruikersscope uit modelargumenten', async () => {
    const analyzeSalaryThreshold = vi.fn()

    await expect(dispatchHeRaTool(context, {
      name: 'analyze_salary_threshold',
      args: { amount: 6000, asOfDate: '2026-07-17', tenantId: 'tenant-2' },
    }, { analyzeSalaryThreshold })).rejects.toMatchObject({ code: 'HERA_TOOL_INPUT_INVALID' })

    expect(analyzeSalaryThreshold).not.toHaveBeenCalled()
  })

  it('stuurt alleen gevalideerde businessargumenten door', async () => {
    const analyzeSalaryThreshold = vi.fn().mockResolvedValue({ source: 'LIQUID_HR' })

    await dispatchHeRaTool(context, {
      name: 'analyze_salary_threshold',
      args: { amount: 6000, asOfDate: '2026-07-17' },
    }, { analyzeSalaryThreshold })

    expect(analyzeSalaryThreshold).toHaveBeenCalledWith(context, {
      amount: 6000,
      asOfDate: '2026-07-17',
    })
  })

  it('weigert scopeverbreding voor medewerker-, dienstverband- en organisatietools', async () => {
    const calls = [
      { name: 'search_visible_employees', args: { query: 'Eva', limit: 10, tenantId: 'tenant-2' } },
      { name: 'get_visible_employment', args: { employeeId: 'employee-2', asOfDate: '2026-07-17', userId: 'user-2' } },
      { name: 'get_visible_organization', args: { asOfDate: '2026-07-17', administrationId: 'administration-2' } },
    ]

    for (const call of calls) {
      await expect(dispatchHeRaTool(context, call, {})).rejects.toMatchObject({
        code: 'HERA_TOOL_INPUT_INVALID',
      })
    }
  })
})
