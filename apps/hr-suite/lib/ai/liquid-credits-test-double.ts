import { AiExecutionError, type AiCreditReleaseRequest, type AiCreditReservation, type AiCreditReservationRequest, type AiCreditSettlementRequest, type AiQualityProfile, type AiScope, type CreditsPort } from './contracts'
import { AI_LIQUID_CREDIT_CHARGE_UNITS, resolveLiquidCreditChargeReference } from './liquid-credits-catalog'
import type { LiquidCreditsActorQuota, LiquidCreditsAllocationConsumption, LiquidCreditsGroupBalance, LiquidCreditsServicePort } from './liquid-credits-contracts'

export interface TestGroupPolicy {
  monthlyAllowanceCredits: number
  timeZone: string
}

export interface TestRoleQuota {
  qualityProfile: AiQualityProfile
  monthlyQuotaCredits: number
}

interface TestAllocation {
  id: string
  scope: AiScope
  allocationType: 'MONTHLY_ALLOWANCE' | 'PURCHASED_EXTRA' | 'TEST_GRANT'
  creditAmount: number
  periodMonth: string | null
  timeZone: string
  grantedAt: Date
  expiresAt: Date | null
  reservedCredits: number
  settledCredits: number
  releasedCredits: number
  expiredCredits: number
}

interface TestReservationAllocation {
  allocationId: string
  allocatedCredits: number
  reservedCredits: number
  settledCredits: number
  releasedCredits: number
}

interface TestReservation {
  reservationId: string
  scope: AiScope
  invocationId: string
  actorUserId: string
  featureCode: string
  chargeReference: string
  periodMonth: string
  units: number
  status: 'RESERVED' | 'SETTLED' | 'RELEASED'
  releaseReason: AiCreditReleaseRequest['reason'] | null
  allocations: TestReservationAllocation[]
  createdAt: Date
}

interface TestActorUsage {
  reservedCredits: number
  settledCredits: number
  releasedCredits: number
}

export interface InMemoryLiquidCreditsOptions {
  now?: () => Date
  groupPolicies?: Readonly<Record<string, TestGroupPolicy>>
  roleQuotas?: Readonly<Record<string, TestRoleQuota>>
  actorRoles?: Readonly<Record<string, readonly string[]>>
  chargeUnitsByReference?: Readonly<Record<string, number>>
}

const DEFAULT_ROLE_QUOTAS: Readonly<Record<string, TestRoleQuota>> = {
  EMPLOYEE: { qualityProfile: 'EFFICIENT', monthlyQuotaCredits: 10 },
  DIRECT_MANAGER: { qualityProfile: 'BALANCED', monthlyQuotaCredits: 25 },
  TEAM_LEAD: { qualityProfile: 'BALANCED', monthlyQuotaCredits: 25 },
  HR_ADVISOR: { qualityProfile: 'BALANCED', monthlyQuotaCredits: 50 },
  PAYROLL_SPECIALIST: { qualityProfile: 'BALANCED', monthlyQuotaCredits: 50 },
  HR_ADMIN: { qualityProfile: 'IN_DEPTH', monthlyQuotaCredits: 100 },
  TENANT_ADMIN: { qualityProfile: 'IN_DEPTH', monthlyQuotaCredits: 100 },
}

const QUALITY_RANK: Readonly<Record<AiQualityProfile, number>> = {
  EFFICIENT: 1,
  BALANCED: 2,
  IN_DEPTH: 3,
}

function scopeKey(scope: AiScope): string {
  return `${scope.tenantId}:${scope.hrGroupId}`
}

function actorKey(scope: AiScope, actorUserId: string, month: string): string {
  return `${scopeKey(scope)}:${actorUserId}:${month}`
}

function reservationKey(scope: AiScope, actorUserId: string, idempotencyKey: string): string {
  return `${scopeKey(scope)}:${actorUserId}:${idempotencyKey}`
}

