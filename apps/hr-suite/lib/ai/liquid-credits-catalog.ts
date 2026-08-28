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
}

const CHARGE_REFERENCES_BY_FEATURE: Readonly<Record<string, Readonly<Record<AiQualityProfile, string>>>> = {
  'improve-existing-hr-text': {
    EFFICIENT: 'ai.improve-existing-hr-text.efficient',
    BALANCED: 'ai.improve-existing-hr-text.balanced',
    IN_DEPTH: 'ai.improve-existing-hr-text.in-depth',
  },
}

const CHARGE_UNITS_BY_REFERENCE: Readonly<Record<string, number>> = {
  'ai.improve-existing-hr-text.efficient': 1,
  'ai.improve-existing-hr-text.balanced': 2,
  'ai.improve-existing-hr-text.in-depth': 3,
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
