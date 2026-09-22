// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createTranslator } from '@/lib/i18n/translator'
import type { FocusHomeData } from '@/lib/focus/service'
import type { FocusManagerHomeData } from '@/lib/focus/manager-home-service'
import type { Locale } from '@/lib/i18n/config'
import nl from '@/messages/nl/focus.json'
import en from '@/messages/en/focus.json'
import { FocusHome } from './focus-home'
import { visibleJourneyActionHref } from './focus-view'
import { focusData, focusJourney } from './test-fixtures'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))

function render(data: FocusHomeData, locale: Locale = 'nl') {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(<FocusHome data={data} locale={locale} today="2026-09-17" t={createTranslator(locale === 'nl' ? nl : en)} journeyTitle={data.journey?.templateName[locale] ?? null} journeyActionHref={visibleJourneyActionHref(data, data.journey?.nextAction?.actionUrl ?? null)} />)
  return host
}

describe('Focus home', () => {
  const managerHome: FocusManagerHomeData = {
    weekStart: '2026-09-14',
    weekEnd: '2026-09-20',
    sick: [{ employeeId: 'sick-1', employeeName: 'Lisa de Vries', firstAbsenceOn: '2026-09-17', days: 2, pendingConfirmation: true }],
    vacation: [{ employeeId: 'leave-1', employeeName: 'Marlou de Vries', startDate: '2026-09-16', endDate: '2026-09-16', overlapStartDate: '2026-09-16', timeMode: 'MORNING', specificStart: null, specificEnd: null }],
    vacationTotal: 1,
  }

  it('keeps the header concise and exposes the shared bottom navigation', () => {
    const host = render(focusData())
    expect(host.textContent).not.toContain('Je volgende stap en je belangrijkste zaken bij elkaar.')
    expect(host.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain('Mijn Focus')
    expect(host.querySelector('nav[aria-label="Focus-navigatie"]')).not.toBeNull()
  })

  it.each(['nl', 'en'] as const)('renders all permitted manager actions with real %s translations and progress', (locale) => {
    const host = render(focusData({ experience: 'MANAGER' }), locale)
    expect(host.querySelector('h1')?.textContent).toContain('Noah Test')
    expect(host.querySelector('progress')?.getAttribute('value')).toBe('33')
    expect(host.querySelector('progress')?.getAttribute('aria-labelledby')).toBe('focus-journey-progress')
    expect(host.querySelector('a[href="/focus/werk"]')).not.toBeNull()
    expect(host.querySelector('a[href="/focus/team"]')).not.toBeNull()
    expect(host.querySelector('a[href="/my-signatures"]')).not.toBeNull()
    expect(host.querySelector('a[href="/dashboard/start"]')).not.toBeNull()
    expect(host.textContent).not.toMatch(/\{\w+\}/)
  })

  it('renders the two operational Manager Home cards and keeps them out of Act-as Employee', () => {
    const managerHost = render(focusData({ experience: 'MANAGER', managerHome }))
    expect(managerHost.textContent).toContain('Ziek in mijn team')
    expect(managerHost.textContent).toContain('Te bevestigen')
    expect(managerHost.textContent).toContain('Op vakantie deze week')
    expect(managerHost.textContent).toContain('Marlou de Vries')
    expect(managerHost.querySelector('a[href="/focus/werk"]')).not.toBeNull()

    const actAsHost = render(focusData({ experience: 'MANAGER', managerHome, actAs: {
      token: 'token', actorUserId: 'actor', tenantId: 'tenant', hrGroupId: 'group', subjectEmployeeId: 'subject', mode: 'FOCUS_ESS', expiresAt: 1, subjectName: 'Lisa de Vries',
    } }))
    expect(actAsHost.textContent).not.toContain('Ziek in mijn team')
    expect(actAsHost.textContent).not.toContain('Op vakantie deze week')
  })

  it('suppresses full, leave, requests, work and team for preboarding even with stale broad actions', () => {
    const host = render(focusData({ experience: 'PREBOARDING', isPreboarding: true, employee: { ...focusData().employee!, effectiveEmploymentStartDate: '2026-09-18' } }))
    expect(host.textContent).toContain('Morgen is je eerste werkdag.')
    expect(host.textContent).toContain('Je start op 18 september 2026')
    expect(host.querySelectorAll('li a')).toHaveLength(3)
    const hrefs = Array.from(host.querySelectorAll('a')).map((link) => link.getAttribute('href'))
    expect(hrefs).not.toContain('/dashboard/start')
    expect(hrefs).not.toContain('/focus/werk')
    expect(hrefs).not.toContain('/focus/team')
    expect(hrefs).not.toContain('/focus/aanvragen')
    expect(hrefs.some((href) => href?.includes('/employees/'))).toBe(false)
  })

  it('does not turn an upcoming journey action into an actionable link', () => {
    const host = render(focusData({ journey: { ...focusJourney, nextAction: { ...focusJourney.nextAction!, availability: 'UPCOMING', availableOn: '2026-10-01' } } }))
    expect(host.textContent).toContain('Beschikbaar vanaf 1 oktober 2026')
    expect(host.querySelector('a[href="/my-signatures"]')).toBeNull()
    expect(host.querySelector(`a[href="/journeys/${focusJourney.id}"]`)).not.toBeNull()
  })

  it('shows day-one messaging only on the effective start date', () => {
    expect(render(focusData()).textContent).toContain('Vandaag is je eerste werkdag')
    expect(render(focusData({ employee: { ...focusData().employee!, effectiveEmploymentStartDate: '2026-09-16' } })).textContent).not.toContain('Vandaag is je eerste werkdag')
  })

  it('does not show actions, stale journeys, or Full access without employment', () => {
    const host = render(focusData({ experience: 'NO_EMPLOYMENT', presentation: 'FOCUS', canOpenFull: false }))
    expect(host.textContent).toContain('Nog geen actief dienstverband')
    expect(host.querySelectorAll('li a, progress')).toHaveLength(0)
    expect(host.querySelector('a[href="/dashboard/start"]')).toBeNull()
    expect(visibleJourneyActionHref(focusData({ experience: 'NO_EMPLOYMENT' }), '/my-signatures')).toBeNull()
  })

  it('renders a useful empty state when no journey or actions are available', () => {
    const host = render(focusData({ journey: null, actions: [] }))
    expect(host.textContent).toContain('Nog geen journey beschikbaar')
    expect(host.textContent).toContain('Nog geen acties beschikbaar')
  })

  it('keeps preboarding journey actions inside the assigned journey or signing area', () => {
    const data = focusData({ experience: 'PREBOARDING' })
    expect(visibleJourneyActionHref(data, '/employees/another-employee?tab=personal')).toBeNull()
    expect(visibleJourneyActionHref(data, '/company-documents')).toBeNull()
    expect(visibleJourneyActionHref(data, `/journeys/${focusJourney.id}/steps`)).toBe(`/journeys/${focusJourney.id}/steps`)
    expect(visibleJourneyActionHref(data, '/my-signatures?status=prepared')).toBe('/my-signatures?status=prepared')
    expect(visibleJourneyActionHref(data, null)).toBeNull()
  })
})