function parseMonth(month: string): { year: number; month: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
  if (!match) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return { year: Number(match[1]), month: Number(match[2]) }
}

function zonedMidnightUtc(year: number, month: number, day: number, timeZone: string): Date {
  let guess = Date.UTC(year, month - 1, day)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]))
    const observedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    )
    const targetUtc = Date.UTC(year, month - 1, day)
    const nextGuess = guess + (targetUtc - observedUtc)
    if (nextGuess === guess) return new Date(guess)
    guess = nextGuess
  }

  return new Date(guess)
}

function nextMonthExpiry(month: string, timeZone: string): Date {
  const parsed = parseMonth(month)
  const nextMonth = parsed.month === 12 ? 1 : parsed.month + 1
  const nextYear = parsed.month === 12 ? parsed.year + 1 : parsed.year
  return zonedMidnightUtc(nextYear, nextMonth, 1, timeZone)
}

function twelveMonthsAfter(date: Date): Date {
  const result = new Date(date)
  result.setUTCFullYear(result.getUTCFullYear() + 1)
  return result
}

function copyScope(scope: AiScope): AiScope {
  return { ...scope }
}

function availableCredits(allocation: TestAllocation): number {
  return allocation.creditAmount - allocation.reservedCredits - allocation.settledCredits - allocation.expiredCredits
}

function cloneReservation(reservation: TestReservation): AiCreditReservation {
  return {
    reservationId: reservation.reservationId,
    invocationId: reservation.invocationId,
    chargeReference: reservation.chargeReference,
    units: reservation.units,
  }
}

export class InMemoryLiquidCreditsService implements LiquidCreditsServicePort {
  private readonly now: () => Date
  private readonly groupPolicies: Map<string, TestGroupPolicy>
  private readonly roleQuotas: Readonly<Record<string, TestRoleQuota>>
  private readonly actorRoles: Map<string, readonly string[]>
  private readonly chargeUnitsByReference: Readonly<Record<string, number>>
  private readonly allocations: TestAllocation[] = []
  private readonly reservations = new Map<string, TestReservation>()
  private readonly reservationsByKey = new Map<string, string>()
  private readonly actorUsage = new Map<string, TestActorUsage>()
  private idSequence = 0

  constructor(options: InMemoryLiquidCreditsOptions = {}) {
    this.now = options.now ?? (() => new Date())
    this.groupPolicies = new Map(Object.entries(options.groupPolicies ?? {}))
    this.roleQuotas = options.roleQuotas ?? DEFAULT_ROLE_QUOTAS
    this.actorRoles = new Map(Object.entries(options.actorRoles ?? {}))
    this.chargeUnitsByReference = options.chargeUnitsByReference ?? AI_LIQUID_CREDIT_CHARGE_UNITS
  }

  setGroupPolicy(scope: AiScope, policy: TestGroupPolicy): void {
    this.groupPolicies.set(scopeKey(scope), policy)
  }

  setActorRoles(scope: AiScope, actorUserId: string, roles: readonly string[]): void {
    this.actorRoles.set(`${scopeKey(scope)}:${actorUserId}`, [...roles])
  }

  grantPurchasedExtra(scope: AiScope, creditAmount: number, grantedAt = this.now(), sourceReference = 'BILLING:test'): string {
    if (!Number.isInteger(creditAmount) || creditAmount <= 0) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
    return this.addAllocation({
      scope,
      allocationType: 'PURCHASED_EXTRA',
      creditAmount,
      periodMonth: null,
      timeZone: this.getPolicy(scope).timeZone,
      grantedAt,
      expiresAt: twelveMonthsAfter(grantedAt),
      sourceReference,
    })
  }

