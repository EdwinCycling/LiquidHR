import {
  hasBmpSignature,
  hasDocxSignature,
  hasJpegSignature,
  hasLegacyOfficeSignature,
  hasPdfSignature,
  hasPngSignature,
  hasSafeTextContent,
  hasWebpSignature,
  hasXlsxSignature,
} from './file-signatures'

export const MAX_DOCUMENT_FILE_BYTES = 25 * 1024 * 1024
export const MAX_DOCUMENT_REQUEST_BYTES = MAX_DOCUMENT_FILE_BYTES + 2 * 1024 * 1024
export const MAX_PAYSLIP_FILE_BYTES = 10 * 1024 * 1024

type DocumentFileRule = {
  readonly extension: string
  readonly mimeTypes: readonly string[]
  readonly contentType: string
  readonly signature: (bytes: Uint8Array) => boolean
}

const DOCUMENT_FILE_RULES: readonly DocumentFileRule[] = [
  { extension: '.pdf', mimeTypes: ['application/pdf'], contentType: 'application/pdf', signature: hasPdfSignature },
  { extension: '.txt', mimeTypes: ['text/plain'], contentType: 'text/plain', signature: hasSafeTextContent },
  { extension: '.md', mimeTypes: ['text/markdown', 'text/plain'], contentType: 'text/markdown', signature: hasSafeTextContent },
  { extension: '.csv', mimeTypes: ['text/csv', 'application/csv', 'text/plain'], contentType: 'text/csv', signature: hasSafeTextContent },
  { extension: '.doc', mimeTypes: ['application/msword'], contentType: 'application/msword', signature: hasLegacyOfficeSignature },
  {
    extension: '.docx',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    signature: hasDocxSignature,
  },
  {
    extension: '.xls',
    mimeTypes: [
      'application/vnd.ms-excel',
      'application/msexcel',
      'application/x-msexcel',
      'application/x-ms-excel',
      'application/x-excel',
      'application/excel',
    ],
    contentType: 'application/vnd.ms-excel',
    signature: hasLegacyOfficeSignature,
  },
  {
    extension: '.xlsx',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    signature: hasXlsxSignature,
  },
  { extension: '.jpg', mimeTypes: ['image/jpeg', 'image/pjpeg'], contentType: 'image/jpeg', signature: hasJpegSignature },
  { extension: '.jpeg', mimeTypes: ['image/jpeg', 'image/pjpeg'], contentType: 'image/jpeg', signature: hasJpegSignature },
  { extension: '.png', mimeTypes: ['image/png'], contentType: 'image/png', signature: hasPngSignature },
  { extension: '.webp', mimeTypes: ['image/webp'], contentType: 'image/webp', signature: hasWebpSignature },
  { extension: '.bmp', mimeTypes: ['image/bmp', 'image/x-ms-bmp'], contentType: 'image/bmp', signature: hasBmpSignature },
]

export const DOCUMENT_FILE_ACCEPT = '.pdf,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.bmp'
export const DOCUMENT_FILE_TYPES_LABEL = 'PDF, TXT, MD, CSV, DOC, DOCX, XLS, XLSX, JPG, PNG, WEBP, BMP'

export function isAllowedDocumentFile(file: { name: string; type: string }): boolean {
  const rule = DOCUMENT_FILE_RULES.find((item) => item.extension === normalizeExtension(file.name))
  const mimeType = file.type.trim().toLocaleLowerCase('en-US')
  if (!rule) return false
  if (!mimeType) return true
  return rule.mimeTypes.includes(mimeType)
}

function normalizeExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex < 0) return ''
  return filename.slice(dotIndex).toLocaleLowerCase('en-US')
}

export type DocumentFileValidationFailure = 'SIZE' | 'TYPE' | 'SIGNATURE'
export type DocumentFileValidation =
  | { readonly ok: true; readonly bytes: Uint8Array; readonly contentType: string }
  | { readonly ok: false; readonly reason: DocumentFileValidationFailure }

export async function validateDocumentFile(file: File): Promise<DocumentFileValidation> {
  if (file.size < 1 || file.size > MAX_DOCUMENT_FILE_BYTES) return { ok: false, reason: 'SIZE' }

  const rule = DOCUMENT_FILE_RULES.find((item) => item.extension === normalizeExtension(file.name))
  if (!rule) return { ok: false, reason: 'TYPE' }
  const mimeType = file.type.trim().toLocaleLowerCase('en-US')
  if (mimeType && !rule.mimeTypes.includes(mimeType)) return { ok: false, reason: 'TYPE' }

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return { ok: false, reason: 'SIGNATURE' }
  }
  if (bytes.byteLength !== file.size) return { ok: false, reason: 'SIZE' }
  if (!rule.signature(bytes)) return { ok: false, reason: 'SIGNATURE' }
  return { ok: true, bytes, contentType: rule.contentType }
}

export function sanitizeDocumentFilename(name: string): string {
  const sanitized = name
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^\.+/, '')
    .slice(-180)
  return sanitized || 'document'
}

export function isDocumentRequestBodyTooLarge(request: Request): boolean {
  const rawContentLength = request.headers.get('content-length')
  if (!rawContentLength) return false
  const contentLength = Number(rawContentLength)
  return Number.isFinite(contentLength) && contentLength > MAX_DOCUMENT_REQUEST_BYTES
}

export function isAllowedPayslipFile(file: { name: string; type: string }): boolean {
  const extension = normalizeExtension(file.name)
  const mimeType = file.type.trim().toLocaleLowerCase('en-US')
  return extension === '.pdf' && (!mimeType || mimeType === 'application/pdf')
}
