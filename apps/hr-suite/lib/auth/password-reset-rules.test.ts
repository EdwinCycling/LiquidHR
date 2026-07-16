import { describe, expect, it } from 'vitest'
import { passwordResetSchema } from './password-reset-rules'

describe('passwordResetSchema', () => {
  it('accepteert twee gelijke wachtwoorden van minimaal twaalf tekens', () => {
    const result = passwordResetSchema.safeParse({
      password: 'VeiligWachtwoord123!',
      passwordConfirmation: 'VeiligWachtwoord123!',
    })

    expect(result.success).toBe(true)
  })

  it('weigert verschillende wachtwoorden', () => {
    const result = passwordResetSchema.safeParse({
      password: 'VeiligWachtwoord123!',
      passwordConfirmation: 'AnderWachtwoord123!',
    })

    expect(result.success).toBe(false)
  })

  it('weigert wachtwoorden korter dan twaalf tekens', () => {
    const result = passwordResetSchema.safeParse({
      password: 'te-kort',
      passwordConfirmation: 'te-kort',
    })

    expect(result.success).toBe(false)
  })
})