  grantTestCredits(scope: AiScope, creditAmount: number, grantedAt = this.now(), sourceReference = 'CONTROLLED_TEST:default'): string {
    if (!Number.isInteger(creditAmount) || creditAmount <= 0) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
    return this.addAllocation({
      scope,
      allocationType: 'TEST_GRANT',
      creditAmount,
      periodMonth: null,
      timeZone: this.getPolicy(scope).timeZone,
      grantedAt,
      expiresAt: twelveMonthsAfter(grantedAt),
      sourceReference,
    })
  }

  async ensureMonthlyAllowance(scope: AiScope, month: string): Promise<void> {
    const policy = this.getPolicy(scope)
    const parsedMonth = parseMonth(month)
    if (this.allocations.some((allocation) => allocation.scope.tenantId === scope.tenantId
      && allocation.scope.hrGroupId === scope.hrGroupId
      && allocation.allocationType === 'MONTHLY_ALLOWANCE'
      && allocation.periodMonth === month)) return

    this.addAllocation({
      scope,
      allocationType: 'MONTHLY_ALLOWANCE',
      creditAmount: policy.monthlyAllowanceCredits,
      periodMonth: month,
      timeZone: policy.timeZone,
      grantedAt: zonedMidnightUtc(parsedMonth.year, parsedMonth.month, 1, policy.timeZone),
      expiresAt: nextMonthExpiry(month, policy.timeZone),
      sourceReference: `MONTHLY:${month}`,
    })
  }

  async resolveGroupBalance(scope: AiScope): Promise<LiquidCreditsGroupBalance> {
    this.getPolicy(scope)
    this.expireAllocations(scope)
    const scoped = this.allocations.filter((allocation) => allocation.scope.tenantId === scope.tenantId && allocation.scope.hrGroupId === scope.hrGroupId)
    return {
      scope: copyScope(scope),
      totalCredits: scoped.reduce((total, allocation) => total + allocation.creditAmount, 0),
      monthlyAllowanceCredits: scoped.filter((allocation) => allocation.allocationType === 'MONTHLY_ALLOWANCE').reduce((total, allocation) => total + allocation.creditAmount, 0),
      purchasedExtraCredits: scoped.filter((allocation) => allocation.allocationType === 'PURCHASED_EXTRA').reduce((total, allocation) => total + allocation.creditAmount, 0),
      testGrantCredits: scoped.filter((allocation) => allocation.allocationType === 'TEST_GRANT').reduce((total, allocation) => total + allocation.creditAmount, 0),
      reservedCredits: scoped.reduce((total, allocation) => total + allocation.reservedCredits, 0),
      settledCredits: scoped.reduce((total, allocation) => total + allocation.settledCredits, 0),
      expiredCredits: scoped.reduce((total, allocation) => total + allocation.expiredCredits, 0),
      availableCredits: scoped.reduce((total, allocation) => total + availableCredits(allocation), 0),
      asOf: this.currentDate().toISOString(),
    }
  }

  async readGroupUsageBalance(scope: AiScope): Promise<LiquidCreditsGroupBalance> {
    return this.resolveGroupBalance(scope)
  }

  async resolveActorQuota(input: { scope: AiScope; actorUserId: string; month: string }): Promise<LiquidCreditsActorQuota> {
    const quota = this.resolveRoleQuota(input.scope, input.actorUserId)
    parseMonth(input.month)
    const usage = this.actorUsage.get(actorKey(input.scope, input.actorUserId, input.month)) ?? { reservedCredits: 0, settledCredits: 0, releasedCredits: 0 }
    const usedCredits = usage.reservedCredits + usage.settledCredits
    return {
      scope: copyScope(input.scope),
      actorUserId: input.actorUserId,
      periodMonth: `${input.month}-01`,
      qualityProfile: quota.qualityProfile,
      monthlyQuotaCredits: quota.monthlyQuotaCredits,
      reservedCredits: usage.reservedCredits,
      settledCredits: usage.settledCredits,
      releasedCredits: usage.releasedCredits,
      usedCredits,
      remainingCredits: Math.max(0, quota.monthlyQuotaCredits - usedCredits),
      roleCodes: [...this.rolesFor(input.scope, input.actorUserId)],
    }
  }

