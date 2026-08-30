import { describe, expect, it } from 'vitest'
import { aiFeatureRegistry } from './feature-registry'
import { resolveLiquidCreditCharge, resolveLiquidCreditChargeReference } from './liquid-credits-catalog'

describe('Liquid Credits charge catalog', () => {
  it('resolvet de bestaande registry-reference naar vaste integer charges', () => {
    const feature = aiFeatureRegistry.get('improve-existing-hr-text')
    expect(feature).not.toBeNull()
    if (!feature) throw new Error('Expected registry feature')

    expect(resolveLiquidCreditCharge(feature, 'EFFICIENT').units).toBe(1)
    expect(resolveLiquidCreditCharge(feature, 'BALANCED').units).toBe(2)
    expect(resolveLiquidCreditCharge(feature, 'IN_DEPTH').units).toBe(3)
  })

  it('houdt de eerste capability op de bestaande vaste catalogus en weigert een onbekende reference', () => {
    const feature = aiFeatureRegistry.get('improve-existing-hr-text')
    expect(feature?.productStatus).toBe('AVAILABLE')

    expect(() => resolveLiquidCreditChargeReference('improve-existing-hr-text', 'ai.unknown')).toThrowError(/INTERNAL_CONFIGURATION_ERROR/)
    expect(() => resolveLiquidCreditCharge({
      ...feature!,
      chargeReferenceByProfile: {
        ...feature!.chargeReferenceByProfile,
        BALANCED: 'ai.unknown',
      },
    }, 'BALANCED')).toThrowError(/INTERNAL_CONFIGURATION_ERROR/)
  })
})
