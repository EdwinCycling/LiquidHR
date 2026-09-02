import { Extension, Mark, mergeAttributes, Node, type JSONContent } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { Plugin } from '@tiptap/pm/state'
import {
  emptyCanonicalDocument,
  parseCanonicalDocument,
  type CanonicalBlock,
  type CanonicalDocument,
  type CanonicalInline,
  type CanonicalMark,
  type FontSize,
  type TemplateKind,
} from '../canonical-document'

function attrsOf(node: JSONContent): Record<string, unknown> {
  return (node.attrs ?? {}) as Record<string, unknown>
}

function contentOf(node: JSONContent): readonly JSONContent[] {
  return node.content ?? []
}

export const ParagraphNode = Node.create({
  name: 'paragraph',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return { align: { default: 'LEFT' } }
  },
  parseHTML() {
    return [{ tag: 'p' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, { 'data-align': node.attrs.align }), 0]
  },
})

export const HeadingNode = Node.create({
  name: 'heading',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return { level: { default: 1 }, align: { default: 'LEFT' } }
  },
  parseHTML() {
    return [{ tag: 'h1' }, { tag: 'h2' }, { tag: 'h3' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const level = Number(node.attrs.level)
    const tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
    return [tag, mergeAttributes(HTMLAttributes, { 'data-align': node.attrs.align }), 0]
  },
})

export const FontSizeMark = Mark.create({
  name: 'fontSize',
  addAttributes() {
    return { size: { default: 12 } }
  },
  parseHTML() {
    return [{ tag: 'span[data-font-size]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-font-size': HTMLAttributes.size,
      style: 'font-size: ' + String(HTMLAttributes.size) + 'pt',
    }), 0]
  },
})

export const KnownPlaceholderNode = Node.create({
  name: 'knownPlaceholder',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { field: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'span[data-liquid-placeholder="known"]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-liquid-placeholder': 'known',
      'data-field': node.attrs.field,
      class: 'liquid-placeholder',
    }), '##' + String(node.attrs.field)]
  },
})

export const TemporalPlaceholderNode = Node.create({
  name: 'temporalPlaceholder',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { field: { default: '' }, temporal: { default: 'is' } }
  },
  parseHTML() {
    return [{ tag: 'span[data-liquid-placeholder="temporal"]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-liquid-placeholder': 'temporal',
      'data-field': node.attrs.field,
      'data-temporal': node.attrs.temporal,
      class: 'liquid-placeholder',
    }), '##' + String(node.attrs.field) + '[' + String(node.attrs.temporal) + ']']
  },
})

export const FreePlaceholderNode = Node.create({
  name: 'freePlaceholder',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { key: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'span[data-liquid-placeholder="free"]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-liquid-placeholder': 'free',
      'data-key': node.attrs.key,
      class: 'liquid-placeholder',
    }), '##' + String(node.attrs.key)]
  },
})

export const PageBreakNode = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-liquid-page-break]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-liquid-page-break': 'true', class: 'liquid-page-break' }), 'Pagina-einde']
  },
})

export const BlockImageNode = Node.create({
  name: 'blockImage',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return {
      assetRef: { default: '' },
      altText: { default: '' },
      width: { default: 50 },
      align: { default: 'CENTER' },
    }
  },
  parseHTML() {
    return [{ tag: 'figure[data-liquid-block-image]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, {
      'data-liquid-block-image': 'true',
      'data-asset-ref': node.attrs.assetRef,
      'data-width': node.attrs.width,
      'data-align': node.attrs.align,
      class: 'liquid-block-image',
    }), ['figcaption', {}, node.attrs.altText]]
  },
})

export const ColumnNode = Node.create({
  name: 'column',
  content: 'block*',
  defining: true,
  isolating: true,
  addAttributes() {
    return { side: { default: 'left' } }
  },
  parseHTML() {
    return [{ tag: 'div[data-liquid-column]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-liquid-column': node.attrs.side,
      class: 'liquid-column',
    }), 0]
  },
})

