// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createTranslator } from '@/lib/i18n/translator'
import type { FocusHomeData } from '@/lib/focus/service'
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

  it('does not show actions or a stale journey without employment', () => {
    const host = render(focusData({ experience: 'NO_EMPLOYMENT', employee: null }))
    expect(host.textContent).toContain('Nog geen actief dienstverband')
    expect(host.querySelectorAll('li a, progress')).toHaveLength(0)
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
