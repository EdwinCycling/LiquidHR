import { describe, expect, it } from 'vitest'
import type { AiCreditReservationRequest, AiScope } from './contracts'
import {
  InMemoryLiquidCreditsService,
  type TestGroupPolicy,
  type TestRoleQuota,
} from './liquid-credits-test-double'

const scope: AiScope = {
  tenantId: 'tenant-1',
  hrGroupId: 'group-1',
  administrationId: null,
}

const scopeKey = `${scope.tenantId}:${scope.hrGroupId}`

function mutableClock(iso: string): { now: () => Date; set: (next: string | Date) => void } {
  let current = new Date(iso)
  return {
    now: () => new Date(current),
    set: (next) => {
      current = new Date(next)
    },
  }
}

function service(
  clock: ReturnType<typeof mutableClock>,
  policy: TestGroupPolicy = { monthlyAllowanceCredits: 100, timeZone: 'Europe/Amsterdam' },
  options: {
    actorUserId?: string
    roles?: readonly string[]
    roleQuotas?: Readonly<Record<string, TestRoleQuota>>
  } = {},
): InMemoryLiquidCreditsService {
  const actorUserId = options.actorUserId ?? 'actor-1'
  return new InMemoryLiquidCreditsService({
    now: clock.now,
    groupPolicies: { [scopeKey]: policy },
    actorRoles: { [`${scopeKey}:${actorUserId}`]: options.roles ?? ['HR_ADMIN'] },
    roleQuotas: options.roleQuotas,
  })
}

function request(overrides: Partial<AiCreditReservationRequest> = {}): AiCreditReservationRequest {
  return {
    scope,
    invocationId: 'invocation-1',
    actorUserId: 'actor-1',
    featureCode: 'improve-existing-hr-text',
    chargeReference: 'ai.improve-existing-hr-text.balanced',
    month: '2026-08',
    idempotencyKey: 'key-1',
    ...overrides,
  }
}

