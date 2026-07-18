import { ArrowUpRight, BellRing, Building2, Sparkles, Users } from 'lucide-react'
import Link from 'next/link'
import type { DashboardMetrics, DashboardWidget } from '@/lib/dashboard/service'
import { getWidgetCatalogEntry } from '@/lib/dashboard/widget-catalog'
import { MiniChart } from './mini-chart'

export interface DashboardWidgetLabels {
  welcome: string
  welcomeBody: string
  myReminders: string
  organization: string
  employees: string
  openReminders: string
  openOrganization: string
  openEmployees: string
  empty: string
}

export function DashboardWidgetRenderer({ labels, metrics, widget }: { labels: DashboardWidgetLabels; metrics: DashboardMetrics; widget: DashboardWidget }) {
  if (widget.type === 'WELCOME') return (
    <article className="relative overflow-hidden rounded-2xl border bg-primary px-5 py-6 text-primary-foreground shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--primary)_22%,transparent)] sm:px-6">
      <Sparkles aria-hidden="true" className="absolute -right-3 -top-3 size-24 opacity-15" />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/75">Liquid HR</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">{labels.welcome}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/80">{labels.welcomeBody}</p>
    </article>
  )

  const width = widget.settings.width === 'FULL' ? 'xl:col-span-6' : widget.settings.width === 'TWO_THIRDS' ? 'xl:col-span-4' : 'xl:col-span-3'
  const content = widget.type === 'MY_REMINDERS'
    ? { icon: BellRing, title: labels.myReminders, metric: metrics.reminderCount, href: '/reminders', link: labels.openReminders }
    : widget.type === 'ORGANIZATION_OVERVIEW'
      ? { icon: Building2, title: labels.organization, metric: metrics.departmentCount, href: '/organization-chart', link: labels.openOrganization }
      : { icon: Users, title: labels.employees, metric: metrics.employeeCount, href: '/employees', link: labels.openEmployees }
  const Icon = content.icon
  const value = content.metric === null ? labels.empty : String(content.metric)

  if (!['MY_REMINDERS', 'ORGANIZATION_OVERVIEW', 'EMPLOYEE_OVERVIEW'].includes(widget.type)) {
    const entry = getWidgetCatalogEntry(widget.type)
    const label = entry?.titleKey.split('.').pop()?.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase()) ?? widget.type
    const isChart = entry?.visualization === 'BAR' || entry?.visualization === 'DONUT'
    return <article className={`${width} group flex min-h-48 flex-col justify-between rounded-2xl border bg-surface p-5 shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md sm:p-6`}><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{entry?.category ?? 'HR'}</p><h2 className="mt-2 text-lg font-semibold">{label}</h2><p className="mt-1 text-sm text-muted-foreground">{entry?.descriptionKey ?? ''}</p></div>{isChart ? <MiniChart kind={entry?.visualization === 'DONUT' ? 'donut' : 'bar'} values={[{ name: 'Actief', value: metrics.employeeCount ?? 0 }, { name: 'Teams', value: metrics.departmentCount ?? 0 }, { name: 'Reminders', value: metrics.reminderCount }]} /> : <p className="mt-5 text-3xl font-semibold">{metrics.employeeCount ?? '—'}</p>}</article>
  }

  return (
    <article className={`${width} group flex min-h-48 flex-col justify-between rounded-2xl border bg-surface p-5 shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md sm:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-10 place-items-center rounded-xl bg-muted text-accent-foreground"><Icon aria-hidden="true" size={20} /></span>
        <ArrowUpRight aria-hidden="true" className="text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={18} />
      </div>
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">{content.title}</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      </div>
      <Link className="mt-5 inline-flex w-fit items-center gap-1 text-sm font-semibold text-accent-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={content.href}>{content.link}<ArrowUpRight aria-hidden="true" size={15} /></Link>
    </article>
  )
}
