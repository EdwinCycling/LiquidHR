'use client'

import { useEffect, useState, type ComponentProps } from 'react'
import { DataTableShell } from '@/components/patterns/data-table-shell'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import type { LeaveBalanceReport, ReportTransaction } from '@/lib/leave/report'

export type LeaveHistoryEmploymentOption = {
  id: string
  employmentNumber: string
}

export type LeaveBalanceHistoryPanelLabels = {
  employment: string
  employmentPlaceholder: string
  employmentSearch: string
  currentBalance: string
  unlimited: string
  history: string
  leaveType: string
  amount: string
  effectiveDate: string
  reason: string
  actor: string
  createdAt: string
  empty: string
  loading: string
  failed: string
  notRecorded: string
}

type BalanceReportResponse = {
  data?: {
    report?: LeaveBalanceReport
  }
  error?: string
}

export async function fetchLeaveBalanceReport(employmentId: string, asOfDate?: string): Promise<LeaveBalanceReport> {
  const query = new URLSearchParams({ employmentId })
  if (asOfDate) query.set('asOfDate', asOfDate)
  const response = await fetch(`/api/leave/balance-report?${query.toString()}`)
  const payload = await response.json() as BalanceReportResponse
  if (!response.ok || !payload.data?.report) throw new Error(payload.error ?? 'LEAVE_OPERATION_FAILED')
  return payload.data.report
}

function numberFormatter(locale: string): Intl.NumberFormat {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function dateFormatter(locale: string, withTime = false): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium', timeZone: 'UTC' })
}

function formatDate(value: string | null | undefined, formatter: Intl.DateTimeFormat, fallback: string): string {
  if (!value) return fallback
  const parsed = new Date(value.length === 10 ? `${value}T00:00:00Z` : value)
  return Number.isNaN(parsed.getTime()) ? fallback : formatter.format(parsed)
}

function signedAmount(value: number, formatter: Intl.NumberFormat): string {
  const formatted = formatter.format(Math.abs(Number(value)))
  return Number(value) < 0 ? `−${formatted}` : `+${formatted}`
}

function historyRows(report: LeaveBalanceReport): Array<ReportTransaction & { leaveTypeName: string }> {
  return report.leaveTypes
    .flatMap((leaveType) => leaveType.manualAdjustments.map((transaction) => ({ ...transaction, leaveTypeName: leaveType.name })))
    .sort((left, right) => {
      const dateOrder = right.transactionDate.localeCompare(left.transactionDate)
      if (dateOrder !== 0) return dateOrder
      return (right.createdAt ?? '').localeCompare(left.createdAt ?? '')
    })
}

