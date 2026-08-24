// @vitest-environment happy-dom

import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JourneySteps, type JourneyStepsLabels } from './journey-steps'
import type { JourneyProjection } from '@/lib/journeys/projection-domain'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

const labels: JourneyStepsLabels = {
  back: 'Terug', title: 'Journey-stappen', subtitle: 'Bekijk de stappen.', progress: 'Voortgang', nextAction: 'Volgende actie', available: 'Beschikbaar', upcomingTopic: 'Binnenkort beschikbaar', completeTopic: 'Afronden', skipTopic: 'Overslaan', topicDetails: 'Topicdetails', openTopicAction: 'Open actie', outcomeSaved: 'Opgeslagen', topicActionFailed: 'Mislukt', timeline: 'Tijdlijn', participantsLabel: 'Team', active: 'Actief', planned: 'Gepland', paused: 'Gepauzeerd', completed: 'Afgerond', cancelled: 'Geannuleerd', topicPending: 'Openstaand', topicCompleted: 'Afgerond', topicSkipped: 'Overgeslagen', topicTypes: { INFORMATION: 'Informatie', ACTION: 'Actie', CHECK_IN: 'Check-in', DOCUMENT: 'Document' }, required: 'Verplicht', optional: 'Optioneel', targetEmployee: 'Medewerker', anchorDate: 'Ankerdatum', emptySteps: 'Geen stappen.', skipConfirmTitle: 'Topic overslaan?', skipConfirmDescription: 'Niet terug te draaien.', skipConfirm: 'Topic overslaan', cancel: 'Annuleren',
}

const projection: JourneyProjection = {
  id: '11111111-1111-4111-8111-111111111111',
  templateName: { nl: 'Onboarding', en: 'Onboarding' },
  status: 'ACTIVE', anchorDate: '2026-08-24', targetEmployeeName: 'Noah Hendriks', relationship: 'SELF', progress: { completed: 0, total: 2 }, nextAction: null,
  participants: [{ roleKey: 'employee', roleName: { nl: 'Medewerker', en: 'Employee' }, employeeName: 'Noah Hendriks', status: 'ACTIVE' }],
  phases: [{ id: '22222222-2222-4222-8222-222222222222', key: 'start', name: { nl: 'Start', en: 'Start' }, sortOrder: 10, moments: [{ id: '33333333-3333-4333-8333-333333333333', key: 'day-one', name: { nl: 'Dag één', en: 'Day one' }, scheduledOn: '2026-08-24', availableOn: '2026-08-23', sortOrder: 10, topics: [{ id: '44444444-4444-4444-8444-444444444444', key: 'welcome', title: { nl: 'Welkom', en: 'Welcome' }, body: { nl: 'Welkom.', en: 'Welcome.' }, topicType: 'INFORMATION', isRequired: true, status: 'PENDING', actionUrl: null, ownerRoleKey: 'employee' }] }, { id: '55555555-5555-4555-8555-555555555555', key: 'later', name: { nl: 'Later', en: 'Later' }, scheduledOn: '2026-08-26', availableOn: '2026-08-26', sortOrder: 20, topics: [{ id: '66666666-6666-4666-8666-666666666666', key: 'later', title: { nl: 'Later', en: 'Later' }, body: { nl: 'Later.', en: 'Later.' }, topicType: 'ACTION', isRequired: false, status: 'PENDING', actionUrl: null, ownerRoleKey: 'employee' }] }] }],
}

function mount() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(createElement(JourneySteps, { backHref: '/dashboard/start', labels, locale: 'nl', mode: 'participant', projection })))
  return { host, root }
}

afterEach(() => {
  vi.unstubAllGlobals()
  refreshMock.mockReset()
  document.querySelectorAll('[data-liquidhr-overlay-root]').forEach((element) => element.remove())
})

describe('Journey steps runtime surface', () => {
  it('uses Foundation surfaces and only renders actions for the available topic', () => {
    const markup = document.createElement('div')
    const root = createRoot(markup)
    act(() => root.render(createElement(JourneySteps, { backHref: '/dashboard/start', labels, locale: 'nl', mode: 'participant', projection })))
    expect(markup.innerHTML).toContain('bg-surface')
    expect(markup.textContent).toContain('Welkom')
    expect(markup.textContent).toContain('Beschikbaar')
    expect(markup.textContent).toContain('Binnenkort beschikbaar')
    expect(Array.from(markup.querySelectorAll('button')).filter((button) => button.textContent === 'Afronden')).toHaveLength(1)
    expect(Array.from(markup.querySelectorAll('button')).filter((button) => button.textContent === 'Overslaan')).toHaveLength(1)
    act(() => root.unmount())
  })

  it('posts COMPLETE and refreshes after a successful response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { host, root } = mount()
    await act(async () => {
      const button = Array.from(host.querySelectorAll('button')).find((candidate) => candidate.textContent === 'Afronden') as HTMLButtonElement
      button.click()
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/journeys/11111111-1111-4111-8111-111111111111/topics/44444444-4444-4444-8444-444444444444/outcome', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ outcomeType: 'COMPLETE' }) })
    expect(refreshMock).toHaveBeenCalledOnce()
    act(() => root.unmount())
    host.remove()
  })

  it('requires confirmation before posting SKIP', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { host, root } = mount()
    act(() => {
      const button = Array.from(host.querySelectorAll('button')).find((candidate) => candidate.textContent === 'Overslaan') as HTMLButtonElement
      button.click()
    })
    expect(fetchMock).not.toHaveBeenCalled()
    const confirm = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Topic overslaan') as HTMLButtonElement
    await act(async () => { confirm.click(); await Promise.resolve() })
    expect(fetchMock).toHaveBeenCalledWith('/api/journeys/11111111-1111-4111-8111-111111111111/topics/44444444-4444-4444-8444-444444444444/outcome', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ outcomeType: 'SKIP' }) })
    act(() => root.unmount())
    host.remove()
  })
})
