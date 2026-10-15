// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ContinuousAppraisalItem, ContinuousAppraisalWorkspace as WorkspaceData } from '@/lib/continuous-appraisal/service'
import { ContinuousAppraisalWorkspace, type ContinuousAppraisalLabels, type ContinuousAppraisalFilter } from './continuous-appraisal-workspace'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const labelValues: Partial<ContinuousAppraisalLabels> = {
  all: 'Alles', notes: 'Notities', actions: 'Acties', agreements: 'Afspraken', feedback: 'Feedback', goals: 'Doelen', meetings: 'Gesprekken',
  newEntry: 'Nieuw item', addNote: 'Notitie', addAction: 'Actie', addAgreement: 'Afspraak', addFeedback: 'Feedback', addGoal: 'Doel', addMeeting: 'Gespreksverslag',
  selectEmployee: 'Medewerker', search: 'Zoeken', itemCount: 'items', activeFollowUp: 'Openstaande acties', upcomingItems: 'Aankomende afspraken en deadlines', filterByType: 'Filter op type',
  edit: 'Bewerken', moreActions: 'Meer acties', title: 'Doorlopende beoordeling', managerSubtitle: 'Gedeelde tijdlijn', subtitle: 'Mijn tijdlijn', employee: 'Medewerker', newest: 'Nieuwste eerst', oldest: 'Oudste eerst', note: 'Notitie', action: 'Actie', agreement: 'Afspraak', goal: 'Doel', development: 'Ontwikkelpunt', meeting: 'Gespreksverslag', entryType: 'Type item', titleLabel: 'Titel', bodyLabel: 'Beschrijving', dateLabel: 'Datum', dueDate: 'Einddatum', nextMeeting: 'Volgend gesprek', owner: 'Eigenaar', status: 'Status', priority: 'Prioriteit', goalKind: 'Soort doel', open: 'Open', waiting: 'Wacht op reactie', active: 'Actief', done: 'Afgerond', notRelevant: 'Niet meer relevant', cancelled: 'Geannuleerd', planned: 'Gepland', archived: 'Gearchiveerd', low: 'Laag', medium: 'Gemiddeld', high: 'Hoog', save: 'Opslaan', cancel: 'Annuleren', close: 'Sluiten', comments: 'Reacties', addComment: 'Reageren', commentPlaceholder: 'Schrijf een korte reactie', commentLimit: 'maximaal 100 tekens', noItems: 'Nog geen items', noItemsDescription: 'Voeg iets toe.', noResults: 'Geen resultaten', noResultsDescription: 'Pas filters aan.', pastItem: 'Verleden', futureItem: 'Toekomst', createdBy: 'Aangemaakt door', irrelevant: 'Niet meer relevant', saveFailed: 'Opslaan mislukt', saved: 'Opgeslagen', systemEvent: 'Systeemgebeurtenis', addDescription: 'Item toevoegen', editDescription: 'Item bewerken', attachments: 'Bijlagen', addAttachment: 'Bijlage toevoegen', attachmentTypes: 'PNG, JPG, WEBP of PDF', attachmentUploadFailed: 'Upload mislukt', attachmentPartialFailure: 'Het item is opgeslagen, maar niet alle bijlagen zijn geüpload. Probeer de resterende bijlagen opnieuw.', attachmentInvalidType: 'Ongeldig bestandstype.', attachmentInvalidSize: 'Bestand te groot.', removeFile: 'Bijlage verwijderen', retryUpload: 'Bijlagen opnieuw proberen', itemSavedPendingAttachments: 'Upload de resterende bijlagen.', selectedAttachments: 'Geselecteerde bijlagen', filters: 'Filters', filterByStatus: 'Filter op status', filterByOwner: 'Filter op eigenaar', fromDate: 'Vanaf', toDate: 'Tot en met', clearFilters: 'Filters wissen', quickAdd: 'Snel toevoegen', canWrite: 'Bewerkbaar', readOnly: 'Alleen lezen', readOnlyDescription: 'Alleen lezen', noActiveFollowUp: 'Geen open acties.', employeeNumber: 'Personeelsnummer', jobTitle: 'Functie', discardTitle: 'Wijzigingen negeren?', discardDescription: 'Wijzigingen gaan verloren.', discardConfirm: 'Wijzigingen negeren', discardCancel: 'Terug', attachmentUnavailable: 'Bijlagen niet beschikbaar.', leftTabs: 'Vorige typen', rightTabs: 'Volgende typen', markDone: 'Klaar', deleteAction: 'Verwijderen', deleteTitle: 'Item verwijderen?', deleteDescription: 'Dit item verdwijnt uit de normale tijdlijn. De wijziging wordt in de historie vastgelegd:', deleteConfirm: 'Verwijderen', deleted: 'Het item is uit de tijdlijn verwijderd.', deleteFailed: 'Verwijderen mislukt.', statusMarkedDone: 'Het item is als afgerond gemarkeerd.', statusMarkedNotRelevant: 'Het item is als niet meer relevant gemarkeerd.', statusActionFailed: 'De status is niet gewijzigd.', versionConflict: 'Dit item is ondertussen gewijzigd. Vernieuw de tijdlijn en probeer het opnieuw.', filtersActive: 'actief', followUpDescription: 'Open acties en toekomstige afspraken of deadlines', viewDetails: 'Details bekijken', viewItem: 'Item bekijken',
}
const labels = new Proxy(labelValues as ContinuousAppraisalLabels, { get: (target, key: string | symbol) => typeof key === 'string' ? target[key as keyof ContinuousAppraisalLabels] ?? key : '' })

