'use client'

import { MessageSquareText, Sparkles, UserRoundSearch } from 'lucide-react'
import { useRef, useState, type ReactElement } from 'react'
import { AiResultSurface, type AiLogbookStatus } from '@/components/patterns/ai-result-surface'
import { SectionHeader } from '@/components/patterns/section-header'
import { Button } from '@/components/ui/button'

type EmployeeAiAction = 'summary' | 'conversation'

export interface EmployeeAiActionLabels {
  readonly title: string
  readonly description: string
  readonly summary: string
  readonly conversation: string
  readonly working: string
  readonly reviewTitle: string
  readonly cancel: string
  readonly copy: string
  readonly copied: string
  readonly retry: string
  readonly failed: string
  readonly saveToLogbook: string
  readonly savingToLogbook: string
  readonly savedToLogbook: string
  readonly saveToLogbookFailed: string
}

export function EmployeeAiActions({ employeeId, labels, locale, embedded = false }: { readonly employeeId: string; readonly labels: EmployeeAiActionLabels; readonly locale: string; readonly embedded?: boolean }): ReactElement {
  const [active, setActive] = useState<EmployeeAiAction | null>(null)
  const [pending, setPending] = useState(false)
  const [proposal, setProposal] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logbookStatus, setLogbookStatus] = useState<AiLogbookStatus>('idle')
  const generation = useRef(0)

  function requestKey(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `employee-ai-${Date.now()}`
  }

  async function run(action: EmployeeAiAction): Promise<void> {
    const currentGeneration = generation.current + 1
    generation.current = currentGeneration
    setActive(action)
    setPending(true)
    setProposal(null)
    setError(null)
    setLogbookStatus('idle')
    try {
      const response = await fetch(`/api/employees/${employeeId}/ai/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': requestKey() },
        body: JSON.stringify({ locale: locale === 'en' ? 'en' : 'nl' }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok || typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('AI_EVERYWHERE_FAILED')
      const data = (payload as { data?: unknown }).data
      if (typeof data !== 'object' || data === null || Array.isArray(data) || typeof (data as { proposedText?: unknown }).proposedText !== 'string') throw new Error('AI_EVERYWHERE_FAILED')
      if (generation.current === currentGeneration) setProposal((data as { proposedText: string }).proposedText)
    } catch {
      if (generation.current === currentGeneration) setError(labels.failed)
    } finally {
      if (generation.current === currentGeneration) setPending(false)
    }
  }

  async function saveToLogbook(): Promise<void> {
    if (!active || !proposal || logbookStatus === 'saving' || logbookStatus === 'saved') return
    const currentGeneration = generation.current
    setLogbookStatus('saving')
    try {
      const response = await fetch('/api/logbook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: active === 'summary' ? labels.summary : labels.conversation,
          description: proposal,
        }),
      })
      if (!response.ok) throw new Error('PERSONAL_LOGBOOK_SAVE_FAILED')
      if (generation.current === currentGeneration) setLogbookStatus('saved')
    } catch {
      if (generation.current === currentGeneration) setLogbookStatus('failed')
    }
  }

  function close(): void {
    generation.current += 1
    setPending(false)
    setProposal(null)
    setError(null)
    setActive(null)
    setLogbookStatus('idle')
  }

  const state = pending ? 'loading' : error ? 'error' : proposal ? 'success' : null
  return <section className={embedded ? 'space-y-4' : 'mt-8 space-y-4'} aria-label={embedded ? labels.title : undefined} aria-labelledby={embedded ? undefined : 'employee-ai-title'}>
    {!embedded ? <SectionHeader description={labels.description} title={<span className="flex items-center gap-2" id="employee-ai-title"><Sparkles aria-hidden="true" className="size-4 text-primary" />{labels.title}</span>} /> : null}
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} onClick={() => void run('summary')} size="sm" type="button" variant="secondary"><UserRoundSearch aria-hidden="true" />{labels.summary}</Button>
      <Button disabled={pending} onClick={() => void run('conversation')} size="sm" type="button" variant="secondary"><MessageSquareText aria-hidden="true" />{labels.conversation}</Button>
    </div>
    {state ? <AiResultSurface error={error} labels={{ reviewTitle: labels.reviewTitle, working: labels.working, cancel: labels.cancel, copy: labels.copy, copied: labels.copied, retry: labels.retry, saveToLogbook: labels.saveToLogbook, savingToLogbook: labels.savingToLogbook, savedToLogbook: labels.savedToLogbook, saveToLogbookFailed: labels.saveToLogbookFailed }} logbookStatus={logbookStatus} onCancel={close} onRetry={active ? () => void run(active) : undefined} onSaveToLogbook={proposal ? saveToLogbook : undefined} state={state} text={proposal ?? undefined} /> : null}
  </section>
}
