import { describe, expect, it } from 'vitest'
import { aiFeatureDefinitions, aiFeatureRegistry, IMPROVE_EXISTING_HR_TEXT_FEATURE } from './feature-registry'

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
    expect(Object.keys(aiFeatureDefinitions)).toEqual([IMPROVE_EXISTING_HR_TEXT_FEATURE])
  })

  it('geeft geen registry-entry terug voor een onbekende feature', () => {
    expect(aiFeatureRegistry.get('unknown-feature')).toBeNull()
  })
})
