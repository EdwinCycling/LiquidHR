import { Brain, Check, Clock3, X } from 'lucide-react'

export interface HeRaDraftView {
  id: string
  version: number
  expiresAt: string
  summary: string
  controlPayload: unknown
}

export interface HeRaMemoryProposalView {
  operation: 'CREATE'
  category: 'PREFERENCE'
  content: string
}

interface ControlLabels {
  confirmAction: string
  cancelAction: string
  draftExpiresAt: string
  rememberProposal: string
  remember: string
  currentValue: string
  newValue: string
}

function actionValues(payload: unknown): { oldValue: unknown; newValue: unknown } | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const record = payload as Record<string, unknown>
  if (!('newValue' in record)) return null
  return { oldValue: record.oldValue, newValue: record.newValue }
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value, null, 2)
}

interface HeRaControlCardProps {
  draft?: HeRaDraftView | null
  memoryProposal?: HeRaMemoryProposalView | null
  labels: ControlLabels
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function HeRaControlCard({
  draft,
  memoryProposal,
  labels,
  busy = false,
  onConfirm,
  onCancel,
}: HeRaControlCardProps) {
  if (!draft && !memoryProposal) return null
  const isMemory = Boolean(memoryProposal)
  const values = draft ? actionValues(draft.controlPayload) : null
  return (
    <section className="mx-auto mt-5 max-w-3xl rounded-2xl border border-warning/30 bg-warning-surface/70 p-4 shadow-sm" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-warning">{isMemory ? <Brain aria-hidden="true" size={17} /> : <Clock3 aria-hidden="true" size={17} />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{isMemory ? labels.rememberProposal : labels.confirmAction}</p>
          <p className="mt-1 text-sm leading-6 text-foreground">{memoryProposal?.content ?? draft?.summary}</p>
          {values ? <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-xl border bg-surface p-3"><p className="text-xs font-semibold text-muted-foreground">{labels.currentValue}</p><pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs text-foreground">{displayValue(values.oldValue)}</pre></div><div className="rounded-xl border border-warning/30 bg-surface p-3"><p className="text-xs font-semibold text-muted-foreground">{labels.newValue}</p><pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs text-foreground">{displayValue(values.newValue)}</pre></div></div> : null}
          {draft ? <p className="mt-2 text-xs text-muted-foreground">{labels.draftExpiresAt}: {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(draft.expiresAt))}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="button-primary gap-2" disabled={busy} onClick={onConfirm} type="button"><Check aria-hidden="true" size={15} />{isMemory ? labels.remember : labels.confirmAction}</button>
            <button className="button-secondary gap-2" disabled={busy} onClick={onCancel} type="button"><X aria-hidden="true" size={15} />{labels.cancelAction}</button>
          </div>
        </div>
      </div>
    </section>
  )
}
