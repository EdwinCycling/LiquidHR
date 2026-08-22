export type DepartmentRecord = {
  id: string
  code: string
  name: string
  description: string | null
  parentId: string | null
  isActive: boolean
}

export type DepartmentTreeNode = DepartmentRecord & {
  children: DepartmentTreeNode[]
}

export type DepartmentStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'
export type DepartmentSort = 'NAME' | 'CODE'

export function buildDepartmentTree(departments: readonly DepartmentRecord[]): DepartmentTreeNode[] {
  const nodes = new Map<string, DepartmentTreeNode>()
  const roots: DepartmentTreeNode[] = []

  for (const department of departments) {
    nodes.set(department.id, { ...department, children: [] })
  }

  for (const department of departments) {
    const node = nodes.get(department.id)
    if (!node) continue
    const parent = department.parentId ? nodes.get(department.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  return sortDepartmentTree(roots, 'NAME')
}

export function filterDepartmentTree(
  departments: readonly DepartmentRecord[],
  query: string,
  status: DepartmentStatusFilter,
  sort: DepartmentSort,
): { roots: DepartmentTreeNode[]; matchingCount: number; visibleCount: number } {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const byId = new Map(departments.map((department) => [department.id, department]))
  const matchingIds = new Set(
    departments
      .filter((department) => matchesStatus(department, status) && matchesQuery(department, normalizedQuery))
      .map((department) => department.id),
  )
  const visibleIds = new Set(matchingIds)

  for (const id of matchingIds) {
    let department = byId.get(id)
    while (department?.parentId) {
      visibleIds.add(department.parentId)
      department = byId.get(department.parentId)
    }
  }

  const visibleDepartments = departments.filter((department) => visibleIds.has(department.id))
  const roots = sortDepartmentTree(buildDepartmentTree(visibleDepartments), sort)

  return {
    roots,
    matchingCount: matchingIds.size,
    visibleCount: visibleDepartments.length,
  }
}

export function descendantDepartmentIds(departments: readonly DepartmentRecord[], departmentId: string): ReadonlySet<string> {
  const descendants = new Set<string>()
  let changed = true

  while (changed) {
    changed = false
    for (const department of departments) {
      if (department.parentId === departmentId || descendants.has(department.parentId ?? '')) {
        if (!descendants.has(department.id)) {
          descendants.add(department.id)
          changed = true
        }
      }
    }
  }

  return descendants
}

function matchesStatus(department: DepartmentRecord, status: DepartmentStatusFilter): boolean {
  return status === 'ALL' || (status === 'ACTIVE' && department.isActive) || (status === 'INACTIVE' && !department.isActive)
}

function matchesQuery(department: DepartmentRecord, query: string): boolean {
  if (!query) return true
  return `${department.code} ${department.name} ${department.description ?? ''}`.toLocaleLowerCase().includes(query)
}

function sortDepartmentTree(nodes: DepartmentTreeNode[], sort: DepartmentSort): DepartmentTreeNode[] {
  return nodes
    .map((node) => ({ ...node, children: sortDepartmentTree(node.children, sort) }))
    .sort((left, right) => {
      const leftValue = sort === 'CODE' ? left.code : left.name
      const rightValue = sort === 'CODE' ? right.code : right.name
      return leftValue.localeCompare(rightValue, 'nl-NL')
    })
}