  async readActorQuotaUsage(input: { scope: AiScope; actorUserId: string; month: string }): Promise<LiquidCreditsActorQuota> {
    return this.resolveActorQuota(input)
  }

  async reserve(input: AiCreditReservationRequest): Promise<AiCreditReservation> {
    parseMonth(input.month)
    const expectedUnits = this.chargeUnitsByReference[input.chargeReference]
      ?? (this.chargeUnitsByReference === AI_LIQUID_CREDIT_CHARGE_UNITS
        ? resolveLiquidCreditChargeReference(input.featureCode, input.chargeReference)
        : undefined)
    if (!expectedUnits || !Number.isInteger(expectedUnits) || expectedUnits <= 0) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')

    await this.ensureMonthlyAllowance(input.scope, input.month)

    const idempotencyKey = reservationKey(input.scope, input.actorUserId, input.idempotencyKey)
    const existingId = this.reservationsByKey.get(idempotencyKey)
    if (existingId) {
      const existing = this.reservations.get(existingId)
      if (!existing
        || existing.invocationId !== input.invocationId
        || existing.featureCode !== input.featureCode
        || existing.chargeReference !== input.chargeReference
        || existing.periodMonth !== input.month) {
        throw new AiExecutionError('IDEMPOTENCY_KEY_REUSED')
      }
      if (existing.status === 'RELEASED') throw new AiExecutionError('CREDITS_UNAVAILABLE')
      return cloneReservation(existing)
    }

    this.getPolicy(input.scope)
    this.expireAllocations(input.scope)
    const quota = this.resolveRoleQuota(input.scope, input.actorUserId)
    const usageKey = actorKey(input.scope, input.actorUserId, input.month)
    const usage = this.actorUsage.get(usageKey) ?? { reservedCredits: 0, settledCredits: 0, releasedCredits: 0 }
    if (usage.reservedCredits + usage.settledCredits + expectedUnits > quota.monthlyQuotaCredits) {
      throw new AiExecutionError('QUOTA_REACHED')
    }

    const eligible = this.allocations
      .filter((allocation) => allocation.scope.tenantId === input.scope.tenantId
        && allocation.scope.hrGroupId === input.scope.hrGroupId
        && (allocation.expiresAt === null || allocation.expiresAt > this.currentDate())
        && availableCredits(allocation) > 0)
      .sort((left, right) => {
        if (left.expiresAt === null && right.expiresAt !== null) return 1
        if (left.expiresAt !== null && right.expiresAt === null) return -1
        if (left.expiresAt !== null && right.expiresAt !== null && left.expiresAt.valueOf() !== right.expiresAt.valueOf()) return left.expiresAt.valueOf() - right.expiresAt.valueOf()
        if (left.grantedAt.valueOf() !== right.grantedAt.valueOf()) return left.grantedAt.valueOf() - right.grantedAt.valueOf()
        return left.id.localeCompare(right.id)
      })
    const groupAvailable = eligible.reduce((total, allocation) => total + availableCredits(allocation), 0)
    if (groupAvailable < expectedUnits) throw new AiExecutionError('CREDITS_EXHAUSTED')

    let remaining = expectedUnits
    const reservationAllocations: TestReservationAllocation[] = []
    for (const allocation of eligible) {
      if (remaining === 0) break
      const units = Math.min(remaining, availableCredits(allocation))
      allocation.reservedCredits += units
      reservationAllocations.push({ allocationId: allocation.id, allocatedCredits: units, reservedCredits: units, settledCredits: 0, releasedCredits: 0 })
      remaining -= units
    }
    if (remaining !== 0) throw new AiExecutionError('CREDITS_UNAVAILABLE')

    usage.reservedCredits += expectedUnits
    this.actorUsage.set(usageKey, usage)
    const reservation: TestReservation = {
      reservationId: this.nextId('reservation'),
      scope: copyScope(input.scope),
      invocationId: input.invocationId,
      actorUserId: input.actorUserId,
      featureCode: input.featureCode,
      chargeReference: input.chargeReference,
      periodMonth: input.month,
      units: expectedUnits,
      status: 'RESERVED',
      releaseReason: null,
      allocations: reservationAllocations,
      createdAt: this.currentDate(),
    }
    this.reservations.set(reservation.reservationId, reservation)
    this.reservationsByKey.set(idempotencyKey, reservation.reservationId)
    return cloneReservation(reservation)
  }

