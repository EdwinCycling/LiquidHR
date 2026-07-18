import { ArrowUpRight, BellRing, Building2, CircleAlert, Sparkles, Users } from 'lucide-react'
import Link from 'next/link'
import type { DashboardWidget } from '@/lib/dashboard/service'
import type { DashboardWidgetData } from '@/lib/dashboard/widget-loaders'
import type { DashboardWidgetPresentation } from '@/lib/dashboard/widget-presentation'

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
  dataSourcePending: string
  widgetError: string
}

export function dashboardWidgetWidthClass(widget: DashboardWidget): string {
  return widget.settings.width === 'FULL' ? 'xl:col-span-6' : widget.settings.width === 'TWO_THIRDS' ? 'xl:col-span-4' : 'xl:col-span-3'
}

export function DashboardWidgetRenderer({ data, labels, presentation, widget }: { data: DashboardWidgetData; labels: DashboardWidgetLabels; presentation: DashboardWidgetPresentation; widget: DashboardWidget }) {
  const width = dashboardWidgetWidthClass(widget)
  if (data.status === 'ready' && data.kind === 'welcome') return (
    <article className={`${width} relative min-h-48 overflow-hidden rounded-2xl border bg-primary px-5 py-6 text-primary-foreground shadow-[0_1rem_2.5rem_color-mix(in_srgb,var(--primary)_22%,transparent)] sm:px-6`}>
      <Sparkles aria-hidden="true" className="absolute -right-3 -top-3 size-24 opacity-15" />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/75">Liquid HR</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">{labels.welcome}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/80">{labels.welcomeBody}</p>
    </article>
  )

  if (data.status === 'empty') return (
    <article className={`${width} flex min-h-48 flex-col rounded-2xl border bg-surface p-5 shadow-sm sm:p-6`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{presentation.categoryLabel}</p>
      <h2 className="mt-2 text-lg font-semibold text-foreground">{presentation.title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{presentation.description}</p>
      <p className="mt-auto pt-6 text-sm font-medium text-muted-foreground">{data.reason === 'DATA_SOURCE_PENDING' ? labels.dataSourcePending : labels.empty}</p>
    </article>
  )

  if (data.status === 'error') return (
    <article className={`${width} flex min-h-48 flex-col rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6`}>
      <CircleAlert aria-hidden="true" className="text-destructive" size={22} />
      <h2 className="mt-4 text-lg font-semibold text-foreground">{presentation.title}</h2>
      <p className="mt-2 text-sm text-destructive">{labels.widgetError}</p>
    </article>
  )

  const content = widget.type === 'MY_REMINDERS'
    ? { icon: BellRing, title: labels.myReminders, href: data.href, link: labels.openReminders }
    : widget.type === 'ORGANIZATION_OVERVIEW'
      ? { icon: Building2, title: labels.organization, href: '/organization-chart', link: labels.openOrganization }
      : { icon: Users, title: labels.employees, href: data.href, link: labels.openEmployees }
  const Icon = content.icon
  return (
    <article className={`${width} group flex min-h-48 flex-col justify-between rounded-2xl border bg-surface p-5 shadow-sm transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-md sm:p-6`}>
      <div className="flex items-start justify-between gap-4"><span className="grid size-10 place-items-center rounded-xl bg-muted text-accent-foreground"><Icon aria-hidden="true" size={20} /></span><ArrowUpRight aria-hidden="true" className="text-muted-foreground" size={18} /></div>
      <div className="mt-8"><h2 className="text-sm font-semibold text-foreground">{content.title}</h2><p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{data.value}</p></div>
      <Link className="mt-5 inline-flex w-fit items-center gap-1 text-sm font-semibold text-accent-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={content.href}>{content.link}<ArrowUpRight aria-hidden="true" size={15} /></Link>
    </article>
  )
}
