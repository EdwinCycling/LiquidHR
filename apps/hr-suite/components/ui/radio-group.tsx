'use client'

import { useId, useState, type ChangeEventHandler, type FieldsetHTMLAttributes, type ReactNode } from 'react'

export type RadioOption = {
  description?: ReactNode
  disabled?: boolean
  label: ReactNode
  value: string
}

export type RadioGroupProps = Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'defaultValue' | 'onChange' | 'value'> & {
  defaultValue?: string
  legend?: ReactNode
  name: string
  onChange?: ChangeEventHandler<HTMLInputElement>
  onValueChange?: (value: string) => void
  options: readonly RadioOption[]
  required?: boolean
  value?: string
}

export function RadioGroup({ className, defaultValue, disabled = false, legend, name, onChange, onValueChange, options, required = false, value, ...props }: RadioGroupProps) {
  const groupId = useId()
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)
  const currentValue = value ?? uncontrolledValue

  return (
    <fieldset {...props} className={`grid gap-2 ${className ?? ''}`.trim()} disabled={disabled}>
      {legend ? <legend className="mb-1 text-sm font-medium text-foreground">{legend}</legend> : null}
      {options.map((option, index) => {
        const optionId = `${groupId}-${index}`
        const descriptionId = option.description ? `${optionId}-description` : undefined
        return (
          <label className="flex cursor-pointer items-start gap-3 py-1 text-sm text-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60" htmlFor={optionId} key={option.value}>
            <input
              aria-describedby={descriptionId}
              checked={currentValue === option.value}
              className="mt-0.5 size-4 shrink-0 accent-primary"
              disabled={disabled || option.disabled}
              id={optionId}
              name={name}
              onChange={(event) => {
                if (value === undefined) setUncontrolledValue(event.target.value)
                onChange?.(event)
                if (event.target.checked) onValueChange?.(event.target.value)
              }}
              required={required}
              type="radio"
              value={option.value}
            />
            <span className="min-w-0">
              <span className="font-medium">{option.label}</span>
              {option.description ? <span className="mt-0.5 block text-xs font-normal text-muted-foreground" id={descriptionId}>{option.description}</span> : null}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
