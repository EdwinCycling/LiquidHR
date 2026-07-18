import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listDashboardWidgetSettings } from '@/lib/dashboard/widget-settings-service'
import { DashboardWidgetSettingsForm } from '@/components/settings/dashboard-widget-settings-form'
import { DASHBOARD_WIDGET_CATALOG } from '@/lib/dashboard/widget-catalog'
import { buildWidgetPresentationMap } from '@/lib/dashboard/widget-presentation'

export default async function DashboardWidgetSettingsPage() {
  try { await requirePermission('dashboard-widget:write') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [{ widgets, roles }, messages, dashboardMessages] = await Promise.all([listDashboardWidgetSettings(), getTranslator('settings'), getTranslator('dashboard')])
  const categoryKeys = ['CORE_HR', 'EMPLOYMENT', 'DOCUMENTS', 'COMPENSATION', 'ORGANIZATION_TIME']
  const presentations = buildWidgetPresentationMap(DASHBOARD_WIDGET_CATALOG, dashboardMessages)
  const items = widgets.map((widget) => { const presentation = presentations.get(widget.type as Parameters<typeof presentations.get>[0]); if (!presentation) throw new Error('DASHBOARD_WIDGET_PRESENTATION_MISSING'); return { ...widget, title: presentation.title, description: presentation.description, visualizationLabel: presentation.visualizationLabel } })
  return <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10"><header className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{messages('admin.title')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{messages('dashboardWidgets.title')}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{messages('dashboardWidgets.subtitle')}</p></header><DashboardWidgetSettingsForm labels={{ saving: messages('saving'), saved: messages('dashboardWidgets.saved'), failed: messages('dashboardWidgets.failed'), enabled: messages('dashboardWidgets.enabled'), active: messages('dashboardWidgets.active'), inactive: messages('dashboardWidgets.inactive'), roles: messages('dashboardWidgets.roles'), allRoles: messages('dashboardWidgets.allRoles'), noRoles: messages('dashboardWidgets.noRoles'), categories: Object.fromEntries(categoryKeys.map((key) => [key, messages(`dashboardWidgets.categories.${key}`)])) }} roles={roles} widgets={items} /></div>
}
