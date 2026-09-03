export function unwrapDocumentStudioData(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const data = (value as { data?: unknown }).data
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  return data as Record<string, unknown>
}
