import type { DashboardWidget } from '@/lib/dashboard/service'
import type { DashboardWidgetData } from '@/lib/dashboard/widget-loaders'
import type { DashboardWidgetPresentation } from '@/lib/dashboard/widget-presentation'
import { WidgetCompletionSignal } from './dashboard-progress'
import { DashboardWidgetRenderer, type DashboardWidgetLabels } from './widget-renderer'

export async function DashboardWidgetStream({ data, labels, presentation, widget }: { data: Promise<DashboardWidgetData>; labels: DashboardWidgetLabels; presentation: DashboardWidgetPresentation; widget: DashboardWidget }) {
  const result = await data.catch((): DashboardWidgetData => ({ status: 'error', code: 'WIDGET_LOAD_FAILED' }))
  const completion = result.status === 'ready' ? 'ready' : result.status
  return <><DashboardWidgetRenderer data={result} labels={labels} presentation={presentation} widget={widget} /><WidgetCompletionSignal result={completion} widgetId={widget.id} /></>
}
