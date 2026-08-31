import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createInvitation } = vi.hoisted(() => ({ createInvitation: vi.fn() }))

vi.mock('@/lib/auth/invitations', () => ({ createInvitation }))

import { NextRequest } from 'next/server'
import { POST } from './route'

describe('POST /api/invitations', () => {
  beforeEach(() => {
    createInvitation.mockReset()
    createInvitation.mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222', expiresAt: '2026-09-02T00:00:00.000Z' })
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://liquid-hr-hr-suite.vercel.app')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'liquid-hr-hr-suite.vercel.app')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('gebruikt de canonieke origin voor uitnodigingslinks', async () => {
    const request = new NextRequest('https://internal.vercel.app/api/invitations', {
      method: 'POST',
      headers: {
        host: 'internal.vercel.app',
        'x-forwarded-host': 'attacker.example',
        'x-forwarded-proto': 'https',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'new.user@example.com',
        emailKind: 'BUSINESS',
        purpose: 'BUSINESS_USER',
        managementRoleId: '11111111-1111-4111-8111-111111111111',
        scopeType: 'TENANT',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(201)
    expect(createInvitation).toHaveBeenCalledWith(expect.objectContaining({
      origin: 'https://liquid-hr-hr-suite.vercel.app',
      employeeId: null,
      administrationId: null,
    }))
  })
})
