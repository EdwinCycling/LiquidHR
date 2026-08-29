import { describe, expect, it } from 'vitest'
import { FailClosedCreditsPort, FailClosedGovernancePort } from './fail-closed-ports'

describe('AI fail-closed production seams', () => {
  it('maakt geen productiecredits beschikbaar zonder Wave 1B-service', async () => {
    const credits = new FailClosedCreditsPort()
    await expect(credits.ensureMonthlyAllowance({ tenantId: 'tenant', hrGroupId: 'group', administrationId: null }, '2026-08'))
      .rejects.toMatchObject({ code: 'CREDITS_UNAVAILABLE' })
  })

  it('laat governance niet stilzwijgend uitvoeren zonder configuratieservice', async () => {
    const governance = new FailClosedGovernancePort()
    await expect(governance.resolve({
      scope: { tenantId: 'tenant', hrGroupId: 'group', administrationId: null },
      actorUserId: 'user',
      feature: {} as Parameters<FailClosedGovernancePort['resolve']>[0]['feature'],
    })).rejects.toMatchObject({ code: 'INTERNAL_CONFIGURATION_ERROR' })
  })
})
