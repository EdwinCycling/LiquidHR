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

function createEmployeeNode(
  placement: OrganizationChartProjectionInput['placements'][number],
  input: OrganizationChartProjectionInput,
  employeeById: ReadonlyMap<string, OrganizationChartProjectionInput['employees'][number]>,
  activeManagement: readonly ChartManagementSource[],
  customFieldsByEmployee: ReadonlyMap<string, Record<string, string>>,
): EmployeeChartNode {
  const employee = employeeById.get(placement.employeeId)
  if (!employee) throw new Error('EMPLOYEE_SOURCE_MISSING')
  const badges = activeManagement
    .filter((assignment) => assignment.employeeId === employee.id)
    .map((assignment) => ({ code: assignment.roleCode, name: assignment.roleName }))
    .filter((badge, index, all) => all.findIndex((candidate) => candidate.code === badge.code) === index)
    .sort((left, right) => left.name.localeCompare(right.name))

  return {
    id: `employee:${placement.id}`,
    type: 'employee',
    matchState: 'normal',
    employeeId: employee.id,
    employmentId: placement.employmentId,
    placementId: placement.id,
    departmentId: placement.departmentId,
    name: fullName(employee),
    jobTitle: placement.jobTitle,
    avatarUrl: employee.avatarUrl,
    badges,
    customFields: customFieldsByEmployee.get(employee.id) ?? {},
  }
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
        : node.type === 'group' ? `${node.title} ${node.subtitle ?? ''}`
        : `${node.name} ${node.jobTitle ?? ''}`
    if (!searchable.toLocaleLowerCase('nl').includes(query)) return false
  }
  if (input.filters.departmentId) {
    if (node.type === 'administration' || node.type === 'group') return false
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

function buildActiveContext(input: OrganizationChartProjectionInput) {
  const departmentsById = new Map(input.departments.map((department) => [department.id, department]))
  const employeeById = new Map(input.employees.map((employee) => [employee.id, employee]))
  const employeeNames = new Map(input.employees.map((employee) => [employee.id, fullName(employee)]))
  const activePlacements = input.placements.filter((placement) =>
    activeOn(placement.effectiveFrom, placement.effectiveTo, input.asOfDate)
    && departmentsById.has(placement.departmentId)
    && employeeById.has(placement.employeeId),
  )
  const activeManagement = input.managementAssignments.filter((assignment) =>
    activeOn(assignment.effectiveFrom, assignment.effectiveTo, input.asOfDate),
  )
  const customFieldsByEmployee = new Map<string, Record<string, string>>()
  input.customFieldValues.forEach((value) => customFieldsByEmployee.set(value.employeeId, {
    ...(customFieldsByEmployee.get(value.employeeId) ?? {}),
    [value.definitionId]: value.displayValue,
  }))

  return {
    departmentsById,
    employeeById,
    employeeNames,
    activePlacements,
    activeManagement,
    customFieldsByEmployee,
  }
}

function projectDepartmentView(input: OrganizationChartProjectionInput): {
  nodes: OrganizationChartNode[]
  edges: OrganizationChartEdge[]
  visiblePrimaryCount: number
  visibleEmployeeCount: number
} {
  const {
    departmentsById,
    employeeById,
    employeeNames,
    activePlacements,
    activeManagement,
    customFieldsByEmployee,
  } = buildActiveContext(input)

  const nodes: OrganizationChartNode[] = [{
    id: `administration:${input.administration.id}`,
    type: 'administration',
    matchState: 'normal',
    administrationId: input.administration.id,
    code: input.administration.code,
    name: input.administration.name,
    employeeCount: activePlacements.length,
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
      id: departmentNodeId,
      type: 'department',
      matchState: 'normal',
      departmentId: department.id,
      parentDepartmentId: department.parentId,
      code: department.code,
      name: department.name,
      employeeCount: activePlacements.filter((placement) => placement.departmentId === department.id).length,
      manager: resolveDepartmentManager(department, departmentsById, activeManagement, employeeNames),
    })
    const source = department.parentId && visited.has(department.parentId)
      ? `department:${department.parentId}`
      : `administration:${input.administration.id}`
    edges.push({ id: `${source}->${departmentNodeId}`, source, target: departmentNodeId, matchState: 'normal' })
    ;(children.get(department.id) ?? []).forEach(visit)
  }
  ;(children.get(null) ?? []).forEach(visit)
  input.departments.filter((department) => !visited.has(department.id)).forEach(visit)

  const employeeNodes = activePlacements
    .sort((left, right) => {
      const leftName = employeeNames.get(left.employeeId) ?? ''
      const rightName = employeeNames.get(right.employeeId) ?? ''
      return leftName.localeCompare(rightName) || left.id.localeCompare(right.id)
    })
    .map((placement) => createEmployeeNode(placement, input, employeeById, activeManagement, customFieldsByEmployee))

  employeeNodes.forEach((node) => {
    nodes.push(node)
    const source = `department:${node.departmentId}`
    edges.push({ id: `${source}->${node.id}`, source, target: node.id, matchState: 'normal' })
  })

  return {
    nodes,
    edges,
    visiblePrimaryCount: input.departments.length,
    visibleEmployeeCount: employeeNodes.length,
  }
}

