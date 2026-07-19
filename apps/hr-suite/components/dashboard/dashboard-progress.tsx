'use client'

import { Check, LoaderCircle, RefreshCw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { completeDashboardWidget, createDashboardProgressState, type DashboardWidgetCompletion } from './dashboard-progress-model'

interface ProgressLabels {
  loadedProgress: string
  updated: string
  loadedWithErrors: string
  refresh: string
}

interface DashboardProgressContextValue {
  completed: number
  total: number
  errorCount: number
  isComplete: boolean
  complete: (widgetId: string, result: DashboardWidgetCompletion) => void
}

const DashboardProgressContext = createContext<DashboardProgressContextValue | null>(null)

export function DashboardProgressProvider({ children, generation, labels, total }: { children: React.ReactNode; generation: string; labels: ProgressLabels; total: number }) {
  const [state, dispatch] = useReducer(
    (current: ReturnType<typeof createDashboardProgressState>, action: { widgetId: string; result: DashboardWidgetCompletion }) => completeDashboardWidget(current, action.widgetId, action.result),
    createDashboardProgressState(total, generation),
  )
  const complete = useCallback((widgetId: string, result: DashboardWidgetCompletion) => dispatch({ widgetId, result }), [])
  const value = useMemo(() => ({ completed: state.completed, total: state.total, errorCount: state.errorCount, isComplete: state.isComplete, complete }), [complete, state])
  return <DashboardProgressContext.Provider value={value}>{children}<DashboardProgressIndicator labels={labels} /></DashboardProgressContext.Provider>
}

export function WidgetCompletionSignal({ result, widgetId }: { result: DashboardWidgetCompletion; widgetId: string }) {
  const progress = useContext(DashboardProgressContext)
  useEffect(() => { progress?.complete(widgetId, result) }, [progress, result, widgetId])
  return null
}

export function DashboardRefreshButton({ label }: { label: string }) {
  const progress = useContext(DashboardProgressContext)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const refresh = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.set('refresh', String(Date.now()))
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }
  return <button className="button-secondary min-h-10 gap-2" disabled={!progress?.isComplete} onClick={refresh} type="button"><RefreshCw aria-hidden="true" className={!progress?.isComplete ? 'animate-spin' : undefined} size={16} />{label}</button>
}

function DashboardProgressIndicator({ labels }: { labels: ProgressLabels }) {
  const progress = useContext(DashboardProgressContext)
  if (!progress) return null
  const label = !progress.isComplete
    ? labels.loadedProgress.replace('{completed}', String(progress.completed)).replace('{total}', String(progress.total))
    : progress.errorCount > 0
      ? labels.loadedWithErrors.replace('{count}', String(progress.errorCount))
      : labels.updated
  return <div className="pointer-events-none fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full border bg-surface/95 px-4 py-2 text-sm font-semibold text-foreground shadow-lg backdrop-blur" role="status">{progress.isComplete ? <Check aria-hidden="true" className="mr-2 inline text-success" size={16} /> : <LoaderCircle aria-hidden="true" className="mr-2 inline animate-spin text-accent-foreground" size={16} />}{label}</div>
}
