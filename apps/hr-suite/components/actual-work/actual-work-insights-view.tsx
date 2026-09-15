import Link from 'next/link'
import type { getActualWorkInsights } from '@/lib/actual-work/actual-work-service'
import { PageShell } from '@/components/layout/page-shell'
import { PageHeader } from '@/components/patterns/page-header'
import { Surface } from '@/components/ui/surface'

type ActualWorkInsightsReport = Awaited<ReturnType<typeof getActualWorkInsights>>

export type ActualWorkInsightsLabels = {
  title: string
  description: string
  month: string
  entries: string
  hours: string
  corrections: string
  family: string
  employee: string
  type: string
  date: string
  empty: string
  back: string
  familyWork: string
  familyAdditional: string
  familyOvertime: string
  familyTransparent: string
}

function familyLabel(family: string, labels: ActualWorkInsightsLabels): string {
  if (family === 'ADDITIONAL') return labels.familyAdditional
  if (family === 'OVERTIME') return labels.familyOvertime
  if (family === 'TRANSPARENT') return labels.familyTransparent
  return labels.familyWork
}

export function ActualWorkInsightsView({ labels, report, backHref = '/insights' }: {
  labels: ActualWorkInsightsLabels
  report: ActualWorkInsightsReport
  backHref?: string
}) {
  return <PageShell className="space-y-6 py-6 sm:py-8" width="wide">
    <PageHeader actions={<Link className="inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-raised" href={backHref}>{labels.back}</Link>} description={labels.description} title={labels.title + ' · ' + report.month} />
    <div className="grid gap-4 md:grid-cols-3"><Surface className="p-5"><p className="text-xs font-semibold uppercase tracking-[.08em] text-muted-foreground">{labels.entries}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{String(report.totalEntries)}</p></Surface><Surface className="p-5"><p className="text-xs font-semibold uppercase tracking-[.08em] text-muted-foreground">{labels.hours}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{String(Object.values(report.totals).reduce((total, value) => total + value, 0))}</p></Surface><Surface className="p-5"><p className="text-xs font-semibold uppercase tracking-[.08em] text-muted-foreground">{labels.corrections}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{String(report.corrections)}</p></Surface></div>
    <Surface className="p-5">
      {report.rows.length === 0 ? <p className="rounded-[var(--radius-control)] border border-dashed p-8 text-center text-sm text-muted-foreground">{labels.empty}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-[.08em] text-muted-foreground"><tr><th className="px-3 py-3">{labels.date}</th><th className="px-3 py-3">{labels.employee}</th><th className="px-3 py-3">{labels.type}</th><th className="px-3 py-3">{labels.family}</th><th className="px-3 py-3">{labels.hours}</th></tr></thead><tbody className="divide-y">{report.rows.map((row) => <tr key={row.id}><td className="px-3 py-3">{row.work_date}</td><td className="px-3 py-3">{[row.employee.first_name, row.employee.birth_name_prefix, row.employee.birth_name].filter(Boolean).join(' ')}</td><td className="px-3 py-3"><Link className="font-medium text-primary hover:underline" href={'/employees/' + row.employee.id + '/hours?employmentId=' + row.employment_id + '&month=' + report.month.slice(0, 7)}>{row.type.name}</Link></td><td className="px-3 py-3">{familyLabel(row.type.family, labels)}</td><td className="px-3 py-3 tabular-nums">{String(row.hours)}</td></tr>)}</tbody></table></div>}
    </Surface>
  </PageShell>
}
