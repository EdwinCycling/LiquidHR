'use client'

import { EditorContent, useEditor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { TextInput } from '@/components/ui/text-input'
import { IMAGE_ALIGNMENTS, IMAGE_WIDTHS, type CanonicalDocument, type ImageAlignment, type ImageWidth, type TemplateKind } from '@/lib/document-studio/canonical-document'
import { editorDocumentForKind, canonicalToEditorJson, documentEditorExtensions, editorJsonToCanonical } from '@/lib/document-studio/editor/tiptap-adapter'
import type { DocumentStudioAssetRow } from '@/lib/document-studio/repository'
import { EditorToolbar, type EditorToolbarLabels } from './editor-toolbar'

export interface StructuredEditorLabels extends EditorToolbarLabels {
  readonly content: string
  readonly placeholder: string
  readonly knownPlaceholder: string
  readonly temporalPlaceholder: string
  readonly temporalWas: string
  readonly temporalIs: string
  readonly temporalWordt: string
  readonly freePlaceholder: string
  readonly freePlaceholderHint: string
  readonly insertPlaceholder: string
  readonly asset: string
  readonly assetSelect: string
  readonly assetUpload: string
  readonly assetAlt: string
  readonly assetWidth: string
  readonly assetAlign: string
  readonly assetInsert: string
  readonly assetReplace: string
  readonly assetRemove: string
  readonly assetNoOptions: string
  readonly assetUploadFailed: string
}

const PLACEHOLDER_FIELDS = ['employee.first_name', 'employee.last_name', 'employee.employee_number', 'employment.start_date'] as const
const TEMPORAL_VALUES = ['was', 'is', 'wordt'] as const
const FREE_PLACEHOLDER_PATTERN = /^[A-Z][A-Za-z0-9]{0,79}$/

type EditableDocumentRegion = 'cover' | 'header' | 'body' | 'appendix' | 'footer'

function selectedRegion(document: CanonicalDocument, region?: EditableDocumentRegion): EditableDocumentRegion {
  return region ?? (document.kind === 'DOCUMENT' ? 'body' : document.kind === 'COVER' ? 'cover' : 'appendix')
}

export function StructuredEditor({
  kind,
  initialDocument,
  region,
  assets: initialAssets = [],
  labels,
  onChange,
}: {
  readonly kind: TemplateKind
  readonly initialDocument?: CanonicalDocument
  readonly region?: EditableDocumentRegion
  readonly assets?: readonly DocumentStudioAssetRow[]
  readonly labels: StructuredEditorLabels
  readonly onChange?: (document: CanonicalDocument) => void
}) {
  const baseDocument = useMemo(() => initialDocument ?? editorDocumentForKind(kind), [initialDocument, kind])
  const activeRegion = selectedRegion(baseDocument, region)
  const [placeholderField, setPlaceholderField] = useState<string>(PLACEHOLDER_FIELDS[0])
  const [temporal, setTemporal] = useState<(typeof TEMPORAL_VALUES)[number]>('is')
  const [freeKey, setFreeKey] = useState('')
  const [assets, setAssets] = useState([...initialAssets])
  const [assetId, setAssetId] = useState(initialAssets[0]?.id ?? '')
  const [altText, setAltText] = useState('')
  const [imageWidth, setImageWidth] = useState<ImageWidth>(50)
  const [imageAlign, setImageAlign] = useState<ImageAlignment>('CENTER')
  const [assetError, setAssetError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadedRegionRef = useRef<EditableDocumentRegion | null>(null)
  const editor = useEditor({
    extensions: documentEditorExtensions,
    content: canonicalToEditorJson(baseDocument, activeRegion),
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(editorJsonToCanonical(currentEditor.getJSON(), baseDocument, activeRegion))
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      if (!currentEditor.isActive('blockImage')) return
      const attrs = currentEditor.getAttributes('blockImage') as { assetRef?: unknown; altText?: unknown; width?: unknown; align?: unknown }
      if (typeof attrs.assetRef === 'string') setAssetId(attrs.assetRef)
      if (typeof attrs.altText === 'string') setAltText(attrs.altText)
      if (typeof attrs.width === 'number' && IMAGE_WIDTHS.includes(attrs.width as ImageWidth)) setImageWidth(attrs.width as ImageWidth)
      if (typeof attrs.align === 'string' && IMAGE_ALIGNMENTS.includes(attrs.align as ImageAlignment)) setImageAlign(attrs.align as ImageAlignment)
    },
  })

  useEffect(() => {
    if (!editor || loadedRegionRef.current === activeRegion) return
    editor.commands.setContent(canonicalToEditorJson(baseDocument, activeRegion), { emitUpdate: false })
    loadedRegionRef.current = activeRegion
  }, [activeRegion, baseDocument, editor])

  async function uploadAsset(file: File) {
    setUploading(true)
    setAssetError(null)
    const form = new FormData()
    form.set('file', file)
    try {
      const response = await fetch('/api/document-studio/assets', { method: 'POST', body: form })
      const result = await response.json() as { data?: { asset?: DocumentStudioAssetRow }; code?: string }
      if (!response.ok || !result.data?.asset) throw new Error(labels.assetUploadFailed)
      setAssets((current) => [result.data!.asset!, ...current.filter((asset) => asset.id !== result.data!.asset!.id)])
      setAssetId(result.data.asset.id)
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : labels.assetUploadFailed)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function insertKnownPlaceholder() {
    editor?.chain().focus().insertContent({ type: 'knownPlaceholder', attrs: { field: placeholderField } }).run()
  }

  function insertTemporalPlaceholder() {
    editor?.chain().focus().insertContent({ type: 'temporalPlaceholder', attrs: { field: placeholderField, temporal } }).run()
  }

  function insertFreePlaceholder() {
    if (!FREE_PLACEHOLDER_PATTERN.test(freeKey)) return
    editor?.chain().focus().insertContent({ type: 'freePlaceholder', attrs: { key: freeKey } }).run()
    setFreeKey('')
  }

  function insertOrReplaceImage() {
    if (!editor || !assetId || !altText.trim()) return
    const attrs = { assetRef: assetId, altText: altText.trim(), width: imageWidth, align: imageAlign }
    if (editor.isActive('blockImage')) editor.chain().focus().updateAttributes('blockImage', attrs).run()
    else editor.chain().focus().insertContent({ type: 'blockImage', attrs }).run()
  }

  if (!editor) return <Surface className="min-h-80 p-6 text-sm text-muted-foreground" variant="subtle">{labels.content}</Surface>

  const selectedImage = editor.isActive('blockImage')
  return (
    <Surface className="overflow-hidden" aria-label={labels.content}>
      <EditorToolbar editor={editor} labels={labels} />
      <div className="space-y-3 border-b border-border bg-surface-subtle px-3 py-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
          <DropdownSelect aria-label={labels.knownPlaceholder} onChange={(event) => setPlaceholderField(event.target.value)} searchable searchPlaceholder={labels.knownPlaceholder} value={placeholderField}>
            {PLACEHOLDER_FIELDS.map((field) => <option key={field} value={field}>{field}</option>)}
          </DropdownSelect>
          <Button onClick={insertKnownPlaceholder} size="sm" type="button">{labels.knownPlaceholder}</Button>
          <DropdownSelect aria-label={labels.temporalPlaceholder} onChange={(event) => setTemporal(event.target.value as (typeof TEMPORAL_VALUES)[number])} searchable searchPlaceholder={labels.temporalPlaceholder} value={temporal}>
            {TEMPORAL_VALUES.map((value) => (
              <option key={value} value={value}>
                {value === 'was' ? labels.temporalWas : value === 'is' ? labels.temporalIs : labels.temporalWordt}
              </option>
            ))}
          </DropdownSelect>
          <Button onClick={insertTemporalPlaceholder} size="sm" type="button">{labels.temporalPlaceholder}</Button>
        </div>
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <TextInput aria-label={labels.freePlaceholder} onChange={(event) => setFreeKey(event.target.value)} placeholder={labels.freePlaceholderHint} value={freeKey} />
          <Button disabled={!FREE_PLACEHOLDER_PATTERN.test(freeKey)} onClick={insertFreePlaceholder} size="sm" type="button">{labels.freePlaceholder}</Button>
        </div>
      </div>
      <div className="space-y-3 border-b border-border bg-surface-subtle px-3 py-3">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          <DropdownSelect aria-label={labels.assetSelect} emptyLabel={labels.assetNoOptions} onChange={(event) => setAssetId(event.target.value)} searchable searchPlaceholder={labels.assetSelect} value={assetId}>
            <option value="">{labels.assetNoOptions}</option>
            {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.original_filename} ({asset.width}×{asset.height})</option>)}
          </DropdownSelect>
          <>
            <input accept="image/png,image/jpeg" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAsset(file) }} ref={fileInputRef} type="file" />
            <Button loading={uploading} onClick={() => fileInputRef.current?.click()} size="sm" type="button" variant="secondary">{labels.assetUpload}</Button>
          </>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <TextInput aria-label={labels.assetAlt} maxLength={240} onChange={(event) => setAltText(event.target.value)} placeholder={labels.assetAlt} value={altText} />
          <DropdownSelect aria-label={labels.assetWidth} onChange={(event) => setImageWidth(Number(event.target.value) as ImageWidth)} value={String(imageWidth)}>
            {IMAGE_WIDTHS.map((width) => <option key={width} value={width}>{width}%</option>)}
          </DropdownSelect>
          <DropdownSelect aria-label={labels.assetAlign} onChange={(event) => setImageAlign(event.target.value as ImageAlignment)} value={imageAlign}>
            <option value="LEFT">{labels.alignLeft}</option>
            <option value="CENTER">{labels.alignCenter}</option>
            <option value="RIGHT">{labels.alignRight}</option>
          </DropdownSelect>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!assetId || !altText.trim()} onClick={insertOrReplaceImage} size="sm" type="button">{selectedImage ? labels.assetReplace : labels.assetInsert}</Button>
            <Button disabled={!selectedImage} onClick={() => editor.chain().focus().deleteSelection().run()} size="sm" type="button" variant="secondary">{labels.assetRemove}</Button>
          </div>
        </div>
        {assetError ? <p className="text-sm text-destructive" role="alert">{assetError}</p> : null}
      </div>
      <EditorContent editor={editor} className="document-studio-editor min-h-[28rem] bg-surface p-5" />
    </Surface>
  )
}

export function editorContentForDocument(document: CanonicalDocument): JSONContent {
  return canonicalToEditorJson(document)
}
