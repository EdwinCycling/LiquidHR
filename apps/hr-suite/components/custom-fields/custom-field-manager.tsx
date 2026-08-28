'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { CustomFieldDefinition } from '@/lib/custom-fields/service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Surface } from '@/components/ui/surface'
import { TextInput } from '@/components/ui/text-input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/patterns/confirm-dialog'
import { EntityList } from '@/components/patterns/entity-list'
import { FormDrawer } from '@/components/patterns/form-drawer'
import { FormField } from '@/components/patterns/form-field'
import { RowActions } from '@/components/patterns/row-actions'
import { tabLinkClasses } from '@/components/patterns/tab-link-classes'

const TYPES = ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'MULTI_SELECT', 'AUTO_INCREMENT'] as const
const ACCESS = ['HIDDEN', 'READ', 'WRITE'] as const
type FieldType = (typeof TYPES)[number]
type Access = (typeof ACCESS)[number]

interface Labels {
  entity: string; employeeEntity: string; documentEntity: string
  newField: string; technicalKey: string; labelNl: string; labelEn: string; fieldType: string; country: string
  required: string; hrAccess: string; managerAccess: string; selfAccess: string; options: string
  chartFilter: string; chartFilterHelp: string; create: string; creating: string; empty: string
  created: string; failed: string; active: string; inactive: string; edit: string; editField: string
  saveDefinition: string; savingDefinition: string; delete: string; deleteConfirm: string; deleted: string
  inUse: string; activate: string; deactivate: string; sortBy: string; sortLabel: string; sortActive: string
  ascending: string; descending: string; preview: string; previewEmpty: string; previewValue: string
  technicalIdentityHelp: string; cancel: string; types: Record<FieldType, string>; access: Record<Access, string>
  discardTitle: string; discardDescription: string; discardConfirm: string; keepEditing: string
}

type OptionDraft = { value: string; labelNl: string; labelEn: string }
type FieldDraft = {
  key: string
  labelNl: string
  labelEn: string
  countryCode: string
  fieldType: FieldType
  required: boolean
  chartFilter: boolean
  hrAccess: Access
  managerAccess: Access
  selfAccess: Access
  options: string
}
type EditorState = { mode: 'create' | 'edit'; definitionId?: string; draft: FieldDraft; original: FieldDraft }

function parseOptions(value: string): OptionDraft[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [optionValue = '', labelNl = '', labelEn = ''] = line.split(':').map((part) => part.trim())
    return { value: optionValue, labelNl: labelNl || optionValue, labelEn: labelEn || labelNl || optionValue }
  }).filter((option) => option.value)
}

function definitionDraft(definition: CustomFieldDefinition): FieldDraft {
  return {
    key: definition.key,
    labelNl: definition.labelNl,
    labelEn: definition.labelEn,
    countryCode: definition.countryCode,
    fieldType: definition.fieldType,
    required: definition.isRequired,
    chartFilter: definition.showInOrganizationChartFilter,
    hrAccess: definition.hrAccess,
    managerAccess: definition.managerAccess,
    selfAccess: definition.employeeSelfAccess,
    options: definition.options.map((option) => `${option.value}:${option.labelNl}:${option.labelEn}`).join('\n'),
  }
}

function newDraft(): FieldDraft {
  return { key: '', labelNl: '', labelEn: '', countryCode: 'NL', fieldType: 'TEXT', required: false, chartFilter: false, hrAccess: 'WRITE', managerAccess: 'HIDDEN', selfAccess: 'HIDDEN', options: '' }
}

function PreviewControl({ fieldType, options, labels }: { fieldType: FieldType; options: OptionDraft[]; labels: Labels }): ReactNode {
  if (fieldType === 'TEXTAREA') return <Textarea disabled placeholder={labels.previewValue} />
  if (fieldType === 'BOOLEAN') return <Checkbox disabled label={labels.previewValue} />
  if (fieldType === 'SELECT' || fieldType === 'MULTI_SELECT') return <DropdownSelect disabled multiple={fieldType === 'MULTI_SELECT'} aria-label={labels.previewValue}><option value={options[0]?.value ?? ''}>{options[0]?.labelNl || labels.previewValue}</option></DropdownSelect>
  if (fieldType === 'AUTO_INCREMENT') return <TextInput disabled readOnly value="1001" />
  return <TextInput disabled placeholder={labels.previewValue} type={fieldType === 'NUMBER' ? 'number' : fieldType === 'DATE' ? 'date' : 'text'} />
}

function accessOptions(labels: Labels) {
  return ACCESS.map((value) => <option key={value} value={value}>{labels.access[value]}</option>)
}

