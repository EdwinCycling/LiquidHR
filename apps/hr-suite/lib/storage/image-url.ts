export type StoredImageKind = 'employee-avatar' | 'company-branding'

export interface StoredImageUrlOptions {
  kind: StoredImageKind
  employeeId?: string
}

/**
 * Geeft het objectpad uit een interne storage-referentie terug zonder de
 * referentie zelf aan de browser bloot te stellen.
 */
export function parseStorageReference(value: string | null | undefined): string | null {
  const normalized = typeof value === 'string' ? value.trim() : ''
  const match = /^storage:\/\/(.+)$/i.exec(normalized)
  const path = match?.[1]?.trim() ?? ''
  return path.length > 0 ? path : null
}

function isSupportedBrowserImageUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true
  if (/^data:image\/(?:gif|jpe?g|png|svg\+xml|webp);/i.test(value)) return true

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isStorageObjectPath(value: string): boolean {
  const segments = value.split('/')
  return segments.length >= 3
    && segments.every((segment) => segment.length > 0)
    && !/[?#\\\u0000]/.test(value)
    && !value.includes('://')
}

export function normalizeStorageObjectPath(value: string | null | undefined): string | null {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return null
  return parseStorageReference(normalized) ?? (isStorageObjectPath(normalized) ? normalized : null)
}

export function resolveStoredImageUrl(value: string | null | undefined, options: StoredImageUrlOptions): string | null {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) return null

  if (options.kind === 'company-branding') {
    return normalizeStorageObjectPath(normalized)
      ? '/api/settings/company-branding/logo'
      : null
  }

  if (parseStorageReference(normalized)) {
    return options.employeeId ? `/api/employees/${encodeURIComponent(options.employeeId)}/avatar` : null
  }

  return isSupportedBrowserImageUrl(normalized) ? normalized : null
}
