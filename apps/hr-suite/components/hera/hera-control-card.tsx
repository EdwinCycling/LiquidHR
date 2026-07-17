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
  return (
    <section className="mx-auto mt-5 max-w-3xl rounded-2xl border border-warning/30 bg-warning-surface/70 p-4 shadow-sm" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-warning">{isMemory ? <Brain aria-hidden="true" size={17} /> : <Clock3 aria-hidden="true" size={17} />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{isMemory ? labels.rememberProposal : labels.confirmAction}</p>
          <p className="mt-1 text-sm leading-6 text-foreground">{memoryProposal?.content ?? draft?.summary}</p>
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
