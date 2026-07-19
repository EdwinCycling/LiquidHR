import type { DashboardWidgetCategory } from '@/lib/dashboard/widget-catalog'
import { dashboardCategoryOrder, type DashboardWidgetPresentation } from '@/lib/dashboard/widget-presentation'

export function filterWidgetPresentations(
  presentations: readonly DashboardWidgetPresentation[],
  filter: { query: string; category: DashboardWidgetCategory | 'ALL'; locale: string },
): DashboardWidgetPresentation[] {
  const query = filter.query.trim().toLocaleLowerCase(filter.locale)
  return presentations.filter((item) => {
    if (filter.category !== 'ALL' && item.category !== filter.category) return false
    if (!query) return true
    return `${item.title} ${item.description}`.toLocaleLowerCase(filter.locale).includes(query)
  }).sort((left, right) => {
    const categoryDifference = dashboardCategoryOrder.indexOf(left.category) - dashboardCategoryOrder.indexOf(right.category)
    return categoryDifference || left.title.localeCompare(right.title, filter.locale)
  })
}
