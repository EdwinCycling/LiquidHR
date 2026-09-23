import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createFocusEmployeeRelation, permissionErrorResponse } = vi.hoisted(() => ({
  createFocusEmployeeRelation: vi.fn(),
  permissionErrorResponse: vi.fn((): Response | null => null),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse }))
vi.mock('@/lib/focus/profile-service', () => ({ createFocusEmployeeRelation }))

import { POST } from './route'

const context = { params: Promise.resolve({ employeeId: 'employee-1' }) }
const validInput = {
  relationType: 'PARTNER',
  isEmergencyContact: true,
  firstName: 'Sam',
  initials: null,
  prefix: null,
  lastName: 'Test',
  gender: 'OTHER',
  birthDate: null,
  phone: null,
  mobile: '+31 6 12345678',
  email: 'sam@example.invalid',
  notes: 'Beschikbaar overdag',
}

describe('POST /api/focus/profile/[employeeId]/relations', () => {
  beforeEach(() => {
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
    createFocusEmployeeRelation.mockReset()
    createFocusEmployeeRelation.mockResolvedValue('relation-1')
  })

  it('rejects an invalid relation payload before the write service', async () => {
    const response = await POST(new Request('http://localhost/api/focus/profile/employee-1/relations', { method: 'POST', body: JSON.stringify({ relationType: 'invalid' }) }), context)

    expect(response.status).toBe(400)
    expect(createFocusEmployeeRelation).not.toHaveBeenCalled()
  })

  it('passes relation data and act-as token to the scoped write service', async () => {
    const response = await POST(new Request('http://localhost/api/focus/profile/employee-1/relations', { method: 'POST', body: JSON.stringify({ ...validInput, actAs: 'signed-act-as-token' }) }), context)

    expect(response.status).toBe(201)
    expect(createFocusEmployeeRelation).toHaveBeenCalledWith('employee-1', validInput, 'signed-act-as-token')
    expect(await response.json()).toEqual({ data: { id: 'relation-1' } })
  })
})
