'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import type { GenerationOptions } from '@/lib/document-generation/types'

type GenerationResult = {
  readonly id: string
  readonly status: 'PREVIEW' | 'FINAL'
  readonly freeKeys?: string[]
  readonly temporalKeys?: string[]
  readonly html?: string
  readonly dossierStatus?: 'CREATED' | 'SKIPPED'
}

interface GenerationLabels {
  readonly template: string
  readonly employee: string
  readonly choose: string
  readonly freeInputs: string
  readonly temporalInputs: string
  readonly inputHint: string
  readonly temporalHint: string
  readonly createPreview: string
  readonly preview: string
  readonly finalize: string
  readonly final: string
  readonly download: string
  readonly dossier: string
  readonly dossierCreated: string
  readonly dossierNotSaved: string
  readonly failed: string
}

function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

export function GenerationWorkbench({ options, labels }: { options: GenerationOptions; labels: GenerationLabels }) {
  const [templateVersionId, setTemplateVersionId] = useState(options.templates[0]?.versionId ?? '')
  const [employeeId, setEmployeeId] = useState(options.employees[0]?.id ?? '')
  const [freeKeys, setFreeKeys] = useState<string[]>([])
  const [temporalKeys, setTemporalKeys] = useState<string[]>([])
  const [freeInputs, setFreeInputs] = useState<Record<string, string>>({})
  const [temporalInputs, setTemporalInputs] = useState<Record<string, string>>({})
  const [snapshotId, setSnapshotId] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isFinal, setIsFinal] = useState(false)
  const [dossierStatus, setDossierStatus] = useState<'CREATED' | 'SKIPPED' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [previewKey, setPreviewKey] = useState(newIdempotencyKey)
  const [finalizeKey, setFinalizeKey] = useState<string | null>(null)

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
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : labels.failed)
      }
    }
    void loadManifest()
    return () => { cancelled = true }
  }, [labels.failed, templateVersionId])

  function resetResult(): void {
    setSnapshotId(null)
    setPreview(null)
    setIsFinal(false)
    setDossierStatus(null)
    setError(null)
    setFinalizeKey(null)
  }

  function resetForSelection(): void {
    resetResult()
    setPreviewKey(newIdempotencyKey())
  }

  function changeFreeInput(key: string, value: string): void {
    setFreeInputs((current) => ({ ...current, [key]: value }))
    resetResult()
    setPreviewKey(newIdempotencyKey())
  }

  function changeTemporalInput(key: string, value: string): void {
    setTemporalInputs((current) => ({ ...current, [key]: value }))
    resetResult()
    setPreviewKey(newIdempotencyKey())
  }

  function chooseTemplate(value: string): void {
    setTemplateVersionId(value)
    setFreeInputs({})
    setTemporalInputs({})
    resetForSelection()
  }

  function chooseEmployee(value: string): void {
    setEmployeeId(value)
    resetForSelection()
  }

  async function createPreview(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/document-studio/generation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateVersionId, employeeId, idempotencyKey: previewKey, freeInputs, temporalInputs }),
      })
      const result = await response.json() as { data?: GenerationResult; code?: string }
      if (!response.ok || !result.data) throw new Error(result.code ?? labels.failed)
      setSnapshotId(result.data.id)
      setFreeKeys(result.data.freeKeys ?? freeKeys)
      setTemporalKeys(result.data.temporalKeys ?? temporalKeys)
      setFinalizeKey(newIdempotencyKey())
      setIsFinal(false)
      setDossierStatus(null)
      const previewResponse = await fetch(`/api/document-studio/generation/${result.data.id}`)
      const previewResult = await previewResponse.json() as { data?: GenerationResult; code?: string }
      if (!previewResponse.ok || !previewResult.data?.html) throw new Error(previewResult.code ?? labels.failed)
      setPreview(previewResult.data.html)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.failed)
    } finally {
      setBusy(false)
    }
  }

  async function finalize(): Promise<void> {
    if (!snapshotId) return
    const key = finalizeKey ?? newIdempotencyKey()
    if (!finalizeKey) setFinalizeKey(key)
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/document-studio/generation/${snapshotId}/finalize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: key }),
      })
      const result = await response.json() as { data?: GenerationResult; code?: string }
      if (!response.ok || !result.data) throw new Error(result.code ?? labels.failed)
      setIsFinal(true)
      setDossierStatus(result.data.dossierStatus ?? 'SKIPPED')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.failed)
    } finally {
      setBusy(false)
    }
  }

  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1 text-sm font-medium"><span>{labels.template}</span><DropdownSelect aria-label={labels.template} onChange={(event) => chooseTemplate(event.target.value)} searchable searchPlaceholder={labels.choose} value={templateVersionId}>{options.templates.map((item) => <option key={item.versionId} value={item.versionId}>{item.name} · v{item.version}</option>)}</DropdownSelect></label>
      <label className="space-y-1 text-sm font-medium"><span>{labels.employee}</span><DropdownSelect aria-label={labels.employee} onChange={(event) => chooseEmployee(event.target.value)} searchable searchPlaceholder={labels.choose} value={employeeId}>{options.employees.map((item) => <option key={item.id} value={item.id}>{item.name}{item.employeeNumber ? ` · ${item.employeeNumber}` : ''}</option>)}</DropdownSelect></label>
    </div>
    {temporalKeys.length ? <section className="space-y-3 rounded-[var(--radius-surface)] border border-border bg-surface p-5"><h2 className="font-semibold">{labels.temporalInputs}</h2><p className="text-sm text-muted-foreground">{labels.temporalHint}</p>{temporalKeys.map((key) => <label className="block space-y-1 text-sm" key={key}><span>{key}</span><TextInput aria-label={key} onChange={(event) => changeTemporalInput(key, event.target.value)} required value={temporalInputs[key] ?? ''} /></label>)}</section> : null}
    {freeKeys.length ? <section className="space-y-3 rounded-[var(--radius-surface)] border border-border bg-surface p-5"><h2 className="font-semibold">{labels.freeInputs}</h2><p className="text-sm text-muted-foreground">{labels.inputHint}</p>{freeKeys.map((key) => <label className="block space-y-1 text-sm" key={key}><span>{key}</span><TextInput aria-label={key} onChange={(event) => changeFreeInput(key, event.target.value)} required value={freeInputs[key] ?? ''} /></label>)}</section> : null}
    <div className="flex flex-wrap gap-3">
      <Button disabled={!templateVersionId || !employeeId} loading={busy} onClick={createPreview} type="button">{labels.createPreview}</Button>
      {snapshotId && !isFinal ? <Button loading={busy} onClick={finalize} type="button" variant="secondary">{labels.finalize}</Button> : null}
      {isFinal && snapshotId ? <a className="ui-button ui-button-secondary inline-flex min-h-10 items-center rounded-[var(--radius-control)] border border-border px-4 text-sm font-medium" href={`/api/document-studio/generation/${snapshotId}/download`}>{labels.download}</a> : null}
    </div>
    {error ? <p className="rounded-[var(--radius-control)] border border-destructive p-3 text-sm text-destructive" role="alert">{error}</p> : null}
    {isFinal && dossierStatus ? <p className="text-sm text-muted-foreground">{labels.dossier}: {dossierStatus === 'CREATED' ? labels.dossierCreated : labels.dossierNotSaved}</p> : null}
    {preview ? <section className="space-y-3"><p className={`font-semibold ${isFinal ? 'text-success' : 'text-warning'}`}>{isFinal ? labels.final : labels.preview}</p><div className="max-w-[210mm] overflow-auto border border-border bg-white p-8 text-slate-900" dangerouslySetInnerHTML={{ __html: preview }} /></section> : null}
  </div>
}
