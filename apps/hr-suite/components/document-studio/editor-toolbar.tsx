'use client'

import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Columns2, Heading1, Heading2, Heading3, Italic, List, ListOrdered, Minus, Pilcrow, Table2, Underline as UnderlineIcon } from 'lucide-react'
import type { Editor } from '@tiptap/core'
import { Button } from '@/components/ui/button'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { ALIGNMENTS, FONT_SIZES, TWO_COLUMN_RATIOS, type Alignment, type FontSize, type TwoColumnRatio } from '@/lib/document-studio/canonical-document'

export interface EditorToolbarLabels {
  readonly paragraph: string
  readonly heading1: string
  readonly heading2: string
  readonly heading3: string
  readonly fontSize: string
  readonly fontSizeUnit: string
  readonly alignLeft: string
  readonly alignCenter: string
  readonly alignRight: string
  readonly alignJustify: string
  readonly bold: string
  readonly italic: string
  readonly underline: string
  readonly bulletList: string
  readonly orderedList: string
  readonly rule: string
  readonly pageBreak: string
  readonly table: string
  readonly tableColumns: string
  readonly columns: string
  readonly columnsRatio: string
}

const alignmentIcons = {
  LEFT: AlignLeft,
  CENTER: AlignCenter,
  RIGHT: AlignRight,
  JUSTIFY: AlignJustify,
} as const

function activeTextNode(editor: Editor): 'paragraph' | 'heading' {
  return editor.state.selection.$from.parent.type.name === 'heading' ? 'heading' : 'paragraph'
}

function setAlignment(editor: Editor, alignment: Alignment) {
  editor.chain().focus().updateAttributes(activeTextNode(editor), { align: alignment }).run()
}

function insertTwoColumns(editor: Editor, ratio: TwoColumnRatio) {
  if (editor.isActive('twoColumnBlock')) {
    editor.chain().focus().updateAttributes('twoColumnBlock', { ratio }).run()
    return
  }
  editor.chain().focus().insertContent({
    type: 'twoColumnBlock',
    attrs: { ratio },
    content: [
      { type: 'column', attrs: { side: 'left' }, content: [{ type: 'paragraph', attrs: { align: 'LEFT' } }] },
      { type: 'column', attrs: { side: 'right' }, content: [{ type: 'paragraph', attrs: { align: 'LEFT' } }] },
    ],
  }).run()
}

export function EditorToolbar({ editor, labels }: { editor: Editor | null; labels: EditorToolbarLabels }) {
  if (!editor) return null
  const headingValue = editor.isActive('heading') ? String(editor.getAttributes('heading').level ?? 1) : 'paragraph'
  const alignment = String(editor.getAttributes(activeTextNode(editor)).align ?? 'LEFT') as Alignment

  return (
    <div aria-label={labels.paragraph} className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-subtle p-2" role="toolbar">
      <DropdownSelect aria-label={labels.paragraph} className="w-36" onChange={(event) => {
        const value = event.target.value
        if (value === 'paragraph') editor.chain().focus().setParagraph().run()
        else editor.chain().focus().setNode('heading', { level: Number(value) }).run()
      }} searchable searchPlaceholder={labels.paragraph} value={headingValue}>
        <option value="paragraph">{labels.paragraph}</option>
        <option value="1">{labels.heading1}</option>
        <option value="2">{labels.heading2}</option>
        <option value="3">{labels.heading3}</option>
      </DropdownSelect>
      <DropdownSelect aria-label={labels.fontSize} className="w-28" onChange={(event) => editor.chain().focus().setMark('fontSize', { size: Number(event.target.value) as FontSize }).run()} searchable searchPlaceholder={labels.fontSize} value={String(editor.getAttributes('fontSize').size ?? 12)}>
        {FONT_SIZES.map((size) => <option key={size} value={size}>{size} {labels.fontSizeUnit}</option>)}
      </DropdownSelect>
      {ALIGNMENTS.map((value) => {
        const Icon = alignmentIcons[value]
        return <Button aria-label={value === 'LEFT' ? labels.alignLeft : value === 'CENTER' ? labels.alignCenter : value === 'RIGHT' ? labels.alignRight : labels.alignJustify} key={value} onClick={() => setAlignment(editor, value)} size="sm" type="button" variant={alignment === value ? 'secondary' : 'ghost'}><Icon aria-hidden="true" /></Button>
      })}
      <Button aria-label={labels.bold} onClick={() => editor.chain().focus().toggleBold().run()} size="sm" type="button" variant={editor.isActive('bold') ? 'secondary' : 'ghost'}><Bold aria-hidden="true" /></Button>
      <Button aria-label={labels.italic} onClick={() => editor.chain().focus().toggleItalic().run()} size="sm" type="button" variant={editor.isActive('italic') ? 'secondary' : 'ghost'}><Italic aria-hidden="true" /></Button>
      <Button aria-label={labels.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} size="sm" type="button" variant={editor.isActive('underline') ? 'secondary' : 'ghost'}><UnderlineIcon aria-hidden="true" /></Button>
      <Button aria-label={labels.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} size="sm" type="button" variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}><List aria-hidden="true" /></Button>
      <Button aria-label={labels.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} size="sm" type="button" variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}><ListOrdered aria-hidden="true" /></Button>
      <Button aria-label={labels.rule} onClick={() => editor.chain().focus().setHorizontalRule().run()} size="sm" type="button" variant="ghost"><Minus aria-hidden="true" /></Button>
      <Button aria-label={labels.pageBreak} onClick={() => editor.chain().focus().insertContent({ type: 'pageBreak' }).run()} size="sm" type="button" variant="ghost"><Pilcrow aria-hidden="true" /></Button>
      <DropdownSelect aria-label={labels.tableColumns} className="w-28" onChange={(event) => editor.chain().focus().insertTable({ rows: 2, cols: Number(event.target.value), withHeaderRow: true }).run()} placeholder={labels.table} searchable searchPlaceholder={labels.tableColumns} value="">
        <option value="" disabled>{labels.table}</option>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((columns) => <option key={columns} value={columns}>{columns}</option>)}
      </DropdownSelect>
      <DropdownSelect aria-label={labels.columnsRatio} className="w-32" onChange={(event) => insertTwoColumns(editor, event.target.value as TwoColumnRatio)} placeholder={labels.columns} searchable searchPlaceholder={labels.columnsRatio} value="">
        <option value="" disabled>{labels.columns}</option>
        {TWO_COLUMN_RATIOS.map((ratio) => <option key={ratio} value={ratio}>{ratio.replace('_', ' / ')}</option>)}
      </DropdownSelect>
      <span className="sr-only"><Heading1 aria-hidden="true" /><Heading2 aria-hidden="true" /><Heading3 aria-hidden="true" /><Table2 aria-hidden="true" /><Columns2 aria-hidden="true" /></span>
    </div>
  )
}
