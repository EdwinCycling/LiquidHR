'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { MultiSelect } from '@/components/ui/multi-select'
import { Surface } from '@/components/ui/surface'
import { StructuredEditor } from './structured-editor'
import { normalizeCanonicalDocument, parseCanonicalDocument, type CanonicalDocument } from '@/lib/document-studio/canonical-document'
import type { DocumentStudioEditorData } from '@/lib/document-studio/service'

export interface TemplateWorkbenchLabels {
  readonly title: string
  readonly back: string
  readonly save: string
  readonly saved: string
  readonly activate: string
  readonly archive: string
  readonly discard: string
  readonly revision: string
  readonly dirty: string
  readonly clean: string
  readonly content: string
  readonly metadata: string
  readonly composition: string
  readonly validation: string
  readonly tags: string
  readonly tagSearch: string
  readonly tagEmpty: string
  readonly tagNoOptions: string
  readonly tagSelected: string
  readonly tagSave: string
  readonly tagSaved: string
  readonly valid: string
  readonly invalid: string
  readonly validate: string
  readonly activationConfirm: string
  readonly archiveConfirm: string
  readonly conflict: string
  readonly failed: string
  readonly name: string
  readonly description: string
  readonly documentType: string
  readonly profile: string
  readonly category: string
  readonly defaultDossier: string
  readonly categories: Readonly<Record<string, string>>
  readonly kinds: Readonly<Record<string, string>>
  readonly toolbar: {
    readonly bold: string
    readonly italic: string
    readonly underline: string
    readonly heading: string
    readonly bulletList: string
    readonly orderedList: string
    readonly rule: string
    readonly pageBreak: string
    readonly columns: string
    readonly placeholder: string
    readonly placeholderField: string
  }
}

function initialDocument(value: unknown): CanonicalDocument {
  try { return parseCanonicalDocument(value) } catch { throw new Error('DOCUMENT_SCHEMA_INVALID') }
}

