import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  requireAuthContext: vi.fn(),
  requireHrGroupId: vi.fn((context: { hrGroupId?: string }) => context.hrGroupId ?? ''),
  requirePermission: vi.fn(),
  requirePermissionInContext: vi.fn(),
  requireTenantModule: vi.fn(),
  createClient: vi.fn(),
  createTalentGoalNotification: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({
  requireAuthContext: authMocks.requireAuthContext,
  requireHrGroupId: authMocks.requireHrGroupId,
  requirePermission: authMocks.requirePermission,
  requirePermissionInContext: authMocks.requirePermissionInContext,
}))
vi.mock('@/lib/modules/module-service', () => ({ requireTenantModule: authMocks.requireTenantModule }))
vi.mock('@/lib/supabase/server', () => ({ createClient: authMocks.createClient }))
vi.mock('./notification-service', () => ({ createTalentGoalNotification: authMocks.createTalentGoalNotification }))

import { createTalentGoal, listTalentGoals, updateTalentGoal } from './goal-service'

const selfContext = {
  tenantId: 'tenant-1',
  hrGroupId: 'group-1',
  administrationId: null,
  userId: 'user-1',
  employeeId: 'employee-1',
  activeRoles: ['EMPLOYEE'],
  permissions: ['self:talent-goal:write'],
}

function createClientStub() {
  const inserts: Array<Record<string, unknown>> = []
  const from = vi.fn((table: string) => {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      order: vi.fn(() => builder),
      range: vi.fn(() => Promise.resolve({ data: [], error: null })),
      maybeSingle: vi.fn(() => Promise.resolve({
        data: table === 'employees'
          ? { id: 'employee-1' }
          : table === 'talent_development_goals'
            ? { id: 'goal-1', tenant_id: 'tenant-1', employee_id: 'employee-1', capability_id: 'capability-allowed', title: 'Plan', description: null, period_start: '2026-01-01', period_end: null, progress_percent: 0, status: 'DRAFT', source_type: 'SELF_ENTERED', version: 1 }
            : null,
        error: null,
      })),
      insert: vi.fn((row: Record<string, unknown>) => { inserts.push(row); return builder }),
      update: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: { id: 'goal-1' }, error: null })),
    }
    return builder
  })
  const rpc = vi.fn((name: string) => {
    if (name === 'get_my_talent_profile') {
      return { maybeSingle: () => Promise.resolve({ data: { profile_version_id: 'profile-version-1' }, error: null }) }
    }
    return Promise.resolve({
      data: [{ capability_id: 'capability-allowed', capability_code: 'COMM', capability_name: 'Communicatie' }],
      error: null,
    })
  })
  return { client: { from, rpc }, from, rpc, inserts }
}

describe('employee competency-linked development plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.requireAuthContext.mockResolvedValue(selfContext)
    authMocks.requirePermission.mockResolvedValue(selfContext)
    authMocks.requireTenantModule.mockResolvedValue(undefined)
    authMocks.createTalentGoalNotification.mockResolvedValue(undefined)
  })

  it('offers only capabilities from the employee current profile requirements', async () => {
    const stub = createClientStub()
    authMocks.createClient.mockResolvedValue(stub.client)

    await expect(listTalentGoals('self', {}, { includeOptions: false, includeCapabilityOptions: true }))
      .resolves.toMatchObject({
        goals: [],
        capabilities: [{ id: 'capability-allowed', label: 'Communicatie (COMM)' }],
      })
    expect(stub.from).toHaveBeenCalledTimes(1)
    expect(stub.from).toHaveBeenCalledWith('talent_development_goals')
    expect(stub.rpc).toHaveBeenCalledWith('get_my_talent_profile', { requested_tenant_id: 'tenant-1' })
    expect(stub.rpc).toHaveBeenCalledWith('get_my_talent_profile_requirements', {
      requested_tenant_id: 'tenant-1',
      requested_profile_version_id: 'profile-version-1',
    })
  })

  it('creates an explicitly linked self plan when the capability belongs to the current profile', async () => {
    const stub = createClientStub()
    authMocks.createClient.mockResolvedValue(stub.client)

    await expect(createTalentGoal({
      capabilityId: 'capability-allowed',
      title: 'Communicatie oefenen',
      periodStart: '2026-11-01',
      progressPercent: 0,
      status: 'DRAFT',
    })).resolves.toBe('goal-1')
    expect(stub.inserts[0]).toMatchObject({
      employee_id: 'employee-1',
      capability_id: 'capability-allowed',
      source_type: 'SELF_ENTERED',
    })
  })

  it('rejects a forged self plan capability outside the current profile', async () => {
    const stub = createClientStub()
    authMocks.createClient.mockResolvedValue(stub.client)

    await expect(createTalentGoal({
      capabilityId: 'capability-other-employee',
      title: 'Onbevoegde koppeling',
      periodStart: '2026-11-01',
      progressPercent: 0,
      status: 'DRAFT',
    })).rejects.toMatchObject({ code: 'TALENT_GOAL_CAPABILITY_FORBIDDEN', status: 403 })
    expect(stub.inserts).toHaveLength(0)
  })

  it('rejects changing a self plan to a capability outside the current profile', async () => {
    const stub = createClientStub()
    authMocks.createClient.mockResolvedValue(stub.client)

    await expect(updateTalentGoal('goal-1', { version: 1, capabilityId: 'capability-other-employee' }))
      .rejects.toMatchObject({ code: 'TALENT_GOAL_CAPABILITY_FORBIDDEN', status: 403 })
    expect(stub.from).toHaveBeenCalledWith('talent_development_goals')
  })
})
