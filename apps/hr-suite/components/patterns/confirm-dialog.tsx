'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

export type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void | Promise<void>
  destructive?: boolean
  pending?: boolean
}

export function ConfirmDialog({ cancelLabel, confirmLabel, destructive = false, description, onConfirm, onOpenChange, open, pending = false, title }: ConfirmDialogProps) {
  const [internalPending, setInternalPending] = useState(false)
  const isPending = pending || internalPending

  async function handleConfirm(): Promise<void> {
    if (isPending) return
    setInternalPending(true)
    try {
      await onConfirm()
    } finally {
      setInternalPending(false)
    }
  }

  return (
    <Dialog onOpenChange={(nextOpen) => { if (!isPending) onOpenChange(nextOpen) }} open={open} title={title} description={description}>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button disabled={isPending} onClick={() => onOpenChange(false)} size="sm" type="button" variant="secondary">{cancelLabel}</Button>
        <Button loading={isPending} onClick={() => void handleConfirm()} size="sm" type="button" variant={destructive ? 'danger' : 'primary'}>{confirmLabel}</Button>
      </div>
    </Dialog>
  )
}
