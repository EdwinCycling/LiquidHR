import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'

type FormFieldControlProps = {
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'false' | 'true'
  'aria-required'?: boolean | 'false' | 'true'
  id?: string
}

export type FormFieldProps = {
  className?: string
  control: ReactElement<FormFieldControlProps>
  description?: ReactNode
  error?: ReactNode
  label: ReactNode
  required?: boolean
}

export function FormField({ className, control, description, error, label, required = false }: FormFieldProps) {
  const generatedId = useId()
  const existingProps = control.props
  const controlId = existingProps.id ?? generatedId
  const descriptionId = description ? `${controlId}-description` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [existingProps['aria-describedby'], descriptionId, errorId].filter(Boolean).join(' ') || undefined
  const enhancedControl = cloneElement(control, {
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : existingProps['aria-invalid'],
    'aria-required': required ? true : existingProps['aria-required'],
    id: controlId,
  } satisfies FormFieldControlProps)

  return (
    <div className={`grid gap-1.5 text-sm ${className ?? ''}`.trim()}>
      <label className="font-medium text-foreground" htmlFor={controlId}>
        {label}{required ? <span aria-hidden="true" className="ml-1 text-destructive">*</span> : null}
      </label>
      {enhancedControl}
      {description ? <p className="text-xs text-muted-foreground" id={descriptionId}>{description}</p> : null}
      {error ? <p className="text-xs text-destructive" id={errorId} role="alert">{error}</p> : null}
    </div>
  )
}
