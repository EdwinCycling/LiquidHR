export type AuthorizationTab = 'permissions' | 'overview' | 'assignments'

interface AuthorizationRoleInput {
  id: string
  isActive: boolean
  isSystem: boolean
  tenantId: string | null
}

interface AuthorizationPermissionInput {
  id: string
  category: string
}

interface AuthorizationAssignmentInput {
  roleId: string
  permissionId: string
}

interface AuthorizationOverviewInput {
  roles: AuthorizationRoleInput[]
  permissions: AuthorizationPermissionInput[]
  rolePermissions: AuthorizationAssignmentInput[]
}

export interface PermissionCategoryOverview {
  name: string
  permissionIds: string[]
}

export interface AuthorizationOverview {
  roleCount: number
  activeTenantRoleCount: number
  assignedPermissionCount: number
  categoryCount: number
  categories: PermissionCategoryOverview[]
}

export interface PermissionCoverage {
  assigned: number
  total: number
  percentage: number
}

export function authorizationCoverageTarget(roleId: string, category: string): { roleId: string; category: string } {
  return { roleId: roleId.trim(), category: category.trim() }
}

export function normalizeAuthorizationTab(value: string | null): AuthorizationTab {
  if (value === 'overview' || value === 'assignments') return value
  return 'permissions'
}

export function permissionCoverage(selected: ReadonlySet<string>, permissionIds: readonly string[]): PermissionCoverage {
  const uniqueIds = [...new Set(permissionIds)]
  const assigned = uniqueIds.filter((permissionId) => selected.has(permissionId)).length
  const total = uniqueIds.length
  return { assigned, total, percentage: total === 0 ? 0 : Math.round((assigned / total) * 100) }
}

export function togglePermissionGroup(selected: ReadonlySet<string>, permissionIds: readonly string[]): Set<string> {
  const next = new Set(selected)
  const uniqueIds = [...new Set(permissionIds)]
  const allSelected = uniqueIds.length > 0 && uniqueIds.every((permissionId) => selected.has(permissionId))
  for (const permissionId of uniqueIds) {
    if (allSelected) next.delete(permissionId)
    else next.add(permissionId)
  }
  return next
}

export function permissionSelectionChanged(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return true
  return [...left].some((permissionId) => !right.has(permissionId))
}

export function buildAuthorizationOverview(input: AuthorizationOverviewInput): AuthorizationOverview {
  const categories = new Map<string, string[]>()
  for (const permission of input.permissions) {
    const ids = categories.get(permission.category) ?? []
    if (!ids.includes(permission.id)) ids.push(permission.id)
    categories.set(permission.category, ids)
  }

  const uniqueAssignments = new Set(input.rolePermissions.map((assignment) => `${assignment.roleId}:${assignment.permissionId}`))
  return {
    roleCount: input.roles.length,
    activeTenantRoleCount: input.roles.filter((role) => role.tenantId !== null && !role.isSystem && role.isActive).length,
    assignedPermissionCount: uniqueAssignments.size,
    categoryCount: categories.size,
    categories: [...categories].map(([name, permissionIds]) => ({ name, permissionIds })),
  }
}