export const TwoColumnBlockNode = Node.create({
  name: 'twoColumnBlock',
  group: 'block',
  content: 'column column',
  defining: true,
  isolating: true,
  addAttributes() {
    return { ratio: { default: '50_50' } }
  },
  parseHTML() {
    return [{ tag: 'div[data-liquid-two-column]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-liquid-two-column': 'true',
      'data-ratio': node.attrs.ratio,
      class: 'liquid-two-column',
    }), 0]
  },
})

function markToTiptap(mark: CanonicalMark): JSONContent {
  return mark.type === 'fontSize' ? { type: 'fontSize', attrs: { size: mark.attrs?.size ?? 12 } } : { type: mark.type }
}

function inlineToTiptap(node: CanonicalInline): JSONContent {
  if (node.type === 'text') {
    return { type: 'text', text: node.text, marks: node.marks?.map(markToTiptap) as JSONContent['marks'] }
  }
  return { type: node.type, attrs: node.attrs }
}

function blockToTiptap(node: CanonicalBlock): JSONContent {
  if (node.type === 'paragraph' || node.type === 'heading') {
    return { type: node.type, attrs: node.attrs, content: node.content.map(inlineToTiptap) }
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return {
      type: node.type,
      content: node.content.map((item) => ({
        type: 'listItem',
        content: item.content.map((paragraph) => blockToTiptap(paragraph)),
      })),
    }
  }
  if (node.type === 'horizontalRule' || node.type === 'pageBreak' || node.type === 'blockImage') {
    return { type: node.type, attrs: node.type === 'blockImage' ? node.attrs : undefined }
  }
  if (node.type === 'table') {
    return {
      type: 'table',
      attrs: node.attrs,
      content: node.content.map((row) => ({
        type: 'tableRow',
        content: row.content.map((cell) => ({
          type: cell.type,
          attrs: cell.attrs,
          content: cell.content.map((paragraph) => blockToTiptap(paragraph)),
        })),
      })),
    }
  }
  if (node.type !== 'twoColumnBlock') throw new Error('DOCUMENT_BLOCK_NODE_UNSUPPORTED')
  return {
    type: 'twoColumnBlock',
    attrs: node.attrs,
    content: node.content.map((column) => ({
      type: 'column',
      attrs: column.attrs,
      content: column.content.map(blockToTiptap),
    })),
  }
}

export function canonicalToEditorJson(document: CanonicalDocument): JSONContent {
  const region = document.kind === 'DOCUMENT'
    ? document.regions.body
    : document.kind === 'COVER'
      ? document.regions.cover
      : document.regions.appendix
  return { type: 'doc', content: region?.content.map(blockToTiptap) ?? [] }
}

function markFromTiptap(mark: JSONContent): CanonicalMark {
  if (mark.type === 'fontSize') {
    const size = Number(attrsOf(mark).size)
    if (![10, 11, 12, 14, 16, 18, 24, 32].includes(size)) throw new Error('DOCUMENT_FONT_SIZE_INVALID')
    return { type: 'fontSize', attrs: { size: size as FontSize } }
  }
  if (mark.type !== 'bold' && mark.type !== 'italic' && mark.type !== 'underline') throw new Error('DOCUMENT_MARK_UNSUPPORTED')
  return { type: mark.type }
}

function inlineFromTiptap(node: JSONContent): Record<string, unknown> {
  if (node.type === 'text') {
    return {
      type: 'text',
      text: node.text ?? '',
      ...(node.marks ? { marks: node.marks.map(markFromTiptap) } : {}),
    }
  }
  if (node.type === 'knownPlaceholder' || node.type === 'temporalPlaceholder' || node.type === 'freePlaceholder') {
    return { type: node.type, attrs: attrsOf(node) }
  }
  throw new Error('DOCUMENT_INLINE_NODE_UNSUPPORTED')
}

