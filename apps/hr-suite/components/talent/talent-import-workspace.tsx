'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { TalentImportBatch } from '@/lib/talent/import-service'

type Labels = { title: string; subtitle: string; filename: string; chooseFile: string; preview: string; commit: string; rollback: string; invalid: string; valid: string; applied: string; rolledBack: string; empty: string; failed: string; committed: string; rolledBackMessage: string; template: string }
type ApiResponse = { data?: TalentImportBatch; error?: string }

export function TalentImportWorkspace({ labels }: { labels: Labels }) {
  const [filename, setFilename] = useState('talent-import.csv')
  const [content, setContent] = useState('')
  const [batch, setBatch] = useState<TalentImportBatch | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function preview(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      const response = await fetch('/api/talent/imports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename, content }) })
      const payload = await response.json() as ApiResponse
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'TALENT_IMPORT_PREVIEW_FAILED')
      setBatch(payload.data)
    } catch (error) { setMessage(error instanceof Error ? error.message : labels.failed) } finally { setBusy(false) }
  }

  async function command(command: 'COMMIT' | 'ROLLBACK') {
    if (!batch) return
    setBusy(true); setMessage('')
    try {
      const response = await fetch(`/api/talent/imports/${batch.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command, idempotencyKey: `${command.toLowerCase()}-${batch.id}-${Date.now()}` }) })
      const payload = await response.json() as ApiResponse
      if (!response.ok || !payload.data) throw new Error(payload.error ?? 'TALENT_IMPORT_COMMAND_FAILED')
      setBatch(payload.data); setMessage(command === 'COMMIT' ? labels.committed : labels.rolledBackMessage)
    } catch (error) { setMessage(error instanceof Error ? error.message : labels.failed) } finally { setBusy(false) }
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setFilename(file.name); setContent(await file.text()); setMessage('')
  }

  return <section className="mt-6 space-y-5"><form className="grid gap-4 rounded-2xl border bg-surface p-5 shadow-sm" onSubmit={(event) => void preview(event)}><div><h2 className="text-xl font-semibold">{labels.title}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p></div><label className="grid gap-1.5 text-sm font-medium" htmlFor="talent-import-file">{labels.chooseFile}<input accept=".csv,text/csv" className="form-field" id="talent-import-file" onChange={(event) => void readFile(event)} type="file" /></label><label className="grid gap-1.5 text-sm font-medium" htmlFor="talent-import-content">{labels.filename}<input className="form-field" onChange={(event) => setFilename(event.target.value)} value={filename} /></label><textarea aria-label={labels.title} className="form-field min-h-48 font-mono text-xs" id="talent-import-content" onChange={(event) => setContent(event.target.value)} placeholder={labels.template} value={content} /><button className="button-primary justify-self-start" disabled={busy || content.trim().length === 0} type="submit">{labels.preview}</button></form>{message ? <p aria-live="polite" className="rounded-xl border px-4 py-3 text-sm">{message}</p> : null}{batch ? <section aria-labelledby="talent-import-preview" className="rounded-2xl border bg-surface p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold" id="talent-import-preview">{labels.preview}</h2><p className="mt-1 text-sm text-muted-foreground">{batch.source_filename} · {batch.row_count} rows · {batch.status}</p></div><div className="flex flex-wrap gap-2"><button className="button-primary" disabled={busy || batch.status !== 'PREVIEW' || batch.rows.some((row) => row.row_status === 'INVALID')} onClick={() => void command('COMMIT')} type="button">{labels.commit}</button><button className="button-secondary" disabled={busy || batch.status !== 'COMMITTED'} onClick={() => void command('ROLLBACK')} type="button">{labels.rollback}</button></div></div><div className="mt-5 grid gap-2">{batch.rows.length === 0 ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : batch.rows.map((row) => <article className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center" key={row.id}><span className="text-xs tabular-nums text-muted-foreground">{row.row_number}</span><p className="text-sm">{row.employee_number} · {row.capability_code}{row.errors.length > 0 ? <span className="mt-1 block text-xs text-destructive">{row.errors.join(', ')}</span> : null}</p><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.row_status === 'VALID' ? 'bg-success-surface text-success' : row.row_status === 'INVALID' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>{row.row_status === 'VALID' ? labels.valid : row.row_status === 'INVALID' ? labels.invalid : row.row_status === 'APPLIED' ? labels.applied : labels.rolledBack}</span></article>)}</div></section> : null}</section>
}
