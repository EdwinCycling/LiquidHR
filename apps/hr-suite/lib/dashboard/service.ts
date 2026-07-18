import { requireAuthContext, type AuthContext } from '@/lib/auth/permissions'
import { requireHeRaContext } from '@/lib/hera/request-context'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@scope/db'
import { dashboardCreateSchema, dashboardLayoutSchema, type DashboardCreateInput, type DashboardLayoutInput, type DashboardWidgetType } from './schemas'
import { resolveVisibleDashboardWidgetTypes } from './widget-settings-service'
import { getWidgetCatalogEntry } from './widget-catalog'

export interface DashboardWidget { id: string; type: DashboardWidgetType; position: number; settings: Record<string, unknown> }
export interface PersonalDashboard { id: string; name: string; isDefault: boolean; updatedAt: string }
export interface DashboardMetrics { reminderCount: number; employeeCount: number | null; departmentCount: number | null }
export interface DashboardView { dashboard: PersonalDashboard; widgets: DashboardWidget[]; metrics: DashboardMetrics; availableWidgetTypes: DashboardWidgetType[] }
export interface DashboardRequestScope { context: AuthContext; supabase: Awaited<ReturnType<typeof createClient>> }
export interface DashboardBootstrap { scope: DashboardRequestScope; dashboards: PersonalDashboard[]; view: DashboardView }

const DEFAULT_WIDGETS: ReadonlyArray<{ type: DashboardWidgetType; position: number }> = [
  { type: 'WELCOME', position: 0 }, { type: 'MY_REMINDERS', position: 1 }, { type: 'ORGANIZATION_OVERVIEW', position: 2 }, { type: 'EMPLOYEE_OVERVIEW', position: 3 },
]

export function defaultDashboardWidgets(): Array<{ type: DashboardWidgetType; position: number }> { return DEFAULT_WIDGETS.map((widget) => ({ ...widget })) }
export function validateDashboardLayout(input: unknown): DashboardLayoutInput {
  const parsed = dashboardLayoutSchema.safeParse(input)
  if (!parsed.success) throw new Error('DASHBOARD_LAYOUT_INVALID')
  return parsed.data
}

function mapDashboard(row: { id: string; name: string; is_default: boolean; updated_at: string }): PersonalDashboard {
  return { id: row.id, name: row.name, isDefault: row.is_default, updatedAt: row.updated_at }
}

export async function createDashboardRequestScope(): Promise<DashboardRequestScope> {
  const supabase = await createClient()
  const context = await requireAuthContext(supabase)
  return { context, supabase }
}

async function ensurePersonalDashboardInScope(scope: DashboardRequestScope): Promise<PersonalDashboard> {
  const { context, supabase } = scope
  const { data: existing, error: existingError } = await supabase.from('personal_dashboards').select('id, name, is_default, updated_at').eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).order('updated_at', { ascending: false }).limit(100)
  if (existingError) throw existingError
  if (existing[0]) return mapDashboard(existing.find((dashboard) => dashboard.is_default) ?? existing[0])
  const { data: created, error: createError } = await supabase.from('personal_dashboards').insert({ tenant_id: context.tenantId, owner_user_id: context.userId, name: 'Mijn dashboard', is_default: true }).select('id, name, is_default, updated_at').single()
  if (createError) throw createError
  const { error: widgetError } = await supabase.from('personal_dashboard_widgets').insert(defaultDashboardWidgets().map((widget) => ({ tenant_id: context.tenantId, dashboard_id: created.id, widget_type: widget.type, position: widget.position, settings: {} })))
  if (widgetError) throw widgetError
  return mapDashboard(created)
}

export async function ensurePersonalDashboard(): Promise<PersonalDashboard> {
  return ensurePersonalDashboardInScope(await createDashboardRequestScope())
}

async function listPersonalDashboardsInScope(scope: DashboardRequestScope): Promise<PersonalDashboard[]> {
  await ensurePersonalDashboardInScope(scope)
  const { context, supabase } = scope
  const { data, error } = await supabase.from('personal_dashboards').select('id, name, is_default, updated_at').eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).order('updated_at', { ascending: false })
  if (error) throw error
  return data.map(mapDashboard)
}

export async function listPersonalDashboards(): Promise<PersonalDashboard[]> {
  return listPersonalDashboardsInScope(await createDashboardRequestScope())
}

export async function createDashboard(input: DashboardCreateInput): Promise<PersonalDashboard> {
  const parsed = dashboardCreateSchema.parse(input); const context = await requireHeRaContext(); const supabase = await createClient()
  const { data, error } = await supabase.from('personal_dashboards').insert({ tenant_id: context.tenantId, owner_user_id: context.userId, name: parsed.name }).select('id, name, is_default, updated_at').single()
  if (error) throw error
  const { error: widgetError } = await supabase.from('personal_dashboard_widgets').insert(defaultDashboardWidgets().map((widget) => ({ tenant_id: context.tenantId, dashboard_id: data.id, widget_type: widget.type, position: widget.position, settings: {} })))
  if (widgetError) throw widgetError
  return mapDashboard(data)
}

export async function renameDashboard(id: string, input: DashboardCreateInput): Promise<PersonalDashboard | null> {
  const parsed = dashboardCreateSchema.parse(input); const context = await requireHeRaContext(); const supabase = await createClient()
  const { data, error } = await supabase.from('personal_dashboards').update({ name: parsed.name }).eq('id', id).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).select('id, name, is_default, updated_at').maybeSingle()
  if (error) throw error
  return data ? mapDashboard(data) : null
}

