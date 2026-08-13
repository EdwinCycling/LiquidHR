import { describe, expect, it } from 'vitest'
import { publicApplicationInputSchema, publicIntakeFailureState } from './application-service'

describe('public recruitment intake', () => {
  it('geeft een neutrale foutstate als challenge of scanner niet beschikbaar is', () => {
    expect(publicIntakeFailureState('RECRUITMENT_BOT_CHALLENGE_UNAVAILABLE')).toEqual({ kind: 'SECURITY_BLOCKED' })
    expect(publicIntakeFailureState('RECRUITMENT_MALWARE_SCANNER_UNAVAILABLE')).toEqual({ kind: 'SECURITY_BLOCKED' })
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
