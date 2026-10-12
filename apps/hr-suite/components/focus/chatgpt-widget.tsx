import { useEffect, useRef, useState } from 'react'
import type { App, McpUiHostContext } from '@modelcontextprotocol/ext-apps'
import {
  projectChatGptFocusPlan,
  projectChatGptFocusPlans,
  projectSelectedChatGptFocusPlan,
  sameChatGptFocusPlan,
  type ChatGptFocusPlan,
} from '@/lib/workforce-tools/mcp/focus-widget-contract'
import nlMessages from '@/messages/nl/workforce.json'
import enMessages from '@/messages/en/workforce.json'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { SectionHeader } from '@/components/patterns/section-header'
import { Surface } from '@/components/ui/surface'

type WidgetLabels = typeof nlMessages.mcp.focusWidget
type WidgetApp = Pick<App, 'callServerTool' | 'getHostContext' | 'updateModelContext' | 'addEventListener' | 'removeEventListener'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hostSelectedPlan(app: WidgetApp): ChatGptFocusPlan | null {
  const context = app.getHostContext()?.['openai/modelContext']
  if (!isRecord(context) || !isRecord(context.structuredContent)) return null
  return projectChatGptFocusPlan(context.structuredContent)
}

function formatDate(value: string | null, locale: 'nl' | 'en'): string {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function errorTextFromResult(result: unknown): 'auth' | 'error' | null {
  if (!isRecord(result) || result.isError !== true) return null
  const content = Array.isArray(result.content) ? result.content : []
  const texts = content.flatMap((item) => isRecord(item) && typeof item.text === 'string' ? [item.text] : [])
  const meta = isRecord(result._meta) ? result._meta : {}
  const challenge = Array.isArray(meta['mcp/www_authenticate'])
  if (challenge || texts.some((text) => /insufficient_scope|MCP_AUTHENTICATION_REQUIRED|authentication is required/i.test(text))) return 'auth'
  return 'error'
}

function projectFromResult(result: unknown): ChatGptFocusPlan[] | null {
  if (!isRecord(result)) return null
  if (result.isError === true) return null
  if (result.structuredContent) return projectChatGptFocusPlans(result.structuredContent)
  const content = Array.isArray(result.content) ? result.content : []
  const text = content.find((item) => isRecord(item) && item.type === 'text' && typeof item.text === 'string')
  if (!isRecord(text) || typeof text.text !== 'string') return null
  try {
    return projectChatGptFocusPlans(JSON.parse(text.text) as unknown)
  } catch {
    return null
  }
}

export function ChatGptFocusWidget({ app }: { app: WidgetApp }) {
  const locale: 'nl' | 'en' = app.getHostContext()?.locale?.toLowerCase().startsWith('nl') ? 'nl' : 'en'
  const labels: WidgetLabels = locale === 'nl' ? nlMessages.mcp.focusWidget : enMessages.mcp.focusWidget
  const [plans, setPlans] = useState<ChatGptFocusPlan[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [shared, setShared] = useState(false)
  const [state, setState] = useState<'loading' | 'ready' | 'auth' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const sharedRef = useRef(false)
  const selectedPlan = selectedIndex === null ? null : plans[selectedIndex] ?? null
  const statusLabels = labels.status

  useEffect(() => {
    let mounted = true
    const candidate = hostSelectedPlan(app)
    const onHostContextChanged = (context: McpUiHostContext) => {
      if (context['openai/modelContext'] === null && sharedRef.current) {
        sharedRef.current = false
        setSelectedIndex(null)
        setShared(false)
        setMessage(labels.contextCleared)
      }
    }
    app.addEventListener('hostcontextchanged', onHostContextChanged)

    const loadPlans = async () => {
      setBusy(true)
      setState('loading')
      sharedRef.current = false
      setSelectedIndex(null)
      setShared(false)
      setMessage('')
      try {
        await app.updateModelContext({ content: [] })
        const result = await app.callServerTool({ name: 'liquidhr.focus.development-plans.read', arguments: {} })
        const resultError = errorTextFromResult(result)
        if (resultError) {
          if (!mounted) return
          setState(resultError)
          return
        }
        const loadedPlans = projectFromResult(result)
        if (!loadedPlans) throw new Error('INVALID_PLAN_PROJECTION')
        if (!mounted) return
        setPlans(loadedPlans)
        setState('ready')
        const restoredIndex = candidate ? loadedPlans.findIndex((plan) => sameChatGptFocusPlan(plan, candidate)) : -1
        if (restoredIndex >= 0) {
          const restored = loadedPlans[restoredIndex]
          await app.updateModelContext({ structuredContent: restored })
          if (!mounted) return
          sharedRef.current = true
          setSelectedIndex(restoredIndex)
          setShared(true)
          setMessage(labels.contextReady)
        }
      } catch {
        if (!mounted) return
        try {
          await app.updateModelContext({ content: [] })
        } catch {
          // The host may be closing the app; no personal values are logged or retained here.
        }
        setState('auth')
      } finally {
        if (mounted) setBusy(false)
      }
    }

    void loadPlans()
    return () => {
      mounted = false
      app.removeEventListener('hostcontextchanged', onHostContextChanged)
    }
  }, [app, labels.contextCleared, labels.contextReady])

  const shareSelection = async () => {
    if (!selectedPlan || busy) return
    setBusy(true)
    setMessage('')
    try {
      const result = await app.callServerTool({ name: 'liquidhr.focus.development-plans.read', arguments: {} })
      const resultError = errorTextFromResult(result)
      const currentPlans = projectFromResult(result)
      if (resultError || !currentPlans || !currentPlans.some((plan) => sameChatGptFocusPlan(plan, selectedPlan))) {
        await app.updateModelContext({ content: [] })
        setSelectedIndex(null)
        setShared(false)
        setState(resultError ?? 'auth')
        return
      }
      // The widget sends only the schema-approved five-field record for this user-selected row.
      await app.updateModelContext({ structuredContent: projectSelectedChatGptFocusPlan(selectedPlan) })
      sharedRef.current = true
      setShared(true)
      setMessage(labels.contextReady)
    } catch {
      try {
        await app.updateModelContext({ content: [] })
      } catch {
        // Context clear is best-effort if the host connection has already closed.
      }
      sharedRef.current = false
      setSelectedIndex(null)
      setShared(false)
      setState('auth')
    } finally {
      setBusy(false)
    }
  }

  const clearSelection = async () => {
    setBusy(true)
    sharedRef.current = false
    try {
      await app.updateModelContext({ content: [] })
      setSelectedIndex(null)
      setShared(false)
      setMessage(labels.contextCleared)
    } catch {
      setMessage(labels.error)
    } finally {
      setBusy(false)
    }
  }

  const choosePlan = async (index: number) => {
    sharedRef.current = false
    setSelectedIndex(index)
    setShared(false)
    setMessage('')
    try {
      await app.updateModelContext({ content: [] })
    } catch {
      setSelectedIndex(null)
      setMessage(labels.error)
    }
  }

  const loadAgain = async () => {
    setState('loading')
    setBusy(true)
    sharedRef.current = false
    setSelectedIndex(null)
    setShared(false)
    setMessage('')
    try {
      await app.updateModelContext({ content: [] })
      const result = await app.callServerTool({ name: 'liquidhr.focus.development-plans.read', arguments: {} })
      const resultError = errorTextFromResult(result)
      const loadedPlans = projectFromResult(result)
      if (resultError || !loadedPlans) {
        setState(resultError ?? 'error')
        return
      }
      setPlans(loadedPlans)
      setState('ready')
      setMessage('')
    } catch {
      setState('auth')
      setPlans([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mcp-focus-widget mx-auto w-full max-w-3xl p-3 sm:p-5">
      <Surface className="space-y-5 p-4 sm:p-6">
        <SectionHeader
          title={labels.title}
          description={labels.description}
          actions={<button className={buttonClasses({ variant: 'secondary', size: 'sm' })} disabled={busy} onClick={() => void loadAgain()} type="button">{labels.refresh}</button>}
        />

        {state === 'loading' ? <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{labels.loading}</p> : null}
        {state === 'auth' ? <p aria-live="polite" className="rounded-[var(--radius-control)] border border-warning bg-warning-surface p-3 text-sm text-warning" role="alert">{labels.authRequired}</p> : null}
        {state === 'error' ? <p aria-live="polite" className="rounded-[var(--radius-control)] border border-destructive bg-destructive-surface p-3 text-sm text-destructive" role="alert">{labels.error}</p> : null}
        {state === 'ready' && plans.length === 0 ? <p className="text-sm text-muted-foreground">{labels.noPlans}</p> : null}

        {state === 'ready' && plans.length > 0 ? (
          <fieldset aria-describedby="focus-plan-hint" className="grid gap-3">
            <legend className="sr-only">{labels.choosePlan}</legend>
            <p className="text-sm text-muted-foreground" id="focus-plan-hint">{labels.choosePlan}</p>
            {plans.map((plan, index) => {
              const isSelected = selectedIndex === index
              const statusTone = plan.status === 'COMPLETED' ? 'success' : plan.status === 'CANCELLED' || plan.status === 'ARCHIVED' ? 'neutral' : plan.status === 'ACTIVE' ? 'info' : 'warning'
              return (
                <label className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-3" key={index}>
                  <input checked={isSelected} className="peer sr-only" name="selected-development-plan" onChange={() => void choosePlan(index)} type="radio" />
                  <span aria-hidden="true" className="mt-4 size-4 rounded-full border border-border-subtle bg-surface peer-checked:border-[0.3rem] peer-checked:border-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus" />
                  <Surface className="min-w-0 space-y-3 p-4" data-selected={isSelected || undefined} variant="subtle">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold">{labels.plan}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{formatDate(plan.periodStart, locale)} – {formatDate(plan.periodEnd, locale)}</p>
                      </div>
                      <Badge tone={statusTone}>{statusLabels[plan.status]}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap justify-between gap-2 text-sm">
                        <span>{labels.progress}</span>
                        <span className="font-medium tabular-nums">{plan.progressPercent}%</span>
                      </div>
                      <progress aria-label={`${labels.progress}: ${plan.progressPercent}%`} className="block h-2 w-full accent-primary" max={100} value={plan.progressPercent} />
                    </div>
                    {plan.completedAt ? <p className="text-xs text-muted-foreground">{labels.completedAt}: {formatDate(plan.completedAt, locale)}</p> : null}
                  </Surface>
                </label>
              )
            })}
          </fieldset>
        ) : null}

        {message ? <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{message}</p> : null}
        {state === 'ready' && plans.length > 0 ? (
          <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
            <button className={buttonClasses()} disabled={!selectedPlan || busy} onClick={() => void shareSelection()} type="button">{busy ? labels.working : labels.share}</button>
            {shared ? <button className={buttonClasses({ variant: 'secondary' })} disabled={busy} onClick={() => void clearSelection()} type="button">{labels.clear}</button> : null}
          </div>
        ) : null}
      </Surface>
    </main>
  )
}
