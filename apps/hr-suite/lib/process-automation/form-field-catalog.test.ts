import { describe, expect, it } from 'vitest'
import { fieldTypeValues } from './definition-schemas'
import { defaultOptionsForFieldType, formFieldCatalog, formFieldGroups } from './form-field-catalog'
import {
  bindingAllowsWrite,
  bindingCatalogEntry,
  bindingCatalogForFieldType,
  formBindingCatalog,
  formBindingKindValues,
} from './form-binding-catalog'

describe('form field catalog', () => {
  it('exposes every contract field type exactly once', () => {
    expect(formFieldCatalog.map((entry) => entry.type)).toEqual(fieldTypeValues)
    expect(new Set(formFieldCatalog.map((entry) => entry.type)).size).toBe(fieldTypeValues.length)
    expect(new Set(formFieldCatalog.map((entry) => entry.group))).toEqual(new Set(formFieldGroups))
  })

  it('provides publishable starter options for choice fields only', () => {
    expect(defaultOptionsForFieldType('SINGLE_SELECT')).toHaveLength(2)
    expect(defaultOptionsForFieldType('MULTI_SELECT')).toHaveLength(2)
    expect(defaultOptionsForFieldType('SHORT_TEXT')).toBeUndefined()
    expect(defaultOptionsForFieldType('DOCUMENT_REFERENCE')).toBeUndefined()
  })

  it('exposes a closed binding registry for every binding category', () => {
    expect(new Set(formBindingCatalog.map((entry) => entry.kind))).toEqual(new Set(formBindingKindValues))
    expect(formBindingCatalog.some((entry) => entry.kind === 'DOMAIN_READ' && entry.key === 'employee.current.manager')).toBe(true)
    expect(formBindingCatalog.some((entry) => entry.kind === 'DOMAIN_READ' && entry.key === 'employment.current.contractType')).toBe(true)
    expect(formBindingCatalog.some((entry) => entry.kind === 'DOMAIN_PROPOSAL' && entry.key === 'employment.organizationChange.targetJob')).toBe(true)
    expect(formBindingCatalog.some((entry) => entry.kind === 'COMPUTED' && entry.formulaKey === 'employment-tenure-years')).toBe(true)
    expect(formBindingCatalog.every((entry) => entry.value.kind === entry.kind)).toBe(true)
  })

  it('filters bindings by the field contract and keeps write semantics explicit', () => {
    const dateBindings = bindingCatalogForFieldType('DATE')
    expect(dateBindings.some((entry) => entry.kind === 'PROCESS_ONLY')).toBe(true)
    expect(dateBindings.some((entry) => entry.key === 'employment.current.startsOn')).toBe(true)
    expect(dateBindings.some((entry) => entry.formulaKey === 'process-business-effective-date')).toBe(true)
    expect(bindingCatalogEntry({ kind: 'DOMAIN_READ', key: 'employee.current.manager' })?.type).toBe('EMPLOYEE_REFERENCE')
    expect(bindingAllowsWrite('PROCESS_ONLY')).toBe(true)
    expect(bindingAllowsWrite('DOMAIN_PROPOSAL')).toBe(true)
    expect(bindingAllowsWrite('DOMAIN_READ')).toBe(false)
    expect(bindingAllowsWrite('COMPUTED')).toBe(false)
  })
})
