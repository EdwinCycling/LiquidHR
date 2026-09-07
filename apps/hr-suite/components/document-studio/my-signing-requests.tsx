'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface MySigningLabels {
  readonly title: string
  readonly status: string
  readonly prepared: string
  readonly sign: string
  readonly viewDocument: string
  readonly signed: string
  readonly empty: string
  readonly failed: string
}

export function MySigningRequests({ items, labels }: { items: readonly Record<string, unknown>[]; labels: MySigningLabels }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signed, setSigned] = useState<Set<string>>(new Set())

  async function sign(requestId: string): Promise<void> {
    setBusy(requestId)
    setError(null)
    try {
      const response = await fetch(`/api/document-studio/signing/${requestId}/complete`, { method: 'POST' })
      const result = await response.json() as { data?: { status?: string }; code?: string }
      if (!response.ok || !result.data) throw new Error(result.code ?? labels.failed)
      setSigned((current) => new Set([...current, requestId]))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.failed)
    } finally {
      setBusy(null)
    }
  }

  return <section className="space-y-3"><h2 className="text-lg font-semibold">{labels.title}</h2>{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}{items.length === 0 ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : <div className="overflow-x-auto rounded-[var(--radius-surface)] border border-border"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-surface"><tr><th className="px-4 py-3">{labels.status}</th><th className="px-4 py-3">{labels.prepared}</th><th className="px-4 py-3" /></tr></thead><tbody>{items.map((item) => { const id = String(item.id); const employeeId = typeof item.employeeId === 'string' ? item.employeeId : null; const isSigned = signed.has(id) || item.status === 'SIGNED'; return <tr className="border-b border-border last:border-0" key={id}><td className="px-4 py-3">{isSigned ? labels.signed : String(item.status ?? '')}</td><td className="px-4 py-3">{String(item.preparedAt ?? '')}</td><td className="flex flex-wrap gap-2 px-4 py-3">{employeeId ? <a className="ui-button ui-button-secondary inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border px-4 text-sm font-medium" href={`/employees/${employeeId}?tab=documents`}>{labels.viewDocument}</a> : null}{!isSigned ? <Button loading={busy === id} onClick={() => sign(id)} type="button">{labels.sign}</Button> : null}</td></tr> })}</tbody></table></div>}</section>
}
