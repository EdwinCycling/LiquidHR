'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { MultiSelect } from '@/components/ui/multi-select'
import { Surface } from '@/components/ui/surface'
import { CATEGORY_CODES, emptyCanonicalDocument, normalizeCanonicalDocument, parseCanonicalDocument, type CanonicalDocument, type DocumentCategory } from '@/lib/document-studio/canonical-document'
import { canAddComposition, compositionItemsFromRows, compositionRowsForSave } from '@/lib/document-studio/composition'
import type { DocumentStudioEditorData } from '@/lib/document-studio/service'
import type { CompositionItem } from '@/lib/document-studio/schemas'
import { StructuredEditor, type StructuredEditorLabels } from './structured-editor'
import { unwrapDocumentStudioData } from './api-response'

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
  readonly compositionDocumentOnly: string
  readonly compositionSelect: string
  readonly compositionAdd: string
  readonly compositionRemove: string
  readonly compositionMoveUp: string
  readonly compositionMoveDown: string
  readonly compositionEmpty: string
  readonly compositionCoverLimit: string
  readonly compositionNoOptions: string
  readonly compositionCover: string
  readonly compositionAppendix: string
  readonly region: string
  readonly regionBody: string
  readonly regionHeader: string
  readonly regionFooter: string
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
  readonly toolbar: Omit<StructuredEditorLabels, 'content'>
}

type EditableRegion = 'cover' | 'header' | 'body' | 'appendix' | 'footer'
type VisibleComposition = Pick<CompositionItem, 'kind' | 'versionId'>

function initialDocument(value: unknown): CanonicalDocument {
  try { return parseCanonicalDocument(value) } catch { throw new Error('DOCUMENT_SCHEMA_INVALID') }
}

function editableDocument(document: CanonicalDocument, region: EditableRegion): CanonicalDocument {
  if (document.regions[region]) return document
  return {
    ...document,
    regions: {
      ...document.regions,
      [region]: { type: 'region', content: emptyCanonicalDocument('DOCUMENT').regions.body!.content },
    },
  }
}

