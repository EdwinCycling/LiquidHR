import { describe, expect, it } from 'vitest'
import {
  invitationAcceptanceSchema,
  mapInvitationDatabaseError,
} from '@/lib/auth/invitation-acceptance-rules'

describe('invitationAcceptanceSchema', () => {
  it('vereist een lang wachtwoord wanneer een wachtwoord wordt ingesteld', () => {
    expect(invitationAcceptanceSchema.safeParse({
      token: 'een-token',
      password: 'te-kort',
    }).success).toBe(false)
  })

  it('staat acceptatie zonder nieuw wachtwoord toe voor Google-gebruikers', () => {
    expect(invitationAcceptanceSchema.safeParse({
      token: 'een-token',
    }).success).toBe(true)
  })
})

describe('mapInvitationDatabaseError', () => {
  it.each([
    ['INVITATION_EXPIRED', 'expired'],
    ['INVITATION_EMAIL_MISMATCH', 'emailMismatch'],
    ['INVITATION_INVALID', 'invalid'],
    ['EMPLOYEE_ALREADY_LINKED', 'employeeAlreadyLinked'],
    ['onbekende fout', 'unknown'],
  ] as const)('vertaalt %s naar %s', (message, expected) => {
    expect(mapInvitationDatabaseError(message)).toBe(expected)
  })
})
