import { describe, expect, it } from 'vitest'
import { validateDocumentCustomFieldValues, type DocumentCustomFieldDefinition } from './custom-field-rules'

const definitions: DocumentCustomFieldDefinition[] = [
  { key: 'reference', field_type: 'TEXT', is_required: true, access: 'WRITE', options: [] },
  { key: 'score', field_type: 'NUMBER', is_required: false, access: 'WRITE', options: [] },
  { key: 'review_date', field_type: 'DATE', is_required: false, access: 'WRITE', options: [] },
  { key: 'verified', field_type: 'BOOLEAN', is_required: false, access: 'WRITE', options: [] },
  { key: 'classification', field_type: 'SELECT', is_required: false, access: 'WRITE', options: ['INTERNAL', 'EMPLOYEE'] },
  { key: 'topics', field_type: 'MULTI_SELECT', is_required: false, access: 'WRITE', options: ['CONTRACT', 'POLICY'] },
  { key: 'internal_note', field_type: 'TEXT', is_required: false, access: 'HIDDEN', options: [] },
  { key: 'read_only', field_type: 'TEXT', is_required: false, access: 'READ', options: [] },
]

describe('document custom field values', () => {
  it('accepts valid typed values and optional omissions', () => {
    expect(validateDocumentCustomFieldValues(definitions, {
      reference: 'D01-REF-001', score: 7.5, review_date: '2026-09-24', verified: false,
      classification: 'INTERNAL', topics: ['CONTRACT', 'POLICY'],
    })).toBeNull()
  })

  it.each([
    ['number as text', { reference: 'D01-REF-001', score: '7' }],
    ['non-finite number', { reference: 'D01-REF-001', score: Number.NaN }],
    ['invalid calendar date', { reference: 'D01-REF-001', review_date: '2026-02-31' }],
    ['unknown select option', { reference: 'D01-REF-001', classification: 'SECRET' }],
    ['unknown multiselect option', { reference: 'D01-REF-001', topics: ['CONTRACT', 'SECRET'] }],
    ['duplicate multiselect option', { reference: 'D01-REF-001', topics: ['CONTRACT', 'CONTRACT'] }],
    ['manager read-only write', { reference: 'D01-REF-001', read_only: 'changed' }],
    ['employee hidden write', { reference: 'D01-REF-001', internal_note: 'hidden' }],
  ])('rejects %s before persistence', (_case, values) => {
    expect(validateDocumentCustomFieldValues(definitions, values)).toBe('DOCUMENT_CUSTOM_FIELDS_INVALID')
  })

  it('rejects a missing required writable value', () => {
    expect(validateDocumentCustomFieldValues(definitions, {})).toBe('DOCUMENT_CUSTOM_FIELDS_REQUIRED')
  })
})
