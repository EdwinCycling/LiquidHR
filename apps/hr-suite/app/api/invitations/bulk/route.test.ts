import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createBulkEmployeeInvitations, createBulkInvitations } = vi.hoisted(() => ({
  createBulkEmployeeInvitations: vi.fn(),
  createBulkInvitations: vi.fn(),
}))

vi.mock('@/lib/auth/bulk-invitations', () => ({ createBulkEmployeeInvitations, createBulkInvitations }))

import { NextRequest } from 'next/server'
import { POST } from './route'

const employeeIds = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
]

function post(body: unknown): NextRequest {
  return new NextRequest('https://internal.vercel.app/api/invitations/bulk', {
    method: 'POST',
    headers: { host: 'internal.vercel.app', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const success = { total: 2, succeeded: 2, failed: 0, results: [] }

describe('POST /api/invitations/bulk', () => {
  beforeEach(() => {
    createBulkEmployeeInvitations.mockReset()
    createBulkInvitations.mockReset()
    createBulkEmployeeInvitations.mockResolvedValue(success)
    createBulkInvitations.mockResolvedValue({ total: 1, succeeded: 1, failed: 0, results: [] })
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://liquid-hr-hr-suite.vercel.app')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepts employee IDs and routes each target through the canonical employee service', async () => {
    const response = await POST(post({ employeeIds }))

    expect(response.status).toBe(201)
    expect(createBulkEmployeeInvitations).toHaveBeenCalledWith(employeeIds, 'https://liquid-hr-hr-suite.vercel.app')
    expect(createBulkInvitations).not.toHaveBeenCalled()
  })

  it('rejects a crafted employee invitation contract instead of treating it as a bulk employee request', async () => {
    const response = await POST(post({
      items: [{
        email: 'attacker@example.com',
        emailKind: 'PRIVATE',
        purpose: 'PREBOARDING_EMPLOYEE',
        employeeId: employeeIds[0],
        administrationId: null,
        managementRoleId: '33333333-3333-4333-8333-333333333333',
        scopeType: 'TENANT',
      }],
    }))

    expect(response.status).toBe(400)
    expect(createBulkEmployeeInvitations).not.toHaveBeenCalled()
    expect(createBulkInvitations).not.toHaveBeenCalled()
  })

  it('keeps the separately supported BUSINESS_USER batch contract', async () => {
    const response = await POST(post({
      items: [{
        email: 'business@example.com',
        emailKind: 'BUSINESS',
        purpose: 'BUSINESS_USER',
        employeeId: null,
        administrationId: null,
        managementRoleId: '33333333-3333-4333-8333-333333333333',
        scopeType: 'TENANT',
      }],
    }))

    expect(response.status).toBe(201)
    expect(createBulkInvitations).toHaveBeenCalledWith([expect.objectContaining({
      email: 'business@example.com',
      purpose: 'BUSINESS_USER',
    })], 'https://liquid-hr-hr-suite.vercel.app')
    expect(createBulkEmployeeInvitations).not.toHaveBeenCalled()
  })
})
