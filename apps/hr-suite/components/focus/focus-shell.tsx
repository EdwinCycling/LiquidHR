import Link from 'next/link'
import { BriefcaseBusiness, CalendarDays, ClipboardList, FileText, Home, Route, UserRound, UsersRound, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { PageShell, type PageShellWidth } from '@/components/layout/page-shell'
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
}: {
  actions: readonly FocusHomeData['actions'][number][]
  activeKey?: FocusActionKey
  labels: FocusShellLabels
}) {
  return (
    <nav aria-label={labels.menu} className="flex min-w-0 items-center gap-2 overflow-x-auto py-1">
      <Link aria-current={activeKey === undefined ? 'page' : undefined} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${activeKey === undefined ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-surface-subtle hover:text-foreground'}`} href="/focus" prefetch={false}>
        <Home aria-hidden="true" className="size-4" />{labels.home}
      </Link>
      {actions.filter((action) => action.href.startsWith('/focus/')).map((action) => {
        const Icon = actionIcons[action.key]
        const active = activeKey === action.key
        return <Link aria-current={active ? 'page' : undefined} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-surface-subtle hover:text-foreground'}`} href={action.href} key={action.key} prefetch={false}><Icon aria-hidden="true" className="size-4" />{labels.actions[action.key]}</Link>
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
}: {
  actions: readonly FocusHomeData['actions'][number][]
  activeKey?: FocusActionKey
  children: ReactNode
  labels: FocusShellLabels
  width?: PageShellWidth
}) {
  return (
    <main className="min-h-dvh bg-workspace">
      <div className="sticky top-0 z-20 border-b border-subtle bg-surface/95 backdrop-blur">
        <PageShell className="flex min-h-14 items-center gap-4" width="standard">
          <Link className="shrink-0 text-sm font-bold tracking-tight text-foreground" href="/focus" prefetch={false}>{labels.product}</Link>
          <div className="min-w-0 flex-1"><FocusNavigation actions={actions} activeKey={activeKey} labels={labels} /></div>
        </PageShell>
      </div>
      <PageShell className="space-y-6 py-6 sm:py-8" width={width}>{children}</PageShell>
    </main>
  )
}
