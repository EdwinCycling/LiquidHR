import { describe, expect, it } from 'vitest'
import { aiFeatureDefinitions, aiFeatureRegistry, CONVERSATION_PREPARATION_FEATURE, DEVELOPMENT_GOAL_SMART_FEATURE, EMPLOYEE_SUMMARY_FEATURE, IMPROVE_EXISTING_HR_TEXT_FEATURE, VACANCY_DRAFT_FEATURE } from './feature-registry'

describe('AI feature registry', () => {
  it('registreert de eerste capability als available proposal-only contract', () => {
    const feature = aiFeatureRegistry.get(IMPROVE_EXISTING_HR_TEXT_FEATURE)
    expect(feature).toMatchObject({
      featureCode: IMPROVE_EXISTING_HR_TEXT_FEATURE,
      productStatus: 'AVAILABLE',
      allowedResultType: 'PROPOSAL',
      defaultQualityProfile: 'EFFICIENT',
      supportsWritingStyle: true,
    })
    expect(feature?.providerMappingByProfile.IN_DEPTH).toMatchObject({ modelFamily: 'LUNA', reasoningProfile: 'MAX' })
    expect(Object.keys(aiFeatureDefinitions)).toEqual([IMPROVE_EXISTING_HR_TEXT_FEATURE, EMPLOYEE_SUMMARY_FEATURE, CONVERSATION_PREPARATION_FEATURE, DEVELOPMENT_GOAL_SMART_FEATURE, VACANCY_DRAFT_FEATURE])
  })

  it('registreert AI Everywhere met proposal-only en vaste profile charges', () => {
    for (const featureCode of [EMPLOYEE_SUMMARY_FEATURE, CONVERSATION_PREPARATION_FEATURE, DEVELOPMENT_GOAL_SMART_FEATURE, VACANCY_DRAFT_FEATURE]) {
      const feature = aiFeatureRegistry.get(featureCode)
      expect(feature).toMatchObject({ featureCode, capabilityGroup: 'AI_EVERYWHERE_V1', productStatus: 'AVAILABLE', allowedResultType: 'PROPOSAL', supportsWritingStyle: false })
      expect(feature?.chargeReferenceByProfile.EFFICIENT).toMatch(/^ai\.(employee-summary|conversation-preparation|development-goal-smart|vacancy-draft)\.efficient$/)
      expect(feature?.chargeReferenceByProfile.BALANCED).toMatch(/^ai\.(employee-summary|conversation-preparation|development-goal-smart|vacancy-draft)\.balanced$/)
      expect(feature?.chargeReferenceByProfile.IN_DEPTH).toMatch(/^ai\.(employee-summary|conversation-preparation|development-goal-smart|vacancy-draft)\.in-depth$/)
    }
  })

  it('geeft geen registry-entry terug voor een onbekende feature', () => {
    expect(aiFeatureRegistry.get('unknown-feature')).toBeNull()
  })
})
