import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContext } from '@/lib/auth/permissions'
import { AuthorizationError } from '@/lib/auth/permissions'

vi.mock('server-only', () => ({}))

import { EmployeeDirectoryError, getEmployeeDirectoryDetail } from './service'

const context: AuthContext = {
  tenantId: 'tenant-sterren',
  hrGroupId: 'group-planeten',
  administrationId: 'admin-jupiter',
  userId: 'employee-user',
  employeeId: 'employee-self',
  activeRoles: ['EMPLOYEE'],
  permissions: ['employee-directory:read', 'self:employee:read'],
}

const safeProjection = {
  employeeId: 'employee-colleague',
  name: 'Collega Voorbeeld',
  avatarUrl: null,
  jobTitle: 'Planner',
  departmentName: 'HR',
  workEmail: 'colleague@example.test',
  workPhone: '+31 20 000 0000',
  schedule: [],
  presence: [],
  privateEmail: 'private@example.test',
  birthDate: '1990-01-01',
  salary: 999999,
  iban: 'NL00TEST0000000000',
}

function dependencies(response: { data: unknown; error: { code?: string } | null }, overrides: Partial<AuthContext> = {}) {
  const rpc = vi.fn(async () => response)
  return {
    rpc,
    value: {
      context: { ...context, ...overrides },
      supabase: { rpc } as never,
    },
  }
}

describe('getEmployeeDirectoryDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows the existing Employee directory permission but returns only the safe configured projection', async () => {
    const { rpc, value } = dependencies({ data: safeProjection, error: null })

    const detail = await getEmployeeDirectoryDetail('employee-colleague', value)

    expect(rpc).toHaveBeenCalledWith('get_employee_directory_detail', expect.objectContaining({
      requested_tenant_id: context.tenantId,
      requested_administration_id: context.administrationId,
      requested_employee_id: 'employee-colleague',
      requested_week_start: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }))
    expect(detail).toMatchObject({ employeeId: 'employee-colleague', name: 'Collega Voorbeeld', workEmail: 'colleague@example.test' })
    expect(detail).not.toHaveProperty('privateEmail')
    expect(detail).not.toHaveProperty('birthDate')
    expect(detail).not.toHaveProperty('salary')
    expect(detail).not.toHaveProperty('iban')
  })

  it('denies a caller without an existing directory, employee, or organization-chart permission before RPC', async () => {
    const { rpc, value } = dependencies({ data: safeProjection, error: null }, { permissions: ['self:employee:read'] })

    await expect(getEmployeeDirectoryDetail('employee-colleague', value)).rejects.toBeInstanceOf(AuthorizationError)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('maps a scoped database denial to 403 and a missing scoped employee to 404', async () => {
    const denied = dependencies({ data: null, error: { code: '42501' } })
    const missing = dependencies({ data: null, error: { code: 'P0002' } })

    await expect(getEmployeeDirectoryDetail('employee-colleague', denied.value)).rejects.toMatchObject({
      code: 'DIRECTORY_NOT_AVAILABLE',
      status: 403,
    } satisfies Partial<EmployeeDirectoryError>)
    await expect(getEmployeeDirectoryDetail('employee-colleague', missing.value)).rejects.toMatchObject({
      code: 'EMPLOYEE_NOT_FOUND',
      status: 404,
    } satisfies Partial<EmployeeDirectoryError>)
  })

  it('keeps unexpected PostgreSQL failures internal instead of misclassifying them as a scope denial', async () => {
    const unassignedRecord = dependencies({ data: null, error: { code: '55000' } })

    await expect(getEmployeeDirectoryDetail('employee-colleague', unassignedRecord.value)).rejects.toMatchObject({
      code: 'DETAIL_READ_FAILED',
      status: 500,
    } satisfies Partial<EmployeeDirectoryError>)
  })
})
