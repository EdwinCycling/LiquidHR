import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requirePermission, createClient, rpc } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  createClient: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requirePermission,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import {
  confirmEmploymentPayrollTaxProfile,
  type ConfirmEmploymentPayrollTaxProfileInput,
} from './employment-payroll-tax-profile-service'

const input: ConfirmEmploymentPayrollTaxProfileInput = {
  employeeId: '00000000-0000-4000-8000-000000000001',
  employmentId: '00000000-0000-4000-8000-000000000002',
  incomeRelationshipId: '00000000-0000-4000-8000-000000000003',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  payrollTaxCreditApplies: true,
  sourceClassification: 'HR_ADMIN_CONFIRMED',
  sourceReference: 'Vastgelegd door HR-beheerder',
  idempotencyKey: '00000000-0000-4000-8000-000000000004',
}

describe('confirmEmploymentPayrollTaxProfile', () => {
  beforeEach(() => {
    requirePermission.mockReset()
    createClient.mockReset()
    rpc.mockReset()
    requirePermission.mockResolvedValue({
      tenantId: '00000000-0000-4000-8000-000000000010',
      hrGroupId: '00000000-0000-4000-8000-000000000011',
      administrationId: '00000000-0000-4000-8000-000000000012',
      activeRoles: ['HR_ADMIN'],
    })
    createClient.mockResolvedValue({ rpc })
    rpc.mockResolvedValue({
      data: { profile_id: '00000000-0000-4000-8000-000000000013', version_number: 1, reused: false },
      error: null,
    })
  })

  it('records only the HR-admin source classification through the immutable profile RPC', async () => {
    const result = await confirmEmploymentPayrollTaxProfile(input)

    expect(result).toEqual({ profileId: '00000000-0000-4000-8000-000000000013', version: 1, reused: false })
    expect(rpc).toHaveBeenCalledWith('confirm_employment_payroll_tax_profile_v2', {
      p_input: expect.objectContaining({
        source_classification: 'HR_ADMIN_CONFIRMED',
        payroll_tax_credit_applies: true,
        source_reference: 'Vastgelegd door HR-beheerder',
      }),
    })
  })

  it('refuses an employee declaration submitted through the HR-admin writing path', async () => {
    const forgedDeclaration = {
      ...input,
      sourceClassification: 'EMPLOYEE_DECLARATION',
    } as unknown as ConfirmEmploymentPayrollTaxProfileInput

    await expect(confirmEmploymentPayrollTaxProfile(forgedDeclaration))
      .rejects.toMatchObject({ code: 'PAYROLL_TAX_PROFILE_INPUT_INVALID', status: 400 })
    expect(createClient).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })
})
