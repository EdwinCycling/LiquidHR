import { describe, expect, it } from 'vitest'
import { bulkInvitationRequestSchema } from './bulk-invitation-request'

const baseItem = {
  email: 'new.employee@example.com',
  emailKind: 'PRIVATE' as const,
  purpose: 'PREBOARDING_EMPLOYEE' as const,
  employeeId: '11111111-1111-4111-8111-111111111111',
  administrationId: '22222222-2222-4222-8222-222222222222',
  managementRoleId: '33333333-3333-4333-8333-333333333333',
  scopeType: 'ADMINISTRATION' as const,
}

describe('bulkInvitationRequestSchema', () => {
  it('accepts a bounded batch of independently validated recipients', () => {
    expect(bulkInvitationRequestSchema.safeParse({ items: [baseItem, { ...baseItem, email: 'second@example.com' }] }).success).toBe(true)
  })

  it('rejects an empty or over-sized batch', () => {
    expect(bulkInvitationRequestSchema.safeParse({ items: [] }).success).toBe(false)
    expect(bulkInvitationRequestSchema.safeParse({ items: Array.from({ length: 101 }, (_, index) => ({ ...baseItem, email: `user-${index}@example.com` })) }).success).toBe(false)
  })
})
