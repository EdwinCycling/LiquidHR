import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { AiExecutionError, type AiCreditReleaseRequest, type AiCreditReservation, type AiCreditReservationRequest, type AiCreditSettlementRequest } from './contracts'
import { resolveLiquidCreditChargeReference } from './liquid-credits-catalog'
import type { LiquidCreditsActorQuota, LiquidCreditsAllocationConsumption, LiquidCreditsGroupBalance, LiquidCreditsServicePort } from './liquid-credits-contracts'

type RpcError = { code?: string; message?: string }

function errorMessage(error: RpcError): string {
  return error.message ?? ''
}

function mappedFailure(error: RpcError, fallback: 'CREDITS_UNAVAILABLE' | 'INTERNAL_CONFIGURATION_ERROR' = 'CREDITS_UNAVAILABLE'): AiExecutionError {
  const message = errorMessage(error)
  if (message.includes('AI_CREDITS_EXHAUSTED')) return new AiExecutionError('CREDITS_EXHAUSTED')
  if (message.includes('AI_CREDIT_QUOTA_EXHAUSTED')) return new AiExecutionError('QUOTA_REACHED')
  if (message.includes('AI_CREDIT_IDEMPOTENCY_CONFLICT')) return new AiExecutionError('IDEMPOTENCY_KEY_REUSED')
  if (message.includes('AI_CREDIT_CHARGE_NOT_CONFIGURED')) return new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  if (message.includes('AI_CREDIT_RESERVATION_RELEASED') || message.includes('AI_CREDIT_RESERVATION_SETTLED')) return new AiExecutionError('CREDITS_UNAVAILABLE')
  if (message.includes('AI_CREDIT_TEST_MODE_DISABLED')) return new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return new AiExecutionError(fallback)
}

function throwRpcError(error: RpcError | null, fallback: 'CREDITS_UNAVAILABLE' | 'INTERNAL_CONFIGURATION_ERROR' = 'CREDITS_UNAVAILABLE'): never {
  throw mappedFailure(error ?? {}, fallback)
}

function positiveInteger(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isInteger(value) || value < 0) {
    throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }
  return value
}

function requiredText(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return value
}

function oneRow<T>(data: readonly T[] | null): T {
  const row = data?.[0]
  if (!row) throw new AiExecutionError('CREDITS_UNAVAILABLE')
  return row
}

function mapGroupBalance(scope: LiquidCreditsGroupBalance['scope'], row: {
  total_credits: number
  monthly_allowance_credits: number
  purchased_extra_credits: number
  test_grant_credits: number
  reserved_credits: number
  settled_credits: number
  expired_credits: number
  available_credits: number
  as_of: string
}): LiquidCreditsGroupBalance {
  return {
    scope,
    totalCredits: positiveInteger(row.total_credits),
    monthlyAllowanceCredits: positiveInteger(row.monthly_allowance_credits),
    purchasedExtraCredits: positiveInteger(row.purchased_extra_credits),
    testGrantCredits: positiveInteger(row.test_grant_credits),
    reservedCredits: positiveInteger(row.reserved_credits),
    settledCredits: positiveInteger(row.settled_credits),
    expiredCredits: positiveInteger(row.expired_credits),
    availableCredits: positiveInteger(row.available_credits),
    asOf: requiredText(row.as_of),
  }
}

function mapActorQuota(scope: LiquidCreditsActorQuota['scope'], actorUserId: string, row: {
  period_month: string
  quality_profile: string
  monthly_quota_credits: number
  reserved_credits: number
  settled_credits: number
  released_credits: number
  used_credits: number
  remaining_credits: number
  role_codes: string[]
}): LiquidCreditsActorQuota {
  if (row.quality_profile !== 'EFFICIENT' && row.quality_profile !== 'BALANCED' && row.quality_profile !== 'IN_DEPTH') {
    throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }
  return {
    scope,
    actorUserId,
    periodMonth: requiredText(row.period_month),
    qualityProfile: row.quality_profile,
    monthlyQuotaCredits: positiveInteger(row.monthly_quota_credits),
    reservedCredits: positiveInteger(row.reserved_credits),
    settledCredits: positiveInteger(row.settled_credits),
    releasedCredits: positiveInteger(row.released_credits),
    usedCredits: positiveInteger(row.used_credits),
    remainingCredits: positiveInteger(row.remaining_credits),
    roleCodes: [...row.role_codes],
  }
}

