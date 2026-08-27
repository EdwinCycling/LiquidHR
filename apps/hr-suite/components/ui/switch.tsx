'use client'

import { useId, useState, type ChangeEventHandler, type InputHTMLAttributes, type ReactNode } from 'react'

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  description?: ReactNode
  label?: ReactNode
  onCheckedChange?: (checked: boolean) => void
}

export function Switch({ checked, className, defaultChecked = false, description, disabled, id, label, onChange, onCheckedChange, ...props }: SwitchProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionId = description ? `${inputId}-description` : undefined
  const describedBy = [props['aria-describedby'], descriptionId].filter(Boolean).join(' ') || undefined
  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked)
  const currentChecked = checked ?? uncontrolledChecked

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (checked === undefined) setUncontrolledChecked(event.target.checked)
    onChange?.(event)
    onCheckedChange?.(event.target.checked)
  }

  const control = (
    <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
      <input
        {...props}
        aria-checked={currentChecked}
        aria-describedby={describedBy}
        checked={currentChecked}
        className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0"
        disabled={disabled}
        id={inputId}
        onChange={handleChange}
        role="switch"
        type="checkbox"
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-disabled:opacity-60 peer-focus-visible:ring-2 peer-focus-visible:ring-focus/50 after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-surface after:transition-transform peer-checked:after:translate-x-5" />
    </span>
  )

  if (!label) return <span className={className}>{control}</span>

  return (
    <label className={`flex cursor-pointer items-start gap-3 text-sm text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 ${className ?? ''}`.trim()} htmlFor={inputId}>
      {control}
      <span className="min-w-0 pt-0.5">
        <span className="font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground" id={descriptionId}>{description}</span> : null}
      </span>
    </label>
  )
}
