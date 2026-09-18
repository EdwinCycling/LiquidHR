import Link from 'next/link'
import { BriefcaseBusiness, CalendarDays, ClipboardList, FileText, Home, Route, UserRound, UsersRound, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { PageShell, type PageShellWidth } from '@/components/layout/page-shell'
import { FocusPreviewClose } from './focus-preview-close'
import { focusPreviewHref } from './focus-preview'
import type { FocusActionKey, FocusHomeData } from '@/lib/focus/service'

const actionIcons: Record<FocusActionKey, LucideIcon> = {
  journey: Route,
  profile: UserRound,
  documents: FileText,
  leave: CalendarDays,
  requests: ClipboardList,
  work: BriefcaseBusiness,
  team: UsersRound,
}

interface FocusShellLabels {
  product: string
  home: string
  menu: string
  actions: Record<FocusActionKey, string>
}

function FocusNavigation({
  actions,
  activeKey,
  labels,
  readOnly,
  previewEmployeeId,
}: {
  actions: readonly FocusHomeData['actions'][number][]
  activeKey?: FocusActionKey
  labels: FocusShellLabels
  readOnly: boolean
  previewEmployeeId?: string
}) {
  const previewNavigation = readOnly && previewEmployeeId !== undefined
  const navigationActions = previewNavigation ? actions : actions.filter((action) => action.href.startsWith('/focus/'))
  return (
    <nav aria-label={labels.menu} className="tabs-scroll flex min-w-0 items-center gap-2 overflow-x-auto py-1">
      {previewNavigation ? <Link aria-current={activeKey === undefined ? 'page' : undefined} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${activeKey === undefined ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-surface-subtle hover:text-foreground'}`} href={focusPreviewHref(previewEmployeeId!)} prefetch={false}>
        <Home aria-hidden="true" className="size-4" />{labels.home}
      </Link> : readOnly ? <span aria-current={activeKey === undefined ? 'page' : undefined} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-semibold ${activeKey === undefined ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`}>
        <Home aria-hidden="true" className="size-4" />{labels.home}
      </span> : <Link aria-current={activeKey === undefined ? 'page' : undefined} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${activeKey === undefined ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-surface-subtle hover:text-foreground'}`} href="/focus" prefetch={false}>
        <Home aria-hidden="true" className="size-4" />{labels.home}
      </Link>}
      {navigationActions.map((action) => {
        const Icon = actionIcons[action.key]
        const active = activeKey === action.key
        return previewNavigation
          ? <Link aria-current={active ? 'page' : undefined} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-surface-subtle hover:text-foreground'}`} href={focusPreviewHref(previewEmployeeId!, action.key)} key={action.key} prefetch={false}><Icon aria-hidden="true" className="size-4" />{labels.actions[action.key]}</Link>
          : readOnly
          ? <span aria-current={active ? 'page' : undefined} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-medium ${active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'}`} key={action.key}><Icon aria-hidden="true" className="size-4" />{labels.actions[action.key]}</span>
          : <Link aria-current={active ? 'page' : undefined} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-surface-subtle hover:text-foreground'}`} href={action.href} key={action.key} prefetch={false}><Icon aria-hidden="true" className="size-4" />{labels.actions[action.key]}</Link>
      })}
    </nav>
  )
}

export function FocusShell({
  actions,
  activeKey,
  children,
  labels,
  width = 'standard',
  readOnly = false,
  preview,
}: {
  actions: readonly FocusHomeData['actions'][number][]
  activeKey?: FocusActionKey
  children: ReactNode
  labels: FocusShellLabels
  width?: PageShellWidth
  readOnly?: boolean
  preview?: { title: string; status: string; closeLabel: string; returnHref: string; employeeId: string }
}) {
  const productHref = readOnly && preview ? focusPreviewHref(preview.employeeId) : '/focus'
  return (
    <main className="min-h-dvh bg-workspace">
      <div className="sticky top-0 z-20 border-b border-subtle bg-surface/95 backdrop-blur">
        <PageShell className="flex min-h-14 items-center gap-4" width="standard">
          <Link className="shrink-0 text-sm font-bold tracking-tight text-foreground" href={productHref} prefetch={false}>{labels.product}</Link>
          <div className="min-w-0 flex-1"><FocusNavigation actions={actions} activeKey={activeKey} labels={labels} previewEmployeeId={preview?.employeeId} readOnly={readOnly} /></div>
        </PageShell>
      </div>
      <PageShell className="space-y-6 py-6 sm:py-8" width={width}>
        {preview ? <div className="flex flex-wrap items-center justify-between gap-3 border border-info-border bg-info-surface px-4 py-3 text-sm text-info" role="status"><div><p className="font-semibold">{preview.title}</p><p className="mt-1">{preview.status}</p></div><FocusPreviewClose label={preview.closeLabel} returnHref={preview.returnHref} /></div> : null}
        {children}
      </PageShell>
    </main>
  )
}
