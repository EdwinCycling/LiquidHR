'use client'

import { EditorContent, useEditor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import { useEffect, useMemo, useState } from 'react'
import { Surface } from '@/components/ui/surface'
import { Button } from '@/components/ui/button'
import { editorDocumentForKind, canonicalToEditorJson, documentEditorExtensions, editorJsonToCanonical } from '@/lib/document-studio/editor/tiptap-adapter'
import type { CanonicalDocument, TemplateKind } from '@/lib/document-studio/canonical-document'
import { EditorToolbar, type EditorToolbarLabels } from './editor-toolbar'

export interface StructuredEditorLabels extends EditorToolbarLabels {
  readonly content: string
}

const PLACEHOLDER_FIELDS = ['employee.first_name', 'employee.last_name', 'employee.employee_number', 'employment.start_date'] as const

export function StructuredEditor({
  kind,
  initialDocument,
  labels,
  onChange,
}: {
  readonly kind: TemplateKind
  readonly initialDocument?: CanonicalDocument
  readonly labels: StructuredEditorLabels
  readonly onChange?: (document: CanonicalDocument) => void
}) {
  const baseDocument = useMemo(() => initialDocument ?? editorDocumentForKind(kind), [initialDocument, kind])
  const [placeholderField, setPlaceholderField] = useState<string>(PLACEHOLDER_FIELDS[0])
  const editor = useEditor({
    extensions: documentEditorExtensions,
    content: canonicalToEditorJson(baseDocument),
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      if (!onChange) return
      onChange(editorJsonToCanonical(currentEditor.getJSON(), baseDocument))
    },
  })

  useEffect(() => {
    if (!editor) return
    const next = canonicalToEditorJson(baseDocument)
    editor.commands.setContent(next, { emitUpdate: false })
  }, [baseDocument, editor])

  if (!editor) {
    return <Surface className="min-h-80 p-6 text-sm text-muted-foreground" variant="subtle">{labels.content}</Surface>
  }

  return (
    <Surface className="overflow-hidden" aria-label={labels.content}>
      <EditorToolbar editor={editor} labels={labels} />
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-subtle px-3 py-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="document-studio-placeholder">{labels.placeholder}</label>
        <select className="min-h-8 rounded-[var(--radius-control)] border border-border bg-surface px-2 text-sm focus-visible:outline-2 focus-visible:outline-focus" id="document-studio-placeholder" onChange={(event) => setPlaceholderField(event.target.value)} value={placeholderField}>
          {PLACEHOLDER_FIELDS.map((field) => <option key={field} value={field}>{field}</option>)}
        </select>
        <Button onClick={() => editor.chain().focus().insertContent({ type: 'knownPlaceholder', attrs: { field: placeholderField } }).run()} size="sm" type="button">{labels.placeholder}</Button>
      </div>
      <EditorContent editor={editor} className="document-studio-editor min-h-[28rem] bg-surface p-5" />
    </Surface>
  )
}

export function editorContentForDocument(document: CanonicalDocument): JSONContent {
  return canonicalToEditorJson(document)
}
