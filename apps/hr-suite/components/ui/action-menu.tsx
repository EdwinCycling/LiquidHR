'use client'

import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { IconButton } from './icon-button'

type ActionMenuItemBase = {
  id: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  destructive?: boolean
}

export type ActionMenuItem = ActionMenuItemBase & ({ href: string; onSelect?: never } | { href?: never; onSelect: () => void })

export type ActionMenuProps = {
  label: string
  items: readonly ActionMenuItem[]
  className?: string
}

const enabledItemIndices = (items: readonly ActionMenuItem[]) => items.flatMap((item, index) => item.disabled ? [] : [index])

export function ActionMenu({ className, items, label }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLElement | null>>([])
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!open) return

    const firstEnabled = enabledItemIndices(items)[0]
    if (firstEnabled !== undefined) itemRefs.current[firstEnabled]?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [items, open])

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      return
    }
    if (!wasOpenRef.current) return

    wasOpenRef.current = false
    triggerRef.current?.focus()
  }, [open])

  function focusOffset(current: number, offset: number): void {
    const enabled = enabledItemIndices(items)
    if (enabled.length === 0) return
    const currentPosition = enabled.indexOf(current)
    const nextPosition = (currentPosition + offset + enabled.length) % enabled.length
    itemRefs.current[enabled[nextPosition]]?.focus()
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const current = items.findIndex((item) => item.id === (document.activeElement as HTMLElement | null)?.dataset.actionMenuItem)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusOffset(current, 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusOffset(current, -1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      const first = enabledItemIndices(items)[0]
      if (first !== undefined) itemRefs.current[first]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      const enabled = enabledItemIndices(items)
      const last = enabled[enabled.length - 1]
      if (last !== undefined) itemRefs.current[last]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    } else if ((event.key === 'Enter' || event.key === ' ') && document.activeElement instanceof HTMLElement) {
      event.preventDefault()
      document.activeElement.click()
    }
  }

  function select(item: ActionMenuItem): void {
    if (item.disabled) return
    setOpen(false)
    if ('onSelect' in item && item.onSelect) item.onSelect()
  }

  return (
    <div className={`relative ${className ?? ''}`.trim()} ref={wrapperRef}>
      <IconButton aria-expanded={open} aria-haspopup="menu" label={label} onClick={() => setOpen((value) => !value)} ref={triggerRef} size="sm" type="button" variant="ghost">
        <MoreHorizontal aria-hidden="true" />
      </IconButton>
      {open ? (
        <div aria-label={label} className="absolute right-0 z-20 mt-1 min-w-48 rounded-[var(--radius-overlay)] border border-border bg-surface-overlay p-1 shadow-lg" onKeyDown={handleMenuKeyDown} role="menu">
          {items.map((item, index) => {
            const itemClass = `flex min-h-9 w-full items-center gap-2 rounded-[var(--radius-control)] px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 ${item.destructive ? 'text-destructive hover:bg-destructive-surface' : 'text-foreground hover:bg-surface-raised'}`.trim()
            const content = <>{item.icon ? <span aria-hidden="true" className="[&_svg]:size-4">{item.icon}</span> : null}<span>{item.label}</span></>
            return 'href' in item ? (
              <a
                aria-disabled={item.disabled || undefined}
                className={`${itemClass} ${item.disabled ? 'pointer-events-none' : ''}`.trim()}
                data-action-menu-item={item.id}
                href={item.disabled ? undefined : item.href}
                key={item.id}
                onClick={(event) => { if (item.disabled) event.preventDefault(); setOpen(false) }}
                ref={(element) => { itemRefs.current[index] = element }}
                role="menuitem"
                tabIndex={item.disabled ? -1 : 0}
              >{content}</a>
            ) : (
              <button
                className={itemClass}
                data-action-menu-item={item.id}
                disabled={item.disabled}
                key={item.id}
                onClick={() => select(item)}
                ref={(element) => { itemRefs.current[index] = element }}
                role="menuitem"
                tabIndex={item.disabled ? -1 : 0}
                type="button"
              >{content}</button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
