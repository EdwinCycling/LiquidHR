'use client'

import { Check, ChevronDown, Search } from 'lucide-react'
import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type OptionElementProps = {
  value?: string
  disabled?: boolean
  children?: ReactNode
}

type DropdownOption = {
  value: string
  label: ReactNode
  searchLabel: string
  disabled: boolean
}

type DropdownSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'defaultValue' | 'multiple' | 'onChange' | 'value'> & {
  children: ReactNode
  defaultValue?: string
  emptyLabel?: string
  multiple?: boolean
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void
  placeholder?: ReactNode
  searchable?: boolean
  searchPlaceholder?: string
  value?: string
}

function optionText(value: ReactNode, fallback: string): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback
}

function parseOptions(children: ReactNode): DropdownOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionElementProps>(child)) return []
    if (child.type === 'optgroup') return parseOptions(child.props.children)
    if (child.type !== 'option') return []
    const value = typeof child.props.value === 'string' ? child.props.value : ''
    const label = child.props.children ?? value
    return [{ value, label, searchLabel: optionText(label, value), disabled: Boolean(child.props.disabled) }]
  })
}

function nextEnabled(options: DropdownOption[], start: number, direction: 1 | -1): number {
  if (!options.length) return -1
  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (start + offset * direction + options.length) % options.length
    if (!options[index]?.disabled) return index
  }
  return -1
}

function filterOptions(options: DropdownOption[], search: string): DropdownOption[] {
  const normalizedSearch = search.trim().toLocaleLowerCase()
  if (!normalizedSearch) return options
  return options.filter((option) => `${option.searchLabel} ${option.value}`.toLocaleLowerCase().includes(normalizedSearch))
}

export function DropdownSelect(props: DropdownSelectProps) {
  if (props.multiple) {
    const { children, className, defaultValue, disabled, emptyLabel, id, name, onChange, placeholder, required, searchable, searchPlaceholder, value, ...nativeProps } = props
    void emptyLabel
    void placeholder
    void searchable
    void searchPlaceholder
    return <select {...nativeProps} className={className} defaultValue={defaultValue} disabled={disabled} id={id} multiple name={name} onChange={onChange} required={required} value={value}>{children}</select>
  }
  return <DropdownSingleSelect {...props} />
}

