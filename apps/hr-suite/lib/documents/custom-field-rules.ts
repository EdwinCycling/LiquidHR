import { isDocumentDateOnly } from './schemas'

export type DocumentCustomFieldType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'AUTO_INCREMENT'
export type DocumentFieldAccess = 'HIDDEN' | 'READ' | 'WRITE'

export interface DocumentCustomFieldDefinition {
  key: string
  field_type: DocumentCustomFieldType
  is_required: boolean
  access: DocumentFieldAccess
  options: readonly string[]
}

export type DocumentCustomFieldFailure = 'DOCUMENT_CUSTOM_FIELDS_INVALID' | 'DOCUMENT_CUSTOM_FIELDS_REQUIRED'

export function validateDocumentCustomFieldValues(
  definitions: readonly DocumentCustomFieldDefinition[],
  values: unknown,
): DocumentCustomFieldFailure | null {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return 'DOCUMENT_CUSTOM_FIELDS_INVALID'
  const fields = values as Record<string, unknown>
  const writable = new Map(definitions.filter((definition) => definition.access === 'WRITE').map((definition) => [definition.key, definition]))
  if (Object.keys(fields).some((key) => !writable.has(key))) return 'DOCUMENT_CUSTOM_FIELDS_INVALID'

  for (const definition of writable.values()) {
    const value = fields[definition.key]
    const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
    if (definition.is_required && empty && definition.field_type !== 'AUTO_INCREMENT') return 'DOCUMENT_CUSTOM_FIELDS_REQUIRED'
    if (empty) continue

    switch (definition.field_type) {
      case 'TEXT':
      case 'TEXTAREA':
        if (typeof value !== 'string' || value.length > 5000) return 'DOCUMENT_CUSTOM_FIELDS_INVALID'
        break
      case 'NUMBER':
        if (typeof value !== 'number' || !Number.isFinite(value)) return 'DOCUMENT_CUSTOM_FIELDS_INVALID'
        break
      case 'DATE':
        if (typeof value !== 'string' || !isDocumentDateOnly(value)) return 'DOCUMENT_CUSTOM_FIELDS_INVALID'
        break
      case 'BOOLEAN':
        if (typeof value !== 'boolean') return 'DOCUMENT_CUSTOM_FIELDS_INVALID'
        break
      case 'SELECT':
        if (typeof value !== 'string' || !definition.options.includes(value)) return 'DOCUMENT_CUSTOM_FIELDS_INVALID'
        break
      case 'MULTI_SELECT':
        if (!Array.isArray(value) || value.length > 100 || value.some((item) => typeof item !== 'string' || !definition.options.includes(item)) || new Set(value).size !== value.length) return 'DOCUMENT_CUSTOM_FIELDS_INVALID'
        break
      case 'AUTO_INCREMENT':
        return 'DOCUMENT_CUSTOM_FIELDS_INVALID'
    }
  }
  return null
}
