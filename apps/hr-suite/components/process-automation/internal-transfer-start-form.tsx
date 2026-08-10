'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InternalTransferStartData } from '@/lib/process-automation/internal-transfer-start-service'

interface Choice {
  readonly value: string
  readonly label: string
  readonly meta?: string
}

export interface InternalTransferStartLabels {
  readonly title: string
  readonly description: string
  readonly employee: string
  readonly employment: string
  readonly effectiveOn: string
  readonly effectiveOnHelp: string
  readonly start: string
  readonly back: string
  readonly choose: string
  readonly search: string
  readonly required: string
  readonly starting: string
  readonly failed: string
  readonly notActivated: string
}

function ChoicePicker({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  readonly id: string
  readonly label: string
  readonly value: string | null
  readonly options: readonly Choice[]
  readonly placeholder: string
  readonly onChange: (value: string | null) => void
}) {
  const selected = options.find((option) => option.value === value) ?? null
  const [query, setQuery] = useState(selected?.label ?? '')
  const [open, setOpen] = useState(false)
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return options.slice(0, 25)
    return options.filter((option) => `${option.label} ${option.meta ?? ''}`.toLocaleLowerCase().includes(normalized)).slice(0, 25)
  }, [options, query])

  return <div className="grid gap-2">
    <label className="text-sm font-semibold" htmlFor={id}>{label}<span aria-hidden="true" className="ml-1 text-danger">*</span></label>
    <div className="relative">
      <input
        aria-autocomplete="list"
        aria-controls={`${id}-options`}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="form-field w-full"
        id={id}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          setQuery(event.target.value)
          onChange(null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        role="combobox"
        value={selected ? selected.label : query}
      />
      {open ? <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg" id={`${id}-options`} role="listbox">
        {filtered.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">{placeholder}</li> : filtered.map((option) => <li key={option.value} role="option" aria-selected={option.value === value}>
          <button className="flex min-h-11 w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.value); setQuery(option.label); setOpen(false) }} type="button">
            <span className="font-medium">{option.label}</span>{option.meta ? <span className="text-muted-foreground">{option.meta}</span> : null}
          </button>
        </li>)}
      </ul> : null}
    </div>
  </div>
}

export function InternalTransferStartForm({ data, initialEmployeeId, labels }: { readonly data: InternalTransferStartData; readonly initialEmployeeId?: string; readonly labels: InternalTransferStartLabels }) {
  const router = useRouter()
  const [employeeId, setEmployeeId] = useState<string | null>(data.employees.some((employee) => employee.id === initialEmployeeId) ? initialEmployeeId ?? null : data.employees.length === 1 ? data.employees[0]?.id ?? null : null)
  const [employmentId, setEmploymentId] = useState<string | null>(null)
  const [effectiveOn, setEffectiveOn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const employees = data.employees.map((employee) => ({ value: employee.id, label: employee.name, meta: employee.employeeNumber }))
  const employments = data.employments.filter((employment) => employment.employeeId === employeeId).map((employment) => ({
    value: employment.id,
    label: employment.employmentNumber,
    meta: `${employment.startsOn}${employment.endsOn ? ` – ${employment.endsOn}` : ''}`,
  }))

  async function start(): Promise<void> {
    if (!employeeId || !employmentId || !effectiveOn) {
      setError(labels.required)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/processes/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          processDefinitionId: data.recipe.processDefinitionId,
          subjectEmployeeId: employeeId,
          employmentId,
          businessEffectiveDate: effectiveOn,
          idempotencyKey: crypto.randomUUID(),
          correlationId: crypto.randomUUID(),
        }),
      })
      const body: unknown = await response.json()
      if (!response.ok || typeof body !== 'object' || body === null || !('data' in body)) {
        setError(labels.failed)
        return
      }
      const result = body.data
      if (typeof result !== 'object' || result === null || !('processInstanceId' in result) || typeof result.processInstanceId !== 'string') {
        setError(labels.failed)
        return
      }
      const projectionResponse = await fetch(`/api/process-instances/${result.processInstanceId}`)
      const projectionBody: unknown = await projectionResponse.json()
      if (!projectionResponse.ok || typeof projectionBody !== 'object' || projectionBody === null || !('data' in projectionBody)) {
        setError(labels.failed)
        return
      }
      const projection = projectionBody.data
      if (typeof projection !== 'object' || projection === null || !('workItems' in projection) || !Array.isArray(projection.workItems)) {
        setError(labels.failed)
        return
      }
      const firstWorkItem = projection.workItems.find((item: unknown) => typeof item === 'object' && item !== null && 'id' in item && typeof item.id === 'string')
      if (!firstWorkItem || typeof firstWorkItem !== 'object' || !('id' in firstWorkItem) || typeof firstWorkItem.id !== 'string') {
        setError(labels.failed)
        return
      }
      router.push(`/work/${firstWorkItem.id}`)
    } catch {
      setError(labels.failed)
    } finally {
      setBusy(false)
    }
  }

  return <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-10">
    <header className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <p className="eyebrow text-primary">{data.recipe.recipeKey}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.description}</p>
    </header>

    <form className="mt-6 flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface" onSubmit={(event) => { event.preventDefault(); void start() }}>
      <div className="min-w-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
        <section aria-labelledby="internal-transfer-start-subject">
          <h2 className="text-xl font-semibold" id="internal-transfer-start-subject">{labels.employee}</h2>
          <div className="mt-5 grid gap-5">
            <ChoicePicker id="internal-transfer-employee" label={labels.employee} options={employees} placeholder={labels.choose} value={employeeId} onChange={(value) => { setEmployeeId(value); setEmploymentId(null) }} />
            <ChoicePicker id="internal-transfer-employment" label={labels.employment} options={employments} placeholder={labels.choose} value={employmentId} onChange={setEmploymentId} />
            <div className="grid gap-2">
              <label className="text-sm font-semibold" htmlFor="internal-transfer-effective-on">{labels.effectiveOn}<span aria-hidden="true" className="ml-1 text-danger">*</span></label>
              <input className="form-field" id="internal-transfer-effective-on" onChange={(event) => setEffectiveOn(event.target.value)} onInput={(event) => setEffectiveOn(event.currentTarget.value)} type="date" value={effectiveOn} />
              <p className="text-sm text-muted-foreground">{labels.effectiveOnHelp}</p>
            </div>
          </div>
        </section>
      </div>
      <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface/95 p-4 backdrop-blur sm:px-7">
        <button className="button-secondary" onClick={() => router.push('/work')} type="button">{labels.back}</button>
        <button className="button-primary" disabled={busy} type="submit">{busy ? labels.starting : labels.start}</button>
        {error ? <p aria-live="polite" className="basis-full text-sm font-medium text-danger" role="alert">{error}</p> : null}
      </footer>
    </form>
  </main>
}
