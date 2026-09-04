import { describe, expect, it } from 'vitest'
import type { OrganizationChartGraph, OrganizationChartNode } from '@/lib/organization-chart/types'
import { layoutOrganizationChart } from './organization-chart-layout'

function employee(id: string): Extract<OrganizationChartNode, { type: 'employee' }> {
  return {
    id: `employee:${id}`,
    type: 'employee',
    matchState: 'normal',
    employeeId: id,
    employmentId: null,
    placementId: `placement:${id}`,
    departmentId: 'department:engineering',
    departmentName: 'Engineering',
    name: id,
    jobTitle: 'Collega',
    avatarUrl: null,
    badges: [],
    customFields: {},
  }
}

function graph(nodes: OrganizationChartNode[], edges: OrganizationChartGraph['edges']): OrganizationChartGraph {
  return {
    metadata: { asOfDate: '2026-09-04', administrationId: 'admin', view: 'manager', visiblePrimaryCount: 1, visibleEmployeeCount: nodes.length, matchCount: nodes.length },
    nodes,
    edges,
    filters: { departments: [], roles: [], customFields: [] },
  }
}

describe('layoutOrganizationChart', () => {
  it('wrapt directe rapporten na vier kaarten naar een nieuwe rij', () => {
    const manager = employee('manager')
    const reports = ['one', 'two', 'three', 'four', 'zzzz'].map(employee)
    const nodes = [manager, ...reports]
    const edges = reports.map((report) => ({ id: `manager->${report.id}`, source: manager.id, target: report.id, matchState: 'normal' as const }))

    const positions = layoutOrganizationChart(graph(nodes, edges))
    const firstRow = reports.slice(0, 4).map((report) => positions.get(report.id)?.y)
    const secondRow = positions.get(reports[4].id)?.y

    expect(new Set(firstRow).size).toBe(1)
    expect(secondRow).toBeGreaterThan(firstRow[0] ?? 0)
  })

  it('plaatst een managementketen onder elkaar zonder kinderen op rootniveau te laten vallen', () => {
    const director = employee('director')
    const manager = employee('manager')
    const colleague = employee('colleague')
    const nodes = [director, manager, colleague]
    const edges = [
      { id: 'director->manager', source: director.id, target: manager.id, matchState: 'normal' as const },
      { id: 'manager->colleague', source: manager.id, target: colleague.id, matchState: 'normal' as const },
    ]

    const positions = layoutOrganizationChart(graph(nodes, edges))

    expect(positions.get(director.id)?.y).toBeLessThan(positions.get(manager.id)?.y ?? 0)
    expect(positions.get(manager.id)?.y).toBeLessThan(positions.get(colleague.id)?.y ?? 0)
    expect(positions.get(colleague.id)?.x).toBeGreaterThanOrEqual(0)
  })
})
