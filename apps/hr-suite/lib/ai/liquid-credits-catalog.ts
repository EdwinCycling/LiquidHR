import { AiExecutionError, type AiFeatureDefinition, type AiQualityProfile } from './contracts'

export interface LiquidCreditCharge {
  featureCode: string
  qualityProfile: AiQualityProfile
  chargeReference: string
  units: number
}

const CHARGE_UNITS_BY_FEATURE: Readonly<Record<string, Readonly<Record<AiQualityProfile, number>>>> = {
  'improve-existing-hr-text': {
    EFFICIENT: 1,
    BALANCED: 2,
    IN_DEPTH: 3,
  },
  EMPLOYEE_SUMMARY: { EFFICIENT: 1, BALANCED: 2, IN_DEPTH: 3 },
  CONVERSATION_PREPARATION: { EFFICIENT: 1, BALANCED: 2, IN_DEPTH: 3 },
  DEVELOPMENT_GOAL_SMART: { EFFICIENT: 1, BALANCED: 2, IN_DEPTH: 3 },
  VACANCY_DRAFT: { EFFICIENT: 1, BALANCED: 2, IN_DEPTH: 3 },
}

const CHARGE_REFERENCES_BY_FEATURE: Readonly<Record<string, Readonly<Record<AiQualityProfile, string>>>> = {
  'improve-existing-hr-text': {
    EFFICIENT: 'ai.improve-existing-hr-text.efficient',
    BALANCED: 'ai.improve-existing-hr-text.balanced',
    IN_DEPTH: 'ai.improve-existing-hr-text.in-depth',
  },
  EMPLOYEE_SUMMARY: {
    EFFICIENT: 'ai.employee-summary.efficient',
    BALANCED: 'ai.employee-summary.balanced',
    IN_DEPTH: 'ai.employee-summary.in-depth',
  },
  CONVERSATION_PREPARATION: {
    EFFICIENT: 'ai.conversation-preparation.efficient',
    BALANCED: 'ai.conversation-preparation.balanced',
    IN_DEPTH: 'ai.conversation-preparation.in-depth',
  },
  DEVELOPMENT_GOAL_SMART: {
    EFFICIENT: 'ai.development-goal-smart.efficient',
    BALANCED: 'ai.development-goal-smart.balanced',
    IN_DEPTH: 'ai.development-goal-smart.in-depth',
  },
  VACANCY_DRAFT: {
    EFFICIENT: 'ai.vacancy-draft.efficient',
    BALANCED: 'ai.vacancy-draft.balanced',
    IN_DEPTH: 'ai.vacancy-draft.in-depth',
  },
}

const CHARGE_UNITS_BY_REFERENCE: Readonly<Record<string, number>> = {
  'ai.improve-existing-hr-text.efficient': 1,
  'ai.improve-existing-hr-text.balanced': 2,
  'ai.improve-existing-hr-text.in-depth': 3,
  'ai.employee-summary.efficient': 1,
  'ai.employee-summary.balanced': 2,
  'ai.employee-summary.in-depth': 3,
  'ai.conversation-preparation.efficient': 1,
  'ai.conversation-preparation.balanced': 2,
  'ai.conversation-preparation.in-depth': 3,
  'ai.development-goal-smart.efficient': 1,
  'ai.development-goal-smart.balanced': 2,
  'ai.development-goal-smart.in-depth': 3,
  'ai.vacancy-draft.efficient': 1,
  'ai.vacancy-draft.balanced': 2,
  'ai.vacancy-draft.in-depth': 3,
}

export const AI_LIQUID_CREDIT_CHARGE_UNITS = CHARGE_UNITS_BY_REFERENCE

export function resolveLiquidCreditCharge(feature: AiFeatureDefinition, qualityProfile: AiQualityProfile): LiquidCreditCharge {
  if (feature.chargeStrategy !== 'FIXED_PER_FEATURE_AND_PROFILE') {
    throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }
  if (!feature.permittedQualityProfiles.includes(qualityProfile)) {
    throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }

  const chargeReference = feature.chargeReferenceByProfile[qualityProfile]
  const units = CHARGE_UNITS_BY_FEATURE[feature.featureCode]?.[qualityProfile]
  const canonicalReference = CHARGE_REFERENCES_BY_FEATURE[feature.featureCode]?.[qualityProfile]
  if (!chargeReference || chargeReference !== canonicalReference || !units || CHARGE_UNITS_BY_REFERENCE[chargeReference] !== units) {
    throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  }

  return { featureCode: feature.featureCode, qualityProfile, chargeReference, units }
}

export function resolveLiquidCreditChargeReference(featureCode: string, chargeReference: string): number {
  const profileCharges = CHARGE_UNITS_BY_FEATURE[featureCode]
  const references = CHARGE_REFERENCES_BY_FEATURE[featureCode]
  if (!profileCharges || !references) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')

  const matchedProfile = (Object.keys(profileCharges) as AiQualityProfile[]).find((profile) => references[profile] === chargeReference)

  if (!matchedProfile) throw new AiExecutionError('INTERNAL_CONFIGURATION_ERROR')
  return profileCharges[matchedProfile]
}
