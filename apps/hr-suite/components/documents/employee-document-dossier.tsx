'use client'

import { Eye, FileText, ShieldAlert, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type DragEvent, type FormEvent, useRef, useState } from 'react'
import type { Json } from '@scope/db'
import {
  DOCUMENT_FILE_ACCEPT,
  isAllowedDocumentFile,
  MAX_DOCUMENT_FILE_BYTES,
} from '@/lib/documents/file-rules'
import { documentMetadataSchema } from '@/lib/documents/schemas'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { FormField } from '@/components/patterns/form-field'
import { FormActions } from '@/components/patterns/form-actions'
import { RowActions } from '@/components/patterns/row-actions'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog } from '@/components/ui/dialog'
import { DocumentViewer } from './document-viewer'

interface DocumentAudience {
  target_type: 'EMPLOYEE' | 'MANAGEMENT_ROLE' | 'DEPARTMENT_BRANCH'
  target_employee_id: string | null
  target_management_role_id: string | null
  target_department_id: string | null
}

interface DocumentItem {
  id: string
  title: string
  description: string | null
  tags: string[]
  custom_fields: Json
  original_filename: string
  content_type: string
  file_size: number
  expires_on: string | null
  created_at: string
  deleted_at: string | null
  delete_reason: string | null
  expiry_reminder_id: string | null
  document_categories: { code: string; name: string } | null
  document_audiences: DocumentAudience[]
}
interface Option { id: string; code: string; name: string }
interface EmployeeOption { id: string; employee_number: string; first_name: string; birth_name: string }
interface DocumentCustomField {
  id: string; key: string; label_nl: string; label_en: string
  field_type: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'AUTO_INCREMENT'
  is_required: boolean
  options: Array<{ definition_id: string; value: string; label_nl: string; label_en: string; sort_order: number }>
}
interface Options { categories: Option[]; departments: Option[]; roles: Option[]; employees: EmployeeOption[]; cloudTags: Array<{ id: string; name: string }>; documentCustomFields: DocumentCustomField[] }

interface Labels {
  title: string
  subtitle: string
  upload: string
  uploadAdvanced: string
  file: string
  fileDropTitle: string
  fileDropHelp: string
  fileSelected: string
  fileReplace: string
  fileRemove: string
  fileRules: string
  documentTitle: string
  description: string
  tags: string
  noCloudTags: string
  category: string
  requiredFields: string
  advancedSettings: string
  visibleToTitle: string
  visibleToEmployee: string
  visibleToRole: string
  visibleToDepartment: string
  visibilityDefault: string
  reminderTitle: string
  expiresOn: string
  reminderAt: string
  reminderForEmployee: string
  reminderForRole: string
  save: string
  saving: string
  failed: string
  empty: string
  download: string
  delete: string
  restore: string
  deleteReason: string
  deleted: string
  expires: string
  reminderActive: string
  addedOn: string
  employeeVisibilityAllowed: string
  employeeVisibilityBlocked: string
  additionalRoles: string
  additionalDepartments: string
  noExtraVisibility: string
  noReminderRecipients: string
  invalidType: string
  invalidSize: string
  invalidInput: string
  audienceRequired: string
  expiryRequired: string
  reminderTargetRequired: string
  singleFileOnly: string
  view: string
  viewerClose: string
  viewerUnsupported: string
  customMetadata: string
  automaticValue: string
  cancel: string
  close: string
  moreActions: string
  discardTitle: string
  discardDescription: string
  discardConfirm: string
  discardCancel: string
  deleteTitle: string
  deleteDescription: string
  deleteConfirm: string
  deleteCancel: string
  restoreTitle: string
  restoreDescription: string
  restoreConfirm: string
  restoreCancel: string
}

