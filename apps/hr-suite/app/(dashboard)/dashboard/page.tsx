import { DashboardWidgetRenderer } from '@/components/dashboard/widget-renderer'
import { DashboardWorkspace, type DashboardWorkspaceLabels } from '@/components/dashboard/dashboard-workspace'
import { getDashboardBootstrap } from '@/lib/dashboard/service'
import { loadDashboardWidgetData } from '@/lib/dashboard/widget-loaders'
import { DASHBOARD_WIDGET_CATALOG } from '@/lib/dashboard/widget-catalog'
import { buildWidgetPresentationMap } from '@/lib/dashboard/widget-presentation'
import { getLocale } from '@/lib/i18n/server'
import { createTranslator } from '@/lib/i18n/translator'
import messagesEn from '@/messages/en/dashboard.json'
import messagesNl from '@/messages/nl/dashboard.json'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ id?: string; refresh?: string }> }) {
  const [{ id }, locale] = await Promise.all([searchParams, getLocale()])
  const translate = createTranslator(locale === 'en' ? messagesEn : messagesNl)
  const bootstrap = await getDashboardBootstrap(id)
  const presentations = buildWidgetPresentationMap(DASHBOARD_WIDGET_CATALOG, translate)
  const labels: DashboardWorkspaceLabels = {
    title: translate('title'), new: translate('new'), edit: translate('edit'), save: translate('save'), cancel: translate('cancel'), addWidget: translate('addWidget'), removeWidget: translate('removeWidget'), moveUp: translate('moveUp'), moveDown: translate('moveDown'), rename: translate('rename'), duplicate: translate('duplicate'), delete: translate('delete'), welcome: translate('welcome'), welcomeBody: translate('welcomeBody'), myReminders: translate('myReminders'), organization: translate('organization'), employees: translate('employees'), companyDocuments: translate('companyDocuments'), openReminders: translate('openReminders'), openOrganization: translate('openOrganization'), openEmployees: translate('openEmployees'), openCompanyDocuments: translate('openCompanyDocuments'), empty: translate('empty'), dataSourcePending: translate('dataSourcePending'), widgetError: translate('widgetError'), error: translate('error'), dashboardName: translate('dashboardName'), create: translate('create'), refresh: translate('refresh'), loadedProgress: translate('loadedProgress'), updated: translate('updated'), loadedWithErrors: translate('loadedWithErrors'), pickerTitle: translate('picker.title'), pickerDescription: translate('picker.description'), pickerSearch: translate('picker.search'), pickerAll: translate('picker.all'), pickerAdd: translate('picker.add'), pickerAlreadyAdded: translate('picker.alreadyAdded'), pickerEmpty: translate('picker.empty'), pickerDone: translate('picker.done'), close: translate('picker.close'),
  }
  const widgets = await Promise.all(bootstrap.view.widgets.map(async (widget) => {
      const presentation = presentations.get(widget.type)
      return presentation ? { widget, presentation, data: await loadDashboardWidgetData(bootstrap.scope, widget) } : null
    }))
  return <DashboardWorkspace data={{ dashboards: bootstrap.dashboards, view: bootstrap.view }} labels={labels} locale={locale} presentations={[...presentations.values()]}>
    {widgets.map((item) => item ? <DashboardWidgetRenderer data={item.data} labels={labels} presentation={item.presentation} widget={item.widget} key={item.widget.id} /> : null)}
  </DashboardWorkspace>
}
