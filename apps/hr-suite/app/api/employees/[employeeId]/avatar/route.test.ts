import { beforeEach, describe, expect, it, vi } from 'vitest'

const { deleteEmployeeAvatar, getEmployeeAvatar, permissionErrorResponse, uploadEmployeeAvatar } = vi.hoisted(() => ({
  deleteEmployeeAvatar: vi.fn(),
  getEmployeeAvatar: vi.fn(),
  permissionErrorResponse: vi.fn((): Response | null => null),
  uploadEmployeeAvatar: vi.fn(),
}))

vi.mock('@/lib/employees/employee-service', () => ({
  deleteEmployeeAvatar,
  EmployeeServiceError: class EmployeeServiceError extends Error {
    readonly code = 'EMPLOYEE_AVATAR_FAILED'
    readonly status = 500
  },
  getEmployeeAvatar,
  uploadEmployeeAvatar,
}))
vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse }))

import { NextResponse } from 'next/server'
import { GET } from './route'

const context = { params: Promise.resolve({ employeeId: 'employee-1' }) }

describe('GET /api/employees/[employeeId]/avatar', () => {
  beforeEach(() => {
    deleteEmployeeAvatar.mockReset()
    getEmployeeAvatar.mockReset()
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
  })

  it('geeft geen objectbestaan prijs voor een private avatar die niet beschikbaar is', async () => {
    getEmployeeAvatar.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost/api/employees/employee-1/avatar'), context)

    expect(response.status).toBe(404)
    expect(response.headers.get('location')).toBeNull()
  })

  it('behoudt de server-side unauthorized-grens van de avatarproxy', async () => {
    permissionErrorResponse.mockReturnValue(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
    getEmployeeAvatar.mockRejectedValue(new Error('forbidden'))

    const response = await GET(new Request('http://localhost/api/employees/employee-1/avatar'), context)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'forbidden' })
  })

  it('serveert private avatarbytes zonder de signed URL aan de browser door te geven', async () => {
    getEmployeeAvatar.mockResolvedValue({ body: Uint8Array.from([1, 2, 3]).buffer, contentType: 'image/webp' })

    const response = await GET(new Request('http://localhost/api/employees/employee-1/avatar'), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('location')).toBeNull()
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3])
  })
})