  async settle(input: AiCreditSettlementRequest): Promise<void> {
    const reservation = this.getReservation(input.reservation)
    if (reservation.status === 'SETTLED') return
    if (reservation.status === 'RELEASED') throw new AiExecutionError('CREDITS_UNAVAILABLE')

    for (const link of reservation.allocations) {
      const allocation = this.getAllocation(link.allocationId)
      allocation.reservedCredits -= link.reservedCredits
      allocation.settledCredits += link.reservedCredits
      link.settledCredits = link.reservedCredits
      link.reservedCredits = 0
    }
    const usage = this.getUsage(reservation)
    usage.reservedCredits -= reservation.units
    usage.settledCredits += reservation.units
    reservation.status = 'SETTLED'
  }

  async release(input: AiCreditReleaseRequest): Promise<void> {
    const reservation = this.getReservation(input.reservation)
    if (reservation.status === 'RELEASED') return
    if (reservation.status === 'SETTLED') throw new AiExecutionError('CREDITS_UNAVAILABLE')

    this.expireAllocations(reservation.scope)

    for (const link of reservation.allocations) {
      const allocation = this.getAllocation(link.allocationId)
      allocation.reservedCredits -= link.reservedCredits
      allocation.releasedCredits += link.reservedCredits
      if (allocation.expiresAt !== null && allocation.expiresAt <= this.currentDate()) {
        allocation.expiredCredits += link.reservedCredits
      }
      link.releasedCredits = link.reservedCredits
      link.reservedCredits = 0
    }
    const usage = this.getUsage(reservation)
    usage.reservedCredits -= reservation.units
    usage.releasedCredits += reservation.units
    reservation.releaseReason = input.reason
    reservation.status = 'RELEASED'
  }

  async readAllocationConsumption(input: { reservationId: string; invocationId: string }): Promise<readonly LiquidCreditsAllocationConsumption[]> {
    const reservation = this.reservations.get(input.reservationId)
    if (!reservation || reservation.invocationId !== input.invocationId) throw new AiExecutionError('CREDITS_UNAVAILABLE')
    return reservation.allocations.map((link) => {
      const allocation = this.getAllocation(link.allocationId)
      return {
        reservationId: reservation.reservationId,
        allocationId: allocation.id,
        allocationType: allocation.allocationType,
        periodMonth: allocation.periodMonth,
        expiresAt: allocation.expiresAt?.toISOString() ?? null,
        allocatedCredits: link.allocatedCredits,
        reservedCredits: link.reservedCredits,
        settledCredits: link.settledCredits,
        releasedCredits: link.releasedCredits,
        createdAt: reservation.createdAt.toISOString(),
      }
    })
  }

  private addAllocation(input: {
    scope: AiScope
    allocationType: TestAllocation['allocationType']
    creditAmount: number
    periodMonth: string | null
    timeZone: string
    grantedAt: Date
    expiresAt: Date | null
    sourceReference: string
  }): string {
    const id = this.nextId('allocation')
    this.allocations.push({
      id,
      scope: copyScope(input.scope),
      allocationType: input.allocationType,
      creditAmount: input.creditAmount,
      periodMonth: input.periodMonth,
      timeZone: input.timeZone,
      grantedAt: new Date(input.grantedAt),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      reservedCredits: 0,
      settledCredits: 0,
      releasedCredits: 0,
      expiredCredits: 0,
    })
    void input.sourceReference
    return id
  }

