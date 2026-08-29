import type {
  AiBusinessObjectRef,
  AiCreditReleaseRequest,
  AiCreditReservation,
  AiCreditReservationRequest,
  AiCreditSettlementRequest,
  AiFeatureDefinition,
  AiGateSnapshot,
  AiProviderRequest,
  AiProviderResponse,
  AiScope,
  AuthorizedAiContext,
  AuthorizedContextLoader,
  BusinessAuditEvent,
  BusinessAuditSink,
  CreditsPort,
  AiFeatureRegistry,
  AiGovernancePort,
  ProviderPort,
  TechnicalUsageEvent,
  TechnicalUsageSink,
} from './contracts'
import type { AuthContext } from '@/lib/auth/permissions'

export class TestFeatureRegistry implements AiFeatureRegistry {
  constructor(private readonly feature: AiFeatureDefinition) {}

  get(featureCode: string): AiFeatureDefinition | null {
    return featureCode === this.feature.featureCode ? this.feature : null
  }
}

export class TestGovernancePort implements AiGovernancePort {
  readonly calls: Array<{ scope: AiScope; actorUserId: string; feature: AiFeatureDefinition }> = []

  constructor(private readonly snapshot: AiGateSnapshot | Error) {}

  async resolve(input: { scope: AiScope; actorUserId: string; feature: AiFeatureDefinition }): Promise<AiGateSnapshot> {
    this.calls.push(input)
    if (this.snapshot instanceof Error) throw this.snapshot
    return this.snapshot
  }
}

export class TestCreditsPort implements CreditsPort {
  readonly allowanceCalls: Array<{ scope: AiScope; month: string }> = []
  readonly reserveCalls: AiCreditReservationRequest[] = []
  readonly settleCalls: AiCreditSettlementRequest[] = []
  readonly releaseCalls: AiCreditReleaseRequest[] = []
  reserveFailure: Error | null = null
  allowanceFailure: Error | null = null
  settleFailure: Error | null = null
  releaseFailure: Error | null = null

  constructor(private readonly units = 2) {}

  async ensureMonthlyAllowance(scope: AiScope, month: string): Promise<void> {
    this.allowanceCalls.push({ scope, month })
    if (this.allowanceFailure) throw this.allowanceFailure
  }

  async reserve(input: AiCreditReservationRequest): Promise<AiCreditReservation> {
    this.reserveCalls.push(input)
    if (this.reserveFailure) throw this.reserveFailure
    return {
      reservationId: `reservation-${this.reserveCalls.length}`,
      invocationId: input.invocationId,
      chargeReference: input.chargeReference,
      units: this.units,
    }
  }

  async settle(input: AiCreditSettlementRequest): Promise<void> {
    this.settleCalls.push(input)
    if (this.settleFailure) throw this.settleFailure
  }

  async release(input: AiCreditReleaseRequest): Promise<void> {
    this.releaseCalls.push(input)
    if (this.releaseFailure) throw this.releaseFailure
  }
}

export class TestContextLoader implements AuthorizedContextLoader {
  readonly calls: Array<{ scope: AiScope; businessObject: AiBusinessObjectRef }> = []

  constructor(private readonly context: AuthorizedAiContext | Error) {}

  async load(input: { authContext: AuthContext; scope: AiScope; feature: AiFeatureDefinition; businessObject: AiBusinessObjectRef }): Promise<AuthorizedAiContext> {
    this.calls.push({ scope: input.scope, businessObject: input.businessObject })
    if (this.context instanceof Error) throw this.context
    return this.context
  }
}

export class TestProviderPort implements ProviderPort {
  readonly calls: AiProviderRequest[] = []

  constructor(private readonly response: AiProviderResponse | Error) {}

  async execute(request: AiProviderRequest): Promise<AiProviderResponse> {
    this.calls.push(request)
    if (this.response instanceof Error) throw this.response
    return this.response
  }
}

export class RecordingTechnicalUsageSink implements TechnicalUsageSink {
  readonly events: TechnicalUsageEvent[] = []

  async record(event: TechnicalUsageEvent): Promise<void> {
    this.events.push(event)
  }
}

export class RecordingBusinessAuditSink implements BusinessAuditSink {
  readonly events: BusinessAuditEvent[] = []

  async record(event: BusinessAuditEvent): Promise<void> {
    this.events.push(event)
  }
}

export function fixedClock(iso = '2026-08-28T12:00:00.000Z') {
  return { now: () => new Date(iso) }
}
