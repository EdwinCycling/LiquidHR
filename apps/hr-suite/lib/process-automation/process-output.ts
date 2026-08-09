import { createHash } from 'node:crypto'
import { z } from 'zod'

const localizedTextSchema = z.record(z.string(), z.string()).default({})

export const processOutputSourceSchema = z.object({
  tenantId: z.string().uuid(),
  hrGroupId: z.string().uuid(),
  administrationId: z.string().uuid(),
  processInstanceId: z.string().uuid(),
  processVersionId: z.string().uuid(),
  subjectEmployeeId: z.string().uuid(),
  outputKey: z.string(),
  title: localizedTextSchema,
  outputFormat: z.literal('PDF'),
  dossierCategoryKey: z.string().min(1),
  language: z.enum(['nl', 'en']),
  fieldValues: z.array(z.object({
    key: z.string(),
    label: localizedTextSchema,
    value: z.unknown(),
  }).strict()),
}).strict()

export const processOutputBeginSchema = z.object({
  outputId: z.string().uuid(),
  status: z.literal('PENDING'),
  source: processOutputSourceSchema,
}).strict()

export type ProcessOutputSource = z.infer<typeof processOutputSourceSchema>

function localized(value: Record<string, string>, language: 'nl' | 'en', fallback: string): string {
  return value[language] ?? value.nl ?? value.en ?? fallback
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try { return JSON.stringify(value) ?? '' } catch { return '' }
}

function htmlEscape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function pdfSafe(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?')
}

function pdfLiteral(value: string): string {
  return pdfSafe(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
}

export function processOutputTitle(source: ProcessOutputSource): string {
  return localized(source.title, source.language, source.outputKey)
}

export function buildProcessOutputHtml(source: ProcessOutputSource): string {
  const title = processOutputTitle(source)
  const fields = source.fieldValues.map((field) => {
    const label = localized(field.label, source.language, field.key)
    return `<dt>${htmlEscape(label)}</dt><dd>${htmlEscape(displayValue(field.value))}</dd>`
  }).join('')
  return `<article data-process-output="${htmlEscape(source.outputKey)}"><h1>${htmlEscape(title)}</h1><dl>${fields}</dl></article>`
}

export function buildProcessOutputPdf(source: ProcessOutputSource): Uint8Array {
  const lines = [
    processOutputTitle(source),
    ...source.fieldValues.flatMap((field) => [
      `${localized(field.label, source.language, field.key)}: ${displayValue(field.value)}`,
    ]),
  ].flatMap((line) => {
    const safe = pdfSafe(line)
    return safe.length > 100 ? [safe.slice(0, 97) + '...'] : [safe]
  }).slice(0, 38)
  const stream = ['BT', '/F1 12 Tf', '50 760 Td', ...lines.flatMap((line, index) => [index === 0 ? `(${pdfLiteral(line)}) Tj` : `0 -18 Td (${pdfLiteral(line)}) Tj`]), 'ET'].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const encoder = new TextEncoder()
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const chunks: string[] = [header]
  const offsets: number[] = [0]
  let byteLength = encoder.encode(header).length
  objects.forEach((object, index) => {
    offsets.push(byteLength)
    const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`
    chunks.push(chunk)
    byteLength += encoder.encode(chunk).length
  })
  const xrefOffset = byteLength
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  chunks.push(xref)
  return encoder.encode(chunks.join(''))
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function processOutputFilename(source: ProcessOutputSource): string {
  const safeKey = source.outputKey.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 90) || 'process-output'
  return `${safeKey}.pdf`
}

export function processOutputStorageKey(source: ProcessOutputSource, outputId: string): string {
  return `${source.tenantId}/${source.administrationId}/${source.subjectEmployeeId}/process-output/${outputId}.pdf`
}
