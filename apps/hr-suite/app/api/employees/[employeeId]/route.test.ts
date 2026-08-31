import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getEmployeeEmploymentDetail, permissionErrorResponse } = vi.hoisted(() => ({
  getEmployeeEmploymentDetail: vi.fn(),
  permissionErrorResponse: vi.fn((): Response | null => null),
}))

vi.mock('@/lib/auth/permissions', () => ({ permissionErrorResponse }))
vi.mock('@/lib/employees/employee-service', () => ({
  archiveEmployee: vi.fn(),
  updateEmployee: vi.fn(),
}))
vi.mock('@/lib/employment/employment-service', () => {
  class EmploymentServiceError extends Error {
    constructor(
      readonly code: string,
      readonly status: 400 | 403 | 404 | 409 | 500,
    ) {
      super(code)
    }
  }

  return { EmploymentServiceError, getEmployeeEmploymentDetail }
})

import { EmploymentServiceError } from '@/lib/employment/employment-service'
import { GET } from './route'

const context = { params: Promise.resolve({ employeeId: 'employee-outside-scope' }) }

describe('GET /api/employees/[employeeId]', () => {
  beforeEach(() => {
    getEmployeeEmploymentDetail.mockReset()
    permissionErrorResponse.mockReset()
    permissionErrorResponse.mockReturnValue(null)
  })

  it('maps a scoped employee miss to not found instead of an internal error', async () => {
    getEmployeeEmploymentDetail.mockRejectedValue(new EmploymentServiceError('EMPLOYEE_NOT_FOUND', 404))

    const response = await GET(new Request('http://localhost/api/employees/employee-outside-scope'), context)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'EMPLOYEE_NOT_FOUND' })
  })
})
