'use client'

import { Activity, CheckCircle2, CircleDashed, Coins, ListChecks } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { SectionHeader } from '@/components/patterns/section-header'
import { AI_USAGE_PERIODS, aiUsageQueryParams, type AiUsagePeriod, type AiUsageQuery } from '@/lib/insights/ai-usage-query'
import type { AiUsageBreakdownRow, AiUsageCapability, AiUsageQuality, AiUsageReport, AiUsageStatus } from '@/lib/insights/ai-usage-types'

export interface AiUsageLabels {
  title: string
  description: string
  period: string
  periodThisMonth: string
  periodLast7Days: string
  periodLast30Days: string
  periodLast90Days: string
  periodNote: string
  creditsRemaining: string
  creditsUsed: string
  requests: string
  successRate: string
  notAvailable: string
  credits: string
  requestUnit: string
  requestsUnit: string
  usageTrend: string
  capabilities: string
  quality: string
  status: string
  successful: string
  failed: string
  rejected: string
  inProgress: string
  otherStatus: string
  improveText: string
  otherCapability: string
  efficient: string
  balanced: string
  inDepth: string
  unknown: string
  completedRequests: string
  noUsageTitle: string
  noUsageDescription: string
  creditsAccountingNote: string
}

const periodLabelKeys: Record<AiUsagePeriod, keyof Pick<AiUsageLabels, 'periodThisMonth' | 'periodLast7Days' | 'periodLast30Days' | 'periodLast90Days'>> = {
  'this-month': 'periodThisMonth',
  'last-7-days': 'periodLast7Days',
  'last-30-days': 'periodLast30Days',
  'last-90-days': 'periodLast90Days',
}

function numberFormat(locale: string): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
}

