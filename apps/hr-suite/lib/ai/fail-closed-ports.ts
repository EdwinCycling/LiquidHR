import { AiExecutionError, type AiCreditReleaseRequest, type AiCreditReservation, type AiCreditReservationRequest, type AiCreditSettlementRequest, type AiFeatureDefinition, type AiGateSnapshot, type AiGovernancePort, type AiQualityProfile, type AiScope, type CreditsPort } from './contracts'

export class FailClosedGovernancePort implements AiGovernancePort {
  async resolve(input: { scope: AiScope; actorUserId: string; feature: AiFeatureDefinition; requestedQualityProfile?: AiQualityProfile }): Promise<AiGateSnapshot> {
    void input
    throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }
}

export class FailClosedCreditsPort implements CreditsPort {
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
