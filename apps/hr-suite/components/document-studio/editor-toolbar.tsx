'use client'

import { Bold, Columns2, Heading2, Italic, List, ListOrdered, Minus, Pilcrow, Underline as UnderlineIcon } from 'lucide-react'
import type { Editor } from '@tiptap/core'
import { Button } from '@/components/ui/button'

export interface EditorToolbarLabels {
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

export function EditorToolbar({ editor, labels }: { editor: Editor | null; labels: EditorToolbarLabels }) {
  if (!editor) return null

  return (
    <div aria-label={labels.heading} className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-subtle p-2" role="toolbar">
      <Button aria-label={labels.bold} onClick={() => editor.chain().focus().toggleBold().run()} size="sm" type="button" variant={editor.isActive('bold') ? 'secondary' : 'ghost'}><Bold aria-hidden="true" /></Button>
      <Button aria-label={labels.italic} onClick={() => editor.chain().focus().toggleItalic().run()} size="sm" type="button" variant={editor.isActive('italic') ? 'secondary' : 'ghost'}><Italic aria-hidden="true" /></Button>
      <Button aria-label={labels.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} size="sm" type="button" variant={editor.isActive('underline') ? 'secondary' : 'ghost'}><UnderlineIcon aria-hidden="true" /></Button>
      <Button aria-label={labels.heading} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} size="sm" type="button" variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}><Heading2 aria-hidden="true" /></Button>
      <Button aria-label={labels.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} size="sm" type="button" variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}><List aria-hidden="true" /></Button>
      <Button aria-label={labels.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} size="sm" type="button" variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}><ListOrdered aria-hidden="true" /></Button>
      <Button aria-label={labels.rule} onClick={() => editor.chain().focus().setHorizontalRule().run()} size="sm" type="button" variant="ghost"><Minus aria-hidden="true" /></Button>
      <Button aria-label={labels.pageBreak} onClick={() => editor.chain().focus().insertContent({ type: 'pageBreak' }).run()} size="sm" type="button" variant="ghost"><Pilcrow aria-hidden="true" /></Button>
      <Button aria-label={labels.columns} onClick={() => editor.chain().focus().insertContent({
        type: 'twoColumnBlock',
        attrs: { ratio: '50_50' },
        content: [
          { type: 'column', attrs: { side: 'left' }, content: [{ type: 'paragraph', attrs: { align: 'LEFT' } }] },
          { type: 'column', attrs: { side: 'right' }, content: [{ type: 'paragraph', attrs: { align: 'LEFT' } }] },
        ],
      }).run()} size="sm" type="button" variant="ghost"><Columns2 aria-hidden="true" /></Button>
    </div>
  )
}
