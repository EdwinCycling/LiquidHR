'use client'

import Link from 'next/link'
import type { Locale } from '@/lib/i18n/config'
import type { ProcessWorkFilterOptions, ProcessWorkItem, ProcessWorkList, ProcessWorkSort, ProcessWorkTab } from '@/lib/process-automation/work-service'

export interface ProcessWorkspaceLabels {
  workspaceTitle: string
  workspaceDescription: string
  tabsTodo: string
  tabsClaimed: string
  tabsWaiting: string
  tabsCompleted: string
  tabsAll: string
  searchPlaceholder: string
  statusFilter: string
  processFilter: string
  administrationFilter: string
  applyFilters: string
  statusAll: string
  statusOpen: string
  statusClaimed: string
  statusBlocked: string
  statusCompleted: string
  statusCancelled: string
  statusExpired: string
  sort: string
  sortNeedsAction: string
  sortDeadline: string
  columnsProcess: string
  subject: string
  step: string
  assignment: string
  status: string
  deadline: string
  actions: string
  assignmentMode: string
  assignmentSource: string
  assignmentDate: string
  assignmentRole: string
  assignmentAnyOne: string
  assignmentQueue: string
  assignmentDirect: string
  assignmentScope: string
  assignmentProcess: string
  unknown: string
  noItems: string
  loading: string
  readError: string
  denied: string
  blocked: string
  overdue: string
  dueToday: string
  availableAt: string
  claimedBy: string
  unassigned: string
  open: string
}

interface ProcessWorkspaceProps {
  readonly locale: Locale
  readonly labels: ProcessWorkspaceLabels
  readonly data: ProcessWorkList | null
  readonly options: ProcessWorkFilterOptions
  readonly tab: ProcessWorkTab
  readonly search: string
  readonly status: string
  readonly processDefinitionId: string
  readonly administrationId: string
  readonly sort: ProcessWorkSort
  readonly errorCode?: string
}

const statusLabels: Record<string, keyof ProcessWorkspaceLabels> = {
  OPEN: 'statusOpen',
  CLAIMED: 'statusClaimed',
  BLOCKED: 'statusBlocked',
  COMPLETED: 'statusCompleted',
  CANCELLED: 'statusCancelled',
  EXPIRED: 'statusExpired',
}

function formatDate(value: string | null, locale: Locale): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function tabLabel(tab: ProcessWorkTab, labels: ProcessWorkspaceLabels): string {
  return {
    TODO: labels.tabsTodo,
    CLAIMED: labels.tabsClaimed,
    WAITING: labels.tabsWaiting,
    COMPLETED: labels.tabsCompleted,
    ALL: labels.tabsAll,
  }[tab]
}

function buildQuery(input: {
  tab: ProcessWorkTab
  search: string
  status: string
  processDefinitionId: string
  administrationId: string
  sort: ProcessWorkSort
}): string {
  const params = new URLSearchParams()
  if (input.tab !== 'TODO') params.set('tab', input.tab)
  if (input.search) params.set('search', input.search)
  if (input.status) params.set('status', input.status)
  if (input.processDefinitionId) params.set('processDefinitionId', input.processDefinitionId)
  if (input.administrationId) params.set('administrationId', input.administrationId)
  if (input.sort !== 'NEEDS_ACTION') params.set('sort', input.sort)
  const query = params.toString()
  return query ? `?${query}` : ''
}

function assignmentText(item: ProcessWorkItem, labels: ProcessWorkspaceLabels): string {
  const sourceLabels: Record<string, string> = {
    QUEUE: labels.assignmentQueue,
    DIRECT: labels.assignmentDirect,
    SCOPE: labels.assignmentScope,
    PROCESS: labels.assignmentProcess,
  }
  const modeLabels: Record<string, string> = { ANY_ONE: labels.assignmentAnyOne }
  const rawSource = item.assignmentExplanation.source ?? item.receivedVia
  const rawMode = item.assignmentExplanation.assignmentMode ?? item.assignmentMode
  const source = sourceLabels[rawSource] ?? rawSource
  const mode = modeLabels[rawMode] ?? rawMode
  return `${mode} · ${source || labels.unknown}`
}

function workStatusLabel(status: string, labels: ProcessWorkspaceLabels): string {
  const key = statusLabels[status]
  return key ? labels[key] : status.replaceAll('_', ' ')
}

function WorkItemCard({ item, locale, labels }: { item: ProcessWorkItem; locale: Locale; labels: ProcessWorkspaceLabels }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{item.processKey}</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">{item.processTitle}</h2>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${item.isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{item.isOverdue ? labels.overdue : workStatusLabel(item.status, labels)}</span>
      </div>
      <dl className="mt-4 grid gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">{labels.subject}</dt><dd className="font-medium">{item.subjectName ?? labels.unknown}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{labels.step}</dt><dd>{item.stepTitle}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{labels.assignment}</dt><dd>{assignmentText(item, labels)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{labels.deadline}</dt><dd className={item.isOverdue ? 'font-semibold text-destructive' : undefined}>{formatDate(item.deadlineAt, locale)}</dd></div>
      </dl>
      <Link className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={`/work/${item.workItemId}`}>{labels.open}</Link>
    </article>
  )
}

