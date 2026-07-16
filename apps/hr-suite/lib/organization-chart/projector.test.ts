import { describe, expect, it } from 'vitest'
import { projectOrganizationChart } from './projector'
import type { OrganizationChartProjectionInput } from './types'

function fixture(overrides: Partial<OrganizationChartProjectionInput> = {}): OrganizationChartProjectionInput {
  return {
    asOfDate: '2026-07-16',
    administration: { id: 'admin', code: 'LH', name: 'Liquid HR' },
    departments: [
      { id: 'root', parentId: null, code: 'HQ', name: 'Hoofdkantoor' },
      { id: 'engineering', parentId: 'root', code: 'ENG', name: 'Engineering' },
    ],
    employees: [
      { id: 'ada', firstName: 'Ada', birthName: 'Lovelace', avatarUrl: null },
      { id: 'grace', firstName: 'Grace', birthName: 'Hopper', avatarUrl: null },
    ],
    placements: [
      { id: 'placement-ada', employeeId: 'ada', employmentId: 'employment-ada', departmentId: 'engineering', jobTitle: 'Software engineer', effectiveFrom: '2026-01-01', effectiveTo: null },
      { id: 'placement-grace', employeeId: 'grace', employmentId: 'employment-grace', departmentId: 'engineering', jobTitle: 'Teamleider', effectiveFrom: '2026-01-01', effectiveTo: null },
    ],
    managementAssignments: [
      { id: 'management-grace', departmentId: 'root', employeeId: 'grace', roleCode: 'DIRECT_MANAGER', roleName: 'Leidinggevende', effectiveFrom: '2026-01-01', effectiveTo: null },
    ],
    customFieldDefinitions: [], customFieldValues: [],
    filters: {},
    ...overrides,
  }
}

describe('projectOrganizationChart', () => {
  it('bouwt administratie-, afdelings- en medewerkerverbindingen', () => {
    const graph = projectOrganizationChart(fixture())

    expect(graph.nodes.map((node) => node.id)).toEqual([
      'administration:admin', 'department:root', 'department:engineering',
      'employee:placement-ada', 'employee:placement-grace',
    ])
    expect(graph.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual([
      'administration:admin->department:root',
      'department:root->department:engineering',
      'department:engineering->employee:placement-ada',
      'department:engineering->employee:placement-grace',
    ])
  })

  it('behoudt ancestors van een gevonden medewerker als zichtbaar contextpad', () => {
    const graph = projectOrganizationChart(fixture({ filters: { query: 'Ada' } }))

    expect(graph.nodes.find((node) => node.id === 'employee:placement-ada')?.matchState).toBe('match')
    expect(graph.nodes.find((node) => node.id === 'department:engineering')?.matchState).toBe('context')
    expect(graph.nodes.find((node) => node.id === 'department:root')?.matchState).toBe('context')
    expect(graph.nodes.find((node) => node.id === 'administration:admin')?.matchState).toBe('context')
    expect(graph.nodes.find((node) => node.id === 'employee:placement-grace')?.matchState).toBe('dimmed')
  })

  it('toont inherited management en markeert meerdere lokale houders als ambigu', () => {
    const inherited = projectOrganizationChart(fixture())
    expect(inherited.nodes.find((node) => node.id === 'department:engineering')).toMatchObject({
      type: 'department', manager: { status: 'inherited', employeeName: 'Grace Hopper' },
    })

    const ambiguous = projectOrganizationChart(fixture({
      managementAssignments: [
        ...fixture().managementAssignments,
        { id: 'management-ada', departmentId: 'engineering', employeeId: 'ada', roleCode: 'DIRECT_MANAGER', roleName: 'Leidinggevende', effectiveFrom: '2026-01-01', effectiveTo: null },
        { id: 'management-grace-local', departmentId: 'engineering', employeeId: 'grace', roleCode: 'DIRECT_MANAGER', roleName: 'Leidinggevende', effectiveFrom: '2026-01-01', effectiveTo: null },
      ],
    }))
    expect(ambiguous.nodes.find((node) => node.id === 'department:engineering')).toMatchObject({
      type: 'department', manager: { status: 'ambiguous', count: 2 },
    })
  })

  it('sluit plaatsingen buiten de peildatum uit', () => {
    const graph = projectOrganizationChart(fixture({
      placements: [{ ...fixture().placements[0], effectiveFrom: '2026-08-01' }],
    }))

    expect(graph.nodes.some((node) => node.type === 'employee')).toBe(false)
    expect(graph.metadata.visibleEmployeeCount).toBe(0)
  })
})