describe('Liquid Credits accounting seam', () => {
  it('maakt de maandallowance lazy en idempotent aan', async () => {
    const clock = mutableClock('2026-08-28T12:00:00.000Z')
    const credits = service(clock)

    await credits.ensureMonthlyAllowance(scope, '2026-08')
    await credits.ensureMonthlyAllowance(scope, '2026-08')

    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({
      totalCredits: 100,
      monthlyAllowanceCredits: 100,
      availableCredits: 100,
    })
  })

  it('wijzigt historische allowance niet wanneer het beleid later verandert', async () => {
    const clock = mutableClock('2026-08-15T12:00:00.000Z')
    const credits = service(clock, { monthlyAllowanceCredits: 100, timeZone: 'Europe/Amsterdam' })

    await credits.ensureMonthlyAllowance(scope, '2026-08')
    credits.setGroupPolicy(scope, { monthlyAllowanceCredits: 200, timeZone: 'Europe/Amsterdam' })
    await credits.ensureMonthlyAllowance(scope, '2026-08')
    await credits.ensureMonthlyAllowance(scope, '2026-09')

    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({
      monthlyAllowanceCredits: 300,
      totalCredits: 300,
      availableCredits: 300,
    })
  })

  it('laat extra batches na twaalf maanden vervallen', async () => {
    const clock = mutableClock('2025-01-01T12:00:00.000Z')
    const credits = service(clock)
    credits.grantPurchasedExtra(scope, 20, new Date('2025-01-15T12:00:00.000Z'))

    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({
      purchasedExtraCredits: 20,
      availableCredits: 20,
      expiredCredits: 0,
    })

    clock.set('2026-01-15T12:00:00.000Z')
    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({
      purchasedExtraCredits: 20,
      availableCredits: 0,
      expiredCredits: 20,
    })
  })

  it('consumeert deterministisch eerst de batch met de vroegste expiry en splitst traceerbaar', async () => {
    const clock = mutableClock('2026-08-20T12:00:00.000Z')
    const credits = service(clock, { monthlyAllowanceCredits: 2, timeZone: 'Europe/Amsterdam' })
    await credits.ensureMonthlyAllowance(scope, '2026-08')
    credits.grantPurchasedExtra(scope, 5, new Date('2026-01-01T12:00:00.000Z'))

    const reservation = await credits.reserve(request({
      invocationId: 'invocation-order',
      chargeReference: 'ai.improve-existing-hr-text.in-depth',
      idempotencyKey: 'order-key',
    }))
    const consumption = await credits.readAllocationConsumption({
      reservationId: reservation.reservationId,
      invocationId: reservation.invocationId,
    })

    expect(consumption).toHaveLength(2)
    expect(consumption[0]).toMatchObject({ allocationType: 'MONTHLY_ALLOWANCE', allocatedCredits: 2, reservedCredits: 2 })
    expect(consumption[1]).toMatchObject({ allocationType: 'PURCHASED_EXTRA', allocatedCredits: 1, reservedCredits: 1 })
  })

  it('settlet success permanent en maakt release vóór expiry weer beschikbaar', async () => {
    const clock = mutableClock('2026-08-28T12:00:00.000Z')
    const credits = service(clock)

    const settled = await credits.reserve(request({ invocationId: 'invocation-settle', idempotencyKey: 'settle-key' }))
    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({ reservedCredits: 2, settledCredits: 0, availableCredits: 98 })
    await credits.settle({ reservation: settled, outcome: 'SUCCEEDED' })
    await credits.settle({ reservation: settled, outcome: 'SUCCEEDED' })
    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({ reservedCredits: 0, settledCredits: 2, availableCredits: 98 })
    await expect(credits.release({ reservation: settled, reason: 'PROVIDER_FAILED' })).rejects.toMatchObject({ code: 'CREDITS_UNAVAILABLE' })

    const released = await credits.reserve(request({ invocationId: 'invocation-release', idempotencyKey: 'release-key' }))
    await credits.release({ reservation: released, reason: 'PROVIDER_FAILED' })
    await credits.release({ reservation: released, reason: 'PROVIDER_FAILED' })
    await expect(credits.settle({ reservation: released, outcome: 'SUCCEEDED' })).rejects.toMatchObject({ code: 'CREDITS_UNAVAILABLE' })
    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({ reservedCredits: 0, settledCredits: 2, availableCredits: 98 })
  })

  it('geeft vrijgegeven credits na expiry niet opnieuw uit', async () => {
    const clock = mutableClock('2026-08-31T21:59:00.000Z')
    const credits = service(clock, { monthlyAllowanceCredits: 10, timeZone: 'Europe/Amsterdam' })
    const reservation = await credits.reserve(request({ invocationId: 'invocation-expiry-release', idempotencyKey: 'expiry-release-key' }))

    clock.set('2026-08-31T22:00:00.000Z')
    await credits.release({ reservation, reason: 'PROVIDER_UNAVAILABLE' })

    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({ availableCredits: 0, expiredCredits: 10, reservedCredits: 0 })
  })

  it('handhaaft de absolute groepscap en voorkomt negatieve balance bij concurrente reservations', async () => {
    const clock = mutableClock('2026-08-28T12:00:00.000Z')
    const credits = service(clock, { monthlyAllowanceCredits: 2, timeZone: 'Europe/Amsterdam' })

    const results = await Promise.allSettled([
      credits.reserve(request({ invocationId: 'invocation-race-1', idempotencyKey: 'race-key-1' })),
      credits.reserve(request({ invocationId: 'invocation-race-2', idempotencyKey: 'race-key-2' })),
    ])
    const successes = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<InMemoryLiquidCreditsService['reserve']>>> => result.status === 'fulfilled')
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')

    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(1)
    expect(failures[0].reason).toMatchObject({ code: 'CREDITS_EXHAUSTED' })
    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({ availableCredits: 0, reservedCredits: 2 })
  })

  it('geeft bij meerdere rollen de hoogste toepasselijke quota zonder individuele override', async () => {
    const clock = mutableClock('2026-08-28T12:00:00.000Z')
    const credits = service(clock, undefined, { roles: ['EMPLOYEE', 'HR_ADMIN'] })

    await expect(credits.resolveActorQuota({ scope, actorUserId: 'actor-1', month: '2026-08' })).resolves.toMatchObject({
      qualityProfile: 'IN_DEPTH',
      monthlyQuotaCredits: 100,
      roleCodes: ['EMPLOYEE', 'HR_ADMIN'],
    })
  })

  it('handhaaft de actor quota als extra ceiling bij concurrente reservations', async () => {
    const clock = mutableClock('2026-08-28T12:00:00.000Z')
    const roleQuotas: Readonly<Record<string, TestRoleQuota>> = {
      LIMITED_ROLE: { qualityProfile: 'BALANCED', monthlyQuotaCredits: 2 },
    }
    const credits = service(clock, { monthlyAllowanceCredits: 100, timeZone: 'Europe/Amsterdam' }, {
      roles: ['LIMITED_ROLE'],
      roleQuotas,
    })

    const results = await Promise.allSettled([
      credits.reserve(request({ invocationId: 'invocation-quota-1', idempotencyKey: 'quota-key-1' })),
      credits.reserve(request({ invocationId: 'invocation-quota-2', idempotencyKey: 'quota-key-2' })),
    ])
    const successes = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<InMemoryLiquidCreditsService['reserve']>>> => result.status === 'fulfilled')
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')

    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(1)
    expect(failures[0].reason).toMatchObject({ code: 'QUOTA_REACHED' })
    await expect(credits.readActorQuotaUsage({ scope, actorUserId: 'actor-1', month: '2026-08' })).resolves.toMatchObject({
      usedCredits: 2,
      remainingCredits: 0,
    })
  })

  it('maakt een duplicate idempotent zonder dubbele reservation en weigert key-hergebruik', async () => {
    const clock = mutableClock('2026-08-28T12:00:00.000Z')
    const credits = service(clock)
    const first = await credits.reserve(request())
    const duplicate = await credits.reserve(request())

    expect(duplicate).toEqual(first)
    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({ reservedCredits: 2, availableCredits: 98 })
    await expect(credits.reserve(request({ invocationId: 'different-invocation' }))).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' })
  })

  it('berekent maandgrenzen in de HR-groep-timezone rond een UTC-datumgrens', async () => {
    const clock = mutableClock('2026-09-01T03:59:59.000Z')
    const credits = service(clock, { monthlyAllowanceCredits: 10, timeZone: 'America/New_York' })

    await credits.ensureMonthlyAllowance(scope, '2026-08')
    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({ availableCredits: 10, expiredCredits: 0 })

    clock.set('2026-09-01T04:00:00.000Z')
    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({ availableCredits: 0, expiredCredits: 10 })
    await credits.ensureMonthlyAllowance(scope, '2026-09')
    await expect(credits.resolveGroupBalance(scope)).resolves.toMatchObject({ monthlyAllowanceCredits: 20, availableCredits: 10 })
  })
})
