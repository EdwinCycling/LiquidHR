import { beforeEach, describe, expect, it, vi } from 'vitest'

const { permissionErrorResponse, updateFocusEmployeeProfile } = vi.hoisted(() => ({
  permissionErrorResponse: vi.fn((): Response | null => null),
  updateFocusEmployeeProfile: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse }))
vi.mock('@/lib/focus/profile-service', () => ({ updateFocusEmployeeProfile }))

import { PATCH } from './route'

const context = { params: Promise.resolve({ employeeId: 'employee-1' }) }
const validInput = {
  title: null,
  initials: 'LT',
  firstName: 'Lisa',
  birthNamePrefix: null,
  birthName: 'Test',
  partnerNamePrefix: null,
  partnerName: null,
  nameUsage: 'BIRTH_NAME',
  privateEmail: 'lisa@example.invalid',
  privatePhone: null,
  privateMobile: null,
  updatedAt: '2026-09-22T10:00:00.000Z',
}

describe('PATCH /api/focus/profile/[employeeId]', () => {
  beforeEach(() => {
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
    updateFocusEmployeeProfile.mockReset()
    updateFocusEmployeeProfile.mockResolvedValue({ updatedAt: '2026-09-22T10:01:00.000Z' })
  })

  it('rejects incomplete profile payloads before the write service', async () => {
    const response = await PATCH(new Request('http://localhost/api/focus/profile/employee-1', { method: 'PATCH', body: JSON.stringify({ updatedAt: validInput.updatedAt }) }), context)

    expect(response.status).toBe(400)
    expect(updateFocusEmployeeProfile).not.toHaveBeenCalled()
  })

  it('passes the complete profile and act-as token to the scoped write service', async () => {
    const response = await PATCH(new Request('http://localhost/api/focus/profile/employee-1', { method: 'PATCH', body: JSON.stringify({ ...validInput, actAs: 'signed-act-as-token' }) }), context)

    expect(response.status).toBe(200)
    expect(updateFocusEmployeeProfile).toHaveBeenCalledWith('employee-1', validInput, 'signed-act-as-token')
    expect(await response.json()).toEqual({ data: { updatedAt: '2026-09-22T10:01:00.000Z' } })
  })
})
