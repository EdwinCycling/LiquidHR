'use client'

import { Check, ChevronDown, Search } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useId, useMemo, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'

import { TextInput } from './text-input'

export interface MultiSelectOption {
  value: string
  label: ReactNode
  searchLabel?: string
  disabled?: boolean
}

export interface MultiSelectProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onChange' | 'onClick' | 'type' | 'value'> {
  options: readonly MultiSelectOption[]
  value: readonly string[]
  onChange: (values: string[]) => void
  emptySelectionLabel: string
  listLabel?: string
  loading?: boolean
  loadingLabel: string
  noOptionsLabel: string
  searchPlaceholder: string
  selectAllLabel?: string
  selectedCountLabel: string
  showSelectAll?: boolean
  name?: string
}

function optionText(option: MultiSelectOption): string {
  if (option.searchLabel) return option.searchLabel
  return typeof option.label === 'string' || typeof option.label === 'number' ? String(option.label) : option.value
}

function visibleOptions(options: readonly MultiSelectOption[], search: string): MultiSelectOption[] {
  const normalized = search.trim().toLocaleLowerCase()
  if (!normalized) return [...options]
  return options.filter((option) => `${optionText(option)} ${option.value}`.toLocaleLowerCase().includes(normalized))
}

function nextEnabled(options: readonly MultiSelectOption[], start: number, direction: 1 | -1): number {
  if (!options.length) return -1
  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (start + offset * direction + options.length) % options.length
    if (!options[index]?.disabled) return index
  }
  return -1
}