const employee = { id: 'employee-1', label: 'Noah Hendriks', employeeNumber: 'E-001', jobTitle: 'Consultant', avatarUrl: null }
const categories: Array<{ filter: Exclude<ContinuousAppraisalFilter, 'ALL'>; label: string; addLabel: string; type: string }> = [
  { filter: 'NOTE', label: 'Notities', addLabel: 'Notitie', type: 'NOTE' }, { filter: 'ACTION', label: 'Acties', addLabel: 'Actie', type: 'ACTION' }, { filter: 'AGREEMENT', label: 'Afspraken', addLabel: 'Afspraak', type: 'AGREEMENT' },
  { filter: 'FEEDBACK', label: 'Feedback', addLabel: 'Feedback', type: 'FEEDBACK' }, { filter: 'GOAL', label: 'Doelen', addLabel: 'Doel', type: 'GOAL' }, { filter: 'MEETING_SUMMARY', label: 'Gesprekken', addLabel: 'Gespreksverslag', type: 'MEETING_SUMMARY' },
]

function createItem(type: string): ContinuousAppraisalItem {
  return {
    id: 'item-' + type, employee_id: employee.id, manager_employee_id: 'manager-1', created_by_employee_id: 'manager-1', created_by_label: 'Yara Meijer', created_by_avatar_url: null,
    owner_employee_id: employee.id, owner_label: employee.label, item_type: type, goal_kind: type === 'GOAL' ? 'GOAL' : null, feedback_direction: type === 'FEEDBACK' ? 'MANAGER_TO_EMPLOYEE' : null,
    title: 'Voorbeeld ' + type, body: 'Beschrijving', occurred_on: '2026-10-14', due_on: type === 'ACTION' ? '2026-10-20' : null, next_meeting_on: null,
    item_status: type === 'ACTION' ? 'OPEN' : 'ACTIVE', priority: type === 'ACTION' ? 'MEDIUM' : null, version: 1, created_at: '2026-10-14T09:00:00.000Z', updated_at: '2026-10-14T09:00:00.000Z',
    comments: [], attachments: [], canEdit: true, canMarkDone: ['ACTION', 'AGREEMENT', 'GOAL'].includes(type), canMarkNotRelevant: ['ACTION', 'AGREEMENT', 'GOAL'].includes(type), canDelete: true,
  }
}

function workspace(items: ContinuousAppraisalItem[]): WorkspaceData {
  return { employeeId: employee.id, employee, items, canWrite: true, canCreateFeedback: true }
}