export function TemplateWorkbench({ data, labels }: { data: DocumentStudioEditorData; labels: TemplateWorkbenchLabels }) {
  const document = useMemo(() => initialDocument(data.version.document_json), [data.version.document_json])
  const [currentDocument, setCurrentDocument] = useState(document)
  const [name, setName] = useState(data.template.name)
  const [description, setDescription] = useState(data.template.description ?? '')
  const [documentTypeId, setDocumentTypeId] = useState(data.version.document_type_id)
  const [profileId, setProfileId] = useState(data.version.document_profile_id ?? '')
  const [categoryCode, setCategoryCode] = useState<DocumentCategory>(data.version.category_code as DocumentCategory)
  const [defaultDossier, setDefaultDossier] = useState(data.version.default_dossier)
  const [composition, setComposition] = useState<VisibleComposition[]>(() => compositionItemsFromRows(data.compositions))
  const [compositionKind, setCompositionKind] = useState<'COVER' | 'APPENDIX'>('COVER')
  const [compositionVersionId, setCompositionVersionId] = useState('')
  const [activeRegion, setActiveRegion] = useState<EditableRegion>(data.template.kind === 'DOCUMENT' ? 'body' : data.template.kind === 'COVER' ? 'cover' : 'appendix')
  const [revision, setRevision] = useState(data.version.revision)
  const [dirty, setDirty] = useState(false)
  const [validation, setValidation] = useState<{ valid: boolean; errors: readonly { code: string }[] } | null>(data.version.validation_state === 'VALID' ? { valid: true, errors: [] } : null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [tagIds, setTagIds] = useState([...data.tagIds])
  const router = useRouter()
  const editorDocument = useMemo(() => editableDocument(currentDocument, activeRegion), [activeRegion, currentDocument])
  const compositionOptions = useMemo(() => data.compositionOptions.filter((option) => option.kind === compositionKind), [compositionKind, data.compositionOptions])

  const metadata = { name, description: description.trim() || null, documentTypeId, documentProfileId: profileId || null, categoryCode, defaultDossier }
  const commonLabels: StructuredEditorLabels = {
    content: labels.content,
    paragraph: labels.toolbar.paragraph,
    heading1: labels.toolbar.heading1,
    heading2: labels.toolbar.heading2,
    heading3: labels.toolbar.heading3,
    fontSize: labels.toolbar.fontSize,
    fontSizeUnit: labels.toolbar.fontSizeUnit,
    alignLeft: labels.toolbar.alignLeft,
    alignCenter: labels.toolbar.alignCenter,
    alignRight: labels.toolbar.alignRight,
    alignJustify: labels.toolbar.alignJustify,
    bold: labels.toolbar.bold,
    italic: labels.toolbar.italic,
    underline: labels.toolbar.underline,
    bulletList: labels.toolbar.bulletList,
    orderedList: labels.toolbar.orderedList,
    rule: labels.toolbar.rule,
    pageBreak: labels.toolbar.pageBreak,
    table: labels.toolbar.table,
    tableColumns: labels.toolbar.tableColumns,
    columns: labels.toolbar.columns,
    columnsRatio: labels.toolbar.columnsRatio,
    placeholder: labels.toolbar.placeholder,
    knownPlaceholder: labels.toolbar.knownPlaceholder,
    temporalPlaceholder: labels.toolbar.temporalPlaceholder,
    temporalWas: labels.toolbar.temporalWas,
    temporalIs: labels.toolbar.temporalIs,
    temporalWordt: labels.toolbar.temporalWordt,
    freePlaceholder: labels.toolbar.freePlaceholder,
    freePlaceholderHint: labels.toolbar.freePlaceholderHint,
    insertPlaceholder: labels.toolbar.insertPlaceholder,
    asset: labels.toolbar.asset,
    assetSelect: labels.toolbar.assetSelect,
    assetUpload: labels.toolbar.assetUpload,
    assetAlt: labels.toolbar.assetAlt,
    assetWidth: labels.toolbar.assetWidth,
    assetAlign: labels.toolbar.assetAlign,
    assetInsert: labels.toolbar.assetInsert,
    assetReplace: labels.toolbar.assetReplace,
    assetRemove: labels.toolbar.assetRemove,
    assetNoOptions: labels.toolbar.assetNoOptions,
    assetUploadFailed: labels.toolbar.assetUploadFailed,
  }

  async function request(path: string, method: 'PATCH' | 'POST', body: unknown): Promise<Record<string, unknown> | null> {
    setPending(true); setNotice(null)
    try {
      const response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const result = unwrapDocumentStudioData(await response.json())
      if (!response.ok) {
        if (response.status === 409) throw new Error(labels.conflict)
        throw new Error(labels.failed)
      }
      if (!result) throw new Error(labels.failed)
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
      composition: compositionRowsForSave(composition),
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

  function addComposition() {
    const option = data.compositionOptions.find((candidate) => candidate.versionId === compositionVersionId && candidate.kind === compositionKind)
    if (!option) return
    if (!canAddComposition(composition, option)) {
      if (compositionKind === 'COVER') setNotice(labels.compositionCoverLimit)
      return
    }
    setComposition((current) => [...current, { kind: option.kind, versionId: option.versionId }])
    setDirty(true); setValidation(null)
  }

  function moveComposition(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= composition.length) return
    setComposition((current) => {
      const next = [...current]
      const item = next[index]
      const replacement = next[target]
      if (!item || !replacement) return current
      next[index] = replacement; next[target] = item
      return next
    })
    setDirty(true); setValidation(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/document-studio/templates/${data.template.id}`}>{labels.back}</Link>
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-muted-foreground">{labels.revision.replace('{revision}', String(revision))}</span><span className={`text-sm ${dirty ? 'text-warning' : 'text-muted-foreground'}`}>{dirty ? labels.dirty : labels.clean}</span><Button loading={pending} onClick={save} type="button">{labels.save}</Button><Button disabled={dirty || validation?.valid !== true} loading={pending} onClick={activate} type="button" variant="secondary">{labels.activate}</Button><Button loading={pending} onClick={archive} type="button" variant="danger">{labels.archive}</Button></div>
      </div>
      {notice ? <p className="rounded-[var(--radius-control)] border border-border bg-surface-subtle p-3 text-sm" role="status">{notice}</p> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5"><Surface className="p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">{labels.content}</h2>{data.template.kind === 'DOCUMENT' ? <DropdownSelect aria-label={labels.region} className="w-44" onChange={(event) => setActiveRegion(event.target.value as EditableRegion)} searchable searchPlaceholder={labels.region} value={activeRegion}><option value="body">{labels.regionBody}</option><option value="header">{labels.regionHeader}</option><option value="footer">{labels.regionFooter}</option></DropdownSelect> : null}</div><StructuredEditor assets={data.assets} initialDocument={editorDocument} kind={data.template.kind} labels={commonLabels} onChange={(next) => { setCurrentDocument(next); setDirty(true); setValidation(null) }} region={activeRegion} /></Surface></div>
        <aside className="space-y-5">
          <Surface className="space-y-4 p-5"><h2 className="text-base font-semibold">{labels.metadata}</h2><label className="block space-y-1 text-sm font-medium"><span>{labels.name}</span><input className="min-h-10 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 text-sm" onChange={(event) => { setName(event.target.value); setDirty(true) }} value={name} /></label><label className="block space-y-1 text-sm font-medium"><span>{labels.description}</span><textarea className="min-h-20 w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-sm" onChange={(event) => { setDescription(event.target.value); setDirty(true) }} value={description} /></label><label className="block space-y-1 text-sm font-medium"><span>{labels.documentType}</span><DropdownSelect aria-label={labels.documentType} onChange={(event) => { setDocumentTypeId(event.target.value); setDirty(true) }} searchable searchPlaceholder={labels.documentType} value={documentTypeId}>{data.types.map((type) => <option disabled={!type.is_active && type.id !== documentTypeId} key={type.id} value={type.id}>{type.name.nl}</option>)}</DropdownSelect></label><label className="block space-y-1 text-sm font-medium"><span>{labels.profile}</span><DropdownSelect aria-label={labels.profile} onChange={(event) => { setProfileId(event.target.value); setDirty(true) }} searchable searchPlaceholder={labels.profile} value={profileId}><option value="">{labels.compositionEmpty}</option>{data.profiles.map((profile) => <option disabled={!profile.is_active && profile.id !== profileId} key={profile.id} value={profile.id}>{profile.name}</option>)}</DropdownSelect></label><label className="block space-y-1 text-sm font-medium"><span>{labels.category}</span><DropdownSelect aria-label={labels.category} onChange={(event) => { setCategoryCode(event.target.value as DocumentCategory); setDirty(true) }} searchable searchPlaceholder={labels.category} value={categoryCode}>{CATEGORY_CODES.map((value) => <option key={value} value={value}>{labels.categories[value] ?? value}</option>)}</DropdownSelect></label><label className="flex items-center gap-2 text-sm font-medium"><input checked={defaultDossier} className="size-4 accent-primary" onChange={(event) => { setDefaultDossier(event.target.checked); setDirty(true) }} type="checkbox" />{labels.defaultDossier}</label></Surface>
          <Surface className="space-y-3 p-5"><h2 className="text-base font-semibold">{labels.validation}</h2>{validation ? <p className={`text-sm font-medium ${validation.valid ? 'text-success' : 'text-destructive'}`}>{validation.valid ? labels.valid : labels.invalid}</p> : <p className="text-sm text-muted-foreground">{labels.invalid}</p>}{validation && validation.errors.length ? <ul className="list-disc space-y-1 pl-5 text-xs text-destructive">{validation.errors.map((error, index) => <li key={`${error.code}-${index}`}>{error.code}</li>)}</ul> : null}<Button disabled={dirty || pending} onClick={validate} size="sm" type="button" variant="secondary">{labels.validate}</Button></Surface>
          <Surface className="space-y-3 p-5"><h2 className="text-base font-semibold">{labels.tags}</h2><MultiSelect aria-label={labels.tags} emptySelectionLabel={labels.tagEmpty} noOptionsLabel={labels.tagNoOptions} loadingLabel={labels.tagEmpty} loading={pending} onChange={setTagIds} options={data.tags.map((tag) => ({ value: tag.id, label: tag.name }))} searchPlaceholder={labels.tagSearch} selectedCountLabel={labels.tagSelected} value={tagIds} /><Button disabled={pending} onClick={saveTags} size="sm" type="button" variant="secondary">{labels.tagSave}</Button></Surface>
          <Surface className="space-y-3 p-5"><h2 className="text-base font-semibold">{labels.composition}</h2>{data.template.kind === 'DOCUMENT' ? <><div className="grid gap-2"><DropdownSelect aria-label={labels.compositionSelect} onChange={(event) => { setCompositionKind(event.target.value as 'COVER' | 'APPENDIX'); setCompositionVersionId('') }} searchable searchPlaceholder={labels.compositionSelect} value={compositionKind}><option value="COVER">{labels.compositionCover}</option><option value="APPENDIX">{labels.compositionAppendix}</option></DropdownSelect><DropdownSelect aria-label={labels.compositionAdd} emptyLabel={labels.compositionNoOptions} onChange={(event) => setCompositionVersionId(event.target.value)} searchable searchPlaceholder={labels.compositionAdd} value={compositionVersionId}><option value="">{labels.compositionNoOptions}</option>{compositionOptions.map((option) => <option key={option.versionId} value={option.versionId}>{option.name} · v{option.version}</option>)}</DropdownSelect><Button disabled={!compositionVersionId || pending} onClick={addComposition} size="sm" type="button">{labels.compositionAdd}</Button></div>{composition.length ? <ol className="space-y-2 text-sm">{composition.map((item, index) => { const option = data.compositionOptions.find((candidate) => candidate.versionId === item.versionId); return <li className="flex items-center gap-2" key={`${item.kind}-${item.versionId}`}><span className="min-w-0 flex-1 truncate">{item.kind === 'COVER' ? labels.compositionCover : labels.compositionAppendix}: {option?.name ?? item.versionId}</span><Button aria-label={labels.compositionMoveUp} disabled={index === 0 || pending} onClick={() => moveComposition(index, -1)} size="sm" type="button" variant="ghost">↑</Button><Button aria-label={labels.compositionMoveDown} disabled={index === composition.length - 1 || pending} onClick={() => moveComposition(index, 1)} size="sm" type="button" variant="ghost">↓</Button><Button aria-label={labels.compositionRemove} disabled={pending} onClick={() => { setComposition((current) => current.filter((_, currentIndex) => currentIndex !== index)); setDirty(true); setValidation(null) }} size="sm" type="button" variant="ghost">{labels.compositionRemove}</Button></li> })}</ol> : <p className="text-sm text-muted-foreground">{labels.compositionEmpty}</p>}</> : <p className="text-sm text-muted-foreground">{labels.compositionDocumentOnly}</p>}<Button disabled={data.version.status !== 'DRAFT'} loading={pending} onClick={() => request(`/api/document-studio/template-versions/${data.version.id}/discard`, 'POST', { idempotencyKey: crypto.randomUUID() }).then((result) => { if (result) router.push('/document-studio') })} size="sm" type="button" variant="danger">{labels.discard}</Button></Surface>
        </aside>
      </div>
    </div>
  )
}

function collectAssetRefs(document: CanonicalDocument): string[] {
  return [...normalizeCanonicalDocument(document).assetRefs]
}
