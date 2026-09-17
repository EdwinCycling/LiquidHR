import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, createInvitation, requireHrGroupId, requirePermission } = vi.hoisted(() => ({
  createClient: vi.fn(),
  createInvitation: vi.fn(),
  requireHrGroupId: vi.fn(),
  requirePermission: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient }))
vi.mock('@/lib/auth/invitations', () => ({ createInvitation }))
vi.mock('@/lib/auth/permissions', () => ({ requireHrGroupId, requirePermission }))

import type { createClient as createServerClient } from '@/lib/supabase/server'
import { createEmployeeInvitation } from './employee-invitations'

type SupabaseServerClient = Awaited<ReturnType<typeof createServerClient>>

const employeeId = '11111111-1111-4111-8111-111111111111'
const context = {
  tenantId: 'tenant-a',
  hrGroupId: 'group-a',
  administrationId: null,
  userId: 'manager-a',
  employeeId: null,
  activeRoles: ['TENANT_ADMIN'],
  permissions: ['user:invite'],
}

interface QueryResult<T> {
  data: T
  error: null
}

function query<T>(result: QueryResult<T>, trace: string[], table: string) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockImplementation((field: string, value: unknown) => {
    trace.push(`${table}.${field}=${String(value)}`)
    return builder
  })
  builder.is.mockImplementation((field: string, value: unknown) => {
    trace.push(`${table}.${field} is ${String(value)}`)
    return builder
  })
  builder.order.mockReturnValue(builder)
  builder.limit.mockResolvedValue(result)
  builder.maybeSingle.mockResolvedValue(result)
  return builder
}

function fakeClient(
  employee: unknown,
  employments: unknown[] = [],
  employeeRole: { id: string } | null = { id: 'canonical-employee-role' },
  trace: string[] = [],
): SupabaseServerClient {
  const employeeQuery = query({ data: employee, error: null }, trace, 'employees')
  const employmentQuery = query({ data: employments, error: null }, trace, 'employments')
  const roleQuery = query({ data: employeeRole, error: null }, trace, 'management_roles')
  return {
    from: vi.fn((table: string) => {
      if (table === 'employees') return employeeQuery
      if (table === 'employments') return employmentQuery
      if (table === 'management_roles') return roleQuery
      throw new Error(`Unexpected table: ${table}`)
    }),
  } as unknown as SupabaseServerClient
}

describe('createEmployeeInvitation', () => {
  beforeEach(() => {
    createClient.mockReset()
    createInvitation.mockReset()
    requireHrGroupId.mockReset()
    requirePermission.mockReset()
    requirePermission.mockResolvedValue(context)
    requireHrGroupId.mockImplementation((value: { hrGroupId?: string }) => value.hrGroupId ?? '')
    createInvitation.mockResolvedValue({ id: 'invitation-1', expiresAt: '2026-09-24T00:00:00.000Z' })
  })

  it('uses only canonical email, purpose, role, scope, and exact request context', async () => {
    const trace: string[] = []
    createClient.mockResolvedValue(fakeClient({
      id: employeeId,
      tenant_id: 'tenant-a',
      hr_group_id: 'group-a',
      private_email: 'canonical@example.com',
      auth_user_id: null,
    }, [{ starts_on: '2999-01-01', ends_on: null, record_status: 'CONFIRMED', deleted_at: null }], undefined, trace))

    const result = await createEmployeeInvitation(employeeId, 'https://liquidhr.test')

    expect(result).toMatchObject({ email: 'canonical@example.com', purpose: 'PREBOARDING_EMPLOYEE' })
    expect(createInvitation).toHaveBeenCalledWith({
      email: 'canonical@example.com',
      emailKind: 'PRIVATE',
      purpose: 'PREBOARDING_EMPLOYEE',
      employeeId,
      administrationId: null,
      managementRoleId: 'canonical-employee-role',
      scopeType: 'TENANT',
      origin: 'https://liquidhr.test',
    })
    expect(trace).toContain('employees.tenant_id=tenant-a')
    expect(trace).toContain('employees.hr_group_id=group-a')
    expect(trace).toContain('employments.tenant_id=tenant-a')
    expect(trace).toContain('employments.hr_group_id=group-a')
  })

  it('rejects a target outside the exact tenant and HR-group scope', async () => {
    const trace: string[] = []
    createClient.mockResolvedValue(fakeClient(null, [], undefined, trace))

    await expect(createEmployeeInvitation(employeeId, 'https://liquidhr.test')).rejects.toMatchObject({ code: 'EMPLOYEE_NOT_FOUND' })
    expect(createInvitation).not.toHaveBeenCalled()
    expect(trace).toContain('employees.tenant_id=tenant-a')
    expect(trace).toContain('employees.hr_group_id=group-a')
  })

  it('rejects an already activated employee and cannot create a duplicate identity', async () => {
    createClient.mockResolvedValue(fakeClient({
      id: employeeId,
      tenant_id: 'tenant-a',
      hr_group_id: 'group-a',
      private_email: 'canonical@example.com',
      auth_user_id: 'existing-user',
    }))

    await expect(createEmployeeInvitation(employeeId, 'https://liquidhr.test')).rejects.toMatchObject({ code: 'EMPLOYEE_ALREADY_ACTIVATED' })
    expect(createInvitation).not.toHaveBeenCalled()
  })
})