export class SupabaseLiquidCreditsService implements LiquidCreditsServicePort {
  async ensureMonthlyAllowance(scope: AiCreditReservationRequest['scope'], month: string): Promise<void> {
    const { error } = await createAdminClient().rpc('ensure_ai_monthly_allowance', {
      requested_tenant_id: scope.tenantId,
      requested_hr_group_id: scope.hrGroupId,
      requested_month: month,
    })
    if (error) throwRpcError(error)
  }

  async resolveGroupBalance(scope: AiCreditReservationRequest['scope']): Promise<LiquidCreditsGroupBalance> {
    const { data, error } = await createAdminClient().rpc('get_ai_group_credit_balance', {
      requested_tenant_id: scope.tenantId,
      requested_hr_group_id: scope.hrGroupId,
    })
    if (error) throwRpcError(error)
    return mapGroupBalance(scope, oneRow(data))
  }

  async readGroupUsageBalance(scope: AiCreditReservationRequest['scope']): Promise<LiquidCreditsGroupBalance> {
    return this.resolveGroupBalance(scope)
  }

  async resolveActorQuota(input: { scope: AiCreditReservationRequest['scope']; actorUserId: string; month: string }): Promise<LiquidCreditsActorQuota> {
    const { data, error } = await createAdminClient().rpc('get_ai_actor_quota', {
      requested_tenant_id: input.scope.tenantId,
      requested_hr_group_id: input.scope.hrGroupId,
      requested_actor_user_id: input.actorUserId,
      requested_month: input.month,
    })
    if (error) throwRpcError(error)
    return mapActorQuota(input.scope, input.actorUserId, oneRow(data))
  }

  async readActorQuotaUsage(input: { scope: AiCreditReservationRequest['scope']; actorUserId: string; month: string }): Promise<LiquidCreditsActorQuota> {
    return this.resolveActorQuota(input)
  }

  async reserve(input: AiCreditReservationRequest): Promise<AiCreditReservation> {
    const expectedUnits = resolveLiquidCreditChargeReference(input.featureCode, input.chargeReference)
    const { data, error } = await createAdminClient().rpc('reserve_ai_credits', {
      requested_tenant_id: input.scope.tenantId,
      requested_hr_group_id: input.scope.hrGroupId,
      requested_invocation_id: input.invocationId,
      requested_actor_user_id: input.actorUserId,
      requested_feature_code: input.featureCode,
      requested_charge_reference: input.chargeReference,
      requested_month: input.month,
      requested_idempotency_key: input.idempotencyKey,
    })
    if (error) throwRpcError(error)
    const row = oneRow(data)
    if (row.units !== expectedUnits || row.invocation_id !== input.invocationId || row.charge_reference !== input.chargeReference) {
      throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
    }
    return {
      reservationId: requiredText(row.reservation_id),
      invocationId: requiredText(row.invocation_id),
      chargeReference: requiredText(row.charge_reference),
      units: positiveInteger(row.units),
    }
  }

  async settle(input: AiCreditSettlementRequest): Promise<void> {
    const { error } = await createAdminClient().rpc('settle_ai_credits', {
      requested_reservation_id: input.reservation.reservationId,
      requested_invocation_id: input.reservation.invocationId,
    })
    if (error) throwRpcError(error)
  }

  async release(input: AiCreditReleaseRequest): Promise<void> {
    const { error } = await createAdminClient().rpc('release_ai_credits', {
      requested_reservation_id: input.reservation.reservationId,
      requested_invocation_id: input.reservation.invocationId,
      requested_reason: input.reason,
    })
    if (error) throwRpcError(error)
  }

  async readAllocationConsumption(input: { reservationId: string; invocationId: string }): Promise<readonly LiquidCreditsAllocationConsumption[]> {
    const { data, error } = await createAdminClient().rpc('get_ai_reservation_allocations', {
      requested_reservation_id: input.reservationId,
      requested_invocation_id: input.invocationId,
    })
    if (error) throwRpcError(error)
    return (data ?? []).map((row) => {
      if (row.allocation_type !== 'MONTHLY_ALLOWANCE' && row.allocation_type !== 'PURCHASED_EXTRA' && row.allocation_type !== 'TEST_GRANT') {
        throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
      }
      return {
        reservationId: requiredText(row.reservation_id),
        allocationId: requiredText(row.allocation_id),
        allocationType: row.allocation_type,
        periodMonth: row.period_month,
        expiresAt: row.expires_at,
        allocatedCredits: positiveInteger(row.allocated_credits),
        reservedCredits: positiveInteger(row.reserved_credits),
        settledCredits: positiveInteger(row.settled_credits),
        releasedCredits: positiveInteger(row.released_credits),
        createdAt: requiredText(row.created_at),
      }
    })
  }
}
