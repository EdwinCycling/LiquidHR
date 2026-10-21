import { describe, expect, it } from 'vitest'
import type { FieldDefinition } from './definition-schemas'
import { changeDefinitionFieldType, duplicateDefinitionField, reorderDefinitionItems, uniqueDefinitionKey } from './form-studio-draft'

const shortTextField: FieldDefinition = {
  key: 'course-name',
  label: { nl: 'Opleiding', en: 'Course' },
  type: 'SHORT_TEXT',
  binding: { kind: 'PROCESS_ONLY' },
  access: [{ participantKey: 'employee', mode: 'WRITE_OPTIONAL' }],
}

describe('form studio draft operations', () => {
  it('creates unique stable keys and moves sections in the requested order', () => {
    expect(uniqueDefinitionKey('section', ['section'])).toBe('section-2')
    expect(reorderDefinitionItems(['A', 'B', 'C'], 0, 1)).toEqual(['B', 'A', 'C'])
    expect(reorderDefinitionItems(['A', 'B'], 1, 1)).toEqual(['A', 'B'])
  })

  it('duplicates a field with a unique key and independent access/options', () => {
    const source: FieldDefinition = {
      ...shortTextField,
      type: 'SINGLE_SELECT',
      options: [{ value: 'course', label: { nl: 'Cursus', en: 'Course' } }],
    }
    const copy = duplicateDefinitionField(source, ['course-name', 'course-name-copy'], 'kopie')

    expect(copy.key).toBe('course-name-copy-2')
    expect(copy.label).toEqual({ nl: 'Opleiding (kopie)', en: 'Course (kopie)' })
    expect(copy.access).toEqual(source.access)
    expect(copy.access).not.toBe(source.access)
    expect(copy.options).toEqual(source.options)
    expect(copy.options).not.toBe(source.options)
  })

  it('changes field type using compatible typed bindings and type defaults', () => {
    const changed = changeDefinitionFieldType(shortTextField, 'SINGLE_SELECT')

    expect(changed.type).toBe('SINGLE_SELECT')
    expect(changed.options).toHaveLength(2)
    expect(changed.binding).toEqual({ kind: 'PROCESS_ONLY' })
    expect(changed.access[0]?.mode).toBe('WRITE_OPTIONAL')
  })
})