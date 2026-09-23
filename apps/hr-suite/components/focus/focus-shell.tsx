import Link from 'next/link'
import { BriefcaseBusiness, CalendarDays, ClipboardList, FileText, Home, Route, UserRound, UsersRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { PageShell, type PageShellWidth } from '@/components/layout/page-shell'
import { focusActAsHref } from '@/lib/focus/url'
import { FocusPreviewClose } from './focus-preview-close'
import { FocusActAsStop } from './focus-act-as-stop'
import type { FocusActionKey, FocusHomeData } from '@/lib/focus/service'

interface FocusShellLabels {
  product: string
  home: string
  menu: string
  actions: Record<FocusActionKey, string>
  bottom?: { menu: string; home: string; journey: string; profile: string; documents: string; requests: string; leave: string; hours: string; work: string; team: string; more: string }
  actAsToken?: string | null
}

function FocusBottomNavigation({ actions, activeKey, labels, readOnly, token }: { actions: readonly FocusHomeData['actions'][number][]; activeKey?: FocusActionKey | 'more'; labels: NonNullable<FocusShellLabels['bottom']>; readOnly: boolean; token?: string | null }) {
  const manager = actions.some((action) => action.key === 'team') && actions.some((action) => action.key === 'work')
  const preboarding = actions.some((action) => action.key === 'journey') && !actions.some((action) => action.key === 'leave' || action.key === 'hours' || action.key === 'requests' || action.key === 'work' || action.key === 'team')
  const items = preboarding
    ? [{ key: 'home', href: '/focus', label: labels.home, icon: Home }, { key: 'journey', href: '/focus/onboarding', label: labels.journey, icon: Route }, { key: 'documents', href: '/focus/documenten', label: labels.documents, icon: FileText }, { key: 'profile', href: '/focus/profiel', label: labels.profile, icon: UserRound }]
    : manager
    ? [{ key: 'home', href: '/focus', label: labels.home, icon: Home }, { key: 'work', href: '/focus/werk', label: labels.work, icon: BriefcaseBusiness }, { key: 'team', href: '/focus/team', label: labels.team, icon: UsersRound }, { key: 'requests', href: '/focus/aanvragen', label: labels.requests, icon: ClipboardList }, { key: 'more', href: '/focus/meer', label: labels.more, icon: FileText }]
    : [{ key: 'home', href: '/focus', label: labels.home, icon: Home }, { key: 'requests', href: '/focus/aanvragen', label: labels.requests, icon: ClipboardList }, { key: 'leave', href: '/focus/verlof', label: labels.leave, icon: CalendarDays }, { key: 'hours', href: '/focus/uren', label: labels.hours, icon: BriefcaseBusiness }, { key: 'more', href: '/focus/meer', label: labels.more, icon: FileText }]
  const visibleItems = items.filter((item) => item.key === 'home' || item.key === 'more' || actions.some((action) => action.key === item.key))
  const columns = preboarding ? 'grid-cols-4' : visibleItems.length === 3 ? 'grid-cols-3' : visibleItems.length === 4 ? 'grid-cols-4' : 'grid-cols-5'
  return <nav aria-label={labels.menu} className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-0 pb-[env(safe-area-inset-bottom)]"><div className="w-full max-w-3xl border-t border-border-subtle bg-surface/95 px-2 backdrop-blur"><div className={`mx-auto grid gap-1 py-2 ${columns}`}>{visibleItems.map((item) => { const Icon = item.icon; const active = item.key === 'home' ? activeKey === undefined : item.key === activeKey; const className = `flex min-h-11 flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] px-1 text-[11px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-surface-subtle hover:text-foreground'}`; return readOnly ? <span aria-current={active ? 'page' : undefined} className={className} key={item.key}><Icon aria-hidden="true" className="size-4" />{item.label}</span> : <Link aria-current={active ? 'page' : undefined} className={className} href={focusActAsHref(item.href, token)} key={item.key} prefetch={false}><Icon aria-hidden="true" className="size-4" />{item.label}</Link> })}</div></div></nav>
}

export function FocusShell({
  actions,
  activeKey,
  children,
  labels,
  width = 'standard',
  readOnly = false,
  preview,
  actAs,
}: {
  actions: readonly FocusHomeData['actions'][number][]
  activeKey?: FocusActionKey | 'more'
  children: ReactNode
  labels: FocusShellLabels
  width?: PageShellWidth
  readOnly?: boolean
  preview?: { title: string; status: string; closeLabel: string; returnHref: string }
  actAs?: { token: string; subjectName: string; title: string; description: string; stopLabel: string } | null
}) {
  return (
    <main className="min-h-dvh bg-workspace">
      <div className="mx-auto min-h-dvh w-full max-w-3xl bg-workspace">
        <div className="sticky top-0 z-20 border-b border-subtle bg-surface/95 backdrop-blur">
          <PageShell className="flex min-h-14 items-center gap-4" width="standard">
            <Link className="shrink-0 text-sm font-bold tracking-tight text-foreground" href={focusActAsHref('/focus', labels.actAsToken)} prefetch={false}>{labels.product}</Link>
          </PageShell>
        </div>
        <PageShell className="space-y-6 pb-28 pt-6 sm:pt-8" width={width}>
          {preview ? <div className="flex flex-wrap items-center justify-between gap-3 border border-info-border bg-info-surface px-4 py-3 text-sm text-info" role="status"><div><p className="font-semibold">{preview.title}</p><p className="mt-1">{preview.status}</p></div><FocusPreviewClose label={preview.closeLabel} returnHref={preview.returnHref} /></div> : null}
          {actAs ? <div className="flex flex-wrap items-center justify-between gap-3 border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground" role="status"><p><span className="font-semibold">{actAs.title}</span><span className="block">{actAs.description.replace('{name}', actAs.subjectName)}</span></p><FocusActAsStop label={actAs.stopLabel} token={actAs.token} /></div> : null}
          {children}
        </PageShell>
      </div>
      {labels.bottom ? <FocusBottomNavigation actions={actions} activeKey={activeKey} labels={labels.bottom} readOnly={readOnly} token={labels.actAsToken} /> : null}
    </main>
  )
}
