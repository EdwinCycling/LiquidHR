import type {
  ChartDepartmentSource, ChartManagementSource, DepartmentManager, EmployeeChartNode,
  MatchState, OrganizationChartEdge, OrganizationChartGraph, OrganizationChartNode,
  OrganizationChartProjectionInput,
} from './types'

function activeOn(from: string, to: string | null, date: string): boolean {
  return from <= date && (to === null || to >= date)
}

function fullName(employee: { firstName: string; birthName: string }): string {
  return `${employee.firstName} ${employee.birthName}`.trim()
}

function resolveDepartmentManager(
  department: ChartDepartmentSource,
  departments: ReadonlyMap<string, ChartDepartmentSource>,
  assignments: readonly ChartManagementSource[],
  employeeNames: ReadonlyMap<string, string>,
): DepartmentManager {
  const visited = new Set<string>()
  let current: ChartDepartmentSource | undefined = department
  let inherited = false
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    const candidates = assignments.filter((assignment) => assignment.departmentId === current?.id && assignment.roleCode === 'DIRECT_MANAGER')
    if (candidates.length > 1) return { status: 'ambiguous', count: candidates.length }
    const candidate = candidates[0]
    if (candidate) return {
      status: inherited ? 'inherited' : 'resolved',
      employeeId: candidate.employeeId,
      employeeName: employeeNames.get(candidate.employeeId) ?? candidate.employeeId,
    }
    current = current.parentId ? departments.get(current.parentId) : undefined
    inherited = true
  }
  return { status: 'none' }
}

function directMatch(node: OrganizationChartNode, input: OrganizationChartProjectionInput, descendants: ReadonlySet<string>): boolean {
  const query = input.filters.query?.toLocaleLowerCase('nl')
  if (query) {
    const searchable = node.type === 'administration' ? `${node.name} ${node.code}`
      : node.type === 'department' ? `${node.name} ${node.code}`
        : `${node.name} ${node.jobTitle ?? ''}`
    if (!searchable.toLocaleLowerCase('nl').includes(query)) return false
  }
  if (input.filters.departmentId) {
    if (node.type === 'administration') return false
    const departmentId = node.type === 'department' ? node.departmentId : node.departmentId
    if (!descendants.has(departmentId)) return false
  }
  if (input.filters.roleCode && (node.type !== 'employee' || !node.badges.some((badge) => badge.code === input.filters.roleCode))) return false
  if (input.filters.fieldDefinitionId && input.filters.fieldValue) {
    if (node.type !== 'employee') return false
    const value = node.customFields[input.filters.fieldDefinitionId]
    if (!value?.toLocaleLowerCase('nl').includes(input.filters.fieldValue.toLocaleLowerCase('nl'))) return false
  }
  return true
}

function withFilters(
  nodes: OrganizationChartNode[],
  edges: OrganizationChartEdge[],
  input: OrganizationChartProjectionInput,
): { nodes: OrganizationChartNode[]; edges: OrganizationChartEdge[]; matchCount: number } {
  const filtersActive = Boolean(input.filters.query || input.filters.departmentId || input.filters.roleCode || input.filters.fieldDefinitionId)
  if (!filtersActive) return { nodes, edges, matchCount: nodes.length }
  const departmentById = new Map(input.departments.map((department) => [department.id, department]))
  const descendants = new Set<string>()
  if (input.filters.departmentId) {
    const queue = [input.filters.departmentId]
    while (queue.length > 0) {
      const id = queue.shift()
      if (!id || descendants.has(id)) continue
      descendants.add(id)
      input.departments.filter((department) => department.parentId === id).forEach((department) => queue.push(department.id))
    }
  } else departmentById.forEach((_, id) => descendants.add(id))

  const matches = new Set(nodes.filter((node) => directMatch(node, input, descendants)).map((node) => node.id))
  const parentByTarget = new Map(edges.map((edge) => [edge.target, edge.source]))
  const context = new Set<string>()
  matches.forEach((match) => {
    let parent = parentByTarget.get(match)
    while (parent && !context.has(parent)) {
      context.add(parent)
      parent = parentByTarget.get(parent)
    }
  })
  const stateFor = (id: string): MatchState => matches.has(id) ? 'match' : context.has(id) ? 'context' : 'dimmed'
  return {
    nodes: nodes.map((node) => ({ ...node, matchState: stateFor(node.id) })),
    edges: edges.map((edge) => ({ ...edge, matchState: context.has(edge.source) && (context.has(edge.target) || matches.has(edge.target)) ? 'context' : 'dimmed' })),
    matchCount: matches.size,
  }
}

