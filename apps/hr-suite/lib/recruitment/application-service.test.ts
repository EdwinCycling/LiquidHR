import { describe, expect, it } from 'vitest'
import { manualApplicationInputSchema, normalizeCandidateSignal } from './application-service'

describe('application service contract', () => {
  it('houdt candidate-identiteit minimaal en application-specifiek', () => {
    const parsed = manualApplicationInputSchema.parse({
      vacancyId: '11111111-1111-4111-8111-111111111111',
      firstName: 'Lisa',
      lastName: 'Jansen',
      privateEmail: ' Lisa@example.com ',
      phone: null,
      motivation: 'TEST-RECRUITMENT-motivatie',
      source: 'MANUAL',
    })
    expect(parsed.privateEmail).toBe('Lisa@example.com')
    expect(normalizeCandidateSignal(parsed)).toEqual({ normalizedEmail: 'lisa@example.com', requiresHumanDecision: true })
  })

  it('maakt geen automatische merge van hetzelfde e-mailadres', () => {
    expect(normalizeCandidateSignal({ privateEmail: null })).toEqual({ normalizedEmail: null, requiresHumanDecision: true })
  })
})
