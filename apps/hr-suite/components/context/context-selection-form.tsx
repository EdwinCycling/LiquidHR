'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'

interface ContextSelectionFormProps {
  tenants: Array<{
    id: string
    name: string
    hrGroups: Array<{ id: string; name: string; code: string }>
  }>
  labels: {
    contextLabel: string
    contextPlaceholder: string
    formTitle: string
    formDescription: string
    contextNote: string
    continue: string
    invalid: string
    failed: string
  }
  initialError?: string
}

function contextKey(tenantId: string, hrGroupId: string): string {
  return `${tenantId}|${hrGroupId}`
}

export function ContextSelectionForm({ tenants, labels, initialError }: ContextSelectionFormProps) {
  const router = useRouter()
  const contexts = useMemo(() => tenants.flatMap((tenant) => tenant.hrGroups.map((group) => ({
    key: contextKey(tenant.id, group.id),
    label: `${tenant.name} · ${group.name}`,
    tenantId: tenant.id,
    hrGroupId: group.id,
  }))), [tenants])
  const [selection, setSelection] = useState(contexts.length === 1 ? contexts[0].key : '')
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const selectedContext = contexts.find((context) => context.key === selection)
    if (!selectedContext) {
      setError(labels.invalid)
      return
    }
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/context/select', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId: selectedContext.tenantId, hrGroupId: selectedContext.hrGroupId }),
      })
      if (!response.ok) {
        setError(response.status === 400 || response.status === 403 ? labels.invalid : labels.failed)
        return
      }
      router.push('/dashboard/start')
    } catch {
      setError(labels.failed)
    } finally {
      setPending(false)
    }
  }

  return (
    <form action="/api/context/select" method="post" onSubmit={handleSubmit}>
      <Surface className="space-y-6 p-5 sm:p-6">
        <div className="flex items-start gap-4 border-b border-border-subtle pb-5">
          <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle text-accent-foreground">
            <Building2 className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{labels.formTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{labels.formDescription}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground" htmlFor="context-selection">
            <span className="inline-flex items-center gap-2">
              <Building2 aria-hidden="true" className="size-4 text-muted-foreground" />
              {labels.contextLabel}
            </span>
            <select
              aria-invalid={error ? 'true' : undefined}
              className="mt-2 min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-focus/50"
              id="context-selection"
              name="selection"
              onChange={(event) => { setSelection(event.target.value); setError(null) }}
              required
              value={selection}
            >
              <option value="">{labels.contextPlaceholder}</option>
              {contexts.map((context) => <option key={context.key} value={context.key}>{context.label}</option>)}
            </select>
          </label>
        </div>

        <p className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-subtle bg-surface-subtle p-3 text-sm leading-6 text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-accent-foreground" />
          <span>{labels.contextNote}</span>
        </p>

        {error ? <p className="rounded-[var(--radius-control)] bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
        <Button className="w-full" loading={pending} type="submit">{labels.continue}</Button>
      </Surface>
    </form>
  )
}