export function projectOrganizationChart(input: OrganizationChartProjectionInput): OrganizationChartGraph {
  const departmentsById = new Map(input.departments.map((department) => [department.id, department]))
  const employeeById = new Map(input.employees.map((employee) => [employee.id, employee]))
  const employeeNames = new Map(input.employees.map((employee) => [employee.id, fullName(employee)]))
  const activePlacements = input.placements.filter((placement) => activeOn(placement.effectiveFrom, placement.effectiveTo, input.asOfDate) && departmentsById.has(placement.departmentId) && employeeById.has(placement.employeeId))
  const activeManagement = input.managementAssignments.filter((assignment) => activeOn(assignment.effectiveFrom, assignment.effectiveTo, input.asOfDate))
  const customFieldsByEmployee = new Map<string, Record<string, string>>()
  input.customFieldValues.forEach((value) => customFieldsByEmployee.set(value.employeeId, {
    ...(customFieldsByEmployee.get(value.employeeId) ?? {}), [value.definitionId]: value.displayValue,
  }))

  const nodes: OrganizationChartNode[] = [{
    id: `administration:${input.administration.id}`, type: 'administration', matchState: 'normal',
    administrationId: input.administration.id, code: input.administration.code,
    name: input.administration.name, employeeCount: activePlacements.length,
  }]
  const edges: OrganizationChartEdge[] = []
  const children = new Map<string | null, ChartDepartmentSource[]>()
  input.departments.forEach((department) => children.set(department.parentId, [...(children.get(department.parentId) ?? []), department]))
  children.forEach((items) => items.sort((left, right) => left.code.localeCompare(right.code) || left.name.localeCompare(right.name) || left.id.localeCompare(right.id)))
  const visited = new Set<string>()
  const visit = (department: ChartDepartmentSource) => {
    if (visited.has(department.id)) return
    visited.add(department.id)
    const departmentNodeId = `department:${department.id}`
    nodes.push({
      id: departmentNodeId, type: 'department', matchState: 'normal', departmentId: department.id,
      parentDepartmentId: department.parentId, code: department.code, name: department.name,
      employeeCount: activePlacements.filter((placement) => placement.departmentId === department.id).length,
      manager: resolveDepartmentManager(department, departmentsById, activeManagement, employeeNames),
    })
    const source = department.parentId && visited.has(department.parentId)
      ? `department:${department.parentId}` : `administration:${input.administration.id}`
    edges.push({ id: `${source}->${departmentNodeId}`, source, target: departmentNodeId, matchState: 'normal' })
    ;(children.get(department.id) ?? []).forEach(visit)
  }
  ;(children.get(null) ?? []).forEach(visit)
  input.departments.filter((department) => !visited.has(department.id)).forEach(visit)

  const employeeNodes: EmployeeChartNode[] = activePlacements
    .sort((left, right) => {
      const leftName = employeeNames.get(left.employeeId) ?? ''
      const rightName = employeeNames.get(right.employeeId) ?? ''
      return leftName.localeCompare(rightName) || left.id.localeCompare(right.id)
    })
    .map((placement) => {
      const employee = employeeById.get(placement.employeeId)
      if (!employee) throw new Error('EMPLOYEE_SOURCE_MISSING')
      const badges = activeManagement.filter((assignment) => assignment.employeeId === employee.id)
        .map((assignment) => ({ code: assignment.roleCode, name: assignment.roleName }))
        .filter((badge, index, all) => all.findIndex((candidate) => candidate.code === badge.code) === index)
        .sort((left, right) => left.name.localeCompare(right.name))
      return {
        id: `employee:${placement.id}`, type: 'employee', matchState: 'normal', employeeId: employee.id,
        employmentId: placement.employmentId, placementId: placement.id, departmentId: placement.departmentId,
        name: fullName(employee), jobTitle: placement.jobTitle, avatarUrl: employee.avatarUrl,
        badges, customFields: customFieldsByEmployee.get(employee.id) ?? {},
      }
    })
  employeeNodes.forEach((node) => {
    nodes.push(node)
    const source = `department:${node.departmentId}`
    edges.push({ id: `${source}->${node.id}`, source, target: node.id, matchState: 'normal' })
  })

  const filtered = withFilters(nodes, edges, input)
  const roles = new Map<string, string>()
  activeManagement.forEach((assignment) => roles.set(assignment.roleCode, assignment.roleName))
  return {
    metadata: {
      asOfDate: input.asOfDate, administrationId: input.administration.id,
      visibleDepartmentCount: input.departments.length, visibleEmployeeCount: employeeNodes.length,
      matchCount: filtered.matchCount,
    },
    nodes: filtered.nodes, edges: filtered.edges,
    filters: {
      departments: input.departments.map(({ id, code, name }) => ({ id, code, name })).sort((left, right) => left.code.localeCompare(right.code)),
      roles: [...roles].map(([code, name]) => ({ code, name })).sort((left, right) => left.name.localeCompare(right.name)),
      customFields: [...input.customFieldDefinitions].sort((left, right) => left.label.localeCompare(right.label)),
    },
  }
}
