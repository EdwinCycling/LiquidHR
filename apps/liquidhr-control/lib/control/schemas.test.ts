import { describe, expect, it } from 'vitest'
import { lifecycleCommandSchema, onboardingSchema, updateHrGroupSchema } from './schemas'

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

  it('weigert dubbele administratiecodes en namen', () => {
    const result = onboardingSchema.safeParse({
      name: 'Voorbeeld BV',
      slug: 'voorbeeld-bv',
      administrationMode: 'SEPARATE',
      primaryContactEmail: 'admin@example.com',
      administrations: [
        { code: 'HOLDING', name: 'Hoofdkantoor' },
        { code: 'holding', name: 'Hoofdkantoor' },
      ],
    })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining(['ADMINISTRATION_CODE_DUPLICATE', 'ADMINISTRATION_NAME_DUPLICATE']))
  })

  it('weigert meer dan 25 administraties', () => {
    expect(onboardingSchema.safeParse({
      name: 'Voorbeeld BV',
      slug: 'voorbeeld-bv',
      administrationMode: 'SEPARATE',
      primaryContactEmail: 'admin@example.com',
      administrations: Array.from({ length: 26 }, (_, index) => ({ code: 'A' + index, name: 'Administratie ' + index })),
    }).success).toBe(false)
  })

  it('normaliseert de HR-groepvelden zonder de code te wijzigen', () => {
    const result = updateHrGroupSchema.parse({
      tenantId: '016a7b84-9e98-4d99-a95a-70f21b06a2ae',
      hrGroupId: 'd51f8e2e-03e9-46ab-90ea-c30177c8af67',
      name: ' Nieuwe naam ',
      description: '  Testomschrijving  ',
    })
    expect(result.name).toBe('Nieuwe naam')
    expect(result.description).toBe('Testomschrijving')
  })

  it('weigert lege HR-groepnamen en ongeldige identifiers', () => {
    expect(updateHrGroupSchema.safeParse({
      tenantId: 'tenant',
      hrGroupId: 'group',
      name: ' ',
      description: '',
    }).success).toBe(false)
  })

  it('vereist een inhoudelijke reden bij een statuswijziging', () => {
    expect(lifecycleCommandSchema.safeParse({
      tenantId: '016a7b84-9e98-4d99-a95a-70f21b06a2ae', status: 'PAUSED', reason: 'nee',
    }).success).toBe(false)
  })
})