export function MultiSelect({
  'aria-label': ariaLabel,
  className,
  disabled = false,
  emptySelectionLabel,
  listLabel,
  loading = false,
  loadingLabel,
  name,
  noOptionsLabel,
  onChange,
  options,
  searchPlaceholder,
  selectAllLabel,
  selectedCountLabel,
  showSelectAll = false,
  value,
  ...buttonProps
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const menuId = useId()
  const filteredOptions = useMemo(() => visibleOptions(options, search), [options, search])
  const enabledOptions = useMemo(() => options.filter((option) => !option.disabled), [options])
  const selectedValues = useMemo(() => new Set(value), [value])
  const allSelected = enabledOptions.length > 0 && enabledOptions.every((option) => selectedValues.has(option.value))

  function updateMenuPosition(): void {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const viewportWidth = typeof window === 'undefined' ? rect.width : window.innerWidth
    const width = Math.min(Math.max(rect.width, 240), Math.max(240, viewportWidth - 16))
    const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportWidth - width - 8))
    setMenuPosition({ top: rect.bottom + 8, left, width })
  }

  function focusOption(index: number): void {
    if (index < 0) return
    setActiveIndex(index)
    requestAnimationFrame(() => optionRefs.current[index]?.focus())
  }

  function openMenu(): void {
    if (loading) return
    const selectedIndex = filteredOptions.findIndex((option) => selectedValues.has(option.value))
    const nextIndex = nextEnabled(filteredOptions, selectedIndex >= 0 ? selectedIndex : 0, 1)
    setActiveIndex(nextIndex)
    updateMenuPosition()
    setOpen(true)
    requestAnimationFrame(() => {
      searchRef.current?.focus()
    })
  }

  function closeMenu(): void {
    setOpen(false)
    setSearch('')
    triggerRef.current?.focus()
  }

  function toggleValue(option: MultiSelectOption): void {
    if (option.disabled) return
    const next = selectedValues.has(option.value) ? value.filter((item) => item !== option.value) : [...value, option.value]
    onChange([...new Set(next)])
  }

  function toggleAll(): void {
    if (!enabledOptions.length) return
    if (allSelected) {
      const enabledValues = new Set(enabledOptions.map((option) => option.value))
      onChange(value.filter((item) => !enabledValues.has(item)))
    } else {
      onChange([...new Set([...value, ...enabledOptions.map((option) => option.value)])])
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMenu()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusOption(nextEnabled(filteredOptions, activeIndex + 1, 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusOption(nextEnabled(filteredOptions, activeIndex - 1, -1))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      focusOption(nextEnabled(filteredOptions, 0, 1))
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      focusOption(nextEnabled(filteredOptions, filteredOptions.length - 1, -1))
    }
  }

  const isMenuOpen = open && !loading

  useEffect(() => {
    if (!isMenuOpen) return undefined
    updateMenuPosition()
    const closeOnOutside = (event: PointerEvent): void => {
      const target = event.target
      if (target instanceof Node && !triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) closeMenu()
    }
    const reposition = (): void => updateMenuPosition()
    document.addEventListener('pointerdown', closeOnOutside)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [isMenuOpen])

  const triggerLabel = value.length ? selectedCountLabel.replace('{count}', String(value.length)) : emptySelectionLabel
  const buttonLabel = ariaLabel ?? emptySelectionLabel

  return <>
    {name ? value.map((item) => <input key={item} name={name} type="hidden" value={item} />) : null}
    <button
      {...buttonProps}
      aria-busy={loading || undefined}
      aria-controls={isMenuOpen ? menuId : undefined}
      aria-expanded={isMenuOpen}
      aria-haspopup="listbox"
      aria-label={buttonLabel}
      className={`inline-flex min-h-10 w-full min-w-0 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-left text-sm font-medium text-foreground transition-[background-color,border-color,box-shadow] hover:border-primary/40 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/20 disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`.trim()}
      disabled={disabled || loading}
      id={buttonProps.id}
      onClick={() => isMenuOpen ? closeMenu() : openMenu()}
      ref={triggerRef}
      type="button"
    >
      <span className={`min-w-0 flex-1 truncate ${value.length ? '' : 'text-muted-foreground'}`}>{loading ? loadingLabel : triggerLabel}</span>
      <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-muted-foreground transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
    </button>
    {isMenuOpen ? createPortal(<div className="fixed z-[80] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[var(--radius-overlay)] border border-border bg-surface p-2 shadow-[var(--elevation-overlay)]" id={menuId} ref={menuRef} role="listbox" aria-label={listLabel ?? buttonLabel} aria-multiselectable="true" style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }} onKeyDown={handleMenuKeyDown}>
      <div className="mb-2">
        <TextInput aria-label={searchPlaceholder} leadingIcon={<Search aria-hidden="true" />} onChange={(event) => { const next = event.target.value; setSearch(next); setActiveIndex(nextEnabled(visibleOptions(options, next), 0, 1)) }} placeholder={searchPlaceholder} ref={searchRef} value={search} />
      </div>
      {showSelectAll && selectAllLabel ? <button aria-selected={allSelected} className="flex min-h-10 w-full items-center gap-3 rounded-[var(--radius-control)] border-b border-border-subtle px-3 py-2 text-left text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-focus" onClick={toggleAll} role="option" type="button"><span aria-hidden="true" className={`grid size-4 shrink-0 place-items-center rounded border ${allSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{allSelected ? <Check className="size-3" /> : null}</span>{selectAllLabel}</button> : null}
      <div className="max-h-72 overflow-y-auto" role="presentation">
        {filteredOptions.length ? filteredOptions.map((option, index) => {
          const selected = selectedValues.has(option.value)
          return <button aria-selected={selected} className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-focus ${option.disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted'} ${selected ? 'bg-accent font-semibold text-accent-foreground' : ''}`} disabled={option.disabled} key={option.value} onClick={() => toggleValue(option)} ref={(node) => { optionRefs.current[index] = node }} role="option" tabIndex={activeIndex === index ? 0 : -1} type="button"><span className="min-w-0 truncate">{option.label}</span>{selected ? <Check aria-hidden="true" className="size-4 shrink-0 text-primary" /> : null}</button>
        }) : <p className="px-3 py-3 text-sm text-muted-foreground">{noOptionsLabel}</p>}
      </div>
    </div>, document.body) : null}
  </>
}
