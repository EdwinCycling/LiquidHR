import type {
  AiCreditReservation,
  AiCreditReservationRequest,
  AiCreditReleaseRequest,
  AiCreditSettlementRequest,
  AiQualityProfile,
  AiScope,
  CreditsPort,
} from './contracts'

export type LiquidCreditsAllocationType = 'MONTHLY_ALLOWANCE' | 'PURCHASED_EXTRA' | 'TEST_GRANT'
export type LiquidCreditsReservationStatus = 'RESERVED' | 'SETTLED' | 'RELEASED'

export interface LiquidCreditsGroupBalance {
  scope: AiScope
  totalCredits: number
  monthlyAllowanceCredits: number
  purchasedExtraCredits: number
  testGrantCredits: number
  reservedCredits: number
  settledCredits: number
  expiredCredits: number
  availableCredits: number
  asOf: string
}

export interface LiquidCreditsActorQuota {
  scope: AiScope
  actorUserId: string
  periodMonth: string
  qualityProfile: AiQualityProfile
  monthlyQuotaCredits: number
  reservedCredits: number
  settledCredits: number
  releasedCredits: number
  usedCredits: number
  remainingCredits: number
  roleCodes: readonly string[]
}

export interface LiquidCreditsAllocationConsumption {
  reservationId: string
  allocationId: string
  allocationType: LiquidCreditsAllocationType
  periodMonth: string | null
  expiresAt: string | null
  allocatedCredits: number
  reservedCredits: number
  settledCredits: number
  releasedCredits: number
  createdAt: string
}

export interface LiquidCreditsServicePort extends CreditsPort {
  resolveGroupBalance(scope: AiScope): Promise<LiquidCreditsGroupBalance>
  readGroupUsageBalance(scope: AiScope): Promise<LiquidCreditsGroupBalance>
  resolveActorQuota(input: { scope: AiScope; actorUserId: string; month: string }): Promise<LiquidCreditsActorQuota>
  readActorQuotaUsage(input: { scope: AiScope; actorUserId: string; month: string }): Promise<LiquidCreditsActorQuota>
  readAllocationConsumption(input: { reservationId: string; invocationId: string }): Promise<readonly LiquidCreditsAllocationConsumption[]>
}

export type LiquidCreditsReservation = AiCreditReservation
export type LiquidCreditsReservationInput = AiCreditReservationRequest
export type LiquidCreditsSettlementInput = AiCreditSettlementRequest
export type LiquidCreditsReleaseInput = AiCreditReleaseRequest