export function TemplateWorkbench({ data, labels }: { data: DocumentStudioEditorData; labels: TemplateWorkbenchLabels }) {
  const document = useMemo(() => initialDocument(data.version.document_json), [data.version.document_json])
  const [currentDocument, setCurrentDocument] = useState(document)
  const [name, setName] = useState(data.template.name)
  const [description, setDescription] = useState(data.template.description ?? '')
  const [documentTypeId, setDocumentTypeId] = useState(data.version.document_type_id)
  const [profileId, setProfileId] = useState(data.version.document_profile_id ?? '')
  const [defaultDossier, setDefaultDossier] = useState(data.version.default_dossier)
  const [revision, setRevision] = useState(data.version.revision)
  const [dirty, setDirty] = useState(false)
  const [validation, setValidation] = useState<{ valid: boolean; errors: readonly { code: string }[] } | null>(data.version.validation_state === 'VALID' ? { valid: true, errors: [] } : null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [tagIds, setTagIds] = useState([...data.tagIds])
  const router = useRouter()

  const metadata = { name, description: description.trim() || null, documentTypeId, documentProfileId: profileId || null, defaultDossier }
  const commonLabels = {
    content: labels.content,
    bold: labels.toolbar.bold,
    italic: labels.toolbar.italic,
    underline: labels.toolbar.underline,
    heading: labels.toolbar.heading,
    bulletList: labels.toolbar.bulletList,
    orderedList: labels.toolbar.orderedList,
    rule: labels.toolbar.rule,
    pageBreak: labels.toolbar.pageBreak,
    columns: labels.toolbar.columns,
    placeholder: labels.toolbar.placeholder,
    placeholderField: labels.toolbar.placeholderField,
  }

  async function request(path: string, method: 'PATCH' | 'POST', body: unknown): Promise<Record<string, unknown> | null> {
    setPending(true); setNotice(null)
    try {
      const response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = await response.json() as Record<string, unknown>
      if (!response.ok) {
        if (response.status === 409) throw new Error(labels.conflict)
        throw new Error(labels.failed)
      }
      return result
    } catch (error) {
      setNotice(error instanceof Error ? error.message : labels.failed)
      return null
    } finally { setPending(false) }
  }

  async function save() {
    const result = await request(`/api/document-studio/template-versions/${data.version.id}/draft`, 'PATCH', {
      expectedRevision: revision,
      idempotencyKey: crypto.randomUUID(),
      metadata,
      document: currentDocument,
      composition: [],
      assetRefs: collectAssetRefs(currentDocument),
    })
    if (result && typeof result.revision === 'number') { setRevision(result.revision); setDirty(false); setNotice(labels.saved); setValidation(null) }
  }

  async function validate() {
    const result = await request(`/api/document-studio/template-versions/${data.version.id}/validate`, 'POST', { expectedRevision: revision })
    if (!result) return
    const errors = Array.isArray(result.errors) ? result.errors.filter((item): item is { code: string } => typeof item === 'object' && item !== null && 'code' in item && typeof item.code === 'string') : []
    setValidation({ valid: result.valid === true, errors })
  }

  async function activate() {
    if (!window.confirm(labels.activationConfirm)) return
    const result = await request(`/api/document-studio/template-versions/${data.version.id}/activate`, 'POST', { expectedRevision: revision, idempotencyKey: crypto.randomUUID() })
    if (result) router.push(`/document-studio/templates/${data.template.id}`)
  }

  async function saveTags() {
    const result = await request(`/api/document-studio/templates/${data.template.id}/tags`, 'PATCH', { tagIds })
    if (result) setNotice(labels.tagSaved)
  }

  async function archive() {
    if (!window.confirm(labels.archiveConfirm)) return
    const result = await request(`/api/document-studio/templates/${data.template.id}/archive`, 'POST', { idempotencyKey: crypto.randomUUID() })
    if (result) router.push('/document-studio')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/document-studio/templates/${data.template.id}`}>{labels.back}</Link>
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-muted-foreground">{labels.revision.replace('{revision}', String(revision))}</span><span className={`text-sm ${dirty ? 'text-warning' : 'text-muted-foreground'}`}>{dirty ? labels.dirty : labels.clean}</span><Button loading={pending} onClick={save} type="button">{labels.save}</Button><Button disabled={dirty || validation?.valid !== true} loading={pending} onClick={activate} type="button" variant="secondary">{labels.activate}</Button><Button loading={pending} onClick={archive} type="button" variant="danger">{labels.archive}</Button></div>
      </div>
      {notice ? <p className="rounded-[var(--radius-control)] border border-border bg-surface-subtle p-3 text-sm" role="status">{notice}</p> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5"><Surface className="p-5"><div className="mb-4"><h2 className="text-base font-semibold">{labels.content}</h2></div><StructuredEditor initialDocument={document} kind={data.template.kind} labels={commonLabels} onChange={(next) => { setCurrentDocument(next); setDirty(true); setValidation(null) }} /></Surface></div>
        <aside className="space-y-5">
          <Surface className="space-y-4 p-5"><h2 className="text-base font-semibold">{labels.metadata}</h2><label className="block space-y-1 text-sm font-medium"><span>{labels.name}</span><input className="min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" onChange={(event) => { setName(event.target.value); setDirty(true) }} value={name} /></label><label className="block space-y-1 text-sm font-medium"><span>{labels.description}</span><textarea className="min-h-20 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm" onChange={(event) => { setDescription(event.target.value); setDirty(true) }} value={description} /></label><label className="block space-y-1 text-sm font-medium"><span>{labels.documentType}</span><DropdownSelect aria-label={labels.documentType} onChange={(event) => { setDocumentTypeId(event.target.value); setDirty(true) }} searchable searchPlaceholder={labels.documentType} value={documentTypeId}>{data.types.map((type) => <option key={type.id} value={type.id}>{type.name.nl}</option>)}</DropdownSelect></label><label className="block space-y-1 text-sm font-medium"><span>{labels.profile}</span><DropdownSelect aria-label={labels.profile} onChange={(event) => { setProfileId(event.target.value); setDirty(true) }} searchable searchPlaceholder={labels.profile} value={profileId}><option value="">—</option>{data.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</DropdownSelect></label><label className="block space-y-1 text-sm font-medium"><span>{labels.category}</span><p className="mt-1 rounded-[var(--radius-control)] border border-border bg-surface-subtle px-3 py-2 text-sm">{labels.categories[data.version.category_code] ?? data.version.category_code}</p></label><label className="flex items-center gap-2 text-sm font-medium"><input checked={defaultDossier} className="size-4 accent-primary" onChange={(event) => { setDefaultDossier(event.target.checked); setDirty(true) }} type="checkbox" />{labels.defaultDossier}</label></Surface>
          <Surface className="space-y-3 p-5"><h2 className="text-base font-semibold">{labels.validation}</h2>{validation ? <p className={`text-sm font-medium ${validation.valid ? 'text-success' : 'text-destructive'}`}>{validation.valid ? labels.valid : labels.invalid}</p> : <p className="text-sm text-muted-foreground">{labels.invalid}</p>}{validation && validation.errors.length ? <ul className="list-disc space-y-1 pl-5 text-xs text-destructive">{validation.errors.map((error, index) => <li key={`${error.code}-${index}`}>{error.code}</li>)}</ul> : null}<Button disabled={dirty || pending} onClick={validate} size="sm" type="button" variant="secondary">{labels.validate}</Button></Surface>
          <Surface className="space-y-3 p-5"><h2 className="text-base font-semibold">{labels.tags}</h2><MultiSelect aria-label={labels.tags} emptySelectionLabel={labels.tagEmpty} noOptionsLabel={labels.tagNoOptions} loadingLabel={labels.tagEmpty} loading={pending} onChange={setTagIds} options={data.tags.map((tag) => ({ value: tag.id, label: tag.name }))} searchPlaceholder={labels.tagSearch} selectedCountLabel={labels.tagSelected} value={tagIds} /><Button disabled={pending} onClick={saveTags} size="sm" type="button" variant="secondary">{labels.tagSave}</Button></Surface>
          <Surface className="space-y-3 p-5"><h2 className="text-base font-semibold">{labels.composition}</h2>{data.compositions.length ? <ul className="space-y-2 text-sm">{data.compositions.map((item) => <li className="flex justify-between gap-2" key={`${item.component_kind}-${item.component_template_version_id}`}><span>{item.component_kind}</span><span className="text-muted-foreground">{item.sort_order + 1}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">—</p>}<Button disabled={data.version.status !== 'DRAFT'} loading={pending} onClick={() => request(`/api/document-studio/template-versions/${data.version.id}/discard`, 'POST', { idempotencyKey: crypto.randomUUID() }).then((result) => { if (result) router.push('/document-studio') })} size="sm" type="button" variant="danger">{labels.discard}</Button></Surface>
        </aside>
      </div>
    </div>
  )
}

function collectAssetRefs(document: CanonicalDocument): string[] {
  return [...normalizeCanonicalDocument(document).assetRefs]
}
