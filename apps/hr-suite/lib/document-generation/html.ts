import type { CanonicalBlock, CanonicalDocument, CanonicalInline, CanonicalRegion } from '@/lib/document-studio/canonical-document'
import type { ResolvedGenerationSnapshot } from './domain'

export interface HtmlRenderOptions {
  readonly assetUrls?: Readonly<Record<string, string>>
  readonly fontFaceCss?: string
}

function escape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function inline(nodes: readonly CanonicalInline[]): string {
  return nodes.map((node) => {
    if (node.type !== 'text') return ''
    let result = escape(node.text)
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') result = `<strong>${result}</strong>`
      else if (mark.type === 'italic') result = `<em>${result}</em>`
      else if (mark.type === 'underline') result = `<u>${result}</u>`
      else result = `<span style="font-size:${mark.attrs?.size ?? 11}pt">${result}</span>`
    }
    return result
  }).join('')
}

function ratioColumns(ratio: string): string {
  const [left, right] = ratio.split('_').map(Number)
  return Number.isFinite(left) && Number.isFinite(right) && left > 0 && right > 0
    ? `${left}fr ${right}fr`
    : '1fr 1fr'
}

function image(block: Extract<CanonicalBlock, { type: 'blockImage' }>, options: HtmlRenderOptions): string {
  const source = options.assetUrls?.[block.attrs.assetRef] ?? `/api/document-studio/generation/assets/${encodeURIComponent(block.attrs.assetRef)}`
  return `<figure class="dg1-image dg1-image-${block.attrs.align.toLowerCase()}" style="width:${block.attrs.width}%"><img src="${escape(source)}" alt="${escape(block.attrs.altText)}"></figure>`
}

function blocks(items: readonly CanonicalBlock[], options: HtmlRenderOptions): string {
  return items.map((block) => {
    if (block.type === 'paragraph') return `<p style="text-align:${block.attrs.align.toLowerCase()}">${inline(block.content)}</p>`
    if (block.type === 'heading') return `<h${block.attrs.level} style="text-align:${block.attrs.align.toLowerCase()}">${inline(block.content)}</h${block.attrs.level}>`
    if (block.type === 'horizontalRule') return '<hr>'
    if (block.type === 'pageBreak') return '<div class="dg1-page-break" aria-hidden="true"></div>'
    if (block.type === 'blockImage') return image(block, options)
    if (block.type === 'bulletList' || block.type === 'orderedList') {
      const tag = block.type === 'bulletList' ? 'ul' : 'ol'
      return `<${tag}>${block.content.map((item) => `<li>${blocks(item.content, options)}</li>`).join('')}</${tag}>`
    }
    if (block.type === 'table') {
      return `<table><tbody>${block.content.map((row) => `<tr>${row.content.map((cell, cellIndex) => {
        const tag = cell.type === 'tableHeader' ? 'th' : 'td'
        const width = block.attrs.columnWidths?.[cellIndex]
        const widthStyle = width === undefined ? '' : `;width:${width}%`
        return `<${tag} style="text-align:${cell.attrs.align.toLowerCase()}${widthStyle}">${blocks(cell.content, options)}</${tag}>`
      }).join('')}</tr>`).join('')}</tbody></table>`
    }
    if (block.type !== 'twoColumnBlock') return ''
    return `<div class="dg1-two-column" style="grid-template-columns:${ratioColumns(block.attrs.ratio)}" data-ratio="${escape(block.attrs.ratio)}">${block.content.map((column) => `<section>${blocks(column.content, options)}</section>`).join('')}</div>`
  }).join('')
}

function region(document: CanonicalDocument, key: keyof CanonicalDocument['regions'], options: HtmlRenderOptions): string {
  const value: CanonicalRegion | null = document.regions[key]
  return value ? blocks(value.content, options) : ''
}

function regionSection(className: string, content: string, pageBreakBefore = false): string {
  if (!content) return ''
  return `<section class="${className}${pageBreakBefore ? ' dg1-break-before' : ''}">${content}</section>`
}

const baseCss = `
@page { size: A4; margin: 18mm 20mm 20mm; }
:root { --dg1-ink: rgb(31 41 55); --dg1-muted: rgb(100 116 139); --dg1-border: rgb(203 213 225); }
html, body { margin: 0; padding: 0; }
body { color: var(--dg1-ink); font-family: var(--font-work-sans, 'Work Sans', sans-serif); font-size: 11pt; line-height: 1.45; }
.dg1-document { box-sizing: border-box; min-height: 100%; }
p, h1, h2, h3 { margin: 0 0 10pt; overflow-wrap: anywhere; }
h1 { font-size: 24pt; line-height: 1.15; }
h2 { font-size: 18pt; line-height: 1.2; }
h3 { font-size: 14pt; line-height: 1.25; }
ul, ol { margin: 0 0 10pt; padding-left: 22pt; }
li { margin: 0 0 4pt; }
hr { border: 0; border-top: 1px solid var(--dg1-border); margin: 14pt 0; }
table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 10pt 0; break-inside: auto; }
tr { break-inside: avoid; break-after: auto; }
td, th { border: 1px solid var(--dg1-border); padding: 5pt; vertical-align: top; overflow-wrap: anywhere; }
th { font-weight: 600; }
.dg1-two-column { display: grid; gap: 12pt; align-items: start; break-inside: avoid; }
.dg1-two-column > section { min-width: 0; }
.dg1-image { margin: 10pt 0; break-inside: avoid; }
.dg1-image-left { margin-right: auto; }
.dg1-image-center { margin-left: auto; margin-right: auto; }
.dg1-image-right { margin-left: auto; }
.dg1-image img { display: block; height: auto; max-width: 100%; }
.dg1-page-break { break-before: page; height: 0; }
.dg1-break-before { break-before: page; }
.dg1-cover { min-height: 245mm; }
.dg1-footer { color: var(--dg1-muted); font-size: 9pt; position: fixed; right: 0; bottom: -14mm; left: 0; }
.dg1-page-number::after { content: counter(page); }
`

export function renderResolvedSnapshotToHtml(snapshot: ResolvedGenerationSnapshot, options: HtmlRenderOptions = {}): string {
  const document = snapshot.resolvedDocument
  const cover = regionSection('dg1-cover', region(document, 'cover', options))
  const body = regionSection('dg1-body', region(document, 'body', options), Boolean(cover))
  const appendix = regionSection('dg1-appendix', region(document, 'appendix', options), Boolean(body || cover))
  const fontFaceCss = options.fontFaceCss ? `${options.fontFaceCss}\n` : ''
  return `<article class="dg1-document" data-renderer="${escape(snapshot.rendererVersion)}"><style>${fontFaceCss}${baseCss}</style><header class="dg1-header">${region(document, 'header', options)}</header><main>${cover}${body}${appendix}</main><footer class="dg1-footer">${region(document, 'footer', options)} <span class="dg1-page-number" aria-hidden="true"></span></footer></article>`
}
