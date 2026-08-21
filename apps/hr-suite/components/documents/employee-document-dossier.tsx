'use client'

import { Download, Eye, FileText, RotateCcw, ShieldAlert, Trash2, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type DragEvent, type FormEvent, useRef, useState } from 'react'
import type { Json } from '@scope/db'
import {
  DOCUMENT_FILE_ACCEPT,
  isAllowedDocumentFile,
  MAX_DOCUMENT_FILE_BYTES,
} from '@/lib/documents/file-rules'
import { documentMetadataSchema } from '@/lib/documents/schemas'
import { FormField } from '@/components/patterns/form-field'
import { SectionHeader } from '@/components/patterns/section-header'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
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
  const [saving, setSaving] = useState(false)
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

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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

    const form = new FormData(event.currentTarget)
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

    event.currentTarget.reset()
    resetFormState(options.roles)
    router.refresh()
  }

  async function mutate(documentId: string, restore: boolean) {
    setErrorCode(null)
    const response = await fetch(`/api/employees/${employeeId}/documents/${documentId}`, {
      method: restore ? 'PATCH' : 'DELETE',
      headers: restore ? undefined : { 'content-type': 'application/json' },
      body: restore ? undefined : JSON.stringify({ reason: deleteReason }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setErrorCode(typeof payload?.code === 'string' ? payload.code : 'DOCUMENT_ACTION_FAILED')
      return
    }

    router.refresh()
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
        <details className="mt-6 rounded-[var(--radius-surface)] border border-subtle bg-surface-subtle p-4" open>
          <summary className="cursor-pointer list-none text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            <span className="inline-flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {labels.upload}
            </span>
          </summary>

          <form className="mt-4 space-y-5" onSubmit={(event) => void upload(event)}>
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
                      <Button onClick={() => setSelectedFile(null)} type="button" variant="ghost">
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

            <Button loading={saving} type="submit">
              {saving ? labels.saving : labels.save}
            </Button>
          </form>
        </details>
      ) : null}

      {canDelete ? (
        <FormField className="mt-6 max-w-xl" control={<TextInput onChange={(event) => setDeleteReason(event.target.value)} value={deleteReason} />} label={labels.deleteReason} />
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

                <div className="mt-4 flex flex-wrap gap-2">
                  {!document.deleted_at ? (
                    <Button onClick={() => setPreviewDocument(document)} type="button" variant="secondary">
                      <Eye className="h-4 w-4" />
                      {labels.view}
                    </Button>
                  ) : null}

                  {!document.deleted_at ? (
                    <a className={buttonClasses({ variant: 'secondary' })} href={`/api/employees/${employeeId}/documents/${document.id}/download`}>
                      <Download className="h-4 w-4" />
                      {labels.download}
                    </a>
                  ) : null}

                  {canDelete ? (
                    !document.deleted_at ? (
                      <Button disabled={!deleteReason.trim()} onClick={() => void mutate(document.id, false)} type="button" variant="danger">
                        <Trash2 className="h-4 w-4" />
                        {labels.delete}
                      </Button>
                    ) : (
                      <Button onClick={() => void mutate(document.id, true)} type="button" variant="secondary">
                        <RotateCcw className="h-4 w-4" />
                        {labels.restore}
                      </Button>
                    )
                  ) : null}
                </div>
              </article>
            )
          })
        )}
      </div>

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
    .filter((role) => role.code === 'DIRECT_MANAGER' || role.code === 'HR_ADMIN')
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
