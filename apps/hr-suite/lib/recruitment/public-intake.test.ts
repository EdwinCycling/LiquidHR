import { describe, expect, it } from 'vitest'
import { publicApplicationInputSchema, publicIntakeFailureState } from './application-service'
import { recruitmentDatabaseError } from './errors'

describe('public recruitment intake', () => {
  it('geeft een neutrale foutstate als challenge of scanner niet beschikbaar is', () => {
    expect(publicIntakeFailureState('RECRUITMENT_BOT_CHALLENGE_UNAVAILABLE')).toEqual({ kind: 'SECURITY_BLOCKED' })
    expect(publicIntakeFailureState('RECRUITMENT_MALWARE_SCANNER_UNAVAILABLE')).toEqual({ kind: 'SECURITY_BLOCKED' })
  })

  it('houdt de claim-, proof-, body- en configuratiefouten stabiel en privacyarm', () => {
    expect(recruitmentDatabaseError({ message: 'RECRUITMENT_PUBLIC_RATE_LIMITED' })).toMatchObject({ code: 'RECRUITMENT_PUBLIC_RATE_LIMITED', status: 429 })
    expect(recruitmentDatabaseError({ message: 'RECRUITMENT_PUBLIC_PROOF_INVALID' })).toMatchObject({ code: 'RECRUITMENT_PUBLIC_PROOF_INVALID', status: 403 })
    expect(recruitmentDatabaseError({ message: 'RECRUITMENT_PUBLIC_REQUEST_TOO_LARGE' })).toMatchObject({ code: 'RECRUITMENT_PUBLIC_REQUEST_TOO_LARGE', status: 413 })
    expect(recruitmentDatabaseError({ message: 'RECRUITMENT_PUBLIC_SECURITY_UNAVAILABLE internal edge detail' })).toMatchObject({ code: 'RECRUITMENT_PUBLIC_SECURITY_UNAVAILABLE', status: 503 })
  })

  it('accepteert alleen de publieke formulieridentiteit en geen interne context', () => {
    expect(publicApplicationInputSchema.safeParse({
      firstName: 'Sanne',
      lastName: 'de Vries',
      email: 'sanne@example.invalid',
      phone: '',
      motivation: '',
      answers: [],
      challengeToken: 'token',
      honeypot: '',
      renderedAt: '2026-08-13T10:00:00.000Z',
      idempotencyKey: 'test-recruitment-key',
    }).success).toBe(true)
    expect(publicApplicationInputSchema.safeParse({ firstName: 'Sanne', lastName: 'de Vries', email: 'sanne@example.invalid', tenantId: 'leak' }).success).toBe(false)
  })
})
