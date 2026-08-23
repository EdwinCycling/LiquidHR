import { describe, expect, it } from 'vitest'
import { filterTalentTeamMatrixRows, type TalentTeamMatrixCapability, type TalentTeamMatrixRow } from './team-model'

function capability(overrides: Partial<TalentTeamMatrixCapability> = {}): TalentTeamMatrixCapability {
  return {
    id: 'record-1',
    capability_id: 'capability-1',
    status: 'RELEASED',
    source_type: 'HR_ENTERED',
    valid_from: '2026-08-01',
    valid_until: null,
    certificate_status: null,
    evidence_status: 'VERIFIED',
    certificate_code: null,
    capabilityName: 'Klantgesprekken',
    capabilityCode: 'SKILL-CUSTOMER',
    capabilityType: 'SKILL',
    ...overrides,
  }
}

const rows: TalentTeamMatrixRow[] = [
  { employeeId: 'employee-1', employeeNumber: 'EMP-001', employeeLabel: 'Mila de Vries', jobTitle: 'Teamleider', departmentId: 'department-1', capabilities: [capability()] },
  { employeeId: 'employee-2', employeeNumber: 'EMP-002', employeeLabel: 'Noah Jansen', jobTitle: 'Planner', departmentId: 'department-1', capabilities: [capability({ id: 'record-2', capabilityName: 'Excel', capabilityCode: 'SKILL-EXCEL', source_type: 'SELF_ENTERED' })] },
  { employeeId: 'employee-3', employeeNumber: 'EMP-003', employeeLabel: 'Yara Smit', jobTitle: 'HR-assistent', departmentId: 'department-2', capabilities: [] },
]

describe('Talent Team Matrix filtering', () => {
  it('keeps an employee without records visible until a capability filter is selected', () => {
    expect(filterTalentTeamMatrixRows(rows, {})).toHaveLength(3)
    expect(filterTalentTeamMatrixRows(rows, { type: 'CERTIFICATE' })).toHaveLength(0)
  })

  it('filters capability data by the combined type, status and source contract', () => {
    const result = filterTalentTeamMatrixRows(rows, { type: 'SKILL', status: 'RELEASED', source: 'SELF_ENTERED' })
    expect(result).toHaveLength(1)
    expect(result[0]?.employeeId).toBe('employee-2')
    expect(result[0]?.capabilities.map((item) => item.capabilityCode)).toEqual(['SKILL-EXCEL'])
  })

  it('searches employee, job and capability identity without changing the scope', () => {
    const result = filterTalentTeamMatrixRows(rows, { q: 'planner' })
    expect(result.map((row) => row.employeeId)).toEqual(['employee-2'])
  })
})