  private expireAllocations(scope: AiScope): void {
    const now = this.currentDate()
    for (const allocation of this.allocations) {
      if (allocation.scope.tenantId !== scope.tenantId || allocation.scope.hrGroupId !== scope.hrGroupId) continue
      if (!allocation.expiresAt || allocation.expiresAt > now) continue
      const remaining = availableCredits(allocation)
      if (remaining > 0) allocation.expiredCredits += remaining
    }
  }

  private resolveRoleQuota(scope: AiScope, actorUserId: string): TestRoleQuota {
    const roles = this.rolesFor(scope, actorUserId)
    const candidates = roles
      .map((role) => ({ role, quota: this.roleQuotas[role] }))
      .filter((candidate): candidate is { role: string; quota: TestRoleQuota } => candidate.quota !== undefined)
      .sort((left, right) => right.quota.monthlyQuotaCredits - left.quota.monthlyQuotaCredits
        || QUALITY_RANK[right.quota.qualityProfile] - QUALITY_RANK[left.quota.qualityProfile]
        || left.role.localeCompare(right.role))
    const selected = candidates[0]?.quota
    if (!selected) throw new AiExecutionError('CREDITS_UNAVAILABLE')
    return selected
  }

  private rolesFor(scope: AiScope, actorUserId: string): readonly string[] {
    return [...new Set(this.actorRoles.get(`${scopeKey(scope)}:${actorUserId}`) ?? [])].sort()
  }

  private getPolicy(scope: AiScope): TestGroupPolicy {
    const policy = this.groupPolicies.get(scopeKey(scope))
    if (!policy || !Number.isInteger(policy.monthlyAllowanceCredits) || policy.monthlyAllowanceCredits <= 0) {
      throw new AiExecutionError('CREDITS_UNAVAILABLE')
    }
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: policy.timeZone }).format()
    } catch {
      throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
    }
    return policy
  }

  private getReservation(reservation: AiCreditReservation): TestReservation {
    const found = this.reservations.get(reservation.reservationId)
    if (!found || found.invocationId !== reservation.invocationId || found.units !== reservation.units) throw new AiExecutionError('CREDITS_UNAVAILABLE')
    return found
  }

  private getAllocation(id: string): TestAllocation {
    const allocation = this.allocations.find((candidate) => candidate.id === id)
    if (!allocation) throw new AiExecutionError('CREDITS_UNAVAILABLE')
    return allocation
  }

  private getUsage(reservation: TestReservation): TestActorUsage {
    const key = actorKey(reservation.scope, reservation.actorUserId, reservation.periodMonth)
    const usage = this.actorUsage.get(key)
    if (!usage) throw new AiExecutionError('CREDITS_UNAVAILABLE')
    return usage
  }

  private currentDate(): Date {
    const value = this.now()
    if (Number.isNaN(value.valueOf())) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
    return new Date(value)
  }

  private nextId(prefix: string): string {
    this.idSequence += 1
    return `${prefix}-${this.idSequence}`
  }
}

export class FailClosedLiquidCreditsService implements CreditsPort {
  async ensureMonthlyAllowance(scope: AiScope, month: string): Promise<void> {
    void scope
    void month
    throw new AiExecutionError('CREDITS_UNAVAILABLE')
  }

  async reserve(input: AiCreditReservationRequest): Promise<AiCreditReservation> {
    void input
    throw new AiExecutionError('CREDITS_UNAVAILABLE')
  }

  async settle(input: AiCreditSettlementRequest): Promise<void> {
    void input
    throw new AiExecutionError('CREDITS_UNAVAILABLE')
  }

  async release(input: AiCreditReleaseRequest): Promise<void> {
    void input
    throw new AiExecutionError('CREDITS_UNAVAILABLE')
  }
}
