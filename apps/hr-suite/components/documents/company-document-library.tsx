'use client'

import { Download, Eye, FileText, Trash2, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/patterns/page-header'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { EntityList } from '@/components/patterns/entity-list'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ActionMenuItem } from '@/components/ui/action-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { TextInput } from '@/components/ui/text-input'
import type { Locale } from '@/lib/i18n/config'
import { DocumentViewer } from './document-viewer'
import { DOCUMENT_FILE_ACCEPT, isAllowedDocumentFile, MAX_DOCUMENT_FILE_BYTES } from '@/lib/documents/file-rules'

interface CompanyDocument { id: string; title: string; original_filename: string; content_type: string; file_size: number; created_at: string }

export interface CompanyDocumentLibraryLabels {
  addedOn: string
  cancel: string
  close: string
  companyCreateDescription: string
  companyCreateTitle: string
  companyDeleteDescription: string
  companyEmpty: string
  companyInvalid: string
  companySave: string
  companySubtitle: string
  companyTitle: string
  delete: string
  deleteCancel: string
  deleteConfirm: string
  deleteTitle: string
  discardCancel: string
  discardConfirm: string
  discardDescription: string
  discardTitle: string
  download: string
  failed: string
  file: string
  fileRules: string
  fileSelected: string
  moreActions: string
  saving: string
  titleLabel: string
  unsupported: string
  upload: string
  view: string
}

export function CompanyDocumentLibrary({ documents, canDelete, canWrite, labels, locale }: { documents: CompanyDocument[]; canDelete: boolean; canWrite: boolean; labels: CompanyDocumentLibraryLabels; locale: Locale }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CompanyDocument | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<CompanyDocument | null>(null)
  const [error, setError] = useState<string | null>(null)

  function resetForm(): void {
    setTitle('')
    setSelectedFile(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function openUpload(): void {
    setError(null)
    setUploadOpen(true)
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle || !selectedFile || !isAllowedDocumentFile(selectedFile) || selectedFile.size < 1 || selectedFile.size > MAX_DOCUMENT_FILE_BYTES) { setError(labels.companyInvalid); return }
    setSaving(true)
    setError(null)
    const body = new FormData()
    body.set('file', selectedFile)
    body.set('metadata', JSON.stringify({ title: cleanTitle }))
    try {
      const response = await fetch('/api/company-documents', { method: 'POST', body })
      if (!response.ok) { setError(labels.failed); return }
      resetForm()
      setUploadOpen(false)
      router.refresh()
    } catch {
      setError(labels.failed)
    } finally {
      setSaving(false)
    }
  }

  async function remove(): Promise<void> {
    if (!deleteCandidate) return
    setDeleting(true)
    setError(null)
    try {
      const response = await fetch(`/api/company-documents/${deleteCandidate.id}`, { method: 'DELETE' })
      if (!response.ok) { setError(labels.failed); return }
      setDeleteCandidate(null)
      router.refresh()
    } catch {
      setError(labels.failed)
    } finally {
      setDeleting(false)
    }
  }

  const items = documents.map((document) => {
    const menuItems: ActionMenuItem[] = [
      { id: 'view', icon: <Eye aria-hidden="true" />, label: labels.view, onSelect: () => setPreview(document) },
      { href: `/api/company-documents/${document.id}/download`, icon: <Download aria-hidden="true" />, id: 'download', label: labels.download },
    ]
    if (canDelete) menuItems.push({ destructive: true, icon: <Trash2 aria-hidden="true" />, id: 'delete', label: labels.delete, onSelect: () => setDeleteCandidate(document) })
    return {
      actions: <RowActions menuItems={menuItems} menuLabel={`${labels.moreActions}: ${document.title}`} />,
      avatar: <FileText aria-hidden="true" />,
      badges: <Badge>{fileTypeLabel(document.content_type, document.original_filename)}</Badge>,
      id: document.id,
      primary: document.title,
      secondary: <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1"><span className="min-w-0 break-all">{document.original_filename}</span><span>{formatFileSize(document.file_size)}</span><time dateTime={document.created_at}>{labels.addedOn}: {formatDate(document.created_at, locale)}</time></div>,
    }
  })

  return (
    <>
      <PageHeader actions={canWrite ? <Button onClick={openUpload} type="button"><Upload aria-hidden="true" />{labels.upload}</Button> : undefined} description={labels.companySubtitle} title={labels.companyTitle} />
      {error && !uploadOpen ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <EntityList ariaLabel={labels.companyTitle} empty={<EmptyState icon={<FileText />} title={labels.companyEmpty} />} items={items} />
      {canWrite ? <FormDrawer cancelLabel={labels.cancel} closeLabel={labels.close} description={labels.companyCreateDescription} dirty={title.trim().length > 0 || selectedFile !== null} dirtyProtection={{ description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.discardCancel, title: labels.discardTitle }} onDiscard={resetForm} onOpenChange={(open) => { setUploadOpen(open); if (!open) resetForm() }} onSubmit={(event) => void submit(event)} open={uploadOpen} saveLabel={labels.companySave} saving={saving} title={labels.companyCreateTitle}>
        {error && uploadOpen ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <FormField control={<TextInput maxLength={200} name="title" onChange={(event) => setTitle(event.currentTarget.value)} required value={title} />} label={labels.titleLabel} required />
        <FormField control={<TextInput accept={DOCUMENT_FILE_ACCEPT} name="file" onChange={(event) => setSelectedFile(event.currentTarget.files?.[0] ?? null)} ref={fileRef} required type="file" />} description={<>{labels.fileRules}{selectedFile ? <span className="mt-1 block">{labels.fileSelected}: {selectedFile.name} · {formatFileSize(selectedFile.size)}</span> : null}</>} label={labels.file} required />
      </FormDrawer> : null}
      <ConfirmDialog cancelLabel={labels.deleteCancel} confirmLabel={labels.deleteConfirm} description={deleteCandidate ? `${labels.companyDeleteDescription} ${deleteCandidate.title}` : labels.companyDeleteDescription} destructive onConfirm={remove} onOpenChange={(open) => { if (!open && !deleting) setDeleteCandidate(null) }} open={deleteCandidate !== null} pending={deleting} title={labels.deleteTitle} />
      {preview ? <DocumentViewer contentType={preview.content_type} filename={preview.original_filename} labels={{ close: labels.close, download: labels.download, unsupported: labels.unsupported }} onClose={() => setPreview(null)} previewHref={`/api/company-documents/${preview.id}/download`} title={preview.title} /> : null}
    </>
  )
}

function formatFileSize(size: number): string { return size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB` }

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value))
}

function fileTypeLabel(contentType: string, filename: string): string {
  const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.') + 1).toUpperCase() : ''
  return extension || contentType.split('/').at(-1)?.toUpperCase() || contentType
}
