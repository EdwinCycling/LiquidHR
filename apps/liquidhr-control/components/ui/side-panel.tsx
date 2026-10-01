'use client'

import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from './button'

export type SidePanelProps = {
  children: ReactNode
  closeLabel: string
  description: string
  footer: ReactNode
  onClose: () => void
  title: string
}

export function SidePanel({ children, closeLabel, description, footer, onClose, title }: SidePanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    onClose()
  }

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-foreground backdrop:bg-foreground/20"
      onCancel={handleCancel}
      ref={dialogRef}
    >
      <div className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-border bg-surface shadow-lg">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold" id={titleId}>{title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground" id={descriptionId}>{description}</p>
          </div>
          <Button aria-label={closeLabel} className="shrink-0" onClick={onClose} type="button" variant="secondary">
            <X aria-hidden="true" size={17} />
          </Button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6">{children}</main>
        <footer className="flex flex-wrap justify-end gap-3 border-t border-border px-5 py-4 sm:px-6">{footer}</footer>
      </div>
    </dialog>
  )
}