export function CustomFieldManager({ definitions, entityType, labels }: { definitions: CustomFieldDefinition[]; entityType: 'EMPLOYEE' | 'DOCUMENT'; labels: Labels }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldDefinition | null>(null)

  function openCreate(): void {
    const draft = newDraft()
    setMessage(null)
    setEditor({ mode: 'create', draft, original: draft })
  }

  function openEdit(definition: CustomFieldDefinition): void {
    const draft = definitionDraft(definition)
    setMessage(null)
    setEditor({ mode: 'edit', definitionId: definition.id, draft, original: draft })
  }

  function updateDraft(patch: Partial<FieldDraft>): void {
    setEditor((current) => current ? { ...current, draft: { ...current.draft, ...patch } } : current)
  }

  async function responseMessage(response: Response): Promise<string> {
    if (response.ok) return ''
    const payload = await response.json().catch(() => null) as { error?: string } | null
    return payload?.error === 'CUSTOM_FIELD_IN_USE' ? labels.inUse : labels.failed
  }

  async function saveEditor(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!editor) return
    setSaving(true)
    setMessage(null)
    const { draft } = editor
    const options = parseOptions(draft.options).map((option, index) => ({ ...option, sortOrder: index }))
    const body = editor.mode === 'create'
      ? { entityType, key: draft.key, labelNl: draft.labelNl, labelEn: draft.labelEn, countryCode: draft.countryCode, fieldType: draft.fieldType, isRequired: draft.required, hrAccess: draft.hrAccess, showInOrganizationChartFilter: draft.chartFilter, managerAccess: draft.managerAccess, employeeSelfAccess: draft.selfAccess, options }
      : { labelNl: draft.labelNl, labelEn: draft.labelEn, countryCode: draft.countryCode, isRequired: draft.required, showInOrganizationChartFilter: draft.chartFilter, hrAccess: draft.hrAccess, managerAccess: draft.managerAccess, employeeSelfAccess: draft.selfAccess }
    try {
      const response = await fetch(editor.mode === 'create' ? '/api/custom-fields' : `/api/custom-fields/${editor.definitionId}`, { method: editor.mode === 'create' ? 'POST' : 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const errorMessage = await responseMessage(response)
      if (errorMessage) throw new Error(errorMessage)
      setMessage(labels.created)
      setEditor(null)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.failed)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(definition: CustomFieldDefinition): Promise<void> {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/custom-fields/${definition.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isActive: !definition.isActive }) })
      const errorMessage = await responseMessage(response)
      if (errorMessage) throw new Error(errorMessage)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.failed)
    } finally {
      setSaving(false)
    }
  }

  async function deleteDefinition(): Promise<void> {
    if (!deleteTarget) return
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/custom-fields/${deleteTarget.id}`, { method: 'DELETE' })
      const errorMessage = await responseMessage(response)
      if (errorMessage) throw new Error(errorMessage)
      setDeleteTarget(null)
      setEditor((current) => current?.definitionId === deleteTarget.id ? null : current)
      setMessage(labels.deleted)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.failed)
    } finally {
      setSaving(false)
    }
  }

  const isDirty = editor ? JSON.stringify(editor.draft) !== JSON.stringify(editor.original) : false

  return <div className="space-y-6">
    <nav aria-label={labels.entity} className="flex min-w-0 overflow-x-auto border-b border-border-subtle">
      <Link className={tabLinkClasses({ active: entityType === 'EMPLOYEE' })} href="/custom-fields?entity=EMPLOYEE">{labels.employeeEntity}</Link>
      <Link className={tabLinkClasses({ active: entityType === 'DOCUMENT' })} href="/custom-fields?entity=DOCUMENT">{labels.documentEntity}</Link>
    </nav>
    <div>
      <Surface className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle p-5 sm:p-6">
        <div><p className="eyebrow text-primary">{labels.sortBy}</p><p className="mt-1 text-sm text-muted-foreground">{definitions.length} {labels.entity.toLocaleLowerCase()}</p></div>
        <Button onClick={openCreate} type="button">{labels.create}</Button>
      </div>
      {message ? <p aria-live="polite" className="mx-5 mt-4 rounded-[var(--radius-control)] border border-border-subtle bg-surface-subtle px-3 py-2 text-sm text-muted-foreground sm:mx-6">{message}</p> : null}
      </Surface>
      <EntityList
        ariaLabel={labels.entity}
        className="mt-4"
        empty={<p className="px-5 py-12 text-center text-sm text-muted-foreground sm:px-6">{labels.empty}</p>}
        items={definitions.map((definition) => ({
          id: definition.id,
          primary: <Button className="justify-start px-0 text-left font-semibold" onClick={() => openEdit(definition)} size="sm" type="button" variant="ghost">{definition.labelNl}</Button>,
          secondary: <><code className="text-xs text-muted-foreground">{definition.key}</code><span className="mx-2" aria-hidden="true">·</span>{labels.types[definition.fieldType]}<span className="mx-2" aria-hidden="true">·</span>{labels.hrAccess}: {labels.access[definition.hrAccess]}</>,
          badges: <><Badge tone="neutral">{definition.countryCode}</Badge><Badge tone={definition.isActive ? 'success' : 'neutral'}>{definition.isActive ? labels.active : labels.inactive}</Badge></>,
          actions: <RowActions menuLabel={labels.edit} menuItems={[{ id: 'edit', label: labels.edit, onSelect: () => openEdit(definition) }, { id: 'toggle', label: definition.isActive ? labels.deactivate : labels.activate, onSelect: () => void toggleActive(definition) }, { id: 'delete', label: labels.delete, destructive: true, onSelect: () => setDeleteTarget(definition) }]} />,
        }))}
      />
    </div>
    {editor ? <FormDrawer
      cancelLabel={labels.cancel}
      closeLabel={labels.cancel}
      description={labels.technicalIdentityHelp}
      dirty={isDirty}
      dirtyProtection={{ title: labels.discardTitle, description: labels.discardDescription, discardLabel: labels.discardConfirm, keepEditingLabel: labels.keepEditing }}
      onDiscard={() => setEditor(null)}
      onOpenChange={(open) => { if (!open && !isDirty) setEditor(null) }}
      onSubmit={(event) => void saveEditor(event)}
      open
      saveLabel={saving ? labels.savingDefinition : editor.mode === 'create' ? labels.create : labels.saveDefinition}
      saving={saving}
      title={editor.mode === 'create' ? labels.newField : labels.editField}
    >
      {editor.mode === 'create' ? <FormField control={<TextInput name="key" pattern="[a-z][a-z0-9_]{1,62}" required value={editor.draft.key} onChange={(event) => updateDraft({ key: event.target.value })} />} label={labels.technicalKey} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField control={<TextInput name="labelNl" required value={editor.draft.labelNl} onChange={(event) => updateDraft({ labelNl: event.target.value })} />} label={labels.labelNl} />
        <FormField control={<TextInput name="labelEn" required value={editor.draft.labelEn} onChange={(event) => updateDraft({ labelEn: event.target.value })} />} label={labels.labelEn} />
      </div>
      {editor.mode === 'create' ? <FormField control={<DropdownSelect name="fieldType" onChange={(event) => updateDraft({ fieldType: event.target.value as FieldType })} value={editor.draft.fieldType}>{TYPES.map((type) => <option key={type} value={type}>{labels.types[type]}</option>)}</DropdownSelect>} label={labels.fieldType} /> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField control={<DropdownSelect name="hrAccess" onChange={(event) => updateDraft({ hrAccess: event.target.value as Access })} value={editor.draft.hrAccess}>{accessOptions(labels)}</DropdownSelect>} label={labels.hrAccess} />
        <FormField control={<DropdownSelect name="managerAccess" onChange={(event) => updateDraft({ managerAccess: event.target.value as Access })} value={editor.draft.managerAccess}>{accessOptions(labels)}</DropdownSelect>} label={labels.managerAccess} />
        <FormField control={<DropdownSelect name="selfAccess" onChange={(event) => updateDraft({ selfAccess: event.target.value as Access })} value={editor.draft.selfAccess}>{accessOptions(labels)}</DropdownSelect>} label={labels.selfAccess} />
      </div>
      {(editor.draft.fieldType === 'SELECT' || editor.draft.fieldType === 'MULTI_SELECT') ? <FormField control={<Textarea name="options" required value={editor.draft.options} onChange={(event) => updateDraft({ options: event.target.value })} />} label={labels.options} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox checked={editor.draft.required} label={labels.required} onChange={(event) => updateDraft({ required: event.target.checked })} />
        <Checkbox checked={editor.draft.chartFilter} description={labels.chartFilterHelp} label={labels.chartFilter} onChange={(event) => updateDraft({ chartFilter: event.target.checked })} />
      </div>
      {editor.mode === 'edit' && editor.definitionId ? <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4"><Button disabled={saving} onClick={() => { const definition = definitions.find((item) => item.id === editor.definitionId); if (definition) void toggleActive(definition) }} type="button" variant="secondary">{definitions.find((item) => item.id === editor.definitionId)?.isActive ? labels.deactivate : labels.activate}</Button><Button disabled={saving} onClick={() => { const definition = definitions.find((item) => item.id === editor.definitionId); if (definition) setDeleteTarget(definition) }} type="button" variant="danger">{labels.delete}</Button></div> : null}
    </FormDrawer> : null}
    <ConfirmDialog cancelLabel={labels.cancel} confirmLabel={labels.delete} description={labels.deleteConfirm} destructive onConfirm={() => void deleteDefinition()} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }} open={deleteTarget !== null} title={labels.delete} pending={saving} />
    <Surface className="p-5 sm:p-6" variant="subtle"><p className="eyebrow text-primary">{labels.preview}</p><h2 className="mt-1 text-lg font-semibold">{editor?.draft.labelNl || labels.previewEmpty}</h2><p className="mt-1 text-sm text-muted-foreground">{labels.types[editor?.draft.fieldType ?? 'TEXT']}</p><div className="mt-5 max-w-xl"><PreviewControl fieldType={editor?.draft.fieldType ?? 'TEXT'} options={parseOptions(editor?.draft.options ?? '')} labels={labels} /></div></Surface>
  </div>
}
