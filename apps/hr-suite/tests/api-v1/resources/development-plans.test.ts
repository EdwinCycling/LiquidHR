import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listSelfDevelopmentPlans } = vi.hoisted(() => ({
  listSelfDevelopmentPlans: vi.fn(),
}))

vi.mock('@/lib/talent/goal-service', () => ({ listSelfDevelopmentPlans }))

import { createSupabaseBearerRlsBinding } from '@/lib/api-v1/auth/bearer-rls'
import type { AuthContext } from '@/lib/auth/permissions'
import type { TalentSelfDevelopmentPlan } from '@/lib/talent/goal-service'
import { ApiResourceProjectionError } from '@/lib/api-v1/resources/projections'
import { readSelfDevelopmentPlans } from '@/lib/api-v1/resources/development-plans'

const context = (employeeId: string | null): AuthContext => ({
  tenantId: 'tenant-id',
  hrGroupId: 'hr-group-id',
  administrationId: 'administration-id',
  userId: 'user-id',
  employeeId,
  activeRoles: ['EMPLOYEE'],
  permissions: ['self:talent-goal:read'],
})

const plans = (employeeId: string, tenantId = 'tenant-id'): TalentSelfDevelopmentPlan[] => [{
  tenant_id: tenantId,
  employee_id: employeeId,
  period_start: '2026-01-01',
  period_end: '2026-12-31',
  progress_percent: 50,
  status: 'ACTIVE',
  completed_at: null,
}]

describe('APIAI-01 self development-plan adapter', () => {
  const rls = createSupabaseBearerRlsBinding({
    supabaseUrl: 'http://localhost:54321',
    publishableKey: 'sb_publishable_test',
    accessToken: 'synthetic.access-token.signature',
    supabaseUserId: 'user-id',
    identity: { issuer: 'https://issuer.synthetic.invalid', subject: 'subject-1' },
    account: { userId: 'user-id' },
  })

  beforeEach(() => {
    listSelfDevelopmentPlans.mockReset()
  })

  it('passes the validated bearer context and exact RLS client to the existing self service', async () => {
    const authContext = context('employee-id')
    listSelfDevelopmentPlans.mockResolvedValue(plans('employee-id'))

    await expect(readSelfDevelopmentPlans({ authContext, rls })).resolves.toEqual([{
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      progressPercent: 50,
      status: 'ACTIVE',
      completedAt: null,
    }])

    expect(listSelfDevelopmentPlans).toHaveBeenCalledWith({ authContext, rls })
  })

  it('does not accept a client-selected employee and rejects a mismatched service row', async () => {
    listSelfDevelopmentPlans.mockResolvedValue(plans('other-employee-id'))

    await expect(readSelfDevelopmentPlans({ authContext: context('employee-id'), rls })).rejects.toMatchObject({
      code: 'SELF_SCOPE_MISMATCH',
    })
  })

  it('fails closed before querying when the current context has no employee', async () => {
    await expect(readSelfDevelopmentPlans({ authContext: context(null), rls })).rejects.toBeInstanceOf(ApiResourceProjectionError)
    expect(listSelfDevelopmentPlans).not.toHaveBeenCalled()
  })
})
