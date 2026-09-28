'use client'

import { Children, isValidElement, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

type OptionProps = { value?: string; disabled?: boolean; children?: ReactNode }
type Option = { value: string; label: ReactNode; searchLabel: string; disabled: boolean }

type DropdownSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'multiple' | 'onChange' | 'value'> & {
  children: ReactNode
  defaultValue?: string
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void
  placeholder?: string
  searchable?: boolean
  searchPlaceholder?: string
  value?: string
}

function optionText(value: ReactNode, fallback: string): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
}

function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionProps>(child) || child.type !== 'option') return []
    const value = typeof child.props.value === 'string' ? child.props.value : ''
    const label = child.props.children ?? value
    return [{ value, label, searchLabel: optionText(label, value), disabled: Boolean(child.props.disabled) }]
  })
}

export function DropdownSelect({
  children,
  className,
  defaultValue,
  disabled = false,
  id,
  name,
  onChange,
  placeholder,
  required = false,
  searchable = true,
  searchPlaceholder = '',
  value,
  ...nativeProps
}: DropdownSelectProps) {
  const generatedId = useId()
  const nativeSelectRef = useRef<HTMLSelectElement>(null)
  const options = useMemo(() => readOptions(children), [children])
  const [selectedValue, setSelectedValue] = useState(value ?? defaultValue ?? options[0]?.value ?? '')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const currentValue = value ?? selectedValue
  const selectedOption = options.find((option) => option.value === currentValue)
  const visibleOptions = options.filter((option) => !searchable || `${option.searchLabel} ${option.value}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))

  function choose(option: Option): void {
    if (option.disabled) return
    setSelectedValue(option.value)
    setOpen(false)
    setQuery('')
    const nativeSelect = nativeSelectRef.current
    if (!nativeSelect) return
    nativeSelect.value = option.value
    nativeSelect.dispatchEvent(new Event('change', { bubbles: true }))
  }

  return <div className="relative">
    <select {...nativeProps} aria-hidden="true" className="sr-only" id={`${id ?? generatedId}-native`} name={name} onChange={onChange ?? (() => undefined)} ref={nativeSelectRef} required={required} tabIndex={-1} value={currentValue}>{children}</select>
    <button aria-expanded={open} aria-haspopup="listbox" aria-label={nativeProps['aria-label']} className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-surface px-3 text-left text-sm text-foreground outline-none transition-colors hover:border-primary/40 focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-focus/50 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`.trim()} disabled={disabled} id={id} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if ((event.key === 'Enter' || event.key === ' ') && !open) { event.preventDefault(); setOpen(true) } }} type="button"><span className={`truncate ${selectedOption?.value ? '' : 'text-muted-foreground'}`}>{selectedOption?.label ?? placeholder}</span><ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} /></button>
    {open ? <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-[var(--radius-control)] border border-border bg-surface p-2 shadow-[var(--elevation-overlay)]" role="listbox">
      {searchable ? <input aria-label={searchPlaceholder} autoFocus className="mb-2 min-h-9 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm outline-none focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-focus/50" onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} value={query} /> : null}
      <div className="space-y-1">{visibleOptions.map((option) => <button aria-selected={option.value === currentValue} className={`flex min-h-9 w-full items-center rounded-[var(--radius-control)] px-3 text-left text-sm ${option.value === currentValue ? 'bg-accent font-semibold text-accent-foreground' : 'hover:bg-surface-subtle'} ${option.disabled ? 'cursor-not-allowed opacity-50' : ''}`.trim()} disabled={option.disabled} key={option.value} onClick={() => choose(option)} role="option" type="button">{option.label}</button>)}</div>
    </div> : null}
  </div>
}