export async function duplicateDashboard(id: string): Promise<PersonalDashboard | null> {
  const context = await requireHeRaContext(); const supabase = await createClient()
  const { data: source, error: sourceError } = await supabase.from('personal_dashboards').select('id, name').eq('id', id).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).maybeSingle()
  if (sourceError) throw sourceError; if (!source) return null
  const { data: copy, error: copyError } = await supabase.from('personal_dashboards').insert({ tenant_id: context.tenantId, owner_user_id: context.userId, name: `${source.name} kopie` }).select('id, name, is_default, updated_at').single()
  if (copyError) throw copyError
  const { data: widgets, error: widgetsError } = await supabase.from('personal_dashboard_widgets').select('widget_type, position, settings').eq('tenant_id', context.tenantId).eq('dashboard_id', source.id).order('position')
  if (widgetsError) throw widgetsError
  const { error: copyWidgetsError } = await supabase.from('personal_dashboard_widgets').insert(widgets.map((widget) => ({ tenant_id: context.tenantId, dashboard_id: copy.id, widget_type: widget.widget_type, position: widget.position, settings: widget.settings })))
  if (copyWidgetsError) throw copyWidgetsError
  return mapDashboard(copy)
}

export async function deleteDashboard(id: string): Promise<boolean> {
  const dashboards = await listPersonalDashboards(); if (dashboards.length <= 1) throw new Error('DASHBOARD_LAST_DELETE_FORBIDDEN')
  const context = await requireHeRaContext(); const supabase = await createClient()
  const { data, error } = await supabase.from('personal_dashboards').delete().eq('id', id).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).select('id').maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function saveDashboardLayout(id: string, input: unknown): Promise<DashboardWidget[] | null> {
  const layout = validateDashboardLayout(input); const context = await requireHeRaContext(); const supabase = await createClient()
  const { data: dashboard, error: dashboardError } = await supabase.from('personal_dashboards').select('id').eq('id', id).eq('tenant_id', context.tenantId).eq('owner_user_id', context.userId).maybeSingle()
  if (dashboardError) throw dashboardError; if (!dashboard) return null
  const { error: deleteError } = await supabase.from('personal_dashboard_widgets').delete().eq('tenant_id', context.tenantId).eq('dashboard_id', id)
  if (deleteError) throw deleteError
  if (layout.widgets.length > 0) {
    const { error: insertError } = await supabase.from('personal_dashboard_widgets').insert(layout.widgets.map((widget) => ({ tenant_id: context.tenantId, dashboard_id: id, widget_type: widget.type, position: widget.position, settings: widget.settings as Json })))
    if (insertError) throw insertError
  }
  return getDashboardWidgets(id)
}

async function getDashboardWidgetsInScope(scope: DashboardRequestScope, id: string): Promise<DashboardWidget[]> {
  const { context, supabase } = scope
  const { data, error } = await supabase.from('personal_dashboard_widgets').select('id, widget_type, position, settings').eq('tenant_id', context.tenantId).eq('dashboard_id', id).order('position')
  if (error) throw error
  return data.map((widget) => ({ id: widget.id, type: widget.widget_type as DashboardWidgetType, position: widget.position, settings: widget.settings as Record<string, unknown> }))
}

async function getDashboardWidgets(id: string): Promise<DashboardWidget[]> {
  return getDashboardWidgetsInScope(await createDashboardRequestScope(), id)
}

export async function getDashboardBootstrap(id?: string): Promise<DashboardBootstrap> {
  const scope = await createDashboardRequestScope()
  const dashboards = await listPersonalDashboardsInScope(scope); const dashboard = id ? dashboards.find((candidate) => candidate.id === id) : dashboards.find((candidate) => candidate.isDefault) ?? dashboards[0]
  if (!dashboard) throw new Error('DASHBOARD_NOT_FOUND')
  const { context, supabase } = scope
  const [allWidgets, reminderResult, employeeResult, departmentResult] = await Promise.all([
    getDashboardWidgetsInScope(scope, dashboard.id),
    supabase.from('reminder_recipients').select('id', { count: 'exact', head: true }).eq('tenant_id', context.tenantId).eq('status', 'PENDING'),
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('tenant_id', context.tenantId).eq('is_active', true).is('deleted_at', null),
    supabase.from('departments').select('id', { count: 'exact', head: true }).eq('tenant_id', context.tenantId).eq('is_active', true),
  ])
  const visibleTypes = await resolveVisibleDashboardWidgetTypes(context, supabase)
  const widgets = allWidgets.filter((widget) => visibleTypes.has(widget.type))
  const availableWidgetTypes = [...visibleTypes].filter((type): type is DashboardWidgetType => getWidgetCatalogEntry(type as DashboardWidgetType) !== undefined)
  return { scope, dashboards, view: { dashboard, widgets, availableWidgetTypes, metrics: { reminderCount: reminderResult.error ? 0 : reminderResult.count ?? 0, employeeCount: employeeResult.error ? null : employeeResult.count, departmentCount: departmentResult.error ? null : departmentResult.count } } }
}

export async function getDashboardView(id?: string): Promise<DashboardView> {
  return (await getDashboardBootstrap(id)).view
}
