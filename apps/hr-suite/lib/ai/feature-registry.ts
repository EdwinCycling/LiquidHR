import type { AiFeatureDefinition, AiFeatureRegistry, AiQualityProfile } from './contracts'

export const IMPROVE_EXISTING_HR_TEXT_FEATURE = 'improve-existing-hr-text'

const profiles: readonly AiQualityProfile[] = ['EFFICIENT', 'BALANCED', 'IN_DEPTH']

const improveExistingHrText: AiFeatureDefinition = Object.freeze({
  featureCode: IMPROVE_EXISTING_HR_TEXT_FEATURE,
  capabilityGroup: 'HR_TEXT_ASSISTANCE',
  productStatus: 'PLANNED',
  minimumEdition: 'FOUNDATION',
  permittedQualityProfiles: profiles,
  defaultQualityProfile: 'BALANCED',
  chargeStrategy: 'FIXED_PER_FEATURE_AND_PROFILE',
  chargeReferenceByProfile: {
    EFFICIENT: 'ai.improve-existing-hr-text.efficient',
    BALANCED: 'ai.improve-existing-hr-text.balanced',
    IN_DEPTH: 'ai.improve-existing-hr-text.in-depth',
  },
  providerMappingByProfile: {
    EFFICIENT: { modelFamily: 'LUNA', reasoningProfile: 'MAX', generationProfile: 'LUNA_MAX_EFFICIENT' },
    BALANCED: { modelFamily: 'LUNA', reasoningProfile: 'MAX', generationProfile: 'LUNA_MAX_BALANCED' },
    IN_DEPTH: { modelFamily: 'LUNA', reasoningProfile: 'MAX', generationProfile: 'LUNA_MAX_IN_DEPTH' },
  },
  technicalLimits: {
    maxInputCharacters: 12_000,
    maxContextItems: 25,
    maxOutputCharacters: 12_000,
    timeoutMs: 20_000,
  },
  supportsWritingStyle: true,
  allowedResultType: 'PROPOSAL',
  promptTemplateVersion: 'improve-existing-hr-text.v0',
  configVersion: 'ai-foundation-1a.20260828.1',
})

const definitions: Readonly<Record<string, AiFeatureDefinition>> = {
  [IMPROVE_EXISTING_HR_TEXT_FEATURE]: improveExistingHrText,
}

export class StaticAiFeatureRegistry implements AiFeatureRegistry {
  get(featureCode: string): AiFeatureDefinition | null {
    return definitions[featureCode] ?? null
  }
}

export const aiFeatureRegistry = new StaticAiFeatureRegistry()

export const aiFeatureDefinitions = definitions
