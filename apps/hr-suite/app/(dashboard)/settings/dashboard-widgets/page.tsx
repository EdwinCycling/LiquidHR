import { redirect } from 'next/navigation'
import { AuthorizationError, requirePermission } from '@/lib/auth/permissions'
import { getTranslator } from '@/lib/i18n/server'
import { listDashboardWidgetSettings } from '@/lib/dashboard/widget-settings-service'
import { DashboardWidgetSettingsForm } from '@/components/settings/dashboard-widget-settings-form'

export default async function DashboardWidgetSettingsPage() {
  try { await requirePermission('dashboard-widget:write') } catch (error) { if (error instanceof AuthorizationError) redirect('/geen-toegang'); throw error }
  const [{ widgets, roles }, messages] = await Promise.all([listDashboardWidgetSettings(), getTranslator('settings')])
  const categoryKeys = ['CORE_HR', 'EMPLOYMENT', 'DOCUMENTS', 'COMPENSATION', 'ORGANIZATION_TIME']
  const widgetNames: Record<string, string> = {}
  const widgetDescriptions: Record<string, string> = {}
  return <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-10"><header className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{messages('admin.title')}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{messages('dashboardWidgets.title')}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{messages('dashboardWidgets.subtitle')}</p></header><DashboardWidgetSettingsForm labels={{ save: messages('dashboardWidgets.save'), saving: messages('saving'), saved: messages('dashboardWidgets.saved'), failed: messages('dashboardWidgets.failed'), enabled: messages('dashboardWidgets.enabled'), roles: messages('dashboardWidgets.roles'), noRoles: messages('dashboardWidgets.noRoles'), categories: Object.fromEntries(categoryKeys.map((key) => [key, messages(`dashboardWidgets.categories.${key}`)])), names: widgetNames, descriptions: widgetDescriptions }} roles={roles} widgets={widgets} /></div>
}
