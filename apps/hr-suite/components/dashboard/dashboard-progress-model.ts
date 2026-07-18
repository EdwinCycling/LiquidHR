export type DashboardWidgetCompletion = 'ready' | 'empty' | 'error'

export interface DashboardProgressState {
  total: number
  generation: string
  results: Readonly<Record<string, DashboardWidgetCompletion>>
  completed: number
  errorCount: number
  isComplete: boolean
}

export function createDashboardProgressState(total: number, generation: string): DashboardProgressState {
  return { total, generation, results: {}, completed: 0, errorCount: 0, isComplete: total === 0 }
}

export function completeDashboardWidget(
  state: DashboardProgressState,
  widgetId: string,
  result: DashboardWidgetCompletion,
): DashboardProgressState {
  if (state.results[widgetId]) return state
  const results = { ...state.results, [widgetId]: result }
  const completed = Object.keys(results).length
  return {
    ...state,
    results,
    completed,
    errorCount: Object.values(results).filter((value) => value === 'error').length,
    isComplete: completed >= state.total,
  }
}

export function resetDashboardProgress(state: DashboardProgressState, generation: string): DashboardProgressState {
  return createDashboardProgressState(state.total, generation)
}
