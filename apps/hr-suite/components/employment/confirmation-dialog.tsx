'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'

interface ConfirmationDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  busy?: boolean
  warning?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

export function ConfirmationDialog(props: ConfirmationDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const { open, onCancel } = props
  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel() }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [open, onCancel])
  if (!props.open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4" role="presentation" onMouseDown={props.onCancel}>
      <section aria-modal="true" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-description"
        className="w-full max-w-lg rounded-[var(--radius-overlay)] border border-subtle bg-surface-overlay p-6 shadow-lg" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start gap-4">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-control)] ${props.warning ? 'bg-warning-surface text-warning' : 'bg-accent text-accent-foreground'}`}>
            <AlertTriangle aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="text-xl font-semibold">{props.title}</h2>
            <p id="confirm-description" className="mt-2 text-sm leading-6 text-muted-foreground">{props.description}</p>
            {props.children}
          </div>
          <button type="button" aria-label={props.cancelLabel} onClick={props.onCancel} className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'min-h-8 w-8 p-0' })}>
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button ref={cancelRef} type="button" className={buttonClasses({ variant: 'secondary' })} onClick={props.onCancel}>{props.cancelLabel}</button>
          <button type="button" className={buttonClasses({ variant: props.warning ? 'danger' : 'primary' })} disabled={props.busy} onClick={props.onConfirm}>{props.confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
