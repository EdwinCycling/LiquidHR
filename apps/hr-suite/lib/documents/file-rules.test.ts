import { describe, expect, it } from 'vitest'
import {
  isDocumentRequestBodyTooLarge,
  MAX_DOCUMENT_FILE_BYTES,
  MAX_DOCUMENT_REQUEST_BYTES,
  sanitizeDocumentFilename,
  validateDocumentFile,
} from './file-rules'

function file(bytes: Uint8Array, name: string, type: string): File {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new File([copy], name, { type })
}

function zipEntry(entryName: string): Uint8Array {
  const bytes = new Uint8Array(30 + entryName.length)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x04034b50, true)
  view.setUint16(26, entryName.length, true)
  bytes.set(new TextEncoder().encode(entryName), 30)
  return bytes
}

describe('internal document file rules', () => {
  it('accepteert een echte PDF en normaliseert een lege browser-MIME', async () => {
    const result = await validateDocumentFile(file(new TextEncoder().encode('%PDF-1.7\n'), 'contract.pdf', ''))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.contentType).toBe('application/pdf')
  })

  it('accepteert geldige image- en Office-signaturen', async () => {
    const png = await validateDocumentFile(file(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'logo.png', 'image/png'))
    const docx = await validateDocumentFile(file(zipEntry('word/document.xml'), 'contract.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
    const xlsx = await validateDocumentFile(file(zipEntry('xl/workbook.xml'), 'report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))
    expect(png.ok).toBe(true)
    expect(docx.ok).toBe(true)
    expect(xlsx.ok).toBe(true)
  })

  it('weigert extension-, MIME- en magic-byte-spoofing', async () => {
    const pdfBytes = new TextEncoder().encode('%PDF-1.7\n')
    const pngAsPdf = await validateDocumentFile(file(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), 'contract.pdf', 'application/pdf'))
    const wrongMime = await validateDocumentFile(file(pdfBytes, 'contract.pdf', 'image/png'))
    const invalidPdf = await validateDocumentFile(file(new TextEncoder().encode('plain text'), 'contract.pdf', 'application/pdf'))
    const svg = await validateDocumentFile(file(new TextEncoder().encode('<svg></svg>'), 'image.svg', 'image/svg+xml'))
    expect(pngAsPdf).toEqual({ ok: false, reason: 'SIGNATURE' })
    expect(wrongMime).toEqual({ ok: false, reason: 'TYPE' })
    expect(invalidPdf).toEqual({ ok: false, reason: 'SIGNATURE' })
    expect(svg).toEqual({ ok: false, reason: 'TYPE' })
  })

  it('weigert actieve inhoud in tekstbestanden', async () => {
    const result = await validateDocumentFile(file(new TextEncoder().encode('<script>alert(1)</script>'), 'notes.txt', 'text/plain'))
    expect(result).toEqual({ ok: false, reason: 'SIGNATURE' })
  })

  it('weigert te grote bestanden vóórdat bytes worden gelezen', async () => {
    const oversized = {
      name: 'large.pdf',
      type: 'application/pdf',
      size: MAX_DOCUMENT_FILE_BYTES + 1,
      arrayBuffer: async () => { throw new Error('arrayBuffer must not be called') },
    } as unknown as File
    await expect(validateDocumentFile(oversized)).resolves.toEqual({ ok: false, reason: 'SIZE' })
  })

  it('weigert een afgekapt body-resultaat en begrenst multipart requests', async () => {
    const truncated = {
      name: 'contract.pdf',
      type: 'application/pdf',
      size: 8,
      arrayBuffer: async () => new TextEncoder().encode('%PDF'),
    } as unknown as File
    await expect(validateDocumentFile(truncated)).resolves.toEqual({ ok: false, reason: 'SIZE' })

    const request = new Request('https://liquid-hr.test/api/company-documents', {
      method: 'POST',
      headers: { 'content-length': String(MAX_DOCUMENT_REQUEST_BYTES + 1) },
    })
    expect(isDocumentRequestBodyTooLarge(request)).toBe(true)
    expect(isDocumentRequestBodyTooLarge(new Request('https://liquid-hr.test/api/company-documents'))).toBe(false)
  })

  it('maakt bestandsnamen veilig voor storage keys', () => {
    const result = sanitizeDocumentFilename('..\\..\\contract<>.pdf')
    expect(result).toBe('contract-.pdf')
    expect(result).not.toContain('\\')
    expect(result).not.toContain('/')
  })
})
