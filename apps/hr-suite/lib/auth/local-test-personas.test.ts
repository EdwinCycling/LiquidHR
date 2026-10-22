import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verified: vi.fn(),
  loadAccessible: vi.fn(),
  select: vi.fn(),
  requireContext: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/test-role-switch', () => ({
  getVerifiedLocalPersonaIdentity: mocks.verified,
  normalizedEmail: (value: string | null) => value?.trim().toLowerCase() ?? '',
}))
vi.mock('@/lib/context/server-context', () => ({ loadAccessibleContextOptions: mocks.loadAccessible }))
vi.mock('@/lib/context/administration-context', () => ({ selectActiveContext: mocks.select }))
vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext: mocks.requireContext }))

import {
  getLocalTestSignInOptions,
  isLocalTestPersonaKey,
  verifyLocalTestPersonaIdentity,
} from './local-test-personas'

const tenantId = '07249eb9-545c-883b-b26b-d52f83b4f4a1'
const hrGroupId = '6ba6f1df-e376-40f2-abff-ffdf000172e1'
const managerEmployeeId = '9048f02b-4fdc-3c4c-e1aa-fd339660029c'
const employeeId = 'c6b1c7a9-c250-3d19-b1a0-87e317e80b13'
const client = {} as never

const fixtures = {
  'hr-admin': { email: 'hradmin.fixture@liquidhr.test', role: 'TENANT_ADMIN', employeeId: null },
  manager: { email: 'manager.fixture@liquidhr.test', role: 'DIRECT_MANAGER', employeeId: managerEmployeeId },
  employee: { email: 'employee.fixture@liquidhr.test', role: 'EMPLOYEE', employeeId },
} as const

function contextFor(role: string, linkedEmployeeId: string | null) {
  return {
    userId: 'verified-user',
    tenantId,
    hrGroupId,
    employeeId: linkedEmployeeId,
    activeRoles: [role],
  }
}

