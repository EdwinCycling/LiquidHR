import { requireAuthContext, requirePermission, type AuthContext } from '@/lib/auth/permissions'
import { requireHeRaContext } from '@/lib/hera/request-context'
import { createClient } from '@/lib/supabase/server'
import { DASHBOARD_WIDGET_CATALOG } from './widget-catalog'
import { resolveVisibleWidgetTypes } from './widget-access'

export interface DashboardWidgetRole { id: string; code: string; name: string }
export interface DashboardWidgetSetting {
  type: string
  category: string
  titleKey: string
  descriptionKey: string
  visualization: string
  defaultWidth: string
  isEnabled: boolean
  roleIds: string[]
}

export async function listDashboardWidgetSettings(): Promise<{ widgets: DashboardWidgetSetting[]; roles: DashboardWidgetRole[] }> {
  const context = await requirePermission('dashboard-widget:write')
  const supabase = await createClient()
  const [configsResult, accessResult, rolesResult] = await Promise.all([
    supabase.from('dashboard_widget_configs').select('widget_type, is_enabled').eq('tenant_id', context.tenantId),
    supabase.from('dashboard_widget_role_access').select('widget_type, management_role_id').eq('tenant_id', context.tenantId),
    supabase.from('management_roles').select('id, code, name').or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`).order('tenant_id', { ascending: true }).order('name'),
  ])
  if (configsResult.error) throw configsResult.error
  if (accessResult.error) throw accessResult.error
  if (rolesResult.error) throw rolesResult.error
  const configs = new Map((configsResult.data ?? []).map((row) => [row.widget_type, row.is_enabled]))
  const roleIds = new Map<string, string[]>()
  for (const row of accessResult.data ?? []) roleIds.set(row.widget_type, [...(roleIds.get(row.widget_type) ?? []), row.management_role_id])
  return {
    roles: (rolesResult.data ?? []).map((role) => ({ id: role.id, code: role.code, name: role.name })),
    widgets: DASHBOARD_WIDGET_CATALOG.map((widget) => ({
      type: widget.type,
      category: widget.category,
      titleKey: widget.titleKey,
      descriptionKey: widget.descriptionKey,
      visualization: widget.visualization,
      defaultWidth: widget.defaultWidth,
      isEnabled: configs.get(widget.type) ?? true,
      roleIds: roleIds.get(widget.type) ?? [],
    })),
  }
}

export async function updateDashboardWidgetSetting(input: { widgetType: string; isEnabled: boolean; roleIds: string[] }): Promise<void> {
  const context = await requirePermission('dashboard-widget:write')
  const widget = DASHBOARD_WIDGET_CATALOG.find((entry) => entry.type === input.widgetType)
  if (!widget) throw new Error('DASHBOARD_WIDGET_UNKNOWN')
  const supabase = await createClient()
  const { data: roles, error: rolesError } = await supabase.from('management_roles').select('id').or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`).in('id', input.roleIds)
  if (rolesError) throw rolesError
  if ((roles?.length ?? 0) !== new Set(input.roleIds).size) throw new Error('DASHBOARD_WIDGET_ROLE_INVALID')
  const { error: configError } = await supabase.from('dashboard_widget_configs').upsert({ tenant_id: context.tenantId, widget_type: widget.type, is_enabled: input.isEnabled, updated_by: context.userId }, { onConflict: 'tenant_id,widget_type' })
  if (configError) throw configError
  const { error: deleteError } = await supabase.from('dashboard_widget_role_access').delete().eq('tenant_id', context.tenantId).eq('widget_type', widget.type)
  if (deleteError) throw deleteError
  if (input.roleIds.length > 0) {
    const { error: accessError } = await supabase.from('dashboard_widget_role_access').insert(input.roleIds.map((managementRoleId) => ({ tenant_id: context.tenantId, widget_type: widget.type, management_role_id: managementRoleId })))
    if (accessError) throw accessError
  }
}

export async function listVisibleDashboardWidgetTypes(): Promise<Set<string>> {
  const supabase = await createClient()
  const context = await requireAuthContext(supabase)
  return resolveVisibleDashboardWidgetTypes(context, supabase)
}

export async function resolveVisibleDashboardWidgetTypes(
  context: AuthContext,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Set<string>> {
  const [configsResult, accessResult, rolesResult] = await Promise.all([
    supabase.from('dashboard_widget_configs').select('widget_type, is_enabled').eq('tenant_id', context.tenantId),
    supabase.from('dashboard_widget_role_access').select('widget_type, management_role_id').eq('tenant_id', context.tenantId),
    context.activeRoles.length > 0
      ? supabase.from('management_roles').select('id').in('code', context.activeRoles).or(`tenant_id.is.null,tenant_id.eq.${context.tenantId}`)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (configsResult.error) throw configsResult.error
  if (accessResult.error) throw accessResult.error
  if (rolesResult.error) throw rolesResult.error
  return resolveVisibleWidgetTypes({
    configs: (configsResult.data ?? []).map((row) => ({ widgetType: row.widget_type, isEnabled: row.is_enabled })),
    roleAccess: (accessResult.data ?? []).map((row) => ({ widgetType: row.widget_type, roleId: row.management_role_id })),
    activeRoleIds: new Set((rolesResult.data ?? []).map((role) => role.id)),
    permissions: new Set(context.permissions),
    entries: DASHBOARD_WIDGET_CATALOG,
  })
}
