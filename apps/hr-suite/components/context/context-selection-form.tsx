'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ShieldCheck, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'

interface ContextSelectionFormProps {
  tenants: Array<{
    id: string
    name: string
    slug: string
    hrGroups: Array<{ id: string; name: string; code: string }>
  }>
  labels: {
    tenantLabel: string
    tenantPlaceholder: string
    hrGroupLabel: string
    hrGroupPlaceholder: string
    formTitle: string
    formDescription: string
    contextNote: string
    continue: string
    invalid: string
    failed: string
  }
}

export function ContextSelectionForm({ tenants, labels }: ContextSelectionFormProps) {
  const router = useRouter()
  const [tenantId, setTenantId] = useState(tenants.length === 1 ? tenants[0].id : '')
  const [hrGroupId, setHrGroupId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const groups = useMemo(() => tenants.find((tenant) => tenant.id === tenantId)?.hrGroups ?? [], [tenantId, tenants])

  function handleTenantChange(value: string): void {
    setTenantId(value)
    const tenant = tenants.find((option) => option.id === value)
    setHrGroupId(tenant?.hrGroups.length === 1 ? tenant.hrGroups[0].id : '')
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!tenantId || !hrGroupId) {
      setError(labels.invalid)
      return
    }
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/context/select', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId, hrGroupId }),
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
    <form onSubmit={handleSubmit}>
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

        <div className="space-y-5">
          <label className="block text-sm font-medium text-foreground" htmlFor="context-tenant">
            <span className="inline-flex items-center gap-2">
              <Building2 aria-hidden="true" className="size-4 text-muted-foreground" />
              {labels.tenantLabel}
            </span>
            <DropdownSelect className="mt-2" id="context-tenant" onChange={(event) => handleTenantChange(event.target.value)} searchable value={tenantId}>
              <option value="">{labels.tenantPlaceholder}</option>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.slug}</option>)}
            </DropdownSelect>
          </label>

          <label className="block text-sm font-medium text-foreground" htmlFor="context-hr-group">
            <span className="inline-flex items-center gap-2">
              <UsersRound aria-hidden="true" className="size-4 text-muted-foreground" />
              {labels.hrGroupLabel}
            </span>
            <DropdownSelect className="mt-2" id="context-hr-group" onChange={(event) => { setHrGroupId(event.target.value); setError(null) }} searchable value={hrGroupId}>
              <option value="">{labels.hrGroupPlaceholder}</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.code}</option>)}
            </DropdownSelect>
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