export function LeaveBalanceHistoryPanel({
  asOfDate,
  employmentId,
  employmentOptions = [],
  labels,
  locale,
  refreshToken = 0,
}: {
  asOfDate?: string
  employmentId?: string
  employmentOptions?: readonly LeaveHistoryEmploymentOption[]
  labels: LeaveBalanceHistoryPanelLabels
  locale: string
  refreshToken?: number
}) {
  const [selectedEmploymentIdState, setSelectedEmploymentId] = useState(employmentId ?? employmentOptions[0]?.id ?? '')
  const [report, setReport] = useState<LeaveBalanceReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  const selectedEmploymentId = employmentId ?? (employmentOptions.some((option) => option.id === selectedEmploymentIdState)
    ? selectedEmploymentIdState
    : employmentOptions[0]?.id ?? '')
  const reportForSelection = report && report.employmentId === selectedEmploymentId && (!asOfDate || report.asOfDate === asOfDate) ? report : null
  const loadingForSelection = Boolean(selectedEmploymentId && loading)
  const failedForSelection = Boolean(selectedEmploymentId && failed)

  useEffect(() => {
    if (!selectedEmploymentId) return undefined
    let active = true
    const loadReport = async (): Promise<void> => {
      setLoading(true)
      setFailed(false)
      try {
        const nextReport = await fetchLeaveBalanceReport(selectedEmploymentId, asOfDate)
        if (active) setReport(nextReport)
      } catch {
        if (active) {
          setReport(null)
          setFailed(true)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadReport()
    return () => {
      active = false
    }
  }, [asOfDate, refreshToken, selectedEmploymentId])

  const formatter = numberFormatter(locale)
  const dateOnlyFormatter = dateFormatter(locale)
  const dateTimeFormatter = dateFormatter(locale, true)
  const rows = reportForSelection ? historyRows(reportForSelection) : []

  return <div className="space-y-5">
    {employmentOptions.length > 1 ? <div className="max-w-xl">
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="leave-history-employment">{labels.employment}
        <DropdownSelect aria-label={labels.employment} id="leave-history-employment" searchable searchPlaceholder={labels.employmentSearch} value={selectedEmploymentId} onChange={(event) => setSelectedEmploymentId(event.target.value)}>
          <option value="">{labels.employmentPlaceholder}</option>
          {employmentOptions.map((option) => <option key={option.id} value={option.id}>{option.employmentNumber}</option>)}
        </DropdownSelect>
      </label>
    </div> : null}

    {loadingForSelection ? <p className="text-sm text-muted-foreground" role="status">{labels.loading}</p> : failedForSelection ? <p className="rounded-[var(--radius-control)] bg-destructive-surface p-3 text-sm text-destructive" role="alert">{labels.failed}</p> : reportForSelection ? <>
      <div>
        <h3 className="text-sm font-semibold">{labels.currentBalance}</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {reportForSelection.leaveTypes.map((leaveType) => <div className="rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3" key={leaveType.leaveTypeId}>
            <dt className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">{leaveType.name}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{leaveType.currentBalance === null ? labels.unlimited : formatter.format(leaveType.currentBalance)}</dd>
          </div>)}
        </dl>
      </div>
      <div>
        <h3 className="text-sm font-semibold">{labels.history}</h3>
        {rows.length === 0 ? <EmptyState className="mt-3 items-start p-4 text-left" title={labels.empty} /> : <DataTableShell className="mt-3" caption={labels.history}>
          <thead className="border-b text-left text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-3 py-2">{labels.leaveType}</th><th className="px-3 py-2">{labels.amount}</th><th className="px-3 py-2">{labels.effectiveDate}</th><th className="px-3 py-2">{labels.reason}</th><th className="px-3 py-2">{labels.actor}</th><th className="px-3 py-2">{labels.createdAt}</th></tr></thead>
          <tbody className="divide-y">{rows.map((transaction, index) => <tr key={transaction.id ?? `${transaction.transactionDate}:${transaction.createdAt ?? index}:${transaction.amount}`}>
            <td className="px-3 py-3 font-medium">{transaction.leaveTypeName}</td>
            <td className="px-3 py-3 font-semibold tabular-nums">{signedAmount(transaction.amount, formatter)}</td>
            <td className="px-3 py-3 whitespace-nowrap">{formatDate(transaction.transactionDate, dateOnlyFormatter, labels.notRecorded)}</td>
            <td className="max-w-sm px-3 py-3">{transaction.reason ?? labels.notRecorded}</td>
            <td className="px-3 py-3">{transaction.actorDisplayName ?? transaction.actorUserId ?? labels.notRecorded}</td>
            <td className="px-3 py-3 whitespace-nowrap text-sm text-muted-foreground">{formatDate(transaction.createdAt, dateTimeFormatter, labels.notRecorded)}</td>
          </tr>)}</tbody>
        </DataTableShell>}
      </div>
    </> : <EmptyState title={labels.empty} />}
  </div>
}

export function LeaveBalanceHistorySurface(props: ComponentProps<typeof LeaveBalanceHistoryPanel> & { title: string }) {
  const { title, ...panelProps } = props
  return <Surface className="p-5"><h2 className="text-lg font-semibold">{title}</h2><div className="mt-4"><LeaveBalanceHistoryPanel {...panelProps} /></div></Surface>
}