export function EmployeeDocumentDossier({
  employeeId,
  documents,
  options,
  canWrite,
  canDelete,
  labels,
}: {
  employeeId: string
  documents: DocumentItem[]
  options: Options | null
  canWrite: boolean
  canDelete: boolean
  labels: Labels
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [employeeVisible, setEmployeeVisible] = useState(true)
  const [visibleRoleIds, setVisibleRoleIds] = useState<string[]>(() => defaultRoleIds(options?.roles ?? []))
  const [visibleDepartmentIds, setVisibleDepartmentIds] = useState<string[]>([])
  const [expiresOn, setExpiresOn] = useState('')
  const [reminderAt, setReminderAt] = useState('')
  const [reminderEmployee, setReminderEmployee] = useState(true)
  const [reminderRoleIds, setReminderRoleIds] = useState<string[]>([])
  const [selectedCloudTagIds, setSelectedCloudTagIds] = useState<string[]>([])
  const [previewDocument, setPreviewDocument] = useState<DocumentItem | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<string | null>(null)
  const [restoreCandidate, setRestoreCandidate] = useState<string | null>(null)
  const [mutating, setMutating] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    if (saving) return
    if (!options || !selectedFile) {
      setErrorCode('DOCUMENT_INPUT_INVALID')
      return
    }

    if (!isAllowedDocumentFile(selectedFile)) {
      setErrorCode('DOCUMENT_TYPE_INVALID')
      return
    }

    if (selectedFile.size < 1 || selectedFile.size > MAX_DOCUMENT_FILE_BYTES) {
      setErrorCode('DOCUMENT_SIZE_INVALID')
      return
    }

    const form = new FormData(formElement)
    const audiences = [
      ...(employeeVisible ? [{ type: 'EMPLOYEE' as const, targetId: employeeId }] : []),
      ...visibleRoleIds.map((targetId) => ({ type: 'MANAGEMENT_ROLE' as const, targetId })),
      ...visibleDepartmentIds.map((targetId) => ({ type: 'DEPARTMENT_BRANCH' as const, targetId })),
    ]
    const reminderTargets = [
      ...(reminderEmployee ? [{ type: 'EMPLOYEE' as const, targetId: employeeId }] : []),
      ...reminderRoleIds.map((targetId) => ({ type: 'MANAGEMENT_ROLE' as const, targetId })),
    ]
    const customFieldEntries: Array<[string, Json]> = []
    for (const definition of options.documentCustomFields) {
      if (definition.field_type === 'AUTO_INCREMENT') continue
      const name = `customField.${definition.key}`
      if (definition.field_type === 'MULTI_SELECT') { customFieldEntries.push([definition.key, form.getAll(name).map(String)]); continue }
      if (definition.field_type === 'BOOLEAN') { customFieldEntries.push([definition.key, form.get(name) === 'on']); continue }
      const raw = form.get(name)
      if (raw === null || raw === '') continue
      customFieldEntries.push([definition.key, definition.field_type === 'NUMBER' ? Number(raw) : String(raw)])
    }
    const customFields = Object.fromEntries(customFieldEntries)
    const metadata = {
      title: form.get('title'),
      description: form.get('description') || null,
      tags: options.cloudTags.filter((tag) => selectedCloudTagIds.includes(tag.id)).map((tag) => tag.name),
      categoryId: form.get('categoryId'),
      customFields,
      expiresOn: expiresOn || null,
      audiences,
      reminder: reminderAt ? { remindAt: new Date(reminderAt).toISOString(), targets: reminderTargets } : null,
    }

    const parsed = documentMetadataSchema.safeParse(metadata)
    if (!parsed.success) {
      setErrorCode(parsed.error.issues[0]?.message ?? 'DOCUMENT_INPUT_INVALID')
      return
    }

    setSaving(true)
    setErrorCode(null)

    const body = new FormData()
    body.set('file', selectedFile)
    body.set('metadata', JSON.stringify(parsed.data))

    const response = await fetch(`/api/employees/${employeeId}/documents`, { method: 'POST', body })
    const payload = await response.json().catch(() => null)
    setSaving(false)

    if (!response.ok) {
      setErrorCode(typeof payload?.code === 'string' ? payload.code : 'DOCUMENT_ACTION_FAILED')
      return
    }

    formElement.reset()
    resetFormState(options.roles)
    setDirty(false)
    router.refresh()
  }

  async function mutate(documentId: string, restore: boolean, reason?: string): Promise<void> {
    if (mutating) return
    setMutating(true)
    setErrorCode(null)
    try {
      const response = await fetch(`/api/employees/${employeeId}/documents/${documentId}`, {
        method: restore ? 'PATCH' : 'DELETE',
        headers: restore ? undefined : { 'content-type': 'application/json' },
        body: restore ? undefined : JSON.stringify({ reason }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setErrorCode(typeof payload?.code === 'string' ? payload.code : 'DOCUMENT_ACTION_FAILED')
        return
      }

      setDeleteCandidate(null)
      setRestoreCandidate(null)
      setDeleteReason('')
      router.refresh()
    } catch {
      setErrorCode('DOCUMENT_ACTION_FAILED')
    } finally {
      setMutating(false)
    }
  }

  function resetFormState(roleOptions: Option[]) {
    setSelectedFile(null)
    setDragActive(false)
    setEmployeeVisible(true)
    setVisibleRoleIds(defaultRoleIds(roleOptions))
    setVisibleDepartmentIds([])
    setExpiresOn('')
    setReminderAt('')
    setReminderEmployee(true)
    setReminderRoleIds([])
    setSelectedCloudTagIds([])
    setErrorCode(null)
  }

  function requestReset(): void {
    if (saving) return
    if (dirty) { setDiscardOpen(true); return }
    resetUploadForm()
  }

  function resetUploadForm(): void {
    formRef.current?.reset()
    resetFormState(options?.roles ?? [])
    setDirty(false)
  }

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  function handleFileChange(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      setSelectedFile(null)
      return
    }

    if (fileList.length > 1) {
      setErrorCode('DOCUMENT_FILE_COUNT_INVALID')
      return
    }

    setSelectedFile(fileList[0])
    setDirty(true)
    setErrorCode(null)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragActive(false)
    if (event.dataTransfer.files.length > 1) {
      setErrorCode('DOCUMENT_FILE_COUNT_INVALID')
      return
    }
    handleFileChange(event.dataTransfer.files)
  }

  return (
    <Surface className="mt-8 p-5 sm:p-6">
      <SectionHeader description={labels.subtitle} title={labels.title} />

      {canWrite && options ? (
        <div className="mt-6 rounded-[var(--radius-surface)] border border-subtle bg-surface-subtle p-4">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold"><Upload className="h-4 w-4" />{labels.upload}</h3>

          <form className="mt-4 space-y-5" onChange={() => setDirty(true)} onInput={() => setDirty(true)} onSubmit={(event) => void upload(event)} ref={formRef}>
            <div className="rounded-[var(--radius-surface)] border border-subtle bg-surface p-4">
              <p className="text-sm font-semibold">{labels.requiredFields}</p>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,.9fr)]">
                <div className="space-y-4">
                  <label
                    className={`block rounded-[var(--radius-surface)] border-2 border-dashed bg-surface p-4 transition-colors ${dragActive ? 'border-primary bg-accent/40' : 'border-border'} ${selectedFile ? 'border-primary/40' : ''}`}
                    onDragEnter={() => setDragActive(true)}
                    onDragLeave={() => setDragActive(false)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <input
                      accept={DOCUMENT_FILE_ACCEPT}
                      className="sr-only"
                      name="file"
                      onChange={(event) => handleFileChange(event.currentTarget.files)}
                      ref={fileInputRef}
                      type="file"
                    />
                    <span className="flex items-start gap-3">
                      <span className="rounded-[var(--radius-control)] bg-primary/10 p-2 text-primary">
                        <Upload className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{labels.fileDropTitle}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">{labels.fileDropHelp}</span>
                        <span className="mt-2 block text-xs text-muted-foreground">{labels.fileRules}</span>
                        {selectedFile ? (
                            <span className="mt-3 block rounded-[var(--radius-control)] border border-subtle bg-surface-subtle px-3 py-2 text-sm font-medium text-foreground">
                            {labels.fileSelected}: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={openFilePicker} type="button" variant="secondary">
                      {selectedFile ? labels.fileReplace : labels.file}
                    </Button>
                    {selectedFile ? (
                      <Button onClick={() => { setDirty(true); setSelectedFile(null) }} type="button" variant="ghost">
                        {labels.fileRemove}
                      </Button>
                    ) : null}
                  </div>

                  <FormField control={<TextInput name="title" />} label={labels.documentTitle} required />

                  <FormField
                    control={<DropdownSelect defaultValue={options.categories[0]?.id} name="categoryId" required searchable searchPlaceholder={labels.category}>
                      {options.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.code} · {category.name}
                        </option>
                      ))}
                    </DropdownSelect>}
                    label={labels.category}
                    required
                  />
                </div>

                <fieldset className="rounded-[var(--radius-surface)] border border-subtle bg-surface p-4">
                  <legend className="px-1 text-sm font-semibold">{labels.visibleToTitle}</legend>
                  <p className="mt-1 text-sm text-muted-foreground">{labels.visibilityDefault}</p>

                  <div className="mt-4 space-y-3">
                    <CheckboxCard checked={employeeVisible} description={employeeVisible ? labels.employeeVisibilityAllowed : labels.employeeVisibilityBlocked} label={labels.visibleToEmployee} onChange={() => setEmployeeVisible((current) => !current)} />
                  </div>
                </fieldset>
              </div>
              {options.documentCustomFields.length ? <fieldset className="mt-4 rounded-[var(--radius-surface)] border border-subtle bg-surface p-4"><legend className="px-1 text-sm font-semibold">{labels.customMetadata}</legend><div className="mt-3 grid gap-4 md:grid-cols-2">{options.documentCustomFields.map((definition) => <DocumentCustomFieldControl definition={definition} key={definition.id} labels={labels} />)}</div></fieldset> : null}
            </div>

            <details className="rounded-[var(--radius-surface)] border border-subtle p-4">
              <summary className="cursor-pointer text-sm font-semibold">{labels.advancedSettings}</summary>
              <div className="mt-4 space-y-5">
                <p className="text-sm text-muted-foreground">{labels.uploadAdvanced}</p>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField className="md:col-span-2" control={<Textarea name="description" rows={3} />} label={labels.description} />

                  <fieldset className="rounded-[var(--radius-surface)] border border-subtle p-4 md:col-span-2">
                    <legend className="px-1 text-sm font-semibold">{labels.tags}</legend>
                    {options.cloudTags.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{options.cloudTags.map((tag) => <CheckboxCard checked={selectedCloudTagIds.includes(tag.id)} description={tag.name} key={tag.id} label={tag.name} onChange={() => setSelectedCloudTagIds((current) => toggleValue(current, tag.id))} />)}</div> : <p className="mt-2 text-sm text-muted-foreground">{labels.noCloudTags}</p>}
                  </fieldset>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <fieldset className="rounded-[var(--radius-surface)] border border-subtle p-4">
                    <legend className="px-1 text-sm font-semibold">{labels.visibleToRole}</legend>
                    <div className="mt-3 grid gap-2">
                      {options.roles.map((role) => (
                        <CheckboxCard
                          checked={visibleRoleIds.includes(role.id)}
                          description={role.name}
                          key={role.id}
                          label={role.code}
                          onChange={() => setVisibleRoleIds((current) => toggleValue(current, role.id))}
                        />
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="rounded-[var(--radius-surface)] border border-subtle p-4">
                    <legend className="px-1 text-sm font-semibold">{labels.visibleToDepartment}</legend>
                    <div className="mt-3 grid gap-2">
                      {options.departments.map((department) => (
                        <CheckboxCard
                          checked={visibleDepartmentIds.includes(department.id)}
                          description={department.name}
                          key={department.id}
                          label={department.code}
                          onChange={() => setVisibleDepartmentIds((current) => toggleValue(current, department.id))}
                        />
                      ))}
                    </div>
                  </fieldset>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)]">
                  <div className="space-y-4 rounded-[var(--radius-surface)] border border-subtle p-4">
                    <p className="text-sm font-semibold">{labels.reminderTitle}</p>

                    <FormField control={<TextInput name="expiresOn" onChange={(event) => setExpiresOn(event.currentTarget.value)} type="date" value={expiresOn} />} label={labels.expiresOn} />

                    <FormField control={<TextInput name="reminderAt" onChange={(event) => setReminderAt(event.currentTarget.value)} type="datetime-local" value={reminderAt} />} label={labels.reminderAt} />
                  </div>

                  <fieldset className="rounded-[var(--radius-surface)] border border-subtle p-4">
                    <legend className="px-1 text-sm font-semibold">{labels.reminderTitle}</legend>
                    <div className="mt-3 space-y-3">
                      <CheckboxCard
                        checked={reminderEmployee}
                        description={labels.reminderForEmployee}
                        label={labels.visibleToEmployee}
                        onChange={() => setReminderEmployee((current) => !current)}
                      />
                      <div className="grid gap-2">
                        {options.roles.map((role) => (
                          <CheckboxCard
                            checked={reminderRoleIds.includes(role.id)}
                            description={role.name}
                            key={role.id}
                            label={`${labels.reminderForRole}: ${role.code}`}
                            onChange={() => setReminderRoleIds((current) => toggleValue(current, role.id))}
                          />
                        ))}
                      </div>
                    </div>
                  </fieldset>
                </div>
              </div>
            </details>

            <FormActions cancelLabel={labels.cancel} onCancel={requestReset} saveLabel={labels.save} saving={saving} sticky />
          </form>
        </div>
      ) : null}

      {errorCode ? <p className="mt-4 text-sm text-destructive" role="alert">{messageForCode(errorCode, labels)}</p> : null}

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {documents.length === 0 ? (
          <EmptyState className="lg:col-span-2" description={labels.subtitle} icon={<FileText />} title={labels.empty} />
        ) : (
          documents.map((document) => {
            const employeeCanView = document.document_audiences.some((audience) => audience.target_type === 'EMPLOYEE' && audience.target_employee_id === employeeId)
            const roleCount = document.document_audiences.filter((audience) => audience.target_type === 'MANAGEMENT_ROLE').length
            const departmentCount = document.document_audiences.filter((audience) => audience.target_type === 'DEPARTMENT_BRANCH').length

            return (
              <article className={`rounded-[var(--radius-surface)] border border-subtle bg-surface p-4 ${document.deleted_at ? 'opacity-60' : ''}`} key={document.id}>
                <div className="flex items-start gap-3">
                  <span className="rounded-[var(--radius-control)] bg-muted p-2">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{document.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {document.original_filename} · {formatFileSize(document.file_size)}
                    </p>
                  </div>
                  {document.deleted_at ? <Badge tone="danger">{labels.deleted}</Badge> : null}
                </div>

                <div className={`mt-3 rounded-[var(--radius-control)] border px-3 py-2 text-sm ${employeeCanView ? 'border-success/30 bg-success-surface/60 text-foreground' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>
                  <p className="font-semibold">
                    {employeeCanView ? labels.employeeVisibilityAllowed : labels.employeeVisibilityBlocked}
                  </p>
                  {!employeeCanView ? (
                    <p className="mt-1 flex items-center gap-2 text-xs">
                      <ShieldAlert className="h-4 w-4" />
                      {labels.employeeVisibilityBlocked}
                    </p>
                  ) : null}
                </div>

                {document.description ? <p className="mt-3 text-sm text-muted-foreground">{document.description}</p> : null}
                {document.custom_fields && typeof document.custom_fields === 'object' && !Array.isArray(document.custom_fields) ? <dl className="mt-3 grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-1 rounded-[var(--radius-control)] bg-muted/50 px-3 py-2 text-xs">{Object.entries(document.custom_fields).map(([key, value]) => <div className="contents" key={key}><dt className="font-medium text-muted-foreground">{options?.documentCustomFields.find((definition) => definition.key === key)?.label_nl ?? key}</dt><dd>{displayCustomFieldValue(value)}</dd></div>)}</dl> : null}

                <div className="mt-3 flex flex-wrap gap-1">
                  {document.tags.map((tag) => (
                    <Badge key={tag}>
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="mt-3 text-xs text-muted-foreground">
                  <p>{labels.addedOn}: {document.created_at.slice(0, 10)}</p>
                  {document.expires_on ? <p>{labels.expires}: {document.expires_on}</p> : null}
                  {document.expiry_reminder_id ? <p>{labels.reminderActive}</p> : null}
                  <p>
                    {roleCount > 0 ? `${labels.additionalRoles}: ${roleCount}` : labels.noExtraVisibility}
                    {departmentCount > 0 ? ` · ${labels.additionalDepartments}: ${departmentCount}` : ''}
                  </p>
                </div>

                <div className="mt-4">
                  <RowActions
                    menuItems={[
                      ...(!document.deleted_at ? [{ href: `/api/employees/${employeeId}/documents/${document.id}/download`, id: 'download', label: labels.download }] : []),
                      ...(canDelete && !document.deleted_at ? [{ destructive: true, id: 'delete', label: labels.delete, onSelect: () => { setDeleteReason(''); setDeleteCandidate(document.id) } }] : []),
                      ...(canDelete && document.deleted_at ? [{ id: 'restore', label: labels.restore, onSelect: () => setRestoreCandidate(document.id) }] : []),
                    ]}
                    menuLabel={labels.moreActions}
                    primaryAction={!document.deleted_at ? <Button onClick={() => setPreviewDocument(document)} size="sm" type="button" variant="secondary"><Eye className="h-4 w-4" />{labels.view}</Button> : undefined}
                  />
                </div>
              </article>
            )
          })
        )}
      </div>

      <Dialog closeLabel={labels.close} description={labels.deleteDescription} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={mutating} onClick={() => setDeleteCandidate(null)} type="button" variant="secondary">{labels.deleteCancel}</Button><Button disabled={mutating || !deleteReason.trim()} loading={mutating} onClick={() => { if (deleteCandidate) void mutate(deleteCandidate, false, deleteReason) }} type="button" variant="danger">{labels.deleteConfirm}</Button></div>} onOpenChange={(open) => { if (!open && !mutating) setDeleteCandidate(null) }} open={deleteCandidate !== null} title={labels.deleteTitle}>
        <FormField control={<TextInput autoFocus onChange={(event) => setDeleteReason(event.target.value)} required value={deleteReason} />} label={labels.deleteReason} required />
      </Dialog>
      <ConfirmDialog cancelLabel={labels.restoreCancel} confirmLabel={labels.restoreConfirm} description={labels.restoreDescription} onConfirm={() => restoreCandidate ? mutate(restoreCandidate, true) : Promise.resolve()} onOpenChange={(open) => { if (!open && !mutating) setRestoreCandidate(null) }} open={restoreCandidate !== null} pending={mutating} title={labels.restoreTitle} />
      <ConfirmDialog cancelLabel={labels.discardCancel} confirmLabel={labels.discardConfirm} description={labels.discardDescription} destructive onConfirm={() => { setDiscardOpen(false); resetUploadForm() }} onOpenChange={setDiscardOpen} open={discardOpen} title={labels.discardTitle} />
      {previewDocument ? <DocumentViewer contentType={previewDocument.content_type} filename={previewDocument.original_filename} labels={{ close: labels.viewerClose, download: labels.download, unsupported: labels.viewerUnsupported }} onClose={() => setPreviewDocument(null)} previewHref={`/api/employees/${employeeId}/documents/${previewDocument.id}/download`} title={previewDocument.title} /> : null}
    </Surface>
  )
}

function DocumentCustomFieldControl({ definition, labels }: { definition: DocumentCustomField; labels: Labels }) {
  const name = `customField.${definition.key}`
  const label = definition.label_nl
  const wide = definition.field_type === 'TEXTAREA' || definition.field_type === 'MULTI_SELECT'

  if (definition.field_type === 'BOOLEAN') return <div className={wide ? 'md:col-span-2' : undefined}><Checkbox name={name} label={label} /></div>
  if (definition.field_type === 'TEXTAREA') return <FormField className="md:col-span-2" control={<Textarea name={name} required={definition.is_required} rows={3} />} label={label} required={definition.is_required} />
  if (definition.field_type === 'SELECT' || definition.field_type === 'MULTI_SELECT') {
    return <FormField
      className={wide ? 'md:col-span-2' : undefined}
      control={<DropdownSelect multiple={definition.field_type === 'MULTI_SELECT'} name={name} required={definition.is_required} searchable={definition.field_type === 'SELECT'} searchPlaceholder={label}>
        {definition.field_type === 'SELECT' ? <option value="" /> : null}
        {definition.options.map((option) => <option key={option.value} value={option.value}>{option.label_nl}</option>)}
      </DropdownSelect>}
      label={label}
      required={definition.is_required}
    />
  }
  if (definition.field_type === 'AUTO_INCREMENT') return <FormField control={<TextInput disabled placeholder={labels.automaticValue} />} label={label} />

  return <FormField control={<TextInput name={name} required={definition.is_required} type={definition.field_type === 'NUMBER' ? 'number' : definition.field_type === 'DATE' ? 'date' : 'text'} />} label={label} required={definition.is_required} />
}

function displayCustomFieldValue(value: Json | undefined): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ')
  if (typeof value === 'boolean') return value ? '✓' : '—'
  if (value === null || value === undefined) return '—'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function CheckboxCard({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean
  label: string
  description: string
  onChange: () => void
}) {
  return <div className={`rounded-[var(--radius-control)] border px-3 py-3 text-sm transition-colors ${checked ? 'border-primary/40 bg-accent/40' : 'border-border'}`}><Checkbox checked={checked} description={description} label={label} onChange={onChange} /></div>
}

function defaultRoleIds(roles: Option[]): string[] {
  return roles
    .filter((role) => role.code === 'DIRECT_MANAGER' || role.code === 'HR_ADMIN' || role.code === 'TENANT_ADMIN')
    .map((role) => role.id)
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function formatFileSize(fileSize: number): string {
  if (fileSize < 1024) return `${fileSize} B`
  return `${Math.ceil(fileSize / 1024)} KB`
}

function messageForCode(code: string, labels: Labels): string {
  switch (code) {
    case 'DOCUMENT_TYPE_INVALID':
      return labels.invalidType
    case 'DOCUMENT_SIZE_INVALID':
      return labels.invalidSize
    case 'DOCUMENT_AUDIENCE_REQUIRED':
      return labels.audienceRequired
    case 'DOCUMENT_EXPIRY_REQUIRED':
      return labels.expiryRequired
    case 'DOCUMENT_REMINDER_TARGET_REQUIRED':
    case 'REMINDER_TARGET_SCOPE_INVALID':
      return labels.reminderTargetRequired
    case 'DOCUMENT_FILE_COUNT_INVALID':
      return labels.singleFileOnly
    case 'DOCUMENT_INPUT_INVALID':
    case 'DOCUMENT_METADATA_FAILED':
    case 'REMINDER_FORBIDDEN':
      return labels.invalidInput
    default:
      return labels.failed
  }
}