function blockFromTiptap(node: JSONContent): Record<string, unknown> {
  if (node.type === 'paragraph' || node.type === 'heading') {
    const attrs = attrsOf(node)
    const normalizedAttrs = node.type === 'paragraph'
      ? { align: attrs.align ?? 'LEFT' }
      : { level: Number(attrs.level ?? 1), align: attrs.align ?? 'LEFT' }
    return { type: node.type, attrs: normalizedAttrs, content: contentOf(node).map(inlineFromTiptap) }
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return {
      type: node.type,
      content: contentOf(node).map((item) => ({
        type: 'listItem',
        content: contentOf(item).map((paragraph) => blockFromTiptap(paragraph)),
      })),
    }
  }
  if (node.type === 'horizontalRule' || node.type === 'pageBreak') return { type: node.type }
  if (node.type === 'blockImage') return { type: node.type, attrs: attrsOf(node) }
  if (node.type === 'table') {
    return {
      type: 'table',
      attrs: { columnWidths: attrsOf(node).columnWidths },
      content: contentOf(node).map((row) => ({
        type: 'tableRow',
        content: contentOf(row).map((cell) => ({
          type: cell.type,
          attrs: { align: attrsOf(cell).align ?? 'LEFT' },
          content: contentOf(cell).map((paragraph) => blockFromTiptap(paragraph)),
        })),
      })),
    }
  }
  if (node.type === 'twoColumnBlock') {
    return {
      type: node.type,
      attrs: { ratio: attrsOf(node).ratio ?? '50_50' },
      content: contentOf(node).map((column) => ({
        type: 'column',
        attrs: { side: attrsOf(column).side },
        content: contentOf(column).map(blockFromTiptap),
      })),
    }
  }
  throw new Error('DOCUMENT_BLOCK_NODE_UNSUPPORTED')
}

export function editorJsonToCanonical(editorJson: JSONContent, base: CanonicalDocument): CanonicalDocument {
  return parseCanonicalDocument({
    ...base,
    regions: {
      ...base.regions,
      cover: base.kind === 'COVER' ? { type: 'region', content: contentOf(editorJson).map(blockFromTiptap) } : null,
      body: base.kind === 'DOCUMENT' ? { type: 'region', content: contentOf(editorJson).map(blockFromTiptap) } : null,
      appendix: base.kind === 'APPENDIX' ? { type: 'region', content: contentOf(editorJson).map(blockFromTiptap) } : null,
    },
  })
}

export function sanitizePastedHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]*>/g, '')
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('script,style,iframe,object,embed,svg,img,video,audio,link,meta').forEach((element) => element.remove())
  document.querySelectorAll('*').forEach((element) => {
    const tag = element.tagName.toLowerCase()
    for (const attribute of [...element.attributes]) {
      if (attribute.name.toLowerCase() !== 'align' || !['td', 'th'].includes(tag)) element.removeAttribute(attribute.name)
    }
    if (tag === 'a') element.replaceWith(...element.childNodes)
  })
  return document.body.innerHTML
}

export const StrictPasteSanitizer = Extension.create({
  name: 'liquidHrStrictPasteSanitizer',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const html = event.clipboardData?.getData('text/html') ?? ''
            if (!html) return false
            this.editor.commands.insertContent(sanitizePastedHtml(html))
            return true
          },
        },
      }),
    ]
  },
})

export const documentEditorExtensions = [
  StarterKit.configure({ heading: false, paragraph: false }),
  ParagraphNode,
  HeadingNode,
  Underline,
  FontSizeMark,
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  KnownPlaceholderNode,
  TemporalPlaceholderNode,
  FreePlaceholderNode,
  PageBreakNode,
  BlockImageNode,
  ColumnNode,
  TwoColumnBlockNode,
  StrictPasteSanitizer,
]

export function editorDocumentForKind(kind: TemplateKind): CanonicalDocument {
  return emptyCanonicalDocument(kind)
}