export function ProcessWorkWorkspace({ locale, labels, data, options, tab, search, status, processDefinitionId, administrationId, sort, errorCode }: ProcessWorkspaceProps) {
  const tabs: ProcessWorkTab[] = ['TODO', 'CLAIMED', 'WAITING', 'COMPLETED', 'ALL']
  const errorMessage = errorCode === 'FORBIDDEN' ? labels.denied : labels.readError
  const today = new Date().toISOString().slice(0, 10)
  const overdueCount = data?.items.filter((item) => item.isOverdue).length ?? 0
  const dueTodayCount = data?.items.filter((item) => item.deadlineAt?.slice(0, 10) === today && !item.isOverdue).length ?? 0

  return (
    <section className="mx-auto w-full max-w-[92rem] px-4 py-8 sm:px-6 lg:px-10">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">{labels.workspaceTitle}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{labels.workspaceTitle}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.workspaceDescription}</p></div>
        {data ? <div className="flex flex-wrap items-center justify-end gap-2 text-sm" aria-live="polite"><span className="text-muted-foreground">{data.total}</span>{overdueCount ? <span className="rounded-full bg-destructive-surface px-2.5 py-1 text-xs font-semibold text-destructive">{overdueCount} · {labels.overdue}</span> : null}{dueTodayCount ? <span className="rounded-full bg-warning-surface px-2.5 py-1 text-xs font-semibold text-warning">{dueTodayCount} · {labels.dueToday}</span> : null}</div> : null}
      </header>

      <nav aria-label={labels.workspaceTitle} className="mt-6 flex gap-2 overflow-x-auto border-b border-border pb-px">
        {tabs.map((candidate) => {
          const active = candidate === tab
          return <Link key={candidate} aria-current={active ? 'page' : undefined} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}`} href={`/work${buildQuery({ tab: candidate, search, status, processDefinitionId, administrationId, sort })}`}>{tabLabel(candidate, labels)}</Link>
        })}
      </nav>

      <form className="mt-6 grid gap-3 rounded-2xl border border-border bg-muted/30 p-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(14rem,1.5fr)_repeat(4,minmax(8rem,1fr))_auto]" action="/work" method="get">
        <label className="md:col-span-1"><span className="sr-only">{labels.searchPlaceholder}</span><input className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" defaultValue={search} name="search" placeholder={labels.searchPlaceholder} type="search" /></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground"><span>{labels.statusFilter}</span><select className="h-11 rounded-lg border border-input bg-background px-3 text-sm font-normal text-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary" defaultValue={status} name="status"><option value="">{labels.statusAll}</option>{['OPEN', 'CLAIMED', 'BLOCKED', 'COMPLETED', 'CANCELLED', 'EXPIRED'].map((value) => <option key={value} value={value}>{workStatusLabel(value, labels)}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground"><span>{labels.processFilter}</span><select className="h-11 rounded-lg border border-input bg-background px-3 text-sm font-normal text-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary" defaultValue={processDefinitionId} name="processDefinitionId"><option value="">{labels.processFilter}</option>{options.processes.map((process) => <option key={process.id} value={process.id}>{process.title}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground"><span>{labels.administrationFilter}</span><select className="h-11 rounded-lg border border-input bg-background px-3 text-sm font-normal text-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary" defaultValue={administrationId} name="administrationId"><option value="">{labels.administrationFilter}</option>{options.administrations.map((administration) => <option key={administration.id} value={administration.id}>{administration.name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground"><span>{labels.sort}</span><select className="h-11 rounded-lg border border-input bg-background px-3 text-sm font-normal text-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary" defaultValue={sort} name="sort"><option value="NEEDS_ACTION">{labels.sortNeedsAction}</option><option value="DEADLINE">{labels.sortDeadline}</option></select></label>
        <input name="tab" type="hidden" value={tab} /><button className="min-h-11 self-end rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" type="submit">{labels.applyFilters}</button>
      </form>

      {errorCode ? <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">{errorMessage}</div> : null}
      {!errorCode && data?.items.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground" role="status">{labels.noItems}</div> : null}
      {!errorCode && data && data.items.length > 0 ? <>
        <div className="mt-6 hidden overflow-hidden rounded-2xl border border-border bg-surface shadow-sm md:block">
          <table className="w-full border-collapse text-left text-sm"><caption className="sr-only">{labels.workspaceTitle}</caption><thead className="bg-muted/50 text-xs uppercase tracking-[.1em] text-muted-foreground"><tr><th className="px-4 py-3 font-semibold">{labels.columnsProcess}</th><th className="px-4 py-3 font-semibold">{labels.subject}</th><th className="px-4 py-3 font-semibold">{labels.step}</th><th className="px-4 py-3 font-semibold">{labels.assignment}</th><th className="px-4 py-3 font-semibold">{labels.status}</th><th className="px-4 py-3 font-semibold">{labels.deadline}</th><th className="px-4 py-3 font-semibold"><span className="sr-only">{labels.actions}</span></th></tr></thead><tbody className="divide-y divide-border">{data.items.map((item) => <tr key={item.workItemId} className="transition hover:bg-muted/30"><td className="px-4 py-4"><Link className="font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary" href={`/work/${item.workItemId}`}>{item.processTitle}</Link><p className="mt-1 text-xs text-muted-foreground">{item.processKey}</p></td><td className="px-4 py-4">{item.subjectName ?? labels.unknown}</td><td className="px-4 py-4">{item.stepTitle}</td><td className="px-4 py-4 text-xs">{assignmentText(item, labels)}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{item.isOverdue ? labels.overdue : workStatusLabel(item.status, labels)}</span></td><td className={`px-4 py-4 ${item.isOverdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>{formatDate(item.deadlineAt, locale)}</td><td className="px-4 py-4 text-right"><Link className="rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary" href={`/work/${item.workItemId}`}>{labels.open}</Link></td></tr>)}</tbody></table>
        </div>
        <div className="mt-6 grid gap-4 md:hidden">{data.items.map((item) => <WorkItemCard key={item.workItemId} item={item} locale={locale} labels={labels} />)}</div>
      </> : null}
      {!data && !errorCode ? <div className="mt-6 rounded-2xl border border-border p-6 text-sm text-muted-foreground" role="status">{labels.loading}</div> : null}
    </section>
  )
}
