'use client'

import { Sparkles } from 'lucide-react'
import { useRef, useState, type ReactElement } from 'react'
import { AiResultSurface } from '@/components/patterns/ai-result-surface'
import { Button } from '@/components/ui/button'

export interface GoalSmartActionLabels {
  readonly action: string
  readonly working: string
  readonly reviewTitle: string
  readonly apply: string
  readonly cancel: string
  readonly copy: string
  readonly copied: string
  readonly retry: string
  readonly failed: string
}

export function TalentGoalSmartAction({ employeeId, goalId, labels, locale, onApply, sourceText }: {
  readonly employeeId?: string
  readonly goalId?: string | null
  readonly labels: GoalSmartActionLabels
  readonly locale: 'nl' | 'en'
  readonly onApply: (text: string) => void
  readonly sourceText: string
}): ReactElement {
  const [pending, setPending] = useState(false)
  const [proposal, setProposal] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)

  function requestKey(): string {
    return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `goal-smart-${Date.now()}`
  }

  async function run(): Promise<void> {
    if (pending || !sourceText.trim()) return
    const currentGeneration = generation.current + 1
    generation.current = currentGeneration
    setPending(true)
    setProposal(null)
    setError(null)
    const body = { ...(goalId ? { goalId } : employeeId ? { employeeId } : {}), sourceText: sourceText.trim(), locale }
    try {
      const response = await fetch('/api/talent/goals/smart', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-idempotency-key': requestKey() },
        body: JSON.stringify(body),
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

  function close(): void {
    generation.current += 1
    setPending(false)
    setProposal(null)
    setError(null)
  }

  function apply(): void {
    if (proposal) onApply(proposal)
    close()
  }

  const state = pending ? 'loading' : error ? 'error' : proposal ? 'success' : null
  return <div className="space-y-3">
    <Button disabled={pending || !sourceText.trim()} onClick={() => void run()} size="sm" type="button" variant="secondary"><Sparkles aria-hidden="true" />{labels.action}</Button>
    {state ? <AiResultSurface error={error} labels={{ reviewTitle: labels.reviewTitle, working: labels.working, apply: labels.apply, cancel: labels.cancel, copy: labels.copy, copied: labels.copied, retry: labels.retry }} onApply={apply} onCancel={close} onRetry={() => void run()} state={state} text={proposal ?? undefined} /> : null}
  </div>
}
