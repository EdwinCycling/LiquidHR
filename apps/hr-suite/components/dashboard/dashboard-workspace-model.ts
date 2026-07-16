import type { DashboardWidget } from '@/lib/dashboard/service'

export function normalizeWidgetPositions(widgets: readonly DashboardWidget[]): DashboardWidget[] {
  return widgets.map((widget, position) => ({ ...widget, position }))
}

export function moveWidget(widgets: readonly DashboardWidget[], id: string, direction: 'up' | 'down'): DashboardWidget[] {
  const index = widgets.findIndex((widget) => widget.id === id)
  const destination = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || destination < 0 || destination >= widgets.length) return widgets.map((widget) => ({ ...widget }))
  const next = widgets.map((widget) => ({ ...widget }))
  const [moved] = next.splice(index, 1)
  next.splice(destination, 0, moved)
  return normalizeWidgetPositions(next)
}

export function removeWidget(widgets: readonly DashboardWidget[], id: string): DashboardWidget[] {
  return normalizeWidgetPositions(widgets.filter((widget) => widget.id !== id))
}
