import 'server-only'

import { AiExecutionError, type AiFeatureDefinition, type AiGateSnapshot, type AiGovernancePort, type AiQualityProfile, type AiScope, type AiClock } from './contracts'
import { resolveLiquidCreditCharge } from './liquid-credits-catalog'
import type { LiquidCreditsServicePort } from './liquid-credits-contracts'
import { SupabaseLiquidCreditsService } from './supabase-liquid-credits'
import { defaultHrGroupTimeZoneResolver, resolveHrGroupCalendarMonth } from './timezone'
import { isOpenAIProviderConfigured } from './openai-config'
import { resolveProviderSafetyConfig } from './provider-safety'

function requestedMode(): 'TEST' | 'OPENAI' {
  const environment = process.env.NODE_ENV ?? 'development'
  return environment === 'test' || environment === 'development' ? 'TEST' : 'OPENAI'
}

export function isAiImproveAvailable(): boolean {
  try {
    const mode = requestedMode()
    const safety = resolveProviderSafetyConfig({ ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'development' }, mode)
    return safety.enabled && (mode === 'TEST' || isOpenAIProviderConfigured())
  } catch {
    return false
  }
}

export class SupabaseAiGovernancePort implements AiGovernancePort {
  constructor(
    private readonly credits: LiquidCreditsServicePort = new SupabaseLiquidCreditsService(),
    private readonly clock: AiClock = { now: () => new Date() },
  ) {}

  async resolve(input: { scope: AiScope; actorUserId: string; feature: AiFeatureDefinition; requestedQualityProfile?: AiQualityProfile }): Promise<AiGateSnapshot> {
    const qualityProfile = input.requestedQualityProfile ?? input.feature.defaultQualityProfile
    if (!input.feature.permittedQualityProfiles.includes(qualityProfile)) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
    const charge = resolveLiquidCreditCharge(input.feature, qualityProfile)
    const month = await resolveHrGroupCalendarMonth(input.scope, this.clock.now(), defaultHrGroupTimeZoneResolver)
    const quota = await this.credits.resolveActorQuota({ scope: input.scope, actorUserId: input.actorUserId, month })

    return {
      overallEnabled: isAiImproveAvailable(),
      featureEnabled: input.feature.productStatus === 'AVAILABLE' || input.feature.productStatus === 'INTERNAL_TEST',
      entitled: input.feature.minimumEdition === 'FOUNDATION',
      qualityProfile,
      userQuota: { allowed: quota.remainingCredits >= charge.units, remaining: quota.remainingCredits },
    }
  }
}