function percentFormat(value: number | null, labels: AiUsageLabels, locale: string): string {
  return value === null ? labels.notAvailable : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`
}

function labelForCapability(value: AiUsageCapability, labels: AiUsageLabels): string {
  return value === 'IMPROVE_TEXT' ? labels.improveText : labels.otherCapability
}

function labelForQuality(value: AiUsageQuality, labels: AiUsageLabels): string {
  if (value === 'EFFICIENT') return labels.efficient
  if (value === 'BALANCED') return labels.balanced
  if (value === 'IN_DEPTH') return labels.inDepth
  return labels.unknown
}

function labelForStatus(value: AiUsageStatus, labels: AiUsageLabels): string {
  if (value === 'SUCCEEDED') return labels.successful
  if (value === 'FAILED') return labels.failed
  if (value === 'REJECTED') return labels.rejected
  if (value === 'IN_PROGRESS') return labels.inProgress
  return labels.otherStatus
}

function statusTone(value: AiUsageStatus): BadgeTone {
  if (value === 'SUCCEEDED') return 'success'
  if (value === 'FAILED') return 'danger'
  if (value === 'REJECTED') return 'warning'
  if (value === 'IN_PROGRESS') return 'info'
  return 'neutral'
}

function Kpi({ icon, label, value, description }: { icon: React.ReactNode; label: string; value: string; description: string }) {
  return <Surface className="min-w-0 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-2 truncate text-2xl font-semibold tabular-nums text-foreground">{value}</p>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div><span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-muted text-primary">{icon}</span></div></Surface>
}

function TrendChart({ report, labels, locale }: { report: AiUsageReport; labels: AiUsageLabels; locale: string }) {
  const maxCredits = Math.max(...report.trend.map((point) => point.creditsUsed), 1)
  const maxRequests = Math.max(...report.trend.map((point) => point.requests), 1)
  const labelInterval = Math.max(1, Math.ceil((report.trend.length - 1) / 9))
  const points = report.trend.map((point, index) => `${report.trend.length === 1 ? 376 : 60 + (index / (report.trend.length - 1)) * 632},${184 - (point.creditsUsed / maxCredits) * 150}`).join(' ')
  const dateFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
  return <div className="mt-4 overflow-x-auto rounded-[var(--radius-surface)] border border-subtle bg-surface-subtle p-3"><svg aria-label={labels.usageTrend} className="h-64 min-w-[42rem] w-full" role="img" viewBox="0 0 720 220"><line stroke="currentColor" strokeOpacity=".15" x1="60" x2="692" y1="184" y2="184" /><line stroke="currentColor" strokeOpacity=".12" x1="60" x2="692" y1="109" y2="109" /><line stroke="currentColor" strokeOpacity=".12" x1="60" x2="692" y1="34" y2="34" /><text fill="currentColor" fontSize="11" textAnchor="end" x="52" y="188">0</text><text fill="currentColor" fontSize="11" textAnchor="end" x="52" y="38">{maxCredits}</text><polyline fill="none" points={points} stroke="var(--chart-2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />{report.trend.map((point, index) => { const x = report.trend.length === 1 ? 376 : 60 + (index / (report.trend.length - 1)) * 632; const y = 184 - (point.creditsUsed / maxCredits) * 150; const height = (point.requests / maxRequests) * 24; const showLabel = index === 0 || index === report.trend.length - 1 || index % labelInterval === 0; const date = new Date(`${point.date}T12:00:00Z`); return <g key={point.date}><rect fill="var(--chart-3)" height={height} opacity=".55" width="10" x={x - 5} y={184 - height} /><circle cx={x} cy={y} fill="var(--chart-2)" r="5" />{showLabel ? <text fill="currentColor" fontSize="10" textAnchor="middle" x={x} y="207">{dateFormatter.format(date)}</text> : null}<title>{`${point.date}: ${point.creditsUsed} ${labels.credits}, ${point.requests} ${point.requests === 1 ? labels.requestUnit : labels.requestsUnit}`}</title></g> })}</svg></div>
}

function BreakdownTable<T extends string>({ rows, labelFor, labels, locale }: { rows: readonly AiUsageBreakdownRow<T>[]; labelFor: (value: T) => string; labels: AiUsageLabels; locale: string }) {
  const format = numberFormat(locale)
  return <div className="overflow-x-auto"><table className="w-full min-w-[28rem] text-left text-sm"><thead className="border-b border-subtle text-xs uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-4 py-3">{labels.completedRequests}</th><th className="px-4 py-3 text-right">{labels.requests}</th><th className="px-4 py-3 text-right">{labels.creditsUsed}</th></tr></thead><tbody className="divide-y divide-subtle">{rows.map((row) => <tr key={row.key}><th className="px-4 py-3 font-medium">{labelFor(row.key)}</th><td className="px-4 py-3 text-right tabular-nums">{format.format(row.requests)}</td><td className="px-4 py-3 text-right tabular-nums">{format.format(row.creditsUsed)} {labels.credits}</td></tr>)}</tbody></table></div>
}

function StatusTable({ rows, labels, locale }: { rows: readonly AiUsageBreakdownRow<AiUsageStatus>[]; labels: AiUsageLabels; locale: string }) {
  const format = numberFormat(locale)
  return <div className="overflow-x-auto"><table className="w-full min-w-[28rem] text-left text-sm"><thead className="border-b border-subtle text-xs uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-4 py-3">{labels.status}</th><th className="px-4 py-3 text-right">{labels.requests}</th></tr></thead><tbody className="divide-y divide-subtle">{rows.map((row) => <tr key={row.key}><th className="px-4 py-3 font-medium"><Badge tone={statusTone(row.key)}>{labelForStatus(row.key, labels)}</Badge></th><td className="px-4 py-3 text-right tabular-nums">{format.format(row.requests)}</td></tr>)}</tbody></table></div>
}

export function AiUsageReportView({ query, report, labels, locale }: { query: AiUsageQuery; report: AiUsageReport; labels: AiUsageLabels; locale: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const format = numberFormat(locale)
  const hasUsage = report.requests > 0 || report.byFeature.length > 0 || report.byQuality.length > 0

  function changePeriod(period: AiUsagePeriod): void {
    const params = new URLSearchParams(searchParams.toString())
    const nextQuery = { report: 'ai-usage' as const, period }
    for (const [key, value] of aiUsageQueryParams(nextQuery)) params.set(key, value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return <div className="min-w-0 space-y-6"><SectionHeader description={labels.description} title={labels.title} /><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><label className="flex min-w-48 max-w-xs flex-col gap-1.5 text-sm font-medium"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.period}</span><DropdownSelect aria-label={labels.period} onChange={(event) => { const next = AI_USAGE_PERIODS.find((value) => value === event.target.value); if (next) changePeriod(next) }} value={query.period}>{AI_USAGE_PERIODS.map((period) => <option key={period} value={period}>{labels[periodLabelKeys[period]]}</option>)}</DropdownSelect></label><p className="max-w-xl text-sm text-muted-foreground">{labels.periodNote}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi description={labels.credits} icon={<Coins aria-hidden="true" size={18} />} label={labels.creditsRemaining} value={format.format(report.creditsRemaining)} /><Kpi description={labels.creditsAccountingNote} icon={<Activity aria-hidden="true" size={18} />} label={labels.creditsUsed} value={format.format(report.creditsUsed)} /><Kpi description={report.requests === 1 ? labels.requestUnit : labels.requestsUnit} icon={<ListChecks aria-hidden="true" size={18} />} label={labels.requests} value={format.format(report.requests)} /><Kpi description={labels.completedRequests} icon={<CheckCircle2 aria-hidden="true" size={18} />} label={labels.successRate} value={percentFormat(report.successRate, labels, locale)} /></div>{hasUsage ? <><Surface className="p-4 sm:p-5"><SectionHeader description={labels.creditsAccountingNote} title={labels.usageTrend} /><TrendChart labels={labels} locale={locale} report={report} /></Surface><div className="grid gap-4 lg:grid-cols-2"><Surface className="min-w-0 overflow-hidden"><div className="border-b border-subtle p-4"><SectionHeader title={labels.capabilities} /></div><BreakdownTable labelFor={(value) => labelForCapability(value, labels)} labels={labels} locale={locale} rows={report.byFeature} /></Surface><Surface className="min-w-0 overflow-hidden"><div className="border-b border-subtle p-4"><SectionHeader title={labels.quality} /></div><BreakdownTable labelFor={(value) => labelForQuality(value, labels)} labels={labels} locale={locale} rows={report.byQuality} /></Surface><Surface className="min-w-0 overflow-hidden lg:col-span-2"><div className="border-b border-subtle p-4"><SectionHeader title={labels.status} /></div><StatusTable labels={labels} locale={locale} rows={report.byStatus} /></Surface></div></> : <EmptyState description={labels.noUsageDescription} icon={<CircleDashed />} title={labels.noUsageTitle} />}</div>
}
