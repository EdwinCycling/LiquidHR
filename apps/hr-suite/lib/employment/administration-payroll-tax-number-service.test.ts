import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requirePermission, rpc } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requirePermission: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/permissions', () => ({ requirePermission }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { registerAdministrationPayrollTaxNumber } from './administration-payroll-tax-number-service'

const context = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  hrGroupId: '22222222-2222-4222-8222-222222222222',
  administrationId: '33333333-3333-4333-8333-333333333333',
  activeRoles: ['HR_ADMIN'],
}

describe('registerAdministrationPayrollTaxNumber', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    requirePermission.mockResolvedValue(context)
    rpc.mockResolvedValue({ data: '44444444-4444-4444-8444-444444444444', error: null })
    createClient.mockResolvedValue({ rpc })
  })

  it('rejects an employer suffix that is not part of a full payroll tax number', async () => {
    await expect(registerAdministrationPayrollTaxNumber({
      payrollTaxNumber: '36413378892',
      validFrom: '2018-01-01',
      isPrimary: true,
    })).rejects.toMatchObject({ code: 'PAYROLL_TAX_NUMBER_INPUT_INVALID', status: 400 })
    expect(requirePermission).not.toHaveBeenCalled()
  })

  it('rejects invalid or reversed effective dates', async () => {
    await expect(registerAdministrationPayrollTaxNumber({
      payrollTaxNumber: '364133788L92',
      validFrom: '2018-02-30',
      isPrimary: true,
    })).rejects.toMatchObject({ code: 'PAYROLL_TAX_NUMBER_INPUT_INVALID', status: 400 })
    await expect(registerAdministrationPayrollTaxNumber({
      payrollTaxNumber: '364133788L92',
      validFrom: '2018-01-01',
      validUntil: '2017-12-31',
      isPrimary: true,
    })).rejects.toMatchObject({ code: 'PAYROLL_TAX_NUMBER_INPUT_INVALID', status: 400 })
  })

  it('requires a scoped HR Admin or Tenant Admin with salary write', async () => {
    requirePermission.mockResolvedValueOnce({ ...context, activeRoles: ['MANAGER'] })
    await expect(registerAdministrationPayrollTaxNumber({
      payrollTaxNumber: '364133788L92',
      validFrom: '2018-01-01',
      isPrimary: true,
    })).rejects.toMatchObject({ code: 'PAYROLL_TAX_NUMBER_FORBIDDEN', status: 403 })
    expect(createClient).not.toHaveBeenCalled()
  })

  it('records the exact administration scope and effective period through the scoped RPC', async () => {
    await expect(registerAdministrationPayrollTaxNumber({
      payrollTaxNumber: '364133788L92',
      validFrom: '2018-01-01',
      validUntil: '2026-12-31',
      isPrimary: true,
    })).resolves.toBe('44444444-4444-4444-8444-444444444444')

    expect(requirePermission).toHaveBeenCalledWith('salary:write')
    expect(rpc).toHaveBeenCalledWith('register_administration_payroll_tax_number', {
      requested_administration_id: context.administrationId,
      requested_payroll_tax_number: '364133788L92',
      requested_valid_from: '2018-01-01',
      requested_valid_until: '2026-12-31',
      requested_is_primary: true,
    })
  })

  it('maps overlapping registration periods to a user-safe conflict', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'PAYROLL_TAX_NUMBER_CONFLICT' } })
    await expect(registerAdministrationPayrollTaxNumber({
      payrollTaxNumber: '364133788L92',
      validFrom: '2018-01-01',
      isPrimary: true,
    })).rejects.toMatchObject({ code: 'PAYROLL_TAX_NUMBER_CONFLICT', status: 409 })
  })
})
