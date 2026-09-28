'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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

  return <form onSubmit={handleSubmit}>
    <Surface className="space-y-5 p-6">
      <label className="block text-sm font-medium" htmlFor="context-tenant">{labels.tenantLabel}<DropdownSelect className="mt-2" id="context-tenant" onChange={(event) => handleTenantChange(event.target.value)} searchable value={tenantId}><option value="">{labels.tenantPlaceholder}</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.slug}</option>)}</DropdownSelect></label>
      <label className="block text-sm font-medium" htmlFor="context-hr-group">{labels.hrGroupLabel}<DropdownSelect className="mt-2" id="context-hr-group" onChange={(event) => { setHrGroupId(event.target.value); setError(null) }} searchable value={hrGroupId}><option value="">{labels.hrGroupPlaceholder}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.code}</option>)}</DropdownSelect></label>
      {error ? <p className="rounded-[var(--radius-control)] bg-destructive-subtle px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
      <Button loading={pending} type="submit">{labels.continue}</Button>
    </Surface>
  </form>
}
