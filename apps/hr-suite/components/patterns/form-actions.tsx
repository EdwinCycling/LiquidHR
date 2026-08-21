import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export type FormActionsDestructiveAction = {
  label: string
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}

export type FormActionsProps = {
  cancelLabel: string
  saveLabel: string
  onCancel: () => void
  saving?: boolean
  disabled?: boolean
  form?: string
  destructiveAction?: FormActionsDestructiveAction
  leading?: ReactNode
  sticky?: boolean
  className?: string
}

export function FormActions({ cancelLabel, className, destructiveAction, disabled = false, form, leading, onCancel, saveLabel, saving = false, sticky = false }: FormActionsProps) {
  return (
    <div className={`${sticky ? 'sticky bottom-0 z-10 border-t border-border-subtle bg-surface px-4 py-3' : ''} flex flex-wrap items-center justify-between gap-3 ${className ?? ''}`.trim()}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {destructiveAction ? <Button disabled={disabled || saving || destructiveAction.disabled} form={form} loading={destructiveAction.loading} onClick={destructiveAction.onClick} size="sm" type="button" variant="danger">{destructiveAction.label}</Button> : null}
        {leading}
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <Button disabled={disabled || saving} onClick={onCancel} size="sm" type="button" variant="secondary">{cancelLabel}</Button>
        <Button disabled={disabled} form={form} loading={saving} size="sm" type="submit">{saveLabel}</Button>
      </div>
    </div>
  )
}
