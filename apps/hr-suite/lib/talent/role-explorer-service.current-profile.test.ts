import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClient, requireAuthContext, requirePermission, requireTenantModule } = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAuthContext: vi.fn(),
  requirePermission: vi.fn(),
  requireTenantModule: vi.fn(),
}))

vi.mock('@/lib/auth/permissions', () => ({ requireAuthContext, requirePermission }))
vi.mock('@/lib/modules/module-service', () => ({ requireTenantModule }))
vi.mock('@/lib/supabase/server', () => ({ createClient }))

import { listTalentCurrentRoleProfileWorkspace } from './role-explorer-service'

type MockQueryResult = { data: unknown[]; error: null }

class MockQueryBuilder implements PromiseLike<MockQueryResult> {
  constructor(
    private readonly result: MockQueryResult,
    private readonly onEq?: (column: string, value: unknown) => void,
  ) {}

  select(columns: string): this { void columns; return this }
  eq(column: string, value: unknown): this { this.onEq?.(column, value); return this }
  not(column: string, operator: string, value: unknown): this { void column; void operator; void value; return this }
  lte(column: string, value: unknown): this { void column; void value; return this }
  or(expression: string): this { void expression; return this }
  order(column: string, options?: { ascending?: boolean }): this { void column; void options; return this }
  limit(count: number): this { void count; return this }
  in(column: string, values: readonly unknown[]): this { void column; void values; return this }
  is(column: string, value: unknown): this { void column; void value; return this }

  then<TResult1 = MockQueryResult, TResult2 = never>(
    onfulfilled?: ((value: MockQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

describe('listTalentCurrentRoleProfileWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthContext.mockResolvedValue({
      tenantId: 'tenant-1',
      administrationId: null,
      userId: 'user-1',
      employeeId: 'employee-1',
      activeRoles: ['EMPLOYEE'],
      permissions: [],
    })
    requirePermission.mockResolvedValue(undefined)
    requireTenantModule.mockResolvedValue(undefined)

    const rowsByTable: Record<string, unknown[]> = {
      talent_job_profile_readmodel: [
        { tenant_id: 'tenant-1', job_profile_id: 'job-profile-current', job_id: 'job-current', job_code: 'JOB-CURRENT', job_group_name: null, profile_version_id: 'profile-current', version_number: 2, status: 'ACTIVE', valid_from: '2026-01-01', valid_until: null },
        { tenant_id: 'tenant-1', job_profile_id: 'job-profile-other', job_id: 'job-other', job_code: 'JOB-OTHER', job_group_name: null, profile_version_id: 'profile-other', version_number: 1, status: 'ACTIVE', valid_from: '2026-01-01', valid_until: null },
      ],
      employee_organizations: [{ employee_id: 'employee-1', job_id: 'job-current', job_title: 'Huidige functie', effective_from: '2026-01-01' }],
      employees: [{ id: 'employee-1', employee_number: 'E-1', first_name: 'Ada', birth_name: 'Voorbeeld' }],
      job_profile_capability_requirements: [{ id: 'requirement-1', capability_id: 'capability-1', target_level_id: null, requirement_type: 'REQUIRED', language_level: null, rationale: null, sort_order: 1 }],
      talent_capabilities: [{ id: 'capability-1', code: 'COMP-1', name: 'Samenwerken', capability_type: 'COMPETENCY' }],
      talent_levels: [],
      talent_employee_capability_records: [],
    }
    createClient.mockResolvedValue({
      from: (table: string) => new MockQueryBuilder({ data: rowsByTable[table] ?? [], error: null }),
    })
  })

  it('loads the current profile by job id when it falls outside the bounded alternatives list', async () => {
    const alternatives = Array.from({ length: 500 }, (_, index) => ({
      tenant_id: 'tenant-1',
      job_profile_id: `job-profile-${index}`,
      job_id: `job-${index}`,
      job_code: `JOB-${String(index).padStart(3, '0')}`,
      job_group_name: null,
      profile_version_id: `profile-${index}`,
      version_number: 1,
      status: 'ACTIVE',
      valid_from: '2026-01-01',
      valid_until: null,
    }))
    const currentProfile = {
      tenant_id: 'tenant-1', job_profile_id: 'job-profile-current', job_id: 'job-current', job_code: 'JOB-ZZZ',
      job_group_name: null, profile_version_id: 'profile-current', version_number: 2, status: 'ACTIVE',
      valid_from: '2026-01-01', valid_until: null,
    }
    let profileReadCount = 0
    let targetedJobId: unknown = null
    createClient.mockResolvedValue({
      from: (table: string) => {
        if (table === 'talent_job_profile_readmodel') {
          profileReadCount += 1
          const isTargetedRead = profileReadCount === 2
          return new MockQueryBuilder(
            { data: isTargetedRead ? [currentProfile] : alternatives, error: null },
            (column, value) => {
              if (isTargetedRead && column === 'job_id') targetedJobId = value
            },
          )
        }
        const rowsByTable: Record<string, unknown[]> = {
          employee_organizations: [{ employee_id: 'employee-1', job_id: 'job-current', job_title: 'Huidige functie', effective_from: '2026-01-01' }],
          employees: [{ id: 'employee-1', employee_number: 'E-1', first_name: 'Ada', birth_name: 'Voorbeeld' }],
          job_profile_capability_requirements: [{ id: 'requirement-1', capability_id: 'capability-1', target_level_id: null, requirement_type: 'REQUIRED', language_level: null, rationale: null, sort_order: 1 }],
          talent_capabilities: [{ id: 'capability-1', code: 'COMP-1', name: 'Samenwerken', capability_type: 'COMPETENCY' }],
          talent_levels: [],
          talent_employee_capability_records: [],
        }
        return new MockQueryBuilder({ data: rowsByTable[table] ?? [], error: null })
      },
    })

    const workspace = await listTalentCurrentRoleProfileWorkspace()

    expect(requirePermission).toHaveBeenCalledWith('talent-comparison:read', 'employee-1')
    expect(targetedJobId).toBe('job-current')
    expect(workspace.selectedEmployeeId).toBe('employee-1')
    expect(workspace.selectedProfileVersionId).toBe('profile-current')
    expect(workspace.comparison?.profile.jobId).toBe('job-current')
    expect(workspace.comparison?.axes.map((axis) => axis.capabilityCode)).toEqual(['COMP-1'])
    expect(workspace.profiles).toHaveLength(500)
    expect(workspace.profiles.some((profile) => profile.profileVersionId === 'profile-current')).toBe(false)
  })
})
