import { describe, expect, it } from 'vitest'
import { invitationRequestSchema } from '@/lib/auth/invitation-request'

describe('invitationRequestSchema', () => {
  it('accepteert een volledige preboardinguitnodiging', () => {
    const result = invitationRequestSchema.safeParse({
      email: 'nieuw@voorbeeld.nl',
      emailKind: 'PRIVATE',
      purpose: 'PREBOARDING_EMPLOYEE',
      employeeId: '11111111-1111-4111-8111-111111111111',
      administrationId: '22222222-2222-4222-8222-222222222222',
      managementRoleId: '33333333-3333-4333-8333-333333333333',
      scopeType: 'ADMINISTRATION',
    })

    expect(result.success).toBe(true)
  })

  it('weigert een ongeldig e-mailadres', () => {
    const result = invitationRequestSchema.safeParse({
      email: 'geen-email',
      emailKind: 'BUSINESS',
      purpose: 'BUSINESS_USER',
      employeeId: null,
      administrationId: null,
      managementRoleId: '33333333-3333-4333-8333-333333333333',
      scopeType: 'TENANT',
    })

    expect(result.success).toBe(false)
  })

  it('weigert onbekende velden', () => {
    const result = invitationRequestSchema.safeParse({
      email: 'user@voorbeeld.nl',
      emailKind: 'BUSINESS',
      purpose: 'BUSINESS_USER',
      employeeId: null,
      administrationId: null,
      managementRoleId: '33333333-3333-4333-8333-333333333333',
      scopeType: 'TENANT',
      tenantId: 'door-client-ingevuld',
    })

    expect(result.success).toBe(false)
  })
})
