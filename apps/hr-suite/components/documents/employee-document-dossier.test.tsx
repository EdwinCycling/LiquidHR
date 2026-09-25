// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

import { EmployeeDocumentDossier } from './employee-document-dossier'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/documents/document-viewer', () => ({
  DocumentViewer: ({ previewHref, downloadHref }: { previewHref: string; downloadHref?: string }) => <div data-download-href={downloadHref} data-preview-href={previewHref} />,
}))

const labels = Object.fromEntries([
  'title', 'subtitle', 'upload', 'uploadAdvanced', 'file', 'fileDropTitle', 'fileDropHelp', 'fileSelected', 'fileReplace', 'fileRemove', 'fileRules',
  'documentTitle', 'description', 'tags', 'noCloudTags', 'category', 'requiredFields', 'advancedSettings', 'visibleToTitle', 'visibleToEmployee', 'visibleToRole',
  'visibleToDepartment', 'visibilityDefault', 'reminderTitle', 'expiresOn', 'reminderAt', 'reminderForEmployee', 'reminderForRole', 'save', 'saving', 'failed',
  'empty', 'download', 'delete', 'restore', 'deletedDocuments', 'activeDocuments', 'deleteReason', 'deleted', 'expires', 'reminderActive', 'addedOn', 'employeeVisibilityAllowed', 'employeeVisibilityBlocked', 'viewerPreviewLoading', 'viewerPreviewUnavailable',
  'additionalRoles', 'additionalDepartments', 'noExtraVisibility', 'noReminderRecipients', 'invalidType', 'invalidSize', 'emptyFile', 'invalidInput', 'audienceRequired',
  'expiryRequired', 'reminderTargetRequired', 'singleFileOnly', 'view', 'viewerClose', 'viewerUnsupported', 'customMetadata', 'automaticValue', 'cancel', 'close',
  'moreActions', 'discardTitle', 'discardDescription', 'discardConfirm', 'discardCancel', 'deleteTitle', 'deleteDescription', 'deleteConfirm', 'deleteCancel',
  'restoreTitle', 'restoreDescription', 'restoreConfirm', 'restoreCancel', 'editMetadata', 'saveChanges', 'salarySensitive', 'salaryPermissionRequired', 'customFieldsInvalid', 'customFieldsRequired',
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

function dossier(documents: Parameters<typeof EmployeeDocumentDossier>[0]['documents'] = []) {
  return <EmployeeDocumentDossier canDelete canWrite documents={documents} employeeId="employee-1" locale="nl" labels={labels} options={options} />
}

function cancelButton(host: HTMLDivElement): HTMLButtonElement {
  return Array.from(host.querySelectorAll('button')).find((button) => button.textContent === labels.cancel) as HTMLButtonElement
}

describe('EmployeeDocumentDossier dirty protection', () => {
  it('submits DATE fields, expiry and reminder from the initial upload form', async () => {
    const employeeId = 'c6b1c7a9-c250-3d19-b1a0-87e317e80b13'
    const categoryId = '530ffffb-faa8-41f3-be51-ae53b614b388'
    const uploadOptions = {
      ...options,
      categories: [{ id: categoryId, code: 'D01_EXPIRY', name: 'D01 Tijdelijk en verval' }],
      documentCustomFields: [{
        id: 'field-review-date', key: 'd01_review_date', label_nl: 'Beoordelingsdatum', label_en: 'Review date', field_type: 'DATE' as const,
        is_required: false, access: 'WRITE' as const, options: [],
      }],
    }
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const { host, root } = mount(<EmployeeDocumentDossier canDelete canWrite documents={[]} employeeId={employeeId} locale="nl" labels={labels} options={uploadOptions} />)
    const setInputValue = (input: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set
      act(() => {
        setter?.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })
    }

    const fileInput = host.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [new File(['%PDF-1.4\nD01 test'], 'D01-basis.pdf', { type: 'application/pdf' })] })
    act(() => fileInput.dispatchEvent(new Event('change', { bubbles: true })))
    setInputValue(host.querySelector('input[name="title"]') as HTMLInputElement, 'D01 date payload regression')
    setInputValue(host.querySelector('input[name="customField.d01_review_date"]') as HTMLInputElement, '2026-10-30')
    setInputValue(host.querySelector('input[name="expiresOn"]') as HTMLInputElement, '2026-12-31')
    setInputValue(host.querySelector('input[name="reminderAt"]') as HTMLInputElement, '2026-12-01T09:00')

    await act(async () => {
      host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBeInstanceOf(FormData)
    const formData = init?.body as FormData
    const metadata = JSON.parse(String(formData.get('metadata'))) as {
      customFields: Record<string, unknown>
      expiresOn: string | null
      reminder: { remindAt: string } | null
    }
    expect(metadata.customFields.d01_review_date).toBe('2026-10-30')
    expect(metadata.expiresOn).toBe('2026-12-31')
    expect(metadata.reminder?.remindAt).toBe(new Date('2026-12-01T09:00').toISOString())

    vi.unstubAllGlobals()
    unmount(host, root)
  })

  it('uses the localized validation message when no file is selected', () => {
    const localizedLabels = { ...labels, invalidInput: 'Controleer het bestand en de documentgegevens.' }
    const { host, root } = mount(<EmployeeDocumentDossier canDelete canWrite documents={[]} employeeId="employee-1" locale="nl" labels={localizedLabels} options={options} />)
    const fileInput = host.querySelector('input[type="file"]') as HTMLInputElement

    expect(fileInput.required).toBe(false)
    act(() => host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))

    expect(host.textContent).toContain(localizedLabels.invalidInput)
    unmount(host, root)
  })

  it('shows the empty-file message instead of the oversized-file message', () => {
    const { host, root } = mount(dossier())
    const fileInput = host.querySelector('input[type="file"]') as HTMLInputElement
    const emptyFile = new File([], 'D01-0-byte.txt', { type: 'text/plain' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [emptyFile] })

    act(() => fileInput.dispatchEvent(new Event('change', { bubbles: true })))
    act(() => host.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))

    expect(host.textContent).not.toContain(labels.invalidSize)
    expect(host.textContent).toContain(labels.emptyFile)
    unmount(host, root)
  })

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

  it('loads persisted document metadata before opening the editor', () => {
    const editableOptions = {
      ...options,
      documentCustomFields: [{
        id: 'field-reference', key: 'd01_reference', label_nl: 'Referentie', label_en: 'Reference', field_type: 'TEXT' as const,
        is_required: false, access: 'WRITE' as const, options: [],
      }],
    }
    const savedDocument = {
      id: 'document-1', category_id: 'category-1', title: 'D01 bestaand document', description: 'Vastgelegde omschrijving', tags: ['D01'],
      custom_fields: { d01_reference: 'D01-REF-001' }, custom_field_labels_nl: { d01_reference: 'Referentie' }, custom_field_labels_en: { d01_reference: 'Reference' },
      original_filename: 'D01-basis.pdf', content_type: 'application/pdf', file_size: 100, expires_on: null, created_at: '2026-09-24T08:00:00.000Z',
      deleted_at: null, delete_reason: null, expiry_reminder_id: null,
      document_categories: { code: 'D01', name: 'D01 Algemeen', requires_salary_permission: false }, document_audiences: [],
    } satisfies Parameters<typeof EmployeeDocumentDossier>[0]['documents'][number]
    const { host, root } = mount(<EmployeeDocumentDossier canDelete canWrite documents={[savedDocument]} employeeId="employee-1" locale="nl" labels={labels} options={editableOptions} />)

    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === labels.moreActions)?.click())
    act(() => document.body.querySelector('[role="menuitem"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect((host.querySelector('input[name="title"]') as HTMLInputElement).value).toBe(savedDocument.title)
    expect((host.querySelector('textarea[name="description"]') as HTMLTextAreaElement).value).toBe(savedDocument.description)
    expect((host.querySelector('input[name="customField.d01_reference"]') as HTMLInputElement).value).toBe('D01-REF-001')
    unmount(host, root)
  })

  it('opens inline dossier files through the same-origin preview route', () => {
    const savedDocument = {
      id: 'document-preview', category_id: 'category-1', title: 'D01 preview document', description: null, tags: [],
      custom_fields: {}, custom_field_labels_nl: {}, custom_field_labels_en: {}, original_filename: 'D01-basis.pdf',
      content_type: 'application/pdf', file_size: 100, expires_on: null, created_at: '2026-09-24T08:00:00.000Z',
      deleted_at: null, delete_reason: null, expiry_reminder_id: null,
      document_categories: { code: 'D01', name: 'D01 Algemeen', requires_salary_permission: false }, document_audiences: [],
    } satisfies Parameters<typeof EmployeeDocumentDossier>[0]['documents'][number]
    const { host, root } = mount(dossier([savedDocument]))

    act(() => Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes(labels.view))?.click())

    expect(host.querySelector('[data-preview-href]')?.getAttribute('data-preview-href')).toBe('/api/employees/employee-1/documents/document-preview/preview')
    expect(host.querySelector('[data-preview-href]')?.getAttribute('data-download-href')).toBe('/api/employees/employee-1/documents/document-preview/download')
    unmount(host, root)
  })

  it('keeps a deleted document out of the active list and shows it in the restore view', () => {
    const archivedDocument = {
      id: 'document-deleted', category_id: 'category-1', title: 'D01 verwijderd document', description: null, tags: [],
      custom_fields: {}, custom_field_labels_nl: {}, custom_field_labels_en: {}, original_filename: 'D01-verwijderd.pdf',
      content_type: 'application/pdf', file_size: 100, expires_on: null, created_at: '2026-09-21T08:00:00.000Z',
      deleted_at: '2026-09-22T08:00:00.000Z', delete_reason: 'D01 test', expiry_reminder_id: null,
      document_categories: { code: 'D01', name: 'D01', requires_salary_permission: false }, document_audiences: [],
    } satisfies Parameters<typeof EmployeeDocumentDossier>[0]['documents'][number]
    const { host, root } = mount(dossier([archivedDocument]))

    expect(host.textContent).not.toContain(archivedDocument.title)
    const toggle = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes(labels.deletedDocuments))
    expect(toggle).toBeDefined()
    act(() => toggle?.click())

    expect(host.textContent).toContain(archivedDocument.title)
    expect(host.querySelector('a[download]')).toBeNull()
    unmount(host, root)
  })
})
