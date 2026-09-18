import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createEmployeeInvitation } = vi.hoisted(() => ({ createEmployeeInvitation: vi.fn() }))

vi.mock('@/lib/auth/employee-invitations', () => ({ createEmployeeInvitation }))

import { NextRequest } from 'next/server'
import { POST } from './route'

const employeeId = '11111111-1111-4111-8111-111111111111'

function post(body: unknown): NextRequest {
  return new NextRequest('https://internal.vercel.app/api/invitations/employee', {
    method: 'POST',
    headers: {
      host: 'internal.vercel.app',
      'x-forwarded-host': 'attacker.example',
      'x-forwarded-proto': 'https',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/invitations/employee', () => {
  beforeEach(() => {
    createEmployeeInvitation.mockReset()
    createEmployeeInvitation.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      expiresAt: '2026-09-24T00:00:00.000Z',
      email: 'canonical@example.com',
      purpose: 'EMPLOYEE_ACTIVATION',
    })
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://liquid-hr-hr-suite.vercel.app')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rejects browser-controlled email, purpose, role, and scope fields', async () => {
    const response = await POST(post({
      employeeId,
      email: 'attacker@example.com',
      emailKind: 'BUSINESS',
      purpose: 'BUSINESS_USER',
      managementRoleId: '33333333-3333-4333-8333-333333333333',
      scopeType: 'ADMINISTRATION',
    }))

    expect(response.status).toBe(400)
    expect(createEmployeeInvitation).not.toHaveBeenCalled()
  })

  it('forwards only the selected employee identity and canonical origin', async () => {
    const response = await POST(post({ employeeId }))

    expect(response.status).toBe(201)
    expect(createEmployeeInvitation).toHaveBeenCalledWith(employeeId, 'https://liquid-hr-hr-suite.vercel.app')
  })
})