function mockMutationFetch(status = 200) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/status') || init?.method === 'DELETE') {
      return new Response(JSON.stringify({ id: 'item-ACTION', version: 2 }), { status })
    }
    return new Response(JSON.stringify(workspace([createItem('ACTION')])), { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function setTextValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

afterEach(() => vi.unstubAllGlobals())

function mount(element: ReactNode): { host: HTMLDivElement; root: Root } {
  window.history.replaceState(null, '', '/workforce/continuous-appraisal')
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

for (const populated of [false, true]) {
  for (const category of categories) {
    it((populated ? 'keeps the ' : 'shows the empty-state ') + category.label + ' create action and preselects its type', () => {
      const { host, root } = mount(<ContinuousAppraisalWorkspace initial={workspace(populated ? [createItem(category.type)] : [])} labels={labels} locale="nl" mode="manager" />)
      const tab = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.trim() === category.label)
      expect(tab).toBeDefined()
      act(() => tab?.click())
      const add = host.querySelector<HTMLButtonElement>(populated ? '[data-testid="appraisal-create"] button' : '[data-testid="appraisal-create-empty"] button')
      expect(add).toBeDefined()
      act(() => add?.click())
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).not.toBeNull()
      expect(dialog?.querySelector('select')?.value).toBe(category.type)
      unmount(host, root)
    })
  }
}

describe('Continuous Appraisal create controls', () => {
  it('keeps the all-tab create flow available and opens the type chooser', () => {
    const { host, root } = mount(<ContinuousAppraisalWorkspace initial={workspace([])} labels={labels} locale="nl" mode="manager" />)
    const add = host.querySelector<HTMLButtonElement>('[data-testid="appraisal-create"] button')
    expect(add).toBeDefined()
    act(() => add?.click())
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.querySelector('select')?.value).toBe('NOTE')
    expect(Array.from(dialog?.querySelectorAll('option') ?? []).map((option) => option.value)).toContain('FEEDBACK')
    unmount(host, root)
  })

  it('does not offer feedback creation without its capability', () => {
    const data = workspace([])
    data.canCreateFeedback = false
    const { host, root } = mount(<ContinuousAppraisalWorkspace initial={data} labels={labels} locale="nl" mode="manager" />)
    const tab = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Feedback')
    act(() => tab?.click())
    expect(host.querySelector('[data-testid="appraisal-create"]')).toBeNull()
    const allTab = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Alles')
    act(() => allTab?.click())
    const add = host.querySelector<HTMLButtonElement>('[data-testid="appraisal-create"] button')
    act(() => add?.click())
    const dialog = document.querySelector('[role="dialog"]')
    expect(Array.from(dialog?.querySelectorAll('option') ?? []).map((option) => option.value)).not.toContain('FEEDBACK')
    unmount(host, root)
  })
})

describe('Continuous Appraisal item actions', () => {
  async function openMenu(host: HTMLDivElement) {
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="Meer acties"]')
    expect(trigger).not.toBeNull()
    await act(async () => { trigger?.click() })
  }

  it('sends a versioned Done transition and reports success', async () => {
    const fetchMock = mockMutationFetch()
    const { host, root } = mount(<ContinuousAppraisalWorkspace initial={workspace([createItem('ACTION')])} labels={labels} locale="nl" mode="manager" />)
    await openMenu(host)
    await act(async () => { document.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click(); await Promise.resolve() })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(String(url)).toContain('/items/item-ACTION/status')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({ version: 1, itemStatus: 'DONE' })
    expect(host.textContent).toContain('Het item is als afgerond gemarkeerd.')
    unmount(host, root)
  })

  it('sends NOT_RELEVANT as a distinct versioned status', async () => {
    const fetchMock = mockMutationFetch()
    const { host, root } = mount(<ContinuousAppraisalWorkspace initial={workspace([createItem('ACTION')])} labels={labels} locale="nl" mode="manager" />)
    await openMenu(host)
    const notRelevant = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) => item.textContent?.trim() === 'Niet meer relevant')
    await act(async () => { notRelevant?.dispatchEvent(new MouseEvent('click', { bubbles: true })); await Promise.resolve() })
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/status')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ version: 1, itemStatus: 'NOT_RELEVANT' })
    expect(host.textContent).toContain('Het item is als niet meer relevant gemarkeerd.')
    unmount(host, root)
  })

  it('gives completion and not-relevant menu items distinct semantic colors', async () => {
    const { host, root } = mount(<ContinuousAppraisalWorkspace initial={workspace([createItem('ACTION')])} labels={labels} locale="nl" mode="manager" />)
    await openMenu(host)
    const menuItems = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    expect(menuItems[0]?.textContent).toContain(labels.markDone)
    expect(menuItems[0]?.className).toContain('bg-success-surface')
    expect(menuItems[1]?.textContent).toContain(labels.notRelevant)
    expect(menuItems[1]?.className).toContain('bg-warning-surface')
    expect(menuItems[2]?.className).toContain('text-destructive')
    unmount(host, root)
  })

  it('requires a title-bearing confirmation before soft delete and sends only DELETE', async () => {
    const fetchMock = mockMutationFetch()
    const { host, root } = mount(<ContinuousAppraisalWorkspace initial={workspace([createItem('ACTION')])} labels={labels} locale="nl" mode="manager" />)
    await openMenu(host)
    const deleteAction = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) => item.textContent?.trim() === 'Verwijderen')
    await act(async () => { deleteAction?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('Voorbeeld ACTION')
    expect(dialog?.textContent).toContain('verdwijnt uit de normale tijdlijn')
    expect(fetchMock).not.toHaveBeenCalled()
    const confirm = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find((button) => button.textContent?.trim() === 'Verwijderen')
    await act(async () => { confirm?.click(); await Promise.resolve() })
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE')
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ version: 1 })
    unmount(host, root)
  })

  it('keeps the confirmation open and reports a concurrent version conflict', async () => {
    const fetchMock = mockMutationFetch(409)
    const { host, root } = mount(<ContinuousAppraisalWorkspace initial={workspace([createItem('ACTION')])} labels={labels} locale="nl" mode="manager" />)
    await openMenu(host)
    const deleteAction = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) => item.textContent?.trim() === 'Verwijderen')
    await act(async () => { deleteAction?.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    const dialog = document.querySelector('[role="dialog"]')
    const confirm = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find((button) => button.textContent?.trim() === 'Verwijderen')
    await act(async () => { confirm?.click(); await Promise.resolve() })
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    expect(host.textContent).toContain('Dit item is ondertussen gewijzigd.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    unmount(host, root)
  })

  it('does not render actions the server capability does not allow', async () => {
    const action = createItem('ACTION')
    action.canMarkDone = false
    action.canMarkNotRelevant = false
    action.canDelete = false
    const { host, root } = mount(<ContinuousAppraisalWorkspace initial={workspace([action])} labels={labels} locale="nl" mode="manager" />)
    expect(host.querySelector('button[aria-label="Meer acties"]')).toBeNull()
    unmount(host, root)
  })

  it('does not offer completion for a note', async () => {
    const { host, root } = mount(<ContinuousAppraisalWorkspace initial={workspace([createItem('NOTE')])} labels={labels} locale="nl" mode="manager" />)
    await openMenu(host)
    const menu = document.querySelector('[role="menu"]')
    expect(menu?.textContent).not.toContain('Klaar')
    expect(menu?.textContent).not.toContain('Niet meer relevant')
    expect(menu?.textContent).toContain('Verwijderen')
    unmount(host, root)
  })

  it('does not expose any menu action for a locked system event', () => {
    const systemEvent = createItem('SYSTEM_EVENT')
    systemEvent.canMarkDone = false
    systemEvent.canMarkNotRelevant = false
    systemEvent.canDelete = false
    const { host, root } = mount(<ContinuousAppraisalWorkspace initial={workspace([systemEvent])} labels={labels} locale="nl" mode="manager" />)
    expect(host.querySelector('button[aria-label="Meer acties"]')).toBeNull()
    unmount(host, root)
  })
})

