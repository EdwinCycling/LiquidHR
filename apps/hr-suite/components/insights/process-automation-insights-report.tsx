import Link from 'next/link'
import { Button, buttonClasses } from '@/components/ui/button'
import type { ProcessInsightsQuery, ProcessInsightsReport } from '@/lib/insights/process-automation-insights'

export interface ProcessAutomationInsightsLabels {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly back: string
  readonly from: string
  readonly to: string
  readonly allProcesses: string
  readonly apply: string
  readonly summary: string
  readonly started: string
  readonly completed: string
  readonly runningNow: string
  readonly leadTime: string
  readonly average: string
  readonly median: string
  readonly slaPerformance: string
  readonly withinSla: string
  readonly outsideSla: string
  readonly rejected: string
  readonly cancelled: string
  readonly comparison: string
  readonly process: string
  readonly version: string
  readonly step: string
  readonly viewDetails: string
  readonly bottlenecks: string
  readonly waitForFirstClaim: string
  readonly waitSamples: string
  readonly awaitingFirstClaim: string
  readonly repeatedSlaOverrun: string
  readonly noSlaData: string
  readonly noDurationData: string
  readonly noRows: string
  readonly noProcesses: string
  readonly emptyTitle: string
  readonly emptyDescription: string
  readonly deniedTitle: string
  readonly deniedDescription: string
  readonly errorTitle: string
  readonly errorDescription: string
  readonly invalidFilters: string
  readonly pagination: string
  readonly previous: string
  readonly next: string
  readonly pageOf: string
  readonly calculations: string
  readonly periodRule: string
  readonly leadRule: string
  readonly waitRule: string
  readonly slaRule: string
  readonly versionRule: string
  readonly cancelledRejectedRule: string
  readonly durationDays: string
  readonly durationHours: string
  readonly durationMinutes: string
  readonly noSampleDetails: string
}

interface Props {
  readonly labels: ProcessAutomationInsightsLabels
  readonly locale: string
  readonly query: ProcessInsightsQuery | null
  readonly report: ProcessInsightsReport | null
  readonly state: 'ready' | 'denied' | 'error' | 'invalid'
}

function duration(seconds: number | null, locale: string, labels: ProcessAutomationInsightsLabels): string {
  if (seconds === null) return labels.noDurationData
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  if (seconds < 3600) return `${formatter.format(Math.max(1, Math.round(seconds / 60)))} ${labels.durationMinutes}`
  if (seconds < 86400) return `${formatter.format(seconds / 3600)} ${labels.durationHours}`
  return `${formatter.format(seconds / 86400)} ${labels.durationDays}`
}

function rate(within: number, denominator: number, locale: string, labels: ProcessAutomationInsightsLabels): string {
  if (denominator === 0) return labels.noSlaData
  return `${new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(within / denominator)} (${within}/${denominator})`
}

function pageHref(query: ProcessInsightsQuery, page: number): string {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
    page: String(page),
  })
  if (query.process) params.set('process', query.process)
  return `/insights/process-automation?${params.toString()}`
}

function countLabel(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value)
}