function resolvePlacementManagerEmployeeId(
  placement: OrganizationChartProjectionInput['placements'][number],
  departmentsById: ReadonlyMap<string, ChartDepartmentSource>,
  activeManagement: readonly ChartManagementSource[],
  employeeNames: ReadonlyMap<string, string>,
): string | null {
  if (placement.directManagerId) return placement.directManagerId
  const department = departmentsById.get(placement.departmentId)
  if (!department) return null
  const manager = resolveDepartmentManager(department, departmentsById, activeManagement, employeeNames)
  return manager.status === 'resolved' || manager.status === 'inherited' ? manager.employeeId : null
}

function projectManagerView(input: OrganizationChartProjectionInput): {
  nodes: OrganizationChartNode[]
  edges: OrganizationChartEdge[]
  visiblePrimaryCount: number
  visibleEmployeeCount: number
} {
  const {
    departmentsById,
    employeeById,
    employeeNames,
    activePlacements,
    activeManagement,
    customFieldsByEmployee,
  } = buildActiveContext(input)

  const sortedPlacements = [...activePlacements].sort((left, right) => {
    const leftName = employeeNames.get(left.employeeId) ?? ''
    const rightName = employeeNames.get(right.employeeId) ?? ''
    return leftName.localeCompare(rightName) || left.id.localeCompare(right.id)
  })

  const primaryPlacementNodeByEmployee = new Map<string, string>()
  const nodes = sortedPlacements.map((placement) => {
    const node = createEmployeeNode(placement, input, employeeById, activeManagement, customFieldsByEmployee)
    if (!primaryPlacementNodeByEmployee.has(placement.employeeId)) {
      primaryPlacementNodeByEmployee.set(placement.employeeId, node.id)
    }
    return node
  })

  const edges: OrganizationChartEdge[] = []
  for (const placement of sortedPlacements) {
    const managerEmployeeId = resolvePlacementManagerEmployeeId(placement, departmentsById, activeManagement, employeeNames)
    const target = `employee:${placement.id}`
    const source = managerEmployeeId ? primaryPlacementNodeByEmployee.get(managerEmployeeId) : null
    if (!source || source === target) continue
    edges.push({
      id: `${source}->${target}`,
      source,
      target,
      matchState: 'normal',
    })
  }

  const childTargets = new Set(edges.map((edge) => edge.target))

  return {
    nodes,
    edges,
    visiblePrimaryCount: nodes.filter((node) => !childTargets.has(node.id)).length,
    visibleEmployeeCount: nodes.length,
  }
}

