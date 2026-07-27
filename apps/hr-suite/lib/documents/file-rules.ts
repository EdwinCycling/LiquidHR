export const MAX_DOCUMENT_FILE_BYTES = 25 * 1024 * 1024
export const MAX_PAYSLIP_FILE_BYTES = 10 * 1024 * 1024

const DOCUMENT_FILE_RULES = [
  { extension: '.pdf', mimeTypes: ['application/pdf'] },
  { extension: '.txt', mimeTypes: ['text/plain'] },
  { extension: '.md', mimeTypes: ['text/markdown', 'text/plain'] },
  { extension: '.csv', mimeTypes: ['text/csv', 'application/csv', 'text/plain'] },
  { extension: '.doc', mimeTypes: ['application/msword'] },
  {
    extension: '.docx',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
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
  },
  {
    extension: '.xlsx',
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  },
  { extension: '.jpg', mimeTypes: ['image/jpeg', 'image/pjpeg'] },
  { extension: '.jpeg', mimeTypes: ['image/jpeg', 'image/pjpeg'] },
  { extension: '.png', mimeTypes: ['image/png'] },
  { extension: '.webp', mimeTypes: ['image/webp'] },
  { extension: '.bmp', mimeTypes: ['image/bmp', 'image/x-ms-bmp'] },
]

export const DOCUMENT_FILE_ACCEPT = '.pdf,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.bmp'
export const DOCUMENT_FILE_TYPES_LABEL = 'PDF, TXT, MD, CSV, DOC, DOCX, XLS, XLSX, JPG, PNG, WEBP, BMP'

export function isAllowedDocumentFile(file: { name: string; type: string }): boolean {
  const extension = normalizeExtension(file.name)
  const mimeType = file.type.trim().toLocaleLowerCase('en-US')
  const rule = DOCUMENT_FILE_RULES.find((item) => item.extension === extension)
  if (!rule) return false
  if (!mimeType) return true
  return rule.mimeTypes.includes(mimeType)
}

function normalizeExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex < 0) return ''
  return filename.slice(dotIndex).toLocaleLowerCase('en-US')
}

export function isAllowedPayslipFile(file: { name: string; type: string }): boolean {
  const extension = normalizeExtension(file.name)
  const mimeType = file.type.trim().toLocaleLowerCase('en-US')
  return extension === '.pdf' && (!mimeType || mimeType === 'application/pdf')
}
