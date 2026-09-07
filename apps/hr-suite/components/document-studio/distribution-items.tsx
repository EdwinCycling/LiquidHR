'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface DistributionItemLabels {
  readonly title: string
  readonly employee: string
  readonly status: string
  readonly error: string
  readonly prepareSigning: string
  readonly prepared: string
  readonly failed: string
}

export function DistributionItems({ items, labels }: { items: readonly Record<string, unknown>[]; labels: DistributionItemLabels }) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [prepared, setPrepared] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  async function prepare(snapshotId: string, itemId: string): Promise<void> {
    setBusyId(itemId)
    setError(null)
    try {
      const response = await fetch('/api/document-studio/signing', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ snapshotId }) })
      const result = await response.json() as { data?: { id?: string; status?: string }; code?: string }
      if (!response.ok || !result.data?.id) throw new Error(result.code ?? labels.failed)
      setPrepared((current) => ({ ...current, [itemId]: result.data?.status ?? labels.prepared }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.failed)
    } finally {
      setBusyId(null)
    }
  }

  return <section className="space-y-3"><h2 className="text-lg font-semibold">{labels.title}</h2>{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}<div className="overflow-x-auto rounded-[var(--radius-surface)] border border-border"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-surface"><tr><th className="px-4 py-3">{labels.employee}</th><th className="px-4 py-3">{labels.status}</th><th className="px-4 py-3">{labels.error}</th><th className="px-4 py-3" /></tr></thead><tbody>{items.map((item) => { const id = String(item.id); const snapshotId = typeof item.snapshot_id === 'string' ? item.snapshot_id : null; return <tr className="border-b border-border last:border-0" key={id}><td className="px-4 py-3">{String(item.employee_name ?? item.employee_id ?? '')}</td><td className="px-4 py-3">{String(item.status ?? '')}</td><td className="px-4 py-3">{String(item.error_code ?? '')}</td><td className="px-4 py-3">{prepared[id] ? <span className="text-success">{prepared[id]}</span> : snapshotId && item.status === 'FINAL' ? <Button loading={busyId === id} onClick={() => prepare(snapshotId, id)} type="button" variant="secondary">{labels.prepareSigning}</Button> : null}</td></tr> })}</tbody></table></div></section>
}
