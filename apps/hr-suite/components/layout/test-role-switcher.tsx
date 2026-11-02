'use client'

import { FlaskConical } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { IconButton } from '@/components/ui/icon-button'
import type { TestRoleSwitchTargetKey } from '@/lib/auth/test-role-switch'

export interface TestRoleSwitchOption {
  key: TestRoleSwitchTargetKey
  email: string
  label: string
}

interface TestRoleSwitcherProps {
  collapsed?: boolean
  currentEmail: string
  labels: {
    title: string
    hint: string
  }
  options: TestRoleSwitchOption[]
}

export function TestRoleSwitcher({ collapsed = false, currentEmail, labels, options }: TestRoleSwitcherProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)
  const normalizedCurrentEmail = currentEmail.trim().toLowerCase()
  const currentOption = options.find((option) => option.email === normalizedCurrentEmail)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      const select = popoverRef.current?.querySelector<HTMLSelectElement>('#test-role-switch-target')
      select?.focus()
      return
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false
      triggerRef.current?.focus()
    }
  }, [open])

  return (
    <div className="relative">
      <IconButton
        aria-controls={open ? 'test-role-switch-popover' : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="!bg-transparent !text-sidebar-muted hover:!bg-sidebar-accent hover:!text-sidebar-foreground"
        data-testid="test-role-switch-trigger"
        label={labels.title}
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        size="sm"
        title={labels.title}
        type="button"
        variant="ghost"
      >
        <FlaskConical aria-hidden="true" />
      </IconButton>
      {open ? (
        <div
          aria-describedby="test-role-switch-hint"
          aria-labelledby="test-role-switch-title"
          className={`absolute z-50 w-64 rounded-xl border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--sidebar)_45%,transparent)] ${collapsed ? 'left-[calc(100%+0.75rem)] top-0' : 'right-0 top-[calc(100%+0.5rem)]'}`}
          id="test-role-switch-popover"
          ref={popoverRef}
          role="dialog"
          tabIndex={-1}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em]" id="test-role-switch-title">{labels.title}</p>
          <p className="mt-1 text-xs leading-4 text-sidebar-muted" id="test-role-switch-hint">{labels.hint}</p>
          <form action="/api/auth/test-role-switch" className="mt-3" method="post">
            <label className="sr-only" htmlFor="test-role-switch-target">{labels.title}</label>
            <select
              className="h-10 w-full rounded-lg border border-sidebar-border bg-sidebar px-2.5 text-sm text-sidebar-foreground outline-none focus:border-sidebar-foreground"
              data-testid="test-role-switch-target"
              defaultValue={currentOption?.key}
              id="test-role-switch-target"
              name="target"
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
            >
              {options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </form>
        </div>
      ) : null}
    </div>
  )
}
