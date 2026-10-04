import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listTalentTeamMatrix } = vi.hoisted(() => ({
  listTalentTeamMatrix: vi.fn(),
}))

vi.mock('@/lib/talent/team-service', () => ({ listTalentTeamMatrix }))

import {
  HR_WORKFORCE_TOOLS,
  MANAGER_WORKFORCE_TOOLS,
  hrTenantCapabilityMatrixTool,
  managerTeamCapabilityMatrixTool,
} from './manager-tools'

const capabilityId = '00000000-0000-0000-0000-000000000001'
const recordId = '00000000-0000-0000-0000-000000000002'

function matrixFixture() {
  return {
    rows: [{
      employeeId: 'employee-secret',
      employeeNumber: 'E-001',
      employeeLabel: 'Eva Jansen',
      jobTitle: 'Planner',
      departmentId: 'department-secret',
      capabilities: [{
        id: recordId,
        capability_id: capabilityId,
        status: 'RELEASED',
        source_type: 'MANAGER_ENTERED',
        valid_from: '2026-01-01',
        valid_until: null,
        certificate_status: 'VERIFIED',
        evidence_status: 'VERIFIED',
        certificate_code: 'CERTIFICATE-SECRET',
        capabilityName: 'Planning',
        capabilityCode: 'PLAN-001',
        capabilityType: 'SKILL',
      }],
    }],
    sourceTruncated: false,
    scopeCount: 1,
    scopeType: 'TEAM',
    aggregatePolicy: 'DISABLED',
    aggregateMinimumGroupSize: 5,
    aggregateDisabled: true,
  }
}

