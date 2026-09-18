import { describe, expect, it } from 'vitest'
import { bulkInvitationRequestSchema } from './bulk-invitation-request'
import { employeeBulkInvitationRequestSchema } from './employee-invitation-request'

const baseBusinessItem = {
  email: 'business@example.com',
  emailKind: 'BUSINESS' as const,
  purpose: 'BUSINESS_USER' as const,
  employeeId: null,
  administrationId: null,
  managementRoleId: '33333333-3333-4333-8333-333333333333',
  scopeType: 'TENANT' as const,
}

describe('bulkInvitationRequestSchema', () => {
  it('accepts a bounded batch of separately supported business recipients', () => {
    expect(bulkInvitationRequestSchema.safeParse({ items: [baseBusinessItem, { ...baseBusinessItem, email: 'second@example.com' }] }).success).toBe(true)
  })

  it('rejects an empty or over-sized batch', () => {
    expect(bulkInvitationRequestSchema.safeParse({ items: [] }).success).toBe(false)
    expect(bulkInvitationRequestSchema.safeParse({ items: Array.from({ length: 101 }, (_, index) => ({ ...baseBusinessItem, email: `user-${index}@example.com` })) }).success).toBe(false)
  })

  it('does not accept employee activation contracts', () => {
    expect(bulkInvitationRequestSchema.safeParse({ items: [{
      ...baseBusinessItem,
      email: 'employee@example.com',
      emailKind: 'PRIVATE',
      purpose: 'PREBOARDING_EMPLOYEE',
      employeeId: '11111111-1111-4111-8111-111111111111',
    }] }).success).toBe(false)
  })

  it('accepts only employee IDs for the canonical employee batch', () => {
    expect(employeeBulkInvitationRequestSchema.safeParse({
      employeeIds: ['11111111-1111-4111-8111-111111111111'],
    }).success).toBe(true)
    expect(employeeBulkInvitationRequestSchema.safeParse({
      employeeIds: ['11111111-1111-4111-8111-111111111111'],
      purpose: 'BUSINESS_USER',
    }).success).toBe(false)
  })
})
