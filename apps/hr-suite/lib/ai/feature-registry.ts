import type { AiFeatureDefinition, AiFeatureRegistry, AiQualityProfile } from './contracts'

export const IMPROVE_EXISTING_HR_TEXT_FEATURE = 'improve-existing-hr-text'
export const EMPLOYEE_SUMMARY_FEATURE = 'EMPLOYEE_SUMMARY'
export const CONVERSATION_PREPARATION_FEATURE = 'CONVERSATION_PREPARATION'
export const DEVELOPMENT_GOAL_SMART_FEATURE = 'DEVELOPMENT_GOAL_SMART'
export const VACANCY_DRAFT_FEATURE = 'VACANCY_DRAFT'

const profiles: readonly AiQualityProfile[] = ['EFFICIENT', 'BALANCED', 'IN_DEPTH']

const improveExistingHrText: AiFeatureDefinition = Object.freeze({
  featureCode: IMPROVE_EXISTING_HR_TEXT_FEATURE,
  capabilityGroup: 'HR_TEXT_ASSISTANCE',
  productStatus: 'AVAILABLE',
  minimumEdition: 'FOUNDATION',
  permittedQualityProfiles: profiles,
  defaultQualityProfile: 'EFFICIENT',
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
  promptTemplateVersion: 'improve-existing-hr-text.v1',
  configVersion: 'ai-foundation-1a.20260830.1',
})

const aiEverywhereProfiles: readonly AiQualityProfile[] = ['EFFICIENT', 'BALANCED', 'IN_DEPTH']
const aiEverywhereProviderMappings = {
  EFFICIENT: { modelFamily: 'LUNA', reasoningProfile: 'MAX', generationProfile: 'LUNA_MAX_EFFICIENT' },
  BALANCED: { modelFamily: 'LUNA', reasoningProfile: 'MAX', generationProfile: 'LUNA_MAX_BALANCED' },
  IN_DEPTH: { modelFamily: 'LUNA', reasoningProfile: 'MAX', generationProfile: 'LUNA_MAX_IN_DEPTH' },
} as const

function aiEverywhereFeature(featureCode: string, promptTemplateVersion: string, chargePrefix: string): AiFeatureDefinition {
  return Object.freeze({
    featureCode,
    capabilityGroup: 'AI_EVERYWHERE_V1',
    productStatus: 'AVAILABLE',
    minimumEdition: 'FOUNDATION',
    permittedQualityProfiles: aiEverywhereProfiles,
    defaultQualityProfile: 'EFFICIENT',
    chargeStrategy: 'FIXED_PER_FEATURE_AND_PROFILE',
    chargeReferenceByProfile: {
      EFFICIENT: `ai.${chargePrefix}.efficient`,
      BALANCED: `ai.${chargePrefix}.balanced`,
      IN_DEPTH: `ai.${chargePrefix}.in-depth`,
    },
    providerMappingByProfile: aiEverywhereProviderMappings,
    technicalLimits: {
      maxInputCharacters: 16_000,
      maxContextItems: 25,
      maxOutputCharacters: 12_000,
      timeoutMs: 20_000,
    },
    supportsWritingStyle: false,
    allowedResultType: 'PROPOSAL',
    promptTemplateVersion,
    configVersion: 'ai-everywhere-v1.20260907.1',
  })
}

const employeeSummary = aiEverywhereFeature(EMPLOYEE_SUMMARY_FEATURE, 'employee-summary.v1', 'employee-summary')
const conversationPreparation = aiEverywhereFeature(CONVERSATION_PREPARATION_FEATURE, 'conversation-preparation.v1', 'conversation-preparation')
const developmentGoalSmart = aiEverywhereFeature(DEVELOPMENT_GOAL_SMART_FEATURE, 'development-goal-smart.v1', 'development-goal-smart')
const vacancyDraft = aiEverywhereFeature(VACANCY_DRAFT_FEATURE, 'vacancy-draft.v1', 'vacancy-draft')

const definitions: Readonly<Record<string, AiFeatureDefinition>> = {
  [IMPROVE_EXISTING_HR_TEXT_FEATURE]: improveExistingHrText,
  [EMPLOYEE_SUMMARY_FEATURE]: employeeSummary,
  [CONVERSATION_PREPARATION_FEATURE]: conversationPreparation,
  [DEVELOPMENT_GOAL_SMART_FEATURE]: developmentGoalSmart,
  [VACANCY_DRAFT_FEATURE]: vacancyDraft,
}

export class StaticAiFeatureRegistry implements AiFeatureRegistry {
  get(featureCode: string): AiFeatureDefinition | null {
    return definitions[featureCode] ?? null
  }
}

export const aiFeatureRegistry = new StaticAiFeatureRegistry()

export const aiFeatureDefinitions = definitions
