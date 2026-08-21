'use client'

import type { FormEventHandler, ReactNode } from 'react'
import { useId, useState } from 'react'
import { Drawer } from '@/components/ui/drawer'
import { ConfirmDialog } from './confirm-dialog'
import { FormActions, type FormActionsDestructiveAction } from './form-actions'

export type FormDrawerDirtyProtection = {
  title: string
  description?: string
  discardLabel: string
  keepEditingLabel: string
}

export type FormDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  closeLabel: string
  cancelLabel: string
  saveLabel: string
  children: ReactNode
  onSubmit: FormEventHandler<HTMLFormElement>
  saving?: boolean
  disabled?: boolean
  dirty?: boolean
  dirtyProtection: FormDrawerDirtyProtection
  onDiscard?: () => void
  destructiveAction?: FormActionsDestructiveAction
  formId?: string
}

export function FormDrawer({ cancelLabel, children, closeLabel, description, dirty = false, dirtyProtection, disabled = false, destructiveAction, formId: providedFormId, onDiscard, onOpenChange, onSubmit, open, saveLabel, saving = false, title }: FormDrawerProps) {
  const generatedId = useId()
  const formId = providedFormId ?? `form-drawer-${generatedId.replaceAll(':', '')}`
  const [confirmOpen, setConfirmOpen] = useState(false)

  function requestClose(): void {
    if (saving) return
    if (dirty) {
      setConfirmOpen(true)
      return
    }
    onOpenChange(false)
  }

  function discardChanges(): void {
    setConfirmOpen(false)
    onDiscard?.()
    onOpenChange(false)
  }

  return (
    <>
      <Drawer
        closeLabel={closeLabel}
        onOpenChange={(nextOpen) => { if (nextOpen) onOpenChange(true); else requestClose() }}
        open={open}
        title={title}
        description={description}
        footer={<FormActions cancelLabel={cancelLabel} destructiveAction={destructiveAction} disabled={disabled} form={formId} onCancel={requestClose} saveLabel={saveLabel} saving={saving} />}
      >
        <form className="grid gap-4" id={formId} onSubmit={onSubmit}>
          {children}
        </form>
      </Drawer>
      <ConfirmDialog
        cancelLabel={dirtyProtection.keepEditingLabel}
        confirmLabel={dirtyProtection.discardLabel}
        description={dirtyProtection.description}
        destructive
        onConfirm={discardChanges}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={dirtyProtection.title}
      />
    </>
  )
}
