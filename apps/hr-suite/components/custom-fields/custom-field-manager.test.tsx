// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { CustomFieldManager } from './custom-field-manager'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const labels = {
  entity: 'Custom fields', employeeEntity: 'Employee', documentEntity: 'Document (dossier)', selectOption: 'Select an option',
  newField: 'New field', technicalKey: 'Technical key', labelNl: 'Dutch label', labelEn: 'English label', fieldType: 'Field type', country: 'Country',
  required: 'Required', hrAccess: 'HR access', managerAccess: 'Manager access', selfAccess: 'Employee access', options: 'Options',
  chartFilter: 'Chart filter', chartFilterHelp: 'Filter help', create: 'Create field', creating: 'Creating', empty: 'No fields',
  created: 'Created', failed: 'Failed', active: 'Active', inactive: 'Inactive', edit: 'Edit', editField: 'Edit field',
  saveDefinition: 'Save', savingDefinition: 'Saving', delete: 'Delete', deleteConfirm: 'Delete?', deleted: 'Deleted',
  inUse: 'In use', activate: 'Activate', deactivate: 'Deactivate', sortBy: 'Custom fields', sortLabel: 'Label', sortActive: 'Active',
  ascending: 'Ascending', descending: 'Descending', preview: 'Preview', previewEmpty: 'New custom field', previewValue: 'Preview value',
  technicalIdentityHelp: 'Identity help', cancel: 'Cancel', discardTitle: 'Discard?', discardDescription: 'Unsaved changes.',
  discardConfirm: 'Discard', keepEditing: 'Keep editing', types: { TEXT: 'Text', TEXTAREA: 'Multiple lines', NUMBER: 'Number', DATE: 'Date', BOOLEAN: 'Yes/no', SELECT: 'Select', MULTI_SELECT: 'Multiple choices', AUTO_INCREMENT: 'Automatic number' },
  access: { HIDDEN: 'Hidden', READ: 'Read', WRITE: 'Read and edit' },
} as const

function mount(element: ReactNode): { host: HTMLDivElement; root: Root } {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return { host, root }
}

function unmount(host: HTMLDivElement, root: Root): void {
  act(() => root.unmount())
  host.remove()
  document.querySelectorAll('[data-liquidhr-overlay-root]').forEach((element) => element.remove())
}

describe('CustomFieldManager locale labels', () => {
  it('uses English labels for field selectors and the selector placeholder', () => {
    const { host, root } = mount(<CustomFieldManager definitions={[]} entityType="DOCUMENT" labels={labels} locale="en" />)
    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent === labels.create)?.click())

    const selectors = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="listbox"]'))
    expect(selectors.map((button) => button.getAttribute('aria-label'))).toEqual(['Field type', 'HR access', 'Manager access', 'Employee access'])
    expect(selectors.map((button) => button.textContent?.trim())).toEqual(['Text', 'Read and edit', 'Hidden', 'Hidden'])
    expect(document.body.textContent).not.toContain('Selecteer een optie')
    unmount(host, root)
  })

  it('closes only the selector on Escape while preserving a dirty editor', () => {
    const { host, root } = mount(<CustomFieldManager definitions={[]} entityType="DOCUMENT" labels={labels} locale="en" />)
    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent === labels.create)?.click())

    const dutchLabel = document.querySelector<HTMLInputElement>('input[name="labelNl"]')
    expect(dutchLabel).not.toBeNull()
    act(() => {
      if (!dutchLabel) return
      dutchLabel.value = 'Unsaved D01 value'
      dutchLabel.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const fieldType = document.querySelector<HTMLButtonElement>('button[aria-label="Field type"]')
    expect(fieldType).not.toBeNull()
    act(() => fieldType?.click())
    const listbox = document.querySelector('[role="listbox"]')
    expect(listbox).not.toBeNull()
    act(() => listbox?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })))

    expect(document.querySelector('[role="listbox"]')).toBeNull()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    unmount(host, root)
  })
})
