import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requireAuthContext } = vi.hoisted(() => ({ requireAuthContext: vi.fn() }))

vi.mock('@/lib/auth/permissions', () => ({
  AuthorizationError: class AuthorizationError extends Error { readonly status = 403 },
  requireAuthContext,
}))

import { assertCurrentPayrollSourceAuthorization } from './payroll-source-authorization'
import type { PayrollEmployeeSourceAuthorization, PayrollScope } from './scope'

const ids = {
  actorUserId: '00000000-0000-4000-8000-000000000101',
  employeeId: '00000000-0000-4000-8000-000000000202',
  tenantId: '00000000-0000-4000-8000-000000000001',
  hrGroupId: '00000000-0000-4000-8000-000000000011',
  administrationId: '00000000-0000-4000-8000-000000000021',
} as const

const scope: PayrollScope = {
  tenantId: ids.tenantId,
  hrGroupId: ids.hrGroupId,
  administrationId: ids.administrationId,
}

const authorization: PayrollEmployeeSourceAuthorization = {
  kind: 'EMPLOYEE_SELF', actorUserId: ids.actorUserId, employeeId: ids.employeeId, scope,
}

function configureSelfContext(overrides: Record<string, unknown> = {}): void {
  requireAuthContext.mockResolvedValue({
    userId: ids.actorUserId,
    employeeId: ids.employeeId,
    tenantId: ids.tenantId,
    hrGroupId: ids.hrGroupId,
    administrationId: ids.administrationId,
    activeRoles: ['EMPLOYEE'],
    permissions: ['self:salary:read'],
    ...overrides,
  })
}

describe('current Payroll employee source authorization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows the Employee to read their own source within the active scope', async () => {
    configureSelfContext()

    await expect(assertCurrentPayrollSourceAuthorization(authorization, ids.employeeId)).resolves.toEqual(scope)
  })

  it.each([
    ['another user', { userId: '00000000-0000-4000-8000-000000000199' }],
    ['another employee', { employeeId: '00000000-0000-4000-8000-000000000199' }],
    ['another tenant', { tenantId: '00000000-0000-4000-8000-000000000199' }],
    ['another HR group', { hrGroupId: '00000000-0000-4000-8000-000000000199' }],
    ['another administration', { administrationId: '00000000-0000-4000-8000-000000000199' }],
    ['missing salary permission', { permissions: [] }],
  ])('denies a source read with %s', async (_reason, contextOverride) => {
    configureSelfContext(contextOverride)

    await expect(assertCurrentPayrollSourceAuthorization(authorization, ids.employeeId))
      .rejects.toMatchObject({ status: 403 })
  })

  it('denies source access when the URL employee differs from the authorized employee', async () => {
    configureSelfContext()

    await expect(assertCurrentPayrollSourceAuthorization(authorization, '00000000-0000-4000-8000-000000000199'))
      .rejects.toMatchObject({ status: 403 })
  })
})
