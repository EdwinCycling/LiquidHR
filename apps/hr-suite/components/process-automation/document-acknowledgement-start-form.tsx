'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DocumentAcknowledgementStartData } from '@/lib/process-automation/document-acknowledgement-service'

interface Choice {
  readonly value: string
  readonly label: string
  readonly meta?: string
}

interface ChoicePickerProps {
  readonly id: string
  readonly label: string
  readonly value: string | null
  readonly options: readonly Choice[]
  readonly placeholder: string
  readonly onChange: (value: string | null) => void
}

function ChoicePicker({ id, label, value, options, placeholder, onChange }: ChoicePickerProps) {
  const selected = options.find((option) => option.value === value) ?? null
  const [query, setQuery] = useState(selected?.label ?? '')
  const [open, setOpen] = useState(false)
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return (normalized ? options.filter((option) => `${option.label} ${option.meta ?? ''}`.toLocaleLowerCase().includes(normalized)) : options).slice(0, 25)
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
        onChange={(event) => { setQuery(event.target.value); onChange(null); setOpen(true) }}
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

export interface DocumentAcknowledgementStartLabels {
  readonly title: string
  readonly description: string
  readonly employee: string
  readonly document: string
  readonly choose: string
  readonly required: string
  readonly start: string
  readonly starting: string
  readonly failed: string
  readonly back: string
}

export function DocumentAcknowledgementStartForm({ data, labels }: { readonly data: DocumentAcknowledgementStartData; readonly labels: DocumentAcknowledgementStartLabels }) {
  const router = useRouter()
  const [employeeId, setEmployeeId] = useState<string | null>(data.employees.length === 1 ? data.employees[0]?.id ?? null : null)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const employees = data.employees.map((employee) => ({ value: employee.id, label: employee.name, meta: employee.employeeNumber }))
  const documents = data.documents.filter((document) => document.employeeId === employeeId).map((document) => ({ value: document.id, label: document.title, meta: document.originalFilename }))

  async function start(): Promise<void> {
    if (!employeeId || !documentId) { setError(labels.required); return }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/processes/document-acknowledgement/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ processDefinitionId: data.recipe.processDefinitionId, subjectEmployeeId: employeeId, documentId, idempotencyKey: crypto.randomUUID(), correlationId: crypto.randomUUID() }),
      })
      const body: unknown = await response.json().catch(() => null)
      if (!response.ok || typeof body !== 'object' || body === null || !('data' in body)) { setError(typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string' ? `${labels.failed} (${body.code})` : labels.failed); return }
      const result = body.data
      if (typeof result !== 'object' || result === null || !('workItemId' in result) || typeof result.workItemId !== 'string') { setError(labels.failed); return }
      router.push(`/work/${result.workItemId}`)
    } catch { setError(labels.failed) } finally { setBusy(false) }
  }

  return <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-10">
    <header className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <p className="eyebrow text-primary">{data.recipe.recipeKey}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{labels.title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{labels.description}</p>
    </header>
    <form className="mt-6 flex min-h-[26rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface" onSubmit={(event) => { event.preventDefault(); void start() }}>
      <div className="min-w-0 flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
        <section aria-labelledby="document-acknowledgement-start-subject">
          <h2 className="text-xl font-semibold" id="document-acknowledgement-start-subject">{labels.employee}</h2>
          <div className="mt-5 grid gap-5">
            <ChoicePicker id="document-acknowledgement-employee" label={labels.employee} options={employees} placeholder={labels.choose} value={employeeId} onChange={(value) => { setEmployeeId(value); setDocumentId(null) }} />
            <ChoicePicker id="document-acknowledgement-document" label={labels.document} options={documents} placeholder={labels.choose} value={documentId} onChange={setDocumentId} />
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