function DropdownSingleSelect({
  children,
  className,
  defaultValue,
  disabled = false,
  emptyLabel = 'Geen opties gevonden',
  id,
  name,
  onChange,
  placeholder = 'Selecteer een optie',
  required = false,
  searchable = false,
  searchPlaceholder = 'Zoeken…',
  value,
  ...selectProps
}: DropdownSelectProps) {
  const options = useMemo(() => parseOptions(children), [children])

  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? options[0]?.value ?? '')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const menuId = useId()
  const currentValue = value ?? uncontrolledValue
  const selectedOption = options.find((option) => option.value === currentValue)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleOptions = useMemo(() => searchable ? filterOptions(options, normalizedQuery) : options, [normalizedQuery, options, searchable])

  function updateMenuPosition() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuPosition({ top: rect.bottom + 8, left: rect.left, width: Math.max(rect.width, 240) })
  }

  function focusActive(index: number) {
    setActiveIndex(index)
    requestAnimationFrame(() => optionRefs.current[index]?.focus())
  }

  function openMenu() {
    const selectedIndex = visibleOptions.findIndex((option) => option.value === currentValue)
    setActiveIndex(nextEnabled(visibleOptions, selectedIndex >= 0 ? selectedIndex : 0, 1))
    updateMenuPosition()
    setOpen(true)
    requestAnimationFrame(() => {
      if (searchable) searchRef.current?.focus()
      else optionRefs.current[selectedIndex >= 0 ? selectedIndex : 0]?.focus()
    })
  }

  function closeMenu() {
    setOpen(false)
    setQuery('')
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function choose(option: DropdownOption) {
    if (option.disabled) return
    setUncontrolledValue(option.value)
    setOpen(false)
    setQuery('')
    requestAnimationFrame(() => triggerRef.current?.focus())
    const nativeSelect = document.getElementById(`${menuId}-native`) as HTMLSelectElement | null
    if (!nativeSelect) return
    nativeSelect.value = option.value
    nativeSelect.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) openMenu()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) openMenu()
    }
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = nextEnabled(visibleOptions, activeIndex + 1, 1)
      if (next >= 0) focusActive(next)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const previous = nextEnabled(visibleOptions, activeIndex - 1, -1)
      if (previous >= 0) focusActive(previous)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      const first = nextEnabled(visibleOptions, 0, 1)
      if (first >= 0) focusActive(first)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      const last = nextEnabled(visibleOptions, visibleOptions.length - 1, -1)
      if (last >= 0) focusActive(last)
    }
  }

  useEffect(() => {
    if (!open) return undefined
    updateMenuPosition()
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const reposition = () => updateMenuPosition()
    document.addEventListener('mousedown', closeOnOutsideClick)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  const triggerLabel = selectedOption?.label ?? placeholder
  const triggerAriaLabel = selectProps['aria-label'] ?? (typeof placeholder === 'string' ? placeholder : undefined)

  return <>
    <select aria-describedby={selectProps['aria-describedby']} aria-hidden="true" aria-invalid={selectProps['aria-invalid']} aria-labelledby={selectProps['aria-labelledby']} className="sr-only" disabled={disabled} id={`${menuId}-native`} name={name} onChange={onChange} required={required} tabIndex={-1} value={currentValue}>{children}</select>
    <button aria-controls={open ? menuId : undefined} aria-describedby={selectProps['aria-describedby']} aria-expanded={open} aria-haspopup="listbox" aria-label={triggerAriaLabel} aria-labelledby={selectProps['aria-labelledby']} className={`inline-flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-border/90 bg-surface px-3 py-2 text-left text-sm font-medium text-foreground shadow-sm transition-[background-color,border-color,box-shadow] hover:border-primary/40 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/20 disabled:cursor-not-allowed disabled:opacity-60 ${selectProps['aria-invalid'] ? 'border-destructive' : ''} ${className ?? ''}`} data-invalid={selectProps['aria-invalid']} disabled={disabled} id={id} onClick={() => open ? closeMenu() : openMenu()} onKeyDown={handleTriggerKeyDown} ref={triggerRef} type="button"><span className={`min-w-0 flex-1 truncate ${selectedOption ? '' : 'text-muted-foreground'}`}>{triggerLabel}</span><ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} /></button>
    {open ? createPortal(<div className="fixed z-[80] overflow-hidden rounded-2xl border border-border bg-surface p-2 shadow-2xl" id={menuId} ref={menuRef} role="listbox" style={{ top: menuPosition.top, left: menuPosition.left, minWidth: menuPosition.width }} onKeyDown={handleMenuKeyDown}>
      {searchable ? <div className="relative mb-2"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input aria-label={searchPlaceholder} className="min-h-10 w-full rounded-xl border border-border/90 bg-surface-raised pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-focus/20" onChange={(event) => { const nextQuery = event.target.value; setQuery(nextQuery); setActiveIndex(nextEnabled(filterOptions(options, nextQuery), 0, 1)) }} placeholder={searchPlaceholder} ref={searchRef} value={query} /></div> : null}
      <div className="max-h-72 overflow-y-auto" role="presentation">{visibleOptions.length ? visibleOptions.map((option, index) => <button aria-selected={option.value === currentValue} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${option.disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted'} ${option.value === currentValue ? 'bg-accent font-semibold text-accent-foreground' : ''}`} disabled={option.disabled} key={option.value} onClick={() => choose(option)} ref={(node) => { optionRefs.current[index] = node }} role="option" tabIndex={activeIndex === index ? 0 : -1} type="button"><span className="min-w-0 truncate">{option.label}</span>{option.value === currentValue ? <Check aria-hidden="true" className="size-4 shrink-0 text-primary" /> : null}</button>) : <p className="px-3 py-3 text-sm text-muted-foreground">{emptyLabel}</p>}</div>
    </div>, document.body) : null}
  </>
}
