'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import type { GenerationOptions } from '@/lib/document-generation/types'

interface DistributionLabels {
  readonly template: string
  readonly employees: string
  readonly searchEmployees: string
  readonly selected: string
  readonly selectionLimit: string
  readonly selectVisible: string
  readonly clearSelection: string
  readonly choose: string
  readonly freeInputs: string
  readonly inputHint: string
  readonly temporalInputs: string
  readonly temporalHint: string
  readonly create: string
  readonly submitted: string
  readonly failed: string
}

export function DistributionWorkbench({ options, labels }: { options: GenerationOptions; labels: DistributionLabels }) {
  const [templateVersionId, setTemplateVersionId] = useState(options.templates[0]?.versionId ?? '')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [freeKeys, setFreeKeys] = useState<string[]>([])
  const [temporalKeys, setTemporalKeys] = useState<string[]>([])
  const [freeInputs, setFreeInputs] = useState<Record<string, string>>({})
  const [temporalInputs, setTemporalInputs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadManifest() {
      if (!templateVersionId) return
      try {
        const response = await fetch(`/api/document-studio/generation/manifest?templateVersionId=${encodeURIComponent(templateVersionId)}`)
        const result = await response.json() as { data?: { freeKeys: string[]; temporalKeys: string[] }; code?: string }
        if (!response.ok || !result.data) throw new Error(result.code ?? labels.failed)
        if (!cancelled) {
          setFreeKeys(result.data.freeKeys)
          setTemporalKeys(result.data.temporalKeys)
          setFreeInputs({})
          setTemporalInputs({})
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : labels.failed)
      }
    }
    void loadManifest()
    return () => { cancelled = true }
  }, [labels.failed, templateVersionId])

  const visibleEmployees = useMemo(() => {
    const query = employeeFilter.trim().toLocaleLowerCase()
    if (!query) return options.employees
    return options.employees.filter((employee) => `${employee.name} ${employee.employeeNumber ?? ''}`.toLocaleLowerCase().includes(query))
  }, [employeeFilter, options.employees])

  function toggleEmployee(employeeId: string): void {
    setSubmitted(null)
    setSelectedEmployees((current) => current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId])
  }

  function selectVisible(): void {
    setSelectedEmployees((current) => [...new Set([...current, ...visibleEmployees.map((employee) => employee.id)])])
  }

  function clearSelection(): void {
    setSelectedEmployees([])
    setSubmitted(null)
  }

  async function createDistribution(): Promise<void> {
    setBusy(true)
    setError(null)
    setSubmitted(null)
    try {
      const response = await fetch('/api/document-studio/distributions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateVersionId, employeeIds: selectedEmployees, idempotencyKey: crypto.randomUUID(), freeInputs, temporalInputs }),
      })
      const result = await response.json() as { data?: { id: string }; code?: string }
      if (!response.ok || !result.data) throw new Error(result.code ?? labels.failed)
      setSubmitted(result.data.id)
      setSelectedEmployees([])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.failed)
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-6">
    <label className="block max-w-xl space-y-1 text-sm font-medium"><span>{labels.template}</span><DropdownSelect aria-label={labels.template} onChange={(event) => setTemplateVersionId(event.target.value)} searchable searchPlaceholder={labels.choose} value={templateVersionId}>{options.templates.map((item) => <option key={item.versionId} value={item.versionId}>{item.name} · v{item.version}</option>)}</DropdownSelect></label>
    <section className="space-y-3 rounded-[var(--radius-surface)] border border-border bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-semibold">{labels.employees}</h2><p className="text-sm text-muted-foreground">{labels.selected}: {selectedEmployees.length}</p>{selectedEmployees.length > 200 ? <p className="text-sm text-destructive" role="alert">{labels.selectionLimit}</p> : null}</div><div className="flex gap-2"><Button onClick={selectVisible} type="button" variant="secondary">{labels.selectVisible}</Button><Button onClick={clearSelection} type="button" variant="ghost">{labels.clearSelection}</Button></div></div>
      <TextInput aria-label={labels.searchEmployees} onChange={(event) => setEmployeeFilter(event.target.value)} placeholder={labels.searchEmployees} value={employeeFilter} />
      <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">{visibleEmployees.map((employee) => <label className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm" key={employee.id}><input checked={selectedEmployees.includes(employee.id)} onChange={() => toggleEmployee(employee.id)} type="checkbox" /> <span>{employee.name}{employee.employeeNumber ? ` · ${employee.employeeNumber}` : ''}</span></label>)}</div>
    </section>
    {temporalKeys.length ? <section className="space-y-3 rounded-[var(--radius-surface)] border border-border bg-surface p-5"><h2 className="font-semibold">{labels.temporalInputs}</h2><p className="text-sm text-muted-foreground">{labels.temporalHint}</p>{temporalKeys.map((key) => <label className="block space-y-1 text-sm" key={key}><span>{key}</span><TextInput aria-label={key} onChange={(event) => setTemporalInputs((current) => ({ ...current, [key]: event.target.value }))} required value={temporalInputs[key] ?? ''} /></label>)}</section> : null}
    {freeKeys.length ? <section className="space-y-3 rounded-[var(--radius-surface)] border border-border bg-surface p-5"><h2 className="font-semibold">{labels.freeInputs}</h2><p className="text-sm text-muted-foreground">{labels.inputHint}</p>{freeKeys.map((key) => <label className="block space-y-1 text-sm" key={key}><span>{key}</span><TextInput aria-label={key} onChange={(event) => setFreeInputs((current) => ({ ...current, [key]: event.target.value }))} required value={freeInputs[key] ?? ''} /></label>)}</section> : null}
    <Button disabled={!templateVersionId || selectedEmployees.length === 0 || selectedEmployees.length > 200} loading={busy} onClick={createDistribution} type="button">{labels.create}</Button>
    {submitted ? <p className="rounded-[var(--radius-control)] border border-success p-3 text-sm text-success" role="status">{labels.submitted}: <a className="underline" href={`/document-studio/distributions/${submitted}`}>{submitted}</a></p> : null}
    {error ? <p className="rounded-[var(--radius-control)] border border-destructive p-3 text-sm text-destructive" role="alert">{error}</p> : null}
  </div>
}
