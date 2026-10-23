'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n/config'
import type { StartableProcess } from '@/lib/process-automation/start-catalog-service'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { withProcessWorkReturnContext, type ProcessWorkReturnContext } from '@/lib/process-automation/work-routing'

export interface ProcessStartCatalogLabels {
  readonly title: string
  readonly description: string
  readonly steps: string
  readonly routes: string
  readonly responsible: string
  readonly startStep: string
  readonly start: string
  readonly starting: string
  readonly empty: string
  readonly loadError: string
  readonly startFailed: string
  readonly startDenied: string
  readonly startUnavailable: string
  readonly calendarBlocked: string
}

interface ProcessStartCatalogProps {
  readonly locale: Locale
  readonly labels: ProcessStartCatalogLabels
  readonly processes: readonly StartableProcess[]
  readonly loadError?: boolean
  readonly returnContext?: ProcessWorkReturnContext
}

export function processStartErrorLabel(code: string | undefined, labels: ProcessStartCatalogLabels): string {
  if (code === 'FORBIDDEN' || code === 'FORBIDDEN_ACTION' || code === 'ACTOR_EMPLOYEE_NOT_FOUND' || code === 'AUTHENTICATION_REQUIRED') return labels.startDenied
  if (code === 'SLA_WORKDAY_CALENDAR_REQUIRED') return labels.calendarBlocked
  if (code === 'PROCESS_DEFINITION_NOT_PUBLISHED' || code === 'PROCESS_VERSION_NOT_FOUND' || code === 'NO_ASSIGNEE' || code === 'AMBIGUOUS_ASSIGNEE' || code === 'SUBJECT_EMPLOYEE_NOT_FOUND' || code === 'SUBJECT_EMPLOYMENT_NOT_FOUND') return labels.startUnavailable
  return labels.startFailed
}

function localizedProcessText(value: Readonly<Record<string, string>> | null, locale: 'nl' | 'en'): string {
  if (!value) return ''
  return value[locale]?.trim() || value[locale === 'nl' ? 'en' : 'nl']?.trim() || ''
}

export function ProcessStartCatalog({ locale, labels, processes, loadError = false, returnContext }: ProcessStartCatalogProps) {
  const router = useRouter()
  const idempotencyKeys = useRef<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ readonly processId: string; readonly message: string } | null>(null)

  async function start(process: StartableProcess): Promise<void> {
    if (busyId) return
    const idempotencyKey = idempotencyKeys.current[process.processDefinitionId] ?? globalThis.crypto.randomUUID()
    idempotencyKeys.current[process.processDefinitionId] = idempotencyKey
    setBusyId(process.processDefinitionId)
    setFeedback(null)
    try {
      const response = await fetch('/api/processes/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ processDefinitionId: process.processDefinitionId, idempotencyKey }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const code = typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string' ? body.code : undefined
        setFeedback({ processId: process.processDefinitionId, message: processStartErrorLabel(code, labels) })
        return
      }
      const nextHref = typeof body === 'object' && body !== null && 'nextHref' in body && typeof body.nextHref === 'string' ? body.nextHref : '/work?view=REQUESTS'
      router.push(withProcessWorkReturnContext(nextHref, returnContext))
      router.refresh()
    } catch {
      setFeedback({ processId: process.processDefinitionId, message: labels.startFailed })
    } finally {
      setBusyId(null)
    }
  }

  return <section aria-labelledby="process-start-catalog-title" className="mt-6">
    <header className="mb-4">
      <h2 className="text-xl font-semibold text-foreground" id="process-start-catalog-title">{labels.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{labels.description}</p>
    </header>
    {loadError ? <Surface className="p-4 text-sm text-destructive" role="alert">{labels.loadError}</Surface> : null}
    {!loadError && processes.length === 0 ? <Surface className="p-4 text-sm text-muted-foreground" role="status">{labels.empty}</Surface> : null}
    {!loadError && processes.length > 0 ? <ul className="grid gap-4">
      {processes.map((process) => {
        const title = localizedProcessText(process.title, locale)
        const description = localizedProcessText(process.description, locale)
        const feedbackMessage = feedback?.processId === process.processDefinitionId ? feedback.message : null
        return <li key={process.processDefinitionId}>
          <Surface className="p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
                {process.steps.length > 0 ? <div className="mt-4">
                  <h4 className="text-sm font-semibold">{labels.steps}</h4>
                  <ol className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {process.steps.map((step, index) => <li className="flex min-w-0 items-start gap-3 rounded-[var(--radius-control)] border border-border bg-surface-subtle p-3" key={`${index}-${localizedProcessText(step.title, locale)}`}>
                      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                      <span className="min-w-0 text-sm"><span className="block font-medium">{localizedProcessText(step.title, locale)}</span>{step.isStart ? <span className="mt-1 block text-xs text-muted-foreground">{labels.startStep}</span> : null}{step.responsibleRole ? <span className="mt-1 block text-xs text-muted-foreground">{labels.responsible}: {localizedProcessText(step.responsibleRole, locale)}</span> : null}</span>
                    </li>)}
                  </ol>
                </div> : null}
                {process.routes.length > 0 ? <div className="mt-4">
                  <h4 className="text-sm font-semibold">{labels.routes}</h4>
                  <ul className="mt-2 grid gap-2 text-sm">
                    {process.routes.map((route, index) => <li className="rounded-[var(--radius-control)] border border-border px-3 py-2" key={`${index}-${localizedProcessText(route.label, locale)}`}>
                      <span className="font-medium">{localizedProcessText(route.fromTitle, locale)}</span>
                      <span className="mx-2 text-muted-foreground">· {localizedProcessText(route.label, locale)} →</span>
                      <span className="font-medium">{localizedProcessText(route.toTitle, locale)}</span>
                    </li>)}
                  </ul>
                </div> : null}
                {feedbackMessage ? <p aria-live="polite" className="mt-3 text-sm font-medium text-destructive" role="alert">{feedbackMessage}</p> : null}
              </div>
              <Button className="w-full lg:w-auto" disabled={busyId !== null} loading={busyId === process.processDefinitionId} onClick={() => { void start(process) }} type="button" variant="secondary">{busyId === process.processDefinitionId ? labels.starting : labels.start}</Button>
            </div>
          </Surface>
        </li>
      })}
    </ul> : null}
  </section>
}
