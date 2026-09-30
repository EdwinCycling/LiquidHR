import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { updateCapability, mapPermissionError } = vi.hoisted(() => ({
  updateCapability: vi.fn(),
  mapPermissionError: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse: mapPermissionError }))
vi.mock('@/lib/payroll/access', () => ({
  PayrollLabUnavailableError: class PayrollLabUnavailableError extends Error {},
  updatePayrollLabAdministrationCapability: updateCapability,
}))

import { NextRequest, NextResponse } from 'next/server'
import { PayrollLabUnavailableError } from '@/lib/payroll/access'
import { POST } from './route'

const APPLICATION_URL = 'http://localhost:3000'

function capabilityRequest(body: string, origin = APPLICATION_URL): NextRequest {
  return new NextRequest(`${APPLICATION_URL}/api/payroll-lab/capability`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body,
  })
}

describe('POST /api/payroll-lab/capability', () => {
  beforeEach(() => {
    updateCapability.mockReset()
    mapPermissionError.mockReset().mockReturnValue(null)
    updateCapability.mockResolvedValue({
      id: '55555555-5555-4555-8555-555555555555',
      displayName: 'Payroll Lab test administration',
      capabilityEnabled: true,
      status: 'ACTIVE',
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('accepts only a same-origin enabled boolean and returns no administration identifiers', async () => {
    const response = await POST(capabilityRequest('{"enabled":true}'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ data: { capabilityEnabled: true } })
    expect(updateCapability).toHaveBeenCalledOnce()
    expect(updateCapability).toHaveBeenCalledWith(true)
  })

  it('rejects a cross-origin request before authorization or mutation', async () => {
    const response = await POST(capabilityRequest('{"enabled":true}', 'https://attacker.example'))

    expect(response.status).toBe(403)
    expect(updateCapability).not.toHaveBeenCalled()
  })

  it.each([
    '{"enabled":true,"tenantId":"11111111-1111-4111-8111-111111111111"}',
    '{"enabled":"true"}',
    'null',
    '{',
  ])('rejects malformed or scope-bearing input: %s', async (body) => {
    const response = await POST(capabilityRequest(body))

    expect(response.status).toBe(400)
    expect(updateCapability).not.toHaveBeenCalled()
  })

  it('returns the existing authorization denial unchanged', async () => {
    mapPermissionError.mockReturnValueOnce(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
    updateCapability.mockRejectedValueOnce(new Error('forbidden'))

    const response = await POST(capabilityRequest('{"enabled":false}'))

    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('returns a closed, non-diagnostic error when Payroll Lab is unavailable', async () => {
    updateCapability.mockRejectedValueOnce(new PayrollLabUnavailableError())

    const response = await POST(capabilityRequest('{"enabled":true}'))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'PAYROLL_LAB_UNAVAILABLE' })
  })

  it('denies a missing administration mapping without disclosing scope', async () => {
    updateCapability.mockResolvedValueOnce(null)

    const response = await POST(capabilityRequest('{"enabled":true}'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'PAYROLL_LAB_NOT_AVAILABLE' })
  })
})
