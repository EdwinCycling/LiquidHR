// @vitest-environment happy-dom

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { TemplateDesigner } from './template-designer'
import type { JourneyTemplateDetail } from '@/lib/journeys'
import type { JourneyLabels } from '@/lib/journeys/labels'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

const labels = {
  backToCatalog: 'Terug naar templates', designerTitle: 'Template Designer', designerSubtitle: 'Configureer de template.',
  key: 'Technische sleutel', immutableHint: 'Publicatie maakt een nieuwe immutable versie.', published: 'Gepubliceerd', retired: 'Uitgefaseerd', draft: 'Concept', draftRevision: 'Draftrevisie',
  name: 'Naam', languageHint: 'Nederlands en Engels zijn verplicht.', nl: 'Nederlands', en: 'Engels', description: 'Beschrijving', type: 'Type', anchor: 'Ankerdatum',
  types: { ONBOARDING: 'Onboarding' }, anchors: { EMPLOYMENT_START_DATE: 'Startdatum' }, phases: 'Fases', addPhase: 'Fase toevoegen', roles: 'Rollen', addRole: 'Rol toevoegen',
  moments: 'Momenten', addMoment: 'Moment toevoegen', topics: 'Topics', addTopic: 'Topic toevoegen', noTopics: 'Geen topics.', remove: 'Verwijderen', phase: 'Fase', moment: 'Moment',
  topicType: 'Topictype', ownerRole: 'Eigenaarrol', moveUp: 'Omhoog', moveDown: 'Omlaag', required: 'Verplicht', resolver: 'Resolver', cardinality: 'Deelnemers', one: 'Eén', many: 'Meerdere',
  resolvers: { TARGET_EMPLOYEE: 'Target-medewerker' }, audience: 'Audience', cancel: 'Annuleren', save: 'Opslaan', publish: 'Publiceren', retire: 'Uitfaseren', publishConfirm: 'Nieuwe versie publiceren?', retireConfirm: 'Template uitfaseren?',
  keepEditing: 'Terug naar formulier', discardChanges: 'Wijzigingen negeren', discardDescription: 'Niet-opgeslagen wijzigingen gaan verloren.', discardChangesTitle: 'Wijzigingen negeren?', readOnlyDescription: 'Alleen-lezen.', invalid: 'Ongeldig.', failed: 'Mislukt.',
  version: 'Versie', publishedMessage: 'Gepubliceerd.', dateOffset: 'Dagoffset', availabilityOffset: 'Beschikbaar vanaf', body: 'Inhoud', actionUrl: 'Actielink', cannotRemoveInUse: 'In gebruik.', saving: 'Opslaan…', publishing: 'Publiceren…', saved: 'Opgeslagen.',
  operationFailed: 'Mislukt.',
} as unknown as JourneyLabels

const template: JourneyTemplateDetail = {
  id: '00000000-0000-4000-8000-000000000001', key: 'onboarding', name: { nl: 'Onboarding', en: 'Onboarding' }, description: { nl: 'Start', en: 'Start' },
  journeyType: 'ONBOARDING', lifecycle: 'DRAFT', draftId: '00000000-0000-4000-8000-000000000002', draftRevision: 1, publishedVersionNumber: null, updatedAt: '2026-08-24T12:00:00.000Z',
  draft: {
    name: { nl: 'Onboarding', en: 'Onboarding' }, description: { nl: 'Start', en: 'Start' }, journeyType: 'ONBOARDING', anchorRule: 'EMPLOYMENT_START_DATE',
    phases: [{ key: 'start', name: { nl: 'Start', en: 'Start' }, sortOrder: 10 }],
    roles: [{ key: 'employee', name: { nl: 'Medewerker', en: 'Employee' }, required: true, cardinality: 'ONE', resolverType: 'TARGET_EMPLOYEE', resolverRoleCode: null, resolverEmployeeId: null, sortOrder: 10 }],
    moments: [{ key: 'welcome', phaseKey: 'start', name: { nl: 'Welkom', en: 'Welcome' }, dateOffsetDays: 0, availabilityOffsetDays: 0, sortOrder: 10 }], topics: [],
  },
  versions: [],
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

describe('TemplateDesigner Foundation migration', () => {
  it('maakt alle draft controls echt read-only zonder mutation actions', () => {
    const { host, root } = mount(<TemplateDesigner canPublish={false} canWrite={false} employeeOptions={[]} labels={labels} locale="nl" managementRoleOptions={[]} template={template} />)
    expect(host.querySelectorAll('input:not([disabled]), textarea:not([disabled])')).toHaveLength(0)
    expect(host.textContent).not.toContain(labels.publish)
    expect(host.textContent).not.toContain(labels.save)
    unmount(host, root)
  })

  it('gebruikt ConfirmDialog voor publiceren en nooit window.confirm', () => {
    const nativeConfirm = vi.fn()
    vi.stubGlobal('confirm', nativeConfirm)
    const { host, root } = mount(<TemplateDesigner canPublish canWrite employeeOptions={[]} labels={labels} locale="nl" managementRoleOptions={[]} template={template} />)
    const publish = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes(labels.publish)) as HTMLButtonElement
    act(() => publish.click())
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(labels.publishConfirm)
    expect(nativeConfirm).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
    unmount(host, root)
  })

  it('beschermt dirty navigatie met dezelfde ConfirmDialog', () => {
    const { host, root } = mount(<TemplateDesigner canPublish={false} canWrite employeeOptions={[]} labels={labels} locale="nl" managementRoleOptions={[]} template={template} />)
    const addPhase = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes(labels.addPhase)) as HTMLButtonElement
    act(() => addPhase.click())
    const back = Array.from(host.querySelectorAll('button')).find((button) => button.textContent?.includes(labels.backToCatalog)) as HTMLButtonElement
    act(() => back.click())
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(labels.discardChangesTitle)
    expect(push).not.toHaveBeenCalled()
    unmount(host, root)
  })
})