describe('Continuous Appraisal drawer attachments', () => {
  it('retries only failed attachments after partial upload without creating the item twice', async () => {
    let attachmentCount = 0
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/continuous-appraisal' && init?.method === 'POST') return new Response(JSON.stringify({ id: 'item-created' }), { status: 201 })
      if (url.includes('/attachments')) {
        attachmentCount += 1
        return new Response('{}', { status: attachmentCount === 2 ? 500 : 201 })
      }
      return new Response(JSON.stringify(workspace([createItem('NOTE')])), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const { host, root } = mount(<ContinuousAppraisalWorkspace initial={workspace([])} labels={labels} locale="nl" mode="manager" />)
    const add = host.querySelector<HTMLButtonElement>('[data-testid="appraisal-create"] button')
    await act(async () => { add?.click() })
    const dialog = document.querySelector('[role="dialog"]')
    const title = dialog?.querySelector<HTMLInputElement>('input[maxlength="160"]')
    const body = dialog?.querySelector<HTMLTextAreaElement>('textarea')
    const fileInput = dialog?.querySelector<HTMLInputElement>('input[type="file"]')
    expect(title).not.toBeNull()
    expect(body).not.toBeNull()
    expect(fileInput).not.toBeNull()
    await act(async () => {
      if (title) setTextValue(title, 'Voortgangsgesprek')
      if (body) setTextValue(body, 'Leg het afgesproken vervolg vast.')
      if (fileInput) {
        Object.defineProperty(fileInput, 'files', { configurable: true, value: [new File(['one'], 'een.pdf', { type: 'application/pdf' }), new File(['two'], 'twee.pdf', { type: 'application/pdf' })] })
        fileInput.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    const save = dialog?.querySelector<HTMLButtonElement>('button[type="submit"]')
    await act(async () => { save?.click(); await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Het item is opgeslagen, maar niet alle bijlagen zijn geüpload.')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('twee.pdf')
    const retry = document.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')
    expect(retry?.textContent).toContain('Bijlagen opnieuw proberen')
    await act(async () => { retry?.click(); await new Promise((resolve) => setTimeout(resolve, 0)) })
    const createCalls = fetchMock.mock.calls.filter(([url, init]) => String(url) === '/api/continuous-appraisal' && init?.method === 'POST')
    const uploadCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/attachments'))
    expect(createCalls).toHaveLength(1)
    expect(uploadCalls).toHaveLength(3)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    unmount(host, root)
  })
})