function projectJobView(input: OrganizationChartProjectionInput): {
  nodes: OrganizationChartNode[]
  edges: OrganizationChartEdge[]
  visiblePrimaryCount: number
  visibleEmployeeCount: number
} {
  const {
    employeeById,
    employeeNames,
    activePlacements,
    activeManagement,
    customFieldsByEmployee,
  } = buildActiveContext(input)

  const jobById = new Map(input.jobs.map((job) => [job.id, job]))
  const jobGroupById = new Map(input.jobGroups.map((group) => [group.id, group]))
  const exactAssessmentByEmployeeJob = new Map<string, number>()
  const fallbackAssessmentByEmployeeJobGroup = new Map<string, number>()
  input.starPerformerAssessments.forEach((assessment) => {
    if (assessment.jobId) {
      exactAssessmentByEmployeeJob.set(`${assessment.employeeId}::${assessment.jobId}`, assessment.criticalityLevel)
      return
    }
    if (assessment.jobGroupId) {
      fallbackAssessmentByEmployeeJobGroup.set(`${assessment.employeeId}::${assessment.jobGroupId}`, assessment.criticalityLevel)
    }
  })

  const nodes: OrganizationChartNode[] = []
  const edges: OrganizationChartEdge[] = []
  const nodeById = new Set<string>()
  const employeeCountByGroup = new Map<string, number>()
  const rootIds = new Set<string>()

  function addGroupNode(node: Extract<OrganizationChartNode, { type: 'group' }>) {
    if (nodeById.has(node.id)) return
    nodeById.add(node.id)
    nodes.push(node)
  }

  function increment(nodeId: string) {
    employeeCountByGroup.set(nodeId, (employeeCountByGroup.get(nodeId) ?? 0) + 1)
  }

  function starLabel(level: number): { title: string; subtitle: string | null } {
    return level > 0
      ? { title: `${level} ${level === 1 ? 'ster' : 'sterren'}`, subtitle: 'Crucialiteit' }
      : { title: 'Niet beoordeeld', subtitle: 'Nog geen star performer-score' }
  }

  const sortedPlacements = [...activePlacements].sort((left, right) => {
    const leftName = employeeNames.get(left.employeeId) ?? ''
    const rightName = employeeNames.get(right.employeeId) ?? ''
    return leftName.localeCompare(rightName) || left.id.localeCompare(right.id)
  })

  for (const placement of sortedPlacements) {
    const employeeNode = createEmployeeNode(placement, input, employeeById, activeManagement, customFieldsByEmployee)
    const job = placement.jobId ? jobById.get(placement.jobId) : undefined
    const jobGroup = job?.jobGroupId ? jobGroupById.get(job.jobGroupId) : undefined
    const rootId = jobGroup
      ? `group:job-group:${jobGroup.id}`
      : 'group:ungrouped:no-job-group'
    const jobNodeId = job
      ? `group:job:${job.id}`
      : 'group:job:unknown'
    const exactLevel = job ? exactAssessmentByEmployeeJob.get(`${placement.employeeId}::${job.id}`) : undefined
    const fallbackLevel = jobGroup ? fallbackAssessmentByEmployeeJobGroup.get(`${placement.employeeId}::${jobGroup.id}`) : undefined
    const criticalityLevel = exactLevel ?? fallbackLevel ?? 0
    const starNodeId = `${jobNodeId}:star:${criticalityLevel}`
    const starCopy = starLabel(criticalityLevel)

    rootIds.add(rootId)
    addGroupNode({
      id: rootId,
      type: 'group',
      matchState: 'normal',
      groupId: rootId,
      groupKind: jobGroup ? 'job-group' : 'ungrouped',
      title: jobGroup ? jobGroup.name : 'Losse medewerkers',
      subtitle: jobGroup ? jobGroup.code : 'Zonder functiegroep',
      employeeCount: 0,
    })
    addGroupNode({
      id: jobNodeId,
      type: 'group',
      matchState: 'normal',
      groupId: jobNodeId,
      groupKind: 'job',
      title: job ? job.name : placement.jobTitle ?? 'Functie onbekend',
      subtitle: job ? job.code : null,
      employeeCount: 0,
    })
    addGroupNode({
      id: starNodeId,
      type: 'group',
      matchState: 'normal',
      groupId: starNodeId,
      groupKind: 'star-level',
      title: starCopy.title,
      subtitle: starCopy.subtitle,
      employeeCount: 0,
    })

    if (!edges.some((edge) => edge.source === rootId && edge.target === jobNodeId)) {
      edges.push({ id: `${rootId}->${jobNodeId}`, source: rootId, target: jobNodeId, matchState: 'normal' })
    }
    if (!edges.some((edge) => edge.source === jobNodeId && edge.target === starNodeId)) {
      edges.push({ id: `${jobNodeId}->${starNodeId}`, source: jobNodeId, target: starNodeId, matchState: 'normal' })
    }

    nodes.push(employeeNode)
    edges.push({ id: `${starNodeId}->${employeeNode.id}`, source: starNodeId, target: employeeNode.id, matchState: 'normal' })
    increment(rootId)
    increment(jobNodeId)
    increment(starNodeId)
  }

  for (const node of nodes) {
    if (node.type !== 'group') continue
    node.employeeCount = employeeCountByGroup.get(node.id) ?? 0
  }

  return {
    nodes,
    edges,
    visiblePrimaryCount: rootIds.size,
    visibleEmployeeCount: sortedPlacements.length,
  }
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
  const projection = input.filters.view === 'manager'
    ? projectManagerView(input)
    : input.filters.view === 'job'
      ? projectJobView(input)
      : projectDepartmentView(input)
  const filtered = withFilters(projection.nodes, projection.edges, input)
  const roles = new Map<string, string>()
  input.managementAssignments.forEach((assignment) => roles.set(assignment.roleCode, assignment.roleName))
  return {
    metadata: {
      asOfDate: input.asOfDate,
      administrationId: input.administration.id,
      view: input.filters.view,
      visiblePrimaryCount: projection.visiblePrimaryCount,
      visibleEmployeeCount: projection.visibleEmployeeCount,
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
