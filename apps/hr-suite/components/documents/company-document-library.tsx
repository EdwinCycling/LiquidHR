'use client'

import { Download, Eye, FileText, Trash2, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { DocumentViewer } from './document-viewer'
import { DOCUMENT_FILE_ACCEPT, isAllowedDocumentFile, MAX_DOCUMENT_FILE_BYTES } from '@/lib/documents/file-rules'

interface CompanyDocument { id: string; title: string; original_filename: string; content_type: string; file_size: number; created_at: string }

interface Labels {
  title: string; subtitle: string; upload: string; titleLabel: string; file: string; save: string; saving: string; empty: string; view: string; download: string; delete: string; close: string; unsupported: string; invalid: string; failed: string
}

export function CompanyDocumentLibrary({ documents, canWrite, labels }: { documents: CompanyDocument[]; canWrite: boolean; labels: Labels }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CompanyDocument | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (!selectedFile || !isAllowedDocumentFile(selectedFile) || selectedFile.size < 1 || selectedFile.size > MAX_DOCUMENT_FILE_BYTES) { setError(labels.invalid); return }
    setBusy(true); setError(null)
    const body = new FormData(); body.set('file', selectedFile); body.set('metadata', JSON.stringify({ title: form.get('title') }))
    const response = await fetch('/api/company-documents', { method: 'POST', body })
    setBusy(false)
    if (!response.ok) { setError(labels.failed); return }
    event.currentTarget.reset(); setSelectedFile(null); router.refresh()
  }

  async function remove(id: string) {
    if (!window.confirm(labels.delete)) return
    const response = await fetch(`/api/company-documents/${id}`, { method: 'DELETE' })
    if (!response.ok) { setError(labels.failed); return }
    router.refresh()
  }

  return <section className="mt-6 rounded-2xl border bg-surface p-5 shadow-sm sm:p-6">
    <header><h1 className="text-2xl font-semibold">{labels.title}</h1><p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p></header>
    {canWrite ? <form className="mt-6 grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-[minmax(0,1fr)_minmax(15rem,.8fr)_auto]" onSubmit={(event) => void submit(event)}>
      <label className="text-sm font-medium">{labels.titleLabel}<input className="form-field mt-1" name="title" required /></label>
      <label className="text-sm font-medium">{labels.file}<input accept={DOCUMENT_FILE_ACCEPT} className="form-field mt-1" onChange={(event) => setSelectedFile(event.currentTarget.files?.[0] ?? null)} ref={fileRef} required type="file" /></label>
      <button className="button-primary self-end" disabled={busy} type="submit"><Upload size={16} />{busy ? labels.saving : labels.save}</button>
    </form> : null}
    {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    <div className="mt-6 grid gap-3 lg:grid-cols-2">
      {documents.length === 0 ? <p className="text-sm text-muted-foreground">{labels.empty}</p> : documents.map((document) => <article className="rounded-xl border p-4" key={document.id}>
        <div className="flex items-start gap-3"><span className="rounded-lg bg-muted p-2"><FileText size={18} /></span><div className="min-w-0 flex-1"><p className="font-semibold">{document.title}</p><p className="truncate text-xs text-muted-foreground">{document.original_filename} · {formatFileSize(document.file_size)}</p></div></div>
        <p className="mt-3 text-xs text-muted-foreground">{document.created_at.slice(0, 10)}</p>
        <div className="mt-4 flex flex-wrap gap-2"><button className="button-secondary" onClick={() => setPreview(document)} type="button"><Eye size={15} />{labels.view}</button><a className="button-secondary" href={`/api/company-documents/${document.id}/download`}><Download size={15} />{labels.download}</a>{canWrite ? <button className="button-secondary text-destructive" onClick={() => void remove(document.id)} type="button"><Trash2 size={15} />{labels.delete}</button> : null}</div>
      </article>)}
    </div>
    {preview ? <DocumentViewer contentType={preview.content_type} filename={preview.original_filename} labels={{ close: labels.close, download: labels.download, unsupported: labels.unsupported }} onClose={() => setPreview(null)} previewHref={`/api/company-documents/${preview.id}/download`} title={preview.title} /> : null}
  </section>
}

function formatFileSize(size: number): string { return size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB` }
