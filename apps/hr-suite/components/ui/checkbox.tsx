import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  description?: ReactNode
  label?: ReactNode
}

export function Checkbox({ className, description, id, label, ...props }: CheckboxProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionId = description ? `${inputId}-description` : undefined
  const describedBy = [props['aria-describedby'], descriptionId].filter(Boolean).join(' ') || undefined
  const input = <input {...props} aria-describedby={describedBy} className={`mt-0.5 size-4 shrink-0 accent-primary ${className ?? ''}`.trim()} id={inputId} type="checkbox" />

  if (!label) return input

  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60" htmlFor={inputId}>
      {input}
      <span className="min-w-0">
        <span className="font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground" id={descriptionId}>{description}</span> : null}
      </span>
    </label>
  )
}
