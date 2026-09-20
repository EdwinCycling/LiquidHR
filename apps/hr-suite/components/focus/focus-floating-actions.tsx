'use client'

import Link from 'next/link'
import { CalendarPlus, FilePlus2, HeartPulse, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { buttonClasses } from '@/components/ui/button'
import { focusActAsHref } from '@/lib/focus/url'

export interface FocusFloatingActionsLabels {
  label: string
  openLabel: string
  closeLabel: string
  leave: string
  sickness: string
  employeeSickness: string
  declaration: string
  comingSoon: string
}

export function FocusFloatingActions({ labels, token, canRequestLeave = false, canReportSickness = false, canReportEmployeeSickness = false, employeeSicknessHref = '/focus/team' }: { labels: FocusFloatingActionsLabels; token?: string | null; canRequestLeave?: boolean; canReportSickness?: boolean; canReportEmployeeSickness?: boolean; employeeSicknessHref?: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = 'focus-floating-actions'

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const linkClasses = 'inline-flex w-full max-w-xs items-center justify-end gap-2 rounded-[var(--radius-control)] border border-subtle bg-surface px-2 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

  return <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 flex w-[calc(100vw-2rem)] max-w-xs flex-col items-end sm:bottom-6 sm:right-6">
    {open ? <nav aria-label={labels.label} className="mb-3 flex flex-col items-end gap-2" id={menuId}>
      {canReportSickness ? <Link className={linkClasses} href={focusActAsHref('/focus/ziek', token)} onClick={() => setOpen(false)} prefetch={false}>
        <span className="truncate pl-1">{labels.sickness}</span>
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/20 bg-accent text-primary"><HeartPulse aria-hidden="true" className="size-4" /></span>
      </Link> : null}
      {canReportEmployeeSickness ? <Link className={linkClasses} href={focusActAsHref(employeeSicknessHref, token)} onClick={() => setOpen(false)} prefetch={false}>
        <span className="truncate pl-1">{labels.employeeSickness}</span>
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/20 bg-accent text-primary"><HeartPulse aria-hidden="true" className="size-4" /></span>
      </Link> : null}
      {canRequestLeave ? <Link className={linkClasses} href={focusActAsHref('/focus/verlof', token)} onClick={() => setOpen(false)} prefetch={false}>
        <span className="truncate pl-1">{labels.leave}</span>
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/20 bg-accent text-primary"><CalendarPlus aria-hidden="true" className="size-4" /></span>
      </Link> : null}
      <span aria-disabled="true" className={`${linkClasses} cursor-not-allowed bg-muted text-muted-foreground`} title={labels.comingSoon}>
        <span className="truncate pl-1">{labels.declaration}</span>
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-muted-foreground"><FilePlus2 aria-hidden="true" className="size-4" /></span>
      </span>
    </nav> : null}
    <button aria-controls={menuId} aria-expanded={open} aria-label={open ? labels.closeLabel : labels.openLabel} className={buttonClasses({ className: 'size-14 min-h-14 rounded-full p-0 shadow-lg focus-visible:ring-2 focus-visible:ring-offset-2', variant: 'primary' })} onClick={() => setOpen((current) => !current)} ref={triggerRef} type="button">
      {open ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
    </button>
  </div>
}
