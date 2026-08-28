'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { DataTableShell } from '@/components/patterns/data-table-shell'

type YearControl = {
  id: string
  year: number
  status: 'LOCKED' | 'ACTIVE' | 'OPEN_FOR_FUTURE_REQUESTS'
  locked_at: string | null
  locked_by: string | null
}

export type LeaveLedgerPanelLabels = {
  title: string
  description: string
  yearStatus: string
  yearLocked: string
  yearActive: string
  yearFuture: string
  closeYear: string
  closeYearConfirm: string
  closeYearDone: string
  cancel: string
  empty: string
  failed: string
  loading: string
  working: string
}

export function LeaveLedgerPanel({ labels }: { labels: LeaveLedgerPanelLabels }) {
  const [controls, setControls] = useState<YearControl[]>([])
  const [loading, setLoading] = useState(true)
  const [busyYear, setBusyYear] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmYear, setConfirmYear] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    void fetch('/api/leave/ledger')
      .then(async (response) => {
        if (!response.ok) throw new Error('ledger')
        const payload = await response.json() as { data?: YearControl[] }
        if (active) setControls(payload.data ?? [])
      })
      .catch(() => {
        if (active) setNotice(labels.failed)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [labels.failed])

  const closeYear = async (year: number) => {
    setBusyYear(year)
    setNotice(null)
    try {
      const response = await fetch('/api/leave/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLOSE_YEAR', year }),
      })
      if (!response.ok) throw new Error('ledger')
      setControls((current) => current.map((control) => control.year === year ? { ...control, status: 'LOCKED' } : control))
      setNotice(labels.closeYearDone)
    } catch {
      setNotice(labels.failed)
    } finally {
      setBusyYear(null)
    }
  }

  return (
    <>
    <Surface className="p-5">
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{labels.description}</p>
      {notice ? <p className="mt-4 rounded-[var(--radius-control)] bg-accent p-3 text-sm" role="status">{notice}</p> : null}
      {loading ? <p className="mt-4 text-sm text-muted-foreground" role="status">{labels.loading}</p> : controls.length === 0 ? <EmptyState className="mt-4" title={labels.empty} /> : (
        <DataTableShell className="mt-4" caption={labels.title}>
            <thead className="border-b text-xs uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-3 py-2">{labels.yearStatus}</th><th className="px-3 py-2">{labels.closeYear}</th></tr></thead>
            <tbody className="divide-y">
              {controls.map((control) => {
                const status = control.status === 'LOCKED' ? labels.yearLocked : control.status === 'OPEN_FOR_FUTURE_REQUESTS' ? labels.yearFuture : labels.yearActive
                return <tr key={control.id}><td className="px-3 py-3"><span className="font-semibold">{control.year}</span><Badge className="ml-3" tone={control.status === 'LOCKED' ? 'neutral' : control.status === 'ACTIVE' ? 'success' : 'info'}>{status}</Badge></td><td className="px-3 py-3">{control.status === 'LOCKED' ? null : <Button disabled={busyYear !== null} onClick={() => setConfirmYear(control.year)} size="sm" type="button" variant="secondary">{busyYear === control.year ? labels.working : labels.closeYear}</Button>}</td></tr>
              })}
            </tbody>
        </DataTableShell>
      )}
    </Surface>
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.closeYear} destructive description={labels.closeYearConfirm} onConfirm={() => { if (confirmYear !== null) return closeYear(confirmYear) }} onOpenChange={(open) => { if (!open) setConfirmYear(null) }} open={confirmYear !== null} pending={busyYear !== null} title={labels.closeYear} />
    </>
  )
}
