import type { FocusHomeData } from '@/lib/focus/service'
import type { Locale } from '@/lib/i18n/config'

export function isPreboardingFocus(data: FocusHomeData): boolean {
  return data.isPreboarding || data.experience === 'PREBOARDING'
}

export function visibleFocusActions(data: FocusHomeData): FocusHomeData['actions'] {
  if (data.experience === 'NO_EMPLOYMENT' || !data.employee) return []
  if (!isPreboardingFocus(data)) return data.actions
  return data.actions.filter((action) => (
    (action.key === 'journey' && action.href === '/focus/onboarding')
    || (action.key === 'profile' && action.href === '/focus/profiel')
    || (action.key === 'documents' && action.href === '/focus/documenten')
  ))
}

export function focusDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'nl' ? 'nl-NL' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

// De service valideert de URL; preboarding beperkt ook het navigatieoppervlak.
export function visibleJourneyActionHref(data: FocusHomeData, safeHref: string | null): string | null {
  if (!safeHref || data.journey?.nextAction?.availability !== 'AVAILABLE') return null
  if (!isPreboardingFocus(data)) return safeHref
  const pathname = safeHref.split(/[?#]/)[0]
  const journeyPath = `/journeys/${data.journey.id}`
  return pathname === journeyPath || pathname.startsWith(`${journeyPath}/`)
    || pathname === '/my-signatures' || pathname.startsWith('/my-signatures/')
    ? safeHref : null
}
