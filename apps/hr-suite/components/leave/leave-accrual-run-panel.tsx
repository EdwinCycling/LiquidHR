'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { DataTableShell } from '@/components/patterns/data-table-shell'

type PreviewItem = {
  employeeId: string
  employeeName: string
  employmentId: string
  leaveTypeName: string
  profileName: string | null
  ruleId: string | null
  basis: string | null
  frequency: string | null
  periodStart: string
  periodEnd: string
  migrationCutoverDate: string | null
  calculatedAmount: number
  alreadyPostedAmount: number
  deltaToPost: number
  status: string
  reason: string | null
}

type Preview = {
  year: number
  yearStatus: 'ACTIVE' | 'OPEN_FOR_FUTURE_REQUESTS' | 'LOCKED' | null
  items: PreviewItem[]
  totals: { calculatedAmount: number; alreadyPostedAmount: number; deltaToPost: number }
}

type PostResult = {
  posted: number
  transactionIds: string[]
  preview: Preview
}

export type LeaveAccrualRunPanelLabels = {
  title: string
  description: string
  year: string
  preview: string
  post: string
  posting: string
  refresh: string
  employee: string
  leaveType: string
  profile: string
  rule: string
  period: string
  migrationCutover: string
  calculated: string
  posted: string
  delta: string
  status: string
  totals: string
  empty: string
  previewRequired: string
  updated: string
  failed: string
  locked: string
  ready: string
  alreadyPosted: string
  deltaRequired: string
  noRule: string
  noProfile: string
  sourceNotReady: string
}

function statusLabel(status: string, labels: LeaveAccrualRunPanelLabels): string {
  const values: Record<string, string> = {
    LOCKED_YEAR: labels.locked,
    READY: labels.ready,
    ALREADY_POSTED: labels.alreadyPosted,
    DELTA_REQUIRED: labels.deltaRequired,
    NO_RULE: labels.noRule,
    NO_PROFILE: labels.noProfile,
    SOURCE_NOT_READY: labels.sourceNotReady,
  }
  return values[status] ?? status
}

function statusTone(status: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  if (status === 'READY' || status === 'DELTA_REQUIRED') return 'success'
  if (status === 'ALREADY_POSTED') return 'info'
  if (status === 'LOCKED_YEAR') return 'neutral'
  if (status === 'NO_RULE' || status === 'NO_PROFILE') return 'warning'
  return 'danger'
}

function hours(value: number): string {
  return new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value)
}

export function LeaveAccrualRunPanel({ labels }: { labels: LeaveAccrualRunPanelLabels }) {
  const searchParams = useSearchParams()
  const employeeId = searchParams.get('employeeId')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function request(path: string): Promise<void> {
    const isPost = path.endsWith('/post')
    setError(false)
    setNotice(null)
    if (isPost) setPosting(true)
    else setLoading(true)
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ year: Number(year), ...(employeeId ? { employeeId } : {}) }) })
      const payload = await response.json() as { data?: Preview | PostResult; error?: string; details?: { preview?: Preview } }
      if (!response.ok) {
        if (payload.details?.preview) setPreview(payload.details.preview)
        throw new Error(payload.error ?? 'LEAVE_ACCRUAL_OPERATION_FAILED')
      }
      const nextPreview = isPost
        ? (payload.data && 'preview' in payload.data ? payload.data.preview : null)
        : (payload.data && 'items' in payload.data ? payload.data : null)
      if (nextPreview) setPreview(nextPreview)
      if (isPost) setNotice(labels.updated)
    } catch {
      setError(true)
      setNotice(labels.failed)
    } finally {
      setLoading(false)
      setPosting(false)
    }
  }

  const canPost = Boolean(preview && preview.yearStatus !== 'LOCKED' && preview.items.some((item) => (item.status === 'READY' || item.status === 'DELTA_REQUIRED') && item.deltaToPost !== 0))

  return <Surface className="p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-lg font-semibold">{labels.title}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{labels.description}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          <span>{labels.year}</span>
          <select aria-label={labels.year} className="min-h-10 rounded-[var(--radius-control)] border border-subtle bg-surface px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" value={year} onChange={(event) => { setYear(event.target.value); setPreview(null); setNotice(null) }}>
            {Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - 2 + index).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <Button disabled={loading || posting} loading={loading} onClick={() => { void request('/api/leave/accrual/preview') }} type="button" variant="secondary">{labels.preview}</Button>
        <Button disabled={!canPost || loading || posting} loading={posting} onClick={() => { void request('/api/leave/accrual/post') }} type="button">{posting ? labels.posting : labels.post}</Button>
      </div>
    </div>
    {notice ? <p className={`mt-4 rounded-[var(--radius-control)] p-3 text-sm ${error ? 'bg-destructive-surface text-destructive' : 'bg-accent text-accent-foreground'}`} role={error ? 'alert' : 'status'}>{notice}</p> : null}
    {!preview ? <EmptyState className="mt-5" title={labels.previewRequired} description={labels.empty} /> : preview.items.length === 0 ? <EmptyState className="mt-5" title={labels.empty} /> : <>
      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3"><div className="text-muted-foreground">{labels.calculated}</div><div className="mt-1 text-lg font-semibold">{hours(preview.totals.calculatedAmount)}</div></div>
        <div className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3"><div className="text-muted-foreground">{labels.posted}</div><div className="mt-1 text-lg font-semibold">{hours(preview.totals.alreadyPostedAmount)}</div></div>
        <div className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3"><div className="text-muted-foreground">{labels.delta}</div><div className="mt-1 text-lg font-semibold">{hours(preview.totals.deltaToPost)}</div></div>
      </div>
      <DataTableShell className="mt-5" caption={labels.title}>
        <thead className="border-b text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-3 py-2">{labels.employee}</th><th className="px-3 py-2">{labels.leaveType}</th><th className="px-3 py-2">{labels.profile} / {labels.rule}</th><th className="px-3 py-2">{labels.period}</th><th className="px-3 py-2 text-right">{labels.calculated}</th><th className="px-3 py-2 text-right">{labels.posted}</th><th className="px-3 py-2 text-right">{labels.delta}</th><th className="px-3 py-2">{labels.status}</th></tr></thead>
        <tbody className="divide-y">{preview.items.map((item) => <tr key={`${item.employmentId}:${item.leaveTypeName}:${item.periodStart}`}><td className="px-3 py-3 font-medium">{item.employeeName}</td><td className="px-3 py-3">{item.leaveTypeName}</td><td className="px-3 py-3"><div>{item.profileName ?? '—'}</div><div className="text-xs text-muted-foreground">{item.basis ?? '—'}{item.frequency ? ` · ${item.frequency}` : ''}</div></td><td className="px-3 py-3 whitespace-nowrap"><div>{item.periodStart} – {item.periodEnd}</div>{item.migrationCutoverDate ? <div className="text-xs text-muted-foreground">{labels.migrationCutover}: {item.migrationCutoverDate}</div> : null}</td><td className="px-3 py-3 text-right tabular-nums">{hours(item.calculatedAmount)}</td><td className="px-3 py-3 text-right tabular-nums">{hours(item.alreadyPostedAmount)}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{hours(item.deltaToPost)}</td><td className="px-3 py-3"><Badge tone={statusTone(item.status)}>{statusLabel(item.status, labels)}</Badge>{item.reason ? <div className="mt-1 text-xs text-muted-foreground">{item.reason}</div> : null}</td></tr>)}</tbody>
      </DataTableShell>
    </>}
  </Surface>
}
