import type { DashboardWidget } from '@/lib/dashboard/service'
import { dashboardWidgetWidthClass } from './widget-renderer'

export function WidgetSkeleton({ widget }: { widget: DashboardWidget }) {
  return <article aria-hidden="true" className={`${dashboardWidgetWidthClass(widget)} min-h-48 animate-pulse rounded-2xl border bg-surface p-5 sm:p-6`}><div className="size-10 rounded-xl bg-muted" /><div className="mt-8 h-4 w-2/5 rounded bg-muted" /><div className="mt-3 h-8 w-1/4 rounded bg-muted" /><div className="mt-6 h-4 w-1/2 rounded bg-muted" /></article>
}