export function ProcessAutomationInsightsReport({ labels, locale, query, report, state }: Props) {
  if (state !== 'ready' || !query || !report) {
    const content = state === 'denied'
      ? [labels.deniedTitle, labels.deniedDescription]
      : state === 'invalid'
        ? [labels.invalidFilters, labels.invalidFilters]
        : [labels.errorTitle, labels.errorDescription]
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <p className="eyebrow">{labels.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels.title}</h1>
        <section aria-live="polite" className="mt-6 rounded-[var(--radius-surface)] border border-border bg-surface p-6">
          <h2 className="font-semibold">{content[0]}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{content[1]}</p>
        </section>
        <Link className="mt-5 inline-flex rounded-[var(--radius-control)] text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/insights">{labels.back}</Link>
      </main>
    )
  }

  const maxPage = Math.max(1, Math.ceil(Math.max(report.processTotal, report.stepTotal) / report.pageSize))
  const summary = report.summary
  const kpis = [
    { label: labels.started, value: countLabel(summary.started, locale) },
    { label: labels.completed, value: countLabel(summary.completed, locale) },
    { label: labels.runningNow, value: countLabel(summary.runningNow, locale) },
    { label: labels.leadTime, value: `${duration(summary.averageLeadSeconds, locale, labels)} / ${duration(summary.medianLeadSeconds, locale, labels)}`, detail: `${labels.average} / ${labels.median}` },
    { label: labels.slaPerformance, value: rate(summary.slaWithin, summary.slaDenominator, locale, labels), detail: `${labels.outsideSla}: ${countLabel(summary.slaOutside, locale)}` },
  ]
  const hasData = report.processTotal > 0 || report.stepTotal > 0

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
      <div className="mb-5"><Link className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="/insights">{labels.back}</Link></div>
      <header className="border-b border-border pb-6">
        <p className="eyebrow">{labels.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{labels.description}</p>
      </header>

      <form action="/insights/process-automation" className="mt-6 grid grid-cols-1 items-end gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(14rem,1.5fr)_auto]" method="get">
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="process-insights-from">
          {labels.from}
          <input className="min-h-10 rounded-[var(--radius-control)] border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" id="process-insights-from" name="from" required type="date" value={query.from} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="process-insights-to">
          {labels.to}
          <input className="min-h-10 rounded-[var(--radius-control)] border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" id="process-insights-to" name="to" required type="date" value={query.to} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="process-insights-process">
          {labels.process}
          <select className="min-h-10 rounded-[var(--radius-control)] border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" id="process-insights-process" name="process" value={query.process ?? ''}>
            <option value="">{labels.allProcesses}</option>
            {report.processOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
          </select>
        </label>
        <Button size="md" type="submit">{labels.apply}</Button>
      </form>

      {!hasData ? (
        <section aria-live="polite" className="mt-6 rounded-[var(--radius-surface)] border border-border bg-surface p-6">
          <h2 className="font-semibold">{labels.emptyTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{report.processOptions.length ? labels.emptyDescription : labels.noProcesses}</p>
        </section>
      ) : (
        <>
          <section aria-labelledby="process-insights-summary" className="mt-7">
            <h2 className="mb-3 text-lg font-semibold" id="process-insights-summary">{labels.summary}</h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {kpis.map((kpi) => (
                <div className="min-w-0 rounded-[var(--radius-surface)] border border-border bg-surface p-4" key={kpi.label}>
                  <dt className="text-sm text-muted-foreground">{kpi.label}</dt>
                  <dd className="mt-2 break-words text-xl font-semibold tabular-nums">{kpi.value}</dd>
                  {kpi.detail ? <p className="mt-1 text-xs text-muted-foreground">{kpi.detail}</p> : null}
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-muted-foreground">{labels.rejected}: {countLabel(summary.rejected, locale)} · {labels.cancelled}: {countLabel(summary.cancelled, locale)}</p>
          </section>

          <section aria-labelledby="process-insights-comparison" className="mt-8 rounded-[var(--radius-surface)] border border-border bg-surface">
            <div className="border-b border-border px-4 py-4 sm:px-5">
              <h2 className="font-semibold" id="process-insights-comparison">{labels.comparison}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{labels.pageOf.replace('{page}', String(query.page)).replace('{pages}', String(maxPage))} · {countLabel(report.processTotal, locale)}</p>
            </div>
            {report.processes.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">{labels.noRows}</p> : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="bg-muted/50 text-xs font-medium text-muted-foreground"><tr>
                      <th className="px-5 py-3">{labels.process}</th><th className="px-5 py-3">{labels.started}</th><th className="px-5 py-3">{labels.completed}</th><th className="px-5 py-3">{labels.runningNow}</th><th className="px-5 py-3">{labels.leadTime}</th><th className="px-5 py-3">{labels.slaPerformance}</th><th className="px-5 py-3"><span className="sr-only">{labels.viewDetails}</span></th>
                    </tr></thead>
                    <tbody className="divide-y divide-border">{report.processes.map((row) => (
                      <tr key={`${row.processDefinitionId}-${row.versionNumber}`}>
                        <th className="px-5 py-3 font-medium">{row.processTitle}<span className="ml-2 text-xs text-muted-foreground">{labels.version} {row.versionNumber}</span></th>
                        <td className="px-5 py-3 tabular-nums">{countLabel(row.started, locale)}</td><td className="px-5 py-3 tabular-nums">{countLabel(row.completed, locale)}</td><td className="px-5 py-3 tabular-nums">{countLabel(row.runningNow, locale)}</td>
                        <td className="px-5 py-3">{duration(row.averageLeadSeconds, locale, labels)} / {duration(row.medianLeadSeconds, locale, labels)}</td>
                        <td className="px-5 py-3">{rate(row.slaWithin, row.slaDenominator, locale, labels)}<span className="mt-1 block text-xs text-muted-foreground">{labels.outsideSla}: {countLabel(row.slaOutside, locale)}</span></td>
                        <td className="px-5 py-3">{row.sampleWorkItemId ? <Link aria-label={`${labels.viewDetails}: ${row.processTitle}, ${labels.version} ${row.versionNumber}`} className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/work/${row.sampleWorkItemId}`}>{labels.viewDetails}</Link> : <span className="text-xs text-muted-foreground">{labels.noSampleDetails}</span>}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="divide-y divide-border lg:hidden">{report.processes.map((row) => (
                  <article className="p-4 sm:p-5" key={`${row.processDefinitionId}-${row.versionNumber}`}>
                    <h3 className="font-medium">{row.processTitle}<span className="ml-2 text-xs text-muted-foreground">{labels.version} {row.versionNumber}</span></h3>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div><dt className="text-xs text-muted-foreground">{labels.started}</dt><dd className="mt-1 tabular-nums">{countLabel(row.started, locale)}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">{labels.completed}</dt><dd className="mt-1 tabular-nums">{countLabel(row.completed, locale)}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">{labels.runningNow}</dt><dd className="mt-1 tabular-nums">{countLabel(row.runningNow, locale)}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">{labels.leadTime}</dt><dd className="mt-1">{duration(row.averageLeadSeconds, locale, labels)} / {duration(row.medianLeadSeconds, locale, labels)}</dd></div>
                      <div className="col-span-2"><dt className="text-xs text-muted-foreground">{labels.slaPerformance}</dt><dd className="mt-1">{rate(row.slaWithin, row.slaDenominator, locale, labels)} · {labels.outsideSla}: {countLabel(row.slaOutside, locale)}</dd></div>
                    </dl>
                    {row.sampleWorkItemId ? <Link aria-label={`${labels.viewDetails}: ${row.processTitle}, ${labels.version} ${row.versionNumber}`} className="mt-4 inline-flex min-h-10 items-center rounded-[var(--radius-control)] font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href={`/work/${row.sampleWorkItemId}`}>{labels.viewDetails}</Link> : <p className="mt-3 text-xs text-muted-foreground">{labels.noSampleDetails}</p>}
                  </article>
                ))}</div>
              </>
            )}
          </section>

          <section aria-labelledby="process-insights-bottlenecks" className="mt-8 rounded-[var(--radius-surface)] border border-border bg-surface">
            <div className="border-b border-border px-4 py-4 sm:px-5">
              <h2 className="font-semibold" id="process-insights-bottlenecks">{labels.bottlenecks}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{labels.pageOf.replace('{page}', String(query.page)).replace('{pages}', String(maxPage))} · {countLabel(report.stepTotal, locale)}</p>
            </div>
            {report.steps.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">{labels.noRows}</p> : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-muted/50 text-xs font-medium text-muted-foreground"><tr><th className="px-5 py-3">{labels.process} / {labels.step}</th><th className="px-5 py-3">{labels.waitForFirstClaim}</th><th className="px-5 py-3">{labels.waitSamples}</th><th className="px-5 py-3">{labels.awaitingFirstClaim}</th><th className="px-5 py-3">{labels.slaPerformance}</th></tr></thead>
                    <tbody className="divide-y divide-border">{report.steps.map((row) => (
                      <tr key={`${row.processTitle}-${row.versionNumber}-${row.stepTitle}`}>
                        <th className="px-5 py-3 font-medium">{row.processTitle}<span className="ml-2 text-xs text-muted-foreground">{labels.version} {row.versionNumber}</span><span className="mt-1 block font-normal text-muted-foreground">{row.stepTitle}</span></th>
                        <td className="px-5 py-3">{duration(row.averageWaitSeconds, locale, labels)} / {duration(row.medianWaitSeconds, locale, labels)}</td><td className="px-5 py-3 tabular-nums">{countLabel(row.waitSampleCount, locale)}</td><td className="px-5 py-3 tabular-nums">{countLabel(row.awaitingFirstClaimCount, locale)}</td>
                        <td className="px-5 py-3">{rate(row.slaWithin, row.slaDenominator, locale, labels)}<span className="mt-1 block text-xs text-muted-foreground">{labels.outsideSla}: {countLabel(row.slaOutside, locale)}</span>{row.slaOutside >= 2 ? <span className="mt-1 block text-xs font-medium">{labels.repeatedSlaOverrun}</span> : null}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="divide-y divide-border lg:hidden">{report.steps.map((row) => (
                  <article className="p-4 sm:p-5" key={`${row.processTitle}-${row.versionNumber}-${row.stepTitle}`}>
                    <h3 className="font-medium">{row.processTitle}<span className="ml-2 text-xs text-muted-foreground">{labels.version} {row.versionNumber}</span></h3><p className="mt-1 text-sm text-muted-foreground">{row.stepTitle}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div><dt className="text-xs text-muted-foreground">{labels.waitForFirstClaim}</dt><dd className="mt-1">{duration(row.averageWaitSeconds, locale, labels)} / {duration(row.medianWaitSeconds, locale, labels)}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">{labels.waitSamples}</dt><dd className="mt-1 tabular-nums">{countLabel(row.waitSampleCount, locale)}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">{labels.awaitingFirstClaim}</dt><dd className="mt-1 tabular-nums">{countLabel(row.awaitingFirstClaimCount, locale)}</dd></div>
                      <div><dt className="text-xs text-muted-foreground">{labels.slaPerformance}</dt><dd className="mt-1">{rate(row.slaWithin, row.slaDenominator, locale, labels)} · {labels.outsideSla}: {countLabel(row.slaOutside, locale)}{row.slaOutside >= 2 ? <span className="mt-1 block text-xs font-medium">{labels.repeatedSlaOverrun}</span> : null}</dd></div>
                    </dl>
                  </article>
                ))}</div>
              </>
            )}
          </section>

          <nav aria-label={labels.pagination} className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{labels.pageOf.replace('{page}', String(query.page)).replace('{pages}', String(maxPage))}</span>
            <div className="flex items-center gap-2">
              {query.page <= 1
                ? <span aria-disabled="true" className="inline-flex min-h-8 items-center rounded-[var(--radius-control)] border border-border px-3 text-sm text-muted-foreground opacity-60">{labels.previous}</span>
                : <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={pageHref(query, query.page - 1)}>{labels.previous}</Link>}
              {query.page >= maxPage
                ? <span aria-disabled="true" className="inline-flex min-h-8 items-center rounded-[var(--radius-control)] border border-border px-3 text-sm text-muted-foreground opacity-60">{labels.next}</span>
                : <Link className={buttonClasses({ size: 'sm', variant: 'secondary' })} href={pageHref(query, query.page + 1)}>{labels.next}</Link>}
            </div>
          </nav>

          <details className="mt-7 border-t border-border py-4">
            <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">{labels.calculations}</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>{labels.periodRule}</li>
              <li>{labels.leadRule}</li>
              <li>{labels.waitRule}</li>
              <li>{labels.slaRule}</li>
              <li>{labels.versionRule}</li>
              <li>{labels.cancelledRejectedRule}</li>
            </ul>
          </details>
        </>
      )}
    </main>
  )
}
