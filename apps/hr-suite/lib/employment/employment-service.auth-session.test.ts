import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => {
  class MockAuthenticationError extends Error {
    readonly status = 401
  }

  return {
    MockAuthenticationError,
    getRequestAuthorizationContext: vi.fn(),
    requireAnyPermission: vi.fn(),
    requireHrGroupId: vi.fn((context: { hrGroupId?: string }) => context.hrGroupId ?? 'group-1'),
    requirePermission: vi.fn(),
  }
})

vi.mock('@/lib/auth/permissions', () => ({
  AuthenticationError: mocks.MockAuthenticationError,
  AuthorizationError: class MockAuthorizationError extends Error {},
  getRequestAuthorizationContext: mocks.getRequestAuthorizationContext,
  requireAnyPermission: mocks.requireAnyPermission,
  requireHrGroupId: mocks.requireHrGroupId,
  requirePermission: mocks.requirePermission,
}))

import { publishCompleteEmployment } from './employment-service'
import type { CompleteEmploymentCreateInput } from './schemas'

const context = {
  tenantId: 'tenant-1',
  hrGroupId: 'group-1',
  administrationId: 'admin-1',
  userId: 'user-1',
  employeeId: null,
  activeRoles: ['HR_ADMIN'],
  permissions: ['contract:write', 'organization-placement:write', 'salary:write'],
}

function query(result: { data: unknown; error: null | Error }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    lte: vi.fn(),
    or: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  }
  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.is.mockReturnValue(builder)
  builder.lte.mockReturnValue(builder)
  builder.or.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  return builder
}

function createClient(userResult: { data: { user: { id: string } | null }; error: null | Error }) {
  const rpc = vi.fn().mockResolvedValue({ data: 'employment-1', error: null })
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue(userResult) },
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'labor_condition_sets') {
        return query({ data: { probation_maximum_months: 1 }, error: null })
      }
      if (table === 'employee_administration_assignments') {
        return query({ data: { id: 'assignment-1' }, error: null })
      }
      throw new Error(`Onverwachte tabel in test: ${table}`)
    }),
  }
  return client
}

function completeInput(salary = false): CompleteEmploymentCreateInput {
  return {
    employment: {
      employmentNumber: '100015',
      employmentType: 'EMPLOYEE',
      startsOn: '2026-08-01',
      seniorityDate: '2026-08-01',
      countryCode: 'NL',
      isPrimary: true,
    },
    contract: {
      workerType: 'EMPLOYEE',
      laborConditionSetId: '00000000-0000-0000-0000-000000000001',
      durationType: 'DEFINITE',
      startsOn: '2026-08-01',
      endsOn: '2026-10-01',
      probationApplies: true,
      probationEndsOn: '2026-09-01',
    },
    ...(salary ? {
      salary: {
        paymentType: 'PERIODIC_FIXED' as const,
        paymentFrequency: 'MONTHLY' as const,
        salaryBasis: 'MANUAL' as const,
        salaryRoute: 'MANUAL' as const,
        fulltimeAmount: 2000,
        parttimeAmount: 1600,
        currencyCode: 'EUR',
        salaryFrequencyId: '00000000-0000-0000-0000-000000000002',
        validFrom: '2026-08-01',
      },
    } : {}),
  }
}

describe('complete employment request session verification', () => {
  beforeEach(() => {
    mocks.getRequestAuthorizationContext.mockReset()
    mocks.requirePermission.mockReset()
    mocks.requirePermission.mockResolvedValue(context)
  })

  it.each([
    ['zonder salaris', false, 'publish_complete_employment'],
    ['met handmatig salaris', true, 'publish_complete_salary_application_employment'],
  ])('verifieert de gebruiker vóór het %s RPC-pad', async (_label, withSalary, rpcName) => {
    const client = createClient({ data: { user: { id: 'user-1' } }, error: null })
    mocks.getRequestAuthorizationContext.mockResolvedValue({
      context,
      supabase: client,
      activeContext: { administrationsInActiveHrGroup: [{ id: 'admin-1' }] },
    })

    await expect(publishCompleteEmployment('employee-1', completeInput(withSalary))).resolves.toBe('employment-1')

    expect(client.rpc).toHaveBeenCalledWith(rpcName, expect.objectContaining({ requested_employee_id: 'employee-1' }))
    expect(client.auth.getUser).toHaveBeenCalledTimes(1)
    expect(client.auth.getUser.mock.invocationCallOrder[0]).toBeLessThan(client.rpc.mock.invocationCallOrder[0])
  })

  it.each([
    ['getUser-fout', { data: { user: { id: 'user-1' } }, error: new Error('session error') }],
    ['geen gebruiker', { data: { user: null }, error: null }],
    ['identiteitsmismatch', { data: { user: { id: 'other-user' } }, error: null }],
  ])('weigert het RPC-pad bij %s', async (_label, userResult) => {
    const client = createClient(userResult)
    mocks.getRequestAuthorizationContext.mockResolvedValue({
      context,
      supabase: client,
      activeContext: { administrationsInActiveHrGroup: [{ id: 'admin-1' }] },
    })

    await expect(publishCompleteEmployment('employee-1', completeInput(true))).rejects.toBeInstanceOf(mocks.MockAuthenticationError)
    expect(client.rpc).not.toHaveBeenCalled()
  })
})
