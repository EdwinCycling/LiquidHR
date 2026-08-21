'use client'

import { createPortal } from 'react-dom'
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './icon-button'

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hasAttribute('aria-hidden'))
}

type PortalStore = {
  getSnapshot: () => HTMLDivElement | null
  set: (value: HTMLDivElement | null) => void
  subscribe: (listener: () => void) => () => void
}

function createPortalStore(): PortalStore {
  let value: HTMLDivElement | null = null
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => value,
    set: (nextValue) => {
      value = nextValue
      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const getServerPortalSnapshot = (): HTMLDivElement | null => null

export type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  closeLabel?: string
  closeOnEscape?: boolean
  closeOnBackdropClick?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  className?: string
  panelClassName?: string
  contentClassName?: string
}

export function Dialog({
  children,
  className,
  closeLabel,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  contentClassName,
  description,
  footer,
  initialFocusRef,
  onOpenChange,
  open,
  panelClassName,
  title,
}: DialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)
  const [portalStore] = useState<PortalStore>(createPortalStore)
  const portal = useSyncExternalStore(portalStore.subscribe, portalStore.getSnapshot, getServerPortalSnapshot)

  useEffect(() => {
    if (!open) return

    const root = document.createElement('div')
    root.dataset.liquidhrOverlayRoot = 'true'
    document.body.append(root)
    portalStore.set(root)

    return () => {
      root.remove()
      if (portalStore.getSnapshot() === root) portalStore.set(null)
    }
  }, [open, portalStore])

  useEffect(() => {
    if (!open || !portal) return

    if (!wasOpenRef.current) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      wasOpenRef.current = true
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const target = initialFocusRef?.current ?? focusableElements(panelRef.current ?? portal)[0] ?? panelRef.current
    target?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [initialFocusRef, open, portal])

  useEffect(() => {
    if (open || !wasOpenRef.current) return

    wasOpenRef.current = false
    const target = restoreFocusRef.current
    restoreFocusRef.current = null
    if (target?.isConnected) target.focus()
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault()
      onOpenChange(false)
      return
    }

    if (event.key !== 'Tab' || !panelRef.current) return
    const elements = focusableElements(panelRef.current)
    if (elements.length === 0) {
      event.preventDefault()
      panelRef.current.focus()
      return
    }

    const first = elements[0]
    const last = elements[elements.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>): void {
    if (closeOnBackdropClick && event.target === event.currentTarget) onOpenChange(false)
  }

  if (!open || !portal) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 ${className ?? ''}`.trim()}
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={panelRef}
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[var(--radius-overlay)] border border-border bg-surface-overlay shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${panelClassName ?? ''}`.trim()}
        onKeyDown={handleKeyDown}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground" id={titleId}>{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground" id={descriptionId}>{description}</p> : null}
          </div>
          {closeLabel ? <IconButton label={closeLabel} onClick={() => onOpenChange(false)} size="sm" type="button" variant="ghost"><X aria-hidden="true" /></IconButton> : null}
        </header>
        <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-5 ${contentClassName ?? ''}`.trim()}>{children}</div>
        {footer ? <footer className="shrink-0 border-t border-border-subtle bg-surface-overlay px-5 py-4">{footer}</footer> : null}
      </div>
    </div>,
    portal,
  )
}
