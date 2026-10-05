import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getRequestAuthorizationContext: vi.fn(),
  requirePermission: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock('@/lib/auth/permissions', () => ({
  getRequestAuthorizationContext: mocks.getRequestAuthorizationContext,
  requirePermission: mocks.requirePermission,
}))

import { savePayrollImportDecision } from './decision-api'

const batchId = '60000000-0000-4000-8000-000000000001'
const personId = '70000000-0000-4000-8000-000000000001'

afterEach(() => {
  vi.clearAllMocks()
})

describe('payroll import decision authorization boundary', () => {
  it('fails before any service-role client is created when authorization denies the request', async () => {
    const denial = new Error('permission denied')
    const authorize = vi.fn().mockRejectedValue(denial)
    await expect(savePayrollImportDecision(batchId, personId, {
      decision: {
        match: { action: 'CREATE_EMPLOYEE', confirmed: true },
        incomeRelationshipBySourceRef: {},
        employmentByIncomeRelationship: {},
        sourceFieldDecisions: {},
      },
      expectedDecisionVersion: 0,
    }, { authorize })).rejects.toBe(denial)
    expect(mocks.createAdminClient).not.toHaveBeenCalled()
  })
})
