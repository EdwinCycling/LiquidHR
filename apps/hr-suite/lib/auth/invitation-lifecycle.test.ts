import { describe, expect, it } from 'vitest'
import { canResendInvitation, resolveInvitationLifecycleStatus } from './invitation-lifecycle'

describe('invitation lifecycle', () => {
  it('maps a live pending token to INVITED', () => {
    expect(resolveInvitationLifecycleStatus({
      status: 'PENDING',
      expiresAt: '2026-09-24T00:00:00.000Z',
      now: '2026-09-17T00:00:00.000Z',
    })).toBe('INVITED')
  })

  it('maps accepted linked access to ACTIVE and blocks reinvites', () => {
    expect(resolveInvitationLifecycleStatus({
      status: 'ACCEPTED',
      expiresAt: '2026-09-24T00:00:00.000Z',
      employeeLinked: true,
      now: '2026-09-17T00:00:00.000Z',
    })).toBe('ACTIVE')
    expect(canResendInvitation({ status: 'ACCEPTED', employeeLinked: true })).toBe(false)
  })

  it('keeps expired and revoked invitations visible without exposing tokens', () => {
    expect(resolveInvitationLifecycleStatus({
      status: 'PENDING',
      expiresAt: '2026-09-16T00:00:00.000Z',
      now: '2026-09-17T00:00:00.000Z',
    })).toBe('EXPIRED')
    expect(resolveInvitationLifecycleStatus({
      status: 'REVOKED',
      expiresAt: '2026-09-24T00:00:00.000Z',
      now: '2026-09-17T00:00:00.000Z',
    })).toBe('BLOCKED')
  })
})