describe('manager workforce tool definitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listTalentTeamMatrix.mockResolvedValue(matrixFixture())
  })

  it('registers one read-only, direct-manager-scoped tool with strict narrowing filters', () => {
    expect(MANAGER_WORKFORCE_TOOLS.map((tool) => tool.id)).toEqual([
      'manager.talent.team-capability-matrix.read',
    ])

    expect(managerTeamCapabilityMatrixTool.scope).toBe('MANAGER_SCOPE')
    expect(managerTeamCapabilityMatrixTool.operation).toBe('READ')
    expect(managerTeamCapabilityMatrixTool.audience).toEqual(['MANAGER'])
    expect(managerTeamCapabilityMatrixTool.permission).toBe('talent-team:read')
    expect(managerTeamCapabilityMatrixTool.module).toBe('TALENT')

    expect(managerTeamCapabilityMatrixTool.inputSchema.safeParse({}).success).toBe(true)
    expect(managerTeamCapabilityMatrixTool.inputSchema.safeParse({ q: 'Eva', type: 'SKILL' }).success).toBe(true)
    for (const forgedKey of ['employeeId', 'tenantId', 'hrGroupId', 'administrationId', 'departmentId', 'teamId', 'managerEmployeeId']) {
      expect(managerTeamCapabilityMatrixTool.inputSchema.safeParse({ [forgedKey]: 'attacker-selected' }).success).toBe(false)
    }
  })

  it('passes only narrowing filters to the server-scoped matrix and strips identifiers, counts and evidence', async () => {
    const input = { q: 'Eva', type: 'SKILL' as const, status: 'RELEASED' as const, source: 'MANAGER_ENTERED' as const }

    await expect(managerTeamCapabilityMatrixTool.execute(input)).resolves.toEqual({
      rows: [{
        employeeLabel: 'Eva Jansen',
        capabilitiesTruncated: false,
        capabilities: [{
          code: 'PLAN-001',
          name: 'Planning',
          type: 'SKILL',
          status: 'RELEASED',
          sourceType: 'MANAGER_ENTERED',
          validFrom: '2026-01-01',
          validUntil: null,
        }],
      }],
      hasMore: false,
      nextOffset: null,
      sourceTruncated: false,
    })
    expect(listTalentTeamMatrix).toHaveBeenCalledWith(input)

    const serialized = JSON.stringify(await managerTeamCapabilityMatrixTool.execute(input))
    expect(serialized).not.toContain('employee-secret')
    expect(serialized).not.toContain('E-001')
    expect(serialized).not.toContain('department-secret')
    expect(serialized).not.toContain('CERTIFICATE-SECRET')
    expect(serialized).not.toContain(recordId)
    expect(serialized).not.toContain(capabilityId)
    expect(serialized).not.toContain('scopeCount')
    expect(serialized).not.toContain('aggregate')
  })

  it('rejects forged scope selectors before the existing service is called', async () => {
    await expect(managerTeamCapabilityMatrixTool.execute({
      employeeId: 'attacker-selected',
      departmentId: 'attacker-selected',
    })).rejects.toThrow()
    expect(listTalentTeamMatrix).not.toHaveBeenCalled()
  })

  it('registers the HR tenant tool with both existing permissions and reuses the same server-scoped projection', async () => {
    expect(HR_WORKFORCE_TOOLS.map((tool) => tool.id)).toEqual([
      'hr.talent.tenant-capability-matrix.read',
    ])
    expect(hrTenantCapabilityMatrixTool.scope).toBe('TENANT')
    expect(hrTenantCapabilityMatrixTool.operation).toBe('READ')
    expect(hrTenantCapabilityMatrixTool.audience).toEqual(['HR'])
    expect(hrTenantCapabilityMatrixTool.permission).toBe('talent-team:read')
    expect(hrTenantCapabilityMatrixTool.additionalPermissions).toEqual(['talent:manage'])
    expect(hrTenantCapabilityMatrixTool.module).toBe('TALENT')
    expect(hrTenantCapabilityMatrixTool.inputSchema.safeParse({ tenantId: 'attacker-selected' }).success).toBe(false)

    const input = { q: 'Planning', type: 'SKILL' as const }
    await expect(hrTenantCapabilityMatrixTool.execute(input)).resolves.toEqual({
      rows: [{
        employeeLabel: 'Eva Jansen',
        capabilitiesTruncated: false,
        capabilities: [{
          code: 'PLAN-001',
          name: 'Planning',
          type: 'SKILL',
          status: 'RELEASED',
          sourceType: 'MANAGER_ENTERED',
          validFrom: '2026-01-01',
          validUntil: null,
        }],
      }],
      hasMore: false,
      nextOffset: null,
      sourceTruncated: false,
    })
    expect(listTalentTeamMatrix).toHaveBeenCalledWith(input)
  })

  it('rejects unpublished capability status instead of silently returning an empty page', async () => {
    expect(managerTeamCapabilityMatrixTool.inputSchema.safeParse({ status: 'DRAFT' }).success).toBe(false)
    expect(hrTenantCapabilityMatrixTool.inputSchema.safeParse({ status: 'DRAFT' }).success).toBe(false)
    await expect(hrTenantCapabilityMatrixTool.execute({ status: 'DRAFT' })).rejects.toThrow()
    expect(listTalentTeamMatrix).not.toHaveBeenCalled()
  })

  it('bounds each model-facing page and capability list and exposes continuation metadata', async () => {
    const rows = Array.from({ length: 30 }, (_, rowIndex) => ({
      employeeId: `employee-${rowIndex}`,
      employeeNumber: `E-${String(rowIndex).padStart(3, '0')}`,
      employeeLabel: `Employee ${rowIndex}`,
      jobTitle: 'Planner',
      departmentId: `department-${rowIndex}`,
      capabilities: Array.from({ length: 25 }, (_, capabilityIndex) => ({
        id: `record-${rowIndex}-${capabilityIndex}`,
        capability_id: capabilityId,
        status: 'RELEASED',
        source_type: 'MANAGER_ENTERED',
        valid_from: '2026-01-01',
        valid_until: null,
        certificate_status: 'VERIFIED',
        evidence_status: 'VERIFIED',
        certificate_code: `CERTIFICATE-${rowIndex}-${capabilityIndex}`,
        capabilityName: `Capability ${capabilityIndex}`,
        capabilityCode: `CAP-${capabilityIndex}`,
        capabilityType: 'SKILL',
      })),
    }))
    listTalentTeamMatrix.mockResolvedValue({ ...matrixFixture(), rows })

    const firstPage = await hrTenantCapabilityMatrixTool.execute({ limit: 12 })
    expect(firstPage.rows).toHaveLength(12)
    expect(firstPage.rows[0].capabilities).toHaveLength(20)
    expect(firstPage.rows[0].capabilitiesTruncated).toBe(true)
    expect(firstPage.hasMore).toBe(true)
    expect(firstPage.nextOffset).toBe(12)

    const lastPage = await hrTenantCapabilityMatrixTool.execute({ limit: 25, offset: 25 })
    expect(lastPage.rows).toHaveLength(5)
    expect(lastPage.hasMore).toBe(false)
    expect(lastPage.nextOffset).toBeNull()
    expect(listTalentTeamMatrix).toHaveBeenLastCalledWith({})
  })

  it('preserves source truncation when the returned page has no continuation', async () => {
    listTalentTeamMatrix.mockResolvedValue({ ...matrixFixture(), sourceTruncated: true })

    await expect(hrTenantCapabilityMatrixTool.execute({})).resolves.toMatchObject({
      hasMore: false,
      nextOffset: null,
      sourceTruncated: true,
    })
  })
})
