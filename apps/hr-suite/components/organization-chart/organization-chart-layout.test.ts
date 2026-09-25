import { describe, expect, it } from 'vitest'
import type { OrganizationChartGraph, OrganizationChartNode } from '@/lib/organization-chart/types'
import { buildOrganizationChartEdgePath, layoutOrganizationChart } from './organization-chart-layout'

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

    const { positions } = layoutOrganizationChart(graph(nodes, edges))
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

    const { positions } = layoutOrganizationChart(graph(nodes, edges))

    expect(positions.get(director.id)?.y).toBeLessThan(positions.get(manager.id)?.y ?? 0)
    expect(positions.get(manager.id)?.y).toBeLessThan(positions.get(colleague.id)?.y ?? 0)
    expect(positions.get(colleague.id)?.x).toBeGreaterThanOrEqual(0)
  })

  it('routeert extra kindrijen via een gedeelde zijrail buiten de onderliggende kaarten', () => {
    const manager = employee('manager')
    const reports = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'].map(employee)
    const subordinate = employee('subordinate')
    const nodes = [manager, ...reports, subordinate]
    const edges = [
      ...reports.map((report) => ({ id: `manager->${report.id}`, source: manager.id, target: report.id, matchState: 'normal' as const })),
      { id: `report->${subordinate.id}`, source: reports[0].id, target: subordinate.id, matchState: 'normal' as const },
    ]

    const layout = layoutOrganizationChart(graph(nodes, edges))
    const firstRowY = Math.min(...reports.map((report) => layout.positions.get(report.id)?.y ?? Number.MAX_SAFE_INTEGER))
    const firstRowReports = reports.filter((report) => layout.positions.get(report.id)?.y === firstRowY)
    const overflowReports = reports.filter((report) => (layout.positions.get(report.id)?.y ?? firstRowY) > firstRowY)
    const firstRowRoute = layout.edgeRoutes.get(`manager->${firstRowReports[0].id}`)
    const overflowRoutes = overflowReports.map((report) => layout.edgeRoutes.get(`manager->${report.id}`))
    const reportDescendants = [reports[0], subordinate, ...reports.slice(1)]
    const rightmostCard = Math.max(...reportDescendants.map((node) => (layout.positions.get(node.id)?.x ?? 0) + 224))
    const overflowBranchY = overflowRoutes[0]?.branchY

    expect(firstRowRoute?.kind).toBe('child-row')
    expect(overflowRoutes.every((route) => route?.kind === 'overflow-row')).toBe(true)
    expect(new Set(overflowRoutes.map((route) => route?.kind === 'overflow-row' ? route.laneX : null)).size).toBe(1)
    expect(overflowRoutes[0]?.kind === 'overflow-row' ? overflowRoutes[0].laneX : 0).toBeGreaterThan(rightmostCard)
    expect(overflowBranchY).toBeGreaterThan((layout.positions.get(subordinate.id)?.y ?? 0) + 138)
    expect(overflowBranchY).toBeLessThan(layout.positions.get(overflowReports[0].id)?.y ?? 0)
  })

  it('tekent zowel gewone kindrijen als vervolgrijen via een orthogonale vertakking', () => {
    const childRowPath = buildOrganizationChartEdgePath({ kind: 'child-row', branchY: 180 }, 100, 120, 300, 240)
    const overflowRowPath = buildOrganizationChartEdgePath({ kind: 'overflow-row', branchY: 380, laneX: 420 }, 100, 120, 300, 440)

    expect(childRowPath).toBe('M 100 120 V 180 H 300 V 240')
    expect(overflowRowPath).toBe('M 100 120 H 420 V 380 H 300 V 440')
  })
})