describe('fixed local TEST persona authentication contract', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('TALENT_HR_ADMIN_PASSWORD', '')
    vi.stubEnv('TALENT_MANAGER_PASSWORD', '')
    vi.stubEnv('TALENT_EMPLOYEE_PASSWORD', '')
    mocks.verified.mockResolvedValue({
      userId: 'verified-user',
      identity: { email: fixtures['hr-admin'].email, emailVerified: true },
    })
    mocks.loadAccessible.mockResolvedValue({
      userId: 'verified-user',
      tenants: [{ id: tenantId, hrGroups: [{ id: hrGroupId, tenantId }] }],
    })
    mocks.select.mockImplementation(({ requestedTenantId, requestedHrGroupId }) => ({
      tenant: { id: requestedTenantId },
      activeHrGroup: { id: requestedHrGroupId },
    }))
    mocks.requireContext.mockResolvedValue(contextFor('TENANT_ADMIN', null))
  })

  it.each(Object.entries(fixtures))('verifies the existing %s identity against its server role and fixed scope', async (key, fixture) => {
    mocks.verified.mockResolvedValue({
      userId: 'verified-user',
      identity: { email: fixture.email, emailVerified: true },
    })
    mocks.requireContext.mockResolvedValue(contextFor(fixture.role, fixture.employeeId))

    const result = await verifyLocalTestPersonaIdentity(client, key as keyof typeof fixtures)

    expect(result).toEqual({
      userId: 'verified-user',
      tenantId,
      hrGroupId,
      employeeId: fixture.employeeId,
      activeRoles: [fixture.role],
    })
    expect(mocks.select).toHaveBeenCalledWith(expect.objectContaining({
      requestedTenantId: tenantId,
      requestedHrGroupId: hrGroupId,
    }))
  })

  it('rejects a valid but different account selected as another persona', async () => {
    mocks.verified.mockResolvedValue({
      userId: 'verified-user',
      identity: { email: fixtures.employee.email, emailVerified: true },
    })

    expect(await verifyLocalTestPersonaIdentity(client, 'manager')).toBeNull()
    expect(mocks.loadAccessible).not.toHaveBeenCalled()
  })

  it.each([
    ['wrong role', contextFor('TENANT_ADMIN', managerEmployeeId)],
    ['wrong tenant', { ...contextFor('DIRECT_MANAGER', managerEmployeeId), tenantId: 'other-tenant' }],
    ['wrong HR group', { ...contextFor('DIRECT_MANAGER', managerEmployeeId), hrGroupId: 'other-group' }],
    ['wrong linked employee', contextFor('DIRECT_MANAGER', employeeId)],
    ['elevated manager', { ...contextFor('DIRECT_MANAGER', managerEmployeeId), activeRoles: ['DIRECT_MANAGER', 'HR_ADMIN'] }],
  ])('rejects a Manager session with %s', async (_reason, context) => {
    mocks.verified.mockResolvedValue({
      userId: 'verified-user',
      identity: { email: fixtures.manager.email, emailVerified: true },
    })
    mocks.requireContext.mockResolvedValue(context)

    expect(await verifyLocalTestPersonaIdentity(client, 'manager')).toBeNull()
  })

  it.each([
    ['wrong role', contextFor('DIRECT_MANAGER', employeeId)],
    ['wrong linked employee', contextFor('EMPLOYEE', managerEmployeeId)],
    ['manager privilege', { ...contextFor('EMPLOYEE', employeeId), activeRoles: ['EMPLOYEE', 'DIRECT_MANAGER'] }],
    ['admin privilege', { ...contextFor('EMPLOYEE', employeeId), activeRoles: ['EMPLOYEE', 'TENANT_ADMIN'] }],
  ])('rejects an Employee session with %s', async (_reason, context) => {
    mocks.verified.mockResolvedValue({
      userId: 'verified-user',
      identity: { email: fixtures.employee.email, emailVerified: true },
    })
    mocks.requireContext.mockResolvedValue(context)

    expect(await verifyLocalTestPersonaIdentity(client, 'employee')).toBeNull()
  })

  it('rejects a tenant that does not expose the canonical Planeten group through the user session', async () => {
    mocks.verified.mockResolvedValue({
      userId: 'verified-user',
      identity: { email: fixtures.manager.email, emailVerified: true },
    })
    mocks.loadAccessible.mockResolvedValue({
      userId: 'verified-user',
      tenants: [{ id: tenantId, hrGroups: [{ id: 'other-group', tenantId }] }],
    })

    expect(await verifyLocalTestPersonaIdentity(client, 'manager')).toBeNull()
    expect(mocks.requireContext).not.toHaveBeenCalled()
  })

  it('offers exactly the three approved personas and reveals no credential values', () => {
    expect(isLocalTestPersonaKey('hr-admin')).toBe(true)
    expect(isLocalTestPersonaKey('manager')).toBe(true)
    expect(isLocalTestPersonaKey('employee')).toBe(true)
    expect(isLocalTestPersonaKey('payroll-lisa')).toBe(false)
    expect(isLocalTestPersonaKey('owner')).toBe(false)
    expect(getLocalTestSignInOptions().map(({ key, configured }) => [key, configured])).toEqual([
      ['hr-admin', false],
      ['manager', false],
      ['employee', false],
    ])
    expect(getLocalTestSignInOptions().every((option) => !Object.hasOwn(option, 'password'))).toBe(true)
  })

  it('marks only a server-configured persona as available', () => {
    vi.stubEnv('TALENT_MANAGER_PASSWORD', String.fromCharCode(120))
    const options = getLocalTestSignInOptions()

    expect(options.find((option) => option.key === 'manager')?.configured).toBe(true)
    expect(options.find((option) => option.key === 'employee')?.configured).toBe(false)
    expect(options.some((option) => JSON.stringify(option).includes(String.fromCharCode(120)))).toBe(false)
  })
})
