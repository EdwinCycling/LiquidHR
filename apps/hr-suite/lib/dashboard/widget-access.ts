import { toSelfPermission } from '@/lib/auth/permission-rules'
import type { DashboardWidgetType } from './schemas'
import type { DashboardWidgetCatalogEntry } from './widget-catalog'

export interface WidgetAccessInput {
  configs: Array<{ widgetType: string; isEnabled: boolean }>
  roleAccess: Array<{ widgetType: string; roleId: string }>
  activeRoleIds: Set<string>
  permissions: Set<string>
  entries: readonly DashboardWidgetCatalogEntry[]
}

export function resolveVisibleWidgetTypes(input: WidgetAccessInput): Set<DashboardWidgetType> {
  const configByType = new Map(input.configs.map((config) => [config.widgetType, config.isEnabled]))
  const rolesByType = new Map<string, Set<string>>()
  for (const access of input.roleAccess) {
    const roles = rolesByType.get(access.widgetType) ?? new Set<string>()
    roles.add(access.roleId)
    rolesByType.set(access.widgetType, roles)
  }

  const visible = new Set<DashboardWidgetType>()
  for (const entry of input.entries) {
    if (configByType.get(entry.type) !== true) continue
    const permittedRoles = rolesByType.get(entry.type)
    if (permittedRoles && ![...permittedRoles].some((roleId) => input.activeRoleIds.has(roleId))) continue

    const requiredPermissions = entry.selfOnly
      ? entry.permissions.map(toSelfPermission)
      : entry.permissions
    if (!requiredPermissions.every((permission) => input.permissions.has(permission))) continue
    visible.add(entry.type)
  }
  return visible
}
