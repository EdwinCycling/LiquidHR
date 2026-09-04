import { createHash } from 'node:crypto'
import type { CanonicalBlock, CanonicalDocument } from '@/lib/document-studio/canonical-document'
import type { ResolvedGenerationSnapshot } from './domain'
export const DG1_RENDERER_VERSION = 'dg1-a4-work-sans-pdf-1'
function plainText(block: CanonicalBlock): string[] {
  if (block.type === 'paragraph' || block.type === 'heading') return [block.content.map((node) => node.type === 'text' ? node.text : '').join('')]
  if (block.type === 'bulletList' || block.type === 'orderedList') return block.content.flatMap((item) => item.content.map((paragraph) => paragraph.content.map((node) => node.type === 'text' ? node.text : '').join('')))
  if (block.type === 'table') return block.content.flatMap((row) => row.content.flatMap((cell) => cell.content.flatMap((paragraph) => [paragraph.content.map((node) => node.type === 'text' ? node.text : '').join('')])))
  if (block.type === 'twoColumnBlock') return block.content.flatMap((column) => column.content.flatMap((child) => plainText(child)))
  return block.type === 'pageBreak' ? ['\f'] : []
}
function lines(document: CanonicalDocument): string[] { return Object.values(document.regions).flatMap((region) => region ? region.content.flatMap(plainText) : []).flatMap((line) => line.split(/\r?\n/)).slice(0, 120) }
function literal(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?').replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)') }
export function renderResolvedSnapshotToPdf(snapshot: ResolvedGenerationSnapshot): Uint8Array {
  const content = ['BT', '/F1 11 Tf', '50 790 Td', ...lines(snapshot.resolvedDocument).flatMap((line, index) => [index ? '0 -16 Td' : '', `(${literal(line.slice(0, 140))}) Tj`]).filter(Boolean)].join('\n')
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>', `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const encoder = new TextEncoder(); const header = '%PDF-1.4\n%DG1\n'; const chunks = [header]; const offsets = [0]; let size = encoder.encode(header).length
  objects.forEach((object, index) => { offsets.push(size); const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`; chunks.push(chunk); size += encoder.encode(chunk).length })
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`)
  return encoder.encode(chunks.join(''))
}
export function pdfHash(pdf: Uint8Array): string { return createHash('sha256').update(pdf).digest('hex') }
