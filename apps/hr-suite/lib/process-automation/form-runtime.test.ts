import { describe, expect, it } from 'vitest'
import {
  buildVisibleFormPayload,
  displayFormValue,
  formProjectionSchema,
  isFormValueValid,
  type FormProjection,
} from './form-runtime'

const projection: FormProjection = {
  responseId: null,
  workItemId: '11111111-1111-4111-8111-111111111111',
  processInstanceId: '22222222-2222-4222-8222-222222222222',
  stepInstanceId: '33333333-3333-4333-8333-333333333333',
  stepKey: 'request',
  participantKey: 'employee',
  formKey: 'transfer',
  formVersionId: null,
  language: 'nl',
  status: 'IN_PROGRESS',
  revision: 0,
  expectedVersion: 0,
  title: 'Interne wijziging',
  description: null,
  sections: [{
    key: 'details',
    title: 'Details',
    fields: [
      { key: 'reason', label: 'Reden', helpText: null, type: 'SHORT_TEXT', accessMode: 'WRITE_REQUIRED', required: true, options: [], currentValue: null, newValue: null },
      { key: 'status', label: 'Status', helpText: null, type: 'SINGLE_SELECT', accessMode: 'READ', required: false, options: [{ value: 'open', label: 'Open' }], currentValue: 'open', newValue: 'open' },
      { key: 'tags', label: 'Tags', helpText: null, type: 'MULTI_SELECT', accessMode: 'WRITE_OPTIONAL', required: false, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], currentValue: [], newValue: [] },
    ],
  }],
  summary: [],
  htmlSummary: '<div data-process-form-summary="true"></div>',
  availableLanguages: ['nl'],
}

describe('process form runtime contract', () => {
  it('accepts the safe projection shape and retains no hidden field in the payload', () => {
    expect(formProjectionSchema.parse(projection)).toEqual(projection)
    const payload = buildVisibleFormPayload(projection, { reason: 'Nieuwe rol', salary: 100000 }, new Set(['reason']))
    expect(payload).toEqual({ current: {}, new: { reason: 'Nieuwe rol' } })
    expect(projection.sections.flatMap((section) => section.fields).some((field) => field.key === 'salary')).toBe(false)
  })

  it('rejects hidden, read-only and invalid values at the shared client boundary', () => {
    const readOnly = projection.sections[0].fields[1]
    expect(() => buildVisibleFormPayload(projection, { salary: 1000 }, new Set(['salary']))).toThrow('FORM_FIELD_UNKNOWN')
    expect(() => buildVisibleFormPayload(projection, { status: 'closed' }, new Set(['status']))).toThrow('FORM_FIELD_READ_ONLY')
    expect(isFormValueValid(readOnly, 'open')).toBe(true)
    expect(isFormValueValid(projection.sections[0].fields[2], [])).toBe(true)
  })

  it('requires a changed value for a required field', () => {
    expect(() => buildVisibleFormPayload(projection, {}, new Set())).toThrow('FORM_FIELD_REQUIRED')
  })

  it('formats values from caller-provided labels', () => {
    const labels = { noValue: 'Geen waarde', booleanTrue: 'Ja', booleanFalse: 'Nee' }
    expect(displayFormValue(null, labels)).toBe('Geen waarde')
    expect(displayFormValue([true, false], labels)).toBe('Ja, Nee')
  })
})
