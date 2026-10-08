'use client'

import { ArrowRight, Building2, CircleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormField } from '@/components/patterns/form-field'
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
    eyebrow: string
    formTitle: string
    formDescription: string
    tenantLabel: string
    tenantDescription: string
    tenantPlaceholder: string
    hrGroupLabel: string
    hrGroupDescription: string
    hrGroupPlaceholder: string
    sessionHint: string
    continue: string
    saving: string
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

  const hasValidationError = error === labels.invalid

  return <form className="mt-7" onSubmit={handleSubmit}>
    <Surface aria-busy={pending} className="overflow-hidden" data-testid="context-selection-card">
      <header className="border-b bg-accent/45 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-primary text-primary-foreground">
            <Building2 className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">{labels.eyebrow}</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{labels.formTitle}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{labels.formDescription}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 p-5 sm:p-6">
        <FormField
          control={<DropdownSelect aria-invalid={hasValidationError || undefined} disabled={pending} id="context-tenant" onChange={(event) => handleTenantChange(event.target.value)} placeholder={labels.tenantPlaceholder} searchable searchPlaceholder={labels.tenantPlaceholder} value={tenantId}><option value="">{labels.tenantPlaceholder}</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.slug}</option>)}</DropdownSelect>}
          description={labels.tenantDescription}
          label={labels.tenantLabel}
          required
        />
        <FormField
          control={<DropdownSelect aria-invalid={hasValidationError || undefined} disabled={pending || !tenantId} id="context-hr-group" onChange={(event) => { setHrGroupId(event.target.value); setError(null) }} placeholder={labels.hrGroupPlaceholder} searchable searchPlaceholder={labels.hrGroupPlaceholder} value={hrGroupId}><option value="">{labels.hrGroupPlaceholder}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.code}</option>)}</DropdownSelect>}
          description={labels.hrGroupDescription}
          label={labels.hrGroupLabel}
          required
        />

        {error ? <div aria-live="assertive" className="flex items-start gap-3 rounded-[var(--radius-control)] border border-destructive/25 bg-destructive-surface px-3.5 py-3 text-sm text-destructive" data-testid="context-selection-error" role="alert">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div> : null}

        <div className="flex flex-col gap-4 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-sm text-xs leading-5 text-muted-foreground">{labels.sessionHint}</p>
          <Button className="w-full shrink-0 sm:w-auto sm:min-w-36" loading={pending} type="submit">
            {pending ? labels.saving : labels.continue}
            {!pending ? <ArrowRight aria-hidden="true" /> : null}
          </Button>
        </div>
      </div>
    </Surface>
  </form>
}
