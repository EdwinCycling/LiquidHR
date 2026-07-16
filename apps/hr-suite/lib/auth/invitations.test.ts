import { describe, expect, it } from 'vitest'
import {
  buildInvitationRedirectUrl,
  hashInvitationToken,
  normalizeInvitationEmail,
  validateInvitationRules,
} from '@/lib/auth/invitation-rules'

describe('normalizeInvitationEmail', () => {
  it('normaliseert spaties en hoofdletters', () => {
    expect(normalizeInvitationEmail(' Edwin@Example.COM ')).toBe('edwin@example.com')
  })
})

describe('validateInvitationRules', () => {
  it('vereist een zakelijk mailtype voor een gewone gebruiker', () => {
    expect(validateInvitationRules({
      purpose: 'BUSINESS_USER',
      emailKind: 'PRIVATE',
      employeeId: null,
      administrationId: null,
      scopeType: 'TENANT',
    })).toEqual({ ok: false, code: 'BUSINESS_EMAIL_REQUIRED' })
  })

  it('vereist een medewerker bij preboarding', () => {
    expect(validateInvitationRules({
      purpose: 'PREBOARDING_EMPLOYEE',
      emailKind: 'PRIVATE',
      employeeId: null,
      administrationId: '11111111-1111-1111-1111-111111111111',
      scopeType: 'ADMINISTRATION',
    })).toEqual({ ok: false, code: 'EMPLOYEE_REQUIRED' })
  })

  it('vereist een administratie voor administratiescope', () => {
    expect(validateInvitationRules({
      purpose: 'BUSINESS_USER',
      emailKind: 'BUSINESS',
      employeeId: null,
      administrationId: null,
      scopeType: 'ADMINISTRATION',
    })).toEqual({ ok: false, code: 'ADMINISTRATION_REQUIRED' })
  })

  it('accepteert geldige business-onboarding op tenantscope', () => {
    expect(validateInvitationRules({
      purpose: 'BUSINESS_USER',
      emailKind: 'BUSINESS',
      employeeId: null,
      administrationId: null,
      scopeType: 'TENANT',
    })).toEqual({ ok: true })
  })
})

describe('invitation token', () => {
  it('slaat uitsluitend een sha256-hash op', () => {
    const token = 'een-lang-willekeurig-token'
    const hash = hashInvitationToken(token)

    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).not.toContain(token)
  })

  it('bouwt een veilige redirect naar de acceptatiepagina', () => {
    const url = buildInvitationRedirectUrl('https://preview.liquid-hr.example', 'a+b/c=')

    expect(url).toBe('https://preview.liquid-hr.example/invite/accept?invitation=a%2Bb%2Fc%3D')
  })
})
