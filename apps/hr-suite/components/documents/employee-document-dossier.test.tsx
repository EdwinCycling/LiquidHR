// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { EmployeeDocumentDossier } from './employee-document-dossier'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const labels = Object.fromEntries([
  'title', 'subtitle', 'upload', 'uploadAdvanced', 'file', 'fileDropTitle', 'fileDropHelp', 'fileSelected', 'fileReplace', 'fileRemove', 'fileRules',
  'documentTitle', 'description', 'tags', 'noCloudTags', 'category', 'requiredFields', 'advancedSettings', 'visibleToTitle', 'visibleToEmployee', 'visibleToRole',
  'visibleToDepartment', 'visibilityDefault', 'reminderTitle', 'expiresOn', 'reminderAt', 'reminderForEmployee', 'reminderForRole', 'save', 'saving', 'failed',
  'empty', 'download', 'delete', 'restore', 'deleteReason', 'deleted', 'expires', 'reminderActive', 'addedOn', 'employeeVisibilityAllowed', 'employeeVisibilityBlocked',
  'additionalRoles', 'additionalDepartments', 'noExtraVisibility', 'noReminderRecipients', 'invalidType', 'invalidSize', 'invalidInput', 'audienceRequired',
  'expiryRequired', 'reminderTargetRequired', 'singleFileOnly', 'view', 'viewerClose', 'viewerUnsupported', 'customMetadata', 'automaticValue', 'cancel', 'close',
  'moreActions', 'discardTitle', 'discardDescription', 'discardConfirm', 'discardCancel', 'deleteTitle', 'deleteDescription', 'deleteConfirm', 'deleteCancel',
  'restoreTitle', 'restoreDescription', 'restoreConfirm', 'restoreCancel',
].map((key) => [key, key])) as unknown as Parameters<typeof EmployeeDocumentDossier>[0]['labels']

const options = {
  categories: [{ id: 'category-1', code: 'GENERAL', name: 'General' }],
  departments: [],
  roles: [],
  employees: [],
  cloudTags: [],
  documentCustomFields: [],
}

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

function dossier() {
  return <EmployeeDocumentDossier canDelete canWrite documents={[]} employeeId="employee-1" labels={labels} options={options} />
}

function cancelButton(host: HTMLDivElement): HTMLButtonElement {
  return Array.from(host.querySelectorAll('button')).find((button) => button.textContent === labels.cancel) as HTMLButtonElement
}

describe('EmployeeDocumentDossier dirty protection', () => {
  it('opens the discard confirmation after a file is selected by drag and drop', () => {
    const { host, root } = mount(dossier())
    const dropTarget = host.querySelector('input[type="file"]')?.parentElement as HTMLLabelElement
    const file = new File(['document'], 'contract.pdf', { type: 'application/pdf' })
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [file] } })

    act(() => dropTarget.dispatchEvent(dropEvent))
    act(() => cancelButton(host).click())

    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(labels.discardTitle)
    unmount(host, root)
  })

  it('opens confirmation for picker selection but closes an untouched form directly', () => {
    const dirtyMount = mount(dossier())
    const fileInput = dirtyMount.host.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['document'], 'contract.pdf', { type: 'application/pdf' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })

    act(() => fileInput.dispatchEvent(new Event('change', { bubbles: true })))
    act(() => cancelButton(dirtyMount.host).click())
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(labels.discardTitle)
    unmount(dirtyMount.host, dirtyMount.root)

    const cleanMount = mount(dossier())
    act(() => cancelButton(cleanMount.host).click())
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    unmount(cleanMount.host, cleanMount.root)
  })

  it('treats controlled document selections as dirty', () => {
    const { host, root } = mount(dossier())
    const employeeVisibility = host.querySelector('input[type="checkbox"]') as HTMLInputElement

    act(() => employeeVisibility.click())
    act(() => cancelButton(host).click())

    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(labels.discardTitle)
    unmount(host, root)
  })
})
