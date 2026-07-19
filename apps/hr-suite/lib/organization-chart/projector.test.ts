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
      {
        id: 'placement-ada',
        employeeId: 'ada',
        employmentId: 'employment-ada',
        departmentId: 'engineering',
        directManagerId: null,
        jobTitle: 'Software engineer',
        jobId: 'job-engineer',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      },
      {
        id: 'placement-grace',
        employeeId: 'grace',
        employmentId: 'employment-grace',
        departmentId: 'engineering',
        directManagerId: null,
        jobTitle: 'Teamleider',
        jobId: 'job-lead',
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
      },
    ],
    managementAssignments: [
      { id: 'management-grace', departmentId: 'root', employeeId: 'grace', roleCode: 'DIRECT_MANAGER', roleName: 'Leidinggevende', effectiveFrom: '2026-01-01', effectiveTo: null },
    ],
    customFieldDefinitions: [],
    customFieldValues: [],
    jobs: [
      { id: 'job-engineer', code: 'SE', name: 'Software engineer', jobGroupId: 'job-group-tech' },
      { id: 'job-lead', code: 'TL', name: 'Teamleider', jobGroupId: 'job-group-tech' },
    ],
    jobGroups: [
      { id: 'job-group-tech', code: 'TECH', name: 'Techniek' },
    ],
    starPerformerAssessments: [
      { employeeId: 'ada', jobId: 'job-engineer', jobGroupId: null, criticalityLevel: 5 },
    ],
    filters: { view: 'department' },
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
    const graph = projectOrganizationChart(fixture({ filters: { view: 'department', query: 'Ada' } }))

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

  it('bouwt in managerweergave een boom op medewerker-managerrelaties', () => {
    const graph = projectOrganizationChart(fixture({ filters: { view: 'manager' } }))

    expect(graph.metadata.view).toBe('manager')
    expect(graph.metadata.visiblePrimaryCount).toBe(1)
    expect(graph.nodes.every((node) => node.type === 'employee')).toBe(true)
    expect(graph.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual([
      'employee:placement-grace->employee:placement-ada',
    ])
  })

  it('bouwt in functieweergave functiegroep, functie en star performer-niveaus op', () => {
    const graph = projectOrganizationChart(fixture({ filters: { view: 'job' } }))

    expect(graph.metadata.view).toBe('job')
    expect(graph.metadata.visiblePrimaryCount).toBe(1)
    expect(graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'group:job-group:job-group-tech',
        type: 'group',
        groupKind: 'job-group',
        title: 'Techniek',
        employeeCount: 2,
      }),
      expect.objectContaining({
        id: 'group:job:job-engineer',
        type: 'group',
        groupKind: 'job',
        title: 'Software engineer',
        employeeCount: 1,
      }),
      expect.objectContaining({
        id: 'group:job:job-engineer:star:5',
        type: 'group',
        groupKind: 'star-level',
        title: '5 sterren',
        employeeCount: 1,
      }),
      expect.objectContaining({
        id: 'group:job:job-lead:star:0',
        type: 'group',
        groupKind: 'star-level',
        title: 'Niet beoordeeld',
        employeeCount: 1,
      }),
    ]))
  })
})
