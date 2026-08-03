import { describe, expect, it } from 'vitest'
import { lifecycleCommandSchema, onboardingSchema } from './schemas'

describe('control plane schemas', () => {
  it('normaliseert een geldige onboarding', () => {
    const result = onboardingSchema.parse({
      name: ' Demo Groep ', slug: 'demo-groep', administrationMode: 'COMBINED',
      primaryContactEmail: 'HR@EXAMPLE.COM',
      administrations: [{ code: ' bv-1 ', name: ' Demo B.V. ' }],
    })
    expect(result.primaryContactEmail).toBe('hr@example.com')
    expect(result.administrations[0]?.code).toBe('BV-1')
  })

  it('weigert een onveilige slug', () => {
    expect(onboardingSchema.safeParse({
      name: 'Demo', slug: '../demo', administrationMode: 'SEPARATE',
      primaryContactEmail: 'hr@example.com', administrations: [{ code: 'DEMO', name: 'Demo' }],
    }).success).toBe(false)
  })

  it('vereist een inhoudelijke reden bij een statuswijziging', () => {
    expect(lifecycleCommandSchema.safeParse({
      tenantId: '016a7b84-9e98-4d99-a95a-70f21b06a2ae', status: 'PAUSED', reason: 'nee',
    }).success).toBe(false)
  })
})
