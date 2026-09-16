'use client'

import { BookOpen, Check, Copy, RefreshCw, Sparkles, X } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { AiProgress } from '@/components/patterns/ai-progress'

export type AiLogbookStatus = 'idle' | 'saving' | 'saved' | 'failed'

export interface AiResultSurfaceLabels {
  readonly reviewTitle: string
  readonly working: string
  readonly apply?: string
  readonly cancel: string
  readonly copy?: string
  readonly copied?: string
  readonly retry?: string
  readonly saveToLogbook?: string
  readonly savingToLogbook?: string
  readonly savedToLogbook?: string
  readonly saveToLogbookFailed?: string
}

export function AiResultSurface({ error, labels, logbookStatus, onApply, onCancel, onRetry, onSaveToLogbook, state, text }: {
  readonly error?: string | null
  readonly labels: AiResultSurfaceLabels
  readonly onApply?: () => void
  readonly onCancel: () => void
  readonly onRetry?: () => void
  readonly onSaveToLogbook?: () => void | Promise<void>
  readonly logbookStatus?: AiLogbookStatus
  readonly state: 'loading' | 'error' | 'success'
  readonly text?: string
}): ReactElement {
  const [copied, setCopied] = useState(false)
  const currentLogbookStatus = logbookStatus ?? 'idle'

  async function copy(): Promise<void> {
    if (!text || !navigator.clipboard) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  if (state === 'loading') return <AiProgress label={labels.working} />
  if (state === 'error') return <Surface className="flex flex-wrap items-center justify-between gap-3 border-destructive/40 bg-destructive-surface p-4 text-sm text-destructive" role="alert"><span>{error}</span><span className="flex flex-wrap gap-2">{onRetry && labels.retry ? <Button onClick={onRetry} size="sm" type="button" variant="secondary"><RefreshCw aria-hidden="true" />{labels.retry}</Button> : null}<Button onClick={onCancel} size="sm" type="button" variant="ghost"><X aria-hidden="true" />{labels.cancel}</Button></span></Surface>

  return <Surface className="grid gap-3 p-4" variant="subtle">
    <div className="flex items-center gap-2"><Sparkles aria-hidden="true" className="size-4 text-primary" /><p className="font-medium text-foreground">{labels.reviewTitle}</p></div>
    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{text}</p>
    <div className="flex flex-wrap gap-2">
      {onApply && labels.apply ? <Button onClick={onApply} size="sm" type="button"><Check aria-hidden="true" />{labels.apply}</Button> : null}
      {labels.copy ? <Button onClick={() => void copy()} size="sm" type="button" variant="secondary"><Copy aria-hidden="true" />{copied && labels.copied ? labels.copied : labels.copy}</Button> : null}
      {onSaveToLogbook && labels.saveToLogbook ? <Button disabled={currentLogbookStatus === 'saving' || currentLogbookStatus === 'saved'} onClick={() => { void onSaveToLogbook() }} size="sm" type="button" variant="secondary">
        {currentLogbookStatus === 'saved' ? <Check aria-hidden="true" /> : <BookOpen aria-hidden="true" />}
        {currentLogbookStatus === 'saving' && labels.savingToLogbook ? labels.savingToLogbook : currentLogbookStatus === 'saved' && labels.savedToLogbook ? labels.savedToLogbook : labels.saveToLogbook}
      </Button> : null}
      <Button onClick={onCancel} size="sm" type="button" variant="ghost"><X aria-hidden="true" />{labels.cancel}</Button>
    </div>
    {currentLogbookStatus === 'failed' && labels.saveToLogbookFailed ? <p className="text-sm text-destructive" role="alert">{labels.saveToLogbookFailed}</p> : null}
  </Surface>
}
