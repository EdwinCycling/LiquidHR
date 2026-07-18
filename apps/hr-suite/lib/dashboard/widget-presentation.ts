import type { DashboardWidgetType } from './schemas'
import type {
  DashboardWidgetCatalogEntry,
  DashboardWidgetCategory,
  DashboardWidgetVisualization,
  DashboardWidgetWidth,
} from './widget-catalog'

export const dashboardCategoryOrder: readonly DashboardWidgetCategory[] = [
  'CORE_HR',
  'EMPLOYMENT',
  'DOCUMENTS',
  'COMPENSATION',
  'ORGANIZATION_TIME',
]

export interface DashboardWidgetPresentation {
  type: DashboardWidgetType
  category: DashboardWidgetCategory
  title: string
  description: string
  categoryLabel: string
  visualization: DashboardWidgetVisualization
  visualizationLabel: string
  defaultWidth: DashboardWidgetWidth
  widthLabel: string
}

export function buildWidgetPresentation(
  entry: DashboardWidgetCatalogEntry,
  translate: (key: string) => string,
): DashboardWidgetPresentation {
  return {
    type: entry.type,
    category: entry.category,
    title: translate(entry.titleKey),
    description: translate(entry.descriptionKey),
    categoryLabel: translate(`categories.${entry.category}`),
    visualization: entry.visualization,
    visualizationLabel: translate(`visualizations.${entry.visualization}`),
    defaultWidth: entry.defaultWidth,
    widthLabel: translate(`widths.${entry.defaultWidth}`),
  }
}

export function buildWidgetPresentationMap(
  entries: readonly DashboardWidgetCatalogEntry[],
  translate: (key: string) => string,
): Map<DashboardWidgetType, DashboardWidgetPresentation> {
  return new Map(entries.map((entry) => [entry.type, buildWidgetPresentation(entry, translate)]))
}
